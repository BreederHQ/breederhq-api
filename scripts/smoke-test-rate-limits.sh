#!/usr/bin/env bash
# Smoke test for rate limiting on public portal auth endpoints
# Tests that rate limits prevent brute force attacks

set -e

API_BASE="${API_BASE:-http://localhost:6001}"
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BOLD}Portal Auth Rate Limit Smoke Test${NC}"
echo "API Base: $API_BASE"
echo ""

# Test 1: Login endpoint (5 req/min limit)
echo -e "${BOLD}Test 1: POST /auth/login rate limit (5 req/min)${NC}"
echo "Sending 6 login attempts within 1 minute..."

SUCCESS_COUNT=0
RATE_LIMITED=0

for i in {1..6}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"invalid"}')

  if [ "$HTTP_CODE" = "429" ]; then
    RATE_LIMITED=$((RATE_LIMITED + 1))
    echo -e "  Request $i: ${YELLOW}429 RATE_LIMITED${NC}"
  else
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo -e "  Request $i: $HTTP_CODE (processed)"
  fi

  # Small delay to ensure requests are within the same minute window
  sleep 0.2
done

if [ $RATE_LIMITED -gt 0 ]; then
  echo -e "${GREEN}✓ Login rate limiting active${NC} ($RATE_LIMITED requests blocked)"
else
  echo -e "${RED}✗ Login rate limiting NOT working${NC} (expected 429 after 5 requests)"
  exit 1
fi

echo ""

# Test 2: Invite validate endpoint (20 req/min limit)
echo -e "${BOLD}Test 2: GET /portal/invites/:token rate limit (20 req/min)${NC}"
echo "Sending 21 invite validation requests within 1 minute..."

SUCCESS_COUNT=0
RATE_LIMITED=0

for i in {1..21}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "${API_BASE}/api/v1/portal/invites/fake-token-for-test")

  if [ "$HTTP_CODE" = "429" ]; then
    RATE_LIMITED=$((RATE_LIMITED + 1))
    echo -e "  Request $i: ${YELLOW}429 RATE_LIMITED${NC}"
  else
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo -e "  Request $i: $HTTP_CODE (processed)"
  fi

  sleep 0.1
done

if [ $RATE_LIMITED -gt 0 ]; then
  echo -e "${GREEN}✓ Invite validation rate limiting active${NC} ($RATE_LIMITED requests blocked)"
else
  echo -e "${RED}✗ Invite validation rate limiting NOT working${NC} (expected 429 after 20 requests)"
  exit 1
fi

echo ""

# Test 3: Password reset endpoint (5 req/min limit)
echo -e "${BOLD}Test 3: POST /auth/reset-password rate limit (5 req/min)${NC}"
echo "Sending 6 reset password attempts within 1 minute..."

SUCCESS_COUNT=0
RATE_LIMITED=0

for i in {1..6}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/api/v1/auth/reset-password" \
    -H "Content-Type: application/json" \
    -d '{"token":"fake","password":"newpassword123"}')

  if [ "$HTTP_CODE" = "429" ]; then
    RATE_LIMITED=$((RATE_LIMITED + 1))
    echo -e "  Request $i: ${YELLOW}429 RATE_LIMITED${NC}"
  else
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo -e "  Request $i: $HTTP_CODE (processed)"
  fi

  sleep 0.2
done

if [ $RATE_LIMITED -gt 0 ]; then
  echo -e "${GREEN}✓ Reset password rate limiting active${NC} ($RATE_LIMITED requests blocked)"
else
  echo -e "${RED}✗ Reset password rate limiting NOT working${NC} (expected 429 after 5 requests)"
  exit 1
fi

echo ""
echo -e "${GREEN}${BOLD}All rate limit tests passed!${NC}"
echo ""
echo "Note: Rate limits are currently in-memory and will reset when the API restarts."
echo "For production with multiple API instances, configure a shared rate limit store (Redis)."
