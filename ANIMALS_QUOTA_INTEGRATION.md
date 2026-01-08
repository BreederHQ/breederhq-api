# ✅ Animals Route - Quota Enforcement Integration

## Summary

Successfully integrated quota enforcement into the animals API route to enforce the 50 animal limit for Pro tier subscribers.

---

## Changes Made

### File: `src/routes/animals.ts`

#### 1. Added Imports (Lines 7-8)
```typescript
import { checkQuota } from "../middleware/quota-enforcement.js";
import { updateUsageSnapshot } from "../services/subscription/usage-service.js";
```

#### 2. Updated POST /animals (Lines 483-621)
**Before:**
```typescript
app.post("/animals", async (req, reply) => {
  // ... handler code
});
```

**After:**
```typescript
app.post(
  "/animals",
  {
    preHandler: [checkQuota("ANIMAL_COUNT")], // ← Enforces quota BEFORE creation
  },
  async (req, reply) => {
    // ... create animal ...

    // Update usage snapshot after successful creation
    await updateUsageSnapshot(tenantId, "ANIMAL_COUNT"); // ← Update snapshot

    return reply.code(201).send(created);
  }
);
```

**What happens:**
1. User tries to create animal
2. `checkQuota("ANIMAL_COUNT")` middleware runs first
3. Checks current usage vs limit (e.g., 49/50)
4. If at limit → returns 403 with error message
5. If quota available → continues to handler
6. Animal created successfully
7. Usage snapshot updated (49 → 50)
8. Returns created animal

#### 3. Updated DELETE /animals/:id (Lines 857-871)
**Added:**
```typescript
// Update usage snapshot after deletion
await updateUsageSnapshot(tenantId, "ANIMAL_COUNT");
```

**What happens:**
1. Animal deleted from database
2. Usage snapshot updated (50 → 49)
3. Returns success response

---

## How It Works

### Quota Check Flow
```
POST /animals
    ↓
checkQuota middleware
    ↓
getCurrentUsage(tenantId, "ANIMAL_COUNT")  ← Fast read from UsageSnapshot
    ↓
getQuotaLimit(tenantId, "ANIMAL_QUOTA")    ← Reads subscription + add-ons
    ↓
Compare: currentUsage (50) + countToAdd (1) <= limit (50)?
    ↓
    ├─ NO → Return 403 QUOTA_EXCEEDED
    └─ YES → Continue to handler
           ↓
       Create animal in database
           ↓
       updateUsageSnapshot(tenantId, "ANIMAL_COUNT")
           ↓
       Return 201 with created animal
```

### Error Response (When Quota Exceeded)
```json
{
  "error": "QUOTA_EXCEEDED",
  "code": "QUOTA_EXCEEDED",
  "message": "You've reached your limit of 50 animals. Upgrade your plan to add more.",
  "details": {
    "currentUsage": 50,
    "limit": 50,
    "upgradeUrl": "/settings/billing/upgrade"
  }
}
```

---

## Testing Instructions

### Prerequisites
1. Make sure you've run the subscription seed:
   ```bash
   npm run db:dev:seed:products
   ```

2. Create a test subscription for your tenant:
   ```sql
   -- Give tenant 1 a Pro subscription (50 animal limit)
   INSERT INTO "Subscription" (
     "tenantId", "productId", "status", "amountCents",
     "currency", "billingInterval", "createdAt", "updatedAt"
   )
   SELECT
     1, -- Your test tenant ID
     id,
     'ACTIVE',
     3900,
     'USD',
     'MONTHLY',
     NOW(),
     NOW()
   FROM "Product"
   WHERE name = 'BreederHQ Pro (Monthly)'
   LIMIT 1;
   ```

### Test 1: Initial Usage Snapshot
```bash
# Run this in your API directory
npm run db:dev:repl
```

```javascript
// In the REPL:
const { updateUsageSnapshot } = await import('./src/services/subscription/usage-service.js');
await updateUsageSnapshot(1, 'ANIMAL_COUNT');

// Check current usage
const { getCurrentUsage } = await import('./src/services/subscription/usage-service.js');
const usage = await getCurrentUsage(1, 'ANIMAL_COUNT');
console.log(`Current animals: ${usage}`);

// Check quota limit
const { getQuotaLimit } = await import('./src/services/subscription/entitlement-service.js');
const limit = await getQuotaLimit(1, 'ANIMAL_QUOTA');
console.log(`Limit: ${limit}`);
```

**Expected Output:**
```
Current animals: [your current count]
Limit: 50
```

### Test 2: Create Animals Until Quota Reached
```bash
# Use your API client (Postman, curl, etc.)

# Create animal #49 (should succeed)
curl -X POST http://localhost:3000/api/v1/animals \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "name": "Test Dog 49",
    "species": "DOG",
    "sex": "MALE",
    "status": "ACTIVE"
  }'

# Create animal #50 (should succeed - at limit)
curl -X POST http://localhost:3000/api/v1/animals \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "name": "Test Dog 50",
    "species": "DOG",
    "sex": "MALE",
    "status": "ACTIVE"
  }'

# Create animal #51 (should FAIL with 403)
curl -X POST http://localhost:3000/api/v1/animals \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "name": "Test Dog 51",
    "species": "DOG",
    "sex": "MALE",
    "status": "ACTIVE"
  }'
```

**Expected Response for #51:**
```json
{
  "error": "QUOTA_EXCEEDED",
  "code": "QUOTA_EXCEEDED",
  "message": "You've reached your limit of 50 animals. Upgrade your plan to add more.",
  "details": {
    "currentUsage": 50,
    "limit": 50,
    "upgradeUrl": "/settings/billing/upgrade"
  }
}
```

### Test 3: Delete and Create Again
```bash
# Delete one animal
curl -X DELETE http://localhost:3000/api/v1/animals/123 \
  -H "Cookie: session=YOUR_SESSION_COOKIE"

# Now you should be able to create one more
curl -X POST http://localhost:3000/api/v1/animals \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "name": "Test Dog After Delete",
    "species": "DOG",
    "sex": "MALE",
    "status": "ACTIVE"
  }'
```

**Expected:** Should succeed (usage: 49 + 1 = 50)

### Test 4: Test with Add-On
```sql
-- Add "+10 Animals" add-on to subscription
INSERT INTO "SubscriptionAddOn" ("subscriptionId", "productId", "quantity", "createdAt", "updatedAt")
SELECT
  s.id,
  p.id,
  1, -- quantity
  NOW(),
  NOW()
FROM "Subscription" s
CROSS JOIN "Product" p
WHERE s."tenantId" = 1
  AND p.name = '+10 Animals'
LIMIT 1;
```

```bash
# Refresh snapshot to pick up new limit
npm run db:dev:repl
```

```javascript
const { updateUsageSnapshot } = await import('./src/services/subscription/usage-service.js');
await updateUsageSnapshot(1, 'ANIMAL_COUNT');

const { getQuotaLimit } = await import('./src/services/subscription/entitlement-service.js');
const limit = await getQuotaLimit(1, 'ANIMAL_QUOTA');
console.log(`New limit: ${limit}`); // Should be 60 (50 + 10)
```

**Expected:** `New limit: 60`

Now you should be able to create 10 more animals (51-60).

### Test 5: Test with Enterprise (Unlimited)
```sql
-- Upgrade to Enterprise (unlimited animals)
UPDATE "Subscription"
SET "productId" = (SELECT id FROM "Product" WHERE name = 'BreederHQ Enterprise (Monthly)' LIMIT 1),
    "amountCents" = 9900,
    "updatedAt" = NOW()
WHERE "tenantId" = 1;
```

```bash
# Refresh snapshot
npm run db:dev:repl
```

```javascript
const { updateUsageSnapshot } = await import('./src/services/subscription/usage-service.js');
await updateUsageSnapshot(1, 'ANIMAL_COUNT');

const { getQuotaLimit } = await import('./src/services/subscription/entitlement-service.js');
const limit = await getQuotaLimit(1, 'ANIMAL_QUOTA');
console.log(`Enterprise limit: ${limit}`); // Should be null (unlimited)
```

**Expected:** `Enterprise limit: null`

Now you can create unlimited animals (quota check will always pass).

---

## Performance Notes

### Fast Reads
- UsageSnapshot table = single row lookup (microseconds)
- No counting queries needed on quota check

### Writes
- After create/delete: Single upsert to UsageSnapshot
- Non-blocking (can be made async in future)

### Accuracy
- Snapshot updated after every create/delete
- Uses `calculateActualUsage()` to count from Animal table
- Counts only `archived: false` animals
- Always accurate (not eventual consistency)

---

## Next Steps

To complete quota enforcement across the platform:

### High Priority (Core Quotas)
- [ ] **Contacts** - Add to POST /contacts, DELETE /contacts/:id
- [ ] **Portal Access** - Add to POST /portal-access/:partyId/enable
- [ ] **Marketplace Listings** - Add to POST /marketplace-listings
- [ ] **Breeding Plans** - Add to POST /breeding-plans

### Medium Priority (Feature Gates)
- [ ] **API Routes** - Add `requireEntitlement('API_ACCESS')` to /api/external/*
- [ ] **Advanced Reporting** - Add to reports routes
- [ ] **Multi-Location** - Add when creating additional locations

### Low Priority
- [ ] Create `/api/v1/usage` endpoint for frontend dashboard
- [ ] Add warning headers with `warnQuotaLimit()` to list endpoints
- [ ] Build frontend billing UI

---

## Files Modified

1. ✅ `src/routes/animals.ts` - Added quota enforcement to POST and DELETE

---

**Status:** ✅ Animals route quota enforcement complete and ready for testing!

**Next:** Integrate into other core routes (contacts, breeding plans, etc.)
