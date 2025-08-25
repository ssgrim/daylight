// Lightweight adapters for external data sources (no new dependencies)
// Uses public APIs that don't require API keys by default.

import fs from 'fs'
import path from 'path'
// @ts-ignore
import LRU from './lru.mjs'
// @ts-ignore
import { info, warn, error } from './logger.mjs'
// @ts-ignore
import { getSeasonFor } from './season.mjs'
// @ts-ignore
import { initDb, appendDb } from './history.mjs'
// @ts-ignore
import { getSecretValue } from './secrets.mjs'
// @ts-ignore
import { fetchLocalEvents, getEventsCacheMetrics } from './events.mjs'
// @ts-ignore
import { fetchTraffic, getTrafficCacheMetrics } from './traffic.mjs'
import { 
  weatherCircuitBreaker, 
  geocodeCircuitBreaker, 
  eventsCircuitBreaker, 
  trafficCircuitBreaker 
} from './circuit-breaker'
// Expose cache metrics for monitoring
export function getCacheMetrics() {
  return {
    events: getEventsCacheMetrics(),
    traffic: getTrafficCacheMetrics(),
  }
}

const geocodeCache = LRU(500)
const HISTORY_FILE = path.resolve(process.cwd(), 'backend', 'external_history.log')
let dbPromise: any = null
try { dbPromise = initDb() } catch (e) { dbPromise = null }

/**
 * Fetch with timeout and abort controller
 */
function timeoutFetch(url: string, opts: any = {}, ms: number = 3000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  // @ts-ignore fetch is available in Node 18+ in this dev environment
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id))
}

/**
 * Retry function with exponential backoff
 */
async function retry(fn: () => Promise<any>, attempts: number = 2, delayMs: number = 300) {
  let lastErr = null
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, delayMs)) }
  }
  throw lastErr
}

/** Append entry to history file */
function appendHistory(entry: any) {
  try { fs.appendFileSync(HISTORY_FILE, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n') } catch (e) { /* ignore */ }
}


// --- Provider Abstraction Layer ---
const weatherProviders = {
  'open-meteo': async (lat: number, lng: number) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&current_weather=true&timezone=UTC`
    const raw = await retry(() => timeoutFetch(url, { method: 'GET' }, 2500), 2, 300)
    if (!raw.ok) throw new Error(`weather fetch failed: ${raw.status}`)
    const body = await raw.json()
    const cw = body.current_weather || {}
    const summary = cw.temperature != null ? `Temp ${cw.temperature}°C, wind ${cw.windspeed} km/h` : undefined
    const season = getSeasonFor(lat, new Date())
    appendHistory({ type: 'weather', provider: 'open-meteo', lat, lng, ok: true, season })
    return { temperatureC: cw.temperature, windSpeedKph: cw.windspeed, weatherCode: cw.weathercode, summary, season }
  },
  // Add more providers here
}

const eventsProviders = {
  'default': async (lat: number, lng: number) => fetchLocalEvents(lat, lng),
  // Add more providers here
}

const trafficProviders = {
  'default': async (lat: number, lng: number) => fetchTraffic(lat, lng),
  // Add more providers here
}

export async function fetchWeather(lat: number, lng: number) {
  const provider = process.env.WEATHER_PROVIDER || 'open-meteo'
  const fn = weatherProviders[provider as keyof typeof weatherProviders]
  if (!fn) throw new Error('unsupported weather provider: ' + provider)
  
  return await weatherCircuitBreaker.execute(
    () => fn(lat, lng),
    () => ({
      temperatureC: 20,
      windSpeedKph: 10,
      weatherCode: 0,
      summary: 'Weather data unavailable',
      season: getSeasonFor(lat, new Date())
    })
  )
}

export async function fetchEvents(lat: number, lng: number) {
  const provider = process.env.EVENTS_PROVIDER || 'default'
  const fn = eventsProviders[provider as keyof typeof eventsProviders]
  if (!fn) throw new Error('unsupported events provider: ' + provider)
  
  return await eventsCircuitBreaker.execute(
    async () => {
      try {
        return await fn(lat, lng)
      } catch (e) {
        error('Events fetch failed', { provider, lat, lng, error: e })
        return { provider: 'error', events: [], error: String(e) }
      }
    },
    () => ({ provider: 'fallback', events: [], error: 'Service temporarily unavailable' })
  )
}

export async function fetchTrafficInfo(lat: number, lng: number) {
  const provider = process.env.TRAFFIC_PROVIDER || 'default'
  const fn = trafficProviders[provider as keyof typeof trafficProviders]
  if (!fn) throw new Error('unsupported traffic provider: ' + provider)
  
  return await trafficCircuitBreaker.execute(
    async () => {
      try {
        return await fn(lat, lng)
      } catch (e) {
        error('Traffic fetch failed', { provider, lat, lng, error: e })
        return { provider: 'error', congestion: null, error: String(e) }
      }
    },
    () => ({ provider: 'fallback', congestion: 25, error: 'Service temporarily unavailable' })
  )
}

/** @param {number} lat @param {number} lng */
export async function reverseGeocode(lat: number, lng: number) {
  const key = `${lat},${lng}`
  const cached = geocodeCache.get(key)
  if (cached) return cached
  
  return await geocodeCircuitBreaker.execute(
    async () => {
      const provider = process.env.GEOCODE_PROVIDER || 'nominatim'
      if (provider === 'nominatim') {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`
        const raw = await retry(() => timeoutFetch(url, { method: 'GET', headers: { 'User-Agent': 'daylight/0.1 (+https://example.com)' } }, 2500), 2, 300)
        if (!raw.ok) throw new Error(`geocode fetch failed: ${raw.status}`)
        const body = await raw.json()
        const result = { display_name: body.display_name }
        geocodeCache.set(key, result)
        const entry = { type: 'geocode', provider, lat, lng, ok: true }
        if (dbPromise) (await dbPromise).then(db => appendDb(db, { ts: new Date().toISOString(), ...entry }))
        else appendHistory(entry)
        return result
      }
      
      if (provider === 'mapbox') {
        let token = process.env.MAPBOX_TOKEN
        // if a secret ARN is provided, fetch it at runtime (dev + prod)
        const secretArn = process.env.MAPBOX_SECRET_ARN
        if (secretArn) {
          try { const s = await getSecretValue(secretArn); if (s) token = s } catch (e) { /* ignore */ }
        }
        if (!token) throw new Error('MAPBOX_TOKEN not set')
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(lng)},${encodeURIComponent(lat)}.json?access_token=${encodeURIComponent(token)}&limit=1`
        const raw = await retry(() => timeoutFetch(url, { method: 'GET' }, 2500), 2, 300)
        if (!raw.ok) throw new Error(`mapbox geocode failed: ${raw.status}`)
        const body = await raw.json()
        const place = body.features?.[0]?.place_name
        const result = { display_name: place }
        geocodeCache.set(key, result)
        const entry = { type: 'geocode', provider, lat, lng, ok: true }
        if (dbPromise) (await dbPromise).then(db => appendDb(db, { ts: new Date().toISOString(), ...entry }))
        else appendHistory(entry)
        return result
      }
      
      throw new Error('unsupported geocode provider')
    },
    () => ({ display_name: `Location near ${lat.toFixed(2)}, ${lng.toFixed(2)}` })
  )
}

