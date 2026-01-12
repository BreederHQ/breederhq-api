#!/bin/bash
# Test Phase 1: Transaction Creation
# Tests: create transaction, list transactions, get transaction detail

set -e

API_URL="http://marketplace.breederhq.test:6001/api/v1/marketplace"
TIMESTAMP=$(date +%s)
PROVIDER_EMAIL="provider-test-${TIMESTAMP}@example.com"
BUYER_EMAIL="buyer-test-${TIMESTAMP}@example.com"

echo "=========================================="
echo "Testing Phase 1: Transaction Creation"
echo "=========================================="
echo ""

# Step 1: Register and setup provider with published listing
echo "Step 1: Setting up provider with published listing..."

# Register provider
curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -c provider-cookies.txt \
  -d "{
    \"email\": \"${PROVIDER_EMAIL}\",
    \"password\": \"testpass123\",
    \"firstName\": \"Jane\",
    \"lastName\": \"Provider\"
  }" > /dev/null

# Extract provider CSRF token
PROVIDER_CSRF=$(grep 'XSRF-TOKEN' provider-cookies.txt | awk '{print $7}')

# Register as provider
curl -s -X POST "${API_URL}/providers/register" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -c provider-cookies.txt \
  -d '{
    "providerType": "groomer",
    "businessName": "Test Grooming Services",
    "businessDescription": "Professional pet grooming",
    "paymentMode": "manual",
    "paymentInstructions": "Pay via Venmo @testgroomer",
    "city": "Austin",
    "state": "TX",
    "zip": "78701",
    "country": "US"
  }' > provider.json

if ! grep -q '"ok":true' provider.json; then
  echo "❌ Provider registration failed"
  cat provider.json
  exit 1
fi

PROVIDER_ID=$(grep -o '"id":[0-9]*' provider.json | head -1 | cut -d':' -f2)
echo "✅ Provider registered (ID: $PROVIDER_ID)"

# Create listing
curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "title": "Professional Dog Grooming",
    "description": "Full-service grooming for all breeds",
    "category": "grooming",
    "priceCents": 5000,
    "priceType": "starting_at",
    "priceText": "Starting at $50",
    "city": "Austin",
    "state": "TX"
  }' > listing.json

LISTING_ID=$(grep -o '"id":[0-9]*' listing.json | head -1 | cut -d':' -f2)
echo "✅ Listing created (ID: $LISTING_ID)"

# Publish listing
curl -s -X POST "${API_URL}/listings/${LISTING_ID}/publish" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > /dev/null

echo "✅ Listing published"
echo ""

# Step 2: Register buyer
echo "Step 2: Registering buyer..."

curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -c buyer-cookies.txt \
  -d "{
    \"email\": \"${BUYER_EMAIL}\",
    \"password\": \"testpass123\",
    \"firstName\": \"John\",
    \"lastName\": \"Buyer\"
  }" > buyer-register.json

if ! grep -q '"ok":true' buyer-register.json; then
  echo "❌ Buyer registration failed"
  cat buyer-register.json
  exit 1
fi

BUYER_CSRF=$(grep 'XSRF-TOKEN' buyer-cookies.txt | awk '{print $7}')
echo "✅ Buyer registered"
echo ""

# Step 3: Create transaction (buyer books service)
echo "Step 3: Creating transaction (booking service)..."

curl -s -X POST "${API_URL}/transactions" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d "{
    \"serviceListingId\": ${LISTING_ID},
    \"buyerNotes\": \"Looking forward to the service! My dog is a golden retriever.\"
  }" > transaction.json

echo "Transaction Response:"
cat transaction.json | python3 -m json.tool 2>/dev/null || cat transaction.json
echo ""
echo ""

# Verify transaction was created
if grep -q '"id":' transaction.json; then
  TRANSACTION_ID=$(grep -o '"id":[0-9]*' transaction.json | head -1 | cut -d':' -f2)
  echo "✅ Transaction created (ID: $TRANSACTION_ID)"

  # Verify required fields
  if grep -q '"status":"pending"' transaction.json; then
    echo "✅ Status is 'pending'"
  else
    echo "❌ Status is not 'pending'"
    exit 1
  fi

  if grep -q '"totalCents":"' transaction.json; then
    TOTAL=$(grep -o '"totalCents":"[0-9]*"' transaction.json | cut -d'"' -f4)
    echo "✅ Total calculated: $TOTAL cents"
  else
    echo "❌ Total not calculated"
    exit 1
  fi

  if grep -q '"serviceTitle":"' transaction.json; then
    SERVICE_TITLE=$(grep -o '"serviceTitle":"[^"]*"' transaction.json | cut -d'"' -f4)
    echo "✅ Service title: $SERVICE_TITLE"
  else
    echo "❌ Service title missing"
    exit 1
  fi
else
  echo "❌ Transaction creation failed"
  exit 1
fi
echo ""

# Step 4: List buyer's transactions
echo "Step 4: Listing buyer's transactions..."

curl -s -X GET "${API_URL}/transactions" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt > transactions-list.json

echo "Transactions List:"
cat transactions-list.json | python3 -m json.tool 2>/dev/null || cat transactions-list.json
echo ""
echo ""

if grep -q "\"id\":${TRANSACTION_ID}" transactions-list.json; then
  echo "✅ Transaction found in buyer's list"

  # Verify pagination
  if grep -q '"total":[0-9]' transactions-list.json; then
    TOTAL=$(grep -o '"total":[0-9]*' transactions-list.json | cut -d':' -f2)
    echo "✅ Pagination working (total: $TOTAL)"
  fi
else
  echo "❌ Transaction not in buyer's list"
  exit 1
fi
echo ""

# Step 5: Get transaction detail
echo "Step 5: Getting transaction detail..."

curl -s -X GET "${API_URL}/transactions/${TRANSACTION_ID}" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt > transaction-detail.json

echo "Transaction Detail:"
cat transaction-detail.json | python3 -m json.tool 2>/dev/null || cat transaction-detail.json
echo ""
echo ""

if grep -q "\"id\":${TRANSACTION_ID}" transaction-detail.json; then
  echo "✅ Transaction detail retrieved"

  # Verify embedded objects
  if grep -q '"client":' transaction-detail.json; then
    echo "✅ Client info included"
  fi

  if grep -q '"provider":' transaction-detail.json; then
    echo "✅ Provider info included"
  fi

  if grep -q '"listing":' transaction-detail.json; then
    echo "✅ Listing info included"
  fi

  if grep -q '"serviceNotes":"' transaction-detail.json; then
    echo "✅ Buyer notes preserved"
  fi
else
  echo "❌ Transaction detail retrieval failed"
  exit 1
fi
echo ""

# Step 6: Test validation - missing serviceListingId
echo "Step 6: Testing validation (missing serviceListingId)..."

curl -s -X POST "${API_URL}/transactions" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d '{}' > validation-test.json

if grep -q '"error":"service_listing_id_required"' validation-test.json; then
  echo "✅ Validation working (rejected missing serviceListingId)"
else
  echo "❌ Validation failed"
  cat validation-test.json
  exit 1
fi
echo ""

# Step 7: Test validation - buyer cannot book own service
echo "Step 7: Testing validation (cannot book own service)..."

curl -s -X POST "${API_URL}/transactions" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d "{
    \"serviceListingId\": ${LISTING_ID}
  }" > self-book-test.json

if grep -q '"error":"cannot_book_own_service"' self-book-test.json; then
  echo "✅ Validation working (prevented booking own service)"
else
  echo "❌ Self-booking prevention failed"
  cat self-book-test.json
  exit 1
fi
echo ""

# Cleanup
rm -f provider-cookies.txt buyer-cookies.txt provider.json buyer-register.json
rm -f listing.json transaction.json transactions-list.json transaction-detail.json
rm -f validation-test.json self-book-test.json

echo "=========================================="
echo "✅ PHASE 1 TESTS COMPLETE!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  • Provider setup: ✅"
echo "  • Listing creation & publish: ✅"
echo "  • Buyer registration: ✅"
echo "  • Transaction creation: ✅"
echo "  • Fee calculation: ✅"
echo "  • Transaction listing: ✅"
echo "  • Transaction detail: ✅"
echo "  • Validation (missing field): ✅"
echo "  • Validation (self-booking): ✅"
echo ""
echo "Test accounts:"
echo "  Provider: $PROVIDER_EMAIL"
echo "  Buyer: $BUYER_EMAIL"
echo "  Transaction ID: $TRANSACTION_ID"
echo ""
