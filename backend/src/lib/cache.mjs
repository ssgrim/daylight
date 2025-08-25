// Simple in-memory TTL cache
import { createRedisCache } from './redis-cache.mjs'

// Cache initialization for modules that need sync access
export function createCache(ttlMs = 60_000) {
  // Simple in-memory TTL cache as default
  const map = new Map()
  const memoryCache = {
    get(key) {
      const e = map.get(key)
      if (!e) return undefined
      if (Date.now() > e.expiry) { map.delete(key); return undefined }
      return e.value
    },
    set(key, value) { map.set(key, { value, expiry: Date.now() + ttlMs }) },
    clear() { map.clear() }
  }

  // Try to upgrade to Redis if available, but return memory cache immediately
  createRedisCache().then(redisCacheFactory => {
    if (redisCacheFactory) {
      // Replace methods with Redis implementations
      memoryCache.get = async (key) => await redisCacheFactory.get(key)
      memoryCache.set = async (key, value) => await redisCacheFactory.set(key, value, ttlMs)
      memoryCache.clear = async () => await redisCacheFactory.clear()
    }
  }).catch(() => {
    // Redis failed, keep memory cache
  })

  return memoryCache
}

// Async cache creation for new code
export async function createCacheAsync(ttlMs = 60_000) {
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

