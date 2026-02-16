# ADR-0002: Lazy Stripe Client Initialization

**Date**: 2026-02-15
**Status**: Accepted (Implemented)
**Deciders**: Engineering Team
**Related**: [ADR-0001: AWS Secrets Manager](0001-AWS-SECRETS-MANAGER.md)

---

## Context

The Stripe SDK client (`new Stripe(key)`) was previously initialized at **module evaluation time** as a top-level export:

```typescript
// OLD pattern (before this change)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}
export const stripe = new Stripe(STRIPE_SECRET_KEY, { ... });
```

This worked when all secrets were available in `process.env` before the application started (e.g., via `.env` files or Render environment variables).

However, with the introduction of AWS Secrets Manager (ADR-0001), secrets are now loaded **asynchronously** at startup. The module evaluation order is:

1. Node.js evaluates all `import` statements (synchronous)
2. `stripe-service.ts` executes top-level code, reads `process.env.STRIPE_SECRET_KEY`
3. **Problem**: Secrets Manager hasn't fetched secrets yet — `STRIPE_SECRET_KEY` is undefined
4. Application crashes with "STRIPE_SECRET_KEY environment variable is required"

This is a fundamental incompatibility between eager module-level initialization and async secret loading.

---

## Decision

Replace the eagerly-initialized `stripe` export with a **lazy singleton** via `getStripe()` function:

```typescript
// NEW pattern
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    _stripe = new Stripe(key, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    });
  }
  return _stripe;
}
```

All consumers must call `getStripe()` instead of importing `stripe` directly.

---

## Alternatives Considered

### Option 1: Top-level await in stripe-service.ts

```typescript
const secrets = await getDatabaseSecrets();
export const stripe = new Stripe(secrets.STRIPE_SECRET_KEY, { ... });
```

**Why not chosen**: Couples stripe-service to the secrets module. Also makes every file that imports stripe-service participate in the async module graph, increasing startup complexity.

### Option 2: Factory function with explicit init call

```typescript
export let stripe: Stripe;
export function initStripe(key: string) {
  stripe = new Stripe(key, { ... });
}
```

**Why not chosen**: Requires coordinating an `initStripe()` call at the right point in startup. Error-prone — if any code runs before init, it gets `undefined`.

### Option 3: Keep eager init, ensure env vars load first

Load secrets into `process.env` before any imports via a preload script.

**Why not chosen**: Node.js ESM doesn't support `--require` preloading in the same way as CJS. Would require restructuring the entire startup sequence.

---

## Consequences

### Positive

- Stripe client is only created when first needed (after secrets are available)
- No changes required to startup sequence or module loading order
- Singleton pattern ensures only one Stripe instance exists
- Same error message if key is missing (just deferred to first use)

### Negative

- Every call site must use `getStripe()` instead of `stripe` (function call overhead, though negligible)
- Error on missing key is deferred from startup to first Stripe operation (could be harder to debug if key is missing)

---

## Migration Guide

All consumers of `stripe-service.ts` must update their imports and usage:

```typescript
// BEFORE
import { stripe } from "../services/stripe-service.js";
stripe.customers.create({ ... });

// AFTER
import { getStripe } from "../services/stripe-service.js";
getStripe().customers.create({ ... });
```

### Files updated in this change

| File | Call sites updated |
|------|--------------------|
| `src/routes/billing.ts` | 1 |
| `src/routes/marketplace-verification.ts` | 5 |
| `src/routes/marketplace-waitlist.ts` | 1 |
| `src/routes/portal-data.ts` | 1 |
| `src/services/marketplace-invoice-service.ts` | 8 |
| `src/services/marketplace-transaction-service.ts` | 3 |
| `src/services/tenant-invoice-stripe-service.ts` | 11 |

### For new code

Always use `getStripe()` — do **not** create a new `Stripe` instance or cache the result in a module-level variable:

```typescript
// CORRECT
import { getStripe } from "../services/stripe-service.js";
const customer = await getStripe().customers.create({ ... });

// WRONG - do not cache at module level
import { getStripe } from "../services/stripe-service.js";
const stripe = getStripe(); // May run before secrets are loaded!
```

---

**ADR Version**: 1.0
