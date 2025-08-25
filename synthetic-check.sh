#!/usr/bin/env bash
# Synthetic check for Daylight frontend
# Usage: ./synthetic-check.sh <url> <slack-webhook-url>

set -euo pipefail
URL="$1"
SLACK_WEBHOOK="$2"

if ! command -v curl >/dev/null; then
  echo "curl is required" >&2
  exit 1
fi

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
if [ "$RESPONSE" != "200" ]; then
  MSG="Daylight synthetic check FAILED: $URL returned $RESPONSE"
  echo "$MSG"
  if [ -n "$SLACK_WEBHOOK" ]; then
    curl -X POST -H 'Content-type: application/json' --data "{\"text\":\"$MSG\"}" "$SLACK_WEBHOOK"
  fi
  exit 2
else
  echo "Daylight synthetic check OK: $URL returned $RESPONSE"
fi
