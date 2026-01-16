# Breeder Marketplace Management API

**Version**: 1.0
**Date**: 2026-01-13
**Base URL**: `/api/v1`

---

## Overview

These endpoints provide tenant-scoped management access for breeders to view and manage their marketplace listings. These are **management endpoints** used by the embedded marketplace portal within the platform, distinct from the public browse endpoints at `/api/v1/marketplace/*`.

**Authentication**: Requires authenticated session with tenant context (`X-Tenant-Id` header or `tenantId` from session)

---

## Animal Listings

Manage animal public listings (studs, guardian placements, rehomes, etc.)

### List Animal Listings

**Endpoint**: `GET /animal-listings`

**Description**: Retrieve all animal listings for the current tenant.

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `DRAFT`, `LIVE`, `PAUSED` |
| `intent` | string | Filter by intent: `STUD`, `BROOD_PLACEMENT`, `REHOME`, `GUARDIAN`, `TRAINED`, `WORKING`, `STARTED`, `CO_OWNERSHIP` |
| `programId` | number | Filter by breeding program ID |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 25, max: 100) |

**Response**:
```json
{
  "items": [
    {
      "id": 123,
      "animalId": 456,
      "urlSlug": "max-the-stud",
      "intent": "STUD",
      "status": "LIVE",
      "headline": "Champion Bloodline Stud",
      "title": "Max - AKC Champion Stud Service",
      "summary": "Proven champion stud with excellent temperament",
      "priceCents": 250000,
      "priceMinCents": null,
      "priceMaxCents": null,
      "priceText": "$2,500",
      "priceModel": "fixed",
      "locationCity": "Austin",
      "locationRegion": "TX",
      "publishedAt": "2026-01-10T15:30:00.000Z",
      "pausedAt": null,
      "createdAt": "2026-01-05T10:00:00.000Z",
      "updatedAt": "2026-01-10T15:30:00.000Z",
      "animal": {
        "id": 456,
        "name": "Max",
        "species": "DOG",
        "sex": "MALE",
        "birthDate": "2022-05-15T00:00:00.000Z",
        "photoUrl": "https://cdn.example.com/animals/max.jpg",
        "breed": "German Shepherd"
      }
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 25,
  "hasMore": false
}
```

---

### Get Single Animal Listing

**Endpoint**: `GET /animal-listings/:id`

**Description**: Retrieve detailed information about a specific animal listing.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Listing ID (path parameter) |

**Response**:
```json
{
  "id": 123,
  "animalId": 456,
  "urlSlug": "max-the-stud",
  "intent": "STUD",
  "status": "LIVE",
  "headline": "Champion Bloodline Stud",
  "title": "Max - AKC Champion Stud Service",
  "summary": "Proven champion stud with excellent temperament",
  "description": "Full markdown description with health testing, titles, etc.",
  "priceCents": 250000,
  "priceMinCents": null,
  "priceMaxCents": null,
  "priceText": "$2,500",
  "priceModel": "fixed",
  "locationCity": "Austin",
  "locationRegion": "TX",
  "locationCountry": "US",
  "detailsJson": {
    "healthTesting": ["OFA Hips: Excellent", "OFA Elbows: Normal"],
    "titles": ["AKC Champion", "GSDCA Select"]
  },
  "publishedAt": "2026-01-10T15:30:00.000Z",
  "pausedAt": null,
  "createdAt": "2026-01-05T10:00:00.000Z",
  "updatedAt": "2026-01-10T15:30:00.000Z",
  "animal": {
    "id": 456,
    "name": "Max",
    "species": "DOG",
    "sex": "MALE",
    "birthDate": "2022-05-15T00:00:00.000Z",
    "photoUrl": "https://cdn.example.com/animals/max.jpg",
    "breed": "German Shepherd"
  }
}
```

**Error Responses**:
- `400 invalid_id`: Invalid listing ID format
- `404 not_found`: Listing not found or doesn't belong to tenant

---

## Offspring Groups

Manage offspring groups (litters) for marketplace display.

### List Offspring Groups

**Endpoint**: `GET /offspring-groups`

**Description**: Retrieve all offspring groups for the current tenant.

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `published` | string | Filter by published status: `true`, `false` |
| `programId` | number | Filter by breeding program ID (via plan) |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 25, max: 100) |

**Response**:
```json
{
  "items": [
    {
      "id": 789,
      "listingSlug": "spring-2026-litter",
      "name": "Spring 2026 Litter",
      "species": "DOG",
      "breedText": "German Shepherd",
      "actualBirthOn": "2026-01-01T00:00:00.000Z",
      "expectedBirthOn": null,
      "published": true,
      "listingTitle": "Beautiful GSD Puppies - Ready March 2026",
      "listingDescription": "Championship bloodlines...",
      "countLive": 8,
      "countBorn": 9,
      "createdAt": "2025-12-15T10:00:00.000Z",
      "updatedAt": "2026-01-05T15:30:00.000Z",
      "sire": {
        "id": 456,
        "name": "Max"
      },
      "dam": {
        "id": 457,
        "name": "Luna"
      },
      "breedingProgram": {
        "id": 10,
        "name": "Champion GSD Program"
      },
      "counts": {
        "animals": 8
      }
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 25,
  "hasMore": false
}
```

---

### Get Single Offspring Group

**Endpoint**: `GET /offspring-groups/:id`

**Description**: Retrieve detailed information about a specific offspring group including all individuals.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Offspring group ID (path parameter) |

**Response**:
```json
{
  "id": 789,
  "listingSlug": "spring-2026-litter",
  "name": "Spring 2026 Litter",
  "species": "DOG",
  "breedText": "German Shepherd",
  "actualBirthOn": "2026-01-01T00:00:00.000Z",
  "expectedBirthOn": null,
  "published": true,
  "listingTitle": "Beautiful GSD Puppies - Ready March 2026",
  "listingDescription": "Championship bloodlines, health tested parents...",
  "marketplaceDefaultPriceCents": 350000,
  "countBorn": 9,
  "countLive": 8,
  "countStillborn": 1,
  "countMale": 5,
  "countFemale": 3,
  "countWeaned": 0,
  "countPlaced": 0,
  "coverImageUrl": "https://cdn.example.com/litters/spring2026.jpg",
  "notes": "Internal breeding notes...",
  "createdAt": "2025-12-15T10:00:00.000Z",
  "updatedAt": "2026-01-05T15:30:00.000Z",
  "sire": {
    "id": 456,
    "name": "Max",
    "photoUrl": "https://cdn.example.com/animals/max.jpg"
  },
  "dam": {
    "id": 457,
    "name": "Luna",
    "photoUrl": "https://cdn.example.com/animals/luna.jpg"
  },
  "breedingProgram": {
    "id": 10,
    "name": "Champion GSD Program"
  },
  "offspring": [
    {
      "id": 1001,
      "identifier": "Green Collar Male",
      "sex": "MALE",
      "status": "AVAILABLE",
      "colorMarkings": "Black and tan",
      "createdAt": "2026-01-01T10:00:00.000Z"
    }
  ],
  "animals": [
    {
      "id": 2001,
      "name": "Puppy #1",
      "sex": "MALE",
      "photoUrl": "https://cdn.example.com/animals/puppy1.jpg"
    }
  ]
}
```

**Error Responses**:
- `400 invalid_id`: Invalid offspring group ID format
- `404 not_found`: Offspring group not found or doesn't belong to tenant

---

## Inquiries

Manage marketplace inquiries received by the breeder.

### List Inquiries

**Endpoint**: `GET /inquiries`

**Description**: Retrieve marketplace inquiries (messages from potential buyers).

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter: `active` (not archived), `archived` |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 25, max: 100) |

**Response**:
```json
{
  "items": [
    {
      "id": 5001,
      "type": "message",
      "inquiryType": "ANIMAL_LISTING",
      "subject": "Inquiry: Max - AKC Champion Stud Service",
      "archived": false,
      "createdAt": "2026-01-12T14:30:00.000Z",
      "updatedAt": "2026-01-12T15:00:00.000Z",
      "lastMessageAt": "2026-01-12T15:00:00.000Z",
      "contact": {
        "id": 9001,
        "name": "Sarah Johnson",
        "email": "sarah@example.com"
      },
      "lastMessage": {
        "id": 8001,
        "body": "Hi, I'm interested in booking a stud service...",
        "createdAt": "2026-01-12T15:00:00.000Z"
      },
      "sourceListingSlug": "max-the-stud"
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 25,
  "hasMore": false
}
```

---

### Get Single Inquiry

**Endpoint**: `GET /inquiries/:id`

**Description**: Retrieve detailed inquiry with full message history.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Inquiry (thread) ID (path parameter) |

**Response**:
```json
{
  "id": 5001,
  "type": "message",
  "inquiryType": "ANIMAL_LISTING",
  "subject": "Inquiry: Max - AKC Champion Stud Service",
  "archived": false,
  "createdAt": "2026-01-12T14:30:00.000Z",
  "updatedAt": "2026-01-12T15:00:00.000Z",
  "lastMessageAt": "2026-01-12T15:00:00.000Z",
  "contact": {
    "id": 9001,
    "name": "Sarah Johnson",
    "email": "sarah@example.com",
    "phone": "+1-555-0123"
  },
  "messages": [
    {
      "id": 8000,
      "body": "Hi, I'm interested in booking a stud service for my female GSD. She has OFA excellent hips and elbows.",
      "createdAt": "2026-01-12T14:30:00.000Z",
      "direction": "INBOUND"
    },
    {
      "id": 8001,
      "body": "Thank you for reaching out! Max is available for stud services. Can you share your girl's pedigree and health testing results?",
      "createdAt": "2026-01-12T15:00:00.000Z",
      "direction": "OUTBOUND"
    }
  ],
  "sourceListingSlug": "max-the-stud",
  "guestEmail": null,
  "guestName": null
}
```

**Error Responses**:
- `400 invalid_id`: Invalid inquiry ID format
- `404 not_found`: Inquiry not found or doesn't belong to tenant

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "error_code",
  "message": "Human readable error message"
}
```

**Common Error Codes**:
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `unauthorized` | 401 | Missing or invalid tenant context |
| `invalid_id` | 400 | Invalid ID parameter |
| `not_found` | 404 | Resource not found |
| `list_failed` | 500 | Database error listing resources |
| `get_failed` | 500 | Database error fetching resource |

---

## Related Endpoints

These management endpoints complement the existing public browse endpoints:

| Management (This Doc) | Public Browse |
|-----------------------|---------------|
| `GET /animal-listings` | `GET /marketplace/programs/:slug/animals` |
| `GET /offspring-groups` | `GET /marketplace/offspring-groups` |
| `GET /inquiries` | N/A (breeder only) |

For public browse endpoints, see `marketplace-api-gaps-response.md`.

---

## Implementation Notes

**File**: `src/routes/breeder-marketplace.ts`
**Registered**: `server.ts` line 832

**Route Prefix**: These routes are registered without a prefix, so they mount at:
- `/api/v1/animal-listings`
- `/api/v1/offspring-groups`
- `/api/v1/inquiries`

---

---

## Waitlist Entries

Manage waitlist entries for the breeder.

### List Waitlist Entries

**Endpoint**: `GET /waitlist-entries`

**Description**: Retrieve waitlist entries for the current tenant.

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `PENDING`, `APPROVED`, `MATCHED`, `FULFILLED`, `CANCELLED` |
| `programId` | number | Filter by breeding program ID |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 25, max: 100) |

**Response**:
```json
{
  "items": [
    {
      "id": 1001,
      "tenantId": 1,
      "buyerId": "123",
      "name": "John Smith",
      "email": "john@example.com",
      "phone": "+1-555-0123",
      "programId": 10,
      "programName": "Champion GSD Program",
      "programSlug": "champion-gsds",
      "status": "PENDING",
      "preferences": {
        "sex": "FEMALE",
        "color": "Black and tan",
        "notes": "Looking for a companion dog"
      },
      "depositRequired": true,
      "depositAmountCents": 50000,
      "depositPaidAt": null,
      "position": 5,
      "createdAt": "2026-01-10T10:00:00.000Z",
      "updatedAt": "2026-01-10T10:00:00.000Z",
      "approvedAt": null,
      "matchedAt": null
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 25,
  "hasMore": false
}
```

---

*Document created: 2026-01-13*
*Updated: 2026-01-13 - Added waitlist-entries endpoint*
