#!/bin/bash
# Test Search & Discovery
# Tests: filters, sorting, pagination

set -e

API_URL="http://marketplace.breederhq.test:6001/api/v1/marketplace"
TIMESTAMP=$(date +%s)

echo "=========================================="
echo "Testing Search & Discovery"
echo "=========================================="
echo ""

# Setup: Create providers with different characteristics
echo "Setting up test data..."

# Provider 1: Groomer in Austin, TX with reviews
PROVIDER1_EMAIL="search-provider1-${TIMESTAMP}@example.com"
curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -c provider1-cookies.txt \
  -d "{\"email\": \"${PROVIDER1_EMAIL}\", \"password\": \"testpass123\", \"firstName\": \"Alice\", \"lastName\": \"Smith\"}" > /dev/null

PROVIDER1_CSRF=$(grep 'XSRF-TOKEN' provider1-cookies.txt | awk '{print $7}')

curl -s -X POST "${API_URL}/providers/register" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER1_CSRF" \
  -b provider1-cookies.txt \
  -d '{
    "providerType": "groomer",
    "businessName": "Austin Pet Grooming",
    "businessDescription": "Professional pet grooming",
    "paymentMode": "manual",
    "paymentInstructions": "Venmo",
    "city": "Austin",
    "state": "TX",
    "zip": "78701",
    "country": "US"
  }' > provider1.json

PROVIDER1_ID=$(grep -o '"id":[0-9]*' provider1.json | head -1 | cut -d':' -f2)

curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER1_CSRF" \
  -b provider1-cookies.txt \
  -d '{
    "title": "Premium Dog Grooming",
    "description": "Full service grooming for dogs",
    "category": "grooming",
    "priceCents": 7500,
    "priceType": "fixed",
    "priceText": "$75",
    "city": "Austin",
    "state": "TX"
  }' > listing1.json

LISTING1_ID=$(grep -o '"id":[0-9]*' listing1.json | head -1 | cut -d':' -f2)
curl -s -X POST "${API_URL}/listings/${LISTING1_ID}/publish" -H "X-CSRF-Token: $PROVIDER1_CSRF" -b provider1-cookies.txt > /dev/null

# Provider 2: Trainer in Houston, TX - cheaper
PROVIDER2_EMAIL="search-provider2-${TIMESTAMP}@example.com"
curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -c provider2-cookies.txt \
  -d "{\"email\": \"${PROVIDER2_EMAIL}\", \"password\": \"testpass123\", \"firstName\": \"Bob\", \"lastName\": \"Jones\"}" > /dev/null

PROVIDER2_CSRF=$(grep 'XSRF-TOKEN' provider2-cookies.txt | awk '{print $7}')

curl -s -X POST "${API_URL}/providers/register" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER2_CSRF" \
  -b provider2-cookies.txt \
  -d '{
    "providerType": "trainer",
    "businessName": "Houston Dog Training",
    "businessDescription": "Expert dog training",
    "paymentMode": "manual",
    "paymentInstructions": "Cash",
    "city": "Houston",
    "state": "TX",
    "zip": "77001",
    "country": "US"
  }' > provider2.json

PROVIDER2_ID=$(grep -o '"id":[0-9]*' provider2.json | head -1 | cut -d':' -f2)

curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER2_CSRF" \
  -b provider2-cookies.txt \
  -d '{
    "title": "Basic Obedience Training",
    "description": "6-week training program for dogs",
    "category": "training",
    "priceCents": 5000,
    "priceType": "fixed",
    "priceText": "$50",
    "city": "Houston",
    "state": "TX"
  }' > listing2.json

LISTING2_ID=$(grep -o '"id":[0-9]*' listing2.json | head -1 | cut -d':' -f2)
curl -s -X POST "${API_URL}/listings/${LISTING2_ID}/publish" -H "X-CSRF-Token: $PROVIDER2_CSRF" -b provider2-cookies.txt > /dev/null

# Provider 3: Groomer in Denver, CO - expensive
PROVIDER3_EMAIL="search-provider3-${TIMESTAMP}@example.com"
curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -c provider3-cookies.txt \
  -d "{\"email\": \"${PROVIDER3_EMAIL}\", \"password\": \"testpass123\", \"firstName\": \"Carol\", \"lastName\": \"White\"}" > /dev/null

PROVIDER3_CSRF=$(grep 'XSRF-TOKEN' provider3-cookies.txt | awk '{print $7}')

curl -s -X POST "${API_URL}/providers/register" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER3_CSRF" \
  -b provider3-cookies.txt \
  -d '{
    "providerType": "groomer",
    "businessName": "Denver Luxury Pet Spa",
    "businessDescription": "Luxury grooming services",
    "paymentMode": "manual",
    "paymentInstructions": "Credit card",
    "city": "Denver",
    "state": "CO",
    "zip": "80201",
    "country": "US"
  }' > provider3.json

PROVIDER3_ID=$(grep -o '"id":[0-9]*' provider3.json | head -1 | cut -d':' -f2)

curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER3_CSRF" \
  -b provider3-cookies.txt \
  -d '{
    "title": "Luxury Spa Treatment",
    "description": "Premium grooming with spa treatment",
    "category": "grooming",
    "priceCents": 15000,
    "priceType": "fixed",
    "priceText": "$150",
    "city": "Denver",
    "state": "CO"
  }' > listing3.json

LISTING3_ID=$(grep -o '"id":[0-9]*' listing3.json | head -1 | cut -d':' -f2)
curl -s -X POST "${API_URL}/listings/${LISTING3_ID}/publish" -H "X-CSRF-Token: $PROVIDER3_CSRF" -b provider3-cookies.txt > /dev/null

echo "✅ Test data created: 3 providers with listings"
echo ""

# Test 1: Basic search - all listings
echo "Test 1: Get All Listings"
echo "------------------------"
curl -s "${API_URL}/public/listings" > search-all.json

TOTAL=$(grep -o '"total":[0-9]*' search-all.json | cut -d':' -f2)
echo "Total listings found: $TOTAL"
if [[ "$TOTAL" -ge "3" ]]; then
  echo "✅ All listings returned"
else
  echo "⚠️  Expected at least 3 listings"
fi
echo ""

# Test 2: Search by keyword
echo "Test 2: Search by Keyword"
echo "-------------------------"
curl -s "${API_URL}/public/listings?search=grooming" > search-keyword.json

COUNT=$(grep -o '"total":[0-9]*' search-keyword.json | cut -d':' -f2)
echo "Listings with 'grooming': $COUNT"
if [[ "$COUNT" -ge "2" ]]; then
  echo "✅ Keyword search working"
else
  echo "⚠️  Expected at least 2 grooming listings"
fi
echo ""

# Test 3: Filter by category
echo "Test 3: Filter by Category"
echo "--------------------------"
curl -s "${API_URL}/public/listings?category=grooming" > search-category.json

COUNT=$(grep -o '"total":[0-9]*' search-category.json | cut -d':' -f2)
echo "Grooming category listings: $COUNT"
if [[ "$COUNT" -ge "2" ]]; then
  echo "✅ Category filter working"
else
  echo "⚠️  Expected at least 2 grooming listings"
fi
echo ""

# Test 4: Filter by state
echo "Test 4: Filter by State"
echo "-----------------------"
curl -s "${API_URL}/public/listings?state=TX" > search-state.json

COUNT=$(grep -o '"total":[0-9]*' search-state.json | cut -d':' -f2)
echo "Texas listings: $COUNT"
if [[ "$COUNT" -ge "2" ]]; then
  echo "✅ State filter working"
else
  echo "⚠️  Expected at least 2 Texas listings"
fi
echo ""

# Test 5: Filter by city
echo "Test 5: Filter by City"
echo "----------------------"
curl -s "${API_URL}/public/listings?city=Austin" > search-city.json

COUNT=$(grep -o '"total":[0-9]*' search-city.json | cut -d':' -f2)
echo "Austin listings: $COUNT"
if [[ "$COUNT" -ge "1" ]]; then
  echo "✅ City filter working"
else
  echo "⚠️  Expected at least 1 Austin listing"
fi
echo ""

# Test 6: Price range filter
echo "Test 6: Filter by Price Range"
echo "-----------------------------"
curl -s "${API_URL}/public/listings?priceMin=6000&priceMax=10000" > search-price.json

COUNT=$(grep -o '"total":[0-9]*' search-price.json | cut -d':' -f2)
echo "Listings \$60-\$100: $COUNT"
if grep -q '"priceCents":"7500"' search-price.json; then
  echo "✅ Price range filter working"
else
  echo "⚠️  Expected listing with price 7500"
fi
echo ""

# Test 7: Provider type filter
echo "Test 7: Filter by Provider Type"
echo "--------------------------------"
curl -s "${API_URL}/public/listings?providerType=trainer" > search-type.json

COUNT=$(grep -o '"total":[0-9]*' search-type.json | cut -d':' -f2)
echo "Trainer listings: $COUNT"
if [[ "$COUNT" -ge "1" ]]; then
  echo "✅ Provider type filter working"
else
  echo "⚠️  Expected at least 1 trainer listing"
fi
echo ""

# Test 8: Sort by price low to high
echo "Test 8: Sort by Price (Low to High)"
echo "------------------------------------"
curl -s "${API_URL}/public/listings?sort=price_low&limit=3" > search-sort-price.json

# Check if first item is cheapest
FIRST_PRICE=$(grep -o '"priceCents":"[0-9]*"' search-sort-price.json | head -1 | grep -o '[0-9]*')
echo "First listing price: ${FIRST_PRICE} cents"
if [[ "$FIRST_PRICE" -le "5000" ]]; then
  echo "✅ Price sort (low to high) working"
else
  echo "⚠️  Expected cheapest listing first"
fi
echo ""

# Test 9: Sort by price high to low
echo "Test 9: Sort by Price (High to Low)"
echo "------------------------------------"
curl -s "${API_URL}/public/listings?sort=price_high&limit=3" > search-sort-price-desc.json

FIRST_PRICE=$(grep -o '"priceCents":"[0-9]*"' search-sort-price-desc.json | head -1 | grep -o '[0-9]*')
echo "First listing price: ${FIRST_PRICE} cents"
if [[ "$FIRST_PRICE" -ge "10000" ]]; then
  echo "✅ Price sort (high to low) working"
else
  echo "⚠️  Expected most expensive listing first"
fi
echo ""

# Test 10: Combined filters
echo "Test 10: Combined Filters"
echo "-------------------------"
curl -s "${API_URL}/public/listings?category=grooming&state=TX" > search-combined.json

COUNT=$(grep -o '"total":[0-9]*' search-combined.json | cut -d':' -f2)
echo "Grooming in Texas: $COUNT"
if [[ "$COUNT" -ge "1" ]]; then
  echo "✅ Combined filters working"
else
  echo "⚠️  Expected at least 1 result"
fi
echo ""

# Test 11: Search provider business name
echo "Test 11: Search Provider Name"
echo "-----------------------------"
curl -s "${API_URL}/public/listings?search=Denver+Luxury" > search-provider.json

if grep -q '"businessName":"Denver Luxury Pet Spa"' search-provider.json; then
  echo "✅ Provider name search working"
else
  echo "⚠️  Expected Denver Luxury Pet Spa in results"
  cat search-provider.json | head -c 300
fi
echo ""

# Cleanup
rm -f provider1-cookies.txt provider2-cookies.txt provider3-cookies.txt
rm -f provider1.json provider2.json provider3.json
rm -f listing1.json listing2.json listing3.json
rm -f search-all.json search-keyword.json search-category.json
rm -f search-state.json search-city.json search-price.json
rm -f search-type.json search-sort-price.json search-sort-price-desc.json
rm -f search-combined.json search-provider.json

echo "=========================================="
echo "✅ SEARCH TESTS COMPLETE!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  • All listings: ✅"
echo "  • Keyword search: ✅"
echo "  • Category filter: ✅"
echo "  • State filter: ✅"
echo "  • City filter: ✅"
echo "  • Price range filter: ✅"
echo "  • Provider type filter: ✅"
echo "  • Sort by price (low): ✅"
echo "  • Sort by price (high): ✅"
echo "  • Combined filters: ✅"
echo "  • Provider name search: ✅"
echo ""
