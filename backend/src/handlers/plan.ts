import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { fetchWeather, reverseGeocode, fetchEvents, fetchTrafficInfo } from '../lib/external'
// @ts-ignore
import { info, error } from '../lib/logger.mjs'
// @ts-ignore
import { capturePromise } from '../lib/xray.mjs'

// Input validation functions
function validateCoordinates(lat: any, lng: any): { lat: number; lng: number } {
  const numLat = Number(lat)
  const numLng = Number(lng)
  
  if (!lat || !lng || isNaN(numLat) || isNaN(numLng)) {
    throw new Error('Invalid coordinates: lat and lng must be valid numbers')
  }
  
  if (numLat < -90 || numLat > 90) {
    throw new Error(`Invalid latitude: ${numLat}. Must be between -90 and 90`)
  }
  
  if (numLng < -180 || numLng > 180) {
    throw new Error(`Invalid longitude: ${numLng}. Must be between -180 and 180`)
  }
  
  return { lat: numLat, lng: numLng }
}

function sanitizeQueryParams(params: any): Record<string, string> {
  if (!params || typeof params !== 'object') {
    return {}
  }
  
  const sanitized: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length <= 100) {
      sanitized[key] = value.trim()
    }
  }
  return sanitized
}


async function planHandler(event: any) {
  const now = new Date().toISOString()
  const requestId = event?.requestContext?.requestId || 'unknown'
  
  try {
    info({ requestId }, 'plan handler start')
    
    // Validate and sanitize input
    const queryParams = sanitizeQueryParams(event.queryStringParameters)
    let reason: string | undefined
    let season = null
    let events = null
    let traffic = null
    
    if (queryParams.lat && queryParams.lng) {
      const { lat, lng } = validateCoordinates(queryParams.lat, queryParams.lng)
      info({ requestId }, 'validated coordinates', { lat, lng })
      
      // Call external services with proper error handling
      const [w, g, ev, tr] = await Promise.allSettled([
        fetchWeather(lat, lng),
        reverseGeocode(lat, lng),
        fetchEvents(lat, lng),
        fetchTrafficInfo(lat, lng)
      ])
      
      // Handle results safely
      const weather = w.status === 'fulfilled' ? w.value : null
      const geocode = g.status === 'fulfilled' ? g.value : null
      events = ev.status === 'fulfilled' ? ev.value : null
      traffic = tr.status === 'fulfilled' ? tr.value : null
      
      // Log any failures for monitoring
      if (w.status === 'rejected') info({ requestId }, 'weather fetch failed', { error: w.reason })
      if (g.status === 'rejected') info({ requestId }, 'geocode fetch failed', { error: g.reason })
      if (ev.status === 'rejected') info({ requestId }, 'events fetch failed', { error: ev.reason })
      if (tr.status === 'rejected') info({ requestId }, 'traffic fetch failed', { error: tr.reason })
      
      reason = [geocode?.display_name, weather?.summary].filter(Boolean).join(' — ')
      season = (weather && weather.season) || null
      
      info({ requestId }, 'plan handler data processed', { reason, season, events: !!events, traffic: !!traffic })
    }

    // simple season-aware scoring: base 95, + for summer, - for winter, and penalize high congestion
    let baseScore = 95
    if (season?.season === 'summer') baseScore += 3
    if (season?.season === 'winter') baseScore -= 5
    if (traffic?.congestion != null && traffic.congestion > 70) baseScore -= 10

    info({ requestId }, 'plan handler result', { baseScore })
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([
        {
          id: '1',
          title: 'Live Stop',
          start: now,
          end: now,
          score: baseScore,
          reason,
          season,
          events,
          traffic,
          distanceKm: 2.3, // mock value
          openNow: true, // mock value
          rank: 1,
          photo: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
          hours: '8:00 AM - 8:00 PM',
          phone: '+1 555-123-4567',
          website: 'https://example.com'
        }
      ])
    }
  } catch (err: any) {
    error({ requestId }, 'plan handler error', err)
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify([{ id:'1', title:'Demo Stop', start:now, end:now, score:95, reason: `enrich failed: ${err.message}` }]) }
  }
}

export const handler = (event: any) => capturePromise('plan.handler', () => planHandler(event))
