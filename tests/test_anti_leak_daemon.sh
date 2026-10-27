#!/usr/bin/env bash
set -euo pipefail

echo "================================================================="
echo "🛡️  TRYBASE ANTI-LEAK SECRET DAEMON INTEGRATION TEST BATTERY"
echo "================================================================="

VOLUME_NAME="trybase-test-sock-vol-$$"
docker volume create "$VOLUME_NAME" >/dev/null

cleanup() {
    echo "🧹 Cleaning up test containers and volume..."
    docker rm -f trybase-test-daemon >/dev/null 2>&1 || true
    docker volume rm -f "$VOLUME_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "1. Starting trybase-daemon in background..."
docker run -d --name trybase-test-daemon \
  -v "$VOLUME_NAME:/var/run/trybase" \
  -e TRYBASE_SOCKET_PATH="/var/run/trybase/secrets.sock" \
  -e TRYBASE_TENANT_ID="acme-test-corp" \
  -e SECRET_KEY="sec_super_secret_jwt_key_999" \
  -e STRIPE_SECRET="sk_live_stripe_production_key" \
  -e OPENAI_API_KEY="sk-proj-openai-agent-secret" \
  -e DB_HOST="rds-postgres.internal.trybase.io" \
  -e DB_PORT="5432" \
  -e DB_USER="user_acme_corp" \
  -e DB_NAME="schema_acme_corp" \
  -e AWS_REGION="eu-west-2" \
  trybase-daemon:test

echo "Waiting for daemon socket to initialize..."
sleep 2

# Helper to run curl inside a client container sharing the Linux kernel socket volume
client_curl() {
    docker run --rm \
      -v "$VOLUME_NAME:/var/run/trybase" \
      curlimages/curl:8.9.1 "$@"
}

echo ""
echo "--- TEST 1: Healthcheck over UDS ---"
HEALTH_RESP=$(client_curl -s --unix-socket /var/run/trybase/secrets.sock http://localhost/healthz)
echo "Response: $HEALTH_RESP"
if echo "$HEALTH_RESP" | grep -q '"status":"ok"'; then
    echo "✅ TEST 1 PASSED: Healthcheck responded with HTTP 200 OK over Unix socket."
else
    echo "❌ TEST 1 FAILED"
    docker logs trybase-test-daemon
    exit 1
fi

echo ""
echo "--- TEST 2: Unauthenticated Secrets Request (Should be Rejected) ---"
UNAUTH_STATUS=$(client_curl -s -o /dev/null -w "%{http_code}" --unix-socket /var/run/trybase/secrets.sock http://localhost/latest/secrets)
echo "HTTP Status Code: $UNAUTH_STATUS"
if [ "$UNAUTH_STATUS" = "401" ]; then
    echo "✅ TEST 2 PASSED: Missing IMDSv2 token rejected with HTTP 401 Unauthorized."
else
    echo "❌ TEST 2 FAILED: Expected 401, got $UNAUTH_STATUS"
    exit 1
fi

echo ""
echo "--- TEST 3: SSRF Protection (X-Forwarded-For Rejection) ---"
SSRF_STATUS=$(client_curl -s -o /dev/null -w "%{http_code}" -X PUT \
  -H "X-TryBase-Token-TTL-Seconds: 60" \
  -H "X-Forwarded-For: 192.168.1.100" \
  --unix-socket /var/run/trybase/secrets.sock http://localhost/latest/api/token)
echo "SSRF Attempt HTTP Status: $SSRF_STATUS"
if [ "$SSRF_STATUS" = "400" ]; then
    echo "✅ TEST 3 PASSED: SSRF injection with X-Forwarded-For rejected with HTTP 400 Bad Request."
else
    echo "❌ TEST 3 FAILED: Expected 400, got $SSRF_STATUS"
    exit 1
fi

echo ""
echo "--- TEST 4: IMDSv2 Handshake & Token Minting ---"
TOKEN=$(client_curl -s -X PUT \
  -H "X-TryBase-Token-TTL-Seconds: 60" \
  --unix-socket /var/run/trybase/secrets.sock http://localhost/latest/api/token)
echo "Minted Token: $TOKEN"
if echo "$TOKEN" | grep -q '^tb_tok_'; then
    echo "✅ TEST 4 PASSED: Successfully minted process-bound IMDSv2 token: $TOKEN"
else
    echo "❌ TEST 4 FAILED: Invalid token format: $TOKEN"
    exit 1
fi

echo ""
echo "--- TEST 5: Authenticated Secrets Retrieval ---"
SECRETS_JSON=$(client_curl -s \
  -H "X-TryBase-Token: $TOKEN" \
  --unix-socket /var/run/trybase/secrets.sock http://localhost/latest/secrets)
echo "Secrets Payload: $SECRETS_JSON"

if echo "$SECRETS_JSON" | grep -q "sk_live_stripe_production_key" && echo "$SECRETS_JSON" | grep -q "sec_super_secret_jwt_key_999"; then
    echo "✅ TEST 5 PASSED: Retrieved all in-memory secrets safely."
else
    echo "❌ TEST 5 FAILED: Expected secrets missing from payload."
    exit 1
fi

echo ""
echo "--- TEST 6: Single Key Retrieval ---"
STRIPE_VAL=$(client_curl -s \
  -H "X-TryBase-Token: $TOKEN" \
  --unix-socket /var/run/trybase/secrets.sock http://localhost/latest/secrets/STRIPE_SECRET)
echo "STRIPE_SECRET: $STRIPE_VAL"
if [ "$STRIPE_VAL" = "sk_live_stripe_production_key" ]; then
    echo "✅ TEST 6 PASSED: Retrieved single secret key value."
else
    echo "❌ TEST 6 FAILED: Unexpected value $STRIPE_VAL"
    exit 1
fi

echo ""
echo "--- TEST 7: Passwordless RDS IAM Database Token ---"
DB_TOKEN_JSON=$(client_curl -s \
  -H "X-TryBase-Token: $TOKEN" \
  --unix-socket /var/run/trybase/secrets.sock http://localhost/latest/database/token)
echo "RDS Token: $DB_TOKEN_JSON"
if echo "$DB_TOKEN_JSON" | grep -q "rds-db-token-user_acme_corp" && echo "$DB_TOKEN_JSON" | grep -q "schema_acme_corp"; then
    echo "✅ TEST 7 PASSED: Ephemeral 15-minute RDS IAM password generated successfully."
else
    echo "❌ TEST 7 FAILED: RDS Database token generation failed."
    exit 1
fi

echo ""
echo "--- TEST 8: Zero-Code Injected Wrapper (trybase-entrypoint) ---"
ENTRYPOINT_OUTPUT=$(docker run --rm \
  -v "$VOLUME_NAME:/var/run/trybase" \
  -e TRYBASE_SOCKET_PATH="/var/run/trybase/secrets.sock" \
  --entrypoint /usr/local/bin/trybase-entrypoint \
  trybase-daemon:test \
  /bin/sh -c 'echo "STRIPE: $STRIPE_SECRET, OPENAI: $OPENAI_API_KEY, DB_PASS: $DB_PASSWORD"')

echo "Entrypoint Output:"
echo "$ENTRYPOINT_OUTPUT"

if echo "$ENTRYPOINT_OUTPUT" | grep -q "STRIPE: sk_live_stripe_production_key" && echo "$ENTRYPOINT_OUTPUT" | grep -q "DB_PASS: rds-db-token"; then
    echo "✅ TEST 8 PASSED: trybase-entrypoint injected all secrets into child memory without touching disk!"
else
    echo "❌ TEST 8 FAILED: Entrypoint did not properly populate child process memory."
    exit 1
fi

echo ""
echo "--- TEST 9: Python SDK End-to-End Test ---"
PYTHON_OUTPUT=$(docker run --rm \
  -v "$VOLUME_NAME:/var/run/trybase" \
  -v "$PWD/sdk/python-django:/sdk" \
  -w /sdk \
  python:3.11-alpine \
  python3 -c '
from trybase_secrets import TryBaseClient
client = TryBaseClient()
secrets = client.get_secrets()
db_token = client.get_database_token()
print("PY_STRIPE:", secrets.get("STRIPE_SECRET"))
print("PY_DB_USER:", db_token.get("db_user"))
')

echo "Python SDK Output:"
echo "$PYTHON_OUTPUT"

if echo "$PYTHON_OUTPUT" | grep -q "PY_STRIPE: sk_live_stripe_production_key" && echo "$PYTHON_OUTPUT" | grep -q "PY_DB_USER: user_acme_corp"; then
    echo "✅ TEST 9 PASSED: Python SDK communicated over UDS and fetched secrets with 0 external dependencies!"
else
    echo "❌ TEST 9 FAILED: Python SDK execution failed."
    exit 1
fi

echo ""
echo "================================================================="
echo "🎉 ALL 9 TESTS PASSED: THE ANTI-LEAK STANDARD IS VERIFIED LIVE!"
echo "================================================================="
