# ✅ Subscription Schema Complete & Ready for Migration

## Summary

All Prisma schema changes for the subscription/billing system have been successfully added, formatted, and validated!

## What Was Added

### 1. **New Enums** (8 total)
- `ProductType` - SUBSCRIPTION, ADD_ON, ONE_TIME
- `BillingInterval` - MONTHLY, YEARLY, QUARTERLY
- `SubscriptionStatus` - TRIAL, ACTIVE, PAST_DUE, CANCELED, EXPIRED, INCOMPLETE, PAUSED
- `UsageMetricKey` - ANIMAL_COUNT, CONTACT_COUNT, PORTAL_USER_COUNT, etc.
- `AnimalCategory` - RABBIT, SMALL_RODENT, BIRD, CAT, SMALL_DOG, LARGE_DOG, HORSE, LIVESTOCK, EXOTIC, OTHER
- `ListingType` - BREEDING_PROGRAM, STUD_SERVICE, TRAINING, VETERINARY, etc.
- `ListingStatus` - DRAFT, PENDING_REVIEW, ACTIVE, PAUSED, EXPIRED, REMOVED
- `ListingTier` - FREE, PREMIUM, BUSINESS

### 2. **Expanded EntitlementKey Enum**
Added 20+ new entitlement keys:
- Surface access: PLATFORM_ACCESS, PORTAL_ACCESS
- Features: BREEDING_PLANS, FINANCIAL_SUITE, DOCUMENT_MANAGEMENT, etc.
- Quotas: ANIMAL_QUOTA, CONTACT_QUOTA, MARKETPLACE_LISTING_QUOTA, etc.

### 3. **Enhanced BillingAccount Model**
- Added Stripe customer ID
- Added billing contact info (email, company, tax ID)
- Added billing address fields
- Kept legacy fields for backward compatibility
- Added index on `stripeCustomerId`

### 4. **New Core Models** (11 total)

#### Product Catalog
- **Product** - Subscription plans, add-ons, one-time products
- **ProductEntitlement** - Links products to entitlements they grant

#### Subscriptions
- **Subscription** - Tenant subscriptions with trial/billing tracking
- **SubscriptionAddOn** - Add-ons attached to subscriptions

#### Usage Tracking
- **UsageRecord** - Time-series usage tracking
- **UsageSnapshot** - Current usage vs limits (fast reads)

#### Payment Methods
- **PaymentMethod** - Stripe payment methods (cards, bank accounts)

#### Referral System
- **ReferralCode** - Referral codes owned by tenants
- **Referral** - Tracks referee/referrer relationships and rewards

#### Marketplace
- **MarketplaceListing** - Listings for breeders and service providers
- **ServiceProviderProfile** - Non-breeder service providers
- **SystemConfig** - System-wide configuration (quotas, limits)

### 5. **New Relations Added**

**To Tenant model:**
- subscriptions
- usageRecords
- usageSnapshots
- paymentMethods
- referralCodesOwned
- referralsMade
- referralsReceived
- marketplaceListings

**To User model:**
- serviceProviderProfile

## Validation Status

✅ **Schema formatted successfully** (Prisma format)
✅ **Schema validated successfully** (No errors)
⚠️  **Warning about `SetNull` on required fields** (pre-existing, not from our changes)

## Next Steps

### Step 1: Create Migration

Run this command to create the migration:

```bash
npm run db:dev:migrate
```

When prompted for migration name, use:
```
add_subscription_billing_system
```

This will create a migration file like:
```
prisma/migrations/20260107XXXXXX_add_subscription_billing_system/migration.sql
```

### Step 2: Review Migration SQL

Check the generated migration SQL to ensure:
- All tables are created
- All indexes are added
- Foreign keys are correct
- No data loss warnings

### Step 3: Apply Migration

The migration will be applied automatically by the `npm run db:dev:migrate` command.

### Step 4: Verify Migration

```bash
# Check that all tables exist
npx prisma db execute --stdin < check_tables.sql

# Or connect to DB and verify
psql $DATABASE_URL -c "\dt"
```

### Step 5: Generate Prisma Client

```bash
npx prisma generate
```

This regenerates the Prisma client with all new models and types.

## Database Impact

**New Tables:** 13
- Product
- ProductEntitlement
- Subscription
- SubscriptionAddOn
- UsageRecord
- UsageSnapshot
- PaymentMethod
- ReferralCode
- Referral
- MarketplaceListing
- ServiceProviderProfile
- SystemConfig
- (BillingAccount modified, not new)

**Modified Tables:** 3
- Tenant (added 8 new relations)
- User (added 1 new relation)
- BillingAccount (added 10 new columns)

**New Enums:** 8

**Modified Enums:** 1
- EntitlementKey (expanded from 1 to 24 values)

## Configuration Flexibility

The schema is designed to support multiple pricing strategies without code changes:

✅ **Configurable Quotas** - Stored in `ProductEntitlement.limitValue`
✅ **Marketplace Listing Fees** - `MarketplaceListing.monthlyFeeCents`
✅ **Commission Model** - `MarketplaceListing.commissionRate` (optional)
✅ **Trial Limits** - Can be different from paid tier limits
✅ **Add-on Support** - Extra animal slots, listings, storage, etc.
✅ **Referral System** - Ready to activate with Stripe coupons

## What's NOT in Database (Runtime Config)

These will be in environment variables or `SystemConfig` table:

- Trial duration (14 days)
- Specific quota limits (50 animals for Pro, etc.)
- Listing fee amounts per category
- Referral reward amounts
- Grace period durations

## Backwards Compatibility

✅ **Existing BillingAccount records preserved** (legacy fields kept)
✅ **No breaking changes to existing models**
✅ **All new fields are optional or have defaults**
✅ **Migration is additive only** (no deletions)

## Ready for Next Phase

After migration, we can proceed with:

1. **Seed Data** - Create Pro/Enterprise products
2. **Stripe Integration** - Service layer + webhooks
3. **Quota Middleware** - Enforcement layer
4. **Billing Routes** - API endpoints
5. **Frontend UI** - Billing settings, pricing page

## Files Created

1. `prisma/schema.prisma` - ✅ Updated with all changes
2. `prisma/SUBSCRIPTION_SCHEMA_CHANGES.md` - Documentation of changes
3. `prisma/subscription-models-addition.prisma` - Reference copy of models
4. `SCHEMA_MIGRATION_READY.md` - This file

---

**Status:** ✅ Ready to run migration
**Blocking Issues:** None
**Next Command:** `npm run db:dev:migrate`
