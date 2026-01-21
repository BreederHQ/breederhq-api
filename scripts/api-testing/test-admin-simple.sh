#!/bin/bash
# Test Admin Dashboard (Simple version)
# Uses existing data in database, avoids rate limits on data creation

set -e

API_URL="http://marketplace.breederhq.test:6001/api/v1/marketplace"
TIMESTAMP=$(date +%s)
ADMIN_EMAIL="admin-simple-${TIMESTAMP}@example.com"

echo "=========================================="
echo "Testing Admin Dashboard (Simple)"
echo "=========================================="
echo ""

# Setup: Create and promote admin user
echo "Step 1: Create and promote admin user..."
curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -c admin-cookies.txt \
  -d "{
    \"email\": \"${ADMIN_EMAIL}\",
    \"password\": \"adminpass123\",
    \"firstName\": \"Admin\",
    \"lastName\": \"User\"
  }" > /dev/null

ADMIN_CSRF=$(grep 'XSRF-TOKEN' admin-cookies.txt | awk -F'\t' '{print $NF}')

# Promote to admin
npx tsx scripts/promote-admin.ts "$ADMIN_EMAIL"
echo "Admin user ready: $ADMIN_EMAIL"
echo ""

# Test 1: Admin Stats
echo "Test 1: Get Admin Stats"
echo "-----------------------"
curl -s -X GET "${API_URL}/admin/stats" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-stats.json

if grep -q '"ok":true' admin-stats.json; then
  echo "Admin stats retrieved"
  echo "Stats: $(cat admin-stats.json | head -c 400)"
  echo ""
else
  echo "FAILED:"
  cat admin-stats.json
fi
echo ""

# Test 2: List Providers
echo "Test 2: List Providers"
echo "----------------------"
curl -s -X GET "${API_URL}/admin/providers?limit=5" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-providers.json

if grep -q '"ok":true' admin-providers.json; then
  TOTAL=$(grep -o '"total":[0-9]*' admin-providers.json | head -1 | cut -d: -f2)
  echo "Providers listed (total: $TOTAL)"
else
  echo "FAILED:"
  cat admin-providers.json
fi
echo ""

# Test 3: List Listings
echo "Test 3: List Listings"
echo "---------------------"
curl -s -X GET "${API_URL}/admin/listings?limit=5" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-listings.json

if grep -q '"ok":true' admin-listings.json; then
  TOTAL=$(grep -o '"total":[0-9]*' admin-listings.json | head -1 | cut -d: -f2)
  echo "Listings listed (total: $TOTAL)"
else
  echo "FAILED:"
  cat admin-listings.json
fi
echo ""

# Test 4: List Transactions
echo "Test 4: List Transactions"
echo "-------------------------"
curl -s -X GET "${API_URL}/admin/transactions?limit=5" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-transactions.json

if grep -q '"ok":true' admin-transactions.json; then
  TOTAL=$(grep -o '"total":[0-9]*' admin-transactions.json | head -1 | cut -d: -f2)
  echo "Transactions listed (total: $TOTAL)"
else
  echo "FAILED:"
  cat admin-transactions.json
fi
echo ""

# Test 5: List Reviews
echo "Test 5: List Reviews"
echo "--------------------"
curl -s -X GET "${API_URL}/admin/reviews?limit=5" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-reviews.json

if grep -q '"ok":true' admin-reviews.json; then
  TOTAL=$(grep -o '"total":[0-9]*' admin-reviews.json | head -1 | cut -d: -f2)
  echo "Reviews listed (total: $TOTAL)"
else
  echo "FAILED:"
  cat admin-reviews.json
fi
echo ""

# Test 6: List Users
echo "Test 6: List Users"
echo "------------------"
curl -s -X GET "${API_URL}/admin/users?limit=5" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-users.json

if grep -q '"ok":true' admin-users.json; then
  TOTAL=$(grep -o '"total":[0-9]*' admin-users.json | head -1 | cut -d: -f2)
  echo "Users listed (total: $TOTAL)"
else
  echo "FAILED:"
  cat admin-users.json
fi
echo ""

# Test 7: Filter providers by status
echo "Test 7: Filter Providers by Status"
echo "-----------------------------------"
curl -s -X GET "${API_URL}/admin/providers?status=active&limit=3" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-filter.json

if grep -q '"ok":true' admin-filter.json; then
  echo "Provider filter working"
else
  echo "FAILED:"
  cat admin-filter.json
fi
echo ""

# Test 8: Search providers
echo "Test 8: Search Providers"
echo "------------------------"
curl -s -X GET "${API_URL}/admin/providers?search=test&limit=3" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-search.json

if grep -q '"ok":true' admin-search.json; then
  echo "Provider search working"
else
  echo "FAILED:"
  cat admin-search.json
fi
echo ""

# Test 9: Get provider detail (first provider from list)
echo "Test 9: Get Provider Detail"
echo "---------------------------"
FIRST_PROVIDER_ID=$(grep -o '"id":[0-9]*' admin-providers.json | head -1 | cut -d: -f2)
if [ -n "$FIRST_PROVIDER_ID" ]; then
  curl -s -X GET "${API_URL}/admin/providers/${FIRST_PROVIDER_ID}" \
    -H "X-CSRF-Token: $ADMIN_CSRF" \
    -b admin-cookies.txt > admin-provider-detail.json

  if grep -q '"ok":true' admin-provider-detail.json; then
    echo "Provider detail retrieved (ID: $FIRST_PROVIDER_ID)"
  else
    echo "FAILED:"
    cat admin-provider-detail.json
  fi
else
  echo "Skipped (no providers)"
fi
echo ""

# Test 10: Get listing detail (first listing from list)
echo "Test 10: Get Listing Detail"
echo "---------------------------"
FIRST_LISTING_ID=$(grep -o '"id":[0-9]*' admin-listings.json | head -1 | cut -d: -f2)
if [ -n "$FIRST_LISTING_ID" ]; then
  curl -s -X GET "${API_URL}/admin/listings/${FIRST_LISTING_ID}" \
    -H "X-CSRF-Token: $ADMIN_CSRF" \
    -b admin-cookies.txt > admin-listing-detail.json

  if grep -q '"ok":true' admin-listing-detail.json; then
    echo "Listing detail retrieved (ID: $FIRST_LISTING_ID)"
  else
    echo "FAILED:"
    cat admin-listing-detail.json
  fi
else
  echo "Skipped (no listings)"
fi
echo ""

# Test 11: Get transaction detail (first transaction from list)
echo "Test 11: Get Transaction Detail"
echo "--------------------------------"
FIRST_TRANS_ID=$(grep -o '"id":"[0-9]*"' admin-transactions.json | head -1 | sed 's/"id":"//;s/"$//')
if [ -n "$FIRST_TRANS_ID" ]; then
  curl -s -X GET "${API_URL}/admin/transactions/${FIRST_TRANS_ID}" \
    -H "X-CSRF-Token: $ADMIN_CSRF" \
    -b admin-cookies.txt > admin-trans-detail.json

  if grep -q '"ok":true' admin-trans-detail.json; then
    echo "Transaction detail retrieved (ID: $FIRST_TRANS_ID)"
  else
    echo "FAILED:"
    cat admin-trans-detail.json
  fi
else
  echo "Skipped (no transactions)"
fi
echo ""

# Test 12: Get review detail (first review from list)
echo "Test 12: Get Review Detail"
echo "--------------------------"
FIRST_REVIEW_ID=$(grep -o '"id":[0-9]*' admin-reviews.json | head -1 | cut -d: -f2)
if [ -n "$FIRST_REVIEW_ID" ]; then
  curl -s -X GET "${API_URL}/admin/reviews/${FIRST_REVIEW_ID}" \
    -H "X-CSRF-Token: $ADMIN_CSRF" \
    -b admin-cookies.txt > admin-review-detail.json

  if grep -q '"ok":true' admin-review-detail.json; then
    echo "Review detail retrieved (ID: $FIRST_REVIEW_ID)"
  else
    echo "FAILED:"
    cat admin-review-detail.json
  fi
else
  echo "Skipped (no reviews)"
fi
echo ""

# Test 13: Get user detail (first user from list)
echo "Test 13: Get User Detail"
echo "------------------------"
FIRST_USER_ID=$(grep -o '"id":[0-9]*' admin-users.json | head -1 | cut -d: -f2)
if [ -n "$FIRST_USER_ID" ]; then
  curl -s -X GET "${API_URL}/admin/users/${FIRST_USER_ID}" \
    -H "X-CSRF-Token: $ADMIN_CSRF" \
    -b admin-cookies.txt > admin-user-detail.json

  if grep -q '"ok":true' admin-user-detail.json; then
    echo "User detail retrieved (ID: $FIRST_USER_ID)"
  else
    echo "FAILED:"
    cat admin-user-detail.json
  fi
else
  echo "Skipped (no users)"
fi
echo ""

# Cleanup
rm -f admin-cookies.txt admin-stats.json admin-providers.json admin-listings.json
rm -f admin-transactions.json admin-reviews.json admin-users.json admin-filter.json
rm -f admin-search.json admin-provider-detail.json admin-listing-detail.json
rm -f admin-trans-detail.json admin-review-detail.json admin-user-detail.json

echo "=========================================="
echo "ADMIN DASHBOARD TESTS COMPLETE"
echo "=========================================="
echo ""
echo "Summary - Tested endpoints:"
echo "  GET  /admin/stats"
echo "  GET  /admin/providers (list + filter + search)"
echo "  GET  /admin/providers/:id"
echo "  GET  /admin/listings"
echo "  GET  /admin/listings/:id"
echo "  GET  /admin/transactions"
echo "  GET  /admin/transactions/:id"
echo "  GET  /admin/reviews"
echo "  GET  /admin/reviews/:id"
echo "  GET  /admin/users"
echo "  GET  /admin/users/:id"
echo ""
echo "Note: Action endpoints (suspend, unpublish, flag, etc.)"
echo "can be tested with the full test-admin.sh script"
echo "when rate limits are cleared."
echo ""
