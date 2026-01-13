# Backend Response: Marketplace API Gap Verification

**Date**: 2026-01-13
**Status**: Complete Analysis

---

## Executive Summary

There are **two separate marketplace systems** in BreederHQ:

1. **Service Marketplace** (`/api/v1/marketplace/*`) - Documented in `marketplace-api-v2.md`
   - Service providers (groomers, trainers, etc.)
   - Service listings, transactions, reviews
   - Separate auth system (`MarketplaceUser`)

2. **Breeder/Animal Marketplace** (`/api/v1/public-marketplace/*`) - NOT in `marketplace-api-v2.md`
   - Breeders (tenants with `isPublicProgram: true`)
   - Animal listings, offspring groups, breeding programs
   - Uses main platform auth (`User` with entitlements)

The `marketplace-api-v2.md` only documents System 1. System 2 exists and is functional but needs documentation.

---

## Breeder/Animal Endpoints

**Status**: ✅ EXIST - Located in `src/routes/public-marketplace.ts` (1537 lines)

**Base URL**: `/api/v1/public-marketplace`

**Authentication**: Requires platform auth + `MARKETPLACE_ACCESS` entitlement (or STAFF membership)

### Existing Endpoints:

```
# User Context
GET  /me                                    # Current user's marketplace access info
PATCH /profile                              # Update user profile

# Breeder Programs (Organizations)
GET  /programs                              # Browse all published breeders
GET  /programs/:programSlug                 # Breeder profile detail

# Breeding Programs (under a breeder)
GET  /programs/:programSlug/breeding-programs  # List breeding programs for a breeder
GET  /breeding-programs                     # Browse ALL listed breeding programs

# Offspring Groups (Litters)
GET  /programs/:programSlug/offspring-groups           # List litters for a breeder
GET  /programs/:programSlug/offspring-groups/:slug     # Litter detail with available puppies
GET  /offspring-groups                      # Browse ALL published offspring groups

# Animal Listings
GET  /programs/:programSlug/animals         # List animal listings for a breeder
GET  /programs/:programSlug/animals/:slug   # Animal listing detail

# Services (Stud, Training, etc. from breeders)
GET  /services                              # Browse all service listings

# Inquiries
POST /inquiries                             # Create inquiry to breeder
```

**Documentation**: Will add to `marketplace-api-v2.md` or create separate `breeder-marketplace-api.md`

---

## Programs Browse

**Status**: ✅ EXISTS

```
GET /api/v1/public-marketplace/programs                # All breeders
GET /api/v1/public-marketplace/breeding-programs       # All breeding programs across breeders
GET /api/v1/public-marketplace/programs/:slug/breeding-programs  # Programs for specific breeder
```

**Filters Available**:
- `search` - Name search
- `species` - Filter by species (DOG, CAT, etc.)
- `breed` - Filter by breed text
- `location` - City/state/country
- `page`, `limit` - Pagination

---

## Waitlist

**Status**: ✅ EXISTS - Located in `src/routes/marketplace-waitlist.ts`

**Will Document**: Yes

**Endpoints**:
```
POST /api/v1/marketplace/waitlist/:tenantSlug         # Join waitlist
GET  /api/v1/marketplace/waitlist/my-requests         # My waitlist positions
POST /api/v1/marketplace/invoices/:id/checkout        # Pay deposit
```

**Note**: Waitlist is for breeder marketplace (System 2), not service marketplace (System 1).

---

## Saved Items

**Status**: ✅ IMPLEMENTED (2026-01-13)

**File**: `src/routes/marketplace-saved.ts` (286 lines)

**Endpoints**:
```
GET    /api/v1/marketplace/saved                    # List saved listings (paginated)
POST   /api/v1/marketplace/saved                    # Save a listing { listingId }
DELETE /api/v1/marketplace/saved/:listingId         # Unsave a listing
GET    /api/v1/marketplace/saved/check/:listingId   # Check if listing is saved
```

**Response Example** (`GET /saved`):
```json
{
  "ok": true,
  "items": [
    {
      "id": 1,
      "listingId": 42,
      "savedAt": "2026-01-13T10:00:00.000Z",
      "listing": {
        "id": 42,
        "slug": "grooming-service",
        "title": "Professional Dog Grooming",
        "description": "Full service grooming...",
        "category": "grooming",
        "priceCents": "5000",
        "priceType": "fixed",
        "priceText": "$50",
        "coverImageUrl": "https://...",
        "city": "Austin",
        "state": "TX",
        "status": "published",
        "isAvailable": true,
        "provider": {
          "id": 1,
          "businessName": "Paws & Claws",
          "averageRating": "4.5",
          "totalReviews": 12,
          "verifiedProvider": true
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  }
}
```

**Test Results**: 9/9 tests passing

---

## Notifications

**Status**: ✅ IMPLEMENTED (2026-01-13)

**File**: `src/routes/marketplace-notifications.ts` (140 lines)

**Endpoint**:
```
GET /api/v1/marketplace/notifications/counts
```

**Response (Buyer)**:
```json
{
  "ok": true,
  "counts": {
    "unreadMessages": 3,
    "pendingReviews": 1,
    "total": 4
  }
}
```

**Response (Provider)** - includes additional fields:
```json
{
  "ok": true,
  "counts": {
    "unreadMessages": 2,
    "pendingReviews": 0,
    "pendingTransactions": 3,
    "newInquiries": 1,
    "total": 6
  }
}
```

**Fields**:
- `unreadMessages`: Message threads with unread messages
- `pendingReviews`: Completed transactions without a review (buyer only)
- `pendingTransactions`: Transactions awaiting provider action (provider only)
- `newInquiries`: Message threads provider hasn't responded to (provider only)
- `total`: Sum of all notification types

**Note**: Waitlist notifications are in breeder marketplace (System 2) and would need a separate counts endpoint there.

**Test Results**: 2/2 tests passing

---

## Buyer Profile

**GET Endpoint**: Use `GET /auth/me` for service marketplace

**Response from `/auth/me`**:
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

**For Breeder Marketplace**: Use `GET /api/v1/public-marketplace/me`

---

## Inquiry Model Clarification

**Confirmed Design**: Keep separate

| System | Inquiry Type | Model |
|--------|--------------|-------|
| Service Marketplace | Messages | `MarketplaceMessageThread` |
| Breeder Marketplace | Inquiries | `MessageThread` (with `inquiryType: "MARKETPLACE"`) |
| Breeder Marketplace | Waitlist | `WaitlistEntry` |

**UI Recommendation**:
- Service Marketplace: "Messages" tab
- Breeder Marketplace: "Inquiries" tab + "Waitlist" tab

---

## Become Seller (Breeder) Flow

**Flow**: Marketplace users cannot become breeders directly from marketplace.

**Process**:
1. User visits main platform (not marketplace)
2. Signs up for BreederHQ platform account
3. Creates organization (tenant) with breeding program
4. Enables `isPublicProgram: true` to appear in marketplace
5. Their animals/programs appear in breeder marketplace

**UI Direction**:
- Show "Become a Seller" → Link to main platform signup: `https://app.breederhq.com/signup`
- Or show info modal explaining they need a BreederHQ account

**Note**: Service providers (groomers, trainers) use `POST /api/v1/marketplace/providers/register` - this is different from becoming a breeder.

---

## Action Items Summary

| Item | Status | Action | ETA |
|------|--------|--------|-----|
| Breeder/Animal Endpoints | ✅ Exist | Document | 2 hours |
| Programs Browse | ✅ Exist | Document | Included above |
| Waitlist | ✅ Exist | Document | 30 min |
| Saved Items | ✅ **IMPLEMENTED** | Complete | Done |
| Notifications Counts | ✅ **IMPLEMENTED** | Complete | Done |
| Buyer Profile | ✅ Exist | Clarify in docs | 15 min |

**Implementation Complete**: Saved Items + Notifications implemented 2026-01-13
**Remaining Documentation Time**: ~2.5 hours

---

## Recommended Documentation Structure

```
docs/
├── marketplace-api-v2.md           # Service Marketplace (existing)
├── breeder-marketplace-api.md      # Breeder/Animal Marketplace (NEW)
└── marketplace-overview.md         # Overview explaining both systems (NEW)
```

---

## Questions for Frontend Team

1. **Which marketplace are you building first?**
   - Service marketplace (groomers, trainers, etc.)
   - Breeder marketplace (breeders, animals, litters)
   - Both simultaneously

2. **Unified UI or separate?**
   - Single app with tabs for services vs animals
   - Separate apps/sections

3. **Authentication preference?**
   - Service marketplace has its own auth (`MarketplaceUser`)
   - Breeder marketplace uses platform auth with entitlements
   - Should we unify?

---

*Response generated 2026-01-13*
*Updated 2026-01-13: Saved Items and Notification Counts implemented and tested*
