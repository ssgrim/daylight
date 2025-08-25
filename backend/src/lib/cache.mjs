// Simple in-memory TTL cache
import { createRedisCache } from './redis-cache.mjs'

// Prefer Redis when REDIS_URL is configured and ioredis is installed.
export async function createCache(ttlMs = 60_000) {
  try {
    const redisCacheFactory = await createRedisCache()
    if (redisCacheFactory) {
      // adapt redis methods to the same shape as in-memory cache
      return {
        async get(key) { return await redisCacheFactory.get(key) },
        async set(key, value) { return await redisCacheFactory.set(key, value, ttlMs) },
        async clear() { return await redisCacheFactory.clear() }
      }
    }
  } catch (e) {
    // fallthrough to memory cache
  }

  // Simple in-memory TTL cache
  const map = new Map()
  return {
    get(key) {
      const e = map.get(key)
      if (!e) return undefined
      if (Date.now() > e.expiry) { map.delete(key); return undefined }
      return e.value
    },
    set(key, value) { map.set(key, { value, expiry: Date.now() + ttlMs }) },
    clear() { map.clear() }
  }
}

export default { createCache }

