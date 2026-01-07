# Quota & Entitlement Middleware Usage Guide

## Overview

Three new services and middleware have been created to enforce subscription quotas and entitlements:

1. **EntitlementService** - Check what features tenants can access
2. **UsageService** - Track current usage vs limits
3. **QuotaEnforcementMiddleware** - Protect routes with quota/entitlement checks

---

## Quick Start

### 1. Protect a Route with Quota Check

```typescript
// Before (no quota enforcement):
fastify.post('/api/v1/animals',
  { preHandler: [requireAuth] },
  async (req, reply) => {
    // Create animal...
  }
)

// After (with quota enforcement):
import { checkQuota } from '../middleware/quota-enforcement.js';

fastify.post('/api/v1/animals',
  {
    preHandler: [
      requireAuth,
      checkQuota('ANIMAL_COUNT') // ← Blocks if at limit!
    ]
  },
  async (req, reply) => {
    // Only reached if quota available
    // Create animal...

    // Update usage snapshot after creation
    await updateUsageSnapshot(req.tenantId, 'ANIMAL_COUNT');
  }
)
```

### 2. Require a Feature Entitlement

```typescript
import { requireEntitlement } from '../middleware/quota-enforcement.js';

// Block access if tenant doesn't have API_ACCESS entitlement
fastify.get('/api/v1/export/data',
  {
    preHandler: [
      requireAuth,
      requireEntitlement('API_ACCESS')
    ]
  },
  async (req, reply) => {
    // Only Enterprise users reach here
  }
)
```

### 3. Check Subscription Status

```typescript
import { checkSubscriptionStatus } from '../middleware/quota-enforcement.js';

// Apply to entire route group
fastify.register((f, opts, done) => {
  // All routes in this group require active subscription
  f.addHook('preHandler', checkSubscriptionStatus());

  f.get('/premium-feature', async (req, reply) => {
    // Blocked if subscription expired
  });

  done();
});
```

---

## Middleware Functions

### `requireEntitlement(key: EntitlementKey)`

**Purpose:** Block request if tenant doesn't have a specific entitlement.

**Returns:**
- `200 OK` - If tenant has entitlement
- `403 Forbidden` - If tenant lacks entitlement

**Response on failure:**
```json
{
  "error": "ENTITLEMENT_REQUIRED",
  "code": "ENTITLEMENT_REQUIRED",
  "message": "Your plan does not include access to api access",
  "details": {
    "requiredEntitlement": "API_ACCESS",
    "upgradeUrl": "/settings/billing"
  }
}
```

**Available Entitlement Keys:**
- Surface Access: `PLATFORM_ACCESS`, `PORTAL_ACCESS`, `MARKETPLACE_ACCESS`
- Features: `BREEDING_PLANS`, `FINANCIAL_SUITE`, `API_ACCESS`, `MULTI_LOCATION`, `E_SIGNATURES`, etc.
- Quotas: `ANIMAL_QUOTA`, `CONTACT_QUOTA`, `MARKETPLACE_LISTING_QUOTA`, etc.

---

### `checkQuota(metricKey, countToAdd = 1)`

**Purpose:** Block request if adding resources would exceed quota.

**Parameters:**
- `metricKey` - The quota to check (`ANIMAL_COUNT`, `CONTACT_COUNT`, etc.)
- `countToAdd` - How many resources will be added (default: 1)

**Returns:**
- `200 OK` - If quota available
- `403 Forbidden` - If quota would be exceeded

**Response on failure:**
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

**Supported Metrics:**
- `ANIMAL_COUNT`
- `CONTACT_COUNT`
- `PORTAL_USER_COUNT`
- `BREEDING_PLAN_COUNT`
- `MARKETPLACE_LISTING_COUNT`

---

### `checkSubscriptionStatus()`

**Purpose:** Check subscription status and block/warn based on state.

**Behavior:**
| Status | Action | Headers Added |
|--------|--------|---------------|
| `TRIAL` | Allow | `X-Subscription-Status: TRIAL`, `X-Trial-Ends: <date>` |
| `ACTIVE` | Allow | None |
| `PAST_DUE` | Allow (grace period) | `X-Subscription-Status: PAST_DUE`, `X-Grace-Period-Ends: <date>` |
| `PAST_DUE` (expired) | Block 403 | None |
| `EXPIRED` | Block 403 | None |
| `CANCELED` | Block 403 | None |
| `INCOMPLETE` | Block 403 | None |
| `PAUSED` | Block 403 | None |

**Response on block:**
```json
{
  "error": "SUBSCRIPTION_EXPIRED",
  "code": "SUBSCRIPTION_EXPIRED",
  "message": "Your subscription is expired. Please subscribe to continue.",
  "details": {
    "upgradeUrl": "/settings/billing"
  }
}
```

---

### `requireSubscriptionAndQuota(metricKey, countToAdd = 1)`

**Purpose:** Combo middleware - check subscription AND quota in one.

**Equivalent to:**
```typescript
preHandler: [
  checkSubscriptionStatus(),
  checkQuota('ANIMAL_COUNT')
]
```

**Use when:**
- Creating quota-limited resources
- Want to ensure both active subscription AND available quota

---

### `warnQuotaLimit(metricKey, threshold = 0.8)`

**Purpose:** Add headers when approaching quota, but don't block.

**Parameters:**
- `metricKey` - The quota to check
- `threshold` - Warn at this percentage (default: 0.8 = 80%)

**Behavior:**
- Does NOT block requests
- Adds headers if usage >= threshold

**Headers added:**
```
X-Quota-Warning: true
X-Quota-Metric: ANIMAL_COUNT
X-Quota-Used: 42
X-Quota-Limit: 50
X-Quota-Percent: 84.0
```

**Frontend can show banner:** "You're using 42 of 50 animals (84%). Upgrade to add more."

---

## Service Functions (Direct Usage)

### EntitlementService

```typescript
import {
  checkEntitlement,
  getTenantEntitlements,
  getQuotaLimit,
} from './services/subscription/entitlement-service.js';

// Check if tenant has specific entitlement
const result = await checkEntitlement(tenantId, 'API_ACCESS');
if (result.hasAccess) {
  // Grant access
}

// Get all entitlements for a tenant
const entitlements = await getTenantEntitlements(tenantId);
// Map<EntitlementKey, number | null>

// Get quota limit for a metric
const limit = await getQuotaLimit(tenantId, 'ANIMAL_QUOTA');
// null = unlimited, number = hard limit
```

### UsageService

```typescript
import {
  getCurrentUsage,
  getUsageStatus,
  canAddResource,
  updateUsageSnapshot,
  refreshAllSnapshots,
} from './services/subscription/usage-service.js';

// Get current usage
const count = await getCurrentUsage(tenantId, 'ANIMAL_COUNT');
// Returns: 42

// Get usage status (with limit and percentage)
const status = await getUsageStatus(tenantId, 'ANIMAL_COUNT');
// Returns: { currentValue: 42, limit: 50, percentUsed: 84, isOverLimit: false }

// Check if can add more
const canAdd = await canAddResource(tenantId, 'ANIMAL_COUNT', 5);
// Returns: false (would exceed limit)

// Update snapshot after creating/deleting resource
await updateUsageSnapshot(tenantId, 'ANIMAL_COUNT');

// Refresh all snapshots (expensive, use sparingly)
await refreshAllSnapshots(tenantId);
```

---

## Integration Examples

### Example 1: Animal Creation Route

```typescript
// src/routes/animals.ts
import { checkQuota } from '../middleware/quota-enforcement.js';
import { updateUsageSnapshot } from '../services/subscription/usage-service.js';

export default async function animalRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/animals',
    {
      preHandler: [
        requireAuth,
        requireActorContext(['STAFF']),
        checkQuota('ANIMAL_COUNT'), // ← Block if at 50 animals
      ],
    },
    async (req, reply) => {
      const animal = await prisma.animal.create({
        data: {
          ...req.body,
          tenantId: req.tenantId,
        },
      });

      // Update usage snapshot
      await updateUsageSnapshot(req.tenantId, 'ANIMAL_COUNT');

      return animal;
    }
  );

  fastify.delete(
    '/animals/:id',
    { preHandler: [requireAuth, requireActorContext(['STAFF'])] },
    async (req, reply) => {
      await prisma.animal.update({
        where: { id: req.params.id },
        data: { archived: true },
      });

      // Update usage snapshot after deletion
      await updateUsageSnapshot(req.tenantId, 'ANIMAL_COUNT');

      return { ok: true };
    }
  );
}
```

### Example 2: Contact Creation with Warning

```typescript
import { checkQuota, warnQuotaLimit } from '../middleware/quota-enforcement.js';

fastify.post(
  '/contacts',
  {
    preHandler: [
      requireAuth,
      checkQuota('CONTACT_COUNT'), // Block at limit
      warnQuotaLimit('CONTACT_COUNT', 0.9), // Warn at 90%
    ],
  },
  async (req, reply) => {
    // Create contact...
    await updateUsageSnapshot(req.tenantId, 'CONTACT_COUNT');
  }
);
```

### Example 3: Feature-Gated Route

```typescript
import { requireEntitlement } from '../middleware/quota-enforcement.js';

// Only Enterprise users can access advanced reporting
fastify.get(
  '/reports/advanced',
  {
    preHandler: [
      requireAuth,
      requireEntitlement('ADVANCED_REPORTING'),
    ],
  },
  async (req, reply) => {
    // Generate advanced report...
  }
);
```

### Example 4: API Route Group with Subscription Check

```typescript
// All API routes require active subscription
fastify.register(async (apiRoutes) => {
  // Apply to all routes in this group
  apiRoutes.addHook('preHandler', checkSubscriptionStatus());
  apiRoutes.addHook('preHandler', requireEntitlement('API_ACCESS'));

  apiRoutes.get('/data/export', async (req, reply) => {
    // Only reached if subscription active + API_ACCESS entitlement
  });

  apiRoutes.post('/data/import', async (req, reply) => {
    // Same checks apply
  });
}, { prefix: '/api/v1/external' });
```

---

## Testing

### Manual Testing

1. **Create a test tenant with Pro subscription:**
```sql
-- Create subscription
INSERT INTO "Subscription" ("tenantId", "productId", "status", "amountCents", "currency", "billingInterval", "createdAt", "updatedAt")
SELECT 1, id, 'ACTIVE', 3900, 'USD', 'MONTHLY', NOW(), NOW()
FROM "Product"
WHERE name = 'BreederHQ Pro (Monthly)'
LIMIT 1;
```

2. **Create 49 animals, then try to create 50th and 51st:**
```bash
# Should succeed (49 -> 50)
curl -X POST http://localhost:3000/api/v1/animals -d '{...}'

# Should fail with QUOTA_EXCEEDED
curl -X POST http://localhost:3000/api/v1/animals -d '{...}'
```

3. **Check headers on PAST_DUE subscription:**
```sql
UPDATE "Subscription" SET "status" = 'PAST_DUE' WHERE "tenantId" = 1;
```

Then make any request - should see:
```
X-Subscription-Status: PAST_DUE
X-Grace-Period-Ends: 2026-02-01T...
```

---

## Performance Considerations

### UsageSnapshot Table

- Fast reads (single row lookup)
- Updated after create/delete operations
- Refresh sparingly (use `refreshAllSnapshots` only when debugging)

### Quota Checks

- Very fast (1 query to UsageSnapshot + 1 query to ProductEntitlement)
- Cache entitlements in memory if needed (future optimization)

### When to Update Snapshots

**Always update after:**
- Creating quota-limited resource (animal, contact, etc.)
- Deleting/archiving quota-limited resource
- Subscription changes (upgrade/downgrade)

**Don't update on:**
- Read operations
- Updates that don't change count

---

## Frontend Integration

### Display Usage in UI

```typescript
// GET /api/v1/usage
const response = await fetch('/api/v1/usage');
const usage = await response.json();

// Show usage bar:
// "Animals: 42 / 50 (84% used)"
<ProgressBar
  value={usage.ANIMAL_COUNT.currentValue}
  max={usage.ANIMAL_COUNT.limit}
/>
```

### Handle Quota Errors

```typescript
try {
  await fetch('/api/v1/animals', { method: 'POST', ... });
} catch (error) {
  if (error.code === 'QUOTA_EXCEEDED') {
    // Show upgrade modal
    showUpgradeModal({
      message: error.message,
      upgradeUrl: error.details.upgradeUrl
    });
  }
}
```

### Warning Banners

```typescript
// Check response headers
const headers = response.headers;
if (headers.get('X-Quota-Warning') === 'true') {
  const metric = headers.get('X-Quota-Metric');
  const percent = headers.get('X-Quota-Percent');

  showBanner(`You're using ${percent}% of your ${metric} quota. Upgrade soon!`);
}
```

---

## Next Steps

1. ✅ Services & Middleware created
2. **TODO:** Add to existing routes (animals, contacts, breeding plans)
3. **TODO:** Create `/api/v1/usage` endpoint for frontend
4. **TODO:** Add usage dashboard to settings panel
5. **TODO:** Test with real subscriptions
6. **TODO:** Add Stripe integration for actual billing

