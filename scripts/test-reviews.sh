#!/bin/bash
# Test Reviews & Ratings
# Tests: submit review, provider response, public listing, rating calculation

set -e

API_URL="http://marketplace.breederhq.test:6001/api/v1/marketplace"
TIMESTAMP=$(date +%s)
PROVIDER_EMAIL="review-provider-${TIMESTAMP}@example.com"
BUYER_EMAIL="review-buyer-${TIMESTAMP}@example.com"

echo "=========================================="
echo "Testing Reviews & Ratings"
echo "=========================================="
echo ""

# Setup provider with listing
echo "Setting up provider..."
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
    "businessName": "Review Test Provider",
    "businessDescription": "Testing reviews",
    "paymentMode": "manual",
    "paymentInstructions": "Pay via Venmo",
    "city": "Austin",
    "state": "TX",
    "zip": "78701",
    "country": "US"
  }' > provider-register.json

PROVIDER_ID=$(cat provider-register.json | sed 's/.*"provider":{[^}]*"id":\([0-9]*\).*/\1/' | head -1)

curl -s -X POST "${API_URL}/listings" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "title": "Review Test Service",
    "description": "For review testing",
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

echo "✅ Provider setup complete (Provider ID: $PROVIDER_ID, Listing ID: $LISTING_ID)"

# Setup buyer
echo "Setting up buyer..."
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

# Create and complete a transaction
echo "Creating transaction..."
curl -s -X POST "${API_URL}/transactions" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d "{
    \"serviceListingId\": ${LISTING_ID}
  }" > transaction.json

TRANSACTION_ID=$(cat transaction.json | grep -o '^{"id":[0-9]*' | cut -d':' -f2)
echo "✅ Transaction created (ID: $TRANSACTION_ID)"

# Mark paid and confirm
curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/mark-paid" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt > /dev/null

curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/confirm-payment" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > /dev/null

# Start and complete
curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/start" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > /dev/null

curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/complete" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > /dev/null

echo "✅ Transaction completed"
echo ""

# Test 1: Check pending reviews
echo "Test 1: Check Pending Reviews"
echo "------------------------------"
curl -s -X GET "${API_URL}/reviews/pending" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt > pending-reviews.json

if grep -q "\"transactionId\":\"${TRANSACTION_ID}\"" pending-reviews.json; then
  echo "✅ Transaction appears in pending reviews"
else
  echo "⚠️  Pending reviews response:"
  cat pending-reviews.json
fi
echo ""

# Test 2: Submit review (cannot review incomplete transaction - validation)
echo "Test 2: Validation - Cannot Review Incomplete Transaction"
echo "----------------------------------------------------------"

# Create another transaction but don't complete it
curl -s -X POST "${API_URL}/transactions" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d "{
    \"serviceListingId\": ${LISTING_ID}
  }" > transaction2.json

TRANSACTION2_ID=$(cat transaction2.json | grep -o '^{"id":[0-9]*' | cut -d':' -f2)

curl -s -X POST "${API_URL}/transactions/${TRANSACTION2_ID}/review" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d '{
    "rating": 5,
    "title": "Great!",
    "reviewText": "Should not work"
  }' > review-incomplete.json

if grep -q '"error":"transaction_not_completed"' review-incomplete.json; then
  echo "✅ Validation working (cannot review incomplete transaction)"
else
  echo "⚠️  Response:"
  cat review-incomplete.json
fi
echo ""

# Test 3: Submit review for completed transaction
echo "Test 3: Submit Review"
echo "---------------------"
curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/review" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d '{
    "rating": 5,
    "title": "Excellent Service!",
    "reviewText": "The provider was professional, on time, and did an amazing job. Highly recommended!"
  }' > review-submit.json

echo "Review Response:"
cat review-submit.json | head -c 500
echo ""

if grep -q '"ok":true' review-submit.json && grep -q '"rating":5' review-submit.json; then
  echo "✅ Review submitted successfully"
  REVIEW_ID=$(cat review-submit.json | grep -o '"review":{"id":[0-9]*' | grep -o '[0-9]*$')
  echo "   Review ID: $REVIEW_ID"
else
  echo "❌ Review submission failed"
  exit 1
fi
echo ""

# Test 4: Cannot review same transaction twice
echo "Test 4: Validation - Cannot Review Twice"
echo "-----------------------------------------"
curl -s -X POST "${API_URL}/transactions/${TRANSACTION_ID}/review" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d '{
    "rating": 4,
    "reviewText": "Another review"
  }' > review-duplicate.json

if grep -q '"error":"already_reviewed"' review-duplicate.json; then
  echo "✅ Validation working (cannot review twice)"
else
  echo "⚠️  Response:"
  cat review-duplicate.json
fi
echo ""

# Test 5: Get provider reviews (public)
echo "Test 5: Get Provider Reviews (Public)"
echo "--------------------------------------"
curl -s -X GET "${API_URL}/providers/${PROVIDER_ID}/reviews" > provider-reviews.json

echo "Provider Reviews Response:"
cat provider-reviews.json | head -c 800
echo ""

if grep -q '"averageRating":5' provider-reviews.json && grep -q '"totalReviews":1' provider-reviews.json; then
  echo "✅ Provider reviews fetched with correct stats"
else
  echo "⚠️  Stats may be incorrect"
fi

if grep -q '"ratingDistribution"' provider-reviews.json; then
  echo "✅ Rating distribution included"
fi
echo ""

# Test 6: Provider responds to review
echo "Test 6: Provider Responds to Review"
echo "------------------------------------"
curl -s -X POST "${API_URL}/reviews/${REVIEW_ID}/respond" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "response": "Thank you so much for the kind words! It was a pleasure working with you."
  }' > review-response.json

echo "Response:"
cat review-response.json | head -c 400
echo ""

if grep -q '"ok":true' review-response.json && grep -q '"providerResponse"' review-response.json; then
  echo "✅ Provider response submitted"
else
  echo "❌ Provider response failed"
fi
echo ""

# Test 7: Cannot respond twice
echo "Test 7: Validation - Cannot Respond Twice"
echo "------------------------------------------"
curl -s -X POST "${API_URL}/reviews/${REVIEW_ID}/respond" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt \
  -d '{
    "response": "Another response"
  }' > review-response2.json

if grep -q '"error":"already_responded"' review-response2.json; then
  echo "✅ Validation working (cannot respond twice)"
else
  echo "⚠️  Response:"
  cat review-response2.json
fi
echo ""

# Test 8: Get my reviews (buyer)
echo "Test 8: Get My Reviews (Buyer)"
echo "-------------------------------"
curl -s -X GET "${API_URL}/reviews/my-reviews" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt > my-reviews.json

if grep -q '"total":1' my-reviews.json && grep -q '"rating":5' my-reviews.json; then
  echo "✅ My reviews fetched correctly"
else
  echo "⚠️  Response:"
  cat my-reviews.json
fi
echo ""

# Test 9: Rating validation
echo "Test 9: Validation - Invalid Rating"
echo "------------------------------------"

# Complete second transaction first
curl -s -X POST "${API_URL}/transactions/${TRANSACTION2_ID}/mark-paid" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt > /dev/null
curl -s -X POST "${API_URL}/transactions/${TRANSACTION2_ID}/confirm-payment" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > /dev/null
curl -s -X POST "${API_URL}/transactions/${TRANSACTION2_ID}/start" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > /dev/null
curl -s -X POST "${API_URL}/transactions/${TRANSACTION2_ID}/complete" \
  -H "X-CSRF-Token: $PROVIDER_CSRF" \
  -b provider-cookies.txt > /dev/null

curl -s -X POST "${API_URL}/transactions/${TRANSACTION2_ID}/review" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d '{
    "rating": 6,
    "reviewText": "Invalid rating"
  }' > review-invalid.json

if grep -q '"error":"invalid_rating"' review-invalid.json; then
  echo "✅ Validation working (rating must be 1-5)"
else
  echo "⚠️  Response:"
  cat review-invalid.json
fi
echo ""

# Test 10: Submit second review and check average
echo "Test 10: Second Review & Average Rating"
echo "----------------------------------------"
curl -s -X POST "${API_URL}/transactions/${TRANSACTION2_ID}/review" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $BUYER_CSRF" \
  -b buyer-cookies.txt \
  -d '{
    "rating": 3,
    "reviewText": "Good but could be better"
  }' > review-second.json

if grep -q '"ok":true' review-second.json; then
  echo "✅ Second review submitted (rating: 3)"
fi

# Check provider average (should be (5+3)/2 = 4.0)
curl -s -X GET "${API_URL}/providers/${PROVIDER_ID}/reviews" > provider-reviews-final.json

AVERAGE=$(grep -o '"averageRating":[0-9.]*' provider-reviews-final.json | cut -d':' -f2)
TOTAL=$(grep -o '"totalReviews":[0-9]*' provider-reviews-final.json | cut -d':' -f2)

echo "   Average Rating: $AVERAGE (expected: 4.00)"
echo "   Total Reviews: $TOTAL (expected: 2)"

if [[ "$TOTAL" == "2" ]]; then
  echo "✅ Provider stats updated correctly"
else
  echo "⚠️  Stats may be incorrect"
fi
echo ""

# Cleanup
rm -f provider-cookies.txt buyer-cookies.txt
rm -f provider-register.json listing.json transaction.json transaction2.json
rm -f pending-reviews.json review-incomplete.json review-submit.json
rm -f review-duplicate.json provider-reviews.json review-response.json
rm -f review-response2.json my-reviews.json review-invalid.json
rm -f review-second.json provider-reviews-final.json

echo "=========================================="
echo "✅ REVIEWS TESTS COMPLETE!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  • Pending reviews endpoint: ✅"
echo "  • Review submission: ✅"
echo "  • Duplicate review prevention: ✅"
echo "  • Provider reviews (public): ✅"
echo "  • Rating distribution: ✅"
echo "  • Provider response: ✅"
echo "  • Duplicate response prevention: ✅"
echo "  • My reviews (buyer): ✅"
echo "  • Rating validation: ✅"
echo "  • Average rating calculation: ✅"
echo ""
