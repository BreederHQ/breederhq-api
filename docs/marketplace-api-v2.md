# BreederHQ Marketplace API Documentation (v2)

Base URL: `/api/v1/marketplace`

## Table of Contents
1. [Authentication](#authentication)
2. [User Types & Permissions](#user-types--permissions)
3. [Public Endpoints](#public-endpoints)
4. [Buyer Endpoints](#buyer-endpoints)
5. [Provider Endpoints](#provider-endpoints)
6. [Transaction Endpoints](#transaction-endpoints)
7. [Messaging Endpoints](#messaging-endpoints)
8. [Review Endpoints](#review-endpoints)
9. [Admin Endpoints](#admin-endpoints)
10. [Data Models](#data-models)
11. [Error Handling](#error-handling)

---

## Authentication

### Register
```
POST /auth/register
```
**Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe"
}
```
**Response:**
```json
{
  "ok": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "userType": "buyer",
    "emailVerified": false
  }
}
```
**Notes:** Sets session cookie and CSRF token cookie (`XSRF-TOKEN`).

### Login
```
POST /auth/login
```
**Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```
**Response:** Same as register.

### Logout
```
POST /auth/logout
```
**Headers:** `X-CSRF-Token: <token>`

### Get Current User
```
GET /auth/me
```
**Response:**
```json
{
  "ok": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "userType": "buyer",
    "emailVerified": true,
    "provider": null
  }
}
```

### Verify Email
```
POST /auth/verify-email
```
**Body:**
```json
{
  "token": "verification-token"
}
```

### Request Password Reset
```
POST /auth/forgot-password
```
**Body:**
```json
{
  "email": "user@example.com"
}
```

### Reset Password
```
POST /auth/reset-password
```
**Body:**
```json
{
  "token": "reset-token",
  "password": "newpassword"
}
```

---

## User Types & Permissions

| User Type | Description | Can Do |
|-----------|-------------|--------|
| `buyer` | Default type | Browse, book services, leave reviews, message providers |
| `provider` | Service provider | All buyer actions + manage listings, accept bookings |
| `admin` | Administrator | All actions + moderate content, manage users |

---

## Public Endpoints (No Auth Required)

### List Service Listings
```
GET /public/listings
```
**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `category` | string | Filter by category (grooming, training, etc.) |
| `subcategory` | string | Filter by subcategory |
| `city` | string | Filter by city |
| `state` | string | Filter by state |
| `zip` | string | Filter by zip code |
| `priceMin` | number | Minimum price in cents |
| `priceMax` | number | Maximum price in cents |
| `minRating` | number | Minimum provider rating (1-5) |
| `providerType` | string | Filter by provider type |
| `hasReviews` | boolean | Only show providers with reviews |
| `search` | string | Full-text search (title, description, provider name) |
| `nearZip` | string | Find within radius of zip code |
| `nearAddress` | string | Find within radius of address |
| `lat` | number | Latitude for radius search |
| `lng` | number | Longitude for radius search |
| `radius` | number | Search radius in miles (default: 25) |
| `sort` | string | Sort order (see below) |

**Sort Options:**
- `recent` - Most recently published (default)
- `price_low` - Price low to high
- `price_high` - Price high to low
- `rating` - Highest rated providers
- `reviews` - Most reviewed providers
- `distance` - Nearest first (requires location params)

**Response:**
```json
{
  "ok": true,
  "items": [
    {
      "id": 1,
      "slug": "professional-dog-grooming",
      "title": "Professional Dog Grooming",
      "description": "Full grooming service...",
      "category": "grooming",
      "subcategory": "full-service",
      "priceCents": "5000",
      "priceType": "fixed",
      "priceText": "$50",
      "coverImageUrl": "https://...",
      "city": "Austin",
      "state": "TX",
      "viewCount": 150,
      "publishedAt": "2026-01-10T...",
      "distanceMiles": 5.2,
      "provider": {
        "id": 1,
        "businessName": "Happy Paws Grooming",
        "providerType": "groomer",
        "averageRating": "4.50",
        "totalReviews": 25,
        "verifiedProvider": true
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Get Single Listing
```
GET /public/listings/:id
GET /public/listings/slug/:slug
```
**Response:** Full listing object with provider details.

### Get Provider Profile (Public)
```
GET /public/providers/:id
```
**Response:**
```json
{
  "ok": true,
  "provider": {
    "id": 1,
    "businessName": "Happy Paws Grooming",
    "businessDescription": "Professional grooming...",
    "providerType": "groomer",
    "logoUrl": "https://...",
    "publicEmail": "contact@happypaws.com",
    "publicPhone": "555-1234",
    "website": "https://happypaws.com",
    "city": "Austin",
    "state": "TX",
    "averageRating": "4.50",
    "totalReviews": 25,
    "verifiedProvider": true,
    "premiumProvider": false,
    "listings": [...]
  }
}
```

### Get Provider Reviews
```
GET /providers/:id/reviews
```
**Query Parameters:** `page`, `limit`

**Response:**
```json
{
  "ok": true,
  "reviews": [...],
  "stats": {
    "averageRating": "4.50",
    "totalReviews": 25,
    "ratingDistribution": {
      "5": 15,
      "4": 7,
      "3": 2,
      "2": 1,
      "1": 0
    }
  },
  "pagination": {...}
}
```

### Geocode Address/Zip
```
GET /public/geocode
```
**Query Parameters:**
- `zip` - 5-digit zip code
- `address` - Full address string

**Response:**
```json
{
  "ok": true,
  "latitude": 30.2672,
  "longitude": -97.7431,
  "displayName": "Austin, Travis County, Texas, USA"
}
```

---

## Buyer Endpoints (Auth Required)

### Update Profile
```
PUT /profile
```
**Headers:** `X-CSRF-Token: <token>`

**Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "555-1234",
  "city": "Austin",
  "state": "TX",
  "zip": "78701",
  "country": "US"
}
```

---

## Provider Endpoints

### Register as Provider
```
POST /providers/register
```
**Headers:** `X-CSRF-Token: <token>`

**Body:**
```json
{
  "providerType": "groomer",
  "businessName": "Happy Paws Grooming",
  "businessDescription": "Professional grooming services...",
  "paymentMode": "manual",
  "paymentInstructions": "Pay via Venmo @happypaws",
  "city": "Austin",
  "state": "TX",
  "zip": "78701",
  "country": "US",
  "publicEmail": "contact@happypaws.com",
  "publicPhone": "555-1234",
  "website": "https://happypaws.com"
}
```

**Provider Types:**
- `breeder`
- `groomer`
- `trainer`
- `veterinarian`
- `pet_sitter`
- `dog_walker`
- `boarding`
- `other`

**Payment Modes:**
- `manual` - Provider handles payment externally (Venmo, cash, etc.)
- `stripe` - Integrated Stripe payments (requires Stripe Connect setup)

**Response:**
```json
{
  "ok": true,
  "provider": {
    "id": 1,
    "status": "pending",
    ...
  }
}
```
**Note:** Provider status starts as `pending` until approved by admin.

### Get My Provider Profile
```
GET /providers/me
```

### Update Provider Profile
```
PUT /providers/me
```
**Body:** Same fields as registration (partial updates allowed).

### Provider Statistics
```
GET /providers/stats
```
**Response:**
```json
{
  "ok": true,
  "stats": {
    "totalListings": 5,
    "activeListings": 3,
    "totalTransactions": 50,
    "completedTransactions": 45,
    "totalRevenueCents": "250000",
    "averageRating": "4.75",
    "totalReviews": 40
  }
}
```

---

## Listing Management (Provider)

### Create Listing
```
POST /listings
```
**Headers:** `X-CSRF-Token: <token>`

**Body:**
```json
{
  "title": "Professional Dog Grooming",
  "description": "Full grooming service including bath, haircut, nail trim...",
  "category": "grooming",
  "subcategory": "full-service",
  "priceCents": 5000,
  "priceType": "fixed",
  "priceText": "$50",
  "city": "Austin",
  "state": "TX",
  "zip": "78701",
  "images": ["https://...", "https://..."],
  "coverImageUrl": "https://..."
}
```

**Categories:**
- `grooming`
- `training`
- `veterinary`
- `boarding`
- `pet_sitting`
- `dog_walking`
- `breeding`
- `other`

**Price Types:**
- `fixed` - Fixed price
- `hourly` - Per hour
- `starting_at` - Starting price
- `contact` - Contact for pricing

### Get My Listings
```
GET /listings
```
**Query Parameters:** `page`, `limit`, `status`

### Update Listing
```
PUT /listings/:id
```

### Publish Listing
```
POST /listings/:id/publish
```

### Unpublish Listing
```
POST /listings/:id/unpublish
```

### Delete Listing
```
DELETE /listings/:id
```
**Note:** Soft delete - sets `deletedAt` timestamp.

---

## Transaction Endpoints

### Create Transaction (Book Service)
```
POST /transactions
```
**Headers:** `X-CSRF-Token: <token>`

**Body:**
```json
{
  "serviceListingId": 1,
  "serviceNotes": "My dog is a Golden Retriever, medium size..."
}
```

**Response:**
```json
{
  "ok": true,
  "id": "123",
  "status": "pending",
  "serviceDescription": "Professional Dog Grooming",
  "servicePriceCents": "5000",
  "platformFeeCents": "500",
  "stripeFeesCents": "0",
  "totalCents": "5500",
  "paymentMode": "manual",
  "paymentInstructions": "Pay via Venmo @happypaws",
  "createdAt": "2026-01-12T...",
  "provider": {...},
  "listing": {...}
}
```

### List My Transactions (Buyer)
```
GET /transactions
```
**Query Parameters:** `page`, `limit`, `status`

### List Provider Transactions
```
GET /providers/transactions
```
**Query Parameters:** `page`, `limit`, `status`

### Get Transaction Detail
```
GET /transactions/:id
```

### Mark Payment Sent (Buyer - Manual Mode)
```
POST /transactions/:id/mark-paid
```
**Note:** For manual payment mode. Buyer indicates they sent payment externally.

### Confirm Payment (Provider - Manual Mode)
```
POST /transactions/:id/confirm-payment
```
**Note:** Provider confirms they received the payment.

### Create Checkout Session (Stripe Mode)
```
POST /transactions/:id/checkout
```
**Response:**
```json
{
  "ok": true,
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

### Start Service (Provider)
```
POST /transactions/:id/start
```
**Note:** Optional step to indicate service has begun.

### Complete Service (Provider)
```
POST /transactions/:id/complete
```

### Cancel Transaction
```
POST /transactions/:id/cancel
```
**Body:**
```json
{
  "reason": "Schedule conflict"
}
```

### Refund Transaction (Provider)
```
POST /transactions/:id/refund
```
**Body:**
```json
{
  "reason": "Customer requested refund"
}
```

### Transaction Status Flow
```
pending → paid → started (optional) → completed
    ↓        ↓
cancelled  refunded
```

---

## Messaging Endpoints

### List Message Threads
```
GET /messages/threads
```
**Response:**
```json
{
  "ok": true,
  "threads": [
    {
      "id": 1,
      "subject": "Question about grooming",
      "otherParty": {
        "id": 2,
        "name": "Happy Paws Grooming",
        "type": "provider"
      },
      "lastMessage": {
        "body": "Yes, we can accommodate...",
        "createdAt": "2026-01-12T..."
      },
      "unreadCount": 2,
      "lastMessageAt": "2026-01-12T..."
    }
  ],
  "pagination": {...}
}
```

### Get Thread Messages
```
GET /messages/threads/:id
```
**Response:**
```json
{
  "ok": true,
  "thread": {
    "id": 1,
    "subject": "Question about grooming",
    "transaction": {...},
    "listing": {...}
  },
  "messages": [
    {
      "id": 1,
      "body": "Hi, do you have availability...",
      "senderId": 1,
      "senderName": "John Doe",
      "createdAt": "2026-01-12T..."
    }
  ],
  "pagination": {...}
}
```
**Note:** Automatically marks thread as read.

### Create Thread
```
POST /messages/threads
```
**Body:**
```json
{
  "recipientProviderId": 1,
  "listingId": 1,
  "subject": "Question about your service",
  "message": "Hi, I was wondering..."
}
```

### Send Message
```
POST /messages/threads/:id/messages
```
**Body:**
```json
{
  "message": "Thanks for getting back to me..."
}
```

### Get Unread Counts
```
GET /messages/counts
```
**Response:**
```json
{
  "ok": true,
  "counts": {
    "unreadThreads": 3,
    "totalUnreadMessages": 7
  }
}
```

### Mark Thread as Read
```
POST /messages/threads/:id/mark-read
```

---

## Review Endpoints

### Get Pending Reviews (Buyer)
```
GET /reviews/pending
```
**Response:** List of completed transactions without reviews.

### Submit Review
```
POST /transactions/:id/review
```
**Body:**
```json
{
  "rating": 5,
  "title": "Excellent service!",
  "reviewText": "The groomer was professional and my dog looks amazing..."
}
```
**Validation:**
- `rating`: 1-5 (required)
- `title`: Optional, max 100 characters
- `reviewText`: Optional, max 2000 characters
- Transaction must be `completed` status
- Cannot review same transaction twice

### Respond to Review (Provider)
```
POST /reviews/:id/respond
```
**Body:**
```json
{
  "response": "Thank you for the kind words! We loved working with..."
}
```
**Note:** Provider can only respond once per review.

### Get My Reviews (Buyer)
```
GET /reviews/my-reviews
```

---

## Admin Endpoints

All admin endpoints require `userType: "admin"`.

### Dashboard Statistics
```
GET /admin/stats
```
**Response:**
```json
{
  "ok": true,
  "stats": {
    "users": { "total": 104 },
    "providers": {
      "total": 46,
      "pending": 10,
      "active": 35,
      "suspended": 1
    },
    "listings": {
      "total": 38,
      "published": 37
    },
    "transactions": {
      "total": 31,
      "completed": 6,
      "totalRevenueCents": "33000",
      "platformFeeCents": "3000"
    },
    "reviews": {
      "total": 4,
      "flagged": 0
    }
  }
}
```

### Provider Management
```
GET    /admin/providers              # List (filters: status, providerType, search)
GET    /admin/providers/:id          # Detail
POST   /admin/providers/:id/approve  # Approve pending
POST   /admin/providers/:id/suspend  # Suspend (body: { reason })
POST   /admin/providers/:id/unsuspend
```

### Listing Moderation
```
GET    /admin/listings               # List (filters: status, category, search)
GET    /admin/listings/:id           # Detail
POST   /admin/listings/:id/unpublish # Set to draft
POST   /admin/listings/:id/remove    # Soft delete
```

### Transaction Oversight
```
GET    /admin/transactions           # List (filters: status, search)
GET    /admin/transactions/:id       # Detail
POST   /admin/transactions/:id/refund # Admin refund (body: { reason })
```

### Review Moderation
```
GET    /admin/reviews                # List (filters: status)
GET    /admin/reviews/:id            # Detail
POST   /admin/reviews/:id/flag       # Flag (body: { reason })
POST   /admin/reviews/:id/remove     # Remove (updates provider stats)
```

### User Management
```
GET    /admin/users                  # List (filters: userType, search)
GET    /admin/users/:id              # Detail
POST   /admin/users/:id/suspend      # Cannot suspend admins
POST   /admin/users/:id/unsuspend
POST   /admin/users/:id/make-admin   # Promote to admin
```

---

## Data Models

### MarketplaceUser
| Field | Type | Description |
|-------|------|-------------|
| id | number | Primary key |
| email | string | Unique email |
| firstName | string | |
| lastName | string | |
| phone | string? | |
| city | string? | |
| state | string? | |
| zip | string? | |
| country | string? | |
| userType | enum | `buyer`, `provider`, `admin` |
| emailVerified | boolean | |
| status | string | `active`, `suspended` |
| createdAt | datetime | |

### MarketplaceProvider
| Field | Type | Description |
|-------|------|-------------|
| id | number | Primary key |
| userId | number | FK to User |
| providerType | string | `groomer`, `trainer`, etc. |
| businessName | string | |
| businessDescription | string? | |
| logoUrl | string? | |
| publicEmail | string? | |
| publicPhone | string? | |
| website | string? | |
| city | string | |
| state | string | |
| zip | string? | |
| country | string | |
| latitude | decimal? | Auto-geocoded |
| longitude | decimal? | Auto-geocoded |
| paymentMode | string | `manual`, `stripe` |
| paymentInstructions | string? | For manual mode |
| stripeConnectAccountId | string? | For stripe mode |
| status | string | `pending`, `active`, `suspended` |
| averageRating | decimal | Calculated |
| totalReviews | number | Count |
| totalListings | number | Count |
| activeListings | number | Count |
| totalTransactions | number | Count |
| completedTransactions | number | Count |
| totalRevenueCents | bigint | Sum of completed |
| verifiedProvider | boolean | Admin-verified |
| premiumProvider | boolean | Premium subscription |
| createdAt | datetime | |
| activatedAt | datetime? | When approved |
| suspendedAt | datetime? | |
| suspendedReason | string? | |

### MarketplaceServiceListing
| Field | Type | Description |
|-------|------|-------------|
| id | number | Primary key |
| providerId | number | FK to Provider |
| slug | string | URL-friendly unique slug |
| title | string | |
| description | string? | |
| category | string | |
| subcategory | string? | |
| priceCents | bigint? | Price in cents |
| priceType | string | `fixed`, `hourly`, `starting_at`, `contact` |
| priceText | string? | Display text |
| images | json | Array of image URLs |
| coverImageUrl | string? | Primary image |
| city | string? | |
| state | string? | |
| zip | string? | |
| latitude | decimal? | |
| longitude | decimal? | |
| status | string | `draft`, `published` |
| viewCount | number | Page views |
| publishedAt | datetime? | |
| createdAt | datetime | |
| updatedAt | datetime | |
| deletedAt | datetime? | Soft delete |

### MarketplaceTransaction
| Field | Type | Description |
|-------|------|-------------|
| id | bigint | Primary key |
| clientId | number | FK to User (buyer) |
| providerId | number | FK to Provider |
| listingId | number? | FK to Listing |
| serviceDescription | string | Snapshot of listing title |
| serviceNotes | string? | Buyer notes |
| servicePriceCents | bigint | Base price |
| platformFeeCents | bigint | 10% platform fee |
| stripeFeesCents | bigint | Stripe fees (if applicable) |
| totalCents | bigint | Total charged |
| status | string | `pending`, `paid`, `started`, `completed`, `cancelled`, `refunded` |
| cancellationReason | string? | |
| createdAt | datetime | |
| paidAt | datetime? | |
| startedAt | datetime? | |
| completedAt | datetime? | |
| cancelledAt | datetime? | |
| refundedAt | datetime? | |

### MarketplaceReview
| Field | Type | Description |
|-------|------|-------------|
| id | number | Primary key |
| transactionId | bigint | FK to Transaction |
| providerId | number | FK to Provider |
| clientId | number | FK to User |
| listingId | number? | FK to Listing |
| rating | number | 1-5 |
| title | string? | |
| reviewText | string? | |
| providerResponse | string? | Provider's reply |
| respondedAt | datetime? | |
| status | string | `published`, `flagged`, `removed` |
| flaggedReason | string? | |
| createdAt | datetime | |

### MarketplaceMessageThread
| Field | Type | Description |
|-------|------|-------------|
| id | number | Primary key |
| clientId | number | FK to User |
| providerId | number | FK to Provider |
| listingId | number? | FK to Listing |
| transactionId | bigint? | FK to Transaction |
| subject | string? | |
| status | string | `active`, `closed` |
| lastMessageAt | datetime | |
| createdAt | datetime | |

### MarketplaceMessage
| Field | Type | Description |
|-------|------|-------------|
| id | bigint | Primary key |
| threadId | number | FK to Thread |
| senderId | number | FK to User |
| messageText | string | |
| readAt | datetime? | |
| createdAt | datetime | |

---

## Error Handling

### Error Response Format
```json
{
  "error": "error_code",
  "message": "Human-readable description"
}
```

### Common Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `unauthorized` | 401 | Not logged in |
| `forbidden` | 403 | Insufficient permissions |
| `not_found` | 404 | Resource not found |
| `validation_error` | 400 | Invalid input |
| `rate_limit_exceeded` | 429 | Too many requests |
| `internal_error` | 500 | Server error |

### Domain-Specific Error Codes
| Code | Description |
|------|-------------|
| `email_already_registered` | Email in use |
| `invalid_credentials` | Wrong email/password |
| `email_not_verified` | Must verify email first |
| `provider_not_approved` | Provider pending approval |
| `listing_unavailable` | Listing not published/deleted |
| `cannot_book_own_service` | Self-booking prevented |
| `transaction_not_paid` | Action requires paid status |
| `transaction_not_completed` | Review requires completion |
| `already_reviewed` | Cannot review twice |
| `already_responded` | Cannot respond twice |
| `invalid_rating` | Rating must be 1-5 |

---

## Rate Limits

| Endpoint Group | Limit |
|----------------|-------|
| Auth (login/register) | 10/hour |
| Provider registration | 3/hour |
| Transaction creation | 10/hour |
| Payment actions | 5/hour |
| Message sending | 20/hour per thread |
| Review submission | 10/hour |
| Admin actions | 30/minute |
| Read operations | 100/minute |

---

## CSRF Protection

All state-changing requests (POST, PUT, DELETE) require:
- Session cookie (`bhq_s_mkt`)
- CSRF token header: `X-CSRF-Token: <token>`

The CSRF token is set in the `XSRF-TOKEN` cookie after login/register.

---

## Fee Structure

### Platform Fee
- **10%** of service price charged to buyer
- Example: $50 service → $5 platform fee → $55 total

### Stripe Fees (Stripe mode only)
- **2.9% + $0.30** per transaction
- Applied to subtotal (service + platform fee)
- Example: $55 subtotal → $1.90 Stripe fee → $56.90 total

### Provider Payout
- Service price minus platform fee
- Example: $50 service → $45 provider payout (90%)

---

## WebSocket Events (Real-time)

### Message Events
| Event | Payload | Description |
|-------|---------|-------------|
| `new_message` | `{ threadId, message }` | New message received |
| `thread_update` | `{ threadId }` | Thread marked as read |

---

## Changelog

### v2.0.0 (2026-01-13)
- Initial marketplace release
- Authentication system
- Provider registration and management
- Service listings with search and geocoding
- Transaction and payment flow (manual + Stripe)
- Messaging system
- Reviews and ratings
- Admin dashboard
