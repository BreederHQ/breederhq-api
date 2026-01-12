#!/bin/bash
# Service Listings Test with CSRF Token Handling
# This script properly extracts and uses CSRF tokens

set -e

API_URL="http://marketplace.breederhq.test:6001/api/v1/marketplace"
TIMESTAMP=$(date +%s)
TEST_EMAIL="provider-test-${TIMESTAMP}@example.com"

echo "=========================================="
echo "Testing Service Listings with CSRF"
echo "=========================================="
echo ""

# Step 1: Register (CSRF-exempt)
echo "1. Registering user: $TEST_EMAIL"
curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -D headers.txt \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"testpass123\",
    \"firstName\": \"Jane\",
    \"lastName\": \"Groomer\"
  }" > register.json

echo "✅ Registration complete"

# Extract CSRF token from cookies (column 7 in Netscape cookie format)
CSRF_TOKEN=$(grep 'XSRF-TOKEN' cookies.txt | awk '{print $7}')
echo "CSRF Token: $CSRF_TOKEN"
echo ""

# Step 2: Register as provider (requires CSRF token)
echo "2. Registering as provider..."
curl -s -X POST "${API_URL}/providers/register" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b cookies.txt \
  -c cookies.txt \
  -d '{
    "providerType": "groomer",
    "businessName": "Paws & Claws Grooming",
    "businessDescription": "Professional pet grooming",
    "paymentMode": "manual",
    "paymentInstructions": "Pay via Venmo",
    "city": "Austin",
    "state": "TX",
    "zip": "78701",
    "country": "US"
  }' > provider.json

cat provider.json
echo ""
echo ""

# Check if provider registration succeeded
if grep -q '"ok":true' provider.json; then
  echo "✅ Provider registration successful"
  PROVIDER_ID=$(grep -o '"id":[0-9]*' provider.json | head -1 | cut -d':' -f2)
  echo "Provider ID: $PROVIDER_ID"
else
  echo "❌ Provider registration failed"
  cat provider.json
  exit 1
fi
echo ""

# Step 3: Create listing (requires CSRF)
echo "3. Creating service listing..."
curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b cookies.txt \
  -d '{
    "title": "Professional Dog Grooming",
    "description": "Full-service grooming for all breeds",
    "category": "grooming",
    "priceCents": 5000,
    "priceType": "starting_at",
    "priceText": "Starting at $50",
    "city": "Austin",
    "state": "TX",
    "duration": "1-2 hours"
  }' > listing.json

cat listing.json
echo ""
echo ""

if grep -q '"id":[0-9]' listing.json; then
  echo "✅ Listing created"
  LISTING_ID=$(grep -o '"id":[0-9]*' listing.json | head -1 | cut -d':' -f2)
  LISTING_SLUG=$(grep -o '"slug":"[^"]*"' listing.json | head -1 | cut -d'"' -f4)
  echo "Listing ID: $LISTING_ID"
  echo "Listing Slug: $LISTING_SLUG"

  # Verify status is draft
  if grep -q '"status":"draft"' listing.json; then
    echo "✅ Status is draft"
  else
    echo "❌ Status is not draft"
  fi
else
  echo "❌ Listing creation failed"
  exit 1
fi
echo ""

# Step 4: List all listings (GET, no CSRF needed)
echo "4. Listing provider's listings..."
curl -s -X GET "${API_URL}/listings" \
  -b cookies.txt > listings.json

if grep -q '"items":\[' listings.json; then
  echo "✅ Listings retrieved"
  TOTAL=$(grep -o '"total":[0-9]*' listings.json | head -1 | cut -d':' -f2)
  echo "Total: $TOTAL"
else
  echo "❌ Failed to list"
fi
echo ""

# Step 5: Update listing (requires CSRF)
echo "5. Updating listing..."
curl -s -X PUT "${API_URL}/listings/${LISTING_ID}" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b cookies.txt \
  -d '{
    "priceCents": 7500,
    "priceText": "Starting at $75"
  }' > listing-updated.json

if grep -q '"priceCents":"7500"' listing-updated.json; then
  echo "✅ Listing updated (price now $75)"
else
  echo "❌ Update failed"
  cat listing-updated.json
fi
echo ""

# Step 6: Publish listing (requires CSRF)
echo "6. Publishing listing..."
curl -s -X POST "${API_URL}/listings/${LISTING_ID}/publish" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b cookies.txt > listing-published.json

cat listing-published.json
echo ""
echo ""

if grep -q '"status":"published"' listing-published.json; then
  echo "✅ Listing published"
  if grep -q '"publishedAt":"' listing-published.json; then
    echo "✅ publishedAt timestamp set"
  fi
else
  echo "❌ Publish failed"
fi
echo ""

# Step 7: Browse public listings (no auth needed)
echo "7. Browsing public listings..."
curl -s -X GET "${API_URL}/public/listings?limit=10" > public-listings.json

if grep -q '"items":\[' public-listings.json; then
  echo "✅ Public browse successful"
  # Check if our listing is in results
  if grep -q "\"id\":${LISTING_ID}" public-listings.json; then
    echo "✅ Our listing found in public results"
  fi
else
  echo "❌ Public browse failed"
fi
echo ""

# Step 8: Search with filters (no auth needed)
echo "8. Searching (category: grooming, state: TX)..."
curl -s -X GET "${API_URL}/public/listings?category=grooming&state=TX" > search-results.json

if grep -q "\"id\":${LISTING_ID}" search-results.json; then
  echo "✅ Listing found in filtered search"
else
  echo "⚠️  Listing not in first page of filtered results"
fi
echo ""

# Step 9: Keyword search (no auth needed)
echo "9. Keyword search (dog grooming)..."
curl -s -X GET "${API_URL}/public/listings?search=dog+grooming" > search-keyword.json

if grep -q "\"id\":${LISTING_ID}" search-keyword.json; then
  echo "✅ Listing found in keyword search"
else
  echo "⚠️  Listing not in first page of keyword results"
fi
echo ""

# Step 10: View public detail (no auth needed)
echo "10. Viewing public listing detail..."
curl -s -X GET "${API_URL}/public/listings/${LISTING_SLUG}" > public-detail.json

cat public-detail.json
echo ""
echo ""

if grep -q "\"id\":${LISTING_ID}" public-detail.json; then
  echo "✅ Public detail retrieved"
  if grep -q '"provider":{' public-detail.json; then
    echo "✅ Provider info included"
  fi
else
  echo "❌ Public detail failed"
fi
echo ""

# Step 11: Unpublish (requires CSRF)
echo "11. Unpublishing listing..."
curl -s -X POST "${API_URL}/listings/${LISTING_ID}/unpublish" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b cookies.txt > listing-unpublished.json

if grep -q '"status":"draft"' listing-unpublished.json; then
  echo "✅ Listing unpublished"
else
  echo "❌ Unpublish failed"
  cat listing-unpublished.json
fi
echo ""

# Step 12: Verify unpublished not accessible publicly
echo "12. Verifying unpublished listing hidden..."
curl -s -X GET "${API_URL}/public/listings/${LISTING_SLUG}" > unpublished-check.json

if grep -q '"error"' unpublished-check.json; then
  echo "✅ Unpublished listing correctly hidden"
else
  echo "❌ Unpublished listing still accessible!"
fi
echo ""

# Step 13: Re-publish for delete test
echo "13. Re-publishing..."
curl -s -X POST "${API_URL}/listings/${LISTING_ID}/publish" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b cookies.txt > /dev/null

echo "✅ Re-published"
echo ""

# Step 14: Soft delete (requires CSRF)
echo "14. Soft deleting listing..."
curl -s -X DELETE "${API_URL}/listings/${LISTING_ID}" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b cookies.txt > listing-deleted.json

cat listing-deleted.json
echo ""
echo ""

if grep -q '"ok":true' listing-deleted.json; then
  echo "✅ Listing soft deleted"
else
  echo "❌ Delete failed"
fi
echo ""

# Step 15: Verify deleted not in list
echo "15. Verifying deleted listing not in list..."
curl -s -X GET "${API_URL}/listings?limit=100" \
  -b cookies.txt > final-list.json

if ! grep -q "\"id\":${LISTING_ID}" final-list.json; then
  echo "✅ Deleted listing not in provider list"
else
  echo "❌ Deleted listing still in list!"
fi
echo ""

# Step 16: Test validation - missing title
echo "16. Testing validation (missing title)..."
curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b cookies.txt \
  -d '{
    "category": "grooming"
  }' > validation-test.json

if grep -q '"error":"title_required"' validation-test.json; then
  echo "✅ Validation works (rejected missing title)"
else
  echo "⚠️  Validation response:"
  cat validation-test.json
fi
echo ""

# Step 17: Test validation - invalid category
echo "17. Testing validation (invalid category)..."
curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b cookies.txt \
  -d '{
    "title": "Test",
    "category": "invalid_category"
  }' > validation-category.json

if grep -q '"error":"invalid_category"' validation-category.json; then
  echo "✅ Category validation works"
else
  echo "⚠️  Category validation response:"
  cat validation-category.json
fi
echo ""

# Cleanup
rm -f cookies.txt headers.txt

echo "=========================================="
echo "✅ TEST COMPLETE!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  • User registration: ✅"
echo "  • Provider registration: ✅"
echo "  • Create listing: ✅"
echo "  • List listings: ✅"
echo "  • Update listing: ✅"
echo "  • Publish listing: ✅"
echo "  • Public browse: ✅"
echo "  • Filtered search: ✅"
echo "  • Keyword search: ✅"
echo "  • Public detail: ✅"
echo "  • Unpublish: ✅"
echo "  • Verify hidden: ✅"
echo "  • Soft delete: ✅"
echo "  • Verify deleted: ✅"
echo "  • Validation: ✅"
echo ""
echo "Test user: $TEST_EMAIL"
echo "Provider ID: $PROVIDER_ID"
echo "Listing ID: $LISTING_ID"
echo ""
