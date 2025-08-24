#!/usr/bin/env bash
set -euo pipefail

# ----- Path setup (works from root or frontend or anywhere) -----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# -------- Settings --------
REGION="${REGION:-us-west-1}"
ACCOUNT_ID="${ACCOUNT_ID:-}"
LAMBDA_NAME="${LAMBDA_NAME:-daylight-places}"
API_NAME="${API_NAME:-daylight-http}"
FRONTEND_DIR="${FRONTEND_DIR:-$REPO_ROOT/frontend}"
SECRET_ARN="${SECRET_ARN:-}"
BACKEND_JS="$REPO_ROOT/backend/places.js"
BUILD_DIR="$REPO_ROOT/build"
BUILD_ZIP="$BUILD_DIR/places.zip"
ART_DIR="$REPO_ROOT/artifacts"
REPORT="$ART_DIR/report.md"
API_JSON="$ART_DIR/api.json"
DEV_API_JSON="$ART_DIR/dev-api.json"
DEV_INDEX_HTML="$ART_DIR/dev-site.html"

mkdir -p "$ART_DIR" "$BUILD_DIR"

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; }
sec()  { echo -e "\n=== $1 ==="; }

echo "# Daylight Smoke Test (DEV) — $(date -u +"%Y-%m-%d %H:%M:%S UTC")" > "$REPORT"

sec "Prerequisites"
command -v aws >/dev/null || { fail "aws CLI missing"; exit 1; }
command -v node >/dev/null || { fail "node missing"; exit 1; }
command -v jq >/dev/null || { fail "jq missing"; exit 1; }
pass "aws/node/jq present"

AWS_ID_JSON=$(aws sts get-caller-identity || true)
[ -z "$AWS_ID_JSON" ] && { fail "AWS auth failed"; exit 1; }
ACCOUNT_ID="${ACCOUNT_ID:-$(echo "$AWS_ID_JSON" | jq -r .Account)}"
pass "AWS account: $ACCOUNT_ID"

sec "Ensure Lambda package ($BACKEND_JS -> $BUILD_ZIP)"
[ -f "$BACKEND_JS" ] || { fail "backend/places.js not found"; exit 1; }

# zip using PowerShell (Windows) or npx bestzip
if command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -Command "Compress-Archive -Force -Path '$BACKEND_JS' -DestinationPath '$BUILD_ZIP'"
else
  npx --yes bestzip "$BUILD_ZIP" "$BACKEND_JS" >/dev/null
fi
[ -f "$BUILD_ZIP" ] && pass "Created $BUILD_ZIP" || { fail "Could not create zip"; exit 1; }

sec "Ensure IAM role daylight-lambda-exec with trust & policies"
TRUST_JSON='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
if ! aws iam get-role --role-name daylight-lambda-exec >/dev/null 2>&1; then
  echo "$TRUST_JSON" > "$REPO_ROOT/.tmp-trust.json"
  aws iam create-role --role-name daylight-lambda-exec --assume-role-policy-document file://"$REPO_ROOT/.tmp-trust.json" >/dev/null
else
  echo "$TRUST_JSON" > "$REPO_ROOT/.tmp-trust.json"
  aws iam update-assume-role-policy --role-name daylight-lambda-exec --policy-document file://"$REPO_ROOT/.tmp-trust.json" >/dev/null
fi
aws iam attach-role-policy --role-name daylight-lambda-exec --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole >/dev/null || true

[ -z "$SECRET_ARN" ] && SECRET_ARN="arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:daylight/dev/google-places-api-key*"
cat > "$REPO_ROOT/.tmp-secret-pol.json" <<POL
{"Version":"2012-10-17","Statement":[
 {"Sid":"ReadPlacesSecret","Effect":"Allow","Action":["secretsmanager:GetSecretValue"],"Resource":"${SECRET_ARN}"},
 {"Sid":"KmsDecrypt","Effect":"Allow","Action":["kms:Decrypt"],"Resource":"*"}]}
POL
aws iam put-role-policy --role-name daylight-lambda-exec --policy-name ReadPlacesSecretInline --policy-document file://"$REPO_ROOT/.tmp-secret-pol.json" >/dev/null
pass "Role configured"

sec "Create or update Lambda ${LAMBDA_NAME}"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/daylight-lambda-exec"
if ! aws lambda get-function --region "$REGION" --function-name "$LAMBDA_NAME" >/dev/null 2>&1; then
  aws lambda create-function --region "$REGION" --function-name "$LAMBDA_NAME" --runtime nodejs18.x --handler places.handler --role "$ROLE_ARN" --zip-file fileb://"$BUILD_ZIP" >/dev/null
  pass "Created Lambda"
else
  aws lambda update-function-code --region "$REGION" --function-name "$LAMBDA_NAME" --zip-file fileb://"$BUILD_ZIP" >/dev/null
  pass "Updated Lambda code"
fi

sec "Ensure HTTP API ${API_NAME} + route GET /api/places"
API_ID=$(aws apigatewayv2 get-apis --region "$REGION" --query "Items[?Name=='${API_NAME}'].ApiId" --output text 2>/dev/null || true)
if [ -z "$API_ID" ] || [ "$API_ID" = "None" ]; then
  API_ID=$(aws apigatewayv2 create-api --region "$REGION" --name "$API_NAME" --protocol-type HTTP --query ApiId --output text)
  pass "Created API ($API_ID)"
fi

LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_NAME}"
INT_ID=$(aws apigatewayv2 create-integration --region "$REGION" --api-id "$API_ID" --integration-type AWS_PROXY --integration-uri "$LAMBDA_ARN" --payload-format-version 2.0 --query IntegrationId --output text 2>/dev/null || true)
aws apigatewayv2 create-route --region "$REGION" --api-id "$API_ID" --route-key "GET /api/places" --target "integrations/$INT_ID" >/dev/null 2>&1 || true
aws lambda add-permission --region "$REGION" --function-name "$LAMBDA_NAME" --statement-id AllowInvokeFromHttpApi$(date +%s) --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/api/places" >/dev/null 2>&1 || true
aws apigatewayv2 create-deployment --region "$REGION" --api-id "$API_ID" >/dev/null
API_URL=$(aws apigatewayv2 get-api --region "$REGION" --api-id "$API_ID" --query ApiEndpoint --output text)
echo "- API_URL: ${API_URL}" >> "$REPORT"
pass "API deployed: $API_URL"

sec "Test backend endpoint"
set +e
HTTP_STATUS=$(curl -s -o "$API_JSON" -w "%{http_code}" "$API_URL/api/places?query=pasadena%20coffee")
set -e
[ "$HTTP_STATUS" = "200" ] && pass "Backend OK (200). Saved to $API_JSON" || fail "Backend returned $HTTP_STATUS"

sec "Build frontend"
if [ -d "$FRONTEND_DIR" ]; then
  pushd "$FRONTEND_DIR" >/dev/null
  echo "VITE_API_BASE=$API_URL" > .env.production
  npm ci || npm install
  npm run build
  popd >/dev/null
  pass "Frontend built"
else
  fail "Frontend dir not found: $FRONTEND_DIR"; exit 1
fi

sec "CORS/header snapshot"
HDRS=$(curl -s -D - "$API_URL/api/places?query=pasadena%20coffee" -o /dev/null | tr -d '\r')
echo -e "```\n$HDRS\n```" >> "$REPORT"
pass "Captured API headers"

sec "Summary"
echo -e "\n## Summary\n- API: ${API_URL}\n- API sample: ${API_JSON}\n- Report: ${REPORT}\n" >> "$REPORT"
pass "Report written to $REPORT"

echo -e "\nDone."
