#!/usr/bin/env bash
set -euo pipefail

PROFILE=${PROFILE:-daylight}
REGION=${REGION:-us-west-1}
BUCKET=daylight-frontend-us-west-1-tolerant-bug
DIST_ID=E198WHCS50MQR1

pushd /c/Users/mrred/daylight/frontend >/dev/null
echo "Building frontend..."
npm run build

echo "Syncing to S3://$BUCKET ..."
aws s3 sync dist/ s3://$BUCKET --delete --profile "$PROFILE" --region "$REGION"
aws s3 cp dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html" \
  --profile "$PROFILE" --region "$REGION"

echo "Invalidating CloudFront..."
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" --profile "$PROFILE"

echo "Done. Visit: https://d2ve6gb1nuejhg.cloudfront.net"
popd >/dev/null
