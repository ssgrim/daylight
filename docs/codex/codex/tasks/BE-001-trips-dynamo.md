# BE-001 — Implement /trips persistence (DynamoDB)

## Goal
Persist trip creation to DynamoDB and allow fetching a trip by id.

## Steps
1) Add DynamoDB DocumentClient in `backend/src/lib/db.ts` with table from env `TABLE_TRIPS`.
2) Update `POST /trips` to validate payload `{ tripId, name?, anchors? }` and put item.
3) Add `GET /trips?tripId=...` to retrieve and return the trip (update TF for route + permission).

## Acceptance Criteria
- `POST /trips` writes an item; 200 response returns `{ ok: true, tripId }`.
- `GET /trips?tripId=x` returns stored item; 404 if not found.
- Unit tests mock DynamoDB and cover success/error paths.

## Files to Touch
- `backend/src/handlers/trips.ts`
- `backend/src/lib/db.ts` (new)
- Terraform: add GET /trips route + lambda permission
