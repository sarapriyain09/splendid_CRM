#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-https://demo.crm.splendidtechnology.co.uk}"
EMAIL="${2:-admin@splendidtechnology.co.uk}"
PASSWORD="${3:-Splendid2024!}"

TMPDIR="$(mktemp -d)"
COOKIE="$TMPDIR/cookies.txt"
HEADERS="$TMPDIR/headers.txt"
LOGIN_BODY="$TMPDIR/login-body.txt"
USERS_BODY="$TMPDIR/users-body.txt"
trap 'rm -rf "$TMPDIR"' EXIT

echo "TLS check"
curl -sS -I "$BASE/login" | sed -n '1,8p'
echo "---"

CSRF_JSON="$(curl -sS -c "$COOKIE" "$BASE/api/auth/csrf")"
CSRF="$(printf '%s' "$CSRF_JSON" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')"
if [[ -z "$CSRF" ]]; then
  echo "Failed to parse csrf token"
  echo "$CSRF_JSON"
  exit 1
fi
echo "csrf token acquired"
echo "---"

LOGIN_CODE="$(curl -sS -o "$LOGIN_BODY" -D "$HEADERS" -b "$COOKIE" -c "$COOKIE" \
  -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASSWORD" \
  --data-urlencode "callbackUrl=$BASE/dashboard" \
  --data-urlencode "json=true" \
  -w '%{http_code}')"

echo "login status: $LOGIN_CODE"
sed -n '1,14p' "$HEADERS"
echo "login body:"
sed -n '1,5p' "$LOGIN_BODY"
echo "---"

DASH_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -b "$COOKIE" "$BASE/dashboard")"
echo "dashboard status: $DASH_CODE"

echo "settings headers:"
curl -sS -I -b "$COOKIE" "$BASE/settings" | sed -n '1,12p'

USERS_CODE="$(curl -sS -o "$USERS_BODY" -w '%{http_code}' -b "$COOKIE" "$BASE/api/users")"
echo "users api status: $USERS_CODE"
echo "users api body:"
sed -n '1,5p' "$USERS_BODY"
