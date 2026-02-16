# Claude Code Context - Read This First (Backend API)

**Purpose**: Essential context for Claude Code sessions working on the backend API
**Status**: ✅ Active - Read before writing ANY code
**Last Updated**: 2026-01-21
**Repository**: breederhq-api (Backend)

---

## 🚨 CRITICAL: Read Before Coding

This document contains the **current architecture patterns** for the BreederHQ backend API. These patterns ensure consistency, security, and maintainability.

**Violating these patterns will break the application.** Always search for existing patterns before writing new code.

---

## Architecture Principles

### 1. Multi-Tenant Architecture

**Every request MUST include tenant context:**

✅ **CORRECT - Tenant Required**:
```typescript
// routes/contacts.ts
app.get("/api/v1/contacts", async (req, res) => {
  const tenantId = Number(req.headers["x-tenant-id"]);

  if (!tenantId) {
    return res.status(400).json({ error: "x-tenant-id header required" });
  }

  const contacts = await prisma.contact.findMany({
    where: { tenantId }, // Always scope by tenant
    take: 50,
    skip: (page - 1) * 50,
  });

  res.json({ data: contacts });
});
```

❌ **FORBIDDEN - Missing Tenant Scope**:
```typescript
// ❌ NEVER DO THIS (cross-tenant data leak!)
const contacts = await prisma.contact.findMany(); // No tenant filter!
```

---

### 2. Pagination (Always Server-Side)

**All list endpoints MUST support pagination:**

✅ **CORRECT - Pagination with Metadata**:
```typescript
app.get("/api/v1/contacts", async (req, res) => {
  const tenantId = Number(req.headers["x-tenant-id"]);
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 50, 100); // Cap at 100

  const where = { tenantId };

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.contact.count({ where }),
  ]);

  res.json({
    data: contacts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    },
  });
});
```

❌ **FORBIDDEN - No Pagination**:
```typescript
// ❌ NEVER DO THIS (returns ALL records, crashes on large datasets)
const contacts = await prisma.contact.findMany({ where: { tenantId } });
res.json(contacts);
```

---

### 3. Authentication & Authorization

**Check authentication on all protected routes:**

✅ **CORRECT - Auth Middleware**:
```typescript
// middleware/auth.ts
export async function requireAuth(req, res, next) {
  const sessionCookie = req.cookies.session;

  if (!sessionCookie) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionCookie },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return res.status(401).json({ error: "Session expired" });
  }

  req.user = session.user;
  req.session = session;
  next();
}

// routes/contacts.ts
app.get("/api/v1/contacts", requireAuth, async (req, res) => {
  // req.user is available here
});
```

❌ **FORBIDDEN - No Auth Check**:
```typescript
// ❌ NEVER DO THIS (unauthenticated access!)
app.get("/api/v1/contacts", async (req, res) => {
  // No authentication check!
  const contacts = await prisma.contact.findMany();
  res.json(contacts);
});
```

---

### 4. Input Validation

**Validate all user input:**

✅ **CORRECT - Validated Input**:
```typescript
import { z } from "zod";

const createContactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
});

app.post("/api/v1/contacts", requireAuth, async (req, res) => {
  const tenantId = Number(req.headers["x-tenant-id"]);

  // Validate input
  const validation = createContactSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error });
  }

  const contact = await prisma.contact.create({
    data: {
      ...validation.data,
      tenantId,
    },
  });

  res.json(contact);
});
```

❌ **FORBIDDEN - No Validation**:
```typescript
// ❌ NEVER DO THIS (SQL injection risk, invalid data)
app.post("/api/v1/contacts", async (req, res) => {
  const contact = await prisma.contact.create({
    data: req.body, // Direct use of user input!
  });
  res.json(contact);
});
```

---

### 5. Error Handling

**Handle errors consistently:**

✅ **CORRECT - Proper Error Handling**:
```typescript
app.get("/api/v1/contacts/:id", requireAuth, async (req, res) => {
  const tenantId = Number(req.headers["x-tenant-id"]);
  const contactId = Number(req.params.id);

  try {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        tenantId, // Verify tenant ownership
      },
    });

    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.json(contact);
  } catch (error) {
    console.error("Error fetching contact:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

❌ **FORBIDDEN - Unhandled Errors**:
```typescript
// ❌ NEVER DO THIS (crashes server, exposes stack traces)
app.get("/api/v1/contacts/:id", async (req, res) => {
  const contact = await prisma.contact.findUnique({
    where: { id: Number(req.params.id) },
  }); // No try/catch, no tenant check!

  res.json(contact); // Crashes if null
});
```

---

## Forbidden Patterns (Backend)

### 1. Missing Tenant Scope
❌ **NEVER query without tenant filter** (data leak risk):
```typescript
// ❌ BAD
await prisma.contact.findMany(); // Returns ALL tenants' data!

// ✅ GOOD
await prisma.contact.findMany({ where: { tenantId } });
```

### 2. No Pagination
❌ **NEVER return all records** (performance issue):
```typescript
// ❌ BAD
const contacts = await prisma.contact.findMany({ where: { tenantId } });

// ✅ GOOD
const contacts = await prisma.contact.findMany({
  where: { tenantId },
  take: limit,
  skip: (page - 1) * limit,
});
```

### 3. Missing Authentication
❌ **NEVER skip auth checks** (security issue):
```typescript
// ❌ BAD
app.get("/api/v1/contacts", async (req, res) => { ... });

// ✅ GOOD
app.get("/api/v1/contacts", requireAuth, async (req, res) => { ... });
```

### 4. Unvalidated Input
❌ **NEVER trust user input directly** (injection risk):
```typescript
// ❌ BAD
await prisma.contact.create({ data: req.body });

// ✅ GOOD
const validated = schema.parse(req.body);
await prisma.contact.create({ data: validated });
```

### 5. N+1 Queries
❌ **NEVER query in loops** (performance issue):
```typescript
// ❌ BAD
for (const animal of animals) {
  const tags = await prisma.tag.findMany({ where: { animalId: animal.id } });
}

// ✅ GOOD
const animalIds = animals.map(a => a.id);
const tags = await prisma.tag.findMany({
  where: { animalId: { in: animalIds } },
});
```

---

## Common Patterns

### Pattern 1: List Endpoint with Filters
```typescript
app.get("/api/v1/contacts", requireAuth, async (req, res) => {
  const tenantId = Number(req.headers["x-tenant-id"]);
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const q = req.query.q as string;
  const includeArchived = req.query.includeArchived === "true";

  const where: any = { tenantId };

  // Search filter
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  // Archive filter
  if (!includeArchived) {
    where.archivedAt = null;
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.contact.count({ where }),
  ]);

  res.json({
    data: contacts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    },
  });
});
```

### Pattern 2: Get by ID (with Tenant Check)
```typescript
app.get("/api/v1/contacts/:id", requireAuth, async (req, res) => {
  const tenantId = Number(req.headers["x-tenant-id"]);
  const id = Number(req.params.id);

  try {
    const contact = await prisma.contact.findFirst({
      where: { id, tenantId }, // CRITICAL: Check tenant ownership
    });

    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.json(contact);
  } catch (error) {
    console.error("Error fetching contact:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

### Pattern 3: Create with Validation
```typescript
const createSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
});

app.post("/api/v1/contacts", requireAuth, async (req, res) => {
  const tenantId = Number(req.headers["x-tenant-id"]);

  try {
    const validated = createSchema.parse(req.body);

    const contact = await prisma.contact.create({
      data: {
        ...validated,
        tenantId, // Always include tenant
        createdById: req.user.id,
      },
    });

    res.status(201).json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Error creating contact:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

### Pattern 4: Update with Tenant Check
```typescript
app.put("/api/v1/contacts/:id", requireAuth, async (req, res) => {
  const tenantId = Number(req.headers["x-tenant-id"]);
  const id = Number(req.params.id);

  try {
    // Verify ownership first
    const existing = await prisma.contact.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Contact not found" });
    }

    const validated = updateSchema.parse(req.body);

    const updated = await prisma.contact.update({
      where: { id },
      data: validated,
    });

    res.json(updated);
  } catch (error) {
    // Handle validation and DB errors
    console.error("Error updating contact:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

### Pattern 5: Delete with Soft Delete
```typescript
app.delete("/api/v1/contacts/:id", requireAuth, async (req, res) => {
  const tenantId = Number(req.headers["x-tenant-id"]);
  const id = Number(req.params.id);

  try {
    // Verify ownership
    const existing = await prisma.contact.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Soft delete (preferred)
    await prisma.contact.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

---

## Quick Checks Before PR

### 1. Check Tenant Scoping
```bash
# Find queries without tenant filter
grep -r "prisma\.[a-zA-Z]*\.find" src/routes/ | grep -v "tenantId"
```
If this returns results → ⚠️ Review each one for data leak risk

### 2. Check Auth Middleware
```bash
# Find routes without requireAuth
grep -r "app\.(get|post|put|delete)" src/routes/ | grep -v "requireAuth"
```
If routes are missing `requireAuth` → ⚠️ Add authentication

### 3. Check Pagination
```bash
# Find list endpoints without pagination
grep -r "findMany.*where.*tenantId" src/routes/ | grep -v "take\|skip"
```
If endpoints don't use `take`/`skip` → ⚠️ Add pagination

---

## Database Patterns

### Use Transactions for Multi-Step Operations
```typescript
await prisma.$transaction(async (tx) => {
  const plan = await tx.breedingPlan.create({ data: planData });
  await tx.breedingAttempt.create({ data: { planId: plan.id, ...attemptData } });
  await tx.breedingMilestone.createMany({ data: milestones });
});
```

### Use Proper Indexes
```prisma
model Contact {
  id        Int      @id @default(autoincrement())
  tenantId  Int
  email     String?
  createdAt DateTime @default(now())

  @@index([tenantId, createdAt]) // List queries
  @@index([tenantId, email])     // Email lookup
}
```

### Avoid SELECT *
```typescript
// ✅ GOOD - Select only needed fields
await prisma.contact.findMany({
  where: { tenantId },
  select: {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
  },
});

// ❌ BAD - Returns all fields including large blobs
await prisma.contact.findMany({ where: { tenantId } });
```

---

## Security Checklist

- [ ] All routes have authentication (`requireAuth`)
- [ ] All queries filter by `tenantId`
- [ ] All user input is validated (Zod schemas)
- [ ] All errors are caught and handled
- [ ] No sensitive data in error messages
- [ ] CSRF protection enabled (for POST/PUT/DELETE)
- [ ] Rate limiting on public endpoints
- [ ] SQL injection protection (Prisma handles this)

---

## Performance Checklist

- [ ] All list endpoints paginated
- [ ] No N+1 queries (use `include` or batch queries)
- [ ] Database indexes on filtered/sorted fields
- [ ] SELECT only needed fields (not SELECT *)
- [ ] Use transactions for multi-step operations
- [ ] Cache expensive queries (if needed)

---

## Media Storage & CDN (AWS S3 + CloudFront)

### Architecture

- **Uploads**: S3 presigned PUT URLs (direct browser-to-S3, 15-minute expiry)
- **Public images**: CloudFront CDN URLs (marketplace images, profile banners, logos)
- **Private files**: S3 presigned GET URLs (health records, contracts — 1-hour expiry)
- **S3 bucket**: Private (no public access) — CloudFront accesses via Origin Access Control (OAC)

### Required Environment Variables

```bash
AWS_ACCESS_KEY_ID=<iam-user-access-key>
AWS_SECRET_ACCESS_KEY=<iam-user-secret-key>
AWS_REGION=us-east-1
S3_BUCKET=breederhq-assets-dev    # or alpha, beta, prod
CDN_DOMAIN=d15tdn3qa9of1k.cloudfront.net  # environment-specific CloudFront domain
```

**Per-environment CDN domains:**

| Environment | `S3_BUCKET` | `CDN_DOMAIN` |
|-------------|-------------|--------------|
| Dev | `breederhq-assets-dev` | `d15tdn3qa9of1k.cloudfront.net` |
| Alpha | `breederhq-assets-alpha` | `dty58167apber.cloudfront.net` |
| Beta | `breederhq-assets-beta` | `d13auit2pzjx4r.cloudfront.net` |
| Prod | `breederhq-assets-prod` | `d21ngqll2l9ylo.cloudfront.net` |

### Key Services

All media operations go through `src/services/media-storage.ts`:

```typescript
import {
  generatePresignedUploadUrl,  // Browser → S3 upload
  generatePresignedDownloadUrl, // Private file access (time-limited)
  getPublicCdnUrl,              // Public image access (CloudFront CDN)
  uploadBuffer,                 // Server-side upload (watermarking, etc.)
  deleteFile,                   // Remove from S3
  validateContentType,          // Check allowed MIME types
  validateFileSize,             // Check size limits
} from "../services/media-storage.js";
```

### Public vs Private File Access

```typescript
// ✅ CORRECT - Public images (marketplace, profiles): use CDN URL
const cdnUrl = getPublicCdnUrl(media.storageKey);
// → https://d15tdn3qa9of1k.cloudfront.net/tenants/4/profile/logo/abc.jpg

// ✅ CORRECT - Private files (health records, contracts): use presigned URL
const { url } = await generatePresignedDownloadUrl(media.storageKey, 3600);
// → https://breederhq-assets-dev.s3.us-east-1.amazonaws.com/...?X-Amz-Signature=...

// ❌ WRONG - Don't use presigned URLs for public images (slow, expires)
// ❌ WRONG - Don't use CDN URLs for private files (accessible by anyone)
```

### Cache-Control Headers (MANDATORY)

**All uploads MUST set `Cache-Control: public, max-age=31536000, immutable`.**

This is already handled by `media-storage.ts` functions, but if you write a new `PutObjectCommand`:

```typescript
// ✅ CORRECT - Cache-Control set
new PutObjectCommand({
  Bucket: bucket,
  Key: storageKey,
  Body: buffer,
  ContentType: contentType,
  CacheControl: "public, max-age=31536000, immutable", // REQUIRED
});

// ❌ WRONG - Missing Cache-Control (CDN won't cache properly)
new PutObjectCommand({
  Bucket: bucket,
  Key: storageKey,
  Body: buffer,
  ContentType: contentType,
});
```

**Why `immutable` is safe:** Every S3 key contains a UUID — when a file is replaced, a new key is generated. Old URLs are never reused.

### Upload Flow (Frontend → S3)

```
1. Frontend calls POST /api/v1/media/upload-url
2. API generates presigned PUT URL + storageKey + cdnUrl
3. Frontend uploads directly to S3 via presigned URL
4. Frontend calls POST /api/v1/media/:id/confirm
5. API marks Media record as READY
```

### File Size Limits

| Type | Max Size |
|------|----------|
| Images | 10 MB |
| Documents | 50 MB |

### Storage Key Patterns

```
tenants/{tenantId}/animal/{animalId}/photos/{uuid}.jpg
tenants/{tenantId}/profile/logo/{uuid}.jpg
tenants/{tenantId}/services/{listingId}/{uuid}.jpg
providers/{providerId}/listings/{listingId}/{uuid}.jpg
temp/{ownerType}/{ownerId}/{sessionId}/{uuid}.jpg  (auto-expires 24hrs)
```

### Self-Check for Media Endpoints

- [ ] Am I using `getPublicCdnUrl()` for public images?
- [ ] Am I using `generatePresignedDownloadUrl()` for private files?
- [ ] Does my `PutObjectCommand` include `CacheControl` header?
- [ ] Am I using `media-storage.ts` helpers (not raw S3 commands)?

**Full infrastructure details:** See `breederhq/docs/operations/infrastructure/AWS-ENVIRONMENT-INVENTORY.md`

---

## Related Documentation

### Essential Reading:
- **Prisma Schema**: `prisma/schema.prisma`
- **API Endpoint Docs**: `docs/api/` (in breederhq repo)
- **Media Storage Service**: `src/services/media-storage.ts`
- **S3 Client Config**: `src/services/s3-client.ts`

### Infrastructure:
- **AWS Environment Inventory**: `breederhq/docs/operations/infrastructure/AWS-ENVIRONMENT-INVENTORY.md`
- **S3 Architecture**: `breederhq/docs/operations/infrastructure/S3-PRESIGNED-URL-ARCHITECTURE.md`
- **Secrets Manager**: `breederhq/docs/operations/infrastructure/AWS-SECRETS-MANAGER.md`

### Frontend Context:
- **Frontend patterns**: `breederhq/docs/CLAUDE-CODE-CONTEXT.md`
- **Frontend expects pagination metadata** in this format

---

## Summary: The Golden Rules (Backend)

1. **🔒 Always check authentication** - Use `requireAuth` middleware
2. **🏢 Always filter by tenantId** - Prevent cross-tenant data leaks
3. **📄 Always paginate list endpoints** - Use `take` and `skip`
4. **✅ Always validate input** - Use Zod schemas
5. **🛡️ Always handle errors** - Try/catch with proper status codes
6. **🚫 Never return all records** - Always use pagination
7. **🚫 Never query in loops** - Use batch queries or includes
8. **🚫 Never trust user input** - Validate everything
9. **🚫 Never expose stack traces** - Catch and log, return generic errors
10. **📊 Always use indexes** - For filtered and sorted fields

---

**Last Updated**: 2026-01-21
**Maintained By**: Development Team
**Next Review**: After major API changes
