# FE-001 — Integrate Mapbox + Anchors UI

## Goal
Render a Mapbox map in the Planner, allow adding/removing anchors, and show suggestions as pins.

## Steps
1) Install `mapbox-gl` and types; add a MapCanvas component using Mapbox GL JS.
2) Read `VITE_MAPBOX_TOKEN`. If empty, fall back to placeholder (existing behavior).
3) Add `Anchor` type with id/name/start/end/lat/lng/locked and maintain a local list (Zustand store).
4) Render anchors as draggable markers; update their coordinates on drag end.
5) Render suggestions (from `/plan`) as pins; style by score.
6) Simple bounds fit to show all active pins.

## Acceptance Criteria
- When a token is supplied, the map renders with markers for anchors and suggestions.
- Anchors can be added/renamed/removed and dragged; state persists in local store.
- The UI remains responsive; errors are surfaced in a toast or console.

## Files to Touch
- `frontend/src/components/MapCanvas.tsx` (replace stub)
- `frontend/src/types/domain.ts` (add lat/lng to Anchor)
- `frontend/src/lib/store.ts` (new)
- `frontend/src/pages/Plan.tsx` (wire store)
