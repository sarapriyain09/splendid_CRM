#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-https://democrm.splendidtechnology.co.uk}"
EMAIL="${2:-demo.checker@example.com}"
PASS="${3:-DemoPass2026!}"

TMPDIR="$(mktemp -d)"
COOKIE="$TMPDIR/cookies.txt"
trap 'rm -rf "$TMPDIR"' EXIT

echo "register endpoint:"
curl -sS -X POST "$BASE/api/demo/register" \
  -H 'Content-Type: application/json' \
  --data "{\"name\":\"Demo Visitor\",\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"company\":\"Visitor Co\"}" \
  ; echo

echo "csrf/login:"
CSRF="$(curl -sS -c "$COOKIE" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')"
curl -sS -b "$COOKIE" -c "$COOKIE" -X POST "$BASE/api/auth/callback/credentials" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASS" \
  --data-urlencode "callbackUrl=$BASE/dashboard" \
  --data-urlencode "json=true"

echo
DASH="$(curl -sS -o /dev/null -w '%{http_code}' -b "$COOKIE" "$BASE/dashboard")"
USERS="$(curl -sS -o /dev/null -w '%{http_code}' -b "$COOKIE" "$BASE/api/users")"
echo "dashboard status: $DASH"
echo "users api status: $USERS"
