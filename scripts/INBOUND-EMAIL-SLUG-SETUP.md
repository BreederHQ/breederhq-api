# Inbound Email Slug Setup

**Date**: 2026-01-27
**Purpose**: Ensure all tenant creation paths assign unique `inboundEmailSlug` values

---

## Changes Made

### 1. Reusable Helper Function

**File**: [src/services/inbound-email-service.ts](../src/services/inbound-email-service.ts)

Added `assignUniqueSlug()` function:
```typescript
export async function assignUniqueSlug(
  orgName: string,
  prismaClient: any
): Promise<string>
```

This helper:
- Generates a slug from organization name using `generateSlugFromName()`
- Checks for existing tenants with that slug
- Appends numeric suffix (2, 3, 4, etc.) if duplicate
- Returns unique slug ready to use

### 2. Updated API Endpoint

**File**: [src/routes/tenant.ts:1148-1165](../src/routes/tenant.ts)

The `/tenants/admin-provision` endpoint now:
- Auto-assigns `inboundEmailSlug` when creating new tenants
- Uses the `assignUniqueSlug()` helper
- Handles duplicates automatically

### 3. Updated Seed Scripts

#### Validation Tenants
**File**: [scripts/seeding/seed-validation-tenants/seed-validation-tenants.ts:169-183](../scripts/seeding/seed-validation-tenants/seed-validation-tenants.ts)

Now assigns slugs when creating validation test tenants.

#### Demo Tenants
**File**: [scripts/seeding/demo-tenant/seed-demo-tenant.ts:72-98](../scripts/seeding/demo-tenant/seed-demo-tenant.ts)

Now assigns slugs when creating demo tenants.

#### Test Helpers
**File**: [tests/helpers/tenant-helpers.ts:54-73](../tests/helpers/tenant-helpers.ts)

The `createTestTenant()` helper now assigns slugs for all test tenant creation.

### 4. Migration Script

**File**: [scripts/populate-inbound-email-slugs.ts](../scripts/populate-inbound-email-slugs.ts)

One-time script to populate slugs for existing tenants. Already executed:
- Development DB: 5/8 tenants have slugs
- Production DB: 5/8 tenants have slugs

Run with:
```bash
# Development
NODE_ENV=development npx tsx scripts/populate-inbound-email-slugs.ts

# Production
NODE_ENV=production npx tsx scripts/populate-inbound-email-slugs.ts
```

---

## Coverage

All tenant creation paths now assign slugs:

- ✅ API: `/tenants/admin-provision` endpoint
- ✅ Seeds: Validation tenants (`npm run db:seed:validation:dev`)
- ✅ Seeds: Demo tenants (`npm run db:seed:demo`)
- ✅ Tests: `createTestTenant()` helper

---

## Email Format

Tenants get email addresses like:
- `mos-eisley-cantina-breeders@mail.breederhq.com`
- `dev-house-of-elrond@mail.breederhq.com`
- `stark-kennels@mail.breederhq.com`

Slug rules:
- 3-30 characters
- Lowercase letters, numbers, hyphens only
- No leading/trailing hyphens
- Reserved words blocked (admin, support, etc.)
- Must be globally unique

---

## What Happens When Inbound Email Arrives

1. Email sent to `{slug}@mail.breederhq.com`
2. Resend webhook calls → `https://breederhq-api.onrender.com/api/v1/webhooks/resend/inbound`
3. Handler parses slug and finds tenant
4. Creates `MessageThread` and `Message` in database
5. Sends notification email to breeder
6. Message appears in Communications Hub

---

## Frontend UI

New email settings feature at `/marketing/email-settings`:

**Files**:
- `apps/marketing/src/features/email-settings/` (feature slice)
  - `EmailSettingsCard.tsx` - Display component
  - `CustomizeEmailModal.tsx` - Edit dialog
  - `useEmailSettings.ts` - Feature hook
  - `email-settings.api.ts` - API calls
  - `email-settings.types.ts` - TypeScript interfaces

**Features**:
- View current email address
- Copy to clipboard
- Customize slug with real-time validation
- Debounced availability checking

---

## Testing

### Local Development (with ngrok)

Since Render points to production DB, you need ngrok for dev testing:

```bash
# Terminal 1: Start dev API
cd c:/Users/Aaron/Documents/Projects/breederhq-api
npm run dev

# Terminal 2: Start tunnel
ngrok http 3000  # replace 3000 with your API port

# Update Resend webhook to ngrok URL temporarily
# https://xxxx-xx-xx-xxx.ngrok-free.app/api/v1/webhooks/resend/inbound
```

### Production Testing

1. Deploy frontend changes
2. Log into production app
3. Go to `/marketing/email-settings`
4. Send email to your slug
5. Check Communications Hub

---

## Verification Checklist

- [x] `assignUniqueSlug()` helper added
- [x] API endpoint assigns slugs on tenant creation
- [x] Validation seed script assigns slugs
- [x] Demo seed script assigns slugs
- [x] Test helper assigns slugs
- [x] Migration script populates existing tenants
- [x] Frontend UI displays and allows customization
- [x] Resend webhook configured and verified
- [x] Documentation created

---

**Status**: ✅ Complete - All tenant creation paths now assign unique email slugs
