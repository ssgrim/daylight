#!/usr/bin/env node
import http from "http";
import fs from "node:fs";
import path from "node:path";
import { handler as planHandler } from "./dist/handlers/plan.js";
import { handler as tripsHandler } from "./dist/handlers/trips.js";
import { initDb, queryHistory } from "./src/lib/history.mjs";
import { getSeasonFor } from "./src/lib/season.mjs";

const PORT = process.env.PORT || 5174;
const NODE_ENV = process.env.NODE_ENV || "development";

console.log(`🚀 Starting Daylight backend server in ${NODE_ENV} mode`);
console.log(
  `🔒 Security features: ${NODE_ENV === "production" ? "ENABLED" : "DEVELOPMENT MODE"}`,
);

let historyDb = null;
// attempt to init DB for history; non-fatal
initDb()
  .then((db) => {
    historyDb = db;
    console.log("✅ History DB initialized");
  })
  .catch((err) => {
    console.warn("⚠️  History DB init failed", String(err));
  });

// Rate limiting for development (simple in-memory)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = NODE_ENV === "production" ? 30 : 100;

function checkRateLimit(clientId) {
  if (NODE_ENV !== "production") return true; // Skip rate limiting in development

  const now = Date.now();
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW) * RATE_LIMIT_WINDOW;
  const key = `${clientId}:${windowStart}`;

  const current = rateLimitMap.get(key) || 0;
  if (current >= MAX_REQUESTS) {
    return false;
  }

  rateLimitMap.set(key, current + 1);

  // Cleanup old entries
  for (const [k] of rateLimitMap) {
    const [, timestamp] = k.split(":");
    if (parseInt(timestamp) < windowStart - RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(k);
    }
  }

  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    // Security-enhanced CORS headers
    const corsHeaders =
      NODE_ENV === "production"
        ? {
            "Access-Control-Allow-Origin":
              process.env.FRONTEND_URL || "https://your-domain.com",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Credentials": "true",
          }
        : {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
          };

    // Security headers
    const securityHeaders = {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };

    if (NODE_ENV === "production") {
      securityHeaders["Strict-Transport-Security"] =
        "max-age=31536000; includeSubDomains";
      securityHeaders["Content-Security-Policy"] =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'";
    }

    const defaultHeaders = { ...corsHeaders, ...securityHeaders };

    // Handle preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, defaultHeaders);
      res.end();
      return;
    }

    // Get client identifier for rate limiting
    const clientId =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "unknown";

    // Rate limiting check
    if (!checkRateLimit(clientId)) {
      res.writeHead(429, {
        ...defaultHeaders,
        "Content-Type": "application/json",
      });
      res.end(
        JSON.stringify({ error: "Rate limit exceeded", resetIn: "60 seconds" }),
      );
      return;
    }

    // SECURITY: Disable debug endpoints in production
    if (NODE_ENV === "production") {
      if (
        req.url &&
        (req.url.startsWith("/__internal_") || req.url.includes("debug"))
      ) {
        res.writeHead(404, {
          ...defaultHeaders,
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }
    }

    // Input validation helper
    function validateCoordinates(lat, lng) {
      return (
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      );
    }

    // Enhanced error handling
    function sendError(statusCode, message, details = null) {
      const errorResponse = { error: message };
      if (details && NODE_ENV !== "production") {
        errorResponse.details = details;
      }
      res.writeHead(statusCode, {
        ...defaultHeaders,
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(errorResponse));
    }

    // internal helper endpoints for local dev (secured)
    if (req.url && req.url.startsWith("/__internal_events")) {
      if (NODE_ENV === "production") {
        return sendError(404, "Not found");
      }

      const url = new URL(req.url, `http://localhost`);
      const q = Object.fromEntries(url.searchParams.entries());
      const lat = Number(q.lat),
        lng = Number(q.lng);

      if (!validateCoordinates(lat, lng)) {
        return sendError(400, "Invalid coordinates");
      }

      try {
        const { fetchEvents } = await import("./src/lib/external.js");
        const data = await fetchEvents(lat, lng);
        const headers = {
          ...defaultHeaders,
          "content-type": "application/json",
        };
        res.writeHead(200, headers);
        res.end(JSON.stringify(data));
        return;
      } catch (e) {
        console.error("🔥 Events fetch error:", e);
        return sendError(500, "Service temporarily unavailable");
      }
    }

    if (req.url && req.url.startsWith("/__internal_traffic")) {
      if (NODE_ENV === "production") {
        return sendError(404, "Not found");
      }

      const url = new URL(req.url, `http://localhost`);
      const q = Object.fromEntries(url.searchParams.entries());
      const lat = Number(q.lat),
        lng = Number(q.lng);

      if (!validateCoordinates(lat, lng)) {
        return sendError(400, "Invalid coordinates");
      }

      try {
        const { fetchTrafficInfo } = await import("./src/lib/external.js");
        const data = await fetchTrafficInfo(lat, lng);
        const headers = {
          ...defaultHeaders,
          "content-type": "application/json",
        };
        res.writeHead(200, headers);
        res.end(JSON.stringify(data));
        return;
      } catch (e) {
        console.error("🔥 Traffic fetch error:", e);
        return sendError(500, "Service temporarily unavailable");
      }
    }

    if (req.url && req.url.startsWith("/plan")) {
      const url = new URL(req.url, `http://localhost`);
      const query = Object.fromEntries(url.searchParams.entries());

      // Support GET /plan?lat=..&lng=.. for quick enrichment
      if (req.method === "GET") {
        const lat = query.lat ? Number(query.lat) : NaN;
        const lng = query.lng ? Number(query.lng) : NaN;

        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          if (!validateCoordinates(lat, lng)) {
            return sendError(400, "Invalid coordinates");
          }

          try {
            // Secure external API calls with timeouts
            const weatherRes = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&current_weather=true&timezone=UTC`,
              {
                signal: AbortSignal.timeout(5000),
                headers: { "User-Agent": "daylight/secure-server" },
              },
            );
            const weather = weatherRes.ok ? await weatherRes.json() : null;

            const geocodeRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
              {
                signal: AbortSignal.timeout(5000),
                headers: {
                  "User-Agent":
                    "daylight/secure-server (+https://daylight.app)",
                },
              },
            );
            const geocode = geocodeRes.ok ? await geocodeRes.json() : null;

            const reasonParts = [];
            if (geocode?.display_name) reasonParts.push(geocode.display_name);
            if (weather?.current_weather)
              reasonParts.push(
                `Temp ${weather.current_weather.temperature}°C, wind ${weather.current_weather.windspeed} km/h`,
              );
            const reason = reasonParts.join(" — ");

            // Fetch events and traffic (only in development)
            let events = null;
            let traffic = null;
            if (NODE_ENV !== "production") {
              try {
                const evRes = await fetch(
                  `http://localhost:${PORT}/__internal_events?lat=${lat}&lng=${lng}`,
                  {
                    signal: AbortSignal.timeout(3000),
                  },
                );
                events = evRes.ok ? await evRes.json() : null;
              } catch (e) {
                events = null;
              }

              try {
                const trRes = await fetch(
                  `http://localhost:${PORT}/__internal_traffic?lat=${lat}&lng=${lng}`,
                  {
                    signal: AbortSignal.timeout(3000),
                  },
                );
                traffic = trRes.ok ? await trRes.json() : null;
              } catch (e) {
                traffic = null;
              }
            }

            const now = new Date().toISOString();
            const seasonInfo = getSeasonFor(lat, new Date());
            let score = 95;

            // Seasonal adjustments
            if (seasonInfo.season === "summer") score += 3;
            if (seasonInfo.season === "winter") score -= 5;

            const payload = [
              {
                id: "live-1",
                title: "Live Stop",
                start: now,
                end: now,
                score,
                reason,
                season: seasonInfo,
                events,
                traffic,
              },
            ];

            const headers = {
              ...defaultHeaders,
              "content-type": "application/json",
            };
            res.writeHead(200, headers);
            res.end(JSON.stringify(payload));
            return;
          } catch (err) {
            console.error("🔥 Plan enrichment error:", err);
            const fallbackPayload = [
              {
                id: "live-err",
                title: "Demo Stop",
                start: new Date().toISOString(),
                end: new Date().toISOString(),
                score: 90,
                reason: "Service temporarily unavailable",
              },
            ];
            const headers = {
              ...defaultHeaders,
              "content-type": "application/json",
            };
            res.writeHead(200, headers);
            res.end(JSON.stringify(fallbackPayload));
            return;
          }
        }

        // Default demo response
        const now = new Date().toISOString();
        const headers = {
          ...defaultHeaders,
          "content-type": "application/json",
        };
        res.writeHead(200, headers);
        res.end(
          JSON.stringify([
            {
              id: "demo-get",
              title: "Demo Stop",
              start: now,
              end: now,
              score: 80,
            },
          ]),
        );
        return;
      }

      // For non-GET methods, delegate to compiled handler
      try {
        const event = { queryStringParameters: query };
        const result = await planHandler(event);

        const headers = {
          ...defaultHeaders,
          ...(result.headers || { "content-type": "application/json" }),
        };
        res.writeHead(result.statusCode || 200, headers);
        res.end(result.body);
        return;
      } catch (err) {
        console.error("🔥 Plan handler error:", err);
        return sendError(500, "Internal server error");
      }
    }

    if (req.url && req.url.startsWith("/history")) {
      const url = new URL(req.url, `http://localhost`);
      const query = Object.fromEntries(url.searchParams.entries());
      const limit = Math.min(Math.max(1, Number(query.limit) || 100), 1000); // Security: Cap at 1000

      try {
        let rows = null;
        if (historyDb) {
          rows = await queryHistory(historyDb, limit);
        } else {
          const file = path.resolve(
            process.cwd(),
            "backend",
            "external_history.log",
          );
          if (fs.existsSync(file)) {
            const stats = fs.statSync(file);
            if (stats.size > 10 * 1024 * 1024) {
              // Security: 10MB limit
              throw new Error("Log file too large");
            }
            const data = fs.readFileSync(file, "utf8");
            rows = data
              .split("\n")
              .filter(Boolean)
              .map((l, i) => {
                try {
                  return JSON.parse(l);
                } catch (e) {
                  return { id: i, raw: l };
                }
              })
              .slice(-limit)
              .reverse();
          } else {
            rows = [];
          }
        }
        const headers = {
          ...defaultHeaders,
          "content-type": "application/json",
        };
        res.writeHead(200, headers);
        res.end(JSON.stringify(rows));
        return;
      } catch (err) {
        console.error("🔥 History error:", err);
        return sendError(500, "Service temporarily unavailable");
      }
    }

    // Trips API endpoints
    if (req.url && req.url.startsWith("/api/trips")) {
      try {
        // Create an API Gateway-like event object for the handler
        const url = new URL(req.url, `http://localhost`);
        const pathSegments = url.pathname.split('/').filter(Boolean);
        
        // Extract tripId from path like /api/trips/{tripId}
        const tripId = pathSegments.length > 2 ? pathSegments[2] : undefined;
        
        // Get request body for POST/PUT requests
        let body = '';
        if (req.method === 'POST' || req.method === 'PUT') {
          for await (const chunk of req) {
            body += chunk;
          }
        }

        const event = {
          requestContext: {
            http: {
              method: req.method,
              sourceIp: req.socket.remoteAddress || '127.0.0.1'
            }
          },
          pathParameters: tripId ? { tripId } : {},
          queryStringParameters: Object.fromEntries(url.searchParams.entries()),
          headers: {
            authorization: req.headers.authorization,
            Authorization: req.headers.authorization,
            'content-type': req.headers['content-type']
          },
          body: body || null
        };

        const result = await tripsHandler(event);
        
        const headers = {
          ...defaultHeaders,
          'content-type': 'application/json',
          ...corsHeaders,
          ...securityHeaders,
        };

        res.writeHead(result.statusCode, headers);
        res.end(result.body);
        return;
      } catch (err) {
        console.error("🔥 Trips API error:", err);
        return sendError(500, "Service temporarily unavailable");
      }
    }

    // Health check endpoint
    if (req.url === "/health" || req.url === "/healthz") {
      const healthData = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        version: "1.0.0",
        security: NODE_ENV === "production" ? "enabled" : "development",
      };
      const headers = { ...defaultHeaders, "content-type": "application/json" };
      res.writeHead(200, headers);
      res.end(JSON.stringify(healthData));
      return;
    }

    // Default 404
    return sendError(404, "Not found");
  } catch (err) {
    console.error("🔥 Server error:", err);
    res.writeHead(500, {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...securityHeaders,
    });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

server.on("error", (err) => {
  console.error("🔥 Server startup error:", err);
  if (err.code === "EADDRINUSE") {
    console.error(
      `❌ Port ${PORT} is already in use. Try a different port or stop the existing process.`,
    );
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`🌐 Backend dev server listening on http://localhost:${PORT}`);
  if (NODE_ENV === "production") {
    console.log(
      "🔒 Production mode - debug endpoints disabled, security headers enabled",
    );
  } else {
    console.log(
      "🔧 Development mode - debug endpoints enabled, permissive CORS",
    );
  }
  console.log("📊 Available endpoints:");
  console.log("  GET  /health - Health check");
  console.log("  GET  /plan?lat=X&lng=Y - Trip planning");
  console.log("  POST /api/trips - Create trip");
  console.log("  GET  /api/trips - List trips");
  console.log("  GET  /api/trips/{id} - Get trip");
  console.log("  PUT  /api/trips/{id} - Update trip");
  console.log("  DELETE /api/trips/{id} - Delete trip");
  console.log("  GET  /history - Request history");
  if (NODE_ENV !== "production") {
    console.log("  GET  /__internal_events?lat=X&lng=Y - Events (dev only)");
    console.log("  GET  /__internal_traffic?lat=X&lng=Y - Traffic (dev only)");
  }
});
