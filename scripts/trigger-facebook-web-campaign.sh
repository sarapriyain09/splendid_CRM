#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-http://127.0.0.1:3002}"
AUTOMATION_API_KEY="${AUTOMATION_API_KEY:-}"
DURATION_DAYS="${DURATION_DAYS:-90}"

if [[ -z "${AUTOMATION_API_KEY}" ]]; then
  echo "AUTOMATION_API_KEY is not set"
  exit 1
fi

curl -sS -X POST "${APP_URL}/api/automation/facebook-web-campaign" \
  -H "Content-Type: application/json" \
  -H "x-automation-key: ${AUTOMATION_API_KEY}" \
  --data "{\"durationDays\":${DURATION_DAYS},\"weekdaysOnly\":true}"

echo
