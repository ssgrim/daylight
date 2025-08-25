# Daylight

Cloud-first trip planning and live re-planning engine.

## Documentation

For comprehensive project documentation:

- **Implementation Guide**: [Daylight v1 Implementation Pack](docs/daylight_v_1_implementation_pack_aws_react_vite_terraform_ci.md) - Complete AWS, React, Vite, Terraform, CI setup
- **Caching Strategy**: [Cache Implementation](docs/CACHING_IMPLEMENTATION.md) - Redis/ElastiCache with cache-aside pattern and metrics
- **Production Readiness**: [Production Checklist](docs/PRODUCTION_READINESS.md) - Deployment and operational considerations
- **Competitive Analysis**: [Market Analysis](docs/market-analysis.md) - Feature comparison vs industry leaders
- **Strategic Roadmap**: [Roadmap Summary](docs/roadmap-issues-summary.md) - Comprehensive feature planning and GitHub issues
- **Development Setup**: [Development Guide](docs/DEVELOPMENT_SETUP.md) - Local development environment setup
- **Testing Strategy**: [Testing Guide](docs/testing-strategy.md) - Comprehensive testing approach

### OpenAPI Specification

- [Daylight API v1](docs/openapi/daylight.v1.yaml) - Complete API specification


## Status (Current Implementation)

✅ **Completed Features:**
- **Shared types**: Complete TypeScript types aligned with OpenAPI specification
- **Backend**: Enhanced handlers with external API integrations (weather, events, traffic, geocoding)
- **Caching Layer**: Comprehensive Redis/ElastiCache implementation with cache-aside pattern and metrics
- **Monitoring**: Prometheus metrics integration with admin endpoints
- **Frontend**: React/Vite scaffold with basic trip planning interface
- **Infrastructure**: Complete Terraform configuration for AWS deployment
- **CI/CD**: GitHub Actions with security scanning and automated deployments

🚧 **In Progress/Remaining Work:**
- **Full Trip Persistence**: Complete DynamoDB CRUD implementation for trips handler
- **Advanced Planning Engine**: Enhanced solver with time windows and optimization algorithms
- **User Authentication**: Cognito integration with RBAC (tracked in issue #121)
- **Enhanced Discovery**: Additional API integrations for comprehensive location data (issue #122)

📋 **Planned Features**: 30+ features tracked in GitHub issues #91-127, including social features, offline capabilities, advanced search, and mobile optimization.

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

## Configuration & Environment Variables

### Backend Configuration

**External API Providers:**
- `GEOCODE_PROVIDER` (default: `nominatim`) — options: `mapbox` (requires `MAPBOX_TOKEN`)
- `WEATHER_PROVIDER` (default: `open-meteo`) — options: `openweathermap` (requires `OPENWEATHERMAP_KEY`)

**Caching Configuration:**
- `REDIS_URL` — Redis connection string for distributed caching (optional, falls back to in-memory)
- `GEOCODE_TTL_MS` — Cache TTL for geocoding results (default: 24 hours)
- `WEATHER_TTL_MS` — Cache TTL for weather data (default: 30 minutes)
- `EVENTS_TTL_MS` — Cache TTL for events data (default: 1 hour)
- `TRAFFIC_TTL_MS` — Cache TTL for traffic data (default: 5 minutes)

**Monitoring & Admin:**
- `CACHE_ADMIN_TOKEN` — Simple token for cache admin endpoint access
- `CACHE_ADMIN_JWT_SECRET` — JWT secret for secure admin endpoint access

**Database:**
- `TRIPS_TABLE` — DynamoDB table name for trip storage (injected by Terraform)

### Frontend Configuration

- `VITE_API_BASE` — Backend API base URL
- `VITE_MAPBOX_TOKEN` — Mapbox access token for map functionality (optional)

### Observability

The application includes comprehensive monitoring:
- **Metrics**: Prometheus metrics available at `/__metrics` endpoint
- **Cache Analytics**: Cache hit/miss ratios and performance metrics at `/__cache` endpoint
- **Audit Logging**: External API call history (development only)
- **Real-time Monitoring**: AWS CloudWatch integration for production deployments

For production deployments, see the [Production Readiness Guide](docs/PRODUCTION_READINESS.md).

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
```

### Optional CI/CD Secrets

The following GitHub repository secrets can be configured for enhanced CI/CD functionality but are **not required** for basic operation:

**Monitoring & Notifications:**
- `SLACK_WEBHOOK` - Webhook URL for Slack notifications on deployment health checks
- `LHCI_GITHUB_APP_TOKEN` - GitHub App token for enhanced Lighthouse CI features and PR comments

**AWS Deployment:**
- `AWS_ROLE_TO_ASSUME` - IAM role ARN for AWS deployment authentication
- `SPA_BUCKET` - S3 bucket name for frontend deployment
- `CLOUDFRONT_DIST_ID` - CloudFront distribution ID for cache invalidation

> **Note:** Workflows gracefully handle missing secrets and provide fallback behavior. All CI/CD pipelines will run successfully whether these secrets are configured or not.

> Secrets gating ensures PRs run CI, and main deploys only if AWS secrets exist.
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

## 10) Documentation & Roadmap

For comprehensive project documentation and strategic roadmap:

- **Implementation Guides**: See `docs/` directory for detailed documentation including caching implementation, production readiness checklist, and testing strategy
- **Market Analysis**: Review `docs/market-analysis.md` for competitive positioning vs industry leaders
- **Strategic Roadmap**: See `docs/roadmap-issues-summary.md` for comprehensive feature planning and GitHub issues summary
- **GitHub Issues**: Track 30+ feature enhancements and infrastructure improvements via GitHub issues #91-120+

### Current Implementation Status

The project includes:
- ✅ Comprehensive Redis/ElastiCache caching with cache-aside pattern
- ✅ External API integrations (weather, events, traffic, geocoding) with metrics
- ✅ Prometheus monitoring and admin endpoints
- ✅ Basic trip planning engine and handlers
- ✅ React/Vite frontend scaffold with map integration
- ✅ AWS infrastructure via Terraform (Lambda, API Gateway, DynamoDB, CloudFront)
- ✅ GitHub Actions CI/CD with security scanning

### Outstanding Development Work

Major features and infrastructure improvements are tracked in GitHub issues. Key areas include:
- User authentication and social features
- Enhanced trip planning with multi-day support
- Real-time collaboration and sharing
- Advanced search and discovery
- Offline functionality and mobile optimization

See GitHub issues for detailed implementation plans and acceptance criteria.

