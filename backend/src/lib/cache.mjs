// Simple in-memory TTL cache
import { createRedisCache } from './redis-cache.mjs'

// Prefer Redis when REDIS_URL is configured and ioredis is installed.

export function createCache(defaultTtlMs = 60_000) {
  // Metrics
  let hits = 0, misses = 0, sets = 0, invalidations = 0
  // Manual invalidation set
  const invalidated = new Set()
  try {
    const redisCacheFactory = createRedisCache()
    if (redisCacheFactory) {
      return {
        async get(key) {
          if (invalidated.has(key)) { misses++; return undefined }
          const v = await redisCacheFactory.get(key)
          if (v !== undefined) { hits++; return v }
          misses++; return undefined
        },
        async set(key, value, ttlMs = defaultTtlMs) {
          sets++;
          invalidated.delete(key)
          return await redisCacheFactory.set(key, value, ttlMs)
        },
        async clear() {
          invalidations++;
          invalidated.clear()
          return await redisCacheFactory.clear()
        },
        invalidate(key) { invalidations++; invalidated.add(key) },
        metrics() { return { hits, misses, sets, invalidations } },
      }
    }
  } catch (e) {
    // fallthrough to memory cache
  }
  // In-memory TTL cache
  const map = new Map()
  return {
    get(key) {
      if (invalidated.has(key)) { misses++; return undefined }
      const e = map.get(key)
      if (!e) { misses++; return undefined }
      if (Date.now() > e.expiry) { map.delete(key); misses++; return undefined }
      hits++; return e.value
    },
    set(key, value, ttlMs = defaultTtlMs) {
      sets++;
      invalidated.delete(key)
      map.set(key, { value, expiry: Date.now() + ttlMs })
    },
    clear() { invalidations++; invalidated.clear(); map.clear() },
    invalidate(key) { invalidations++; invalidated.add(key) },
    metrics() { return { hits, misses, sets, invalidations } },
  }
}

export default { createCache }

