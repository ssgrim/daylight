import client from 'prom-client'

const register = new client.Registry()
client.collectDefaultMetrics({ register })

// Expose a function to publish cache metrics from external.getCacheMetrics()
export async function publishCacheMetrics(getCacheMetricsFn) {
  try {
    const metrics = getCacheMetricsFn()
    if (!metrics) return
    // For each top-level metric object, create gauges for hits/misses/sets/invalidations
    for (const k of Object.keys(metrics)) {
      const v = metrics[k]
      if (!v || typeof v !== 'object') continue
      const prefix = `daylight_cache_${k}`
      for (const m of ['hits', 'misses', 'sets', 'invalidations']) {
        if (typeof v[m] === 'number') {
          const name = `${prefix}_${m}`
          let gauge = register.getSingleMetric(name)
          if (!gauge) {
            gauge = new client.Gauge({ name, help: `${name} gauge`, registers: [register] })
          }
          gauge.set(v[m])
        }
      }
    }
  } catch (e) { /* ignore */ }
}

export default { register, publishCacheMetrics }
