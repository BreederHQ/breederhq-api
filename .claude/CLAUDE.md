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
> - No N+1 queries, no unbounded results"

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

**Auto-loaded by Claude Code at session start**
