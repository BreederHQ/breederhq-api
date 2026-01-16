# API Security Audit - Public vs Protected Endpoints

## Overview

This document defines which API endpoints should be **public** (anonymous access) vs **protected** (authentication required) for the marketplace hybrid model.

---

## 🔐 Security Principles

### Public Endpoints (No Auth Required)
- ✅ Browse/discovery data only
- ✅ Published content only (never drafts)
- ✅ No PII (personally identifiable information)
- ✅ No contact details (email, phone, street address)
- ✅ No financial data (pricing can be public if you choose)
- ✅ No user-specific data (saved items, inquiries, waitlist)

### Protected Endpoints (Auth Required)
- 🔒 Any write operations (POST, PUT, PATCH, DELETE)
- 🔒 User-specific data (saved listings, inquiries, messages)
- 🔒 Contact information requests
- 🔒 Waitlist/inquiry submissions
- 🔒 Draft content
- 🔒 Analytics/metrics
- 🔒 Account settings

---

## ✅ PUBLIC Endpoints (Should Allow Anonymous Access)

### Browse/Discovery
```
GET  /api/v1/marketplace/breeders                    # List breeders
GET  /api/v1/marketplace/breeders/:tenantSlug        # Breeder profile
GET  /api/v1/marketplace/animals                     # List animals
GET  /api/v1/marketplace/animals/:slug               # Animal detail
GET  /api/v1/marketplace/services                    # List services
GET  /api/v1/marketplace/services/:slug              # Service detail
GET  /api/v1/marketplace/programs                    # List programs
GET  /api/v1/marketplace/programs/:slug              # Program detail
GET  /api/v1/marketplace/breeding-programs           # List breeding programs
GET  /api/v1/marketplace/breeding-programs/:slug     # Breeding program detail
```

### Assets (Public images/files)
```
GET  /api/assets/:assetId                            # Public asset fetch
```

### Data Rules for Public Endpoints:
- ✅ Only return **published** data (not drafts)
- ✅ Redact street addresses (city/state/ZIP OK)
- ✅ No email addresses
- ✅ No phone numbers (or require auth to reveal)
- ✅ Pricing optional (your choice - currently public)
- ✅ No userId or tenantId in responses
- ✅ Public location mode respected (hidden/city/state/full)

---

## 🔒 PROTECTED Endpoints (Require Authentication)

### User Account
```
GET    /api/v1/marketplace/profile                   # My profile
PUT    /api/v1/marketplace/profile                   # Update profile
GET    /api/v1/marketplace/account                   # Account settings
PUT    /api/v1/marketplace/account                   # Update account
DELETE /api/v1/marketplace/account                   # Delete account
```

### Saved Listings
```
GET    /api/v1/marketplace/saved                     # My saved listings
POST   /api/v1/marketplace/saved                     # Save a listing
DELETE /api/v1/marketplace/saved/:id                 # Unsave listing
```

### Inquiries/Messages
```
GET    /api/v1/marketplace/inquiries                 # My inquiries
POST   /api/v1/marketplace/inquiries                 # Send inquiry (contact breeder)
GET    /api/v1/marketplace/inquiries/:id             # View inquiry thread
POST   /api/v1/marketplace/inquiries/:id/messages    # Reply to inquiry
```

### Waitlist
```
GET    /api/v1/marketplace/waitlist                  # My waitlist positions
POST   /api/v1/marketplace/waitlist                  # Join waitlist
DELETE /api/v1/marketplace/waitlist/:id              # Leave waitlist
```

### Notifications
```
GET    /api/v1/marketplace/notifications             # My notifications
PUT    /api/v1/marketplace/notifications/:id         # Mark read
```

### Contact Reveal (if you want to hide contact info)
```
POST   /api/v1/marketplace/breeders/:slug/reveal     # Reveal contact info (auth required)
```

### Breeder Management (Seller-only)
```
GET    /api/v1/marketplace/manage/animals            # My animals
POST   /api/v1/marketplace/manage/animals            # Create animal
PUT    /api/v1/marketplace/manage/animals/:id        # Update animal
DELETE /api/v1/marketplace/manage/animals/:id        # Delete animal
... (all manage/* routes require auth + seller status)
```

---

## 🛡️ Implementation Checklist

### Step 1: Review Current Auth Middleware

Check your route registration:

```typescript
// ❌ BAD - Protected endpoint without auth
app.get('/api/v1/marketplace/saved', getSavedListings);

// ✅ GOOD - Protected endpoint with auth
app.get('/api/v1/marketplace/saved', { preHandler: requireAuth }, getSavedListings);
```

### Step 2: Audit Each Route File

Go through each file in `/src/routes/` and verify:

1. **Public routes** (no auth middleware):
   - `marketplace-breeders.ts` - ✅ Already marked as public
   - `public-marketplace.ts` - ⚠️ CHECK: Name says "public" but code requires entitlement!
   - `breeding-programs.ts` - ❓ Check if public or protected
   - `breeder-marketplace.ts` - ❓ Check scope

2. **Protected routes** (should have auth):
   - `marketplace-saved.ts` - Should require auth
   - `marketplace-messages.ts` - Should require auth
   - `marketplace-waitlist.ts` - Should require auth
   - `marketplace-notifications.ts` - Should require auth
   - `marketplace-profile.ts` - Should require auth
   - `marketplace-transactions.ts` - Should require auth

### Step 3: Data Sanitization Rules

For **public** endpoints, always filter responses:

```typescript
// ❌ BAD - Exposing sensitive data
return {
  id: breeder.id,
  tenantId: breeder.tenantId,
  email: breeder.email,           // ❌ PII
  phone: breeder.phone,           // ❌ PII
  streetAddress: breeder.address, // ❌ PII
  businessName: breeder.name,
};

// ✅ GOOD - Safe public data
return {
  tenantSlug: breeder.slug,       // ✅ Public identifier
  businessName: breeder.name,     // ✅ Public
  city: breeder.city,             // ✅ OK if publicLocationMode allows
  state: breeder.state,           // ✅ OK if publicLocationMode allows
  // email, phone, address NOT included
};
```

### Step 4: Test Authentication

**Public endpoints test:**
```bash
# Should work without auth
curl https://marketplace.breederhq.com/api/v1/marketplace/breeders

# Should work without cookies
curl -H "Cookie:" https://marketplace.breederhq.com/api/v1/marketplace/breeders
```

**Protected endpoints test:**
```bash
# Should return 401 Unauthorized
curl https://marketplace.breederhq.com/api/v1/marketplace/saved

# Should work with valid session cookie
curl -H "Cookie: bhq_s=..." https://marketplace.breederhq.com/api/v1/marketplace/saved
```

---

## 🚨 CRITICAL: Fix Required

### Issue 1: `public-marketplace.ts` Requires Auth

**File:** `C:\Users\Aaron\Documents\Projects\breederhq-api\src\routes\public-marketplace.ts`

**Problem:** Despite name saying "public", line 5 says:
```typescript
// SECURITY: All data endpoints in this file require:
//   1. Valid session cookie (bhq_s) - enforced by middleware
//   2. Marketplace entitlement - enforced by requireMarketplaceEntitlement()
```

**This means these endpoints require login:**
- Programs
- Offspring groups
- Animal listings

**Decision needed:** Should these be public or protected?

**Recommendation:** These should be **PUBLIC** for SEO. You need to:
1. Rename file to `marketplace-browse.ts` (more accurate)
2. Remove `requireMarketplaceEntitlement()` calls
3. Ensure data sanitization (no PII returned)

OR

Create a separate `public-marketplace-browse.ts` with anonymous access.

### Issue 2: Check `marketplace-saved.ts`

Verify this file has auth middleware:

```typescript
// Should look like this:
export const marketplaceSavedRoutes: FastifyPluginAsync = async (app) => {
  // Auth required for all routes in this file
  app.addHook('preHandler', requireAuth);

  app.get('/saved', getSavedListings);
  app.post('/saved', saveListing);
  app.delete('/saved/:id', unsaveListing);
};
```

### Issue 3: Check Contact Reveal

If you want to hide breeder contact info from anonymous users:

```typescript
// Public breeder profile - NO contact info
GET /api/v1/marketplace/breeders/:slug
// Returns: { businessName, city, state, breeds, ... }
// Does NOT return: { email, phone, streetAddress }

// Protected contact reveal - Requires auth
POST /api/v1/marketplace/breeders/:slug/contact
// Returns: { email, phone, preferredContactMethod }
// Or triggers an inquiry creation
```

---

## 📋 Audit Script

Create this script to audit your routes:

```typescript
// scripts/audit-api-routes.ts
import fs from 'fs';
import path from 'path';

const routesDir = './src/routes';
const files = fs.readdirSync(routesDir);

const publicRoutes = [];
const protectedRoutes = [];
const unclearRoutes = [];

files.forEach(file => {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf-8');

  const hasAuthMiddleware = content.includes('requireAuth') ||
                           content.includes('preHandler') ||
                           content.includes('requireMarketplaceEntitlement');

  const hasPublicComment = content.includes('no auth required') ||
                          content.includes('public endpoint');

  if (hasPublicComment && !hasAuthMiddleware) {
    publicRoutes.push(file);
  } else if (hasAuthMiddleware) {
    protectedRoutes.push(file);
  } else {
    unclearRoutes.push(file);
  }
});

console.log('PUBLIC ROUTES (no auth):');
publicRoutes.forEach(f => console.log(`  ✅ ${f}`));

console.log('\nPROTECTED ROUTES (auth required):');
protectedRoutes.forEach(f => console.log(`  🔒 ${f}`));

console.log('\nUNCLEAR ROUTES (needs review):');
unclearRoutes.forEach(f => console.log(`  ⚠️  ${f}`));
```

---

## ✅ Recommended Actions

1. **Immediate:**
   - Run the audit script above
   - Review `public-marketplace.ts` - decide if truly public or rename
   - Verify all `marketplace-*` protected routes have auth

2. **This Week:**
   - Add integration tests for auth enforcement
   - Document auth requirements in OpenAPI/Swagger
   - Add rate limiting to public endpoints (prevent abuse)

3. **Before Launch:**
   - Penetration test all endpoints
   - Verify no PII leaks in public responses
   - Add logging for auth failures (detect attacks)

---

## 🔍 Quick Reference

**Need Help Deciding?** Ask:
- Can anonymous users see this? → Public
- Does it modify data? → Protected
- Contains user-specific data? → Protected
- Contains PII/contact info? → Protected
- Just browsing published content? → Public

**Default Rule:** When in doubt, make it **protected**. You can always open it up later.

---

## 📞 Questions to Answer

1. **Pricing:** Should prices be visible to anonymous users?
   - Current: Public ✅
   - Recommendation: Keep public for transparency

2. **Contact Info:** Should breeder email/phone be visible to anonymous users?
   - Current: ❓ (check implementation)
   - Recommendation: Require auth to reveal

3. **Waitlist/Inquiry:** Should anonymous users see availability?
   - Current: ❓
   - Recommendation: Public view, protected to join

4. **Reviews:** Should reviews be visible to anonymous users?
   - Current: ❓
   - Recommendation: Public (builds trust)

---

**Next Step:** Run the audit script and review `public-marketplace.ts` to determine if it should actually be public.
