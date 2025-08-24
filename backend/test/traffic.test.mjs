import { strict as assert } from 'assert'
import { describe, it } from 'node:test'

async function withFetch(mockFn, fn) {
  const orig = global.fetch
  global.fetch = mockFn
  try { return await fn() } finally { global.fetch = orig }
}

import { fetchTrafficInfo } from '../src/lib/traffic.mjs'

describe('traffic adapter', () => {
  it('returns congestion number for mock provider', async () => {
    const res = await withFetch(async () => ({ json: async () => ({ congestion: 42 }), ok: true }), async () => {
      return await fetchTrafficInfo(47.6, -122.33)
    })
    // for mock provider the shape is an object with congestion
    assert.equal(typeof res.congestion, 'number')
  })
})
