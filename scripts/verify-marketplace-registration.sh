#!/bin/bash
# Verification script for Marketplace registration endpoint changes
# Tests that firstName and lastName are now required fields

API_URL="${API_URL:-http://localhost:3000/api/v1/auth}"

echo "Testing Marketplace Registration Validation"
echo "============================================"
echo ""

# Test 1: Missing firstName
echo "Test 1: Missing firstName (should return 400)"
curl -X POST "${API_URL}/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","password":"password123","lastName":"Doe"}' \
  -w "\nStatus: %{http_code}\n" \
  -s
echo ""

# Test 2: Missing lastName
echo "Test 2: Missing lastName (should return 400)"
curl -X POST "${API_URL}/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@example.com","password":"password123","firstName":"John"}' \
  -w "\nStatus: %{http_code}\n" \
  -s
echo ""

# Test 3: Missing email
echo "Test 3: Missing email (should return 400)"
curl -X POST "${API_URL}/register" \
  -H "Content-Type: application/json" \
  -d '{"password":"password123","firstName":"John","lastName":"Doe"}' \
  -w "\nStatus: %{http_code}\n" \
  -s
echo ""

# Test 4: Valid payload
echo "Test 4: Valid payload (should return 201)"
RANDOM_EMAIL="test-$(date +%s)@example.com"
curl -X POST "${API_URL}/register" \
  -H "Content-Type: application/json" \
  -H "X-Surface: MARKETPLACE" \
  -d "{\"email\":\"${RANDOM_EMAIL}\",\"password\":\"password123\",\"firstName\":\"John\",\"lastName\":\"Doe\"}" \
  -w "\nStatus: %{http_code}\n" \
  -s
echo ""

echo "============================================"
echo "Verification complete"
