# Daylight

Cloud-first trip planning and live re-planning engine.

## Documentation

For the full implementation plan and architecture details, see:

- [Daylight v1 Implementation Pack (AWS, React, Vite, Terraform, CI)](docs/daylight_v_1_implementation_pack_aws_react_vite_terraform_ci.md)


## Status (quick)

- Shared types: done — `shared/src/types/daylight.ts` contains OpenAPI-aligned TS types (Trip, Anchor, PlanRequest/Response, Prefs).
- Backend: minimal handlers implemented for `/plan` and `/trips` at `backend/src/handlers` (demo responses). Build and test scripts present in `backend/package.json`.
- Frontend: basic React/Vite scaffold and pages (`Root`, `Plan`) are present and buildable via `frontend/package.json`.
- Infra: Terraform configs exist under `infra/terraform` but full AWS wiring and deploy secrets are left to the operator.
- CI/Deploy: GitHub Actions manifests are documented in this README; deploy steps expect workspace packages `shared`, `backend`, and `frontend` (some workspaces may need `shared/package.json` added/updated).

What's left (short):

- Wire end-to-end persistence: connect `backend/handlers/trips.ts` to DynamoDB and implement full CRUD with proper keys and tests.
- Improve the planner: replace demo `/plan` handler with the scoring engine (backend/lib/engine.ts) and unit tests.
- Frontend: implement planner UI, map integration, and API wiring (auth, token management) in the SPA.
- Infra: finish Terraform wiring for Lambdas, API Gateway, DynamoDB, and CI secrets; add RBAC/Cognito for production.

Local dev (frontend + backend)

1. Start the backend dev shim (serves `/plan`):

```bash
cd backend
node ./dev-server.mjs
```

2. Start the frontend (Vite) — `VITE_API_BASE` is stored in `frontend/.env.local` and points to the backend dev server by default:

```bash
cd frontend
npm ci
npm run dev -- --port 5173
```

Open the forwarded Codespaces preview for port 5173. The Plan page has sample buttons that call `/plan?lat=...&lng=...` and show enriched results.

Config & observability notes

- To switch providers set environment variables for the backend (dev or deployed):
  - `GEOCODE_PROVIDER` (default: `nominatim`) — other options: `mapbox` (requires `MAPBOX_TOKEN`)
  - `WEATHER_PROVIDER` (default: `open-meteo`) — other options: `openweathermap` (requires `OPENWEATHERMAP_KEY`)
- The dev adapters use an in-memory LRU cache for reverse geocoding to reduce quota usage.
- The dev shim appends a small audit log to `backend/external_history.log` for calls to external providers (dev-only). For production, wire logs to CloudWatch/Datadog.

External integrations:

- The backend includes lightweight adapters for public external data sources in `backend/src/lib/external.ts` (Open‑Meteo for weather and Nominatim for reverse geocoding). These are used by the `/plan` handler when `lat` and `lng` query parameters are provided. Example:

```text
GET /plan?lat=47.6&lng=-122.33
```text

- These public endpoints do not require API keys but have rate limits; you can replace them with API-key-backed providers (Mapbox, OpenWeatherMap) for production. If you do, document required env vars and secrets in `infra` and CI.

---

## 7) CI/CD (GitHub Actions)

**`.github/workflows/ci.yml`**

```yaml
name: CI
on:
  pull_request:
    branches: [ main ]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm run test
```text

**`.github/workflows/deploy.yml`**

```yaml
name: Deploy
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm -w shared run build
      - run: npm -w backend run build
      - run: |
          mkdir -p artifacts
          zip -j artifacts/plan.zip backend/dist/bundle/plan.mjs
          zip -j artifacts/trips.zip backend/dist/bundle/trips.mjs
      - uses: hashicorp/setup-terraform@v3
      - uses: aws-actions/configure-aws-credentials@v4
        if: ${{ secrets.AWS_ROLE_TO_ASSUME != '' }}
        with:
          aws-region: us-west-2
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}
          role-session-name: daylight-ci
      - name: Terraform Apply
        if: ${{ secrets.AWS_ROLE_TO_ASSUME != '' }}
        working-directory: infra
        run: |
          terraform init -input=false
          terraform apply -auto-approve \
            -var="plan_bundle=../artifacts/plan.zip" \
            -var="trips_bundle=../artifacts/trips.zip"
      - name: Build frontend
        run: npm -w frontend run build
      - name: Sync SPA to S3 (best-effort)
        if: ${{ secrets.SPA_BUCKET != '' }}
        run: aws s3 sync frontend/dist s3://${{ secrets.SPA_BUCKET }} --delete
      - name: Invalidate CDN
        if: ${{ secrets.CLOUDFRONT_DIST_ID != '' }}
        run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DIST_ID }} --paths "/*"
```text

> Secrets gating ensures PRs run CI, and main deploys only if AWS secrets exist.

---

## 8) Linting & Formatting

**`.eslintignore`**

```
node_modules
**/dist
```

**Root ESLint (add `.eslintrc.json`)**

```json
{
  "root": true,
  "env": { "es2022": true, "node": true, "browser": true },
  "extends": ["eslint:recommended"],
  "parserOptions": { "ecmaVersion": 2022, "sourceType": "module" },
  "rules": { "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }] }
}
```

**Prettier**

```json
{}
```

---

## 9) README (root) — setup & run

```md
# Daylight

## Prereqs
- Node 20+
- AWS account with permissions (admin or constrained), AWS CLI configured
- Terraform 1.7+

## Install

```bash
npm i
```

## Local builds

```bash
npm -w shared run build
npm -w backend run build
npm -w frontend run build
```

## API test (local Lambda emulation optional)

- Handlers are pure; deploy to AWS via Terraform for real API Gateway wiring.

## Deploy (dev)

See `infra/README.md`.

## Env Vars

- Backend Lambdas: `TRIPS_TABLE` (injected by TF)
- Frontend: `VITE_API_BASE`, `VITE_MAPBOX_TOKEN` (optional)

## Security & Privacy

- IAM: least privilege for DynamoDB + logs
- No secrets in repo; Mapbox token via env only
- Telemetry opt‑in (future): defer to feature flags

## Testing

- `npm -w backend test` runs unit tests for engine & handlers
- Add a11y checks in UI (todo: axe‑core integration)

```

---

## 10) Migration notes (if OpenAPI or schema differs)

- **Change in Trip item shape**: Update `shared/src/types/daylight.ts` and `backend/src/handlers/trips.ts` merge logic. No DDB migration needed if keys unchanged. If keys change, export table to S3, transform, re‑import; or add new attributes lazily on read.
- **Add GSI**: If listing trips by owner is required, add `ownerId` attribute and GSI `gsi1pk = OWNER#<ownerId>`.
- **Split itinerary items**: Introduce items `pk=TRIP#<id>`, `sk=ITIN#<ordinal>`; add `query` permissions and pagination.
- **Auth**: Introduce Cognito User Pool + authorizer on API routes; change Terraform to attach `authorizer_id` to routes; add ID token fetch on frontend.

---

## 11) Commit plan (messages & PR blurbs)

1. **feat(shared): add Daylight core types aligned to OpenAPI**
   - Adds canonical TS types for Trip, Anchor, PlanRequest/Response, Preferences.

2. **feat(backend): scoring engine + /plan handler**
   - Implements rolling‑horizon heuristic and suggestion rationales; unit tests.

3. **feat(backend): /trips CRUD with DynamoDB**
   - Adds Trip persistence (PK=TRIP#id, SK=META); tests with mocked DDB.

4. **feat(frontend): React/Vite app with Map view & panels**
   - PWA‑ready scaffold, Zustand store, Mapbox/Maplibre fallback; re‑solve control.

5. **infra(terraform): API Gateway, Lambda, DynamoDB, S3+CloudFront**
   - Least‑privilege IAM, OAC for SPA bucket, HTTP API routes.

6. **ci: add CI and gated deploy workflows**
   - Lint/test/build on PR; deploy to AWS on main when secrets exist.

7. **docs: root README and infra README**
   - Setup, env, deploy, and migration notes.

---

## 12) Next steps 
- Cognito + RBAC (viewer/editor/owner) with API authorizers.
- Candidate discovery integrations (Places, NPS, weather, AQI, wildfire alerts) via separate Lambdas.
- Solver improvements (time‑windows, OR‑Tools or metaheuristics).
- Offline map regions & background sync; web push for re‑plan suggestions.
- Budget guardrails & printable/shareable trip cards.

