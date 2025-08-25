import { getSecretValue } from './secrets.mjs'
import { timeoutFetch, retry } from './external-helpers.mjs'
import { createCache } from './cache.mjs'
import { fetchTrafficData } from './enhanced-fetch.js'

const cache = createCache(20_000)

// Lightweight traffic adapter with circuit breaker pattern
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
    
    try {
      const result = await fetchTrafficData(lat, lng, key)
      const body = result.data
      const congestion = body.RWS?.[0]?.RW?.[0]?.FIS?.[0]?.FI?.[0]?.CF?.[0]?.JF 
        ? Math.min(100, Math.round(body.RWS[0].RW[0].FIS[0].FI[0].CF[0].JF * 10)) 
        : (body.RWS?.[0]?.RW?.[0]?.FIS?.[0]?.FI?.[0]?.CF?.[0]?.CN || 0.5) * 100
      const out = { provider, congestion, fromFallback: result.fromFallback }
      await cache.set(cacheKey, out)
      return out
    } catch (error) {
      // If circuit breaker fails, return mock traffic data
      console.warn('Traffic service failed, returning mock data:', error.message)
      const mockCongestion = Math.round(Math.random() * 40 + 10)
      return { 
        provider: 'mock-fallback', 
        congestion: mockCongestion,
        error: error.message
      }
    }
  }
  // mock fallback
  return { provider: 'mock', congestion: Math.round(Math.random() * 40 + 10) }
}

export default { fetchTraffic }

export async function fetchTrafficInfo(lat, lng) {
  return await fetchTraffic(lat, lng)
}
