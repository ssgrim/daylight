import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { fetchWeather, reverseGeocode, fetchEvents, fetchTrafficInfo } from '../lib/external'
import { info, error } from '../lib/logger.mjs'
import { capturePromise } from '../lib/xray.mjs'


async function planHandler(event: any) {
  const now = new Date().toISOString()
  const requestId = event?.requestContext?.requestId || event?.requestContext?.requestId || undefined
  try {
    const q = event.queryStringParameters || {}
    const lat = q.lat ? Number(q.lat) : NaN
    const lng = q.lng ? Number(q.lng) : NaN
    let reason: string | undefined
    let season = null
    let events = null
    let traffic = null
    info({ requestId }, 'plan handler start', { lat, lng })
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
      info({ requestId }, 'plan handler data', { reason, season, events, traffic })
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
        { id: '1', title: 'Live Stop', start: now, end: now, score: baseScore, reason, season, events, traffic }
      ])
    }
  } catch (err: any) {
    error({ requestId }, 'plan handler error', err)
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify([{ id:'1', title:'Demo Stop', start:now, end:now, score:95, reason: `enrich failed: ${err.message}` }]) }
  }
}

export const handler = (event: any) => capturePromise('plan.handler', () => planHandler(event))
