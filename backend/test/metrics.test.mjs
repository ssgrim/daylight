import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

test('metrics endpoint returns prometheus text', async () => {
  // start dev-server in background on a non-default port to avoid collisions
  const TEST_PORT = '5175'
  const child = spawn('node', ['./dev-server.mjs'], { cwd: '.', stdio: 'ignore', detached: true, env: { ...process.env, PORT: TEST_PORT } })
  // give the server some time to start
  await new Promise(r => setTimeout(r, 1500))
  try {
    const res = await fetch(`http://localhost:${TEST_PORT}/__metrics`)
    assert.equal(res.status, 200)
    const txt = await res.text()
    assert(txt.includes('# HELP') || txt.includes('# TYPE'))
  } finally {
    try { process.kill(-child.pid) } catch (e) { /* ignore */ }
  }
})
