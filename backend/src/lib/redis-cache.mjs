let redis = null

async function loadRedis() {
  if (redis === null) {
    try {
      const IORedis = await import('ioredis')
      redis = IORedis.default
    } catch (e) {
      // optional dependency not installed
      redis = false
    }
  }
  return redis
}

export async function createRedisCache() {
  const url = process.env.REDIS_URL
  const redisModule = await loadRedis()
  if (!url || !redisModule) return null
  
  const client = new redisModule(url)
  return {
    async get(key) { try { const v = await client.get(key); return v ? JSON.parse(v) : undefined } catch (e) { return undefined } },
    async set(key, value, ttlMs = 60000) { try { await client.set(key, JSON.stringify(value), 'PX', ttlMs) } catch (e) { /* ignore */ } },
    async clear() { try { await client.flushdb() } catch (e) { /* ignore */ } }
  }
}

export default { createRedisCache }
