# CLAUDE.md - BreederHQ API (Backend)

## Project Overview

BreederHQ API is the backend system of record for the BreederHQ platform. It is **not a thin CRUD layer** - it owns lifecycle rules, permissions, auditability, and deterministic biological calculations.

### Tech Stack
- **Runtime:** Node.js + TypeScript
- **Framework:** Fastify
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Deployment:** Render (API), migrations promoted Dev → Stage → Prod

### Related Repos (in workspace)
- **breederhq** - Frontend React apps (sibling folder). Consumes this API via `packages/api` SDK.
- **bhq-mock** - Legacy mock server (Archive)

---

## Core Responsibilities

The API is responsible for:

1. **Single source of truth** for all persistent data
2. **Enforcing business rules** consistently across all clients
3. **Computing breeding timelines** and locking biological outcomes
4. **Enforcing permissions** and tenancy boundaries
5. **Writing audit logs** for sensitive mutations
6. **Providing stable, version-tolerant contracts** to the UI

> **The API must never rely on frontend-derived data for authoritative outcomes.**

---

## File Structure

```
breederhq-api/
├── src/
│   ├── server.ts              # Fastify app entry point
│   ├── prisma.ts              # Prisma client instance
│   ├── routes/                # Route handlers by domain
│   │   ├── account.ts
│   │   ├── animals.ts
│   │   ├── auth.ts
│   │   ├── breeding.ts
│   │   ├── breeds.ts
│   │   ├── contacts.ts
│   │   ├── offspring.ts
│   │   ├── organizations.ts
│   │   ├── session.ts
│   │   ├── tags.ts
│   │   ├── tenant.ts
│   │   ├── user.ts
│   │   └── waitlist.ts
│   └── validation/
│       └── schemas.ts         # Input validation schemas
│
├── prisma/
│   ├── schema.prisma          # Database schema (SOURCE OF TRUTH)
│   ├── migrations/            # Migration history (promoted Dev → Stage → Prod)
│   ├── migrations.bak/        # Backup migrations
│   ├── seed/                  # Seed scripts
│   │   ├── seed-breeds-json.ts
│   │   ├── seed-env-bootstrap.ts
│   │   ├── seed-registries.ts
│   │   └── data/              # Seed data files
│   │       ├── cats.json
│   │       ├── dogs.json
│   │       └── horses.json
│   └── sql/
│       └── purge-breeds.sql
│
├── dist/                      # Compiled output
│
└── [Config]
    ├── package.json
    ├── tsconfig.json
    ├── prisma.config.ts
    └── .env files (.env, .env.dev, .env.prod.migrate, etc.)
```

---

## Domain Modules

### Contacts
People and organizations (buyers, co-owners, vets, handlers).

- CRUD operations
- Relationship mapping
- Tagging and custom fields
- Document association
- Referenced by: Animals, Offspring, Finance, Marketing

### Animals
Individual animals owned or tracked.

**Core fields:** species, sex, name, DOB, owners, tags, documents, status

**Reproductive data (females):**
- `repro[]` - reproduction history (heat starts, cycle markers)
- Heat start dates are the **canonical raw input** for cycle math

**Referenced by:** Breeding plans, Offspring, Finance

> The API must guarantee reproduction history is consistent and ordered.

### Breeding (MOST COMPLEX DOMAIN)

**Key entities:**
- `BreedingPlan` - links dam + optional sire
- `ReproductiveCycle`
- `LockedCycle` - snapshot of computed milestones

**Plan statuses:** `DRAFT` → `COMMITTED` → `COMPLETED`

**Critical concept - Locked Cycle:**
```
When a plan is COMMITTED, the expected milestones are LOCKED:
- cycleStart
- ovulation
- breeding window
- due date
- puppy care window
- go home dates

These are STORED, not recomputed. This protects historical accuracy
even if biological rules change later.
```

**The API must own:**
- Validation of cycle start inputs
- Computation of expected milestones
- Locking behavior
- Status transitions
- Protection against invalid edits post-lock

> Frontend may visualize or project, but **backend is authoritative**.

### Offspring
Animals produced by a breeding plan.

- Group-level and individual records
- Collar colors/identifiers
- Placement status and buyer association
- Go-home tracking

> Offspring timing must align with locked plan data.

### Finance
Money related to breeding operations.

- Deposits linked to plans/offspring
- Fees and rollups
- Risk scoring
- Auditability required

### Documents
Uploaded or generated documents.

- Metadata in DB, contents may be external
- Ownership and permissions

### Audit Logs
**Mandatory for:**
- Breeding plan commits
- Cycle locks
- Financial changes
- Ownership changes

---

## Breeding Timeline & Biology Rules

Biological defaults are **species-specific**:
- Cycle length defaults
- Ovulation offset from heat start
- Gestation length
- Puppy care duration

**The API must:**
1. Centralize these rules
2. Apply them deterministically
3. Store computed results at lock time

**Endpoints should:**
- Compute expected milestones from inputs
- Return full windows AND most-likely sub-windows
- Support calendar and Gantt rendering

---

## Security Model

### Authentication
- All protected routes require auth
- JWT or session-based

### Authorization
- Resource-level permissions
- Organization/kennel-level boundaries (tenancy)
- Explicit checks per route

> **The API must never trust the frontend to enforce permissions.**

---

## API Design Conventions

### General
- JSON only
- Clear success/error shapes
- Stable field names
- Backwards-compatible changes preferred

### Errors
- Always structured: `{ code, message }`
- No raw stack traces to clients

### Lists
- Support pagination
- Support filtering/sorting via query params

### IDs
- Numeric internally
- Treated as opaque at boundaries

---

## Database Rules

### Prisma Discipline
- Prisma is the **only** DB access layer
- No raw SQL unless justified
- All schema changes via migrations
- No silent schema drift

### Migration Flow
```
Local → Dev → Stage → Prod
```

### Immutability Rules (ENFORCED STRICTLY)
- Locked cycles **cannot be edited**
- Completed plans **cannot be modified**
- Financial records **cannot be silently overwritten**

---

## Route Organization

Routes grouped by domain in `src/routes/`:

| File | Domain |
|------|--------|
| `animals.ts` | Animal CRUD, repro history |
| `breeding.ts` | Plans, cycles, locking |
| `contacts.ts` | Contact CRUD |
| `offspring.ts` | Offspring records |
| `breeds.ts` | Breed lookup/management |
| `auth.ts` | Authentication |
| `session.ts` | Session management |
| `account.ts` | Account management |
| `user.ts` | User profile |
| `tenant.ts` | Tenant/org settings |
| `organizations.ts` | Org management |
| `tags.ts` | Tagging system |
| `waitlist.ts` | Waitlist feature |

**Pattern:**
- Route file registers Fastify routes
- Validates inputs (using `validation/schemas.ts`)
- Calls domain logic
- Writes audit logs when needed

> Business logic should NOT live inline in route handlers.

---

## Frontend Integration

The frontend (`breederhq`) consumes this API via:
- `packages/api/src/http.ts` - HTTP client
- `packages/api/src/resources/` - Typed resource modules
- `packages/api/src/types/` - Shared TypeScript types

### Key Integration Points

| Frontend Need | API Responsibility |
|---------------|-------------------|
| Plans table columns | Return `lockedCycle.*` and `expected_*` fields |
| Calendar windows | Compute and return full + likely windows |
| Gantt visualization | Return stage windows with dates |
| Animals list | Return with repro history for females |

---

## Long-Term Direction

The API is expected to:
1. Move more breeding math server-side (in progress)
2. Expose authoritative projection endpoints
3. Support notifications and background jobs
4. Integrate with payments/accounting platforms

> Frontend should increasingly consume computed outcomes, not derive them.

---

## Sacred Rules

When working on this codebase, treat these as **inviolable**:

1. **Locked cycles are immutable** - never allow edits
2. **Backend is authoritative** - frontend visualizes, backend decides
3. **Audit everything sensitive** - commits, locks, money, ownership
4. **Permissions are server-enforced** - never trust the client
5. **Migrations flow one direction** - Dev → Stage → Prod
6. **Biology rules are deterministic** - same inputs = same outputs, forever
