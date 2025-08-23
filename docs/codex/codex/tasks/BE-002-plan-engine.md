# BE-002 — Suggestion assembly using scoring engine

## Goal
Use anchors + mock candidates + weights to produce scored suggestions per OpenAPI.

## Steps
1) Define `Weights` and `Candidate` interfaces in `engine.ts` (already stubbed).
2) Accept `tripId` and optional `now` in `/plan` and fetch anchors (for window fit).
3) Assemble mock candidates; compute comfortIndex/windowFit; call `scoreCandidate`.
4) Return suggestions sorted by score.

## Acceptance Criteria
- `/plan` honors trip preferences and anchors if present.
- Scores are stable and deterministic for same inputs.
- Unit tests for `scoreCandidate` and handler mapping.

## Files to Touch
- `backend/src/lib/engine.ts`
- `backend/src/handlers/plan.ts`
