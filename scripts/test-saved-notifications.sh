#!/bin/bash
# Test Saved Items & Notification Counts APIs
# Tests: saved listing CRUD, notification counts aggregation

set -e

API_URL="http://marketplace.breederhq.test:6001/api/v1/marketplace"
TIMESTAMP=$(date +%s)
BUYER_EMAIL="buyer-saved-${TIMESTAMP}@example.com"
PROVIDER_EMAIL="provider-saved-${TIMESTAMP}@example.com"

echo "=========================================="
echo "Testing Saved Items & Notifications APIs"
echo "=========================================="
echo ""

# Setup: Create provider with a listing
echo "Step 1: Create provider with listing..."
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
    "businessName": "Saved Test Provider",
    "businessDescription": "Testing saved items",
    "paymentMode": "manual",
    "paymentInstructions": "Pay via Venmo",
    "city": "Austin",
    "state": "TX",
    "zip": "78701",
    "country": "US"
  }' > provider-register.json

echo "Provider registered"

# Create and publish a listing
curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "title": "Test Grooming Service",
    "description": "For testing saved items",
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

echo "Listing created and published (ID: $LISTING_ID)"
echo ""

# Setup: Create buyer
echo "Step 2: Create buyer..."
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
echo "Buyer registered"
echo ""

echo "=========================================="
echo "Testing Saved Items Endpoints"
echo "=========================================="
echo ""

# Test 1: List saved items (should be empty)
echo "Test 1: List Saved Items (Empty)"
echo "---------------------------------"
curl -s -X GET "${API_URL}/saved" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt > saved-list.json

if grep -q '"ok":true' saved-list.json && grep -q '"total":0' saved-list.json; then
  echo "✓ Saved list is empty initially"
else
  echo "FAILED:"
  cat saved-list.json
fi
echo ""

# Test 2: Check if listing is saved (should be false)
echo "Test 2: Check Saved Status (Not Saved)"
echo "--------------------------------------"
curl -s -X GET "${API_URL}/saved/check/${LISTING_ID}" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt > check-result.json

if grep -q '"saved":false' check-result.json; then
  echo "✓ Listing correctly shows as not saved"
else
  echo "FAILED:"
  cat check-result.json
fi
echo ""

# Test 3: Save a listing
echo "Test 3: Save Listing"
echo "--------------------"
curl -s -X POST "${API_URL}/saved" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d "{\"listingId\": ${LISTING_ID}}" > save-result.json

if grep -q '"ok":true' save-result.json; then
  echo "✓ Listing saved successfully"
else
  echo "FAILED:"
  cat save-result.json
fi
echo ""

# Test 4: Check saved status (should be true now)
echo "Test 4: Check Saved Status (Is Saved)"
echo "-------------------------------------"
curl -s -X GET "${API_URL}/saved/check/${LISTING_ID}" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt > check-result2.json

if grep -q '"saved":true' check-result2.json; then
  echo "✓ Listing correctly shows as saved"
else
  echo "FAILED:"
  cat check-result2.json
fi
echo ""

# Test 5: List saved items (should have 1)
echo "Test 5: List Saved Items (Has 1)"
echo "---------------------------------"
curl -s -X GET "${API_URL}/saved" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt > saved-list2.json

if grep -q '"ok":true' saved-list2.json && grep -q '"total":1' saved-list2.json; then
  echo "✓ Saved list has 1 item"
  # Verify listing details are included
  if grep -q '"title":"Test Grooming Service"' saved-list2.json; then
    echo "✓ Listing details included"
  fi
  if grep -q '"businessName":"Saved Test Provider"' saved-list2.json; then
    echo "✓ Provider details included"
  fi
else
  echo "FAILED:"
  cat saved-list2.json
fi
echo ""

# Test 6: Try to save same listing again (should fail with 409)
echo "Test 6: Duplicate Save (Should Fail)"
echo "-------------------------------------"
HTTP_CODE=$(curl -s -o duplicate-save.json -w "%{http_code}" -X POST "${API_URL}/saved" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d "{\"listingId\": ${LISTING_ID}}")

if [ "$HTTP_CODE" = "409" ] && grep -q '"already_saved"' duplicate-save.json; then
  echo "✓ Duplicate save correctly rejected (409)"
else
  echo "FAILED (HTTP $HTTP_CODE):"
  cat duplicate-save.json
fi
echo ""

# Test 7: Unsave the listing
echo "Test 7: Unsave Listing"
echo "----------------------"
curl -s -X DELETE "${API_URL}/saved/${LISTING_ID}" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt > unsave-result.json

if grep -q '"ok":true' unsave-result.json; then
  echo "✓ Listing unsaved successfully"
else
  echo "FAILED:"
  cat unsave-result.json
fi
echo ""

# Test 8: Verify list is empty again
echo "Test 8: List After Unsave (Empty)"
echo "----------------------------------"
curl -s -X GET "${API_URL}/saved" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt > saved-list3.json

if grep -q '"ok":true' saved-list3.json && grep -q '"total":0' saved-list3.json; then
  echo "✓ Saved list is empty after unsave"
else
  echo "FAILED:"
  cat saved-list3.json
fi
echo ""

# Test 9: Unsave non-existent item (should fail)
echo "Test 9: Unsave Non-Saved (Should Fail)"
echo "--------------------------------------"
HTTP_CODE=$(curl -s -o unsave-fail.json -w "%{http_code}" -X DELETE "${API_URL}/saved/${LISTING_ID}" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt)

if [ "$HTTP_CODE" = "404" ]; then
  echo "✓ Unsave non-saved correctly rejected (404)"
else
  echo "FAILED (HTTP $HTTP_CODE):"
  cat unsave-fail.json
fi
echo ""

echo "=========================================="
echo "Testing Notification Counts Endpoint"
echo "=========================================="
echo ""

# Test 10: Get notification counts (buyer)
echo "Test 10: Notification Counts (Buyer)"
echo "------------------------------------"
curl -s -X GET "${API_URL}/notifications/counts" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt > notif-buyer.json

if grep -q '"ok":true' notif-buyer.json; then
  echo "✓ Notification counts retrieved for buyer"
  cat notif-buyer.json | head -c 200
  echo ""
  # Buyer should have unreadMessages and pendingReviews
  if grep -q '"unreadMessages"' notif-buyer.json && grep -q '"pendingReviews"' notif-buyer.json; then
    echo "✓ Buyer notification types present"
  fi
else
  echo "FAILED:"
  cat notif-buyer.json
fi
echo ""

# Test 11: Get notification counts (provider)
echo "Test 11: Notification Counts (Provider)"
echo "---------------------------------------"
curl -s -X GET "${API_URL}/notifications/counts" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > notif-provider.json

if grep -q '"ok":true' notif-provider.json; then
  echo "✓ Notification counts retrieved for provider"
  cat notif-provider.json | head -c 300
  echo ""
  # Provider should have additional fields
  if grep -q '"pendingTransactions"' notif-provider.json; then
    echo "✓ Provider-specific pendingTransactions present"
  fi
  if grep -q '"newInquiries"' notif-provider.json; then
    echo "✓ Provider-specific newInquiries present"
  fi
else
  echo "FAILED:"
  cat notif-provider.json
fi
echo ""

# Cleanup
rm -f provider-cookies.txt buyer-cookies.txt provider-register.json listing.json
rm -f saved-list.json check-result.json save-result.json check-result2.json
rm -f saved-list2.json duplicate-save.json unsave-result.json saved-list3.json
rm -f unsave-fail.json notif-buyer.json notif-provider.json

echo "=========================================="
echo "SAVED ITEMS & NOTIFICATIONS TESTS COMPLETE"
echo "=========================================="
echo ""
echo "Summary - Tested endpoints:"
echo "  GET    /saved                 - List saved items"
echo "  POST   /saved                 - Save a listing"
echo "  DELETE /saved/:listingId      - Unsave a listing"
echo "  GET    /saved/check/:listingId - Check if saved"
echo "  GET    /notifications/counts  - Get notification counts"
echo ""
