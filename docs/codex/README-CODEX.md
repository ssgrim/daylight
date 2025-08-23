# Daylight Codex Pack

Drop these assets into your AI codegen workflow ("Codex").

## Files
- `prompts/daylight_master_prompt.md` — your master prompt for the AI assistant.
- `codex/codex.yaml` — task list and acceptance criteria.
- `codex/tasks/*.md` — granular tasks to execute in order.
- `openapi/daylight.v1.yaml` — canonical API contract.
- `schemas/*.json` — data shapes for DynamoDB and domain objects.

## How to use
1. Paste **prompts/daylight_master_prompt.md** into your AI assistant.
2. Provide **openapi/daylight.v1.yaml** so codegen keeps FE/BE aligned.
3. Work through **codex/tasks/** in order; after each task, run builds/tests.
4. Keep the already-provided scaffold (frontend/backend/infra) in a Git repo so Codex can edit files.

## Notes
- If your AI can attach files, attach the OpenAPI + Schemas.
- If not, paste key sections inline.
- Re-run Codex per task and insist on tests + acceptance criteria before moving on.
