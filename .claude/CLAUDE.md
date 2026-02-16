# Claude Code Instructions - Auto-Loaded Context (Backend API)

**Purpose**: Automatically loaded instructions for every Claude Code session
**Repository**: breederhq-api (Backend API)

---

## Session Start Acknowledgment

**At the start of every new session**, before responding to any user request, acknowledge that you have loaded these instructions by saying:

> "CLAUDE.md loaded for breederhq-api. Context docs imported. Key rules I will follow:
> - ALL queries MUST filter by tenantId (data leak risk otherwise)
> - ALL protected routes MUST use requireAuth middleware
> - ALL input MUST be validated with Zod schemas
> - ALL list endpoints MUST be paginated
> - No N+1 queries, no unbounded results
> - Media: Public images via `getPublicCdnUrl()`, private files via `generatePresignedDownloadUrl()`
> - Media: All S3 uploads MUST set `CacheControl: public, max-age=31536000, immutable`
> - TypeScript: Zero errors policy - I will run tsc and fix all errors before finishing"

This confirms the instructions are active and that Claude has read the imported documentation.

---

## Imported Documentation (auto-loaded into context)

@docs/CLAUDE-CODE-CONTEXT.md

---

## Key Reminders (Backend)

### ✅ Always:
- Filter by `tenantId` in ALL queries
- Use `requireAuth` middleware on protected routes
- Paginate list endpoints (`take` and `skip`)
- Validate input with Zod schemas
- Handle errors with try/catch
- Return pagination metadata (`page`, `limit`, `total`, `totalPages`)

### ❌ Never:
- Query without tenant filter (data leak risk!)
- Return all records (performance issue)
- Skip authentication checks (security issue)
- Trust user input directly (injection risk)
- Query in loops (N+1 performance issue)

---

## TypeScript Discipline (ENFORCED)

**Zero TypeScript errors policy. No exceptions.**

### After Every Code Change

After modifying or creating TypeScript files, **ALWAYS** verify compilation before considering the task complete:

```bash
npx tsc --noEmit
```

### Rules

1. **Fix errors immediately** - Do not defer, do not ask permission, just fix them
2. **Re-run until clean** - Keep fixing and re-checking until zero errors
3. **No implicit any** - All parameters and variables must be typed
4. **No @ts-ignore** - Find the real fix instead of suppressing errors
5. **No @ts-expect-error** - Unless absolutely necessary with a comment explaining why
6. **Handle nullability** - Use optional chaining (`?.`) and nullish coalescing (`??`)
7. **Type Prisma results** - Use generated Prisma types, don't cast to `any`

### Common Mistakes to Avoid

- Forgetting to import a type after using it
- Mismatched function signatures
- Missing properties on object literals
- Incorrect generic type parameters
- Using `any` instead of proper types
- Not handling `null | undefined` return types from Prisma
- Incorrect Express request/response typing

### Self-Review Before Finishing

Before marking any task complete, mentally verify:
- [ ] Did I run `tsc --noEmit`?
- [ ] Are there zero type errors?
- [ ] Did I import all necessary types?
- [ ] Are all function parameters typed?
- [ ] Did I handle null/undefined cases?

**Type errors are bugs, not warnings. A task is not complete until TypeScript compiles cleanly.**

---

## Before Starting Any Task

1. **Read the full context**: [docs/CLAUDE-CODE-CONTEXT.md](../docs/CLAUDE-CODE-CONTEXT.md)
2. **Search for patterns**: `grep -r "similar-endpoint" src/routes/`
3. **Check existing routes**: Look at similar endpoints in same module
4. **Verify auth**: All protected routes need `requireAuth` middleware

---

## Quick Reference

### List Endpoint Pattern
```typescript
app.get("/api/v1/resource", requireAuth, async (req, res) => {
  const tenantId = Number(req.headers["x-tenant-id"]);
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const where = { tenantId };

  const [data, total] = await Promise.all([
    prisma.resource.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.resource.count({ where }),
  ]);

  res.json({
    data,
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

### Get By ID Pattern
```typescript
app.get("/api/v1/resource/:id", requireAuth, async (req, res) => {
  const tenantId = Number(req.headers["x-tenant-id"]);
  const id = Number(req.params.id);

  const resource = await prisma.resource.findFirst({
    where: { id, tenantId }, // ← Always check tenant
  });

  if (!resource) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json(resource);
});
```

### Create Pattern
```typescript
const createSchema = z.object({
  name: z.string().min(1).max(100),
  // ... other fields
});

app.post("/api/v1/resource", requireAuth, async (req, res) => {
  const tenantId = Number(req.headers["x-tenant-id"]);

  try {
    const validated = createSchema.parse(req.body);

    const resource = await prisma.resource.create({
      data: {
        ...validated,
        tenantId, // ← Always include tenant
      },
    });

    res.status(201).json(resource);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});
```

---

## Security Checklist

Before submitting PR:
- [ ] All routes have `requireAuth` middleware
- [ ] All queries filter by `tenantId`
- [ ] All input is validated (Zod schemas)
- [ ] All errors are caught and handled
- [ ] No sensitive data in error messages

---

## Performance Checklist

Before submitting PR:
- [ ] List endpoints paginated
- [ ] No N+1 queries (use `include` or batch)
- [ ] Database indexes on filtered fields
- [ ] SELECT only needed fields

---

## PostgreSQL Enum Migrations (CRITICAL - DO NOT BREAK)

**PostgreSQL cannot use a new enum value in the same transaction that added it.**

Prisma's shadow database runs each migration file inside a single transaction. This means `ALTER TYPE ... ADD VALUE 'X'` followed by `UPDATE ... SET col = 'X'` in the same migration **will always fail**.

### FORBIDDEN Pattern

```sql
-- ❌ WILL FAIL in Prisma migrate (shadow DB runs in one transaction)
ALTER TYPE "MyEnum" ADD VALUE 'NEW_VAL';
UPDATE "MyTable" SET "col" = 'NEW_VAL' WHERE "col" = 'OLD_VAL';  -- ERROR: unsafe use of new value
```

### REQUIRED Pattern (text-conversion approach)

```sql
-- ✅ CORRECT - works in a single transaction
-- 1. Create new enum with desired values
CREATE TYPE "MyEnum_new" AS ENUM ('NEW_VAL', 'OTHER_VAL');

-- 2. Convert column to text
ALTER TABLE "MyTable" ALTER COLUMN "col" TYPE text USING ("col"::text);

-- 3. Remap old values to new values (safe - it's just text now)
UPDATE "MyTable" SET "col" = 'NEW_VAL' WHERE "col" = 'OLD_VAL';

-- 4. Cast to new enum
ALTER TABLE "MyTable" ALTER COLUMN "col" TYPE "MyEnum_new" USING ("col"::"MyEnum_new");

-- 5. Drop old, rename new
DROP TYPE "MyEnum";
ALTER TYPE "MyEnum_new" RENAME TO "MyEnum";
```

### When is ADD VALUE safe?

Only when **no other statement in the migration references the new value** — i.e., you're purely adding a new option with no data migration. Even then, prefer the text-conversion approach for consistency.

---

**Auto-loaded by Claude Code at session start**
**Last Updated**: 2026-02-15 (Added media storage/CDN patterns, AWS infrastructure references)
