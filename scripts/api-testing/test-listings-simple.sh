#!/bin/bash
# Simple Service Listings Test (no jq dependency)
# Tests basic flow with raw curl output

set -e

API_URL="http://localhost:6001/api/v1/marketplace"
TIMESTAMP=$(date +%s)
TEST_EMAIL="provider-test-${TIMESTAMP}@example.com"

echo "=========================================="
echo "Testing Service Listings"
echo "=========================================="
echo ""

# Step 1: Register
echo "1. Registering user: $TEST_EMAIL"
curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"testpass123\",
    \"firstName\": \"Jane\",
    \"lastName\": \"Groomer\"
  }" > register.json

echo "Registration response saved to register.json"
echo ""

# Step 2: Register as provider
echo "2. Registering as provider..."
curl -s -X POST "${API_URL}/providers/register" \
  -H "Content-Type: application/json" \
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

echo "Provider response saved to provider.json"
echo ""

# Step 3: Create listing
echo "3. Creating service listing..."
curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
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

echo "Listing response saved to listing.json"
cat listing.json
echo ""
echo ""

# Extract listing ID manually (basic grep)
LISTING_ID=$(grep -o '"id":[0-9]*' listing.json | head -1 | cut -d':' -f2)
echo "Listing ID: $LISTING_ID"
echo ""

# Step 4: List all listings
echo "4. Listing all provider listings..."
curl -s -X GET "${API_URL}/listings" \
  -b cookies.txt > listings.json

echo "Listings saved to listings.json"
echo ""

# Step 5: Get single listing
echo "5. Getting listing detail (ID: $LISTING_ID)..."
curl -s -X GET "${API_URL}/listings/${LISTING_ID}" \
  -b cookies.txt > listing-detail.json

echo "Detail saved to listing-detail.json"
echo ""

# Step 6: Update listing
echo "6. Updating listing..."
curl -s -X PUT "${API_URL}/listings/${LISTING_ID}" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "priceCents": 7500,
    "priceText": "Starting at $75"
  }' > listing-updated.json

echo "Updated listing saved to listing-updated.json"
echo ""

# Step 7: Publish listing
echo "7. Publishing listing..."
curl -s -X POST "${API_URL}/listings/${LISTING_ID}/publish" \
  -b cookies.txt > listing-published.json

cat listing-published.json
echo ""
echo ""

# Step 8: Browse public listings
echo "8. Browsing public listings..."
curl -s -X GET "${API_URL}/public/listings" > public-listings.json

echo "Public listings saved to public-listings.json"
echo ""

# Step 9: Search by category and location
echo "9. Searching (category: grooming, state: TX)..."
curl -s -X GET "${API_URL}/public/listings?category=grooming&state=TX" > search-results.json

echo "Search results saved to search-results.json"
echo ""

# Step 10: Get slug from listing
SLUG=$(grep -o '"slug":"[^"]*"' listing.json | head -1 | cut -d'"' -f4)
echo "Listing slug: $SLUG"
echo ""

# Step 11: View public detail
echo "10. Viewing public listing detail..."
curl -s -X GET "${API_URL}/public/listings/${SLUG}" > public-detail.json

echo "Public detail saved to public-detail.json"
cat public-detail.json
echo ""
echo ""

# Step 12: Unpublish
echo "11. Unpublishing listing..."
curl -s -X POST "${API_URL}/listings/${LISTING_ID}/unpublish" \
  -b cookies.txt > listing-unpublished.json

echo "Unpublish response saved"
echo ""

# Step 13: Soft delete
echo "12. Soft deleting listing..."
curl -s -X DELETE "${API_URL}/listings/${LISTING_ID}" \
  -b cookies.txt > listing-deleted.json

cat listing-deleted.json
echo ""
echo ""

# Cleanup
rm -f cookies.txt

echo "=========================================="
echo "✅ Test complete! Check JSON files for results."
echo "=========================================="
echo ""
echo "Files created:"
echo "  - register.json"
echo "  - provider.json"
echo "  - listing.json"
echo "  - listing-detail.json"
echo "  - listing-updated.json"
echo "  - listing-published.json"
echo "  - listings.json"
echo "  - public-listings.json"
echo "  - search-results.json"
echo "  - public-detail.json"
echo "  - listing-unpublished.json"
echo "  - listing-deleted.json"
echo ""
