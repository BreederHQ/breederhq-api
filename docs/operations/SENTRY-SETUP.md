# Sentry Setup Guide

**Date**: 2026-02-09
**Status**: ✅ Complete
**Audience**: Developer
**Difficulty**: Beginner
**Last Verified**: 2026-02-15

---

## Overview

Sentry provides error tracking and performance monitoring for both the API and frontend applications. This enables:

- **Error tracking**: Automatic capture of unhandled exceptions with stack traces
- **Performance monitoring**: Request timing, slow queries, bottleneck identification
- **CPU profiling**: Node.js CPU profiling via native addon for performance insights
- **Heat maps**: Identify which endpoints are most used and where issues occur
- **Alerting**: Get notified when new errors occur or error rates spike

### SDK Versions

| Package | Version | Notes |
|---------|---------|-------|
| `@sentry/node` | 10.x | Core error tracking and performance |
| `@sentry/profiling-node` | 10.x | CPU profiling via native addon (`@sentry-internal/node-cpu-profiler`) |
| `@sentry/react` | 10.x | Frontend (breederhq monorepo) |

> **Node.js compatibility**: The `@sentry/profiling-node` package ships prebuilt native binaries. After upgrading Node.js to a new major version, verify that Sentry has a binary for the new ABI version (e.g., Node 24 = ABI 137). If the binary is missing, the server will crash at startup. Upgrade the Sentry packages to get the latest binary support.

---

## Environment Variables

### API (breederhq-api)

**Configured in**: `.env.dev`, `.env.prod`, and Render environment variables

```bash
# Sentry DSN
SENTRY_DSN=https://d2656b3a48a64be4635984a333f6372e@o4510856946122752.ingest.us.sentry.io/4510856953266176
```

**Note**: The same DSN is used for all environments. Sentry distinguishes environments via the `environment` tag.

### Frontend Apps (breederhq monorepo)

**Configured in**: `apps/platform/.env` and Vercel environment variables

```bash
# Sentry DSN
VITE_SENTRY_DSN=https://a62bc6c2d384ef22cf73fb67a4d226d8@o4510856946122752.ingest.us.sentry.io/4510856979152896

# Enable Sentry debug output in development
VITE_SENTRY_DEBUG=true
```

**Important**: The frontend monorepo uses app-level `.env` files. If an app has its own `.env` (like `apps/platform/.env`), it overrides the root `.env`. Portal and Marketplace apps inherit from root.

---

## Getting Your Sentry DSN

1. **Create a Sentry account**: https://sentry.io/signup/
2. **Create a new project**:
   - For API: Select "Node.js" → "Fastify"
   - For Frontend: Select "JavaScript" → "React"
3. **Copy the DSN** from Project Settings → Client Keys (DSN)

### Recommended Project Structure

| Sentry Project | Apps |
|----------------|------|
| `breederhq-api` | API backend |
| `breederhq-frontend` | Platform, Portal, Marketplace, Mobile |

Using a single frontend project with `app` tags allows you to filter by app while keeping costs down.

---

## What Gets Captured

### API

| Event Type | Captured | Notes |
|------------|----------|-------|
| Unhandled exceptions | ✅ | Sent to Sentry with full stack trace |
| 500 errors | ✅ | Internal server errors |
| 400/401/403/404 errors | ❌ | Expected errors, not sent |
| Prisma P2002/P2003 | ❌ | Expected constraint errors |
| Request performance | ✅ | Timing for all requests (10% sample in prod) |
| Database queries | ✅ | Via Prisma instrumentation |

### Frontend

| Event Type | Captured | Notes |
|------------|----------|-------|
| Unhandled exceptions | ✅ | Including React rendering errors |
| ErrorBoundary catches | ✅ | Component errors with stack |
| Console errors | ❌ | Not captured by default |
| Network errors | ❌ | "Failed to fetch" filtered out |
| Performance | ✅ | Page load, navigation timing |
| Session replay | ⚠️ | Only on errors, 10% sample |

---

## Filtering and Tags

### Automatic Tags

All events are automatically tagged with:

- `environment`: production, staging, development
- `app`: platform, portal, marketplace, mobile (frontend only)
- `tenantId`: For authenticated requests (API only)

### Filtering Noisy Errors

The following errors are ignored by default:

**API:**
- `ECONNRESET`, `EPIPE` (client disconnects)
- `unauthorized`, `forbidden_tenant` (expected auth failures)

**Frontend:**
- `ResizeObserver loop` (browser noise)
- `Failed to fetch`, `NetworkError` (user connection issues)
- `AbortError` (user navigation)

---

## Performance Monitoring

### Sample Rates

| Environment | Traces | Profiles |
|-------------|--------|----------|
| Production | 10% | 10% |
| Development | 100% | 100% |

### What You'll See

1. **Transaction Heat Map**: Which endpoints are called most
2. **Latency Distribution**: p50, p75, p95 response times
3. **Slow Transactions**: Requests taking longer than expected
4. **Database Spans**: Time spent in Prisma queries

---

## Cost Estimate

Sentry pricing is based on events and transactions:

| Tier | Errors | Performance | Cost |
|------|--------|-------------|------|
| **Developer** | 5K/month | 10K/month | Free |
| **Team** | 50K/month | 100K/month | $26/month |
| **Business** | 100K/month | 250K/month | $80/month |

**Recommendation**: Start with Developer tier (free). Move to Team when you hit limits.

---

## Verifying Setup

### API

After deploying with `SENTRY_DSN` set, you should see in logs:

```
[Sentry] Initialized (env: production)
```

To test error capture:

```bash
# Trigger a test error (dev only)
curl -X POST http://localhost:3000/api/v1/__test-sentry-error
```

### Frontend

After deploying with `VITE_SENTRY_DSN` set, check browser console:

```
[Sentry] Initialized for platform
```

To test error capture, trigger an error in React DevTools or add temporary:

```tsx
throw new Error("Test Sentry error");
```

---

## Alerting (Recommended)

Set up alerts in Sentry for:

1. **New Issue**: Get notified when a new error type occurs
2. **Issue Regression**: Error that was resolved starts happening again
3. **Spike Detection**: Error rate increases significantly
4. **P95 Latency**: Performance degrades

---

## Files Modified

### API
- `src/lib/sentry.ts` - Sentry initialization and helpers
- `src/server.ts` - Integration with Fastify error handler and hooks
- `package.json` - `@sentry/node` (10.x), `@sentry/profiling-node` (10.x)

### Frontend
- `apps/platform/src/main.tsx` - Sentry initialization
- `apps/portal/src/main.tsx` - Sentry initialization
- `apps/marketplace/src/main.tsx` - Sentry initialization
- `apps/platform/src/components/ErrorBoundary.tsx` - Sentry capture
- `apps/portal/src/components/ErrorBoundary.tsx` - Sentry capture
- `packages/commerce-shared/src/components/ErrorBoundary.tsx` - Sentry capture
- `package.json` - `@sentry/react` (10.x)

---

## Troubleshooting

### Problem: "Sentry is not defined" in browser console

**Symptom**: Running `Sentry.captureMessage("test")` in console throws ReferenceError

**Cause**: Sentry is imported as a module, not exposed globally by default

**Solution**: After Sentry initialization in main.tsx, add:
```typescript
(window as any).Sentry = Sentry;
```

---

### Problem: ERR_BLOCKED_BY_CLIENT when Sentry sends events

**Symptom**: Network requests to sentry.io fail with ERR_BLOCKED_BY_CLIENT

**Cause**: Ad blocker or privacy extension blocking Sentry requests

**Solution**: Disable ad blocker for localhost or test in incognito mode without extensions

---

### Problem: Frontend DSN not loading despite being in root .env

**Symptom**: `import.meta.env.VITE_SENTRY_DSN` is undefined despite setting in root `.env`

**Cause**: App-level `.env` files override root `.env` in Vite. If `apps/platform/.env` exists, root `.env` values are ignored.

**Solution**: Add `VITE_SENTRY_DSN` to the app-level `.env` file (e.g., `apps/platform/.env`)

---

### Problem: Server crashes with "Cannot find module sentry_cpu_profiler-win32-x64-NNN.node"

**Symptom**: Server crashes at startup with `MODULE_NOT_FOUND` for `@sentry/profiling-node` native binary

**Cause**: Node.js was upgraded to a new major version whose ABI version doesn't have a prebuilt Sentry profiling binary. Each Node.js major version has a unique ABI version (e.g., Node 20 = ABI 115, Node 22 = ABI 127, Node 24 = ABI 137).

**Solution**: Upgrade Sentry packages to a version that includes the binary for your Node.js ABI:

```bash
npm install @sentry/node@latest @sentry/profiling-node@latest
```

**Verify** the binary exists after upgrade:

```bash
# Check your Node.js ABI version
node -e "console.log(process.versions.modules)"

# Check available binaries (10.x stores them in @sentry-internal/node-cpu-profiler)
ls node_modules/@sentry-internal/node-cpu-profiler/lib/sentry_cpu_profiler-*
```

---

### Problem: CSRF_FAILED when hitting test endpoint

**Symptom**: POST to `/__test-sentry-error` returns 403 CSRF_FAILED

**Cause**: Test endpoint protected by CSRF validation

**Solution**: Add endpoint to `isCsrfExempt()` function in server.ts (already done)

---

## Completion Status

- [x] Create Sentry account and projects (2026-02-09)
- [x] Add `SENTRY_DSN` to API environment (Render) (2026-02-09)
- [x] Add `VITE_SENTRY_DSN` to frontend environments (Vercel) (2026-02-09)
- [x] Install packages (`@sentry/node`, `@sentry/react`) (2026-02-09)
- [x] Deploy and verify initialization logs (2026-02-09)
- [x] Upgrade Sentry SDK from 8.x to 10.x for Node.js 24 compatibility (2026-02-15)
- [ ] Set up alerting rules in Sentry dashboard (recommended)

---

## Next Steps

Now that Sentry is configured:

1. **Set up alerts** in Sentry dashboard for new issues, regressions, and spike detection
2. **Monitor the dashboard** during first week to tune noise filtering
3. **Add custom context** to errors as needed (user ID, tenant ID already included)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-15 | 1.2 | Upgraded Sentry SDK 8.x → 10.x for Node.js 24 (ABI 137) support; added SDK version table, Node.js ABI troubleshooting section |
| 2026-02-09 | 1.1 | Added troubleshooting sections, frontend DSN note |
| 2026-02-09 | 1.0 | Initial setup documentation |

---

**Document Version**: 1.2
**Last Updated**: 2026-02-15
**Verified By**: Manual testing in development (Node.js 24.13.1)
