import { getSecretValue } from './secrets.mjs'
import { timeoutFetch, retry } from './external-helpers.mjs'
import { createCache } from './cache.mjs'
import { fetchEventsData } from './enhanced-fetch.js'

const cache = createCache(30_000)

// Lightweight local events adapter with circuit breaker pattern
// Providers supported: 'ticketmaster' (via API key), otherwise 'mock'

export async function fetchLocalEvents(lat, lng) {
  const provider = process.env.EVENTS_PROVIDER || 'mock'
  if (provider === 'ticketmaster') {
    const cacheKey = `events:${lat},${lng}:tm`
    const cached = await cache.get(cacheKey)
    if (cached) return cached
    
    // prefer SSM parameter name if present
    let key = process.env.EVENTS_API_KEY
    const ssmParam = process.env.EVENTS_SSM_PARAMETER
    if (ssmParam) key = await getSecretValue(ssmParam, { fromSSM: true }) || key
    const secretArn = process.env.EVENTS_SECRET_ARN
    if (!key && secretArn) key = await getSecretValue(secretArn) || key
    if (!key) throw new Error('EVENTS_API_KEY not set')
    
    try {
      const result = await fetchEventsData(lat, lng, key)
      const body = result.data
      const events = (body._embedded?.events || []).slice(0,3).map(e => ({
        id: e.id,
        name: e.name,
        venue: e._embedded?.venues?.[0]?.name,
        date: e.dates?.start?.dateTime,
        image: (e.images || [])[0]?.url || null,
        url: e.url || null,
        genre: e.classifications?.[0]?.genre?.name || null
      }))
      const out = { provider, events, fromFallback: result.fromFallback }
      await cache.set(cacheKey, out)
      return out
    } catch (error) {
      // If circuit breaker fails, return mock events
      console.warn('Events service failed, returning mock data:', error.message)
      return { 
        provider: 'mock-fallback', 
        events: [
          { name: 'Local Event (Fallback)', venue: 'Community Center', date: null },
          { name: 'Weekend Market (Fallback)', venue: 'Town Square', date: null }
        ],
        error: error.message
      }
    }
  }
  // mock fallback
  return { provider: 'mock', events: [{ name: 'Farmers Market', venue: 'Main St Park', date: null }, { name: 'Open-Air Concert', venue: 'River Stage', date: null }] }
}

export async function fetchEvents(lat, lng) {
  return await fetchLocalEvents(lat, lng)
}

export default { fetchLocalEvents, fetchEvents }
