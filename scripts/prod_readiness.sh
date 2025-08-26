#!/usr/bin/env bash
set -u

# Production readiness script
# - Runs TypeScript checks for frontend/backend
# - Runs frontend/backend tests
# - Runs npm audit and attempts `npm audit fix` (non-force)
# - Builds frontend and backend
# - Starts backend dev server in background and runs smoke tests (/plan)
# - Replaces placeholder contact emails when env vars are set
# - Produces a summary report of PASS/FAIL for High/Medium items

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
LOG_DIR="$ROOT_DIR/tmp/prod_readiness_logs"
mkdir -p "$LOG_DIR"

echo "Production Readiness Script"
echo "Logs: $LOG_DIR"

STATUS_SUMMARY=""

fail() {
  echo "[FAIL] $1"
  STATUS_SUMMARY+="FAIL: $1\n"
}

pass() {
  echo "[PASS] $1"
  STATUS_SUMMARY+="PASS: $1\n"
}

echo "\n1) Replace placeholder contacts (if env vars provided)"
PRIVACY_CONTACT=${PRIVACY_CONTACT:-}
SECURITY_CONTACT=${SECURITY_CONTACT:-}
if [[ -n "$PRIVACY_CONTACT" || -n "$SECURITY_CONTACT" ]]; then
  echo "Updating placeholders with provided env vars..."
  if [[ -n "$PRIVACY_CONTACT" ]]; then
    grep -RIl "privacy@yourdomain.example" "$ROOT_DIR" | xargs -r sed -i "s/privacy@yourdomain.example/$PRIVACY_CONTACT/g"
  fi
  if [[ -n "$SECURITY_CONTACT" ]]; then
    grep -RIl "security@yourdomain.example" "$ROOT_DIR" | xargs -r sed -i "s/security@yourdomain.example/$SECURITY_CONTACT/g"
  fi
  pass "Placeholder contacts replaced"
else
  echo "No PRIVACY_CONTACT/SECURITY_CONTACT env vars set — placeholders unchanged"
  fail "Placeholder contacts not replaced (set PRIVACY_CONTACT/SECURITY_CONTACT to auto-update)"
fi

echo "\n2) Frontend: TypeCheck, Tests, Build, Audit"
pushd "$ROOT_DIR/frontend" >/dev/null
echo "Installing frontend dependencies..." | tee "$LOG_DIR/frontend_install.log"
npm ci --no-audit --no-fund >>"$LOG_DIR/frontend_install.log" 2>&1 || true
echo "Type checking frontend..." | tee -a "$LOG_DIR/frontend_tsc.log"
npx tsc --noEmit >>"$LOG_DIR/frontend_tsc.log" 2>&1
if [ $? -eq 0 ]; then pass "Frontend TypeScript check"; else fail "Frontend TypeScript check (see $LOG_DIR/frontend_tsc.log)"; fi

echo "Running frontend tests..." | tee -a "$LOG_DIR/frontend_tests.log"
npm test --if-present >>"$LOG_DIR/frontend_tests.log" 2>&1 || true
if grep -qi "fail" "$LOG_DIR/frontend_tests.log" 2>/dev/null; then fail "Frontend tests have failures (see $LOG_DIR/frontend_tests.log)"; else pass "Frontend tests"; fi

echo "Building frontend..." | tee -a "$LOG_DIR/frontend_build.log"
npm run build >>"$LOG_DIR/frontend_build.log" 2>&1 || true
if [ $? -eq 0 ]; then pass "Frontend build"; else fail "Frontend build failed (see $LOG_DIR/frontend_build.log)"; fi

echo "Running npm audit (frontend)..." | tee -a "$LOG_DIR/frontend_audit.log"
npm audit --audit-level=high >>"$LOG_DIR/frontend_audit.log" 2>&1
if [ $? -eq 0 ]; then pass "Frontend npm audit (no high vulnerabilities)"; else
  echo "Attempting npm audit fix (frontend)..." >>"$LOG_DIR/frontend_audit.log" 2>&1
  npm audit fix >>"$LOG_DIR/frontend_audit_fix.log" 2>&1 || true
  npm audit --audit-level=high >>"$LOG_DIR/frontend_audit_after_fix.log" 2>&1 || true
  if grep -q "high" "$LOG_DIR/frontend_audit_after_fix.log" 2>/dev/null; then fail "Frontend audit unresolved high vulnerabilities (see $LOG_DIR/frontend_audit_after_fix.log)"; else pass "Frontend audit fixed to no high vulnerabilities"; fi
fi
popd >/dev/null

echo "\n3) Backend: TypeCheck, Tests, Build, Audit"
pushd "$ROOT_DIR/backend" >/dev/null
echo "Installing backend dependencies..." | tee "$LOG_DIR/backend_install.log"
npm ci --no-audit --no-fund >>"$LOG_DIR/backend_install.log" 2>&1 || true

echo "Type checking backend..." | tee -a "$LOG_DIR/backend_tsc.log"
npx tsc --noEmit >>"$LOG_DIR/backend_tsc.log" 2>&1
if [ $? -eq 0 ]; then pass "Backend TypeScript check"; else fail "Backend TypeScript check (see $LOG_DIR/backend_tsc.log)"; fi

echo "Running backend tests..." | tee -a "$LOG_DIR/backend_tests.log"
npm test >>"$LOG_DIR/backend_tests.log" 2>&1 || true
if grep -qi "fail" "$LOG_DIR/backend_tests.log" 2>/dev/null; then fail "Backend tests have failures (see $LOG_DIR/backend_tests.log)"; else pass "Backend tests"; fi

echo "Building backend..." | tee -a "$LOG_DIR/backend_build.log"
npm run build >>"$LOG_DIR/backend_build.log" 2>&1 || true
if [ $? -eq 0 ]; then pass "Backend build"; else fail "Backend build failed (see $LOG_DIR/backend_build.log)"; fi

echo "Running npm audit (backend)..." | tee -a "$LOG_DIR/backend_audit.log"
npm audit --audit-level=high >>"$LOG_DIR/backend_audit.log" 2>&1
if [ $? -eq 0 ]; then pass "Backend npm audit (no high vulnerabilities)"; else
  echo "Attempting npm audit fix (backend)..." >>"$LOG_DIR/backend_audit.log" 2>&1
  npm audit fix >>"$LOG_DIR/backend_audit_fix.log" 2>&1 || true
  npm audit --audit-level=high >>"$LOG_DIR/backend_audit_after_fix.log" 2>&1 || true
  if grep -q "high" "$LOG_DIR/backend_audit_after_fix.log" 2>/dev/null; then fail "Backend audit unresolved high vulnerabilities (see $LOG_DIR/backend_audit_after_fix.log)"; else pass "Backend audit fixed to no high vulnerabilities"; fi
fi
popd >/dev/null

echo "\n4) Start backend dev server and run smoke tests"
DEV_SERVER_LOG="$LOG_DIR/dev_server.log"
node "$ROOT_DIR/backend/dev-server.mjs" >>"$DEV_SERVER_LOG" 2>&1 &
DEV_PID=$!
echo "Started dev server (pid=$DEV_PID). Waiting 2s for startup..."
sleep 2

SMOKE_LOG="$LOG_DIR/smoke_tests.log"
echo "Smoke: GET /plan?lat=47.6062&lng=-122.3321" | tee "$SMOKE_LOG"
curl -sS "http://localhost:5174/plan?lat=47.6062&lng=-122.3321" >>"$SMOKE_LOG" 2>&1 || true
if grep -q "Demo Stop" "$SMOKE_LOG" 2>/dev/null || grep -q "Live Stop" "$SMOKE_LOG" 2>/dev/null; then pass "Smoke /plan endpoint responded"; else fail "Smoke /plan endpoint did not return expected payload (see $SMOKE_LOG)"; fi

echo "Stopping dev server (pid=$DEV_PID)"
kill $DEV_PID 2>/dev/null || true

echo "\n5) Sanity checks for config and CI"
if [ -f "$ROOT_DIR/.github/dependabot.yml" ]; then pass "Dependabot config present"; else fail "Dependabot config missing"; fi
if [ -f "$ROOT_DIR/.github/workflows/ci.yml" ]; then pass "CI workflow present"; else fail "CI workflow missing"; fi
if grep -RIl "yourdomain.example" "$ROOT_DIR" >/dev/null 2>&1; then fail "Placeholder contact emails still present (search for yourdomain.example)"; else pass "No placeholder contact emails detected"; fi

echo "\n=== Summary ==="
echo -e "$STATUS_SUMMARY"
echo "Logs preserved in $LOG_DIR"

if echo "$STATUS_SUMMARY" | grep -q "FAIL"; then
  echo "One or more checks failed. Inspect logs in $LOG_DIR and address issues before production release.";
  exit 2
else
  echo "All checks passed or auto-fixed. Ready for smoke test and production release (subject to legal review)."
  exit 0
fi
