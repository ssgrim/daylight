// Lightweight adapters for external data sources with circuit breaker pattern
// Uses public APIs that don't require API keys by default.

import fs from 'fs'
import path from 'path'
import LRU from './lru.mjs'
import { info, warn, error } from './logger.mjs'
import { getSeasonFor } from './season.mjs'
import { initDb, appendDb } from './history.mjs'
import { getSecretValue } from './secrets.mjs'
import { fetchLocalEvents } from './events.mjs'
import { fetchTraffic } from './traffic.mjs'
import { fetchWithCircuitBreaker, fetchWeatherData, fetchGeocodingData } from './enhanced-fetch'

const geocodeCache = LRU(500)
const HISTORY_FILE = path.resolve(process.cwd(), 'backend', 'external_history.log')
let dbPromise = null
try { dbPromise = initDb() } catch (e) { dbPromise = null }

/**
 * @param {string} url
 * @param {RequestInit} [opts]
 * @param {number} [ms]
 * @deprecated Use fetchWithCircuitBreaker instead
 */
function timeoutFetch(url, opts = {}, ms = 3000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  // @ts-ignore fetch is available in Node 18+ in this dev environment
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id))
}

/**
 * @param {() => Promise<any>} fn
 * @param {number} [attempts]
 * @param {number} [delayMs]
 * @deprecated Use fetchWithCircuitBreaker with retries instead
 */
async function retry(fn, attempts = 2, delayMs = 300) {
  let lastErr = null
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, delayMs)) }
  }
  throw lastErr
}

/** @param {any} entry */
function appendHistory(entry) {
  try { fs.appendFileSync(HISTORY_FILE, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n') } catch (e) { /* ignore */ }
}

/** @param {number} lat @param {number} lng */
export async function fetchWeather(lat, lng) {
  // provider switchable via env; default: open-meteo
  const provider = process.env.WEATHER_PROVIDER || 'open-meteo'
  if (provider === 'open-meteo') {
    try {
      const result = await fetchWeatherData(lat, lng)
      const body = result.data
      const cw = body.current_weather || {}
      const summary = cw.temperature != null ? `Temp ${cw.temperature}°C, wind ${cw.windspeed} km/h` : undefined
      const season = getSeasonFor(lat, new Date())
      
      const entry = { type: 'weather', provider, lat, lng, ok: true, season, fromFallback: result.fromFallback }
      if (dbPromise) (await dbPromise).then(db => appendDb(db, { ts: new Date().toISOString(), ...entry }))
      else appendHistory(entry)
      
      return { temperatureC: cw.temperature, windSpeedKph: cw.windspeed, weatherCode: cw.weathercode, summary, season }
    } catch (err) {
      const entry = { type: 'weather', provider, lat, lng, ok: false, error: String(err) }
      if (dbPromise) (await dbPromise).then(db => appendDb(db, { ts: new Date().toISOString(), ...entry }))
      else appendHistory(entry)
      throw err
    }
  }
  // placeholder for other providers (openweathermap, etc.)
  throw new Error('unsupported weather provider')
}

export async function fetchEvents(lat, lng) {
  try {
    return await fetchLocalEvents(lat, lng)
  } catch (e) {
    return { provider: 'error', events: [], error: String(e) }
  }
}

export async function fetchTrafficInfo(lat, lng) {
  try {
    return await fetchTraffic(lat, lng)
  } catch (e) {
    return { provider: 'error', congestion: null, error: String(e) }
  }
}

/** @param {number} lat @param {number} lng */
export async function reverseGeocode(lat, lng) {
  const key = `${lat},${lng}`
  const cached = geocodeCache.get(key)
  if (cached) return cached
  
  const provider = process.env.GEOCODE_PROVIDER || 'nominatim'
  
  if (provider === 'nominatim') {
    try {
      const result = await fetchGeocodingData(lat, lng)
      const body = result.data
      const geocodeResult = { display_name: body.display_name || 'Location unavailable' }
      geocodeCache.set(key, geocodeResult)
      
      const entry = { type: 'geocode', provider, lat, lng, ok: true, fromFallback: result.fromFallback }
      if (dbPromise) (await dbPromise).then(db => appendDb(db, { ts: new Date().toISOString(), ...entry }))
      else appendHistory(entry)
      
      return geocodeResult
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
      const result = await fetchWithCircuitBreaker(url, {
        circuitBreakerName: 'mapbox-service',
        timeout: 6000,
        fallbackData: {
          features: [{ place_name: 'Location unavailable' }]
        }
      })
      
      const body = result.data
      const place = body.features?.[0]?.place_name
      const geocodeResult = { display_name: place }
      geocodeCache.set(key, geocodeResult)
      
      const entry = { type: 'geocode', provider, lat, lng, ok: true, fromFallback: result.fromFallback }
      if (dbPromise) (await dbPromise).then(db => appendDb(db, { ts: new Date().toISOString(), ...entry }))
      else appendHistory(entry)
      
      return geocodeResult
    } catch (err) {
      const entry = { type: 'geocode', provider, lat, lng, ok: false, error: String(err) }
      if (dbPromise) (await dbPromise).then(db => appendDb(db, { ts: new Date().toISOString(), ...entry }))
      else appendHistory(entry)
      throw err
    }
  }
  
  throw new Error('unsupported geocode provider')
}

