#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://127.0.0.1:3002"
for p in / /api/contacts /api/activities /api/tasks /api/notes; do
  code=$(curl -s -o /tmp/curl_body -w "%{http_code}" "${BASE_URL}${p}")
  echo "PATH=${p} STATUS=${code}"
  head -c 180 /tmp/curl_body || true
  echo
  echo "---"
done
