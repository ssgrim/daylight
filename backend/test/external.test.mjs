import assert from 'node:assert'
import { test } from 'node:test'

// This test calls the running dev-server at /plan?lat=..&lng=.. to verify adapters work end-to-end.

test('external integration test', async () => {
  const lat = 47.6062, lng = -122.3321
  
  try {
    const res = await fetch(`http://localhost:5174/plan?lat=${lat}&lng=${lng}`)
    const body = await res.json().catch(() => null)
    assert.equal(res.status, 200)
    if (!Array.isArray(body)) throw new Error('expected array body')
    console.log('external integration test passed; suggestions:', body.length)
  } catch (e) {
    // If dev server is not running, skip test instead of failing
    if (e.code === 'ECONNREFUSED') {
      console.log('skipping external test - dev server not running')
      return
    }
    throw e
  }
})
