import assert from 'node:assert'

// This test calls the running dev-server at /plan?lat=..&lng=.. to verify adapters work end-to-end.

async function run() {
  const lat = 47.6062, lng = -122.3321
  const res = await fetch(`http://localhost:5174/plan?lat=${lat}&lng=${lng}`)
  const body = await res.json().catch(() => null)
  assert.equal(res.status, 200)
  if (!Array.isArray(body)) throw new Error('expected array body')
  console.log('external integration test passed; suggestions:', body.length)
}

run().catch(e => { console.error('test failed', e); process.exit(1) })
