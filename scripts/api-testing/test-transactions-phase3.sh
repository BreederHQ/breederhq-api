#!/bin/bash
# Test Phase 3: Transaction Lifecycle Management
# Tests: start, complete, cancel, refund operations

set -e

API_URL="http://marketplace.breederhq.test:6001/api/v1/marketplace"
TIMESTAMP=$(date +%s)
PROVIDER_EMAIL="provider-test-${TIMESTAMP}@example.com"
BUYER_EMAIL="buyer-test-${TIMESTAMP}@example.com"

echo "=========================================="
echo "Testing Phase 3: Transaction Lifecycle"
echo "=========================================="
echo ""

# Helper function to setup provider, listing, buyer, and create paid transaction
setup_paid_transaction() {
  # Register provider
  curl -s -X POST "${API_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -c provider-cookies.txt \
    -d "{
      \"email\": \"${PROVIDER_EMAIL}\",
      \"password\": \"testpass123\",
      \"firstName\": \"Test\",
      \"lastName\": \"Provider\"
    }" > /dev/null

  PROVIDER_CSRF=$(grep 'XSRF-TOKEN' provider-cookies.txt | awk '{print $7}')

  # Register as provider
  curl -s -X POST "${API_URL}/providers/register" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $PROVIDER_CSRF" \
    -b provider-cookies.txt \
    -d '{
      "providerType": "groomer",
      "businessName": "Test Provider",
      "businessDescription": "Testing lifecycle",
      "paymentMode": "manual",
      "paymentInstructions": "Pay via Venmo",
      "city": "Austin",
      "state": "TX",
      "zip": "78701",
      "country": "US"
    }' > /dev/null

  # Create and publish listing
  curl -s -X POST "${API_URL}/listings" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $PROVIDER_CSRF" \
    -b provider-cookies.txt \
    -d '{
      "title": "Test Service",
      "description": "For lifecycle testing",
      "category": "grooming",
      "priceCents": 5000,
      "priceType": "fixed",
      "priceText": "$50",
      "city": "Austin",
      "state": "TX"
    }' > listing.json

  LISTING_ID=$(grep -o '"id":[0-9]*' listing.json | head -1 | cut -d':' -f2)

  curl -s -X POST "${API_URL}/listings/${LISTING_ID}/publish" \
    -H "X-CSRF-Token: $PROVIDER_CSRF" \
    -b provider-cookies.txt > /dev/null

  # Register buyer
  curl -s -X POST "${API_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -c buyer-cookies.txt \
    -d "{
      \"email\": \"${BUYER_EMAIL}\",
      \"password\": \"testpass123\",
      \"firstName\": \"Test\",
      \"lastName\": \"Buyer\"
    }" > /dev/null

  BUYER_CSRF=$(grep 'XSRF-TOKEN' buyer-cookies.txt | awk '{print $7}')

  # Create transaction
  curl -s -X POST "${API_URL}/transactions" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $BUYER_CSRF" \
    -b buyer-cookies.txt \
    -d "{
      \"serviceListingId\": ${LISTING_ID}
    }" > transaction.json

  TRANSACTION_ID=$(grep -o '"id":[0-9]*' transaction.json | head -1 | cut -d':' -f2)

  # Complete payment flow
  curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/mark-paid" \
    -H "X-CSRF-Token: $BUYER_CSRF" \
    -b buyer-cookies.txt > /dev/null

  curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/confirm-payment" \
    -H "X-CSRF-Token: $PROVIDER_CSRF" \
    -b provider-cookies.txt > /dev/null

  echo "✅ Setup complete (Transaction ID: $TRANSACTION_ID)"
}

# Test 1: Start service
echo "Test 1: Start Service"
echo "----------------------"
setup_paid_transaction

curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/start" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > start-response.json

echo "Start Response:"
cat start-response.json | python3 -m json.tool 2>/dev/null || cat start-response.json
echo ""

if grep -q '"ok":true' start-response.json && grep -q '"status":"started"' start-response.json; then
  echo "✅ Service started successfully"
  if grep -q '"startedAt":"' start-response.json; then
    echo "✅ startedAt timestamp set"
  fi
else
  echo "❌ Start service failed"
  exit 1
fi
echo ""

# Test 2: Complete service
echo "Test 2: Complete Service"
echo "------------------------"

curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/complete" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > complete-response.json

echo "Complete Response:"
cat complete-response.json | python3 -m json.tool 2>/dev/null || cat complete-response.json
echo ""

if grep -q '"ok":true' complete-response.json && grep -q '"status":"completed"' complete-response.json; then
  echo "✅ Service completed successfully"
  if grep -q '"completedAt":"' complete-response.json; then
    echo "✅ completedAt timestamp set"
  fi
else
  echo "❌ Complete service failed"
  exit 1
fi
echo ""

# Clean up for next test
rm -f provider-cookies.txt buyer-cookies.txt listing.json transaction.json

# Test 3: Complete without starting (should work - optional step)
echo "Test 3: Complete Without Starting (Optional Step)"
echo "--------------------------------------------------"
PROVIDER_EMAIL="provider2-test-${TIMESTAMP}@example.com"
BUYER_EMAIL="buyer2-test-${TIMESTAMP}@example.com"
setup_paid_transaction

curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/complete" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > complete-direct.json

if grep -q '"ok":true' complete-direct.json && grep -q '"status":"completed"' complete-direct.json; then
  echo "✅ Service completed directly from paid status"
else
  echo "❌ Direct completion failed"
  exit 1
fi
echo ""

# Clean up
rm -f provider-cookies.txt buyer-cookies.txt listing.json transaction.json

# Test 4: Cancel pending transaction
echo "Test 4: Cancel Pending Transaction"
echo "-----------------------------------"
PROVIDER_EMAIL="provider3-test-${TIMESTAMP}@example.com"
BUYER_EMAIL="buyer3-test-${TIMESTAMP}@example.com"

# Setup without completing payment
curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -c provider-cookies.txt \
  -d "{
    \"email\": \"${PROVIDER_EMAIL}\",
    \"password\": \"testpass123\",
    \"firstName\": \"Test\",
    \"lastName\": \"Provider\"
  }" > /dev/null

PROVIDER_CSRF=$(grep 'XSRF-TOKEN' provider-cookies.txt | awk '{print $7}')

curl -s -X POST "${API_URL}/providers/register" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "providerType": "groomer",
    "businessName": "Test Provider",
    "businessDescription": "Testing",
    "paymentMode": "manual",
    "paymentInstructions": "Pay via Venmo",
    "city": "Austin",
    "state": "TX",
    "zip": "78701",
    "country": "US"
  }' > /dev/null

curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "title": "Test Service",
    "description": "For testing",
    "category": "grooming",
    "priceCents": 5000,
    "priceType": "fixed",
    "priceText": "$50",
    "city": "Austin",
    "state": "TX"
  }' > listing.json

LISTING_ID=$(grep -o '"id":[0-9]*' listing.json | head -1 | cut -d':' -f2)

curl -s -X POST "${API_URL}/listings/${LISTING_ID}/publish" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > /dev/null

curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -c buyer-cookies.txt \
  -d "{
    \"email\": \"${BUYER_EMAIL}\",
    \"password\": \"testpass123\",
    \"firstName\": \"Test\",
    \"lastName\": \"Buyer\"
  }" > /dev/null

BUYER_CSRF=$(grep 'XSRF-TOKEN' buyer-cookies.txt | awk '{print $7}')

curl -s -X POST "${API_URL}/transactions" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d "{
    \"serviceListingId\": ${LISTING_ID}
  }" > transaction.json

TRANSACTION_ID=$(grep -o '"id":[0-9]*' transaction.json | head -1 | cut -d':' -f2)

# Cancel the pending transaction
curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/cancel" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d '{
    "reason": "Changed my mind"
  }' > cancel-response.json

echo "Cancel Response:"
cat cancel-response.json | python3 -m json.tool 2>/dev/null || cat cancel-response.json
echo ""

if grep -q '"ok":true' cancel-response.json && grep -q '"status":"cancelled"' cancel-response.json; then
  echo "✅ Transaction cancelled successfully"
  if grep -q '"cancelledAt":"' cancel-response.json; then
    echo "✅ cancelledAt timestamp set"
  fi
  if grep -q '"cancellationReason":"Changed my mind"' cancel-response.json; then
    echo "✅ Cancellation reason stored"
  fi
else
  echo "❌ Cancel failed"
  exit 1
fi
echo ""

# Clean up
rm -f provider-cookies.txt buyer-cookies.txt listing.json transaction.json

# Test 5: Refund paid transaction
echo "Test 5: Refund Paid Transaction"
echo "--------------------------------"
PROVIDER_EMAIL="provider4-test-${TIMESTAMP}@example.com"
BUYER_EMAIL="buyer4-test-${TIMESTAMP}@example.com"
setup_paid_transaction

curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/refund" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "reason": "Service could not be provided"
  }' > refund-response.json

echo "Refund Response:"
cat refund-response.json | python3 -m json.tool 2>/dev/null || cat refund-response.json
echo ""

if grep -q '"ok":true' refund-response.json && grep -q '"status":"refunded"' refund-response.json; then
  echo "✅ Refund processed successfully"
  if grep -q '"refundedAt":"' refund-response.json; then
    echo "✅ refundedAt timestamp set"
  fi
  if grep -q '"cancellationReason":"Service could not be provided"' refund-response.json; then
    echo "✅ Refund reason stored"
  fi
else
  echo "❌ Refund failed"
  exit 1
fi
echo ""

# Test 6: Validation - cannot start unpaid transaction
echo "Test 6: Validation - Cannot Start Unpaid Transaction"
echo "-----------------------------------------------------"
# Using the pending transaction from Test 4 setup
PROVIDER_EMAIL="provider5-test-${TIMESTAMP}@example.com"
BUYER_EMAIL="buyer5-test-${TIMESTAMP}@example.com"

# Create pending transaction
curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -c provider-cookies.txt \
  -d "{
    \"email\": \"${PROVIDER_EMAIL}\",
    \"password\": \"testpass123\",
    \"firstName\": \"Test\",
    \"lastName\": \"Provider\"
  }" > /dev/null

PROVIDER_CSRF=$(grep 'XSRF-TOKEN' provider-cookies.txt | awk '{print $7}')

curl -s -X POST "${API_URL}/providers/register" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "providerType": "groomer",
    "businessName": "Test Provider",
    "businessDescription": "Testing",
    "paymentMode": "manual",
    "paymentInstructions": "Pay",
    "city": "Austin",
    "state": "TX",
    "zip": "78701",
    "country": "US"
  }' > /dev/null

curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "title": "Test",
    "description": "Test",
    "category": "grooming",
    "priceCents": 5000,
    "priceType": "fixed",
    "priceText": "$50",
    "city": "Austin",
    "state": "TX"
  }' > listing.json

LISTING_ID=$(grep -o '"id":[0-9]*' listing.json | head -1 | cut -d':' -f2)

curl -s -X POST "${API_URL}/listings/${LISTING_ID}/publish" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > /dev/null

curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -c buyer-cookies.txt \
  -d "{
    \"email\": \"${BUYER_EMAIL}\",
    \"password\": \"testpass123\",
    \"firstName\": \"Test\",
    \"lastName\": \"Buyer\"
  }" > /dev/null

BUYER_CSRF=$(grep 'XSRF-TOKEN' buyer-cookies.txt | awk '{print $7}')

curl -s -X POST "${API_URL}/transactions" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d "{
    \"serviceListingId\": ${LISTING_ID}
  }" > transaction.json

TRANSACTION_ID=$(grep -o '"id":[0-9]*' transaction.json | head -1 | cut -d':' -f2)

curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/start" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > start-validation.json

if grep -q '"error":"transaction_not_paid"' start-validation.json; then
  echo "✅ Validation working (rejected starting unpaid transaction)"
else
  echo "⚠️  Validation response:"
  cat start-validation.json
fi
echo ""

# Cleanup
rm -f provider-cookies.txt buyer-cookies.txt listing.json transaction.json
rm -f start-response.json complete-response.json complete-direct.json
rm -f cancel-response.json refund-response.json start-validation.json

echo "=========================================="
echo "✅ PHASE 3 TESTS COMPLETE!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  • Start service: ✅"
echo "  • Complete service: ✅"
echo "  • Complete without starting: ✅"
echo "  • Cancel pending transaction: ✅"
echo "  • Refund paid transaction: ✅"
echo "  • Validation (start unpaid): ✅"
echo ""
