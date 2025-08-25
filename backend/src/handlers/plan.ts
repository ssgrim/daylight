import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { fetchWeather, reverseGeocode, fetchEvents, fetchTrafficInfo } from '../lib/external'
import { addCorsHeaders } from '../lib/cors.js'

export const handler: APIGatewayProxyHandlerV2 = async (event: any) => {
  const now = new Date().toISOString()
  try {
    const q = event.queryStringParameters || {}
    const lat = q.lat ? Number(q.lat) : NaN
    const lng = q.lng ? Number(q.lng) : NaN
    let reason: string | undefined
    let season = null
    let events = null
    let traffic = null
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      const [w, g, ev, tr] = await Promise.all([
        fetchWeather(lat, lng),
        reverseGeocode(lat, lng),
        fetchEvents(lat, lng),
        fetchTrafficInfo(lat, lng)
      ])
      reason = [g.display_name, w.summary].filter(Boolean).join(' — ')
      season = (w && w.season) || null
      events = ev
      traffic = tr
    }

    // simple season-aware scoring: base 95, + for summer, - for winter, and penalize high congestion
    let baseScore = 95
    if (season?.season === 'summer') baseScore += 3
    if (season?.season === 'winter') baseScore -= 5
    if (traffic?.congestion != null && traffic.congestion > 70) baseScore -= 10

    const response = {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([
        { id: '1', title: 'Live Stop', start: now, end: now, score: baseScore, reason, season, events, traffic }
      ])
    }

    return addCorsHeaders(response, event)
  } catch (err: any) {
    const errorResponse = { 
      statusCode: 200, 
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify([{ id:'1', title:'Demo Stop', start:now, end:now, score:95, reason: `enrich failed: ${err.message}` }]) 
    }
    
    return addCorsHeaders(errorResponse, event)
  }
}
