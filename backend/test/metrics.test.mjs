import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

test('metrics endpoint returns prometheus text', async () => {
  // start dev-server in background
  const child = spawn('node', ['./dev-server.mjs'], { cwd: '.', stdio: 'ignore', detached: true })
  // give the server a moment to start
  await new Promise(r => setTimeout(r, 800))
  try {
    const res = await fetch('http://localhost:5174/__metrics')
    assert.equal(res.status, 200)
    const txt = await res.text()
    assert(txt.includes('# HELP') || txt.includes('# TYPE'))
  } finally {
    try { process.kill(-child.pid) } catch (e) { /* ignore */ }
  }
})
