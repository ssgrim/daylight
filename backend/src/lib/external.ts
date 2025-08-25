// Lightweight adapters for external data sources (no new dependencies)
// Uses public APIs that don't require API keys by default.

import fs from 'fs'
import path from 'path'
// Use the shared cache (Redis when configured, memory otherwise)
// @ts-ignore
import { createCache } from './cache.mjs'
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
// Expose cache metrics for monitoring
// Create caches per data type with sensible defaults, configurable via env vars.
const GEOCODE_TTL_MS = parseInt(process.env.GEOCODE_TTL_MS || String(24 * 60 * 60 * 1000)) // 24h
const WEATHER_TTL_MS = parseInt(process.env.WEATHER_TTL_MS || String(2 * 60 * 1000)) // 2m
const EVENTS_TTL_MS = parseInt(process.env.EVENTS_TTL_MS || String(60 * 1000)) // 1m
const TRAFFIC_TTL_MS = parseInt(process.env.TRAFFIC_TTL_MS || String(30 * 1000)) // 30s

// createCache returns a cache object; methods may be sync or async depending on backend.
const geocodeCache = createCache(GEOCODE_TTL_MS)
const weatherCache = createCache(WEATHER_TTL_MS)
const eventsCache = createCache(EVENTS_TTL_MS)
const trafficCache = createCache(TRAFFIC_TTL_MS)

export function getCacheMetrics() {
  // Combine metrics from module-level caches and provider-specific caches
  const metrics: any = {
    eventsModule: getEventsCacheMetrics ? getEventsCacheMetrics() : undefined,
    trafficModule: getTrafficCacheMetrics ? getTrafficCacheMetrics() : undefined,
    geocode: geocodeCache && typeof geocodeCache.metrics === 'function' ? geocodeCache.metrics() : undefined,
    weather: weatherCache && typeof weatherCache.metrics === 'function' ? weatherCache.metrics() : undefined,
    events: eventsCache && typeof eventsCache.metrics === 'function' ? eventsCache.metrics() : undefined,
    traffic: trafficCache && typeof trafficCache.metrics === 'function' ? trafficCache.metrics() : undefined,
  }
  return metrics
}
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

// Invalidation helpers
export async function invalidateCacheFor(type: string, key?: string) {
  try {
    if (!type) return false
    if (type === 'geocode') {
      if (!key) { if (geocodeCache && geocodeCache.clear) await geocodeCache.clear(); return true }
      if (geocodeCache && geocodeCache.invalidate) return geocodeCache.invalidate(key)
      return false
    }
    if (type === 'weather') {
      if (!key) { if (weatherCache && weatherCache.clear) await weatherCache.clear(); return true }
      if (weatherCache && weatherCache.invalidate) return weatherCache.invalidate(key)
      return false
    }
    if (type === 'events') {
      if (!key) { if (eventsCache && eventsCache.clear) await eventsCache.clear(); return true }
      if (eventsCache && eventsCache.invalidate) return eventsCache.invalidate(key)
      return false
    }
    if (type === 'traffic') {
      if (!key) { if (trafficCache && trafficCache.clear) await trafficCache.clear(); return true }
      if (trafficCache && trafficCache.invalidate) return trafficCache.invalidate(key)
      return false
    }
    return false
  } catch (e) {
    return false
  }
}

export async function clearAllCaches() {
  try {
    if (geocodeCache && geocodeCache.clear) await geocodeCache.clear()
    if (weatherCache && weatherCache.clear) await weatherCache.clear()
    if (eventsCache && eventsCache.clear) await eventsCache.clear()
    if (trafficCache && trafficCache.clear) await trafficCache.clear()
    return true
  } catch (e) { return false }
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
  const key = `weather:${provider}:${lat.toFixed(5)}:${lng.toFixed(5)}`
  try {
    const cached = weatherCache ? await weatherCache.get(key) : undefined
    if (cached) return cached
  } catch (e) { /* ignore cache errors */ }

  const result = await fn(lat, lng)
  try { if (weatherCache) await weatherCache.set(key, result, WEATHER_TTL_MS) } catch (e) { /* ignore */ }
  return result
}

export async function fetchEvents(lat: number, lng: number) {
  const provider = process.env.EVENTS_PROVIDER || 'default'
  const fn = eventsProviders[provider as keyof typeof eventsProviders]
  if (!fn) throw new Error('unsupported events provider: ' + provider)
  try {
    const key = `events:${provider}:${lat.toFixed(4)}:${lng.toFixed(4)}`
    try {
      const cached = eventsCache ? await eventsCache.get(key) : undefined
      if (cached) return cached
    } catch (e) { /* ignore cache errors */ }

    const res = await fn(lat, lng)
    try { if (eventsCache) await eventsCache.set(key, res, EVENTS_TTL_MS) } catch (e) { /* ignore */ }
    return res
  } catch (e) {
    return { provider: 'error', events: [], error: String(e) }
  }
}

export async function fetchTrafficInfo(lat: number, lng: number) {
  const provider = process.env.TRAFFIC_PROVIDER || 'default'
  const fn = trafficProviders[provider as keyof typeof trafficProviders]
  if (!fn) throw new Error('unsupported traffic provider: ' + provider)
  try {
    const key = `traffic:${provider}:${lat.toFixed(4)}:${lng.toFixed(4)}`
    try {
      const cached = trafficCache ? await trafficCache.get(key) : undefined
      if (cached) return cached
    } catch (e) { /* ignore cache errors */ }

    const res = await fn(lat, lng)
    try { if (trafficCache) await trafficCache.set(key, res, TRAFFIC_TTL_MS) } catch (e) { /* ignore */ }
    return res
  } catch (e) {
    return { provider: 'error', congestion: null, error: String(e) }
  }
}

/** @param {number} lat @param {number} lng */
export async function reverseGeocode(lat: number, lng: number) {
  const key = `${lat.toFixed(6)},${lng.toFixed(6)}`
  try {
    const cached = geocodeCache ? await geocodeCache.get(key) : undefined
    if (cached) return cached
  } catch (e) { /* ignore cache errors */ }
  const provider = process.env.GEOCODE_PROVIDER || 'nominatim'
  if (provider === 'nominatim') {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`
    try {
      const raw = await retry(() => timeoutFetch(url, { method: 'GET', headers: { 'User-Agent': 'daylight/0.1 (+https://example.com)' } }, 2500), 2, 300)
      if (!raw.ok) throw new Error(`geocode fetch failed: ${raw.status}`)
      const body = await raw.json()
      const result = { display_name: body.display_name }
  try { if (geocodeCache) await geocodeCache.set(key, result, GEOCODE_TTL_MS) } catch (e) { /* ignore */ }
      const entry = { type: 'geocode', provider, lat, lng, ok: true }
      if (dbPromise) (await dbPromise).then(db => appendDb(db, { ts: new Date().toISOString(), ...entry }))
      else appendHistory(entry)
      return result
    } catch (err) {
      const entry = { type: 'geocode', provider, lat, lng, ok: false, error: String(err) }
      if (dbPromise) (await dbPromise).then(db => appendDb(db, { ts: new Date().toISOString(), ...entry }))
      else appendHistory(entry)
      throw err
    }
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
    try {
      const raw = await retry(() => timeoutFetch(url, { method: 'GET' }, 2500), 2, 300)
      if (!raw.ok) throw new Error(`mapbox geocode failed: ${raw.status}`)
      const body = await raw.json()
      const place = body.features?.[0]?.place_name
      const result = { display_name: place }
  try { if (geocodeCache) await geocodeCache.set(key, result, GEOCODE_TTL_MS) } catch (e) { /* ignore */ }
      const entry = { type: 'geocode', provider, lat, lng, ok: true }
      if (dbPromise) (await dbPromise).then(db => appendDb(db, { ts: new Date().toISOString(), ...entry }))
      else appendHistory(entry)
      return result
    } catch (err) {
      const entry = { type: 'geocode', provider, lat, lng, ok: false, error: String(err) }
      if (dbPromise) (await dbPromise).then(db => appendDb(db, { ts: new Date().toISOString(), ...entry }))
      else appendHistory(entry)
      throw err
    }
  }
  throw new Error('unsupported geocode provider')
}

