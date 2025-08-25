#!/usr/bin/env node
import http from 'http'
import fs from 'node:fs'
import path from 'node:path'
import { handler as planHandler } from './dist/plan.js'
import { handler as tripsHandler } from './dist/trips.js'
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
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, defaultCors)
      res.end()
      return
    }

    // Handle trips API endpoints
    if (req.url && (req.url.startsWith('/api/trips') || req.url.startsWith('/trips'))) {
      const url = new URL(req.url, `http://localhost:${PORT}`)
      
      // Parse path parameters for single trip operations
      const pathMatch = url.pathname.match(/\/(?:api\/)?trips\/([^\/]+)/)
      const tripId = pathMatch ? pathMatch[1] : null
      
      // Read request body if present
      let body = ''
      if (req.method === 'POST' || req.method === 'PUT') {
        req.on('data', chunk => { body += chunk })
        await new Promise(resolve => req.on('end', resolve))
      }
      
      // Create Lambda-like event object
      const event = {
        requestContext: {
          http: {
            method: req.method,
            path: url.pathname
          }
        },
        headers: req.headers,
        body: body || null,
        pathParameters: tripId ? { id: tripId, tripId } : null,
        queryStringParameters: Object.fromEntries(url.searchParams.entries())
      }
      
      // Call the trips handler
      const result = await tripsHandler(event)
      
      const headers = Object.assign({}, defaultCors, result.headers || { 'content-type': 'application/json' })
      res.writeHead(result.statusCode || 200, headers)
      res.end(result.body)
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
