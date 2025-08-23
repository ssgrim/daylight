# CI-001 — GitHub Actions pipeline

## Goal
Lint, test, and build on PR; deploy on main (backend zip + Terraform plan/apply; frontend build + S3 sync).

## Steps
1) Add Node setup workflow to install deps and run `npm run build` in both `frontend` and `backend`.
2) Add Terraform workflow that runs `fmt`, `init`, `validate`, and `plan` on PR.
3) Add deploy job (manual or on push to main) to package backend, apply TF, build frontend, and sync to S3.

## Acceptance Criteria
- On PR: node job + TF plan complete.
- On main: deploy job runs (can be disabled if secrets missing).

## Files
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
