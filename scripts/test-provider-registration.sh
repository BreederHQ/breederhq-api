#!/bin/bash
# Test Provider Registration Flow
# This script tests the complete provider registration with manual payments

set -e

API_URL="http://localhost:6001/api/v1/marketplace"
TIMESTAMP=$(date +%s)
TEST_EMAIL="provider-test-${TIMESTAMP}@example.com"

echo "=========================================="
echo "Testing Provider Registration Flow"
echo "=========================================="
echo ""

# Step 1: Register as buyer
echo "Step 1: Registering as buyer..."
echo "Email: $TEST_EMAIL"
echo ""

REGISTER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -c cookies.txt \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"testpass123\",
    \"firstName\": \"Jane\",
    \"lastName\": \"Groomer\"
  }")

echo "Registration Response:"
echo "$REGISTER_RESPONSE" | jq .
echo ""

# Check if registration was successful
if echo "$REGISTER_RESPONSE" | jq -e '.ok' > /dev/null; then
  echo "✅ Registration successful!"
else
  echo "❌ Registration failed!"
  exit 1
fi

# Step 2: Register as provider with manual payments
echo ""
echo "Step 2: Upgrading to provider with manual payments..."
echo ""

PROVIDER_RESPONSE=$(curl -s -X POST "${API_URL}/providers/register" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -b cookies.txt \
  -c cookies.txt \
  -d '{
    "providerType": "groomer",
    "businessName": "Paws & Claws Grooming",
    "businessDescription": "Professional pet grooming services for all breeds",
    "paymentMode": "manual",
    "paymentInstructions": "Payment accepted via Venmo @pawsandclaws or Zelle at groomer@test.com. Cash also accepted.",
    "city": "Austin",
    "state": "TX",
    "zip": "78701",
    "country": "US"
  }')

echo "Provider Registration Response:"
echo "$PROVIDER_RESPONSE" | jq .
echo ""

# Check if provider registration was successful
if echo "$PROVIDER_RESPONSE" | jq -e '.ok' > /dev/null; then
  echo "✅ Provider registration successful!"
  PROVIDER_ID=$(echo "$PROVIDER_RESPONSE" | jq -r '.provider.id')
  echo "   Provider ID: $PROVIDER_ID"
else
  echo "❌ Provider registration failed!"
  exit 1
fi

# Step 3: Get provider profile
echo ""
echo "Step 3: Fetching provider profile..."
echo ""

PROFILE_RESPONSE=$(curl -s -X GET "${API_URL}/providers/me" \
  -H "Accept: application/json" \
  -b cookies.txt)

echo "Provider Profile:"
echo "$PROFILE_RESPONSE" | jq .
echo ""

# Verify payment mode
PAYMENT_MODE=$(echo "$PROFILE_RESPONSE" | jq -r '.paymentMode')
if [ "$PAYMENT_MODE" == "manual" ]; then
  echo "✅ Payment mode is correctly set to 'manual'"
else
  echo "❌ Payment mode is incorrect: $PAYMENT_MODE"
  exit 1
fi

# Step 4: Get provider dashboard
echo ""
echo "Step 4: Fetching provider dashboard..."
echo ""

DASHBOARD_RESPONSE=$(curl -s -X GET "${API_URL}/providers/me/dashboard" \
  -H "Accept: application/json" \
  -b cookies.txt)

echo "Provider Dashboard:"
echo "$DASHBOARD_RESPONSE" | jq .
echo ""

if echo "$DASHBOARD_RESPONSE" | jq -e '.stats' > /dev/null; then
  echo "✅ Dashboard loaded successfully!"
else
  echo "❌ Dashboard failed to load!"
  exit 1
fi

# Step 5: Update provider profile
echo ""
echo "Step 5: Updating provider profile..."
echo ""

UPDATE_RESPONSE=$(curl -s -X PATCH "${API_URL}/providers/me" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -b cookies.txt \
  -d '{
    "publicEmail": "contact@pawsandclaws.com",
    "publicPhone": "512-555-1234",
    "website": "https://pawsandclaws.com"
  }')

echo "Update Response:"
echo "$UPDATE_RESPONSE" | jq .
echo ""

if echo "$UPDATE_RESPONSE" | jq -e '.ok' > /dev/null; then
  echo "✅ Profile updated successfully!"
else
  echo "❌ Profile update failed!"
  exit 1
fi

# Step 6: View public profile
echo ""
echo "Step 6: Viewing public provider profile..."
echo ""

PUBLIC_RESPONSE=$(curl -s -X GET "${API_URL}/providers/${PROVIDER_ID}" \
  -H "Accept: application/json")

echo "Public Profile:"
echo "$PUBLIC_RESPONSE" | jq .
echo ""

if echo "$PUBLIC_RESPONSE" | jq -e '.businessName' > /dev/null; then
  echo "✅ Public profile accessible!"
else
  echo "❌ Public profile not accessible!"
  exit 1
fi

# Step 7: Test validation - try to register as provider again (should fail)
echo ""
echo "Step 7: Testing duplicate provider prevention..."
echo ""

DUPLICATE_RESPONSE=$(curl -s -X POST "${API_URL}/providers/register" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -b cookies.txt \
  -d '{
    "providerType": "trainer",
    "businessName": "Another Business",
    "paymentMode": "manual",
    "paymentInstructions": "Pay me"
  }')

echo "Duplicate Registration Response:"
echo "$DUPLICATE_RESPONSE" | jq .
echo ""

if echo "$DUPLICATE_RESPONSE" | jq -e '.error' | grep -q "already_provider"; then
  echo "✅ Duplicate provider prevention working!"
else
  echo "❌ Duplicate provider prevention failed!"
  exit 1
fi

# Cleanup
rm -f cookies.txt

echo ""
echo "=========================================="
echo "✅ ALL TESTS PASSED!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  • User registration: ✅"
echo "  • Provider registration (manual): ✅"
echo "  • Get provider profile: ✅"
echo "  • Provider dashboard: ✅"
echo "  • Update provider profile: ✅"
echo "  • Public profile access: ✅"
echo "  • Duplicate prevention: ✅"
echo ""
echo "Test user created: $TEST_EMAIL"
echo "Provider ID: $PROVIDER_ID"
