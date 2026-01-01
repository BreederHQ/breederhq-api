# Public Marketplace API - Production Enablement

## Overview

The public marketplace API provides unauthenticated access to browse breeding programs, offspring groups, and animals listed for sale. Routes are feature-gated and must be explicitly enabled in production.

## Environment Variable Required

```bash
MARKETPLACE_PUBLIC_ENABLED=true
```

**Default:** `false` (routes not registered)

## Route Prefixes

The marketplace API is available under **two prefixes** for compatibility:

### Authoritative Prefix (Recommended)
```
/api/v1/public/marketplace/*
```

### Legacy Prefix (Backward Compatibility)
```
/api/v1/marketplace/*
```

Both prefixes serve identical endpoints and share the same feature flag.

## Endpoints

### Programs
- `GET /api/v1/public/marketplace/programs` - List all public programs
- `GET /api/v1/public/marketplace/programs/:programSlug` - Get program details

### Offspring Groups
- `GET /api/v1/public/marketplace/programs/:programSlug/offspring-groups` - List offspring groups for a program
- `GET /api/v1/public/marketplace/programs/:programSlug/offspring-groups/:listingSlug` - Get offspring group details

### Animals
- `GET /api/v1/public/marketplace/programs/:programSlug/animals` - List animals for a program
- `GET /api/v1/public/marketplace/programs/:programSlug/animals/:urlSlug` - Get animal details

## Production Deployment (Render)

### 1. Set Environment Variable

In your Render dashboard:

1. Navigate to: **breederhq-api** service
2. Go to: **Environment** tab
3. Add new environment variable:
   - **Key:** `MARKETPLACE_PUBLIC_ENABLED`
   - **Value:** `true`
4. Click: **Save Changes**

### 2. Restart Service

Render will automatically redeploy when you save environment changes. If not:

1. Go to: **Manual Deploy** section
2. Click: **Deploy latest commit**

Or via Render CLI:
```bash
render services restart breederhq-api
```

### 3. Verify Deployment

Test that routes are accessible:

```bash
# Test authoritative prefix
curl https://breederhq-api.onrender.com/api/v1/public/marketplace/programs

# Test legacy prefix
curl https://breederhq-api.onrender.com/api/v1/marketplace/programs
```

**Expected Response:**
```json
{
  "items": [],
  "total": 0
}
```

Or use the verification script:
```powershell
$env:API_BASE_URL="https://breederhq-api.onrender.com"
powershell -File scripts/verify-public-marketplace-routes.ps1
```

## Local Development

### Enable Feature

Add to `.env.dev`:
```bash
MARKETPLACE_PUBLIC_ENABLED=true
```

### Start Server

```bash
npm run dev
```

### Verify Routes

```bash
npm run script:verify-routes
```

Or manually:
```bash
# Authoritative prefix
curl http://localhost:6001/api/v1/public/marketplace/programs

# Legacy prefix
curl http://localhost:6001/api/v1/marketplace/programs
```

## Troubleshooting

### 404 Response

**Symptom:** All marketplace routes return 404

**Cause:** Feature flag not enabled

**Solution:**
1. Verify `MARKETPLACE_PUBLIC_ENABLED=true` is set in environment
2. Restart API server
3. Check server logs for route registration confirmation

### Empty Response

**Symptom:** Routes return `{"items": [], "total": 0}`

**Cause:** No programs have been published

**Solution:**
Enable at least one program:
```bash
cd breederhq-api
ORG_ID=1 PROGRAM_SLUG=my-program npm run script:enable-public-program
```

See: `scripts/enable-public-program.mjs` for details

## Security Notes

- These routes are **public** (no authentication required)
- Only explicitly published data is exposed
- PII is stripped via DTO transformations
- Rate limiting applies (configured in server.ts)

## Frontend Integration

Frontend expects routes at:
```
/api/v1/public/marketplace/*
```

API client location:
```
apps/marketplace/src/api.ts
```

Configuration:
```typescript
const publicRoot = `${root}/public/marketplace`;
```
