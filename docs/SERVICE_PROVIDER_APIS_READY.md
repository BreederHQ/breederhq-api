# Service Provider Portal APIs - Ready for Testing

**Date:** January 16, 2026
**Status:** 2 of 7 APIs Complete and Deployed

---

## ✅ COMPLETED AND DEPLOYED

### 1. Service Tags API
**File:** [src/routes/marketplace-service-tags.ts](../src/routes/marketplace-service-tags.ts)
**Registered:** `GET/POST /api/v1/marketplace/service-tags`

**Endpoints:**
- `GET /api/v1/marketplace/service-tags?q=search&suggested=true&limit=100`
  - Search and filter tags
  - Case-insensitive search
  - Sort by: suggested → usage count → alphabetical
  - Rate limit: 60 req/min

- `POST /api/v1/marketplace/service-tags`
  - Body: `{ "name": "Tag Name" }`
  - Auto-generates URL-safe slug
  - Duplicate checking (case-insensitive)
  - Initializes with usageCount=0, suggested=false
  - Rate limit: 10 req/min

**Testing:**
```bash
# Search tags
curl http://localhost:6001/api/v1/marketplace/service-tags?q=horse

# Create tag
curl -X POST http://localhost:6001/api/v1/marketplace/service-tags \
  -H "Content-Type: application/json" \
  -d '{"name": "Equine Massage"}'
```

---

### 2. S3 Image Upload API
**File:** [src/routes/marketplace-image-upload.ts](../src/routes/marketplace-image-upload.ts)
**Registered:** `POST/DELETE /api/v1/marketplace/images/*`

**Endpoints:**
- `POST /api/v1/marketplace/images/upload-url`
  - Body: `{ "filename": "photo.jpg", "contentType": "image/jpeg", "context": "service_listing" }`
  - Returns presigned S3 URL (expires in 5 min)
  - Returns CDN URL for storage
  - Generates unique S3 key: `{context}/{userId}/{uuid}.{ext}`
  - Supported types: JPEG, PNG, WEBP, HEIC
  - Max file size: 10MB
  - Rate limit: 20 req/min

- `DELETE /api/v1/marketplace/images/:key`
  - Deletes image from S3
  - Verifies ownership (key must contain userId)
  - Rate limit: 10 req/min

**Environment Variables Required:**
```bash
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=breederhq-assets
CDN_DOMAIN=cdn.breederhq.com
```

**S3 Bucket Setup Required:**
1. Create bucket with public read access
2. Configure CORS to allow PUT from your domains
3. Set up CloudFront CDN (optional but recommended)

**Testing:**
```bash
# Get presigned URL
curl -X POST http://localhost:6001/api/v1/marketplace/images/upload-url \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.jpg", "contentType": "image/jpeg", "context": "service_listing"}'

# Upload to S3 (use uploadUrl from response)
curl -X PUT "PRESIGNED_URL" \
  -H "Content-Type: image/jpeg" \
  --upload-file test.jpg
```

---

## 📋 DEPENDENCIES INSTALLED

```json
{
  "@aws-sdk/client-s3": "^3.x",
  "@aws-sdk/s3-request-presigner": "^3.x",
  "uuid": "^13.0.0",
  "@types/uuid": "^10.0.0"
}
```

**Note:** Using AWS SDK v3 (latest) - no deprecation warnings!

---

## 🟡 REMAINING WORK (5 APIs)

### 3. Update Service Listings API
**File:** `src/routes/marketplace-listings.ts` (EXISTS - needs updates)
**What to Add:**
- Support `customServiceType` field (string, max 50 chars)
- Support `tagIds` array (number[], max 5 tags)
- Support `images` array (string[], max 10 URLs)
- Tag assignment logic in transactions
- Increment/decrement tag usage counts
- Include tags in responses

### 4. Service Detail API
**File:** NEW - `src/routes/marketplace-service-detail.ts`
**Endpoint:** `GET /api/v1/marketplace/services/:slugOrId`
- Support both slug and ID routing
- Return public view with provider contact
- Increment view count (async)
- Include populated tags

### 5. Abuse Reporting API
**File:** NEW - `src/routes/marketplace-abuse-reports.ts`
**Endpoint:** `POST /api/v1/marketplace/listings/report`
- Validate reason enum (7 categories)
- Rate limit: 5 reports/hour
- Auto-flag at 3+ reports in 24h
- Send admin notification

### 6. Identity Verification API
**File:** NEW - `src/routes/marketplace-identity-verification.ts`
**Endpoints:**
- `POST /api/v1/marketplace/identity/verify` - Start Stripe session
- `POST /api/webhooks/stripe/identity` - Webhook handler
- Requires 2FA enabled first
- Updates verification tier on success

### 7. Admin Moderation Queue API
**File:** NEW - `src/routes/marketplace-admin-moderation.ts`
**Endpoints:**
- `GET /api/v1/marketplace/admin/listing-reports` - List reports
- `PUT /api/v1/marketplace/admin/listing-reports/:id` - Update status
- Requires admin role
- Masks reporter emails for privacy

---

## 🚀 DEPLOYMENT CHECKLIST

- [x] Install dependencies (uuid, aws-sdk)
- [x] Create service tags route file
- [x] Create image upload route file
- [x] Register routes in server.ts
- [x] Verify server starts without errors
- [ ] Run database migration: `add_service_provider_portal_tables`
- [ ] Configure AWS credentials in .env.dev
- [ ] Set up S3 bucket and CORS
- [ ] Test tag creation and search
- [ ] Test S3 upload flow end-to-end

---

## 📊 PROGRESS

**APIs:** 2 of 7 complete (28.6%)
**Database:** Schema defined, migration pending
**Frontend:** 100% complete and waiting for backend
**Environment:** Partially configured (needs AWS setup)

---

## 🔗 RELATED DOCUMENTATION

- [Frontend Complete](../../breederhq/docs/features/SERVICE_PROVIDER_PORTAL_COMPLETE.md)
- [Backend Implementation Guide](SERVICE_PROVIDER_API_IMPLEMENTATION.md)
- [Admin Moderation API](ADMIN_MODERATION_API.md)
- [Backend Status Tracker](../../breederhq/docs/features/BACKEND_IMPLEMENTATION_STATUS.md)

---

**Last Updated:** January 16, 2026
**Server Status:** ✅ Running and accepting requests
**Next Priority:** Database migration, then update Service Listings API
