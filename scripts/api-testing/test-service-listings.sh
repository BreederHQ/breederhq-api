#!/bin/bash
# Test Service Listings Flow
# This script tests the complete service listing management system

set -e

API_URL="http://localhost:6001/api/v1/marketplace"
TIMESTAMP=$(date +%s)
TEST_EMAIL="provider-test-${TIMESTAMP}@example.com"

echo "=========================================="
echo "Testing Service Listings Flow"
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

if echo "$REGISTER_RESPONSE" | jq -e '.ok' > /dev/null; then
  echo "✅ Registration successful!"
else
  echo "❌ Registration failed!"
  exit 1
fi

# Step 2: Register as provider
echo ""
echo "Step 2: Upgrading to provider..."
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
    "paymentInstructions": "Payment accepted via Venmo @pawsandclaws or Zelle",
    "city": "Austin",
    "state": "TX",
    "zip": "78701",
    "country": "US"
  }')

echo "Provider Registration Response:"
echo "$PROVIDER_RESPONSE" | jq .
echo ""

if echo "$PROVIDER_RESPONSE" | jq -e '.ok' > /dev/null; then
  echo "✅ Provider registration successful!"
  PROVIDER_ID=$(echo "$PROVIDER_RESPONSE" | jq -r '.provider.id')
  echo "   Provider ID: $PROVIDER_ID"
else
  echo "❌ Provider registration failed!"
  exit 1
fi

# Step 3: Create draft listing
echo ""
echo "Step 3: Creating draft listing..."
echo ""

CREATE_RESPONSE=$(curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Professional Dog Grooming",
    "description": "Full-service grooming for all dog breeds including bath, trim, and nail care.",
    "category": "grooming",
    "priceCents": 5000,
    "priceType": "starting_at",
    "priceText": "Starting at $50",
    "city": "Austin",
    "state": "TX",
    "zip": "78701",
    "duration": "1-2 hours",
    "availability": "Mon-Fri 9am-5pm"
  }')

echo "Create Listing Response:"
echo "$CREATE_RESPONSE" | jq .
echo ""

if echo "$CREATE_RESPONSE" | jq -e '.id' > /dev/null; then
  echo "✅ Listing created successfully!"
  LISTING_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id')
  LISTING_SLUG=$(echo "$CREATE_RESPONSE" | jq -r '.slug')
  echo "   Listing ID: $LISTING_ID"
  echo "   Listing Slug: $LISTING_SLUG"

  # Verify status is draft
  STATUS=$(echo "$CREATE_RESPONSE" | jq -r '.status')
  if [ "$STATUS" == "draft" ]; then
    echo "   ✅ Status correctly set to 'draft'"
  else
    echo "   ❌ Status incorrect: $STATUS"
    exit 1
  fi
else
  echo "❌ Listing creation failed!"
  exit 1
fi

# Step 4: List provider's listings
echo ""
echo "Step 4: Listing provider's listings..."
echo ""

LIST_RESPONSE=$(curl -s -X GET "${API_URL}/listings?limit=10" \
  -H "Accept: application/json" \
  -b cookies.txt)

echo "List Listings Response:"
echo "$LIST_RESPONSE" | jq .
echo ""

if echo "$LIST_RESPONSE" | jq -e '.items' > /dev/null; then
  echo "✅ Listings retrieved successfully!"
  TOTAL=$(echo "$LIST_RESPONSE" | jq -r '.total')
  echo "   Total listings: $TOTAL"
else
  echo "❌ Listing retrieval failed!"
  exit 1
fi

# Step 5: Get single listing
echo ""
echo "Step 5: Getting single listing detail..."
echo ""

GET_RESPONSE=$(curl -s -X GET "${API_URL}/listings/${LISTING_ID}" \
  -H "Accept: application/json" \
  -b cookies.txt)

echo "Get Listing Response:"
echo "$GET_RESPONSE" | jq .
echo ""

if echo "$GET_RESPONSE" | jq -e '.id' > /dev/null; then
  echo "✅ Listing detail retrieved successfully!"
else
  echo "❌ Listing detail retrieval failed!"
  exit 1
fi

# Step 6: Update listing
echo ""
echo "Step 6: Updating listing..."
echo ""

UPDATE_RESPONSE=$(curl -s -X PUT "${API_URL}/listings/${LISTING_ID}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -b cookies.txt \
  -d '{
    "description": "Full-service grooming for all dog breeds. Bath, haircut, nail trim, ear cleaning.",
    "priceCents": 7500,
    "priceText": "Starting at $75"
  }')

echo "Update Response:"
echo "$UPDATE_RESPONSE" | jq .
echo ""

if echo "$UPDATE_RESPONSE" | jq -e '.id' > /dev/null; then
  echo "✅ Listing updated successfully!"

  # Verify updated price
  NEW_PRICE=$(echo "$UPDATE_RESPONSE" | jq -r '.priceCents')
  if [ "$NEW_PRICE" == "7500" ]; then
    echo "   ✅ Price updated correctly to $75"
  else
    echo "   ❌ Price not updated: $NEW_PRICE"
    exit 1
  fi
else
  echo "❌ Listing update failed!"
  exit 1
fi

# Step 7: Try to publish with validation
echo ""
echo "Step 7: Publishing listing..."
echo ""

PUBLISH_RESPONSE=$(curl -s -X POST "${API_URL}/listings/${LISTING_ID}/publish" \
  -H "Accept: application/json" \
  -b cookies.txt)

echo "Publish Response:"
echo "$PUBLISH_RESPONSE" | jq .
echo ""

if echo "$PUBLISH_RESPONSE" | jq -e '.ok' > /dev/null; then
  echo "✅ Listing published successfully!"

  # Verify status changed
  PUB_STATUS=$(echo "$PUBLISH_RESPONSE" | jq -r '.listing.status')
  if [ "$PUB_STATUS" == "published" ]; then
    echo "   ✅ Status changed to 'published'"
  else
    echo "   ❌ Status incorrect: $PUB_STATUS"
    exit 1
  fi

  # Verify publishedAt set
  if echo "$PUBLISH_RESPONSE" | jq -e '.listing.publishedAt' > /dev/null; then
    echo "   ✅ publishedAt timestamp set"
  else
    echo "   ❌ publishedAt not set"
    exit 1
  fi
else
  echo "❌ Listing publish failed!"
  exit 1
fi

# Step 8: Browse public listings
echo ""
echo "Step 8: Browsing public listings..."
echo ""

BROWSE_RESPONSE=$(curl -s -X GET "${API_URL}/public/listings?limit=10" \
  -H "Accept: application/json")

echo "Browse Response:"
echo "$BROWSE_RESPONSE" | jq .
echo ""

if echo "$BROWSE_RESPONSE" | jq -e '.items' > /dev/null; then
  echo "✅ Public browse successful!"

  # Check if our listing is in results
  FOUND=$(echo "$BROWSE_RESPONSE" | jq -r ".items[] | select(.id == ${LISTING_ID}) | .id")
  if [ "$FOUND" == "$LISTING_ID" ]; then
    echo "   ✅ Published listing found in public results"
  else
    echo "   ⚠️  Listing not in first page of results (might be further down)"
  fi
else
  echo "❌ Public browse failed!"
  exit 1
fi

# Step 9: Browse with filters
echo ""
echo "Step 9: Testing filtered search..."
echo ""

FILTER_RESPONSE=$(curl -s -X GET "${API_URL}/public/listings?category=grooming&state=TX&limit=10" \
  -H "Accept: application/json")

echo "Filtered Search Response:"
echo "$FILTER_RESPONSE" | jq .
echo ""

if echo "$FILTER_RESPONSE" | jq -e '.items' > /dev/null; then
  echo "✅ Filtered search successful!"

  # Check if our listing is in filtered results
  FOUND=$(echo "$FILTER_RESPONSE" | jq -r ".items[] | select(.id == ${LISTING_ID}) | .id")
  if [ "$FOUND" == "$LISTING_ID" ]; then
    echo "   ✅ Listing found in filtered results (category: grooming, state: TX)"
  fi
else
  echo "❌ Filtered search failed!"
  exit 1
fi

# Step 10: Search by keyword
echo ""
echo "Step 10: Testing keyword search..."
echo ""

SEARCH_RESPONSE=$(curl -s -X GET "${API_URL}/public/listings?search=dog+grooming&limit=10" \
  -H "Accept: application/json")

echo "Keyword Search Response:"
echo "$SEARCH_RESPONSE" | jq .
echo ""

if echo "$SEARCH_RESPONSE" | jq -e '.items' > /dev/null; then
  echo "✅ Keyword search successful!"

  # Check if our listing is in search results
  FOUND=$(echo "$SEARCH_RESPONSE" | jq -r ".items[] | select(.id == ${LISTING_ID}) | .id")
  if [ "$FOUND" == "$LISTING_ID" ]; then
    echo "   ✅ Listing found in search results (search: dog grooming)"
  fi
else
  echo "❌ Keyword search failed!"
  exit 1
fi

# Step 11: View public listing detail
echo ""
echo "Step 11: Viewing public listing detail..."
echo ""

PUBLIC_DETAIL_RESPONSE=$(curl -s -X GET "${API_URL}/public/listings/${LISTING_SLUG}" \
  -H "Accept: application/json")

echo "Public Detail Response:"
echo "$PUBLIC_DETAIL_RESPONSE" | jq .
echo ""

if echo "$PUBLIC_DETAIL_RESPONSE" | jq -e '.id' > /dev/null; then
  echo "✅ Public listing detail retrieved!"

  # Verify provider info included
  if echo "$PUBLIC_DETAIL_RESPONSE" | jq -e '.provider' > /dev/null; then
    echo "   ✅ Provider info included"
    BUSINESS_NAME=$(echo "$PUBLIC_DETAIL_RESPONSE" | jq -r '.provider.businessName')
    echo "   Provider: $BUSINESS_NAME"
  else
    echo "   ❌ Provider info missing"
    exit 1
  fi
else
  echo "❌ Public listing detail failed!"
  exit 1
fi

# Step 12: Unpublish listing
echo ""
echo "Step 12: Unpublishing listing..."
echo ""

UNPUBLISH_RESPONSE=$(curl -s -X POST "${API_URL}/listings/${LISTING_ID}/unpublish" \
  -H "Accept: application/json" \
  -b cookies.txt)

echo "Unpublish Response:"
echo "$UNPUBLISH_RESPONSE" | jq .
echo ""

if echo "$UNPUBLISH_RESPONSE" | jq -e '.ok' > /dev/null; then
  echo "✅ Listing unpublished successfully!"

  UNPUB_STATUS=$(echo "$UNPUBLISH_RESPONSE" | jq -r '.listing.status')
  if [ "$UNPUB_STATUS" == "draft" ]; then
    echo "   ✅ Status changed back to 'draft'"
  else
    echo "   ❌ Status incorrect: $UNPUB_STATUS"
    exit 1
  fi
else
  echo "❌ Listing unpublish failed!"
  exit 1
fi

# Step 13: Verify unpublished listing not in public browse
echo ""
echo "Step 13: Verifying unpublished listing not public..."
echo ""

PUBLIC_CHECK=$(curl -s -X GET "${API_URL}/public/listings/${LISTING_SLUG}" \
  -H "Accept: application/json")

echo "Public Check Response:"
echo "$PUBLIC_CHECK" | jq .
echo ""

if echo "$PUBLIC_CHECK" | jq -e '.error' > /dev/null; then
  echo "✅ Unpublished listing correctly not accessible publicly!"
else
  echo "❌ Unpublished listing still accessible!"
  exit 1
fi

# Step 14: Re-publish for delete test
echo ""
echo "Step 14: Re-publishing for delete test..."
echo ""

curl -s -X POST "${API_URL}/listings/${LISTING_ID}/publish" \
  -H "Accept: application/json" \
  -b cookies.txt > /dev/null

echo "✅ Re-published"
echo ""

# Step 15: Soft delete listing
echo ""
echo "Step 15: Soft deleting listing..."
echo ""

DELETE_RESPONSE=$(curl -s -X DELETE "${API_URL}/listings/${LISTING_ID}" \
  -H "Accept: application/json" \
  -b cookies.txt)

echo "Delete Response:"
echo "$DELETE_RESPONSE" | jq .
echo ""

if echo "$DELETE_RESPONSE" | jq -e '.ok' > /dev/null; then
  echo "✅ Listing soft deleted successfully!"
else
  echo "❌ Listing delete failed!"
  exit 1
fi

# Step 16: Verify deleted listing not in provider list
echo ""
echo "Step 16: Verifying deleted listing not in list..."
echo ""

FINAL_LIST=$(curl -s -X GET "${API_URL}/listings?limit=100" \
  -H "Accept: application/json" \
  -b cookies.txt)

FOUND_DELETED=$(echo "$FINAL_LIST" | jq -r ".items[] | select(.id == ${LISTING_ID}) | .id")
if [ -z "$FOUND_DELETED" ]; then
  echo "✅ Deleted listing correctly excluded from list!"
else
  echo "❌ Deleted listing still appears in list!"
  exit 1
fi

# Step 17: Test validation - create without title
echo ""
echo "Step 17: Testing validation (missing title)..."
echo ""

INVALID_RESPONSE=$(curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -b cookies.txt \
  -d '{
    "category": "grooming"
  }')

echo "Validation Test Response:"
echo "$INVALID_RESPONSE" | jq .
echo ""

if echo "$INVALID_RESPONSE" | jq -e '.error' | grep -q "title_required"; then
  echo "✅ Validation working (rejected missing title)!"
else
  echo "❌ Validation failed to catch missing title!"
  exit 1
fi

# Step 18: Test validation - invalid category
echo ""
echo "Step 18: Testing validation (invalid category)..."
echo ""

INVALID_CAT_RESPONSE=$(curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Test",
    "category": "invalid_category"
  }')

echo "Category Validation Response:"
echo "$INVALID_CAT_RESPONSE" | jq .
echo ""

if echo "$INVALID_CAT_RESPONSE" | jq -e '.error' | grep -q "invalid_category"; then
  echo "✅ Category validation working!"
else
  echo "❌ Category validation failed!"
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
echo "  • Provider registration: ✅"
echo "  • Create listing: ✅"
echo "  • List provider listings: ✅"
echo "  • Get listing detail: ✅"
echo "  • Update listing: ✅"
echo "  • Publish listing: ✅"
echo "  • Public browse: ✅"
echo "  • Filtered search: ✅"
echo "  • Keyword search: ✅"
echo "  • Public detail view: ✅"
echo "  • Unpublish listing: ✅"
echo "  • Verify unpublished hidden: ✅"
echo "  • Soft delete: ✅"
echo "  • Verify deleted hidden: ✅"
echo "  • Validation (title): ✅"
echo "  • Validation (category): ✅"
echo ""
echo "Test user: $TEST_EMAIL"
echo "Provider ID: $PROVIDER_ID"
echo "Listing ID: $LISTING_ID"
echo "Listing Slug: $LISTING_SLUG"
echo ""
