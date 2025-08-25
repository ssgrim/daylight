import { getSecretValue } from './secrets.mjs'
import { timeoutFetch, retry } from './external-helpers.mjs'
import { createCache } from './cache.mjs'

const cache = createCache(20_000)

// Export cache metrics for monitoring
export function getTrafficCacheMetrics() {
  return cache.metrics()
}

// Manual cache invalidation
export function invalidateTrafficCache(key) {
  return cache.invalidate(key)
}

// Lightweight traffic adapter; by default returns mock congestion level
export async function fetchTraffic(lat, lng) {
  const provider = process.env.TRAFFIC_PROVIDER || 'mock'
  if (provider === 'here') {
  const cacheKey = `traffic:${lat},${lng}:here`
  const cached = await cache.get(cacheKey)
  if (cached) return cached
    let key = process.env.HERE_API_KEY
    const ssmParam = process.env.TRAFFIC_SSM_PARAMETER
    if (ssmParam) key = await getSecretValue(ssmParam, { fromSSM: true }) || key
    const secretArn = process.env.TRAFFIC_SECRET_ARN
    if (!key && secretArn) key = await getSecretValue(secretArn) || key
    if (!key) throw new Error('HERE_API_KEY not set')
    const url = `https://traffic.ls.hereapi.com/traffic/6.2/flow.json?prox=${encodeURIComponent(lat)},${encodeURIComponent(lng)},5000&apiKey=${encodeURIComponent(key)}`
    const res = await retry(() => timeoutFetch(url, { method: 'GET' }, 3000), 2, 200)
    if (!res.ok) throw new Error(`traffic fetch failed: ${res.status}`)
    const body = await res.json()
    const congestion = body.RWS?.[0]?.RW?.[0]?.FIS?.[0]?.FI?.[0]?.CF?.[0]?.JF ? Math.min(100, Math.round(body.RWS[0].RW[0].FIS[0].FI[0].CF[0].JF * 10)) : 20
  const out = { provider, congestion }
  // TTL: 20s for traffic, can override per call if needed
  await cache.set(cacheKey, out, 20_000)
  return out
  }
  // mock fallback
  return { provider: 'mock', congestion: Math.round(Math.random() * 40 + 10) }
}

export default { fetchTraffic }

export async function fetchTrafficInfo(lat, lng) {
  return await fetchTraffic(lat, lng)
}
