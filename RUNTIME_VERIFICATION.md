# Runtime Verification: Cycle Length Override v1

## Backend Setup

### Prerequisites
- Node.js 20.x
- PostgreSQL database running
- npm 10.8.0+

### 1. Install Dependencies
```bash
cd c:/Users/Aaron/Documents/Projects/breederhq-api
npm install
```

### 2. Configure Environment
Environment files use `.env.dev` for development.

Required in `.env.dev`:
```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
COOKIE_SECRET="your-secret-here"
```

See `.env.example` for all available options.

### 3. Run Migration
```bash
npm run db:dev:migrate
```

Expected output:
```
Applying migration `20260101121151_add_female_cycle_len_override`
✔ Generated Prisma Client
```

### 4. Start Development Server
```bash
npm run dev
```

Expected output:
```
API listening on :3000
```

**Server Details**:
- Framework: Fastify 5.x
- Entry point: `src/server.ts`
- Default port: 3000 (configurable via PORT env var)
- Routes prefix: `/api/v1`

## API Verification Tests

All routes require authentication and tenant context. For testing, you'll need:
- Valid session cookie (XSRF-TOKEN)
- x-tenant-id header

### Test 1: GET animal (baseline)
```bash
curl -H "x-tenant-id: 1" \
  -H "Cookie: XSRF-TOKEN=..." \
  http://localhost:3000/api/v1/animals/1
```

**Expected Response** (200 OK):
```json
{
  "id": 1,
  "name": "Test Female",
  "species": "DOG",
  "sex": "FEMALE",
  "status": "ACTIVE",
  "femaleCycleLenOverrideDays": null,
  "cycleStartDates": [],
  ...
}
```

### Test 2: PATCH valid override (150 days)
```bash
curl -X PATCH http://localhost:3000/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 1" \
  -H "Cookie: XSRF-TOKEN=..." \
  -H "x-csrf-token: ..." \
  -d '{"femaleCycleLenOverrideDays": 150}'
```

**Expected Response** (200 OK):
```json
{
  "id": 1,
  "femaleCycleLenOverrideDays": 150,
  ...
}
```

### Test 3: PATCH override to null (clear)
```bash
curl -X PATCH http://localhost:3000/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 1" \
  -H "Cookie: XSRF-TOKEN=..." \
  -H "x-csrf-token: ..." \
  -d '{"femaleCycleLenOverrideDays": null}'
```

**Expected Response** (200 OK):
```json
{
  "id": 1,
  "femaleCycleLenOverrideDays": null,
  ...
}
```

### Test 4: PATCH invalid - below minimum (29)
```bash
curl -X PATCH http://localhost:3000/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 1" \
  -H "Cookie: XSRF-TOKEN=..." \
  -H "x-csrf-token: ..." \
  -d '{"femaleCycleLenOverrideDays": 29}'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "invalid_cycle_len_override",
  "detail": "must be an integer between 30 and 730 days"
}
```

### Test 5: PATCH invalid - above maximum (731)
```bash
curl -X PATCH http://localhost:3000/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 1" \
  -H "Cookie: XSRF-TOKEN=..." \
  -H "x-csrf-token: ..." \
  -d '{"femaleCycleLenOverrideDays": 731}'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "invalid_cycle_len_override",
  "detail": "must be an integer between 30 and 730 days"
}
```

### Test 6: PATCH invalid - non-integer (150.5)
```bash
curl -X PATCH http://localhost:3000/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 1" \
  -H "Cookie: XSRF-TOKEN=..." \
  -H "x-csrf-token: ..." \
  -d '{"femaleCycleLenOverrideDays": 150.5}'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "invalid_cycle_len_override",
  "detail": "must be an integer between 30 and 730 days"
}
```

### Test 7: PATCH edge case - minimum valid (30)
```bash
curl -X PATCH http://localhost:3000/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 1" \
  -H "Cookie: XSRF-TOKEN=..." \
  -H "x-csrf-token: ..." \
  -d '{"femaleCycleLenOverrideDays": 30}'
```

**Expected Response** (200 OK):
```json
{
  "id": 1,
  "femaleCycleLenOverrideDays": 30,
  ...
}
```

### Test 8: PATCH edge case - maximum valid (730)
```bash
curl -X PATCH http://localhost:3000/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 1" \
  -H "Cookie: XSRF-TOKEN=..." \
  -H "x-csrf-token: ..." \
  -d '{"femaleCycleLenOverrideDays": 730}'
```

**Expected Response** (200 OK):
```json
{
  "id": 1,
  "femaleCycleLenOverrideDays": 730,
  ...
}
```

## Simplified Testing (Without Auth)

For quick verification during development, you can temporarily bypass auth by:

1. Comment out CSRF/auth middleware in `src/server.ts` (dev only!)
2. Use simpler curl commands:

```bash
# GET
curl http://localhost:3000/api/v1/animals/1

# PATCH
curl -X PATCH http://localhost:3000/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -d '{"femaleCycleLenOverrideDays": 150}'
```

**WARNING**: Never deploy with auth disabled!

## Database Verification

Check migration was applied:

```bash
npm run db:dev:status
```

Check column exists:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Animal'
  AND column_name = 'femaleCycleLenOverrideDays';
```

Expected:
```
 femaleCycleLenOverrideDays | integer | YES
```

## Verification Checklist

- [ ] Migration creates `femaleCycleLenOverrideDays` column
- [ ] Column is nullable (NULL default)
- [ ] GET returns field in response
- [ ] PATCH accepts integers 30-730
- [ ] PATCH accepts null
- [ ] PATCH rejects <30, >730, floats
- [ ] Error code is `invalid_cycle_len_override`
- [ ] Error detail explains valid range
- [ ] Updated value persists across GET requests

---

# Portal Document Downloads (Disabled)

## Status: NOT IMPLEMENTED

Portal document downloads are **disabled** until file storage is configured. The endpoint `/api/v1/portal/documents/:id/download` does not exist and will return 404.

## Why Disabled

File storage infrastructure (S3, local filesystem, etc.) is not yet configured. Without storage, the endpoint cannot serve actual files. Rather than expose a 501 Not Implemented endpoint in production, the route has been removed entirely.

## What Works

Portal documents **list** endpoint is fully functional:
- `GET /api/v1/portal/documents` - Lists offspring documents where authenticated party is buyer
- Returns document metadata (filename, mime type, size, upload date)
- Enforces party-scoped access via OffspringDocument -> Offspring -> Group -> GroupBuyerLinks

## Implementation Requirements

When file storage is configured, implement `GET /api/v1/portal/documents/:id/download` with:

1. **Party Access Verification**:
   - Query Attachment by ID and tenantId
   - Include OffspringDocument where offspring.group.groupBuyerLinks contains partyId
   - Return 404 if no match (document doesn't exist OR party doesn't own it)

2. **File Retrieval**:
   - Read attachment.storageProvider to determine backend (s3, local, etc.)
   - Use attachment.storageKey to fetch file
   - Handle missing files gracefully (404)

3. **HTTP Response**:
   - Set `Content-Disposition: attachment; filename="<attachment.filename>"`
   - Set `Content-Type: <attachment.mime>`
   - Stream file content (do not buffer entire file in memory)

4. **Audit Logging**:
   - Log download event with: partyId, documentId, filename, timestamp
   - Include in tenant audit trail

5. **Security**:
   - Never expose raw storageKey or storage URLs to client
   - All downloads must go through this authenticated endpoint
   - Verify party scope on every request (do not cache access decisions)

## Reference Implementation

See `src/routes/portal-data.ts` TODO comment for party access verification logic.
