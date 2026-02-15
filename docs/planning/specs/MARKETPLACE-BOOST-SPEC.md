# Marketplace Listing Boost & Featured Promotion

**Date**: 2026-02-15
**Status**: Draft
**Owner**: Platform Team
**Stakeholders**: Product, Engineering, Marketing

> **Documentation Note**: When approved, this spec should be moved to `docs/planning/specs/MARKETPLACE-BOOST-SPEC.md` and referenced from INDEX.md. Feature entries should be added to PLATFORM-FEATURES.md and COMPREHENSIVE-PLATFORM-FEATURE-AUDIT-2026-02.md.

---

## 1. Problem Statement [REQUIRED]

Breeders and service providers list animals, breeding programs, and services on the BreederHQ marketplace, but all listings receive equal visibility based solely on recency. There is no mechanism for sellers to increase the visibility of their listings, and no revenue stream from listing promotion.

Competing platforms (DreamHorse, ehorses, EquineNow, HorseClicks) all offer paid promotion features ranging from $5 bumps to $100+ spotlight placements. BreederHQ sellers have no equivalent option, and the platform has no promotion-based revenue.

---

## 2. Goals [REQUIRED]

1. Allow breeders and service providers to purchase increased visibility for their marketplace listings
2. Create a new platform revenue stream through paid listing boosts
3. Maintain marketplace fairness and buyer trust (capped promoted results, disclosure labels)
4. Support all 7 listing types with a unified boost system
5. Provide both breeders (Commerce app) and providers (Provider Portal) with the same purchase flow

---

## 3. Non-Goals [RECOMMENDED]

- CPC (cost-per-click) or auction-based advertising model (not viable at current marketplace scale)
- Free boost credits bundled with subscription tiers (providers have no subscription; level playing field required)
- Pre-paid credit wallet / credit packs (v2 consideration if purchase volume warrants it)
- Algorithmic ad targeting or keyword bidding
- Offsite advertising or social media cross-posting (future consideration)
- Sponsored content or native advertising units

---

## 4. User Stories [REQUIRED]

### Primary User Stories

**US-1: Breeder boosts a listing**
- As a **breeder**
- I want to **boost my animal or breeding listing** for a flat fee
- So that **my listing appears higher in search results and gets more visibility**

**US-2: Provider boosts a service listing**
- As a **service provider** (non-subscriber)
- I want to **boost my service listing** for a flat fee
- So that **my service appears higher in search results and gets more inquiries**

**US-3: Seller purchases a Featured listing**
- As a **breeder or provider**
- I want to **purchase a Featured upgrade** for my listing
- So that **my listing appears in the Featured carousel on the homepage and browse pages**

**US-4: Buyer sees promoted listings**
- As a **marketplace buyer**
- I want to **see clearly labeled promoted listings** in search results and featured sections
- So that **I can distinguish organic results from paid promotions** and trust the marketplace

### Additional User Stories

**US-5: Seller manages active boosts**
- As a **breeder or provider**
- I want to **view my active boosts, their remaining duration, and performance analytics**
- So that **I can evaluate ROI and decide whether to renew**

**US-6: Seller enables auto-renewal**
- As a **breeder or provider**
- I want to **opt in to auto-renew my boost when it expires**
- So that **my listing maintains continuous visibility without manual re-purchasing**

**US-7: Seller receives expiry notification**
- As a **breeder or provider**
- I want to **be notified 3 days before my boost expires**
- So that **I can decide whether to renew before losing visibility**

**US-8: Admin monitors boost activity**
- As a **platform admin**
- I want to **view all active boosts, revenue reports, and adoption metrics**
- So that **I can monitor the health of the boost program and adjust pricing if needed**

---

## 5. Functional Requirements [REQUIRED]

### 5.1 Boost Tiers

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | System MUST support two boost tiers: **Boost** and **Featured** | MUST |
| FR-02 | **Boost** tier MUST cost $4.99 per listing for 7 days | MUST |
| FR-03 | **Featured** tier MUST cost $19.99 per listing for 30 days | MUST |
| FR-04 | Boost tier MUST increase listing ranking weight to 1.5x in search results | MUST |
| FR-05 | Featured tier MUST increase listing ranking weight to 3.0x in search results | MUST |
| FR-06 | Featured tier MUST place the listing in Featured carousel sections | MUST |
| FR-07 | Both tiers MUST display a visual badge on the listing card | MUST |

### 5.2 Listing Types

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-08 | System MUST support boosting Individual Animal listings | MUST |
| FR-09 | System MUST support boosting Animal Program listings | MUST |
| FR-10 | System MUST support boosting Breeding Program listings | MUST |
| FR-11 | System MUST support boosting Breeder profiles | MUST |
| FR-12 | System MUST support boosting Breeder Service listings | MUST |
| FR-13 | System MUST support boosting Breeding Listings | MUST |
| FR-14 | System MUST support boosting Provider Service listings | MUST |

### 5.3 Purchase Flow

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-15 | All boosts MUST be purchased via Stripe Checkout (one-time payment) | MUST |
| FR-16 | Breeders and providers MUST pay the same price (level playing field) | MUST |
| FR-17 | No free boost credits MUST be included in any subscription tier | MUST |
| FR-18 | System MUST create a PENDING boost record before redirecting to Stripe | MUST |
| FR-19 | System MUST activate the boost upon receiving Stripe webhook confirmation | MUST |
| FR-20 | Only LIVE listings MUST be eligible for boosting (not draft/paused) | MUST |
| FR-21 | A listing MUST NOT have more than one active boost at a time | MUST |

### 5.4 Lifecycle

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-22 | Boost MUST automatically expire after its duration (7 or 30 days) | MUST |
| FR-23 | System MUST send an email notification 3 days before boost expiry | MUST |
| FR-24 | System MUST send an email notification on boost expiry day | MUST |
| FR-25 | Users SHOULD be able to opt in to auto-renewal at purchase time | SHOULD |
| FR-26 | Auto-renewal MUST default to OFF | MUST |
| FR-27 | If a listing is paused/closed while boosted, the boost SHOULD pause and resume if re-published within the boost window | SHOULD |
| FR-28 | Users MUST be able to cancel a boost early (no refund, immediate stop) | MUST |

### 5.5 Featured Section Display

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-29 | Marketplace homepage MUST display a Featured carousel showing all featured listing types | MUST |
| FR-30 | Animals browse page MUST display a Featured carousel showing featured individual animals + animal programs | MUST |
| FR-31 | Breeders browse page MUST display a Featured carousel showing featured breeders + breeding programs | MUST |
| FR-32 | Services browse page MUST display a Featured carousel showing featured breeder services + breeding listings + provider services | MUST |
| FR-33 | Featured carousels MUST randomize listing order on each page load | MUST |
| FR-34 | Featured carousels MUST be scrollable horizontally (4 cards desktop, 1-2 mobile) | MUST |
| FR-35 | Featured carousels MUST be hidden entirely when no featured listings exist | MUST |

### 5.6 Search Ranking

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-36 | Boosted/featured listings MUST appear above non-boosted listings in search results | MUST |
| FR-37 | Featured listings (3.0x) MUST rank above Boosted listings (1.5x) | MUST |
| FR-38 | Among same-weight listings, recency MUST determine order | MUST |
| FR-39 | Max 15% of any search result page MUST be boosted/featured (buyer trust cap) | MUST |
| FR-40 | Boosted listings MUST still be subject to the same search filters (species, location, etc.) | MUST |

### 5.7 FTC Compliance & Transparency

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-41 | Boosted listings MUST display a "Promoted" disclosure label | MUST |
| FR-42 | Featured listings MUST display a "Featured" badge | MUST |
| FR-43 | Cards in the featured carousel section SHOULD have a distinctive visual treatment (brand-orange border glow) | SHOULD |

### 5.8 Analytics & Tracking

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-44 | System SHOULD track impressions per boost (how many times listing appeared in results) | SHOULD |
| FR-45 | System SHOULD track clicks per boost (how many times listing card was clicked) | SHOULD |
| FR-46 | System SHOULD track inquiries per boost (inquiries sent while boost active) | SHOULD |
| FR-47 | Sellers SHOULD be able to view boost performance metrics | SHOULD |

### 5.9 Admin

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-48 | Platform admins MUST be able to view all active boosts | MUST |
| FR-49 | Platform admins MUST be able to cancel/override any boost | MUST |
| FR-50 | Platform admins SHOULD be able to view boost revenue and adoption stats | SHOULD |

---

## 6. Business Rules [REQUIRED]

1. **Level playing field**: Breeders and providers pay identical prices for identical boost products. No subscription tier provides free or discounted boosts.
2. **One active boost per listing**: A listing cannot have both a Boost and a Featured active simultaneously. To upgrade from Boost to Featured, the user must cancel the Boost first (or wait for expiry) and purchase Featured.
3. **LIVE listings only**: Only listings with status LIVE/PUBLISHED can be boosted. Draft, paused, or closed listings are ineligible.
4. **Boost pauses with listing**: If a seller pauses or closes a boosted listing, the boost status changes to PAUSED. If the listing is re-published within the original boost window, the boost resumes (remaining time continues). If the boost window expires while paused, the boost expires.
5. **No refunds on cancellation**: Early cancellation stops the boost immediately but does not issue a refund. The boost record is marked CANCELED.
6. **15% cap per page**: No more than 15% of listings on any single search results page can be boosted/featured. Excess boosted listings fall to their organic ranking position.
7. **Featured carousel randomization**: The order of listings in Featured carousels is randomized on every page load to ensure fair exposure across all paying customers.
8. **Auto-renewal is opt-in**: Auto-renewal defaults to OFF. Users explicitly check a box to enable it. Auto-renewal sends a payment link email rather than auto-charging (no saved payment methods required for v1).
9. **Expiry notifications**: System sends email notifications at 3 days before expiry and on expiry day. Notifications are sent at most once per trigger.
10. **Provider identity**: Service providers (who have no BHQ subscription) are identified by their marketplace provider account. The system creates/reuses a Stripe customer for providers on first boost purchase.

---

## 7. Acceptance Criteria [REQUIRED]

### AC-1: Breeder purchases a Boost (Happy Path)

```
GIVEN a breeder is logged into the Commerce app
  AND they have a LIVE individual animal listing
WHEN they click "Boost This Listing" on the listing detail page
  AND select the "Boost" tier ($4.99 / 7 days)
  AND click "Purchase"
THEN a Stripe Checkout session is created
  AND the breeder is redirected to Stripe
  AND a ListingBoost record is created with status PENDING

WHEN the breeder completes payment on Stripe
THEN the Stripe webhook fires
  AND the ListingBoost status changes to ACTIVE
  AND startsAt is set to now
  AND expiresAt is set to now + 7 days
  AND the listing immediately appears boosted in marketplace search results
```

### AC-2: Provider purchases a Featured listing

```
GIVEN a service provider is logged into the Provider Portal
  AND they have a LIVE provider service listing
WHEN they click "Boost This Listing"
  AND select the "Featured" tier ($19.99 / 30 days)
  AND click "Purchase"
THEN a Stripe Checkout session is created
  AND the provider is redirected to Stripe

WHEN the provider completes payment
THEN the listing appears in the Featured carousel on:
  - The marketplace homepage (mixed featured)
  - The Services browse page
  AND the listing shows a "Featured" badge in search results
  AND the listing has 3.0x ranking weight
```

### AC-3: Featured carousel displays correctly

```
GIVEN 6 featured individual animal listings exist
  AND 3 featured breeder profiles exist
WHEN a buyer visits the marketplace homepage
THEN a "Featured" carousel section is visible
  AND it shows all 9 featured listings (scrollable)
  AND the order is randomized (different on each page load)

WHEN a buyer visits the Animals browse page
THEN a "Featured Animals" carousel shows only the 6 animal listings

WHEN a buyer visits the Breeders browse page
THEN a "Featured Breeders" carousel shows only the 3 breeder profiles
```

### AC-4: No featured listings - section hidden

```
GIVEN no active Featured-tier boosts exist
WHEN a buyer visits any marketplace page
THEN no Featured carousel section is rendered (no empty state)
```

### AC-5: 15% cap enforcement

```
GIVEN 20 listings on a search results page
  AND 5 of them are boosted (25%)
WHEN the page is rendered
THEN only 3 boosted listings appear in promoted positions (ceil(20 * 0.15) = 3)
  AND the remaining 2 boosted listings appear at their organic ranking position
```

### AC-6: Duplicate boost prevention

```
GIVEN a listing already has an active Boost
WHEN the seller tries to purchase another Boost or Featured for the same listing
THEN the system returns an error: "This listing already has an active boost"
  AND no Stripe Checkout session is created
```

### AC-7: Boost expiry and notification

```
GIVEN a boost has expiresAt = 3 days from now
WHEN the hourly expiration cron job runs
THEN an expiry warning email is sent to the seller
  AND expiryNotifiedAt is set to now

GIVEN the boost has reached its expiresAt
WHEN the hourly cron job runs
THEN the boost status changes to EXPIRED
  AND the listing returns to organic ranking
  AND an expiry notification email is sent
```

### AC-8: Auto-renewal flow

```
GIVEN a boost has autoRenew = true
  AND the boost has expired
WHEN the hourly cron job processes auto-renewals
THEN a new Stripe Checkout session is created for the same tier/price
  AND a payment link email is sent to the seller
  AND a new PENDING ListingBoost record is created
```

### AC-9: Listing paused while boosted

```
GIVEN a listing has an active boost
WHEN the seller pauses/closes the listing
THEN the boost status changes to PAUSED

WHEN the seller re-publishes the listing within the original boost window
THEN the boost status changes back to ACTIVE (remaining time continues)

WHEN the boost expiresAt passes while status is PAUSED
THEN the boost status changes to EXPIRED
```

### AC-10: Cancel boost early

```
GIVEN a seller has an active boost
WHEN they click "Cancel Boost" on the boost management page
THEN the boost status changes to CANCELED immediately
  AND the listing returns to organic ranking
  AND no refund is issued
```

---

## 8. UI/UX Requirements [OPTIONAL]

### 8.1 Boost Purchase Modal (Shared Component)

```
┌──────────────────────────────────────────────────────┐
│  Boost Your Listing                              [X] │
│                                                      │
│  "Premium Stallion Service - Thunder"                │
│                                                      │
│  ┌────────────────────┐  ┌────────────────────────┐  │
│  │ ⚡ BOOST           │  │ ⭐ FEATURED             │  │
│  │ $4.99 / 7 days     │  │ $19.99 / 30 days       │  │
│  │                    │  │                         │  │
│  │ • Higher ranking   │  │ • Everything in Boost   │  │
│  │   in search        │  │ • Homepage carousel     │  │
│  │ • "Boosted" badge  │  │ • Category carousel     │  │
│  │                    │  │ • "Featured" badge      │  │
│  │                    │  │ • Highlighted card       │  │
│  └────────────────────┘  └────────────────────────┘  │
│                                                      │
│  □ Auto-renew when this boost expires                │
│                                                      │
│  [ Cancel ]                     [ Purchase → $X.XX ] │
└──────────────────────────────────────────────────────┘
```

### 8.2 Badge Treatments

**Boost badge** (subtle):
- Top-right of listing card image
- Border style: `border border-[hsl(var(--brand-orange))]`
- Background: `bg-[hsl(var(--brand-orange))]/10`
- Text: `text-[hsl(var(--brand-orange))]`
- Label: `t('marketplace:badges.promoted')`

**Featured badge** (prominent):
- Top-right of listing card image
- Background: `bg-[hsl(var(--brand-orange))]`
- Text: `text-white`
- Icon: Star icon
- Label: `t('marketplace:badges.featured')`

**Featured card in carousel**:
- Ring border: `ring-2 ring-[hsl(var(--brand-orange))]/50`

### 8.3 Featured Carousel

- Sits between hero/category section and main listing grid
- Heading: `t('marketplace:featured.title')` (e.g., "Featured Listings")
- Per-page headings: "Featured Animals", "Featured Breeders", "Featured Services"
- Desktop: 4 cards visible, scroll arrows if > 4
- Mobile: 1-2 cards visible, swipe to scroll
- Snap scroll behavior: `snap-x snap-mandatory`
- Hidden entirely when no featured listings exist

---

## 9. Data Requirements [OPTIONAL]

### 9.1 ListingBoost Model

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | Int (PK) | Yes | Auto-increment primary key |
| tenantId | Int? | No | Breeder's tenant ID (null for providers) |
| providerId | Int? | No | Provider's account ID (null for breeders) |
| listingType | ListingBoostTarget (enum) | Yes | One of 7 listing types |
| listingId | Int | Yes | ID of the target listing |
| tier | BoostTier (enum) | Yes | BOOST or FEATURED |
| weight | Float | Yes | 1.5 (Boost) or 3.0 (Featured) |
| durationDays | Int | Yes | 7 (Boost) or 30 (Featured) |
| status | BoostStatus (enum) | Yes | PENDING, ACTIVE, PAUSED, EXPIRED, CANCELED |
| startsAt | DateTime? | No | Set when payment confirmed |
| expiresAt | DateTime? | No | startsAt + durationDays |
| autoRenew | Boolean | Yes | Default: false |
| amountCents | Int | Yes | 499 or 1999 |
| currency | String(3) | Yes | Default: "USD" |
| stripeSessionId | String? | No | Stripe Checkout session ID |
| stripePaymentId | String? | No | Stripe Payment Intent ID |
| impressions | Int | Yes | Default: 0 |
| clicks | Int | Yes | Default: 0 |
| inquiries | Int | Yes | Default: 0 |
| expiryNotifiedAt | DateTime? | No | When 3-day warning was sent |
| createdAt | DateTime | Yes | Auto-set |
| updatedAt | DateTime | Yes | Auto-updated |

### 9.2 Enums

**ListingBoostTarget**:
`INDIVIDUAL_ANIMAL` | `ANIMAL_PROGRAM` | `BREEDING_PROGRAM` | `BREEDER` | `BREEDER_SERVICE` | `BREEDING_LISTING` | `PROVIDER_SERVICE`

**BoostTier**: `BOOST` | `FEATURED`

**BoostStatus**: `PENDING` | `ACTIVE` | `PAUSED` | `EXPIRED` | `CANCELED`

### 9.3 Database Indexes

| Index | Purpose |
|-------|---------|
| `[tenantId]` | Breeder's boost lookups |
| `[providerId]` | Provider's boost lookups |
| `[listingType, listingId]` | Check if listing has active boost |
| `[status, expiresAt]` | Expiration cron job queries |
| `[listingType, status, tier]` | Featured section queries by page |

### 9.4 Existing Type (No Changes Needed)

The `MonetizationFields` interface in `packages/commerce-shared/src/api/types.ts` already defines all required fields and is extended by all public listing DTOs. These fields will be populated from active ListingBoost records.

---

## 10. Non-Functional Requirements [RECOMMENDED]

| Category | Requirement |
|----------|-------------|
| **Performance** | Featured carousel endpoint MUST respond in < 200ms |
| **Performance** | Boost-aware search sorting MUST NOT add more than 50ms to existing query time |
| **Performance** | Impression tracking MUST NOT block the listing response (async/batch) |
| **Scalability** | System MUST support up to 10,000 concurrent active boosts |
| **Security** | Boost purchase MUST only be initiated by the listing owner |
| **Security** | Stripe webhook MUST verify signature before processing |
| **Reliability** | Expiration cron job MUST be idempotent (safe to run multiple times) |
| **Accessibility** | Boost badges MUST have sufficient color contrast (WCAG AA) |
| **Accessibility** | Featured carousel MUST be keyboard-navigable |

---

## 11. Out of Scope [RECOMMENDED]

- Credit/wallet system for bulk boost purchases (v2)
- Boost duration customization (fixed durations for v1)
- Boost price customization by listing type (uniform pricing for v1)
- Social media cross-posting for Featured listings
- Boost gifting (one user purchasing for another)
- Refund processing for canceled boosts
- A/B testing of boost effectiveness
- Boost recommendations or suggestions based on listing performance
- Saved payment methods for auto-renewal (v1 sends payment link email)

---

## 12. Open Questions [OPTIONAL]

| # | Question | Owner | Status |
|---|----------|-------|--------|
| Q1 | Should boost prices be admin-configurable or hardcoded? | Product | Open |
| Q2 | Should we track boost performance against a control (same listing pre-boost)? | Product | Open |
| Q3 | What email templates should be used for expiry notifications? | Design | Open |
| Q4 | Should there be a "boost history" visible on the public listing page? | Product | Open |
| Q5 | **Breeding Program boost behavior** — RESOLVED. See Section 14.1 below. | Product | **Resolved** |

---

## 13. Dependencies [OPTIONAL]

- [x] Stripe billing integration (existing)
- [x] `MonetizationFields` type definition (existing in commerce-shared)
- [x] Public marketplace search endpoints (existing, need modification)
- [x] ListingCardLayout component with imageOverlays support (existing)
- [x] FeaturedSection component on marketplace homepage (existing, needs enhancement)
- [x] i18n infrastructure (@bhq/i18n active)
- [ ] Stripe product/price creation for Boost and Featured tiers (admin setup)
- [ ] Email templates for expiry notifications (design)
- [ ] Cron job infrastructure for expiration processing (verify existing scheduler)

---

## 14. Implementation Notes [OPTIONAL]

### Architecture

- **Database**: Single `ListingBoost` table with polymorphic `listingType` + `listingId` pattern
- **API**: New `src/routes/listing-boosts.ts` route file + `src/services/listing-boost-service.ts` service
- **Webhook**: Add `listing_boost` case to existing Stripe webhook handler in `billing.ts`
- **Search**: Modify all 7 listing type queries in `public-marketplace.ts` with boost-aware sorting
- **Frontend**: Shared `BoostListingModal` component in `packages/commerce-shared/` used by both Commerce app and Provider Portal
- **Feature slices**: `listing-boosts/` feature in both `apps/commerce/` and `apps/marketplace/src/provider/`

### Purchase Flow (Breeder via Commerce App)

```
Breeder → "Boost" button → BoostListingModal → Select tier → "Purchase"
  → POST /api/v1/listing-boosts/checkout (creates PENDING record)
  → Redirect to Stripe Checkout
  → Payment completes → Stripe webhook
  → ListingBoost status → ACTIVE
  → Listing immediately boosted in marketplace
```

### Purchase Flow (Provider via Provider Portal)

```
Provider → "Boost" button → BoostListingModal (same component) → Select tier → "Purchase"
  → POST /api/v1/listing-boosts/checkout (creates PENDING record with providerId)
  → Redirect to Stripe Checkout (Stripe customer created/reused for provider)
  → Payment completes → Stripe webhook
  → ListingBoost status → ACTIVE
  → Listing immediately boosted in marketplace
```

### Search Ranking Algorithm

```
1. Fetch active boosts for the listing type being queried
2. Build a Map of listingId → { weight, tier }
3. Fetch listings with existing pagination
4. Sort: Featured (3.0x) > Boosted (1.5x) > Organic (1.0x) > Recency
5. Enforce 15% cap: move excess boosted listings to organic position
6. Populate MonetizationFields on each DTO from boost data
```

### Featured Carousel Page-Type Mapping

| Browse Page | Listing Types Included |
|-------------|----------------------|
| Homepage (all) | All 7 types |
| Animals | INDIVIDUAL_ANIMAL, ANIMAL_PROGRAM |
| Breeders | BREEDER, BREEDING_PROGRAM |
| Services | BREEDER_SERVICE, BREEDING_LISTING, PROVIDER_SERVICE |

### 14.1 Breeding Program Boost Behavior (Q5 Resolution)

Breeding Programs are structurally different from other listing types — they are containers for breeding plans, offspring groups, and linked animals (`MktListingBreedingProgram` → `BreedingPlan` → `OffspringGroup` → `Offspring`). The following decisions were made:

**Q5a: Boost scope — program listing only, no cascade.**
Boosting a Breeding Program promotes the program card in search results and the Featured carousel. It does NOT cascade visibility to offspring within. The program is the marketplace entry point; once a buyer clicks through to the program detail page, they see all breeding plans, available offspring, pricing, and waitlist/inquiry CTAs. Offspring visibility follows naturally from the program being discovered.

**Q5b: Individual offspring boosting — not supported in v1.**
Offspring are not independently listed on the marketplace. They exist inside offspring groups inside breeding plans inside programs. There is no standalone offspring card on browse pages. A breeder who wants to promote available offspring should boost the Breeding Program that contains them. If individual offspring listings are added in the future (similar to `MktListingIndividualAnimal`), an `OFFSPRING` boost target can be added then.

**Q5c: Featured carousel card — same generic card layout.**
The `FeaturedCarousel` uses a generic card (image, title, subtitle, price). For breeding programs:
- **title**: Program name (e.g., "Goldendoodle Program")
- **subtitle**: Breed text + breeder name (e.g., "Goldendoodle · Happy Paws Ranch")
- **imageUrl**: Program cover image
- **href**: `/breeding-programs/{slug}`
- **priceCents**: Starting price from pricing tiers (or null if pricing is hidden)

No special card treatment needed — consistent with all other listing types.

**Q5d: Inquiry tracking — yes, wire into both inquiry and waitlist endpoints.**
Breeding programs have their own inquiry endpoint (`POST /public/breeding-programs/:slug/inquiries`) and waitlist endpoint (`POST /public/breeding-programs/:slug/waitlist`) in `public-breeding-programs.ts`. Both should track inquiries against active boosts since both indicate buyer intent. The `trackBoostInquiry("BREEDING_PROGRAM", programId)` call should fire on both endpoints.

### Implementation Phases

**Phase 1: Backend Foundation**
1. Add Prisma models + migration
2. Create listing-boosts route + service
3. Add Stripe checkout + webhook handler
4. Add expiration cron job
5. Add featured listings public endpoint

**Phase 2: Search Integration**
1. Modify all 7 listing queries with boost-aware sorting
2. Implement 15% cap logic
3. Populate MonetizationFields on all public DTOs

**Phase 3: Marketplace Display**
1. Create BoostBadge shared component
2. Create FeaturedCarousel shared component
3. Add carousels to homepage + 3 browse pages
4. Integrate badge into ListingCardLayout
5. Add i18n translation keys

**Phase 4: Purchase Flows**
1. Create BoostListingModal shared component
2. Add "Boost" button to Commerce listing pages (breeders)
3. Add "Boost" button to Provider Portal listing pages (providers)
4. Create boost management feature slices in both apps
5. Build boost analytics display

**Phase 5: Admin & Analytics**
1. Create admin boost management route + page
2. Add revenue and adoption reporting
3. Add boost performance analytics

---

## 15. Key Files to Modify [SUPPLEMENTARY]

### API (breederhq-api)

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add ListingBoost model + enums |
| `src/routes/listing-boosts.ts` | **NEW** - Boost checkout + CRUD endpoints |
| `src/routes/admin-boosts.ts` | **NEW** - Admin boost management |
| `src/routes/public-marketplace.ts` | Modify all 7 listing type queries for boost-aware sorting + featured endpoint |
| `src/routes/billing.ts` | Add webhook case for `listing_boost` checkout completion |
| `src/services/listing-boost-service.ts` | **NEW** - Boost business logic, validation, expiration |

### Frontend (breederhq)

| File | Change |
|------|--------|
| `packages/commerce-shared/src/components/BoostBadge.tsx` | **NEW** - Shared badge component |
| `packages/commerce-shared/src/components/BoostListingModal.tsx` | **NEW** - Shared purchase modal |
| `packages/commerce-shared/src/components/FeaturedCarousel.tsx` | **NEW** - Scrollable featured listings carousel |
| `packages/commerce-shared/src/components/ListingCardLayout.tsx` | Add boost badge to imageOverlays |
| `apps/commerce/src/features/commerce/features/listing-boosts/` | **NEW** - Breeder boost management slice |
| `apps/marketplace/src/provider/features/listing-boosts/` | **NEW** - Provider boost management slice |
| `apps/marketplace/src/marketplace/features/home/PublicSections.tsx` | Add FeaturedCarousel (page=all) |
| `apps/marketplace/src/marketplace/features/animals/` | Add FeaturedCarousel (page=animals) |
| `apps/marketplace/src/marketplace/features/breeders/` | Add FeaturedCarousel (page=breeders) |
| `apps/marketplace/src/marketplace/features/services/` | Add FeaturedCarousel (page=services) |
| `packages/i18n/src/locales/en/marketplace.json` | Add boost/featured translation keys |

---

## 16. Related Documents [RECOMMENDED]

- [MonetizationFields type](../../../packages/commerce-shared/src/api/types.ts) - Existing type contract
- [Public Marketplace Routes](../../../breederhq-api/src/routes/public-marketplace.ts) - Search endpoints to modify
- [Billing Routes](../../../breederhq-api/src/routes/billing.ts) - Stripe webhook handler
- [ListingCardLayout](../../../packages/commerce-shared/src/components/ListingCardLayout.tsx) - Card component for badge integration
- [PublicSections](../../../apps/marketplace/src/marketplace/features/home/PublicSections.tsx) - Existing FeaturedSection
- [PLATFORM-FEATURES.md](../../PLATFORM-FEATURES.md) - Feature status table (needs update)
- [COMPREHENSIVE-PLATFORM-FEATURE-AUDIT-2026-02.md](../../codebase/audits/COMPREHENSIVE-PLATFORM-FEATURE-AUDIT-2026-02.md) - Feature audit (needs update)

---

## 17. Market Research Summary [SUPPLEMENTARY]

Researched 12+ marketplaces including DreamHorse, ehorses, EquineNow, HorseClicks, AKC Marketplace, Puppies.com, Etsy, eBay, Facebook Marketplace, and Thumbtack.

| Pattern | Industry Standard | BHQ Approach |
|---------|-------------------|--------------|
| Pricing model | Flat-fee per listing (not CPC) | Flat-fee via Stripe Checkout |
| Tier count | 2-4 levels | 2 tiers: Boost + Featured |
| Boost duration | 7-14 days (bumps), 30-90 days (featured) | 7-day boost, 30-day featured |
| Pricing range | $3-10 boost, $15-50 featured | $4.99 boost, $19.99 featured |
| Auto-renewal | Opt-in for niche marketplaces | Opt-in (trust matters in breeder community) |
| Featured display | Carousel on homepage + category pages | Randomized carousel on homepage + browse pages |
| Cap in search results | < 15-20% of visible results | 15% cap per page |

**Why flat-fee, not CPC**: Niche marketplace with hundreds/low-thousands of listings. CPC requires high traffic volume. Flat-fee is what every successful animal marketplace uses.

**Why no free/included boosts**: Providers have no subscription. Giving breeders free credits would create an unfair advantage. Level playing field is essential for marketplace trust.

---

## 18. Feature Documentation Entries [SUPPLEMENTARY]

### For PLATFORM-FEATURES.md (Marketplace Module)

| Feature | Status | Description |
|---------|--------|-------------|
| Listing Boost | 📋 Planned | Paid boost ($4.99/7 days) increases listing ranking in search results with "Boosted" badge |
| Featured Listing | 📋 Planned | Paid featured ($19.99/30 days) adds listing to Featured carousels on homepage and browse pages with "Featured" badge and 3x ranking |
| Boost Management | 📋 Planned | Sellers view active/expired boosts, analytics (impressions/clicks/inquiries), and manage auto-renewal |
| Admin Boost Management | 📋 Planned | Platform admins view all boosts, revenue reports, and can override/cancel boosts |

### For COMPREHENSIVE-PLATFORM-FEATURE-AUDIT-2026-02.md

| Feature ID | Feature Name | Description | Suggested Tier |
|------------|--------------|-------------|----------------|
| MKT-040 | Listing Boost Purchase | Flat-fee boost ($4.99/7d) via Stripe Checkout for all 7 listing types | Pro |
| MKT-041 | Featured Listing Purchase | Premium featured ($19.99/30d) with carousel placement via Stripe Checkout | Pro |
| MKT-042 | Featured Carousels | Randomized scrollable carousels on homepage + 3 browse pages for Featured listings | Free (viewing) |
| MKT-043 | Boost-Aware Search Ranking | Boosted/featured listings rank higher in search results with 15% cap per page | Free (viewing) |
| MKT-044 | Boost Analytics | Impression, click, and inquiry tracking per boost with seller dashboard | Pro |
| MKT-045 | Boost Auto-Renewal | Opt-in auto-renewal with expiry notifications (3-day warning + expiry day) | Pro |
| MKT-046 | Admin Boost Management | Platform admin view of all boosts, revenue reporting, override capability | Admin |

---

## 19. Engineering Prompts for Claude AI [SUPPLEMENTARY]

**Prerequisites**: Before running any prompt, save this spec to `docs/planning/specs/MARKETPLACE-BOOST-SPEC.md` in both the `breederhq` and `breederhq-api` repos (or ensure Claude has access to both working directories).

Execute prompts sequentially — each phase depends on the previous.

**Important conventions**:
- **Prisma migrations**: Do NOT run `prisma migrate` yourself. Write the schema changes and tell the user the migration name to use. The user will run the migration manually.
- **Platform documentation**: Every prompt that adds or changes user-facing features MUST update `docs/PLATFORM-FEATURES.md` and `docs/codebase/audits/COMPREHENSIVE-PLATFORM-FEATURE-AUDIT-2026-02.md` per the documentation standards in CLAUDE.md. Use the entries from Section 18 of this spec.

---

### Prompt 1: Backend Foundation — Database + API + Stripe

```
Read docs/planning/specs/MARKETPLACE-BOOST-SPEC.md sections 9 (Data Requirements), 14 (Implementation Notes — Phase 1), and 15 (Key Files — API).

Execute Phase 1: Backend Foundation.

Build the ListingBoost Prisma model, enums, and indexes exactly as specified in Section 9. Create the listing-boost-service.ts, listing-boosts.ts routes, and admin-boosts.ts routes with all endpoints from Section 14. Add the listing_boost webhook case to billing.ts. Set up the expiration cron job.

Follow existing patterns in breederhq-api/src/routes/billing.ts for Stripe checkout and webhook handling. Follow breederhq-api/src/services/stripe-service.ts for Stripe API patterns.

Do NOT run prisma migrate — just write the schema changes. Tell me the migration name to use: `add-listing-boost-model`. I will run the migration myself.

Run tsc --noEmit to verify. Zero type errors.

Update docs/PLATFORM-FEATURES.md and docs/codebase/audits/COMPREHENSIVE-PLATFORM-FEATURE-AUDIT-2026-02.md with the relevant entries from Section 18 of the spec per platform documentation standards.
```

---

### Prompt 2: Search Ranking Integration

```
Read docs/planning/specs/MARKETPLACE-BOOST-SPEC.md sections 5.6 (Search Ranking requirements FR-36 through FR-40), 6 (Business Rule #6 — 15% cap), and 14 (Implementation Notes — Search Ranking Algorithm).

Execute Phase 2: Search Integration.

Create the applyBoostRanking helper in listing-boost-service.ts. Apply it to ALL 7 listing type queries in breederhq-api/src/routes/public-marketplace.ts. Populate MonetizationFields on all public DTOs — the type is already defined in packages/commerce-shared/src/api/types.ts. Add async impression tracking.

Do NOT change existing Prisma query structure — apply ranking AFTER fetching. Run tsc --noEmit. Zero type errors.

Update docs/PLATFORM-FEATURES.md and docs/codebase/audits/COMPREHENSIVE-PLATFORM-FEATURE-AUDIT-2026-02.md with the relevant entries from Section 18 of the spec per platform documentation standards.
```

---

### Prompt 3: Frontend — Marketplace Display (Badges + Carousels)

```
Read docs/planning/specs/MARKETPLACE-BOOST-SPEC.md sections 5.5 (Featured Section Display FR-29 through FR-35), 5.7 (FTC Compliance FR-41 through FR-43), 8 (UI/UX Requirements), and 14 (Implementation Notes — Featured Carousel Page-Type Mapping).

Execute Phase 3: Marketplace Display.

Create BoostBadge.tsx and FeaturedCarousel.tsx in packages/commerce-shared/src/components/. Add i18n keys to packages/i18n/src/locales/en/marketplace.json. Integrate the badge into ListingCardLayout.tsx imageOverlays. Add FeaturedCarousel to the marketplace homepage (page=all), Animals page (page=animals), Breeders page (page=breeders), and Services page (page=services).

Follow CLAUDE.md rules: all strings use t(), dark theme tokens only (no gray-*), brand color is bg-[hsl(var(--brand-orange))]. Run pnpm run typecheck. Zero errors.

Update docs/PLATFORM-FEATURES.md and docs/codebase/audits/COMPREHENSIVE-PLATFORM-FEATURE-AUDIT-2026-02.md with the relevant entries from Section 18 of the spec per platform documentation standards.
```

---

### Prompt 4: Frontend — Purchase Flows (Breeder + Provider)

```
Read docs/planning/specs/MARKETPLACE-BOOST-SPEC.md sections 4 (User Stories US-1 through US-6), 8.1 (Boost Purchase Modal wireframe), and 14 (Implementation Notes — both Purchase Flows).

Execute Phase 4: Purchase Flows.

Create BoostListingModal.tsx in packages/commerce-shared/src/components/ (shared between Commerce and Provider Portal). Create the listing-boosts/ feature slice in apps/commerce/ for breeders and apps/marketplace/src/provider/ for providers. Add "Boost This Listing" buttons to listing management pages in both apps. Handle Stripe redirect success/cancel URLs.

The modal calls POST /api/v1/listing-boosts/checkout and redirects to Stripe. Use useApiClient() — never raw fetch(). Follow CLAUDE.md rules. Run pnpm run typecheck. Zero errors.

Update docs/PLATFORM-FEATURES.md and docs/codebase/audits/COMPREHENSIVE-PLATFORM-FEATURE-AUDIT-2026-02.md with the relevant entries from Section 18 of the spec per platform documentation standards.
```

---

### Prompt 5: Admin Dashboard + Analytics + Documentation

```
Read docs/planning/specs/MARKETPLACE-BOOST-SPEC.md sections 5.8 (Analytics FR-44 through FR-47), 5.9 (Admin FR-48 through FR-50), and 18 (Feature Documentation Entries).

Execute Phase 5: Admin & Analytics.

Build the admin boost management page as a feature slice in apps/platform/. Verify and enhance the admin-boosts.ts API endpoints (stats aggregation). Add click tracking endpoint (POST /api/v1/public/marketplace/listings/:type/:id/click with rate limiting). Add inquiry tracking to the existing inquiry endpoint. Use navigator.sendBeacon for non-blocking click tracking on the frontend.

Run pnpm run typecheck. Zero errors.

Update docs/PLATFORM-FEATURES.md and docs/codebase/audits/COMPREHENSIVE-PLATFORM-FEATURE-AUDIT-2026-02.md with the relevant entries from Section 18 of the spec per platform documentation standards.
```

---

### Prompt 6: Expiration Cron Job + Email Notifications

```
Read docs/planning/specs/MARKETPLACE-BOOST-SPEC.md sections 5.4 (Lifecycle FR-22 through FR-28), 6 (Business Rules #8 and #9), and acceptance criteria AC-7 and AC-8.

Execute Phase 6: Expiration & Notifications.

Implement processBoostExpirations() in the cron job: expire active boosts, send 3-day warning emails, send expiry-day emails, and process auto-renewals. Auto-renewal sends a payment link email (does NOT auto-charge). Find and use existing email infrastructure in breederhq-api (search for sendEmail, email-service, nodemailer, SendGrid, or SES patterns).

The function MUST be idempotent. Use expiryNotifiedAt flag to prevent duplicate emails. Disable autoRenew on the expired boost after creating the renewal checkout. Run tsc --noEmit. Zero type errors.

Update docs/PLATFORM-FEATURES.md and docs/codebase/audits/COMPREHENSIVE-PLATFORM-FEATURE-AUDIT-2026-02.md with the relevant entries from Section 18 of the spec per platform documentation standards.
```

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-02-15 | 1.2 | Updated prompts: user runs Prisma migrate (with migration name), all prompts require platform documentation updates | Claude / Platform Team |
| 2026-02-15 | 1.1 | Added engineering prompts for Claude AI (Section 19) | Claude / Platform Team |
| 2026-02-15 | 1.0 | Initial spec draft | Claude / Platform Team |
