#!/usr/bin/env node
import http from 'http'

// Import the trips handler directly from source (avoid complex plan dependencies)
import { handler as tripsHandler } from './dist/trips.js'

const PORT = process.env.PORT || 5174

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

    res.writeHead(404, defaultCors)
    res.end('Not Found - Try /api/trips')
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain', ...defaultCors })
    res.end(String(err))
  }
})

server.listen(PORT, () => console.log(`trips API server listening http://localhost:${PORT}`))
