import { strict as t } from 'node:assert'
import http from 'node:http'
import { spawn } from 'node:child_process'

// Start dev-server and call /plan
const child = spawn('node', ['./dev-server.mjs'], { cwd: '.', stdio: 'ignore', detached: true })
child.unref()

async function wait(ms){return new Promise(r=>setTimeout(r,ms))}
await wait(500)

http.get('http://localhost:5174/plan', (res) => {
  t.equal(res.statusCode, 200)
  console.log('devserver integration test OK')
  process.exit(0)
}).on('error', (e)=>{ console.error('devserver test failed', e); process.exit(1) })
