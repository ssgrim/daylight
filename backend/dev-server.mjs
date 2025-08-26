#!/usr/bin/env node
import http from 'http'
import fs from 'node:fs'
import path from 'node:path'
import { handler as planHandler } from './dist/handlers/plan.js'
import { initDb, queryHistory } from './src/lib/history.mjs'
import { getSeasonFor } from './src/lib/season.mjs'

const PORT = process.env.PORT || 5174

let historyDb = null
// attempt to init DB for history; non-fatal
initDb().then(db => { historyDb = db; console.log('history DB initialized') }).catch(err => { console.warn('history DB init failed', String(err)) })

const server = http.createServer(async (req, res) => {
  try {
    // Add permissive CORS headers for local development
    const defaultCors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, defaultCors)
      res.end()
      return
    }

    // internal helper endpoints for local dev to call adapters (not intended for production)
    if (req.url && req.url.startsWith('/__internal_events')) {
      const url = new URL(req.url, `http://localhost`)
      const q = Object.fromEntries(url.searchParams.entries())
      const lat = Number(q.lat), lng = Number(q.lng)
      try {
        // import on demand to avoid startup cycles
        const { fetchEvents } = await import('./src/lib/external.js')
        const data = await fetchEvents(lat, lng)
        const headers = Object.assign({}, defaultCors, { 'content-type': 'application/json' })
        res.writeHead(200, headers)
        res.end(JSON.stringify(data))
        return
      } catch (e) {
        res.writeHead(500, defaultCors)
        res.end(String(e))
        return
      }
    }

    if (req.url && req.url.startsWith('/__internal_traffic')) {
      const url = new URL(req.url, `http://localhost`)
      const q = Object.fromEntries(url.searchParams.entries())
      const lat = Number(q.lat), lng = Number(q.lng)
      try {
        const { fetchTrafficInfo } = await import('./src/lib/external.js')
        const data = await fetchTrafficInfo(lat, lng)
        const headers = Object.assign({}, defaultCors, { 'content-type': 'application/json' })
        res.writeHead(200, headers)
        res.end(JSON.stringify(data))
        return
      } catch (e) {
        res.writeHead(500, defaultCors)
        res.end(String(e))
        return
      }
    }

  if (req.url && req.url.startsWith('/plan')) {
      const url = new URL(req.url, `http://localhost`)
      const query = Object.fromEntries(url.searchParams.entries())

      // Support GET /plan?lat=..&lng=.. for quick enrichment in dev UI
      if (req.method === 'GET') {
        const lat = query.lat ? Number(query.lat) : NaN
        const lng = query.lng ? Number(query.lng) : NaN
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          try {
            // call Open-Meteo and Nominatim directly
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&current_weather=true&timezone=UTC`)
            const weather = weatherRes.ok ? await weatherRes.json() : null
            const geocodeRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`, { headers: { 'User-Agent': 'daylight/0.1 (+https://example.com)' } })
            const geocode = geocodeRes.ok ? await geocodeRes.json() : null
            const reasonParts = []
            if (geocode?.display_name) reasonParts.push(geocode.display_name)
            if (weather?.current_weather) reasonParts.push(`Temp ${weather.current_weather.temperature}°C, wind ${weather.current_weather.windspeed} km/h`)
            const reason = reasonParts.join(' — ')
            // fetch events and traffic (best-effort)
            let events = null
            let traffic = null
            try { const evRes = await fetch(`http://localhost:${PORT}/__internal_events?lat=${lat}&lng=${lng}`); events = evRes.ok ? await evRes.json() : null } catch (e) { events = null }
            try { const trRes = await fetch(`http://localhost:${PORT}/__internal_traffic?lat=${lat}&lng=${lng}`); traffic = trRes.ok ? await trRes.json() : null } catch (e) { traffic = null }
            const now = new Date().toISOString()
            // determine seasonal context and adjust score slightly
            const seasonInfo = getSeasonFor(lat, new Date())
            let score = 95
            // simple heuristic: if summer, favor outdoor -> +3; if winter, slightly penalize outdoor -> -5
            if (seasonInfo.season === 'summer') score += 3
            if (seasonInfo.season === 'winter') score -= 5
            const payload = [{ id: 'live-1', title: 'Live Stop', start: now, end: now, score, reason, season: seasonInfo, events, traffic }]
            const headers = Object.assign({}, defaultCors, { 'content-type': 'application/json' })
            res.writeHead(200, headers)
            res.end(JSON.stringify(payload))
            return
          } catch (err) {
            const headers = Object.assign({}, defaultCors, { 'content-type': 'application/json' })
            res.writeHead(200, headers)
            res.end(JSON.stringify([{ id: 'live-err', title: 'Demo Stop', start: new Date().toISOString(), end: new Date().toISOString(), score: 90, reason: `enrich failed: ${String(err)}` }]))
            return
          }
        }
        // If no coords, return basic demo
        const now = new Date().toISOString()
        const headers = Object.assign({}, defaultCors, { 'content-type': 'application/json' })
        res.writeHead(200, headers)
        res.end(JSON.stringify([{ id: 'demo-get', title: 'Demo Stop', start: now, end: now, score: 80 }]))
        return
      }

      // For non-GET methods, delegate to compiled handler (expects Lambda-like event)
      const event = { queryStringParameters: query }
      const result = await planHandler(event)

      const headers = Object.assign({}, defaultCors, result.headers || { 'content-type': 'application/json' })
      res.writeHead(result.statusCode || 200, headers)
      res.end(result.body)
      return
    }

    // Privacy endpoints for Data Subject Requests (dev only)
    if (req.url && req.url.startsWith('/privacy')) {
      const url = new URL(req.url, `http://localhost`)
      const path = url.pathname
      try {
        const { exportData, deleteData } = await import('./src/handlers/privacy.mjs')
        if (path === '/privacy/export' && req.method === 'GET') {
          const result = await exportData({ requestContext: { http: { method: 'GET' } }, headers: req.headers, requestId: `${Date.now()}` })
          const headers = Object.assign({}, defaultCors, result.headers || { 'content-type': 'application/json' })
          res.writeHead(result.statusCode || 200, headers)
          res.end(result.body)
          return
        }
        if (path === '/privacy/delete' && req.method === 'POST') {
          let body = ''
          for await (const chunk of req) body += chunk
          const event = { requestContext: { http: { method: 'POST' } }, headers: req.headers, requestId: `${Date.now()}`, body }
          const result = await deleteData(event)
          const headers = Object.assign({}, defaultCors, result.headers || { 'content-type': 'application/json' })
          res.writeHead(result.statusCode || 200, headers)
          res.end(result.body)
          return
        }
      } catch (e) {
        res.writeHead(500, defaultCors)
        res.end(String(e))
        return
      }
    }

    // Admin cache endpoint for local dev: GET returns metrics, POST invalidates
    if (req.url && req.url.startsWith('/__cache')) {
      const url = new URL(req.url, `http://localhost`)
      try {
        const { getCacheMetrics, invalidateCacheFor, clearAllCaches } = await import('./src/lib/external.js')
        // Optional admin token guard. If CACHE_ADMIN_TOKEN is set, require a matching token in
        // Authorization: Bearer <token> or X-Admin-Token header. Alternatively, if
        // CACHE_ADMIN_JWT_SECRET is set, validate a JWT signed with that secret.
        const adminToken = process.env.CACHE_ADMIN_TOKEN
        const adminJwtSecret = process.env.CACHE_ADMIN_JWT_SECRET
        if (adminToken || adminJwtSecret) {
          const authHeader = (req.headers['authorization'] || req.headers['x-admin-token'] || '')
          let token = ''
          if (typeof authHeader === 'string') {
            if (authHeader.toLowerCase().startsWith('bearer ')) token = authHeader.slice(7).trim()
            else token = authHeader.trim()
          }
          if (adminToken && token === adminToken) {
            // ok
          } else if (adminJwtSecret && token) {
            try {
              // lazy import jsonwebtoken to avoid startup deps in dev
              const jwt = await import('jsonwebtoken')
              const verified = jwt.verify(token, adminJwtSecret)
              // allow any valid token; optionally check claims here
            } catch (e) {
              res.writeHead(401, defaultCors)
              res.end('Unauthorized')
              return
            }
          } else {
            res.writeHead(401, defaultCors)
            res.end('Unauthorized')
            return
          }
        }
        if (req.method === 'GET') {
          const metrics = getCacheMetrics()
          const headers = Object.assign({}, defaultCors, { 'content-type': 'application/json' })
          res.writeHead(200, headers)
          res.end(JSON.stringify(metrics))
          return
        }
        if (req.method === 'POST') {
          let body = ''
          for await (const chunk of req) body += chunk
          let payload = {}
          try { payload = JSON.parse(body || '{}') } catch (e) { }
          if (payload.clear) {
            const ok = await clearAllCaches()
            res.writeHead(ok ? 200 : 500, defaultCors)
            res.end(JSON.stringify({ cleared: !!ok }))
            return
          }
          if (payload.type) {
            const ok = await invalidateCacheFor(payload.type, payload.key)
            res.writeHead(ok ? 200 : 500, defaultCors)
            res.end(JSON.stringify({ invalidated: !!ok }))
            return
          }
          res.writeHead(400, defaultCors)
          res.end(JSON.stringify({ error: 'invalid payload' }))
          return
        }
      } catch (e) {
        res.writeHead(500, defaultCors)
        res.end(String(e))
        return
      }
    }

    // Prometheus metrics endpoint
    if (req.url && req.url === '/__metrics') {
      try {
  const { publishCacheMetrics, register } = await import('./src/lib/metrics.mjs')
        // external.js may not exist in test environments (no build step). Try to
        // load getCacheMetrics, but fall back to a noop that returns empty metrics
        // so the Prometheus endpoint still responds with text.
        let getCacheMetrics = () => ({})
        try {
          const ext = await import('./src/lib/external.js')
          if (ext && typeof ext.getCacheMetrics === 'function') getCacheMetrics = ext.getCacheMetrics
        } catch (e) {
          // ignore missing module; metrics will be empty
        }
        // update cache-related gauges (noop if unavailable)
  await publishCacheMetrics(getCacheMetrics)
  const body = await register.metrics()
  res.writeHead(200, { 'Content-Type': register.contentType })
        res.end(body)
        return
      } catch (e) {
        res.writeHead(500, defaultCors)
        res.end(String(e))
        return
      }
    }

    if (req.url && req.url.startsWith('/history')) {
      const url = new URL(req.url, `http://localhost`)
      const query = Object.fromEntries(url.searchParams.entries())
      const limit = query.limit ? Number(query.limit) : 100
      try {
        let rows = null
        if (historyDb) rows = await queryHistory(historyDb, limit)
        else {
          // fallback: read log file
          const file = path.resolve(process.cwd(), 'backend', 'external_history.log')
          const data = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
          rows = data.split('\n').filter(Boolean).map((l, i) => { try { return JSON.parse(l) } catch (e) { return { id: i, raw: l } } }).slice(-limit).reverse()
        }
        const headers = Object.assign({}, defaultCors, { 'content-type': 'application/json' })
        res.writeHead(200, headers)
        res.end(JSON.stringify(rows))
        return
      } catch (err) {
        const headers = Object.assign({}, defaultCors, { 'content-type': 'application/json' })
        res.writeHead(500, headers)
        res.end(JSON.stringify({ error: String(err) }))
        return
      }
    }

    res.writeHead(404, defaultCors)
    res.end('Not Found')
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain', ...{
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    } })
    res.end(String(err))
  }
})

server.listen(PORT, () => console.log(`backend dev server listening http://localhost:${PORT}`))
