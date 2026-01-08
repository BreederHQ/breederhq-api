# BreederHQ Subscription & Entitlement System

## Overview

The subscription system manages billing, quotas, and feature access across the platform. It integrates with Stripe for payments while maintaining your database as the source of truth for entitlements and usage.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Stripe    │────▶│  Webhooks    │────▶│  Database   │
│  (Payment)  │     │  (Sync Data) │     │  (Truth)    │
└─────────────┘     └──────────────┘     └─────────────┘
                                               │
                                               ▼
                            ┌──────────────────────────────┐
                            │  Entitlement Service         │
                            │  (Check Feature Access)      │
                            └──────────────────────────────┘
                                               │
                                               ▼
                            ┌──────────────────────────────┐
                            │  Usage Service               │
                            │  (Track & Enforce Quotas)    │
                            └──────────────────────────────┘
```

## Core Concepts

### 1. Products
**Location**: `prisma.product`

Products represent subscription plans or add-ons that customers can purchase.

**Fields**:
- `name` - Plan name (e.g., "Professional", "Enterprise")
- `type` - `SUBSCRIPTION` or `ADDON`
- `priceUSD` - Price in cents
- `billingInterval` - `MONTHLY` or `YEARLY`
- `features` - JSON array of feature descriptions
- `entitlements` - Related ProductEntitlement records
- `stripePriceId` - Stripe Price ID for checkout
- `active` - Whether plan is available for purchase

**Example**:
```typescript
{
  id: 1,
  name: "Professional",
  type: "SUBSCRIPTION",
  priceUSD: 9900, // $99.00
  billingInterval: "MONTHLY",
  features: [
    "Unlimited animals",
    "Advanced breeding tools",
    "Priority support"
  ],
  entitlements: [...]
}
```

### 2. Product Entitlements
**Location**: `prisma.productEntitlement`

Entitlements define what a product grants access to. Each product has multiple entitlements.

**Fields**:
- `productId` - Which product grants this
- `entitlementKey` - Type of entitlement (see EntitlementKey enum)
- `limitValue` - Quota limit (`null` = unlimited)

**Entitlement Types**:
- `ANIMAL_QUOTA` - Max number of animals
- `CONTACT_QUOTA` - Max number of contacts
- `BREEDING_PLAN_QUOTA` - Max breeding plans
- `MARKETPLACE_LISTING_QUOTA` - Max marketplace listings
- `PORTAL_USER_QUOTA` - Max portal users
- `STORAGE_QUOTA_GB` - Storage limit in GB
- `SMS_QUOTA` - SMS messages per month
- `MARKETPLACE_ACCESS` - Can list on marketplace
- `ADVANCED_GENETICS` - Advanced genetics features
- `PRIORITY_SUPPORT` - Priority support access

**Example**:
```typescript
// Professional plan entitlements
[
  { entitlementKey: "ANIMAL_QUOTA", limitValue: null }, // Unlimited
  { entitlementKey: "CONTACT_QUOTA", limitValue: 1000 },
  { entitlementKey: "MARKETPLACE_ACCESS", limitValue: 1 }, // Boolean (1 = yes)
  { entitlementKey: "STORAGE_QUOTA_GB", limitValue: 100 }
]
```

### 3. Subscriptions
**Location**: `prisma.subscription`

Subscriptions link tenants to products and track billing status.

**Fields**:
- `tenantId` - Who this subscription is for
- `productId` - Base plan
- `status` - `TRIAL`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `INCOMPLETE`
- `stripeSubscriptionId` - Stripe reference
- `currentPeriodStart` / `currentPeriodEnd` - Billing cycle
- `canceledAt` - Cancellation timestamp
- `addOns` - Related SubscriptionAddOn records

### 4. Usage Tracking
**Location**: `prisma.usageSnapshot` & `prisma.usageRecord`

- **UsageSnapshot**: Fast-read current usage values per tenant
- **UsageRecord**: Historical time-series data

**Metrics Tracked**:
- `ANIMAL_COUNT` - Current number of animals
- `CONTACT_COUNT` - Current number of contacts
- `BREEDING_PLAN_COUNT` - Active breeding plans
- `MARKETPLACE_LISTING_COUNT` - Active listings
- `PORTAL_USER_COUNT` - Active portal users
- `STORAGE_BYTES` - Storage used
- `SMS_SENT` - SMS messages sent (rolling window)

## How It Works

### User Subscribes (Happy Path)

1. **User clicks "Choose Plan" on pricing page**
   - Frontend calls `POST /api/v1/billing/checkout`
   - API creates Stripe Checkout Session
   - User redirected to Stripe

2. **User completes payment on Stripe**
   - Stripe creates subscription
   - Stripe sends `checkout.session.completed` webhook

3. **Webhook syncs to database**
   - `syncSubscriptionFromStripe()` called
   - Creates/updates `Subscription` record
   - Links to `Product` with entitlements

4. **User can now access features**
   - `checkEntitlement(tenantId, "ANIMAL_QUOTA")` → returns limit
   - `checkQuota(tenantId, "ANIMAL_COUNT")` → enforces limit

### Quota Enforcement

When a user tries to create an animal:

```typescript
// 1. Check if they can add more
const quotaCheck = await checkQuota(tenantId, "ANIMAL_COUNT");

if (!quotaCheck.canAdd) {
  throw new Error(`Animal quota exceeded (${quotaCheck.current}/${quotaCheck.limit})`);
}

// 2. Create the animal
const animal = await prisma.animal.create({...});

// 3. Update usage snapshot
await updateUsageSnapshot(tenantId, "ANIMAL_COUNT");
// This automatically sends email alerts at 80%, 95%, 100%
```

### Email Notifications

**Automatic Emails** (sent by `usage-service.ts`):
- **80% quota** → Warning email (orange)
- **95% quota** → Critical email (red)
- **100% quota** → Exceeded email (red)

**Billing Emails** (sent by Stripe webhooks):
- **Payment failed** → Update payment method
- **Subscription canceled** → Confirmation
- **Subscription renewed** → Receipt

## API Endpoints

### User-Facing (Tenant Context)

**Billing**:
- `GET /api/v1/billing/plans` - List available plans
- `GET /api/v1/billing/subscription` - Current subscription
- `POST /api/v1/billing/checkout` - Start checkout
- `POST /api/v1/billing/portal` - Manage subscription (Stripe portal)
- `POST /api/v1/billing/add-ons` - Add add-ons
- `POST /api/v1/billing/cancel` - Cancel subscription

**Usage**:
- `GET /api/v1/usage` - All usage metrics
- `GET /api/v1/usage/:metricKey` - Specific metric details

### Admin-Only

**Subscriptions**:
- `GET /api/v1/admin/subscriptions` - List all subscriptions
- `GET /api/v1/admin/subscriptions/:id` - Subscription details
- `POST /api/v1/admin/subscriptions` - Manually create subscription
- `PATCH /api/v1/admin/subscriptions/:id` - Update subscription
- `DELETE /api/v1/admin/subscriptions/:id` - Cancel subscription

**Products**:
- `GET /api/v1/admin/products` - List all products
- `GET /api/v1/admin/products/:id` - Product details
- `POST /api/v1/admin/products` - Create product
- `PATCH /api/v1/admin/products/:id` - Update product
- `DELETE /api/v1/admin/products/:id` - Deactivate product

**Entitlements**:
- `GET /api/v1/admin/products/:id/entitlements` - List entitlements
- `POST /api/v1/admin/products/:id/entitlements` - Add entitlement
- `PATCH /api/v1/admin/products/:id/entitlements/:key` - Update limit
- `DELETE /api/v1/admin/products/:id/entitlements/:key` - Remove entitlement

## Service Layer

### Entitlement Service
**File**: `src/services/subscription/entitlement-service.ts`

**Key Functions**:
```typescript
// Check if tenant has access to a feature
checkEntitlement(tenantId, "MARKETPLACE_ACCESS");
// → { hasAccess: true, limitValue: 1 }

// Get all entitlements for a tenant
getTenantEntitlements(tenantId);
// → Map<EntitlementKey, number | null>

// Get quota limit for specific resource
getQuotaLimit(tenantId, "ANIMAL_QUOTA");
// → number | null
```

### Usage Service
**File**: `src/services/subscription/usage-service.ts`

**Key Functions**:
```typescript
// Get current usage for a metric
getCurrentUsage(tenantId, "ANIMAL_COUNT");
// → number

// Check if can add more (enforces quota)
checkQuota(tenantId, "ANIMAL_COUNT");
// → { canAdd: boolean, current: number, limit: number | null, ... }

// Update usage snapshot (triggers email alerts)
updateUsageSnapshot(tenantId, "ANIMAL_COUNT");

// Get all usage statuses
getAllUsageStatuses(tenantId);
// → UsageStatus[]
```

## Common Admin Tasks

### Create a New Plan

```bash
curl -X POST http://localhost:6001/api/v1/admin/products \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 1" \
  -d '{
    "name": "Starter",
    "description": "Perfect for small breeders",
    "type": "SUBSCRIPTION",
    "priceUSD": 2900,
    "billingInterval": "MONTHLY",
    "features": ["Up to 50 animals", "Basic support"],
    "sortOrder": 1
  }'
```

### Add Entitlements to Plan

```bash
# Add animal quota
curl -X POST http://localhost:6001/api/v1/admin/products/1/entitlements \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 1" \
  -d '{
    "entitlementKey": "ANIMAL_QUOTA",
    "limitValue": 50
  }'

# Add unlimited contacts
curl -X POST http://localhost:6001/api/v1/admin/products/1/entitlements \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 1" \
  -d '{
    "entitlementKey": "CONTACT_QUOTA",
    "limitValue": null
  }'
```

### Give Tenant Free Subscription (Comp)

```bash
curl -X POST http://localhost:6001/api/v1/admin/subscriptions \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 1" \
  -d '{
    "tenantId": 5,
    "productId": 2,
    "status": "ACTIVE",
    "currentPeriodEnd": "2025-12-31T23:59:59Z"
  }'
```

### Override Quota for Specific Tenant

You can create a custom product just for that tenant or use add-ons:

```bash
# Create custom product
curl -X POST http://localhost:6001/api/v1/admin/products \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 1" \
  -d '{
    "name": "Enterprise Custom - Acme Kennels",
    "type": "SUBSCRIPTION",
    "priceUSD": 0,
    "features": ["Custom enterprise plan"]
  }'

# Then assign to tenant with custom entitlements
```

## Seeding Products

**Script**: `prisma/seed/seed-subscription-products.ts`

Run with:
```bash
npm run db:dev:seed:products
```

This creates starter plans with entitlements. Edit this file to customize your plan structure.

## Stripe Integration

### Webhooks
**Endpoint**: `POST /api/v1/billing/webhooks/stripe` (public, no auth)

**Events Handled**:
- `checkout.session.completed` - User subscribed
- `customer.subscription.created` - Subscription created
- `customer.subscription.updated` - Plan changed
- `customer.subscription.deleted` - Subscription ended
- `invoice.payment_succeeded` - Payment collected
- `invoice.payment_failed` - Payment failed

**Stripe Setup**:
1. Dashboard → Webhooks → Add endpoint
2. URL: `https://api.breederhq.com/api/v1/billing/webhooks/stripe`
3. Select events (all above)
4. Copy webhook secret to `.env.prod`: `STRIPE_WEBHOOK_SECRET=whsec_...`

### Stripe Customer Portal

Users can manage their subscription via Stripe's hosted portal:
- Update payment method
- Cancel subscription
- View invoices
- Change plan

Access via `POST /api/v1/billing/portal` → redirects to Stripe

## Testing

### Test Quota Enforcement
```bash
npm run test:quota
```

### Test Usage API
```bash
npm run test:usage
```

### Test Stripe Integration
Use Stripe test mode with test cards:
- `4242 4242 4242 4242` - Succeeds
- `4000 0000 0000 0341` - Fails (declined)

## Troubleshooting

### "No active subscription" error
- Check `prisma.subscription` for tenant
- Verify status is `ACTIVE`, `TRIAL`, or `PAST_DUE`
- Check `currentPeriodEnd` hasn't expired

### Quota not enforcing
- Check `ProductEntitlement` records exist for product
- Verify `entitlementKey` matches metric being checked
- Check `UsageSnapshot` is updating correctly

### Webhook not firing
- Verify `STRIPE_WEBHOOK_SECRET` is set
- Check Stripe Dashboard → Webhooks for delivery status
- Look for errors in webhook logs

### Email notifications not sending
- Check `RESEND_API_KEY` is configured
- Verify tenant has email in organizations → party
- Check email service logs for errors

## Frontend Components

### User-Facing
- `<UsageMetrics />` - Quota dashboard with progress bars
- `<PricingPage />` - Plan selection and comparison
- `<BillingTab />` - Subscription management in settings
- `<QuotaWarningBanner />` - Banner when approaching limits

### Admin (TODO)
- Products management UI
- Subscription management UI
- Usage analytics dashboard

## Database Schema Reference

See `prisma/schema.prisma` for full schema:
- `model Product`
- `model ProductEntitlement`
- `model Subscription`
- `model SubscriptionAddOn`
- `model UsageSnapshot`
- `model UsageRecord`
- `enum EntitlementKey`
- `enum ProductType`
- `enum SubscriptionStatus`
