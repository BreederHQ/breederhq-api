#!/bin/bash
# Test Admin Dashboard
# Tests: stats, provider management, listing moderation, transaction oversight, review moderation, user management

set -e

API_URL="http://marketplace.breederhq.test:6001/api/v1/marketplace"
TIMESTAMP=$(date +%s)
ADMIN_EMAIL="admin-${TIMESTAMP}@example.com"
PROVIDER_EMAIL="provider-${TIMESTAMP}@example.com"
BUYER_EMAIL="buyer-${TIMESTAMP}@example.com"

echo "=========================================="
echo "Testing Admin Dashboard"
echo "=========================================="
echo ""

# Setup: Create admin user
echo "Step 1: Create admin user..."
curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -c admin-cookies.txt \
  -d "{
    \"email\": \"${ADMIN_EMAIL}\",
    \"password\": \"adminpass123\",
    \"firstName\": \"Admin\",
    \"lastName\": \"User\"
  }" > admin-register.json

ADMIN_CSRF=$(grep 'XSRF-TOKEN' admin-cookies.txt | awk -F'\t' '{print $NF}')
echo "Admin user created: $ADMIN_EMAIL"

# Test 1: Non-admin cannot access admin endpoints
echo ""
echo "Test 1: Access Control - Non-admin Rejected"
echo "---------------------------------------------"
curl -s -X GET "${API_URL}/admin/stats" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-access.json

if grep -q '"error":"forbidden"' admin-access.json; then
  echo "Non-admin correctly rejected with 'forbidden' error"
else
  echo "Response:"
  cat admin-access.json
fi

# Promote user to admin
echo ""
echo "Step 2: Promoting user to admin..."
npx tsx scripts/promote-admin.ts "$ADMIN_EMAIL"

# Setup: Create a provider
echo ""
echo "Step 3: Create test provider..."
curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -c provider-cookies.txt \
  -d "{
    \"email\": \"${PROVIDER_EMAIL}\",
    \"password\": \"testpass123\",
    \"firstName\": \"Test\",
    \"lastName\": \"Provider\"
  }" > /dev/null

PROVIDER_CSRF=$(grep 'XSRF-TOKEN' provider-cookies.txt | awk -F'\t' '{print $NF}')

curl -s -X POST "${API_URL}/providers/register" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "providerType": "groomer",
    "businessName": "Admin Test Provider",
    "businessDescription": "Testing admin features",
    "paymentMode": "manual",
    "paymentInstructions": "Pay via Venmo",
    "city": "Austin",
    "state": "TX",
    "zip": "78701",
    "country": "US"
  }' > provider-register.json

PROVIDER_ID=$(cat provider-register.json | sed 's/.*"provider":{[^}]*"id":\([0-9]*\).*/\1/' | head -1)
echo "Provider created (ID: $PROVIDER_ID)"

# Create listing
curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "title": "Admin Test Service",
    "description": "For admin testing",
    "category": "grooming",
    "priceCents": 5000,
    "priceType": "fixed",
    "priceText": "$50",
    "city": "Austin",
    "state": "TX"
  }' > listing.json

LISTING_ID=$(cat listing.json | grep -o '^{"id":[0-9]*' | cut -d':' -f2)

curl -s -X POST "${API_URL}/listings/${LISTING_ID}/publish" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > /dev/null

echo "Listing created (ID: $LISTING_ID)"

# Create buyer and transaction
echo ""
echo "Step 4: Create buyer and transaction..."
curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -c buyer-cookies.txt \
  -d "{
    \"email\": \"${BUYER_EMAIL}\",
    \"password\": \"testpass123\",
    \"firstName\": \"Test\",
    \"lastName\": \"Buyer\"
  }" > /dev/null

BUYER_CSRF=$(grep 'XSRF-TOKEN' buyer-cookies.txt | awk -F'\t' '{print $NF}')

curl -s -X POST "${API_URL}/transactions" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d "{
    \"serviceListingId\": ${LISTING_ID}
  }" > transaction.json

# Parse transaction ID (handles both quoted and unquoted formats)
TRANSACTION_ID=$(cat transaction.json | grep -o '"id":[^,}]*' | head -1 | sed 's/"id"://;s/"//g')

# Complete transaction for review
curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/mark-paid" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt > /dev/null

curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/confirm-payment" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > /dev/null

curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/complete" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > /dev/null

echo "Transaction created and completed (ID: $TRANSACTION_ID)"

# Create review
curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/review" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d '{
    "rating": 5,
    "title": "Great service!",
    "reviewText": "This provider was excellent."
  }' > review.json

REVIEW_ID=$(cat review.json | grep -o '"review":{"id":[0-9]*' | grep -o '[0-9]*$')
echo "Review created (ID: $REVIEW_ID)"

echo ""
echo "=========================================="
echo "Running Admin Endpoint Tests"
echo "=========================================="

# Test 2: Admin Stats
echo ""
echo "Test 2: Get Admin Stats"
echo "-----------------------"
curl -s -X GET "${API_URL}/admin/stats" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-stats.json

if grep -q '"ok":true' admin-stats.json && grep -q '"stats"' admin-stats.json; then
  echo "Admin stats retrieved successfully"
  cat admin-stats.json | head -c 300
  echo ""
else
  echo "Failed:"
  cat admin-stats.json
fi

# Test 3: List Providers
echo ""
echo "Test 3: List Providers"
echo "----------------------"
curl -s -X GET "${API_URL}/admin/providers" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-providers.json

if grep -q '"ok":true' admin-providers.json && grep -q '"providers"' admin-providers.json; then
  TOTAL=$(grep -o '"total":[0-9]*' admin-providers.json | cut -d: -f2)
  echo "Providers listed (total: $TOTAL)"
else
  echo "Failed:"
  cat admin-providers.json | head -c 200
fi

# Test 4: Get Provider Detail
echo ""
echo "Test 4: Get Provider Detail"
echo "---------------------------"
curl -s -X GET "${API_URL}/admin/providers/${PROVIDER_ID}" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-provider-detail.json

if grep -q '"ok":true' admin-provider-detail.json; then
  echo "Provider detail retrieved"
else
  echo "Failed:"
  cat admin-provider-detail.json | head -c 200
fi

# Test 5: List Listings
echo ""
echo "Test 5: List Listings"
echo "---------------------"
curl -s -X GET "${API_URL}/admin/listings" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-listings.json

if grep -q '"ok":true' admin-listings.json && grep -q '"listings"' admin-listings.json; then
  TOTAL=$(grep -o '"total":[0-9]*' admin-listings.json | cut -d: -f2)
  echo "Listings listed (total: $TOTAL)"
else
  echo "Failed:"
  cat admin-listings.json | head -c 200
fi

# Test 6: List Transactions
echo ""
echo "Test 6: List Transactions"
echo "-------------------------"
curl -s -X GET "${API_URL}/admin/transactions" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-transactions.json

if grep -q '"ok":true' admin-transactions.json && grep -q '"transactions"' admin-transactions.json; then
  TOTAL=$(grep -o '"total":[0-9]*' admin-transactions.json | cut -d: -f2)
  echo "Transactions listed (total: $TOTAL)"
else
  echo "Failed:"
  cat admin-transactions.json | head -c 200
fi

# Test 7: List Reviews
echo ""
echo "Test 7: List Reviews"
echo "--------------------"
curl -s -X GET "${API_URL}/admin/reviews" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-reviews.json

if grep -q '"ok":true' admin-reviews.json && grep -q '"reviews"' admin-reviews.json; then
  TOTAL=$(grep -o '"total":[0-9]*' admin-reviews.json | cut -d: -f2)
  echo "Reviews listed (total: $TOTAL)"
else
  echo "Failed:"
  cat admin-reviews.json | head -c 200
fi

# Test 8: List Users
echo ""
echo "Test 8: List Users"
echo "------------------"
curl -s -X GET "${API_URL}/admin/users" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-users.json

if grep -q '"ok":true' admin-users.json && grep -q '"users"' admin-users.json; then
  TOTAL=$(grep -o '"total":[0-9]*' admin-users.json | cut -d: -f2)
  echo "Users listed (total: $TOTAL)"
else
  echo "Failed:"
  cat admin-users.json | head -c 200
fi

# Test 9: Search with Filters
echo ""
echo "Test 9: Search Providers"
echo "------------------------"
curl -s -X GET "${API_URL}/admin/providers?search=Admin&status=active" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-search.json

if grep -q '"ok":true' admin-search.json; then
  echo "Search with filters working"
else
  echo "Failed:"
  cat admin-search.json | head -c 200
fi

# Test 10: Flag Review
echo ""
echo "Test 10: Flag Review"
echo "--------------------"
if [ -n "$REVIEW_ID" ]; then
  curl -s -X POST "${API_URL}/admin/reviews/${REVIEW_ID}/flag" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $ADMIN_CSRF" \
    -b admin-cookies.txt \
    -d '{"reason": "Testing flag"}' > admin-flag.json

  if grep -q '"ok":true' admin-flag.json; then
    echo "Review flagged successfully"
  else
    echo "Failed:"
    cat admin-flag.json
  fi
else
  echo "Skipped (no review)"
fi

# Test 11: Suspend Provider
echo ""
echo "Test 11: Suspend Provider"
echo "-------------------------"
curl -s -X POST "${API_URL}/admin/providers/${PROVIDER_ID}/suspend" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt \
  -d '{"reason": "Testing suspension"}' > admin-suspend.json

if grep -q '"ok":true' admin-suspend.json; then
  echo "Provider suspended"
else
  echo "Failed:"
  cat admin-suspend.json
fi

# Test 12: Unsuspend Provider
echo ""
echo "Test 12: Unsuspend Provider"
echo "---------------------------"
curl -s -X POST "${API_URL}/admin/providers/${PROVIDER_ID}/unsuspend" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-unsuspend.json

if grep -q '"ok":true' admin-unsuspend.json; then
  echo "Provider unsuspended"
else
  echo "Failed:"
  cat admin-unsuspend.json
fi

# Test 13: Unpublish Listing
echo ""
echo "Test 13: Unpublish Listing"
echo "--------------------------"
curl -s -X POST "${API_URL}/admin/listings/${LISTING_ID}/unpublish" \
  -H "X-CSRF-Token: $ADMIN_CSRF" \
  -b admin-cookies.txt > admin-unpublish.json

if grep -q '"ok":true' admin-unpublish.json; then
  echo "Listing unpublished"
else
  echo "Failed:"
  cat admin-unpublish.json
fi

# Cleanup
rm -f admin-cookies.txt provider-cookies.txt buyer-cookies.txt
rm -f admin-register.json admin-access.json provider-register.json listing.json
rm -f transaction.json review.json admin-stats.json admin-providers.json
rm -f admin-provider-detail.json admin-listings.json admin-transactions.json
rm -f admin-reviews.json admin-users.json admin-search.json admin-flag.json
rm -f admin-suspend.json admin-unsuspend.json admin-unpublish.json

echo ""
echo "=========================================="
echo "ADMIN DASHBOARD TESTS COMPLETE"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - Access control (non-admin rejection)"
echo "  - Admin stats"
echo "  - Provider management (list, detail, suspend, unsuspend)"
echo "  - Listing moderation (list, unpublish)"
echo "  - Transaction oversight (list)"
echo "  - Review moderation (list, flag)"
echo "  - User management (list)"
echo ""
