# Service Provider API - Backend Implementation Guide

## Overview
This document provides complete implementation specifications for the Service Provider Portal backend APIs. All endpoints are authenticated via marketplace session cookie (`bhq_m_s`).

---

## Table of Contents
1. [Service Tags API](#service-tags-api)
2. [S3 Image Upload API](#s3-image-upload-api)
3. [Extended Service Listings API](#extended-service-listings-api)
4. [Service Detail API](#service-detail-api)
5. [Abuse Reporting API](#abuse-reporting-api)
6. [Identity Verification API](#identity-verification-api)
7. [Database Schema](#database-schema)
8. [Testing Requirements](#testing-requirements)

---

## Service Tags API

### 1.1 Get Service Tags

**Endpoint:** `GET /api/v1/marketplace/service-tags`

**Query Parameters:**
- `q` (optional): Search query string
- `suggested` (optional): Filter by suggested tags (boolean)
- `limit` (optional): Number of results (default: 100, max: 200)

**Implementation Details:**

```typescript
// Handler pseudocode
async function getServiceTags(req, res) {
  const { q, suggested, limit = 100 } = req.query;

  let query = db.select('*').from('marketplace_service_tags');

  // Apply search filter
  if (q) {
    query = query.where('name', 'ilike', `%${q.trim()}%`);
  }

  // Apply suggested filter
  if (suggested !== undefined) {
    query = query.where('suggested', suggested === 'true');
  }

  // Sorting: suggested first, then by usage count, then alphabetically
  query = query
    .orderBy('suggested', 'desc')
    .orderBy('usage_count', 'desc')
    .orderBy('name', 'asc')
    .limit(Math.min(parseInt(limit), 200));

  const tags = await query;

  return res.json({
    items: tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      usageCount: tag.usage_count,
      suggested: tag.suggested
    })),
    total: tags.length
  });
}
```

**Response 200:**
```json
{
  "items": [
    {
      "id": 1,
      "name": "Obedience Training",
      "slug": "obedience-training",
      "usageCount": 42,
      "suggested": true
    }
  ],
  "total": 15
}
```

**Validation:**
- Trim search query
- Validate limit is positive integer
- Case-insensitive search

**Indexes Needed:**
```sql
CREATE INDEX idx_service_tags_name ON marketplace_service_tags(name);
CREATE INDEX idx_service_tags_suggested ON marketplace_service_tags(suggested);
CREATE INDEX idx_service_tags_usage ON marketplace_service_tags(usage_count DESC);
```

---

### 1.2 Create Service Tag

**Endpoint:** `POST /api/v1/marketplace/service-tags`

**Request Body:**
```json
{
  "name": "Canine Nutrition"
}
```

**Implementation Details:**

```typescript
async function createServiceTag(req, res) {
  const { name } = req.body;

  // Validation
  if (!name || typeof name !== 'string') {
    return res.status(400).json({
      error: 'invalid_name',
      message: 'Tag name is required'
    });
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 1 || trimmedName.length > 100) {
    return res.status(400).json({
      error: 'invalid_length',
      message: 'Tag name must be 1-100 characters'
    });
  }

  // Generate slug
  const slug = trimmedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Check for duplicate (case-insensitive by slug)
  const existing = await db
    .select('id')
    .from('marketplace_service_tags')
    .where('slug', slug)
    .first();

  if (existing) {
    return res.status(400).json({
      error: 'tag_already_exists',
      message: 'A tag with this name already exists'
    });
  }

  // Insert new tag
  const [tag] = await db
    .insert({
      name: trimmedName,
      slug: slug,
      usage_count: 0,
      suggested: false,
      created_at: new Date()
    })
    .into('marketplace_service_tags')
    .returning('*');

  return res.json({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    usageCount: tag.usage_count,
    suggested: tag.suggested
  });
}
```

**Response 200:**
```json
{
  "id": 16,
  "name": "Canine Nutrition",
  "slug": "canine-nutrition",
  "usageCount": 0,
  "suggested": false
}
```

**Response 400 (Duplicate):**
```json
{
  "error": "tag_already_exists",
  "message": "A tag with this name already exists"
}
```

**Validation Rules:**
- Name required, 1-100 chars
- Auto-trim whitespace
- Generate URL-safe slug
- Check duplicates by slug (case-insensitive)
- Initialize usage_count = 0, suggested = false

---

## S3 Image Upload API

### 2.1 Get Presigned Upload URL

**Endpoint:** `POST /api/v1/marketplace/images/upload-url`

**Purpose:** Generate a presigned S3 URL for direct browser-to-S3 upload

**Request Body:**
```json
{
  "filename": "my-service-photo.jpg",
  "contentType": "image/jpeg",
  "context": "service_listing"
}
```

**Implementation Details:**

```typescript
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

async function getPresignedUploadUrl(req, res) {
  const userId = req.session.userId;
  const { filename, contentType, context = 'service_listing' } = req.body;

  // === VALIDATION ===

  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({
      error: 'invalid_filename',
      message: 'Filename is required'
    });
  }

  // Validate content type (images only)
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic'
  ];

  if (!allowedTypes.includes(contentType)) {
    return res.status(400).json({
      error: 'invalid_content_type',
      message: 'Only image files are allowed (JPEG, PNG, WebP, HEIC)'
    });
  }

  // Validate context
  const allowedContexts = ['service_listing', 'profile_photo', 'breeding_animal'];
  if (!allowedContexts.includes(context)) {
    return res.status(400).json({
      error: 'invalid_context',
      message: 'Invalid upload context'
    });
  }

  // === GENERATE S3 KEY ===

  // Extract file extension
  const ext = filename.split('.').pop().toLowerCase();
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'heic'];

  if (!allowedExts.includes(ext)) {
    return res.status(400).json({
      error: 'invalid_file_extension',
      message: 'File must have a valid image extension'
    });
  }

  // Generate unique S3 key
  // Format: {context}/{userId}/{uuid}.{ext}
  const uniqueId = uuidv4();
  const s3Key = `${context}/${userId}/${uniqueId}.${ext}`;

  // === GENERATE PRESIGNED URL ===

  const presignedUrl = await s3.getSignedUrlPromise('putObject', {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: s3Key,
    ContentType: contentType,
    Expires: 300, // URL expires in 5 minutes
    // Enforce size limit (10MB)
    Conditions: [
      ['content-length-range', 0, 10 * 1024 * 1024]
    ]
  });

  // Generate CDN URL for accessing the uploaded file
  const cdnUrl = `https://${process.env.CDN_DOMAIN}/${s3Key}`;

  // === LOG UPLOAD REQUEST ===

  // Optional: Track upload requests for analytics/abuse prevention
  await db.insert({
    user_id: userId,
    s3_key: s3Key,
    filename: filename,
    content_type: contentType,
    context: context,
    created_at: new Date()
  }).into('image_upload_logs');

  return res.json({
    uploadUrl: presignedUrl,
    cdnUrl: cdnUrl,
    key: s3Key,
    expiresIn: 300
  });
}
```

**Response 200:**
```json
{
  "uploadUrl": "https://s3.amazonaws.com/bucket/service_listing/123/abc-def.jpg?X-Amz-Algorithm=...",
  "cdnUrl": "https://cdn.breederhq.com/service_listing/123/abc-def.jpg",
  "key": "service_listing/123/abc-def.jpg",
  "expiresIn": 300
}
```

**Response 400 (Invalid Type):**
```json
{
  "error": "invalid_content_type",
  "message": "Only image files are allowed (JPEG, PNG, WebP, HEIC)"
}
```

**Usage Flow:**

1. **Frontend** requests presigned URL from backend
2. **Backend** generates presigned S3 URL and returns CDN URL
3. **Frontend** uploads file directly to S3 using presigned URL (PUT request)
4. **Frontend** uses returned `cdnUrl` in the service listing `images` array
5. **Frontend** saves listing with CDN URLs

**Frontend Upload Example:**

```typescript
// 1. Get presigned URL
const { uploadUrl, cdnUrl } = await getPresignedUploadUrl({
  filename: file.name,
  contentType: file.type,
  context: 'service_listing'
});

// 2. Upload directly to S3
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': file.type
  }
});

// 3. Use cdnUrl in service listing
const images = [...existingImages, cdnUrl];
```

**Security Considerations:**

- Presigned URLs expire after 5 minutes
- Enforce 10MB max file size
- Only allow image MIME types
- S3 key includes user ID to prevent collisions
- Use UUID to prevent filename conflicts
- Log all upload requests for abuse detection

**Environment Variables Required:**

```bash
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_NAME=breederhq-assets
CDN_DOMAIN=cdn.breederhq.com
```

**S3 Bucket Configuration:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::breederhq-assets/*"
    }
  ]
}
```

**CORS Configuration (S3 Bucket):**

```json
[
  {
    "AllowedOrigins": [
      "https://marketplace.breederhq.com",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

---

### 2.2 Delete Uploaded Image (Optional)

**Endpoint:** `DELETE /api/v1/marketplace/images/:key`

**Purpose:** Remove uploaded image from S3 (e.g., when user removes from listing)

**Implementation:**

```typescript
async function deleteImage(req, res) {
  const userId = req.session.userId;
  const { key } = req.params;

  // Verify ownership (key should start with context/userId/)
  if (!key.includes(`/${userId}/`)) {
    return res.status(403).json({
      error: 'forbidden',
      message: 'You do not have permission to delete this image'
    });
  }

  try {
    await s3.deleteObject({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key
    }).promise();

    return res.json({ ok: true });
  } catch (error) {
    console.error('S3 delete error:', error);
    return res.status(500).json({
      error: 'delete_failed',
      message: 'Failed to delete image'
    });
  }
}
```

**Note:** Deletion is optional since unused images won't be referenced anywhere. Consider implementing cleanup cron job for orphaned images.

---

## Extended Service Listings API

### 2.1 Update Existing Endpoints

The following endpoints need to support new fields:

**Endpoints to Update:**
- `POST /api/v1/marketplace/service-provider/listings` (Create)
- `PUT /api/v1/marketplace/service-provider/listings/:id` (Update)
- `GET /api/v1/marketplace/service-provider/listings` (List provider's listings)
- `GET /api/v1/marketplace/services` (Public browse)
- `GET /api/v1/marketplace/services/:slugOrId` (Service detail)

**New Fields:**

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `customServiceType` | string\|null | Custom service name for OTHER_SERVICE | 1-50 chars, only when listingType="OTHER_SERVICE" |
| `tagIds` | number[] | Array of tag IDs to assign | Max 5 tags, must exist in marketplace_service_tags |
| `images` | string[] | Array of image URLs | Max 10 URLs, must be valid HTTPS URLs |

---

### 2.2 Create Listing (Updated)

**Endpoint:** `POST /api/v1/marketplace/service-provider/listings`

**Request Body Example:**
```json
{
  "listingType": "OTHER_SERVICE",
  "title": "Equine Massage Therapy",
  "description": "Professional therapeutic massage for horses...",
  "customServiceType": "Equine Massage Therapy",
  "tagIds": [1, 5, 12],
  "images": [
    "https://cdn.breederhq.com/services/abc123.jpg",
    "https://cdn.breederhq.com/services/def456.jpg"
  ],
  "city": "Austin",
  "state": "TX",
  "priceCents": 15000,
  "priceType": "starting_at"
}
```

**Implementation Pseudocode:**

```typescript
async function createServiceListing(req, res) {
  const userId = req.session.userId;
  const {
    listingType,
    title,
    description,
    customServiceType,
    tagIds = [],
    images = [],
    city,
    state,
    priceCents,
    priceType
  } = req.body;

  // === VALIDATION ===

  // Validate customServiceType
  if (listingType === 'OTHER_SERVICE') {
    if (!customServiceType || customServiceType.trim().length < 1) {
      return res.status(400).json({
        error: 'custom_type_required',
        message: 'Custom service type is required for OTHER_SERVICE category'
      });
    }
    if (customServiceType.length > 50) {
      return res.status(400).json({
        error: 'custom_type_too_long',
        message: 'Custom service type must be 50 characters or less'
      });
    }
  } else {
    // If not OTHER_SERVICE, ignore customServiceType
    customServiceType = null;
  }

  // Validate tagIds
  if (!Array.isArray(tagIds)) {
    return res.status(400).json({
      error: 'invalid_tags',
      message: 'tagIds must be an array'
    });
  }

  if (tagIds.length > 5) {
    return res.status(400).json({
      error: 'too_many_tags',
      message: 'Maximum 5 tags allowed'
    });
  }

  // Verify all tags exist
  if (tagIds.length > 0) {
    const existingTags = await db
      .select('id')
      .from('marketplace_service_tags')
      .whereIn('id', tagIds);

    if (existingTags.length !== tagIds.length) {
      return res.status(400).json({
        error: 'invalid_tags',
        message: 'One or more tag IDs do not exist'
      });
    }
  }

  // Validate images
  if (!Array.isArray(images)) {
    return res.status(400).json({
      error: 'invalid_images',
      message: 'images must be an array'
    });
  }

  if (images.length > 10) {
    return res.status(400).json({
      error: 'too_many_images',
      message: 'Maximum 10 images allowed'
    });
  }

  // Validate all image URLs
  const urlRegex = /^https:\/\/.+/;
  for (const url of images) {
    if (typeof url !== 'string' || !urlRegex.test(url)) {
      return res.status(400).json({
        error: 'invalid_image_url',
        message: 'All image URLs must be valid HTTPS URLs'
      });
    }
  }

  // === CREATE LISTING ===

  await db.transaction(async (trx) => {
    // Insert listing
    const [listing] = await trx
      .insert({
        user_id: userId,
        listing_type: listingType,
        title,
        description,
        custom_service_type: customServiceType,
        city,
        state,
        price_cents: priceCents,
        price_type: priceType,
        images: JSON.stringify(images), // JSONB column
        status: 'DRAFT',
        created_at: new Date(),
        updated_at: new Date()
      })
      .into('marketplace_listings')
      .returning('*');

    // Assign tags
    if (tagIds.length > 0) {
      const tagAssignments = tagIds.map(tagId => ({
        listing_id: listing.id,
        tag_id: tagId
      }));

      await trx
        .insert(tagAssignments)
        .into('marketplace_service_tag_assignments');

      // Increment usage counts
      await trx
        .increment('usage_count', 1)
        .from('marketplace_service_tags')
        .whereIn('id', tagIds);
    }

    // Fetch populated listing with tags
    const tags = await trx
      .select('marketplace_service_tags.*')
      .from('marketplace_service_tags')
      .join('marketplace_service_tag_assignments',
            'marketplace_service_tags.id',
            'marketplace_service_tag_assignments.tag_id')
      .where('marketplace_service_tag_assignments.listing_id', listing.id);

    return res.json({
      id: listing.id,
      listingType: listing.listing_type,
      customServiceType: listing.custom_service_type,
      title: listing.title,
      description: listing.description,
      tags: tags.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug
      })),
      images: JSON.parse(listing.images || '[]'),
      city: listing.city,
      state: listing.state,
      priceCents: listing.price_cents,
      priceType: listing.price_type,
      status: listing.status,
      viewCount: 0,
      inquiryCount: 0,
      createdAt: listing.created_at,
      updatedAt: listing.updated_at
    });
  });
}
```

---

### 2.3 Update Listing (Updated)

**Endpoint:** `PUT /api/v1/marketplace/service-provider/listings/:id`

**Implementation Details:**

```typescript
async function updateServiceListing(req, res) {
  const listingId = parseInt(req.params.id);
  const userId = req.session.userId;
  const { tagIds, images, customServiceType, ...otherFields } = req.body;

  // Verify ownership
  const listing = await db
    .select('*')
    .from('marketplace_listings')
    .where({ id: listingId, user_id: userId })
    .first();

  if (!listing) {
    return res.status(404).json({
      error: 'listing_not_found',
      message: 'Listing not found or you do not have permission'
    });
  }

  // Same validation as create (see above)
  // ...

  await db.transaction(async (trx) => {
    // Update listing
    await trx
      .update({
        ...otherFields,
        custom_service_type: customServiceType,
        images: images ? JSON.stringify(images) : listing.images,
        updated_at: new Date()
      })
      .from('marketplace_listings')
      .where('id', listingId);

    // Handle tag updates if provided
    if (tagIds !== undefined) {
      // Get current tags
      const currentTags = await trx
        .select('tag_id')
        .from('marketplace_service_tag_assignments')
        .where('listing_id', listingId);

      const currentTagIds = currentTags.map(t => t.tag_id);
      const newTagIds = tagIds || [];

      // Tags to add
      const toAdd = newTagIds.filter(id => !currentTagIds.includes(id));
      // Tags to remove
      const toRemove = currentTagIds.filter(id => !newTagIds.includes(id));

      // Remove old assignments
      if (toRemove.length > 0) {
        await trx
          .delete()
          .from('marketplace_service_tag_assignments')
          .where('listing_id', listingId)
          .whereIn('tag_id', toRemove);

        // Decrement usage counts
        await trx
          .decrement('usage_count', 1)
          .from('marketplace_service_tags')
          .whereIn('id', toRemove);
      }

      // Add new assignments
      if (toAdd.length > 0) {
        const assignments = toAdd.map(tagId => ({
          listing_id: listingId,
          tag_id: tagId
        }));

        await trx
          .insert(assignments)
          .into('marketplace_service_tag_assignments');

        // Increment usage counts
        await trx
          .increment('usage_count', 1)
          .from('marketplace_service_tags')
          .whereIn('id', toAdd);
      }
    }

    // Return updated listing with tags
    // ... (same as create)
  });
}
```

---

## Service Detail API

### 3.1 Get Service by Slug or ID

**Endpoint:** `GET /api/v1/marketplace/services/:slugOrId`

**Implementation:**

```typescript
async function getServiceDetail(req, res) {
  const { slugOrId } = req.params;

  // Try to parse as ID, otherwise treat as slug
  const isNumeric = /^\d+$/.test(slugOrId);

  let query = db
    .select('marketplace_listings.*')
    .from('marketplace_listings')
    .where('status', 'ACTIVE'); // Only show active listings

  if (isNumeric) {
    query = query.where('marketplace_listings.id', parseInt(slugOrId));
  } else {
    query = query.where('marketplace_listings.slug', slugOrId);
  }

  const listing = await query.first();

  if (!listing) {
    return res.status(404).json({
      error: 'service_not_found',
      message: 'Service listing not found'
    });
  }

  // Fetch tags
  const tags = await db
    .select('marketplace_service_tags.*')
    .from('marketplace_service_tags')
    .join('marketplace_service_tag_assignments',
          'marketplace_service_tags.id',
          'marketplace_service_tag_assignments.tag_id')
    .where('marketplace_service_tag_assignments.listing_id', listing.id);

  // Fetch provider info
  const provider = await getProviderInfo(listing.user_id); // Custom function

  // Increment view count (async, don't wait)
  db.increment('view_count', 1)
    .from('marketplace_listings')
    .where('id', listing.id)
    .catch(err => console.error('Failed to increment view count:', err));

  return res.json({
    id: listing.id,
    slug: listing.slug,
    listingType: listing.listing_type,
    customServiceType: listing.custom_service_type,
    title: listing.title,
    description: listing.description,
    tags: tags.map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug
    })),
    images: JSON.parse(listing.images || '[]'),
    city: listing.city,
    state: listing.state,
    country: listing.country,
    priceCents: listing.price_cents,
    priceType: listing.price_type,
    publishedAt: listing.published_at,
    provider: provider
  });
}

async function getProviderInfo(userId) {
  // Fetch user and service provider profile
  const user = await db.select('*').from('users').where('id', userId).first();

  const profile = await db
    .select('*')
    .from('service_provider_profiles')
    .where('user_id', userId)
    .first();

  // Check if user is also a breeder
  const tenant = await db
    .select('slug', 'name')
    .from('tenants')
    .where('owner_user_id', userId)
    .first();

  return {
    type: tenant ? 'breeder' : 'service_provider',
    id: userId,
    slug: tenant?.slug || null,
    name: profile?.business_name || tenant?.name || user.display_name,
    email: profile?.email || null,
    phone: profile?.phone || null,
    website: profile?.website || null
  };
}
```

**Response 200:**
```json
{
  "id": 42,
  "slug": "equine-massage-therapy-austin",
  "listingType": "OTHER_SERVICE",
  "customServiceType": "Equine Massage Therapy",
  "title": "Professional Equine Massage Therapy",
  "description": "...",
  "tags": [
    {"id": 1, "name": "Horse Care", "slug": "horse-care"}
  ],
  "images": ["https://..."],
  "city": "Austin",
  "state": "TX",
  "priceCents": 15000,
  "priceType": "starting_at",
  "publishedAt": "2026-01-16T10:00:00.000Z",
  "provider": {
    "type": "service_provider",
    "id": 123,
    "slug": null,
    "name": "Sarah's Equine Services",
    "email": "sarah@example.com",
    "phone": "+1234567890",
    "website": "https://example.com"
  }
}
```

---

## Abuse Reporting API

### 4.1 Report Service Listing

**Endpoint:** `POST /api/v1/marketplace/listings/report`

**Request Body:**
```json
{
  "listingId": 42,
  "reason": "FRAUD",
  "description": "This listing is promoting a scam service with fake credentials"
}
```

**Valid Reasons:**
- `FRAUD` - Fraudulent or scam listing
- `SPAM` - Spam or duplicate content
- `INAPPROPRIATE` - Inappropriate content
- `MISLEADING` - Misleading information
- `PROHIBITED` - Prohibited service
- `COPYRIGHT` - Copyright infringement
- `OTHER` - Other issue

**Implementation:**

```typescript
async function reportListing(req, res) {
  const userId = req.session.userId;
  const { listingId, reason, description } = req.body;

  // === VALIDATION ===

  const validReasons = [
    'FRAUD', 'SPAM', 'INAPPROPRIATE',
    'MISLEADING', 'PROHIBITED', 'COPYRIGHT', 'OTHER'
  ];

  if (!validReasons.includes(reason)) {
    return res.status(400).json({
      error: 'invalid_reason',
      message: 'Invalid report reason'
    });
  }

  if (!description || description.trim().length < 20) {
    return res.status(400).json({
      error: 'description_too_short',
      message: 'Description must be at least 20 characters'
    });
  }

  if (description.length > 1000) {
    return res.status(400).json({
      error: 'description_too_long',
      message: 'Description must be 1000 characters or less'
    });
  }

  // Verify listing exists
  const listing = await db
    .select('id', 'user_id', 'title')
    .from('marketplace_listings')
    .where('id', listingId)
    .first();

  if (!listing) {
    return res.status(404).json({
      error: 'listing_not_found',
      message: 'Service listing not found'
    });
  }

  // === RATE LIMITING ===

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentReports = await db
    .count('* as count')
    .from('marketplace_listing_reports')
    .where({
      reporter_user_id: userId
    })
    .where('created_at', '>', hourAgo)
    .first();

  if (recentReports.count >= 5) {
    return res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many reports. Please try again later.'
    });
  }

  // === CREATE REPORT ===

  await db.transaction(async (trx) => {
    // Insert report
    const [report] = await trx
      .insert({
        listing_id: listingId,
        reporter_user_id: userId,
        reason,
        description: description.trim(),
        status: 'PENDING',
        created_at: new Date()
      })
      .into('marketplace_listing_reports')
      .returning('*');

    // === AUTO-FLAG LOGIC ===

    // Count reports for this listing in last 24 hours
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const reportCount = await trx
      .count('* as count')
      .from('marketplace_listing_reports')
      .where('listing_id', listingId)
      .where('created_at', '>', dayAgo)
      .first();

    // Auto-flag if 3+ reports
    if (reportCount.count >= 3) {
      await trx
        .update({ flagged: true, flagged_at: new Date() })
        .from('marketplace_listings')
        .where('id', listingId);

      // Send admin notification
      await sendAdminNotification({
        type: 'AUTO_FLAG',
        listingId,
        listingTitle: listing.title,
        reportCount: reportCount.count
      });
    }

    // Send admin notification for new report
    await sendAdminNotification({
      type: 'NEW_REPORT',
      reportId: report.id,
      listingId,
      reason,
      reporterEmail: req.session.userEmail // Masked for privacy
    });

    return res.json({
      ok: true,
      reportId: report.id
    });
  });
}

async function sendAdminNotification(data) {
  // Send email or Slack webhook
  // Implementation depends on your notification system
  console.log('Admin notification:', data);
}
```

**Response 200:**
```json
{
  "ok": true,
  "reportId": 123
}
```

**Rate Limiting:**
- 5 reports per user per hour
- Returns 429 status if exceeded

**Auto-Flag Logic:**
- If listing receives 3+ reports within 24 hours
- Set `flagged = true` on listing
- Send admin notification

---

## Identity Verification API

### 6.1 Start Identity Verification

**Endpoint:** `POST /api/v1/marketplace/identity/verify`

**Purpose:** Create a Stripe Identity verification session for service provider identity verification

**Authentication:** Requires authenticated marketplace session with 2FA enabled

**Implementation Details:**

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

async function startIdentityVerification(req, res) {
  const userId = req.session.userId;

  // === PREREQUISITE CHECKS ===

  // 1. Verify 2FA is enabled
  const twoFAStatus = await db
    .select('totp_enabled', 'totp_verified_at')
    .from('users')
    .where('id', userId)
    .first();

  if (!twoFAStatus.totp_enabled || !twoFAStatus.totp_verified_at) {
    return res.status(403).json({
      error: 'two_factor_required',
      message: 'Two-factor authentication must be enabled before identity verification'
    });
  }

  // 2. Check if verification already in progress
  const existingSession = await db
    .select('*')
    .from('stripe_identity_sessions')
    .where({
      user_id: userId,
      status: 'pending'
    })
    .where('created_at', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24h
    .first();

  if (existingSession) {
    // Return existing session if still valid
    return res.json({
      clientSecret: existingSession.client_secret,
      sessionId: existingSession.stripe_session_id
    });
  }

  // 3. Check if user is already verified
  const verificationStatus = await db
    .select('identity_verified', 'identity_verified_at')
    .from('service_provider_profiles')
    .where('user_id', userId)
    .first();

  if (verificationStatus?.identity_verified) {
    return res.status(400).json({
      error: 'already_verified',
      message: 'Identity already verified'
    });
  }

  // === CREATE STRIPE IDENTITY SESSION ===

  try {
    // Get user info for metadata
    const user = await db
      .select('email', 'name')
      .from('users')
      .where('id', userId)
      .first();

    // Create Stripe Identity Verification Session
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        user_id: userId.toString(),
        email: user.email,
        environment: process.env.NODE_ENV || 'development'
      },
      options: {
        document: {
          // Require government ID
          require_id_number: true,
          require_live_capture: true,
          require_matching_selfie: true
        }
      },
      return_url: `${process.env.MARKETPLACE_URL}/provider/dashboard?verification=complete`
    });

    // === STORE SESSION IN DATABASE ===

    await db.insert({
      user_id: userId,
      stripe_session_id: verificationSession.id,
      client_secret: verificationSession.client_secret,
      status: 'pending',
      created_at: new Date()
    }).into('stripe_identity_sessions');

    // === RETURN CLIENT SECRET ===

    return res.json({
      clientSecret: verificationSession.client_secret,
      sessionId: verificationSession.id
    });

  } catch (error) {
    console.error('Stripe Identity error:', error);

    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        error: 'stripe_error',
        message: error.message
      });
    }

    return res.status(500).json({
      error: 'verification_failed',
      message: 'Failed to create verification session'
    });
  }
}
```

**Response 200:**
```json
{
  "clientSecret": "vs_1A2B3C4D..._secret_5E6F7G8H...",
  "sessionId": "vs_1A2B3C4D5E6F7G8H"
}
```

**Response 403 (2FA Not Enabled):**
```json
{
  "error": "two_factor_required",
  "message": "Two-factor authentication must be enabled before identity verification"
}
```

**Response 400 (Already Verified):**
```json
{
  "error": "already_verified",
  "message": "Identity already verified"
}
```

---

### 6.2 Stripe Identity Webhook Handler

**Endpoint:** `POST /api/webhooks/stripe/identity`

**Purpose:** Handle Stripe Identity verification results via webhook

**Authentication:** Stripe webhook signature verification

**Implementation Details:**

```typescript
async function handleStripeIdentityWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle verification session completed
  if (event.type === 'identity.verification_session.verified') {
    const session = event.data.object;
    const userId = parseInt(session.metadata.user_id);

    await db.transaction(async (trx) => {
      // Update session status
      await trx
        .update({
          status: 'verified',
          verified_at: new Date(),
          stripe_response: JSON.stringify(session)
        })
        .from('stripe_identity_sessions')
        .where('stripe_session_id', session.id);

      // Update user verification status
      await trx
        .update({
          identity_verified: true,
          identity_verified_at: new Date(),
          identity_verification_method: 'stripe_identity'
        })
        .from('service_provider_profiles')
        .where('user_id', userId);

      // Check if should upgrade to IDENTITY_VERIFIED tier
      const profile = await trx
        .select('verification_tier')
        .from('service_provider_profiles')
        .where('user_id', userId)
        .first();

      if (profile.verification_tier === 'LISTED') {
        await trx
          .update({
            verification_tier: 'IDENTITY_VERIFIED',
            verification_tier_updated_at: new Date()
          })
          .from('service_provider_profiles')
          .where('user_id', userId);
      }

      // Send success notification email
      await sendEmail({
        to: session.metadata.email,
        template: 'identity_verified',
        data: { userName: session.metadata.email }
      });
    });

    console.log(`✓ Identity verified for user ${userId}`);
  }

  // Handle verification session failed
  if (event.type === 'identity.verification_session.requires_input') {
    const session = event.data.object;
    const userId = parseInt(session.metadata.user_id);

    await db
      .update({
        status: 'requires_input',
        stripe_response: JSON.stringify(session)
      })
      .from('stripe_identity_sessions')
      .where('stripe_session_id', session.id);

    console.log(`! Identity verification requires input for user ${userId}`);
  }

  // Handle verification session canceled
  if (event.type === 'identity.verification_session.canceled') {
    const session = event.data.object;

    await db
      .update({
        status: 'canceled',
        stripe_response: JSON.stringify(session)
      })
      .from('stripe_identity_sessions')
      .where('stripe_session_id', session.id);
  }

  return res.json({ received: true });
}
```

**Required Webhook Events:**
- `identity.verification_session.verified`
- `identity.verification_session.requires_input`
- `identity.verification_session.canceled`

**Webhook Setup:**
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://api.breederhq.com/api/webhooks/stripe/identity`
3. Select events: `identity.verification_session.*`
4. Copy webhook signing secret to `STRIPE_IDENTITY_WEBHOOK_SECRET`

---

### 6.3 Database Schema for Identity Verification

```sql
-- Stripe Identity verification sessions
CREATE TABLE stripe_identity_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  stripe_session_id VARCHAR(255) NOT NULL UNIQUE,
  client_secret TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' NOT NULL,
  -- pending, verified, requires_input, canceled, failed
  verified_at TIMESTAMP,
  stripe_response JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_identity_sessions_user ON stripe_identity_sessions(user_id);
CREATE INDEX idx_identity_sessions_status ON stripe_identity_sessions(status);
CREATE INDEX idx_identity_sessions_created ON stripe_identity_sessions(created_at);

-- Update service_provider_profiles table
ALTER TABLE service_provider_profiles
  ADD COLUMN identity_verified BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN identity_verified_at TIMESTAMP,
  ADD COLUMN identity_verification_method VARCHAR(50);
```

---

### 6.4 Environment Variables

```bash
# Stripe Identity
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_IDENTITY_WEBHOOK_SECRET=whsec_...

# Frontend needs this
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

### 6.5 Frontend Integration

The frontend loads Stripe.js and calls `stripe.verifyIdentity(clientSecret)`:

```typescript
// 1. Get client secret from backend
const { clientSecret } = await startIdentityVerification();

// 2. Load Stripe SDK
const stripe = window.Stripe(VITE_STRIPE_PUBLISHABLE_KEY);

// 3. Launch verification flow
const { error } = await stripe.verifyIdentity(clientSecret);

if (error) {
  // Handle error
} else {
  // Success - webhook will update backend
}
```

**Implementation Notes:**
- Verification flow happens in iframe/modal provided by Stripe
- User completes ID upload and selfie capture
- Results sent to webhook endpoint
- Frontend polls or receives real-time update on completion
- No sensitive ID data stored in our database

---

## Database Schema

### Required Tables

```sql
-- Service tags (marketplace-wide, not tenant-scoped)
CREATE TABLE marketplace_service_tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  usage_count INTEGER DEFAULT 0 NOT NULL,
  suggested BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tag assignments (junction table)
CREATE TABLE marketplace_service_tag_assignments (
  listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES marketplace_service_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (listing_id, tag_id)
);

-- Abuse reports
CREATE TABLE marketplace_listing_reports (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  reporter_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_service_tags_name ON marketplace_service_tags(name);
CREATE INDEX idx_service_tags_slug ON marketplace_service_tags(slug);
CREATE INDEX idx_service_tags_suggested ON marketplace_service_tags(suggested);
CREATE INDEX idx_service_tags_usage ON marketplace_service_tags(usage_count DESC);

CREATE INDEX idx_tag_assignments_listing ON marketplace_service_tag_assignments(listing_id);
CREATE INDEX idx_tag_assignments_tag ON marketplace_service_tag_assignments(tag_id);

CREATE INDEX idx_listing_reports_status ON marketplace_listing_reports(status);
CREATE INDEX idx_listing_reports_listing ON marketplace_listing_reports(listing_id);
CREATE INDEX idx_listing_reports_created ON marketplace_listing_reports(created_at);
```

### Existing Table Updates

```sql
-- Add new columns to marketplace_listings
ALTER TABLE marketplace_listings
  ADD COLUMN custom_service_type VARCHAR(50),
  ADD COLUMN images JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN flagged BOOLEAN DEFAULT false,
  ADD COLUMN flagged_at TIMESTAMP;

-- Add index for flagged listings
CREATE INDEX idx_marketplace_listings_flagged ON marketplace_listings(flagged) WHERE flagged = true;
```

---

## Testing Requirements

### Unit Tests

**Service Tags:**
- [ ] Create tag with valid name
- [ ] Reject duplicate tag (same slug)
- [ ] Search tags by query
- [ ] Filter tags by suggested
- [ ] Validate name length (1-100 chars)
- [ ] Generate correct slug (lowercase, hyphens, no special chars)

**Extended Listings:**
- [ ] Create listing with customServiceType (OTHER_SERVICE)
- [ ] Reject customServiceType for non-OTHER_SERVICE
- [ ] Create listing with tagIds
- [ ] Validate max 5 tags
- [ ] Reject non-existent tag IDs
- [ ] Usage count increments when tag assigned
- [ ] Usage count decrements when tag removed
- [ ] Create listing with images array
- [ ] Validate max 10 images
- [ ] Validate HTTPS URLs only
- [ ] Update listing tags (add/remove)

**Abuse Reports:**
- [ ] Create report with valid data
- [ ] Reject invalid reason
- [ ] Validate description length (20-1000 chars)
- [ ] Rate limit enforced (5/hour)
- [ ] Auto-flag at 3 reports in 24h
- [ ] Admin notification sent

### Integration Tests

- [ ] Full CRUD flow with tags
- [ ] Tag usage counts accurate after multiple operations
- [ ] Report triggers auto-flag correctly
- [ ] Service detail endpoint returns all fields
- [ ] Provider info correctly mapped (breeder vs service_provider)

### Manual Testing Checklist

- [ ] Create service with custom type
- [ ] Search and select tags in UI
- [ ] Create new tag from UI
- [ ] Upload multiple images
- [ ] View service detail page
- [ ] Report a listing
- [ ] Verify auto-flag after 3 reports
- [ ] Check admin notification received

---

## Notes for Implementation

1. **Transaction Safety**: All tag assignments and usage count updates must be in transactions
2. **JSONB**: Images stored as JSONB array, use `JSON.parse()` when retrieving
3. **Slug Generation**: Must be URL-safe, lowercase, hyphenated
4. **Rate Limiting**: Use Redis or in-memory cache for production
5. **Admin Notifications**: Configure Slack webhook or email service
6. **View Count**: Increment asynchronously to not block response
7. **Provider Info**: Handle both service providers and breeders correctly

---

## API Endpoint Summary

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| GET | /api/v1/marketplace/service-tags | List/search tags | ❌ Not Implemented |
| POST | /api/v1/marketplace/service-tags | Create tag | ❌ Not Implemented |
| POST | /api/v1/marketplace/images/upload-url | Get presigned S3 URL | ❌ Not Implemented |
| DELETE | /api/v1/marketplace/images/:key | Delete S3 image | ❌ Not Implemented |
| POST | /api/v1/marketplace/service-provider/listings | Create listing | ⚠️ Needs Update |
| PUT | /api/v1/marketplace/service-provider/listings/:id | Update listing | ⚠️ Needs Update |
| GET | /api/v1/marketplace/services | Browse services | ⚠️ Needs Update |
| GET | /api/v1/marketplace/services/:slugOrId | Service detail | ❌ Not Implemented |
| POST | /api/v1/marketplace/listings/report | Report listing | ❌ Not Implemented |
| POST | /api/v1/marketplace/identity/verify | Start identity verification | ❌ Not Implemented |
| POST | /api/webhooks/stripe/identity | Handle verification results | ❌ Not Implemented |

---

**Frontend Ready:** ✅ All frontend components are built and waiting for these APIs.

**Priority Order:**
1. Service Tags endpoints (critical for UX)
2. Extended listing fields (critical for functionality)
3. Service detail endpoint (critical for navigation)
4. Abuse reporting (important for safety)
