#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-http://127.0.0.1:3002}"
AUTOMATION_API_KEY="${AUTOMATION_API_KEY:-}"

if [[ -z "${AUTOMATION_API_KEY}" ]]; then
  echo "AUTOMATION_API_KEY is not set"
  exit 1
fi

curl -sS -X POST "${APP_URL}/api/automation/morning-brief-email" \
  -H "Content-Type: application/json" \
  -H "x-automation-key: ${AUTOMATION_API_KEY}" \
  --data '{"force":false}'

echo
