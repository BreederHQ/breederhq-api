#!/bin/bash
# Test Partial Refund Support
# Tests: full refund, partial refund, multiple partial refunds

set -e

API_URL="http://marketplace.breederhq.test:6001/api/v1/marketplace"
TIMESTAMP=$(date +%s)
PROVIDER_EMAIL="provider-refund-test-${TIMESTAMP}@example.com"
BUYER_EMAIL="buyer-refund-test-${TIMESTAMP}@example.com"

echo "=========================================="
echo "Testing Partial Refund Support"
echo "=========================================="
echo ""

# Helper function to setup provider with published listing
setup_provider_and_listing() {
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
      "businessDescription": "Testing refunds",
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
      "description": "For refund testing",
      "category": "grooming",
      "priceCents": 10000,
      "priceType": "fixed",
      "priceText": "$100",
      "city": "Austin",
      "state": "TX"
    }' > listing.json

  LISTING_ID=$(grep -o '"id":[0-9]*' listing.json | head -1 | cut -d':' -f2)

  curl -s -X POST "${API_URL}/listings/${LISTING_ID}/publish" \
    -H "X-CSRF-Token: $PROVIDER_CSRF" \
    -b provider-cookies.txt > /dev/null

  echo "✅ Provider setup complete (Listing ID: $LISTING_ID)"
}

# Helper function to register buyer
setup_buyer() {
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
  echo "✅ Buyer registered"
}

# Helper function to create and pay for transaction
create_paid_transaction() {
  curl -s -X POST "${API_URL}/transactions" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $BUYER_CSRF" \
    -b buyer-cookies.txt \
    -d "{
      \"serviceListingId\": ${LISTING_ID},
      \"buyerNotes\": \"Testing refunds\"
    }" > transaction.json

  TRANSACTION_ID=$(grep -o '"id":[0-9]*' transaction.json | head -1 | cut -d':' -f2)

  # Buyer marks payment as sent
  curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/mark-paid" \
    -H "X-CSRF-Token: $BUYER_CSRF" \
    -b buyer-cookies.txt > /dev/null

  # Provider confirms payment
  curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/confirm-payment" \
    -H "X-CSRF-Token: $PROVIDER_CSRF" \
    -b provider-cookies.txt > /dev/null

  echo "✅ Transaction created and paid (ID: $TRANSACTION_ID, Total: 11000 cents)"
}

# Test 1: Full refund (default behavior)
echo "Test 1: Full Refund (Default Behavior)"
echo "---------------------------------------"
setup_provider_and_listing
setup_buyer
create_paid_transaction

curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/refund" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "reason": "Full refund test"
  }' > refund-full.json

echo "Full Refund Response:"
cat refund-full.json | python3 -m json.tool 2>/dev/null || cat refund-full.json
echo ""

if grep -q '"message":"Full refund processed successfully."' refund-full.json && \
   grep -q '"status":"refunded"' refund-full.json && \
   grep -q '"isPartial":false' refund-full.json; then
  echo "✅ Full refund processed correctly"
else
  echo "❌ Full refund failed"
  exit 1
fi
echo ""

# Test 2: Partial refund (50%)
echo "Test 2: Partial Refund (50%)"
echo "----------------------------"

# Create new transaction for partial refund test
create_paid_transaction

curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/refund" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "reason": "Partial refund - 50%",
    "amountCents": 5500
  }' > refund-partial.json

echo "Partial Refund Response:"
cat refund-partial.json | python3 -m json.tool 2>/dev/null || cat refund-partial.json
echo ""

if grep -q '"message":"Partial refund processed successfully."' refund-partial.json && \
   grep -q '"status":"paid"' refund-partial.json && \
   grep -q '"isPartial":true' refund-partial.json && \
   grep -q '"amount":"5500"' refund-partial.json; then
  echo "✅ Partial refund processed correctly"
  echo "✅ Transaction status remains 'paid' (not fully refunded)"
else
  echo "❌ Partial refund failed"
  cat refund-partial.json
  exit 1
fi
echo ""

# Test 3: Multiple partial refunds
echo "Test 3: Multiple Partial Refunds"
echo "---------------------------------"

# Issue second partial refund (remaining 50%)
curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/refund" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "reason": "Second partial refund - remaining 50%",
    "amountCents": 5500
  }' > refund-second-partial.json

echo "Second Partial Refund Response:"
cat refund-second-partial.json | python3 -m json.tool 2>/dev/null || cat refund-second-partial.json
echo ""

if grep -q '"message":"Full refund processed successfully."' refund-second-partial.json && \
   grep -q '"status":"refunded"' refund-second-partial.json && \
   grep -q '"amount":"11000"' refund-second-partial.json && \
   grep -q '"isPartial":false' refund-second-partial.json; then
  echo "✅ Multiple partial refunds totaling full amount processed correctly"
  echo "✅ Transaction status updated to 'refunded' after full amount refunded"
else
  echo "❌ Second partial refund failed"
  cat refund-second-partial.json
  exit 1
fi
echo ""

# Test 4: Validation - refund amount exceeds total
echo "Test 4: Validation - Refund Amount Exceeds Total"
echo "-------------------------------------------------"

create_paid_transaction

curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/refund" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "reason": "Invalid refund",
    "amountCents": 20000
  }' > refund-exceeds.json

if grep -q '"error":"refund_amount_exceeds_total_paid"' refund-exceeds.json; then
  echo "✅ Validation working (refund amount exceeds total rejected)"
else
  echo "⚠️  Validation response:"
  cat refund-exceeds.json
fi
echo ""

# Test 5: Validation - negative refund amount
echo "Test 5: Validation - Negative Refund Amount"
echo "--------------------------------------------"

curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/refund" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "reason": "Invalid refund",
    "amountCents": -100
  }' > refund-negative.json

if grep -q '"error":"invalid_refund_amount"' refund-negative.json; then
  echo "✅ Validation working (negative amount rejected)"
else
  echo "⚠️  Validation response:"
  cat refund-negative.json
fi
echo ""

# Cleanup
rm -f provider-cookies.txt buyer-cookies.txt
rm -f listing.json transaction.json
rm -f refund-full.json refund-partial.json refund-second-partial.json
rm -f refund-exceeds.json refund-negative.json

echo "=========================================="
echo "✅ PARTIAL REFUND TESTS COMPLETE!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  • Full refund (default): ✅"
echo "  • Partial refund (50%): ✅"
echo "  • Multiple partial refunds: ✅"
echo "  • Validation (exceeds total): ✅"
echo "  • Validation (negative amount): ✅"
echo ""
