#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-http://127.0.0.1:3002}"
AUTOMATION_API_KEY="${AUTOMATION_API_KEY:-}"
TARGET_COUNT="${TARGET_COUNT:-150}"

if [[ -z "${AUTOMATION_API_KEY}" ]]; then
  echo "AUTOMATION_API_KEY is not set"
  exit 1
fi

curl -sS -X POST "${APP_URL}/api/automation/linkedin-campaign" \
  -H "Content-Type: application/json" \
  -H "x-automation-key: ${AUTOMATION_API_KEY}" \
  --data "{\"targetCount\":${TARGET_COUNT}}"

echo
