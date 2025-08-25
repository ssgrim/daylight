# Caching (Redis / in-process)

> **📋 Complete Documentation**
> - **[Implementation Summary](./CACHING_IMPLEMENTATION.md)** - Full feature overview and acceptance criteria
> - **[Production Readiness](./PRODUCTION_READINESS.md)** - Deployment checklist and monitoring setup
> - **[CodeQL Issue Template](./CODEQL_ISSUE_TEMPLATE.md)** - CI configuration help

This project supports a distributed cache (Redis / ElastiCache) and an in-process memory fallback.

Key points

- The repository includes a cache wrapper at `backend/src/lib/cache.mjs` that prefers Redis when `REDIS_URL` is set and `ioredis` is available. Otherwise it uses an in-memory TTL cache.
- The external adapters in `backend/src/lib/external.ts` use a cache-aside pattern and are configured with per-type TTLs.

Environment variables

- `REDIS_URL` — set this to your Redis/ElastiCache connection string when running in production or CI to enable distributed caching (example: `redis://:password@hostname:6379/0`).
- `GEOCODE_TTL_MS` — TTL for geocode results in milliseconds (default: 86400000 = 24h).
- `WEATHER_TTL_MS` — TTL for weather results (default: 120000 = 2m).
- `EVENTS_TTL_MS` — TTL for events results (default: 60000 = 1m).
- `TRAFFIC_TTL_MS` — TTL for traffic results (default: 30000 = 30s).

Admin endpoint (development)

The local backend dev server exposes a small admin endpoint for inspecting and invalidating caches (for local development only):

- GET `/__cache` — returns a JSON object with cache metrics (`hits`, `misses`, `sets`, `invalidations`) for module caches and integrated adapters.
- POST `/__cache` — JSON payload controls invalidation:
  - `{ "clear": true }` — clears all module caches.
  - `{ "type": "weather" }` — clears the weather cache (or provide an optional `key` to invalidate a single entry).

Security note

The `/__cache` endpoint is intended for local development only. Do NOT expose this endpoint in production without proper authentication and authorization.

Admin token

You can require a token to access `/__cache` by setting the `CACHE_ADMIN_TOKEN` environment variable. When set, requests must include one of:

- `Authorization: Bearer <token>` header
- `X-Admin-Token: <token>` header

This is a lightweight guard for development; for production use a stronger auth mechanism.

JWT admin tokens

You can also secure the admin endpoint with JWTs by setting `CACHE_ADMIN_JWT_SECRET`. Requests to `/__cache` must include a Bearer token signed with this secret. This allows you to use short-lived tokens issued by your auth system.

Metrics

Each cache object exposes a `metrics()` method (hits/misses/sets/invalidations). The aggregated `getCacheMetrics()` helper is available from `backend/src/lib/external.ts` for integration with monitoring.

Recommended next steps for production

1. Deploy a Redis/ElastiCache instance and set `REDIS_URL`.
2. Instrument and export cache metrics to your monitoring system (Prometheus, CloudWatch, etc.).
3. Protect any admin endpoints with authentication, or remove them from production builds.

Prometheus metrics

The dev server exposes a Prometheus metrics endpoint at `/__metrics` which includes process metrics and cache gauges when available. This is implemented using `prom-client` and is intended for local or staging monitoring. In production, integrate with your monitoring stack and ensure the endpoint is protected.

Troubleshooting

- If `ioredis` is not installed or `REDIS_URL` is not set, the system will fall back to in-memory cache.
- If you see divergence in cached data across instances, ensure all app instances use the same `REDIS_URL` and database index.
