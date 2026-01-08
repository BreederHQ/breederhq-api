# Subscription System Schema Changes

## Instructions

This file contains all the schema additions needed for the subscription/billing system.

### Step 1: Add Enums

Add these enums to the enum section (after line 165, after `EntitlementStatus`):

```prisma
// Subscription & Billing enums
enum ProductType {
  SUBSCRIPTION  // Recurring subscription plan
  ADD_ON        // Add-on to subscription
  ONE_TIME      // One-time purchase
}

enum BillingInterval {
  MONTHLY
  YEARLY
  QUARTERLY
}

enum SubscriptionStatus {
  TRIAL          // In trial period
  ACTIVE         // Paid and active
  PAST_DUE       // Payment failed, in grace period
  CANCELED       // Canceled by user
  EXPIRED        // Trial or subscription expired
  INCOMPLETE     // Stripe payment pending
  PAUSED         // Paused (future feature)
}

enum UsageMetricKey {
  ANIMAL_COUNT
  CONTACT_COUNT
  PORTAL_USER_COUNT
  BREEDING_PLAN_COUNT
  MARKETPLACE_LISTING_COUNT
  STORAGE_BYTES
  SMS_SENT
  API_CALLS
}

enum AnimalCategory {
  RABBIT
  SMALL_RODENT       // Hamster, guinea pig, etc.
  BIRD
  CAT
  SMALL_DOG          // Under 25 lbs
  LARGE_DOG          // Over 25 lbs
  HORSE
  LIVESTOCK          // Cattle, sheep, goats
  EXOTIC             // Reptiles, etc.
  OTHER
}

enum ListingType {
  BREEDING_PROGRAM   // Breeder's main program profile
  STUD_SERVICE      // Stud/breeding services
  TRAINING          // Training services
  VETERINARY        // Vet services
  PHOTOGRAPHY       // Photo/video services
  GROOMING          // Grooming services
  TRANSPORT         // Transport/shipping
  BOARDING          // Boarding/kennel
  PRODUCT           // Equipment, supplies
  OTHER_SERVICE
}

enum ListingStatus {
  DRAFT
  PENDING_REVIEW
  ACTIVE
  PAUSED
  EXPIRED
  REMOVED
}

enum ListingTier {
  FREE      // Basic listing
  PREMIUM   // Featured, more photos
  BUSINESS  // Top placement, analytics
}
```

### Step 2: Expand EntitlementKey Enum

Replace the existing `EntitlementKey` enum (line 158-160) with:

```prisma
// User entitlement enums for marketplace and other feature access
enum EntitlementKey {
  // Surface access
  MARKETPLACE_ACCESS  // Access to marketplace surface
  PLATFORM_ACCESS     // Access to platform
  PORTAL_ACCESS       // Access to portal

  // Feature access
  BREEDING_PLANS
  FINANCIAL_SUITE
  DOCUMENT_MANAGEMENT
  HEALTH_RECORDS
  WAITLIST_MANAGEMENT
  ADVANCED_REPORTING
  API_ACCESS
  MULTI_LOCATION
  E_SIGNATURES

  // Quotas (use ProductEntitlement.limitValue for the actual number)
  ANIMAL_QUOTA
  CONTACT_QUOTA
  PORTAL_USER_QUOTA
  BREEDING_PLAN_QUOTA
  MARKETPLACE_LISTING_QUOTA
  STORAGE_QUOTA_GB
  SMS_QUOTA
}
```

### Step 3: Add Relations to Tenant Model

Add these relations to the Tenant model (after line 688, before `@@index` directives):

```prisma
  // Subscription & Billing
  subscriptions         Subscription[]
  usageRecords          UsageRecord[]
  usageSnapshots        UsageSnapshot[]
  paymentMethods        PaymentMethod[]
  referralCodesOwned    ReferralCode[] @relation("ReferralCodeOwner")
  referralsMade         Referral[]     @relation("ReferralsMade")
  referralsReceived     Referral[]     @relation("ReferralsReceived")
  marketplaceListings   MarketplaceListing[]
```

### Step 4: Add Relation to User Model

Add this relation to the User model (after line 460, in the relations section):

```prisma
  serviceProviderProfile ServiceProviderProfile?
```

### Step 5: Update BillingAccount Model

Replace the existing `BillingAccount` model (lines 715-727) with:

```prisma
model BillingAccount {
  id                   Int       @id @default(autoincrement())
  tenantId             Int       @unique
  tenant               Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  // Stripe customer
  stripeCustomerId     String?   @unique

  // Billing contact
  billingEmail         String?
  companyName          String?
  taxId                String?   // VAT/EIN

  // Billing address
  addressLine1         String?
  addressLine2         String?
  city                 String?
  state                String?
  postalCode           String?
  country              String?   @db.VarChar(2)

  // Legacy fields (deprecated, keep for backward compatibility)
  provider             String?
  subscriptionId       String?
  plan                 String?
  status               String?
  currentPeriodEnd     DateTime?

  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@index([stripeCustomerId])
}
```

### Step 6: Add New Models

Add these models after the BillingAccount model (after line 727):

```prisma
/**
 * ────────────────────────────────────────────────────────────────────────────
 * Subscription & Billing System
 * ────────────────────────────────────────────────────────────────────────────
 */

model Product {
  id              Int       @id @default(autoincrement())

  // Product details
  name            String
  description     String?   @db.Text
  type            ProductType
  billingInterval BillingInterval?

  // Stripe integration
  stripeProductId String?   @unique
  stripePriceId   String?

  // Status
  active          Boolean   @default(true)

  // Pricing
  priceUSD        Int       // Price in cents
  currency        String    @default("USD") @db.VarChar(3)

  // Display
  sortOrder       Int       @default(0)
  features        Json?     // Feature bullets for display

  // Relations
  entitlements    ProductEntitlement[]
  subscriptions   Subscription[]
  addOns          SubscriptionAddOn[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([type, active])
  @@index([active, sortOrder])
}

model ProductEntitlement {
  id              Int            @id @default(autoincrement())
  productId       Int
  product         Product        @relation(fields: [productId], references: [id], onDelete: Cascade)

  entitlementKey  EntitlementKey
  limitValue      Int?           // Quota limit (null = unlimited)
  metadata        Json?

  createdAt       DateTime       @default(now())

  @@unique([productId, entitlementKey])
  @@index([productId])
  @@index([entitlementKey])
}

model Subscription {
  id                  Int                 @id @default(autoincrement())
  tenantId            Int
  tenant              Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  productId           Int
  product             Product             @relation(fields: [productId], references: [id])

  status              SubscriptionStatus  @default(TRIAL)

  // Stripe references
  stripeSubscriptionId String?            @unique
  stripeCustomerId     String?

  // Billing cycle
  currentPeriodStart  DateTime?
  currentPeriodEnd    DateTime?
  cancelAtPeriodEnd   Boolean             @default(false)
  canceledAt          DateTime?

  // Trial tracking
  trialStart          DateTime?
  trialEnd            DateTime?

  // Pricing snapshot
  amountCents         Int
  currency            String              @default("USD") @db.VarChar(3)
  billingInterval     BillingInterval

  // Metadata
  metadata            Json?

  // Relations
  addOns              SubscriptionAddOn[]

  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  @@index([tenantId])
  @@index([status])
  @@index([stripeSubscriptionId])
  @@index([stripeCustomerId])
  @@index([currentPeriodEnd])
}

model SubscriptionAddOn {
  id              Int          @id @default(autoincrement())
  subscriptionId  Int
  subscription    Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  productId       Int
  product         Product      @relation(fields: [productId], references: [id])

  quantity        Int          @default(1)
  amountCents     Int

  // Stripe reference
  stripeItemId    String?

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([subscriptionId])
  @@index([productId])
}

model UsageRecord {
  id              Int            @id @default(autoincrement())
  tenantId        Int
  tenant          Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  metricKey       UsageMetricKey
  value           Int
  recordedAt      DateTime       @default(now())

  // Optional context
  userId          String?
  resourceId      Int?
  metadata        Json?

  @@index([tenantId, metricKey, recordedAt])
  @@index([recordedAt])
}

model UsageSnapshot {
  tenantId        Int
  tenant          Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  metricKey       UsageMetricKey
  currentValue    Int
  limit           Int?           // null = unlimited

  lastUpdatedAt   DateTime       @default(now())

  @@id([tenantId, metricKey])
  @@index([tenantId])
}

model PaymentMethod {
  id                    Int      @id @default(autoincrement())
  tenantId              Int
  tenant                Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  stripePaymentMethodId String   @unique
  type                  String   // "card", "us_bank_account"

  // Card details
  cardBrand             String?
  cardLast4             String?
  cardExpMonth          Int?
  cardExpYear           Int?

  // Bank details
  bankName              String?
  bankLast4             String?

  isDefault             Boolean  @default(false)

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([tenantId])
  @@index([tenantId, isDefault])
}

model ReferralCode {
  id               Int        @id @default(autoincrement())

  code             String     @unique

  referrerTenantId Int
  referrer         Tenant     @relation("ReferralCodeOwner", fields: [referrerTenantId], references: [id], onDelete: Cascade)

  // Reward structure
  refereeDiscountStripeCouponId String?
  referrerCreditCents           Int?

  // Tracking
  usedCount        Int        @default(0)
  maxUses          Int?
  expiresAt        DateTime?
  active           Boolean    @default(true)

  // Relations
  referrals        Referral[]

  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  @@index([referrerTenantId])
  @@index([code])
  @@index([active, expiresAt])
}

model Referral {
  id                     Int          @id @default(autoincrement())

  codeId                 Int
  code                   ReferralCode @relation(fields: [codeId], references: [id], onDelete: Cascade)

  referrerTenantId       Int
  referrer               Tenant       @relation("ReferralsMade", fields: [referrerTenantId], references: [id], onDelete: Cascade)

  refereeTenantId        Int
  referee                Tenant       @relation("ReferralsReceived", fields: [refereeTenantId], references: [id], onDelete: Cascade)

  // Reward tracking
  refereeDiscountApplied Boolean      @default(false)
  refereeStripeCouponId  String?

  referrerCreditApplied  Boolean      @default(false)
  referrerCreditCents    Int?
  referrerCreditedAt     DateTime?

  status                 String       @default("active")

  createdAt              DateTime     @default(now())
  updatedAt              DateTime     @updatedAt

  @@unique([codeId, refereeTenantId])
  @@index([referrerTenantId])
  @@index([refereeTenantId])
  @@index([codeId])
}

model MarketplaceListing {
  id              Int           @id @default(autoincrement())

  // Owner
  tenantId        Int?
  tenant          Tenant?       @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  serviceProviderId Int?
  serviceProvider   ServiceProviderProfile? @relation(fields: [serviceProviderId], references: [id], onDelete: Cascade)

  // Listing details
  listingType     ListingType
  category        AnimalCategory?
  title           String
  description     String?          @db.Text

  // Contact
  contactName     String?
  contactEmail    String?
  contactPhone    String?

  // Location
  city            String?
  state           String?
  country         String         @default("US") @db.VarChar(2)

  // Media
  images          Json?
  videoUrl        String?

  // Pricing
  priceCents      Int?
  priceType       String?        // "fixed", "starting_at", "contact"

  // Monetization
  tier            ListingTier    @default(FREE)
  monthlyFeeCents Int?
  commissionRate  Float?

  // Status
  status          ListingStatus  @default(DRAFT)
  publishedAt     DateTime?
  expiresAt       DateTime?

  // SEO
  slug            String?        @unique

  // Analytics
  viewCount       Int            @default(0)
  inquiryCount    Int            @default(0)

  // Metadata
  metadata        Json?

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([tenantId])
  @@index([serviceProviderId])
  @@index([status, publishedAt])
  @@index([listingType, category])
  @@index([tier])
}

model ServiceProviderProfile {
  id          Int      @id @default(autoincrement())

  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Business details
  businessName String
  email        String
  phone        String?
  website      String?

  // Location
  city         String?
  state        String?
  country      String   @default("US") @db.VarChar(2)

  // Subscription
  plan         ListingTier @default(FREE)

  // Stripe references
  stripeCustomerId     String? @unique
  stripeSubscriptionId String? @unique

  // Relations
  listings     MarketplaceListing[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([userId])
  @@index([plan])
}

model SystemConfig {
  key         String     @id
  value       String
  type        String     // "number", "boolean", "string", "json"
  description String?    @db.Text
  updatedBy   String?
  updatedAt   DateTime   @updatedAt

  @@index([key])
}
```

## Migration Command

After making all the changes above, run:

```bash
npm run db:dev:migrate
```

When prompted, name the migration: `add_subscription_billing_system`

This will create: `20260107XXXXXX_add_subscription_billing_system`
