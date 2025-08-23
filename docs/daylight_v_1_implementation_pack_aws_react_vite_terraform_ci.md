# Daylight v1 — Implementation Pack

This pack provides a production‑grade baseline for Daylight: infra (Terraform), backend (API Gateway + Lambda + DynamoDB), frontend (React/Vite/TS/Tailwind + Mapbox), shared types, scoring engine, tests, and CI/CD.

---

## 0) Assumptions mapped from OpenAPI (sync to `shared/types`)

> If the provided OpenAPI differs, adjust `shared/types` and handlers accordingly (notes below include migration steps).

- **POST /plan**: request `{ tripId: string; atTime: string (ISO); anchors: Anchor[]; prefs: Prefs; context?: LiveContext }`; response `{ suggestions: Suggestion[]; revisedPlan?: ItineraryItem[]; eval?: ScoreBreakdown[] }`.
- **/trips**: `POST` create `{name, startsAt, endsAt, anchors?}` → `{tripId}`; `GET /trips/{tripId}` → Trip; `PUT /trips/{tripId}` → updated Trip; `DELETE /trips/{tripId}`.
- **DynamoDB**: single‑item per trip (PK=`TRIP#<tripId>`, SK=`META`).

---

## 1) Repository layout

```
/daylight
  ├─ package.json              # workspaces
  ├─ tsconfig.base.json
  ├─ .editorconfig
  ├─ .eslintignore
  ├─ .prettierignore
  ├─ .github/workflows/
  │    ├─ ci.yml
  │    └─ deploy.yml
  ├─ shared/
  │    ├─ package.json
  │    ├─ tsconfig.json
  │    └─ src/types/daylight.ts
  ├─ backend/
  │    ├─ package.json
  │    ├─ tsconfig.json
  │    ├─ jest.config.ts
  │    ├─ src/
  │    │   ├─ handlers/plan.ts
  │    │   ├─ handlers/trips.ts
  │    │   ├─ engine/score.ts
  │    │   ├─ lib/dynamo.ts
  │    │   └─ util/http.ts
  │    └─ test/
  │        ├─ score.spec.ts
  │        ├─ plan.spec.ts
  │        └─ trips.spec.ts
  ├─ frontend/
  │    ├─ package.json
  │    ├─ tsconfig.json
  │    ├─ vite.config.ts
  │    ├─ index.html
  │    ├─ public/manifest.webmanifest
  │    ├─ src/
  │    │   ├─ main.tsx
  │    │   ├─ App.tsx
  │    │   ├─ env.ts
  │    │   ├─ store/useTripStore.ts
  │    │   ├─ components/MapView.tsx
  │    │   ├─ components/AnchorsPanel.tsx
  │    │   ├─ components/SuggestionsPanel.tsx
  │    │   ├─ components/ControlsBar.tsx
  │    │   └─ styles.css
  └─ infra/
       ├─ main.tf
       ├─ variables.tf
       ├─ outputs.tf
       └─ README.md
```

---

## 2) Root config

**`package.json` (workspaces)**
```json
{
  "name": "daylight",
  "private": true,
  "workspaces": ["shared", "backend", "frontend", "infra"],
  "scripts": {
    "build": "npm -ws run build",
    "lint": "npm -ws run lint",
    "test": "npm -ws run test",
    "format": "prettier -w ."
  },
  "devDependencies": {
    "eslint": "^9.9.0",
    "prettier": "^3.3.3",
    "typescript": "^5.5.4"
  }
}
```

**`tsconfig.base.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true,
    "esModuleInterop": true
  }
}
```

---

## 3) Shared types (kept minimal & aligned to assumptions)

**`shared/src/types/daylight.ts`**
```ts
export type LatLng = { lat: number; lng: number };
export type TimeWindow = { start: string; end: string }; // ISO

export type Anchor = {
  id: string;
  name: string;
  location: LatLng;
  timebox?: TimeWindow; // hard window if present
  minDurationMin?: number; // default 30
};

export type PreferenceWeights = {
  distance: number; // lower is better
  rating: number; // higher is better
  openNow: number; // bonus if open
  categoryAffinity: Record<string, number>; // e.g., {"hiking": 0.8}
  weather: number; // penalty for bad wx
  crowding: number; // penalty for crowded
  cost: number; // penalty scaled 0..1 cost
};

export type Prefs = {
  weights: PreferenceWeights;
  mustHaveCategories?: string[];
  avoidCategories?: string[];
  dayStartLocal?: string; // "08:00"
  dayEndLocal?: string; // "21:00"
  maxDriveMin?: number; // soft cap per hop
};

export type LiveContext = {
  weatherSummary?: string; // stubbed for now
  trafficLevel?: "low" | "med" | "high";
  crowdLevelHint?: number; // 0..1
  nowLocal?: string; // ISO
};

export type CandidateStop = {
  id: string;
  name: string;
  location: LatLng;
  categories?: string[];
  rating?: number; // 0..5
  costIndex?: number; // 0..1
  openWindows?: TimeWindow[]; // local
};

export type ScoreBreakdown = {
  id: string;
  score: number;
  terms: Record<string, number>;
};

export type Suggestion = {
  id: string;
  name: string;
  location: LatLng;
  score: number;
  breakdown: ScoreBreakdown;
  reason?: string;
};

export type ItineraryItem = {
  anchorId?: string;
  candidateId?: string;
  start: string; // ISO
  end: string;   // ISO
};

export type PlanRequest = {
  tripId: string;
  atTime: string; // ISO
  anchors: Anchor[];
  prefs: Prefs;
  context?: LiveContext;
  candidates?: CandidateStop[]; // optional seed
};

export type PlanResponse = {
  suggestions: Suggestion[];
  revisedPlan?: ItineraryItem[];
  eval?: ScoreBreakdown[];
};

export type Trip = {
  tripId: string;
  name: string;
  startsAt: string; // ISO
  endsAt: string;   // ISO
  anchors: Anchor[];
  createdAt: string;
  updatedAt: string;
};
```

**`shared/package.json`**
```json
{ "name": "@daylight/shared", "version": "0.1.0", "type": "module", "main": "dist/index.js", "types": "dist/index.d.ts",
  "scripts": { "build": "tsc -p tsconfig.json" },
  "devDependencies": { "typescript": "^5.5.4" }
}
```

**`shared/tsconfig.json`**
```json
{ "extends": "../tsconfig.base.json", "compilerOptions": { "outDir": "dist" }, "include": ["src"] }
```

---

## 4) Backend (Lambda + API Gateway)

**`backend/package.json`**
```json
{
  "name": "@daylight/backend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json && node ./esbuild.mjs",
    "lint": "eslint .",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.637.0",
    "@aws-sdk/lib-dynamodb": "^3.637.0",
    "@daylight/shared": "*"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.137",
    "aws-lambda": "^1.0.7",
    "esbuild": "^0.23.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.5.4",
    "eslint": "^9.9.0",
    "@types/jest": "^29.5.12",
    "aws-sdk-client-mock": "^4.0.2"
  }
}
```

**`backend/tsconfig.json`**
```json
{ "extends": "../tsconfig.base.json", "compilerOptions": { "outDir": "dist", "lib": ["ES2022"], "types": ["aws-lambda"] }, "include": ["src"] }
```

**`backend/esbuild.mjs`** (bundle handlers → `dist/bundle/*.mjs`)
```js
import { build } from 'esbuild';
await build({
  entryPoints: {
    plan: 'src/handlers/plan.ts',
    trips: 'src/handlers/trips.ts'
  },
  platform: 'node',
  target: 'node20',
  format: 'esm',
  bundle: true,
  sourcemap: true,
  outfile: 'dist/bundle/[name].mjs',
  external: [
    // keep AWS SDK v3 external for Lambda
  ]
});
```

**`backend/src/util/http.ts`**
```ts
import type { APIGatewayProxyResult } from 'aws-lambda';

export const json = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body)
});

export const bad = (msg: string, statusCode = 400) => json(statusCode, { error: msg });
```

**`backend/src/lib/dynamo.ts`**
```ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-west-2';
export const TABLE = process.env.TRIPS_TABLE || 'daylight_trips';

const lowLevel = new DynamoDBClient({ region: REGION });
export const ddb = DynamoDBDocumentClient.from(lowLevel, { marshallOptions: { removeUndefinedValues: true } });
```

**`backend/src/engine/score.ts`** (rolling‑horizon heuristic)
```ts
import { Anchor, CandidateStop, Prefs, ScoreBreakdown } from '@daylight/shared/src/types/daylight';

const toRad = (d: number) => (d * Math.PI) / 180;
export const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

export function scoreCandidates(
  nowAnchor: Anchor | undefined,
  candidates: CandidateStop[],
  prefs: Prefs,
  contextCrowdLevel = 0
): ScoreBreakdown[] {
  const w = prefs.weights;
  return candidates.map((c) => {
    const distKm = nowAnchor ? haversineKm(nowAnchor.location, c.location) : 0;
    const distPenalty = -w.distance * Math.min(1, distKm / 50); // cap @50km

    const ratingTerm = w.rating * ((c.rating ?? 3.5) / 5);

    const open = isOpenNow(c);
    const openTerm = w.openNow * (open ? 1 : 0);

    const catTerm = (c.categories || []).reduce((acc, cat) => acc + (w.categoryAffinity[cat] ?? 0), 0) / Math.max(1, (c.categories || []).length);

    const weatherTerm = -w.weather * 0.0; // placeholder; integrate real feed later
    const crowdTerm = -w.crowding * Math.max(contextCrowdLevel, 0);
    const costTerm = -w.cost * (c.costIndex ?? 0.3);

    const terms = { distPenalty, ratingTerm, openTerm, catTerm, weatherTerm, crowdTerm, costTerm };
    const score = Object.values(terms).reduce((a, b) => a + b, 0);
    return { id: c.id, score, terms };
  }).sort((a, b) => b.score - a.score);
}

export function isOpenNow(c: CandidateStop, when = new Date()): boolean {
  if (!c.openWindows || c.openWindows.length === 0) return true; // optimistic default
  const t = when.toISOString();
  return c.openWindows.some((w) => w.start <= t && t <= w.end);
}
```

**`backend/src/handlers/plan.ts`**
```ts
import type { APIGatewayProxyHandler } from 'aws-lambda';
import { json, bad } from '../util/http.js';
import type { PlanRequest, PlanResponse, Suggestion } from '@daylight/shared/src/types/daylight';
import { scoreCandidates } from '../engine/score.js';

export const handler: APIGatewayProxyHandler = async (event) => {
  if (!event.body) return bad('Missing body');
  let req: PlanRequest;
  try { req = JSON.parse(event.body); } catch { return bad('Invalid JSON'); }

  const { anchors, prefs, candidates = [] } = req;
  const nowAnchor = anchors?.[0]; // rolling horizon: next anchor as current context

  const evals = scoreCandidates(nowAnchor, candidates, prefs, (req.context?.crowdLevelHint ?? 0));
  const suggestions: Suggestion[] = evals.slice(0, 10).map((e) => {
    const found = candidates.find((c) => c.id === e.id)!;
    return {
      id: e.id,
      name: found.name,
      location: found.location,
      score: e.score,
      breakdown: e,
      reason: rationale(e)
    };
  });

  const res: PlanResponse = { suggestions, eval: evals };
  return json(200, res);
};

function rationale(e: { terms: Record<string, number> }): string {
  const t = e.terms;
  if ((t.openTerm ?? 0) > 0.5 && (t.ratingTerm ?? 0) > 0.5) return 'Open now and highly rated';
  if ((t.distPenalty ?? 0) > -0.2) return 'Nearby option with decent fit';
  return 'Balanced tradeoff by preferences';
}
```

**`backend/src/handlers/trips.ts`**
```ts
import type { APIGatewayProxyHandler } from 'aws-lambda';
import { json, bad } from '../util/http.js';
import { ddb, TABLE } from '../lib/dynamo.js';
import { GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import type { Trip } from '@daylight/shared/src/types/daylight';

const nowIso = () => new Date().toISOString();

export const handler: APIGatewayProxyHandler = async (event) => {
  const { httpMethod, pathParameters } = event;
  if (httpMethod === 'POST') return createTrip(event.body);
  const id = pathParameters?.tripId;
  if (!id) return bad('Missing tripId', 400);
  if (httpMethod === 'GET') return getTrip(id);
  if (httpMethod === 'PUT') return updateTrip(id, event.body);
  if (httpMethod === 'DELETE') return deleteTrip(id);
  return bad('Unsupported method', 405);
};

async function createTrip(body?: string | null) {
  if (!body) return bad('Missing body');
  let payload: Partial<Trip>;
  try { payload = JSON.parse(body); } catch { return bad('Invalid JSON'); }
  const tripId = crypto.randomUUID();
  const trip: Trip = {
    tripId,
    name: payload.name || 'Untitled Trip',
    startsAt: payload.startsAt!,
    endsAt: payload.endsAt!,
    anchors: payload.anchors || [],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: { pk: `TRIP#${tripId}`, sk: 'META', ...trip } }));
  return json(201, { tripId });
}

async function getTrip(tripId: string) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLE, Key: { pk: `TRIP#${tripId}`, sk: 'META' } }));
  if (!Item) return bad('Not found', 404);
  const { pk, sk, ...trip } = Item as any;
  return json(200, trip);
}

async function updateTrip(tripId: string, body?: string | null) {
  if (!body) return bad('Missing body');
  let payload: Partial<Trip>;
  try { payload = JSON.parse(body); } catch { return bad('Invalid JSON'); }
  const existing = await ddb.send(new GetCommand({ TableName: TABLE, Key: { pk: `TRIP#${tripId}`, sk: 'META' } }));
  if (!existing.Item) return bad('Not found', 404);
  const merged = { ...existing.Item, ...payload, updatedAt: nowIso() };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: merged }));
  const { pk, sk, ...trip } = merged as any;
  return json(200, trip);
}

async function deleteTrip(tripId: string) {
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { pk: `TRIP#${tripId}`, sk: 'META' } }));
  return json(204, {});
}
```

**`backend/jest.config.ts`**
```ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js'],
};
```

**`backend/test/score.spec.ts`**
```ts
import { scoreCandidates } from '../src/engine/score';

it('scores closer, open, highly-rated higher', () => {
  const now = { id: 'a1', name: 'Hotel', location: { lat: 34.1, lng: -118.2 } } as any;
  const prefs = { weights: { distance: 1, rating: 1, openNow: 1, categoryAffinity: {}, weather: 0.5, crowding: 0.5, cost: 0.3 }, maxDriveMin: 60 } as any;
  const cands = [
    { id: 'c1', name: 'Far', location: { lat: 35, lng: -118.2 }, rating: 4.5 },
    { id: 'c2', name: 'Near', location: { lat: 34.1005, lng: -118.2005 }, rating: 4.3 }
  ];
  const s = scoreCandidates(now, cands as any, prefs);
  expect(s[0].id).toBe('c2');
});
```

**`backend/test/plan.spec.ts`** (happy path)
```ts
import { handler } from '../src/handlers/plan';

it('returns suggestions', async () => {
  const evt: any = { body: JSON.stringify({ tripId: 't1', atTime: new Date().toISOString(), anchors: [{ id: 'a', name: 'Start', location: { lat: 34, lng: -118 } }], prefs: { weights: { distance: 1, rating: 1, openNow: 1, categoryAffinity: {}, weather: 0.2, crowding: 0.2, cost: 0.2 } }, candidates: [{ id: 'c', name: 'Test', location: { lat: 34.01, lng: -118.01 }, rating: 4.7 }] }) };
  const res = await handler(evt as any, {} as any, () => {});
  const body = JSON.parse(res.body);
  expect(res.statusCode).toBe(200);
  expect(body.suggestions.length).toBeGreaterThan(0);
});
```

**`backend/test/trips.spec.ts`** (mock ddb)
```ts
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../src/handlers/trips';

const ddbMock = mockClient((DynamoDBDocumentClient as any).prototype.constructor?.name ? (DynamoDBDocumentClient as any) : (DynamoDBDocumentClient as any));

beforeEach(() => ddbMock.reset());

it('creates trip', async () => {
  ddbMock.on(PutCommand as any).resolves({});
  const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ name: 'Trip', startsAt: new Date().toISOString(), endsAt: new Date().toISOString() }) } as any, {} as any, () => {});
  expect(res.statusCode).toBe(201);
});

it('gets trip', async () => {
  ddbMock.on(GetCommand as any).resolves({ Item: { pk: 'TRIP#1', sk: 'META', tripId: '1', name: 'Trip' } });
  const res = await handler({ httpMethod: 'GET', pathParameters: { tripId: '1' } } as any, {} as any, () => {});
  expect(res.statusCode).toBe(200);
});

it('deletes trip', async () => {
  ddbMock.on(DeleteCommand as any).resolves({});
  const res = await handler({ httpMethod: 'DELETE', pathParameters: { tripId: '1' } } as any, {} as any, () => {});
  expect(res.statusCode).toBe(204);
});
```

---

## 5) Frontend (Vite + React + TS + Tailwind + Zustand + Mapbox)

**`frontend/package.json`**
```json
{
  "name": "@daylight/frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "test": "echo 'no ui tests yet'"
  },
  "dependencies": {
    "@daylight/shared": "*",
    "mapbox-gl": "^3.6.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.4"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.4",
    "vite": "^5.4.1"
  }
}
```

**`frontend/vite.config.ts`**
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

**`frontend/tsconfig.json`**
```json
{ "extends": "../tsconfig.base.json", "compilerOptions": { "jsx": "react-jsx", "outDir": "dist" }, "include": ["src", "vite-env.d.ts"] }
```

**`frontend/index.html`**
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <title>Daylight</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**`frontend/public/manifest.webmanifest`**
```json
{
  "name": "Daylight",
  "short_name": "Daylight",
  "display": "standalone",
  "start_url": "/",
  "icons": []
}
```

**`frontend/src/styles.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
html, body, #root { height: 100%; }
```

**`frontend/src/env.ts`**
```ts
export const API_BASE = import.meta.env.VITE_API_BASE || '/api';
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
```

**`frontend/src/store/useTripStore.ts`**
```ts
import { create } from 'zustand';
import type { Anchor, Suggestion, PlanRequest, Trip } from '@daylight/shared/src/types/daylight';
import { API_BASE } from '../env';

interface State {
  trip?: Trip;
  anchors: Anchor[];
  suggestions: Suggestion[];
  loading: boolean;
  setTrip: (t: Trip) => void;
  replan: (req: Omit<PlanRequest, 'tripId' | 'anchors'>) => Promise<void>;
}

export const useTripStore = create<State>((set, get) => ({
  anchors: [],
  suggestions: [],
  loading: false,
  setTrip: (t) => set({ trip: t, anchors: t.anchors }),
  replan: async (req) => {
    const t = get().trip; if (!t) return;
    set({ loading: true });
    const res = await fetch(`${API_BASE}/plan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tripId: t.tripId, anchors: get().anchors, ...req }) });
    const data = await res.json();
    set({ suggestions: data.suggestions || [], loading: false });
  }
}));
```

**`frontend/src/main.tsx`**
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
```

**`frontend/src/App.tsx`**
```tsx
import { useEffect } from 'react';
import { useTripStore } from './store/useTripStore';
import { ControlsBar } from './components/ControlsBar';
import { AnchorsPanel } from './components/AnchorsPanel';
import { SuggestionsPanel } from './components/SuggestionsPanel';
import { MapView } from './components/MapView';

export default function App() {
  const setTrip = useTripStore((s) => s.setTrip);
  useEffect(() => {
    // seed demo trip (offline-friendly)
    const demo = {
      tripId: 'demo', name: 'Demo Trip',
      startsAt: new Date().toISOString(), endsAt: new Date(Date.now()+86400000).toISOString(),
      anchors: [{ id: 'hotel', name: 'Hotel', location: { lat: 34.1381, lng: -118.3534 } }],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    setTrip(demo as any);
  }, [setTrip]);

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-3">
      <div className="md:col-span-2 relative">
        <MapView />
        <div className="absolute bottom-0 left-0 right-0">
          <ControlsBar />
        </div>
      </div>
      <div className="border-l flex flex-col">
        <AnchorsPanel />
        <SuggestionsPanel />
      </div>
    </div>
  );
}
```

**`frontend/src/components/MapView.tsx`**
```tsx
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { MAPBOX_TOKEN } from '../env';
import { useTripStore } from '../store/useTripStore';

export function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const anchors = useTripStore((s) => s.anchors);
  const suggestions = useTripStore((s) => s.suggestions);

  useEffect(() => {
    if (!mapRef.current) return;
    if (MAPBOX_TOKEN) (mapboxgl as any).accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: MAPBOX_TOKEN ? 'mapbox://styles/mapbox/streets-v12' : 'https://demotiles.maplibre.org/style.json',
      center: [-118.3534, 34.1381],
      zoom: 11
    } as any);
    map.addControl(new mapboxgl.NavigationControl());
    return () => map.remove();
  }, []);

  useEffect(() => {
    // In a fuller impl, sync anchors/suggestions to layers
  }, [anchors, suggestions]);

  return <div ref={mapRef} className="h-full" />;
}
```

**`frontend/src/components/AnchorsPanel.tsx`**
```tsx
import { useTripStore } from '../store/useTripStore';
export function AnchorsPanel() {
  const anchors = useTripStore((s) => s.anchors);
  return (
    <div className="p-3 border-b">
      <h2 className="font-semibold mb-2">Anchors</h2>
      <ul className="space-y-1 text-sm">
        {anchors.map(a => (
          <li key={a.id}>{a.name} · {a.location.lat.toFixed(3)}, {a.location.lng.toFixed(3)}</li>
        ))}
      </ul>
    </div>
  );
}
```

**`frontend/src/components/SuggestionsPanel.tsx`**
```tsx
import { useTripStore } from '../store/useTripStore';
export function SuggestionsPanel() {
  const { suggestions, loading } = useTripStore();
  return (
    <div className="p-3 flex-1 overflow-auto">
      <h2 className="font-semibold mb-2">Suggestions</h2>
      {loading && <div className="text-sm">Scoring…</div>}
      <ul className="space-y-2 text-sm">
        {suggestions.map(s => (
          <li key={s.id} className="p-2 border rounded">
            <div className="font-medium">{s.name}</div>
            <div className="opacity-70">Score {s.score.toFixed(2)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**`frontend/src/components/ControlsBar.tsx`**
```tsx
import { useTripStore } from '../store/useTripStore';
export function ControlsBar() {
  const replan = useTripStore((s) => s.replan);
  return (
    <div className="bg-white/90 backdrop-blur border-t p-3 flex gap-2">
      <button className="px-3 py-2 border rounded" onClick={() => replan({ atTime: new Date().toISOString(), prefs: { weights: { distance: 1, rating: 1, openNow: 0.6, categoryAffinity: { hiking: 0.7 }, weather: 0.2, crowding: 0.2, cost: 0.2 } }, context: { trafficLevel: 'med' }, candidates: [ { id: 'runyon', name: 'Runyon Canyon', location: { lat: 34.1053, lng: -118.3480 }, categories: ['hiking'], rating: 4.7 }, { id: 'griffith', name: 'Griffith Observatory', location: { lat: 34.1184, lng: -118.3004 }, categories: ['museum','view'], rating: 4.8 } ] })}>
        Re‑solve
      </button>
    </div>
  );
}
```

---

## 6) Infrastructure (Terraform)

**`infra/main.tf`** (single‑stack for clarity)
```hcl
terraform {
  required_version = ">= 1.7.0"
  required_providers { aws = { source = "hashicorp/aws", version = ">= 5.50" } }
}

provider "aws" {
  region = var.region
}

locals { name = "${var.project}-${var.stage}" }

# DynamoDB
resource "aws_dynamodb_table" "trips" {
  name         = "${local.name}-trips"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute { name = "pk" type = "S" }
  attribute { name = "sk" type = "S" }
}

# IAM for Lambdas
resource "aws_iam_role" "lambda_role" {
  name = "${local.name}-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_policy" "lambda_ddb" {
  name   = "${local.name}-ddb-policy"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      { Effect = "Allow", Action = ["dynamodb:GetItem","dynamodb:PutItem","dynamodb:DeleteItem"], Resource = [aws_dynamodb_table.trips.arn] },
      { Effect = "Allow", Action = ["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"], Resource = "*" }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_ddb.arn
}

# Lambda: plan
resource "aws_lambda_function" "plan" {
  function_name = "${local.name}-plan"
  role          = aws_iam_role.lambda_role.arn
  handler       = "plan.handler"
  runtime       = "nodejs20.x"
  filename      = var.plan_bundle
  source_code_hash = filebase64sha256(var.plan_bundle)
  environment { variables = { TRIPS_TABLE = aws_dynamodb_table.trips.name } }
}

# Lambda: trips
resource "aws_lambda_function" "trips" {
  function_name = "${local.name}-trips"
  role          = aws_iam_role.lambda_role.arn
  handler       = "trips.handler"
  runtime       = "nodejs20.x"
  filename      = var.trips_bundle
  source_code_hash = filebase64sha256(var.trips_bundle)
  environment { variables = { TRIPS_TABLE = aws_dynamodb_table.trips.name } }
}

# API Gateway (HTTP API)
resource "aws_apigatewayv2_api" "http" {
  name          = "${local.name}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "plan" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.plan.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "plan" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /plan"
  target    = "integrations/${aws_apigatewayv2_integration.plan.id}"
}

resource "aws_lambda_permission" "apigw_plan" {
  statement_id  = "AllowAPIGwInvokePlan"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.plan.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "trips" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.trips.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "trips_post" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /trips"
  target    = "integrations/${aws_apigatewayv2_integration.trips.id}"
}

resource "aws_apigatewayv2_route" "trips_id" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "ANY /trips/{tripId}"
  target    = "integrations/${aws_apigatewayv2_integration.trips.id}"
}

# S3 bucket for SPA + CloudFront (OAC)
resource "aws_s3_bucket" "spa" { bucket = replace("${local.name}-spa", "_", "-") }
resource "aws_s3_bucket_ownership_controls" "spa" { bucket = aws_s3_bucket.spa.id  rule { object_ownership = "BucketOwnerPreferred" } }
resource "aws_s3_bucket_public_access_block" "spa" { bucket = aws_s3_bucket.spa.id  block_public_acls = true  block_public_policy = true  ignore_public_acls = true  restrict_public_buckets = true }

resource "aws_cloudfront_origin_access_control" "oac" {
  name                   = "${local.name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior       = "always"
  signing_protocol       = "sigv4"
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  default_root_object = "index.html"
  origin {
    domain_name = aws_s3_bucket.spa.bucket_regional_domain_name
    origin_id   = "spa"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }
  default_cache_behavior {
    target_origin_id       = "spa"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    forwarded_values { query_string = true }
  }
  restrictions { geo_restriction { restriction_type = "none" } }
  viewer_certificate { cloudfront_default_certificate = true }
}

# Allow CF to read S3
resource "aws_s3_bucket_policy" "spa" {
  bucket = aws_s3_bucket.spa.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Sid: "AllowCloudFrontRead",
      Effect: "Allow",
      Principal: { Service: "cloudfront.amazonaws.com" },
      Action: ["s3:GetObject"],
      Resource: ["${aws_s3_bucket.spa.arn}/*"],
      Condition: { StringEquals: { "AWS:SourceArn": aws_cloudfront_distribution.cdn.arn } }
    }]
  })
}
```

**`infra/variables.tf`**
```hcl
variable "region" { type = string  default = "us-west-2" }
variable "project" { type = string  default = "daylight" }
variable "stage"   { type = string  default = "dev" }
variable "plan_bundle"  { type = string  description = "Path to plan lambda zip" }
variable "trips_bundle" { type = string  description = "Path to trips lambda zip" }
```

**`infra/outputs.tf`**
```hcl
output "api_url" { value = aws_apigatewayv2_api.http.api_endpoint }
output "cdn_domain" { value = aws_cloudfront_distribution.cdn.domain_name }
output "table_name" { value = aws_dynamodb_table.trips.name }
```

**`infra/README.md`**
```md
# Deploy

1. Build shared & backend bundles:
   ```bash
   npm -w shared run build
   npm -w backend run build
   # produces backend/dist/bundle/{plan,trips}.mjs → zip them:
   zip -j artifacts/plan.zip backend/dist/bundle/plan.mjs
   zip -j artifacts/trips.zip backend/dist/bundle/trips.mjs
   ```
2. Terraform (local backend):
   ```bash
   cd infra
   terraform init
   terraform apply -var="plan_bundle=../artifacts/plan.zip" -var="trips_bundle=../artifacts/trips.zip"
   ```
3. Frontend build & upload:
   ```bash
   npm -w frontend run build
   aws s3 sync frontend/dist s3://$(terraform output -raw table_name | sed 's/-trips$//')-spa
   aws cloudfront create-invalidation --distribution-id $(terraform output -raw cdn_domain) --paths "/*"
   ```
```

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
```

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

## 12) Next steps (scaffold only, don’t implement yet)
- Cognito + RBAC (viewer/editor/owner) with API authorizers.
- Candidate discovery integrations (Places, NPS, weather, AQI, wildfire alerts) via separate Lambdas.
- Solver improvements (time‑windows, OR‑Tools or metaheuristics).
- Offline map regions & background sync; web push for re‑plan suggestions.
- Budget guardrails & printable/shareable trip cards.

