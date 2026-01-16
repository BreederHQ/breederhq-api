# Marketplace Integration Strategy - PRODUCTION SOLUTION

**Decision:** Option 1 - Unified User System
**Date:** 2026-01-12
**Status:** ✅ APPROVED FOR IMPLEMENTATION

---

## Architecture Decision

### Use Existing Infrastructure
- ✅ **User Management:** `public.User` table (proven, secure, with auth)
- ✅ **Invoicing:** `public.Invoice` table (integrated with Stripe, accounting)
- ✅ **Messaging:** `public.MessageThread` + `public.Message` (cross-tenant proven)
- ✅ **Payments:** Existing Stripe integration (Connect for providers)

### Use New Schema For
- ✅ **Transaction Tracking:** `marketplace.transactions` (analytics, reporting)
- ✅ **Service Providers:** `marketplace.providers` (non-breeder services)
- ✅ **Service Listings:** `marketplace.service_listings` (grooming, training, etc.)

### Deprecate
- ❌ **marketplace.users** - Redundant with `public.User`
- ❌ **marketplace.invoices** - Redundant with `public.Invoice`
- ❌ **marketplace.message_threads** - Redundant with `public.MessageThread`
- ❌ **marketplace.messages** - Redundant with `public.Message`

---

## Schema Changes Required

### Phase 3A: Add Integration Links

```prisma
model MarketplaceProvider {
  id Int @id @default(autoincrement())

  // LINK TO EXISTING USER SYSTEM
  userId String @unique // Reference to public.User.id
  user User @relation(fields: [userId], references: [id])

  // LINK TO BREEDER TENANT (if provider is also a breeder)
  tenantId Int?
  tenant Tenant? @relation(fields: [tenantId], references: [id])

  providerType String // "breeder" | "service_provider" | "both"
  businessName String
  businessDescription String?
  city String?
  state String?

  // Stripe Connect for payouts
  stripeConnectAccountId String? @unique
  stripeConnectOnboardingComplete Boolean @default(false)
  stripeConnectPayoutsEnabled Boolean @default(false)

  paymentMode String @default("manual") // "manual" | "stripe" | "stripe_connect"
  paymentInstructions String?

  // Stats
  totalListings Int @default(0)
  totalTransactions Int @default(0)
  totalRevenueCents BigInt @default(0)
  averageRating Decimal @default(0.00) @db.Decimal(3,2)

  status String @default("active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  listings MarketplaceServiceListing[]
  transactions MarketplaceTransaction[]

  @@index([userId])
  @@index([tenantId])
  @@index([stripeConnectAccountId])
  @@map("providers")
  @@schema("marketplace")
}

model MarketplaceTransaction {
  id BigInt @id @default(autoincrement())

  // LINK TO EXISTING USER (buyer)
  clientUserId String
  clientUser User @relation(fields: [clientUserId], references: [id])

  // LINK TO PROVIDER
  providerId Int
  provider MarketplaceProvider @relation(fields: [providerId], references: [id])

  // OPTIONAL: Service listing (if this is a service transaction)
  listingId Int?
  listing MarketplaceServiceListing? @relation(fields: [listingId], references: [id])

  // LINK TO EXISTING INVOICE SYSTEM
  invoiceType String // "breeder" | "service" | "deposit"
  tenantId Int? // For breeder invoices
  invoiceId Int // Reference to public.Invoice.id
  invoice Invoice @relation(fields: [invoiceId], references: [id])

  serviceDescription String
  totalCents BigInt
  platformFeeCents BigInt @default(0)
  providerPayoutCents BigInt?

  status String @default("pending_invoice")
  // "pending_invoice" → "invoiced" → "paid" → "completed"

  createdAt DateTime @default(now())
  invoicedAt DateTime?
  paidAt DateTime?
  completedAt DateTime?

  @@index([clientUserId, status, createdAt(sort: Desc)])
  @@index([providerId, status, createdAt(sort: Desc)])
  @@index([tenantId, invoiceId]) // Lookup by invoice
  @@index([listingId])
  @@map("transactions")
  @@schema("marketplace")
}

// SERVICE LISTINGS - Keep as-is (no changes needed)
model MarketplaceServiceListing {
  // ... existing fields ...
  @@schema("marketplace")
}
```

### Phase 3B: Remove Redundant Tables

After integration is complete and tested:
- Drop `marketplace.users` (use `public.User`)
- Drop `marketplace.invoices` (use `public.Invoice`)
- Drop `marketplace.message_threads` (use `public.MessageThread`)
- Drop `marketplace.messages` (use `public.Message`)

---

## API Integration Points

### 1. User Registration/Login
**Use existing:** `/api/v1/auth/register`, `/api/v1/auth/login`

No changes needed - users can already register and get MARKETPLACE_ACCESS entitlement.

### 2. Service Provider Registration
**New endpoint:** `POST /api/v1/marketplace/providers/register`

```typescript
// Creates MarketplaceProvider linked to current User
{
  userId: req.userId, // From session
  providerType: "service_provider",
  businessName: "...",
  city: "...",
  paymentMode: "manual"
}
```

### 3. Service Listing Creation
**New endpoint:** `POST /api/v1/marketplace/providers/me/listings`

```typescript
// Requires user to be a provider
const provider = await prisma.marketplaceProvider.findUnique({
  where: { userId: req.userId }
});

await prisma.marketplaceServiceListing.create({
  data: {
    providerId: provider.id,
    title: "...",
    category: "grooming",
    priceCents: 5000,
    status: "draft"
  }
});
```

### 4. Transaction Creation
**When invoice is created:**

```typescript
// In existing invoice creation flow, also create transaction record
const invoice = await prisma.invoice.create({
  data: {
    tenantId,
    invoiceNumber: "...",
    amountCents: 10000,
    isMarketplaceInvoice: true,
    // ... other fields
  }
});

// CREATE MARKETPLACE TRANSACTION
await prisma.marketplaceTransaction.create({
  data: {
    clientUserId: req.userId,
    providerId: provider.id,
    invoiceType: "service",
    invoiceId: invoice.id,
    serviceDescription: "Dog grooming",
    totalCents: 10000,
    platformFeeCents: 500, // 5% platform fee
    providerPayoutCents: 9500,
    status: "invoiced"
  }
});
```

### 5. Messaging
**Use existing:** `/api/v1/messages/threads`

Already supports marketplace users messaging breeders. For service providers:
- Service providers already have `public.User` accounts
- Can use existing MessageThread system
- Just need to link threads to service listings

---

## Implementation Sequence

### ✅ Phase 1: Complete (Database Foundation)
- BigInt for currency
- Soft deletes
- Indexes
- Marketplace fields on existing tables

### ✅ Phase 2: Complete (Marketplace Schema)
- Created marketplace.* tables
- All relationships defined
- Migration deployed

### 🔄 Phase 3: Integration (IN PROGRESS)
**Step 1: Schema Updates**
- ✅ Analysis complete
- ⏳ Update MarketplaceProvider to link to public.User
- ⏳ Update MarketplaceTransaction to link to public.Invoice
- ⏳ Run migration

**Step 2: API Development**
- Provider registration endpoint
- Service listing CRUD
- Transaction tracking middleware
- Provider dashboard

**Step 3: Testing**
- Create test service provider
- Create test service listing
- Complete full transaction flow
- Verify all data linkages

**Step 4: Cleanup**
- Deprecate unused tables
- Update documentation
- Deploy to production

---

## Benefits of This Approach

1. **Zero Breaking Changes** - Existing marketplace.breederhq.com keeps working
2. **Proven Infrastructure** - Leverages battle-tested auth, invoicing, Stripe
3. **Incremental Rollout** - Add features one at a time
4. **Single Source of Truth** - One User table, one Invoice table, one auth system
5. **Simpler Maintenance** - Less code duplication, easier debugging
6. **Better UX** - Users don't need separate accounts for buying vs providing services

---

## Migration Path

### For Existing Users
- No action required
- Marketplace access via existing User account
- Can become service providers by registering

### For New Features
- Service providers register via new endpoint
- Creates MarketplaceProvider linked to User
- Uses existing invoice/payment flow
- Transactions tracked for analytics

### Data Integrity
- All foreign keys enforced
- No orphaned records
- Soft deletes preserved
- Audit trail maintained

---

## Next Action Items

1. **Create migration:** Add userId to MarketplaceProvider, clientUserId to MarketplaceTransaction
2. **Build provider API:** Registration, profile, listings
3. **Add transaction middleware:** Auto-create transactions when invoices are paid
4. **Build provider dashboard:** Show listings, transactions, revenue
5. **Test end-to-end:** Complete service purchase flow

---

## Success Metrics

- ✅ Existing marketplace functionality unchanged
- ✅ Service providers can register and create listings
- ✅ Users can book services and pay via existing invoice system
- ✅ All transactions tracked in marketplace.transactions
- ✅ Provider analytics available (revenue, ratings)
- ✅ Single login for all user types
- ✅ Zero data migration required

---

**Status:** Ready for implementation
**Risk Level:** LOW (non-breaking changes)
**Timeline:** 2-3 days for core functionality
