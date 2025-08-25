let redis = null
try {
  const IORedis = await import('ioredis')
  redis = IORedis.default
} catch (e) {
  // optional dependency not installed
}

export function createRedisCache() {
  const url = process.env.REDIS_URL
  if (!url || !redis) return null
  const client = new redis(url)
  return {
    async get(key) {
      try {
        const v = await client.get(key)
        return v ? JSON.parse(v) : undefined
      } catch (e) { return undefined }
    },
    async set(key, value, ttlMs = 60000) {
      try {
        await client.set(key, JSON.stringify(value), 'PX', ttlMs)
      } catch (e) { /* ignore */ }
    },
    async clear() {
      try { await client.flushdb() } catch (e) { /* ignore */ }
    }
  }
}

export default { createRedisCache }
