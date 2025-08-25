import test from 'node:test'
import assert from 'node:assert/strict'

import { createCache } from '../src/lib/cache.mjs'

test('cache smoke: createCache operations', async (t) => {
  const c = createCache(1000)
  const key = 'test:key:1'
  await c.set(key, { foo: 'bar' }, 5000)
  const v = await c.get(key)
  assert.deepEqual(v, { foo: 'bar' })
  const metrics = c.metrics()
  assert(typeof metrics.hits === 'number' && typeof metrics.misses === 'number')
  // invalidate
  if (c.invalidate) c.invalidate(key)
  const v2 = await c.get(key)
  // after invalidation, get should be undefined
  assert(typeof v2 === 'undefined')
})
