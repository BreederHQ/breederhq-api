# Legacy Identity Paths Cleanup Plan

**Date:** 2025-12-26
**Repository:** breederhq-api
**Branch:** dev
**Phase:** Post-Migration Cleanup (After Steps 5-7)

---

## Executive Summary

The Party migration (Steps 5-7) successfully introduced unified `partyId` references across all domains, replacing fragmented identity columns (`contactId`, `organizationId`, `buyerContactId`, `buyerOrganizationId`, `studOwnerContactId`, etc.).

**Current State:**
- ✅ Database schema has migrated to `partyId` fields (Steps 5-6)
- ✅ Step 7 constraints (NOT NULL) are in progress
- ⚠️ **Backend still contains legacy compatibility code** that derives old column values from Party relations
- ⚠️ **Frontend still expects legacy fields** in API responses
- ❌ **Legacy columns not yet physically dropped from database** (requires coordination)

**This cleanup focuses on:** Backend code cleanup - removing dual-write logic, compatibility mappings, and legacy field handling after frontend migration is complete.

---

## Inventory of Legacy Identity Columns

### Database Schema (Prisma)

All tables below have completed Step 6 party-only migration but may still have **database columns** that need dropping:

| Table | Legacy Columns | Current partyId Field | Status | Step |
|-------|---------------|---------------------|--------|------|
| **Contact** | `organizationId` | `partyId` (nullable) | Migrated | Step 4 |
| **User** | _(none)_ | `partyId` (nullable) | Migrated | Step 5 |
| **BreedingAttempt** | `studOwnerContactId` | `studOwnerPartyId` | Migrated | Step 5 |
| **PlanParty** | `contactId`, `organizationId` | `partyId` (NOT NULL in Step 7) | Migrated | Step 6F |
| **WaitlistEntry** | `contactId`, `organizationId`, `partyType` | `clientPartyId` (NOT NULL in Step 7) | Migrated | Step 6E |
| **OffspringGroupBuyer** | `contactId`, `organizationId` | `buyerPartyId` (NOT NULL in Step 7) | Migrated | Step 6C |
| **Offspring** | `buyerContactId`, `buyerOrganizationId`, `buyerPartyType` | `buyerPartyId` | Migrated | Step 6D |
| **Invoice** | `contactId`, `organizationId` | `clientPartyId` | Migrated | Step 6J |
| **ContractParty** | `contactId`, `organizationId`, `userId` (kept) | `partyId` (nullable) | Migrated | Step 6K |
| **OffspringContract** | `buyerContactId`, `buyerOrganizationId` | `buyerPartyId` (NOT NULL in Step 7) | Migrated | Step 6L |
| **TagAssignment** | `contactId`, `organizationId` | `taggedPartyId` | Migrated | Step 6B |
| **Attachment** | `contactId` | `attachmentPartyId` | Migrated | Step 6A |
| **Animal** | `buyerContactId`, `buyerOrganizationId` | `buyerPartyId` | Migrated | Step 6G |
| **AnimalOwner** | `contactId`, `organizationId`, `partyType` | `partyId` (NOT NULL in Step 7) | Migrated | Step 6H |

### Backend Code - Compatibility Mapping Functions

Located in `src/services/party-mapper.ts`:

1. **`partyToLegacyContactOrg(party)`** - Lines 165-174
   - Derives `{ contactId, organizationId }` from Party
   - Used by: WaitlistEntry, PlanParty, TagAssignment, Attachment, Invoice responses

2. **`partyToLegacyBuyerFields(party)`** - Lines 183-197
   - Derives `{ buyerContactId, buyerOrganizationId, buyerPartyType }` from Party
   - Used by: Animal buyer, OffspringContract buyer responses

3. **`partyToLegacyOwnerFields(party)`** - Lines 206-220
   - Derives `{ contactId, organizationId, partyType }` from Party
   - Used by: AnimalOwner responses

4. **`partyToLegacyStudOwnerContactId(party)`** - Lines 229-240
   - Derives `studOwnerContactId` from Party
   - Used by: BreedingAttempt responses

### Backend Code - Legacy Field Usage

Files reading/writing legacy fields (identified via grep):

| File | Purpose | Legacy Fields Used |
|------|---------|-------------------|
| `src/routes/offspring.ts` | Offspring API endpoints | `buyerContactId`, `buyerOrganizationId` |
| `src/routes/contacts.ts` | Contact/Organization APIs | `contactId`, `organizationId` |
| `src/routes/waitlist.ts` | Waitlist API endpoints | `contactId`, `organizationId` |
| `src/routes/breeding.ts` | Breeding plan APIs | `studOwnerContactId`, `organizationId` |
| `src/routes/animals.ts` | Animal APIs | `buyerContactId`, `buyerOrganizationId` |
| `src/routes/tags.ts` | Tag assignment APIs | `contactId`, `organizationId`, `animalId` |
| `src/services/party-resolver.ts` | Legacy field resolution | All legacy fields |
| `src/services/waitlist-mapping.ts` | Waitlist response mapping | `contactId`, `organizationId` |
| `src/services/tag-service.ts` | Tag service logic | `contactId`, `organizationId` |
| `src/services/finance/party-resolver-finance.ts` | Finance party resolution | `contactId`, `organizationId` |

### Frontend Code - DTOs Expecting Legacy Fields

Located in **breederhq** (frontend monorepo):

| Type/Interface | File | Legacy Fields |
|----------------|------|---------------|
| `ContactCore` | `packages/api/src/types/contacts.ts` | `organizationId` |
| `CreateContactInput` | `packages/api/src/types/contacts.ts` | `organizationId` |
| `OwnershipRow` | `packages/ui/src/utils/ownership.ts` | `contactId`, `organizationId` |
| `OwnerRow` | `apps/animals/src/api.ts` | `contactId`, `organizationId` |
| `AnimalLite` | `apps/offspring/src/api.ts` | `buyerContactId`, `buyerOrganizationId` |
| `WaitlistEntry` | `apps/offspring/src/api.ts` | `contactId`, `organizationId` |
| `CreateOffspringIndividualBody` | `apps/offspring/src/api.ts` | `buyerContactId`, `buyerOrganizationId` |
| `OffspringDTO` | `packages/api/src/types/offspring.ts` | `buyer_contact_id` |

---

## Cleanup Tasks by Domain

### Domain: Offspring

**Legacy Columns to Drop:**
- `Offspring.buyerContactId`
- `Offspring.buyerOrganizationId`
- `Offspring.buyerPartyType`

**Backend Code to Remove:**
1. `src/routes/offspring.ts`:
   - Remove input validation/parsing for `buyerContactId`, `buyerOrganizationId`
   - Remove `partyToLegacyBuyerFields()` calls in response mapping
   - Add validation to REJECT writes with legacy buyer fields

2. `src/services/party-mapper.ts`:
   - ❌ **DO NOT REMOVE YET** - Keep `partyToLegacyBuyerFields()` until frontend migrated
   - Mark with deprecation comment

**Frontend Code Dependencies:**
- `apps/offspring/src/api.ts` - Types expect legacy fields
- `apps/offspring/src/pages/OffspringPage.tsx` - Direct writes to legacy fields (lines 2551-2552, 2577-2578)

**Migration SQL:**
```sql
-- Step 6D: Drop Offspring legacy buyer columns
ALTER TABLE "Offspring" DROP COLUMN IF EXISTS "buyerContactId";
ALTER TABLE "Offspring" DROP COLUMN IF EXISTS "buyerOrganizationId";
ALTER TABLE "Offspring" DROP COLUMN IF EXISTS "buyerPartyType";

-- Drop legacy indexes if they exist
DROP INDEX IF EXISTS "Offspring_buyerContactId_idx";
DROP INDEX IF EXISTS "Offspring_buyerOrganizationId_idx";
```

**Validation:**
Run `prisma/sql/validate_step6_offspring_buyer_post.sql` to confirm cleanup.

---

### Domain: Waitlist

**Legacy Columns to Drop:**
- `WaitlistEntry.contactId`
- `WaitlistEntry.organizationId`
- `WaitlistEntry.partyType`

**Backend Code to Remove:**
1. `src/routes/waitlist.ts`:
   - Remove legacy field input handling
   - Remove `partyToLegacyContactOrg()` calls
   - Add guardrails to reject legacy field writes

2. `src/services/waitlist-mapping.ts`:
   - Remove mapping logic for legacy fields

**Frontend Code Dependencies:**
- `apps/offspring/src/api.ts` - `WaitlistEntry` type
- `apps/offspring/src/pages/WaitlistPage.tsx` - Reads legacy fields (lines 140-143)

**Migration SQL:**
```sql
-- Step 6E: Drop WaitlistEntry legacy columns
ALTER TABLE "WaitlistEntry" DROP COLUMN IF EXISTS "contactId";
ALTER TABLE "WaitlistEntry" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "WaitlistEntry" DROP COLUMN IF EXISTS "partyType";

-- Drop legacy indexes
DROP INDEX IF EXISTS "WaitlistEntry_contactId_idx";
DROP INDEX IF EXISTS "WaitlistEntry_organizationId_idx";
DROP INDEX IF EXISTS "WaitlistEntry_tenantId_contactId_idx";
DROP INDEX IF EXISTS "WaitlistEntry_tenantId_organizationId_idx";
```

**Validation:**
Run `prisma/sql/validate_step6_waitlist_post.sql`.

---

### Domain: OffspringGroupBuyer

**Legacy Columns to Drop:**
- `OffspringGroupBuyer.contactId`
- `OffspringGroupBuyer.organizationId`

**Backend Code to Remove:**
1. `src/routes/offspring.ts`:
   - Remove group buyer creation logic using legacy fields
   - Add validation to prevent legacy field writes

**Migration SQL:**
```sql
-- Step 6C: Drop OffspringGroupBuyer legacy columns
ALTER TABLE "OffspringGroupBuyer" DROP COLUMN IF EXISTS "contactId";
ALTER TABLE "OffspringGroupBuyer" DROP COLUMN IF EXISTS "organizationId";

-- Drop legacy indexes
DROP INDEX IF EXISTS "OffspringGroupBuyer_contactId_idx";
DROP INDEX IF EXISTS "OffspringGroupBuyer_organizationId_idx";
DROP INDEX IF EXISTS "OffspringGroupBuyer_tenantId_contactId_idx";
DROP INDEX IF EXISTS "OffspringGroupBuyer_tenantId_organizationId_idx";

-- Drop unique constraints (if exist)
DROP INDEX IF EXISTS "OffspringGroupBuyer_groupId_contactId_key";
DROP INDEX IF EXISTS "OffspringGroupBuyer_groupId_organizationId_key";
```

**Validation:**
Run `prisma/sql/validate_step6_offspring_group_buyer_post.sql`.

---

### Domain: PlanParty

**Legacy Columns to Drop:**
- `PlanParty.contactId`
- `PlanParty.organizationId`

**Backend Code to Remove:**
1. `src/routes/breeding.ts`:
   - Remove plan party creation/update logic using legacy fields
   - Stop deriving legacy fields in responses

**Migration SQL:**
```sql
-- Step 6F: Drop PlanParty legacy columns
ALTER TABLE "PlanParty" DROP COLUMN IF EXISTS "contactId";
ALTER TABLE "PlanParty" DROP COLUMN IF EXISTS "organizationId";

-- Drop legacy indexes
DROP INDEX IF EXISTS "PlanParty_contactId_idx";
DROP INDEX IF EXISTS "PlanParty_organizationId_idx";
```

**Validation:**
Run `prisma/sql/validate_step6f_planparty_post.sql`.

---

### Domain: Tags

**Legacy Columns to Drop:**
- `TagAssignment.contactId`
- `TagAssignment.organizationId`

**Backend Code to Remove:**
1. `src/routes/tags.ts`:
   - Remove tag assignment logic using `contactId`/`organizationId`
   - Use `taggedPartyId` exclusively

2. `src/services/tag-service.ts`:
   - Remove dual-field handling

**Migration SQL:**
```sql
-- Step 6B: Drop TagAssignment legacy columns
ALTER TABLE "TagAssignment" DROP COLUMN IF EXISTS "contactId";
ALTER TABLE "TagAssignment" DROP COLUMN IF EXISTS "organizationId";

-- Drop legacy unique constraints
DROP INDEX IF EXISTS "TagAssignment_tagId_contactId_key";
DROP INDEX IF EXISTS "TagAssignment_tagId_organizationId_key";

-- Drop legacy indexes
DROP INDEX IF EXISTS "TagAssignment_contactId_idx";
DROP INDEX IF EXISTS "TagAssignment_organizationId_idx";
DROP INDEX IF EXISTS "TagAssignment_tagId_contactId_idx";
DROP INDEX IF EXISTS "TagAssignment_tagId_organizationId_idx";
```

**Validation:**
Run `prisma/sql/validate_step6_tags_party_only_post.sql`.

---

### Domain: Attachments

**Legacy Columns to Drop:**
- `Attachment.contactId`

**Backend Code to Remove:**
1. Remove attachment creation logic using `contactId`
2. Use `attachmentPartyId` exclusively

**Migration SQL:**
```sql
-- Step 6A: Drop Attachment legacy contact column
ALTER TABLE "Attachment" DROP COLUMN IF EXISTS "contactId";

-- Drop legacy index
DROP INDEX IF EXISTS "Attachment_contactId_idx";
```

**Validation:**
Run `prisma/sql/validate_step6_attachments_party_only.sql`.

---

### Domain: Animals

**Legacy Columns to Drop:**
- `Animal.buyerContactId`
- `Animal.buyerOrganizationId`

**Backend Code to Remove:**
1. `src/routes/animals.ts`:
   - Remove buyer field input handling
   - Use `buyerPartyId` exclusively

**Migration SQL:**
```sql
-- Step 6G: Drop Animal buyer legacy columns
ALTER TABLE "Animal" DROP COLUMN IF EXISTS "buyerContactId";
ALTER TABLE "Animal" DROP COLUMN IF EXISTS "buyerOrganizationId";

-- Drop legacy indexes
DROP INDEX IF EXISTS "Animal_buyerContactId_idx";
DROP INDEX IF EXISTS "Animal_buyerOrganizationId_idx";
```

**Validation:**
Run `prisma/sql/validate_step6g_animal_post.sql`.

---

### Domain: AnimalOwner

**Legacy Columns to Drop:**
- `AnimalOwner.contactId`
- `AnimalOwner.organizationId`
- `AnimalOwner.partyType`

**Backend Code to Remove:**
1. `src/routes/animals.ts`:
   - Remove owner creation/update using legacy fields
   - Remove `partyToLegacyOwnerFields()` response mapping

**Frontend Code Dependencies:**
- `packages/ui/src/components/Ownership/OwnershipEditor.tsx` - Creates ownership with dual-write pattern (lines 114-131)

**Migration SQL:**
```sql
-- Step 6H: Drop AnimalOwner legacy columns
ALTER TABLE "AnimalOwner" DROP COLUMN IF EXISTS "contactId";
ALTER TABLE "AnimalOwner" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "AnimalOwner" DROP COLUMN IF EXISTS "partyType";

-- Drop legacy unique constraint
DROP INDEX IF EXISTS "AnimalOwner_animalId_contactId_key";
DROP INDEX IF EXISTS "AnimalOwner_animalId_organizationId_key";

-- Drop legacy indexes
DROP INDEX IF EXISTS "AnimalOwner_contactId_idx";
DROP INDEX IF EXISTS "AnimalOwner_organizationId_idx";
```

**Validation:**
Run `prisma/sql/validate_step6h_animalowner_post.sql`.

---

### Domain: BreedingAttempt

**Legacy Columns to Drop:**
- `BreedingAttempt.studOwnerContactId`

**Backend Code to Remove:**
1. `src/routes/breeding.ts`:
   - Remove `studOwnerContactId` input handling
   - Remove `partyToLegacyStudOwnerContactId()` response mapping

**Migration SQL:**
```sql
-- Step 6I: Drop BreedingAttempt legacy stud owner column
ALTER TABLE "BreedingAttempt" DROP COLUMN IF EXISTS "studOwnerContactId";

-- Drop legacy index
DROP INDEX IF EXISTS "BreedingAttempt_studOwnerContactId_idx";
```

**Validation:**
Run `prisma/sql/validate_step6i_breedingattempt_post.sql`.

---

### Domain: Invoice

**Legacy Columns to Drop:**
- `Invoice.contactId`
- `Invoice.organizationId`

**Backend Code to Remove:**
1. `src/services/finance/party-resolver-finance.ts`:
   - Remove legacy field resolution
   - Use `clientPartyId` exclusively

**Migration SQL:**
```sql
-- Step 6J: Drop Invoice legacy client columns
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "contactId";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "organizationId";

-- Drop legacy indexes
DROP INDEX IF EXISTS "Invoice_contactId_idx";
```

**Validation:**
Run `prisma/sql/validate_step6j_invoice_post.sql`.

---

### Domain: ContractParty

**Legacy Columns to Drop:**
- `ContractParty.contactId`
- `ContractParty.organizationId`
- Note: `userId` is intentionally KEPT (users can be contract parties without being full Party records)

**Backend Code to Remove:**
1. Remove contract party creation logic using `contactId`/`organizationId`
2. Use `partyId` or `userId` exclusively

**Migration SQL:**
```sql
-- Step 6K: Drop ContractParty legacy contact/org columns
ALTER TABLE "ContractParty" DROP COLUMN IF EXISTS "contactId";
ALTER TABLE "ContractParty" DROP COLUMN IF EXISTS "organizationId";

-- Drop legacy indexes
DROP INDEX IF EXISTS "ContractParty_contactId_idx";
DROP INDEX IF EXISTS "ContractParty_organizationId_idx";
```

**Validation:**
Run `prisma/sql/validate_step6k_contractparty_post.sql`.

---

### Domain: OffspringContract

**Legacy Columns to Drop:**
- `OffspringContract.buyerContactId`
- `OffspringContract.buyerOrganizationId`

**Backend Code to Remove:**
1. Remove contract buyer field handling in create/update
2. Remove `partyToLegacyBuyerFields()` response mapping

**Migration SQL:**
```sql
-- Step 6L: Drop OffspringContract legacy buyer columns
ALTER TABLE "OffspringContract" DROP COLUMN IF EXISTS "buyerContactId";
ALTER TABLE "OffspringContract" DROP COLUMN IF EXISTS "buyerOrganizationId";

-- Drop legacy indexes
DROP INDEX IF EXISTS "OffspringContract_buyerContactId_idx";
DROP INDEX IF EXISTS "OffspringContract_buyerOrganizationId_idx";
```

**Validation:**
Run `prisma/sql/validate_step6l_offspringcontract_post.sql`.

---

### Domain: User

**Legacy Columns to Drop:**
- _(None - User has no legacy identity columns)_

**Backend Code Review:**
- User already uses `partyId` (nullable) for profile party linking
- No cleanup needed for User table

**Validation:**
Run `prisma/sql/validate_step6m_user_post.sql` to confirm party-only state.

---

## Execution Strategy

### Phase 1: Preparation (Current)

**Objective:** Understand scope, identify dependencies, prepare cleanup plan.

✅ **Completed:**
- Comprehensive inventory of legacy columns
- Backend code usage analysis
- Frontend dependency mapping
- Validation script review

### Phase 2: Backend Code Cleanup (SAFE TO DO NOW)

**Objective:** Remove backend dual-write logic and add guardrails **without breaking frontend**.

**Critical Rule:** Keep compatibility mapping functions (`partyToLegacy*()`) until frontend is migrated.

**Tasks:**

1. **Add Runtime Guardrails** (src/routes/*.ts)
   - Reject API requests that attempt to **write** legacy fields
   - Return clear error messages: "Field 'contactId' is deprecated. Use Party-based endpoints."
   - Still **read** and map legacy fields in responses (for frontend compatibility)

2. **Remove Dual-Write Logic**
   - Stop writing to legacy columns in create/update operations
   - Use `partyId` exclusively for writes
   - Example:
     ```typescript
     // BEFORE (dual-write)
     const waitlist = await prisma.waitlistEntry.create({
       data: {
         clientPartyId: party.id,
         contactId: party.contact?.id,        // ❌ REMOVE
         organizationId: party.organization?.id  // ❌ REMOVE
       }
     });

     // AFTER (party-only write)
     const waitlist = await prisma.waitlistEntry.create({
       data: {
         clientPartyId: party.id  // ✅ ONLY THIS
       }
     });
     ```

3. **Keep Compatibility Mapping (DO NOT REMOVE YET)**
   - Keep all `partyToLegacy*()` functions in `party-mapper.ts`
   - Mark with deprecation comments
   - Continue mapping Party → legacy fields in GET responses
   - Example:
     ```typescript
     // Keep this until frontend migrated
     return {
       ...waitlist,
       clientPartyId: waitlist.clientPartyId,
       ...partyToLegacyContactOrg(waitlist.clientParty)  // ✅ KEEP for now
     };
     ```

**Deliverable:** Backend stops writing legacy columns but still returns them in responses.

### Phase 3: Frontend Migration (BLOCKED - Requires Coordination)

**Objective:** Update frontend to use `partyId` fields exclusively.

**Tasks:**

1. **Update Frontend DTOs** (breederhq/packages/api/src/types/)
   - Remove `contactId`, `organizationId` from type definitions
   - Add `partyId` fields
   - Update TypeScript compilation

2. **Update Frontend Components**
   - `OwnershipEditor.tsx`: Use `partyId` instead of contactId/organizationId
   - `OffspringPage.tsx`: Remove buyer legacy field writes
   - All read paths: Use `partyId` from API responses

3. **Update API Client Calls**
   - Stop sending `contactId`/`organizationId` in POST/PUT/PATCH
   - Send only `partyId`

**Deliverable:** Frontend exclusively uses Party-based fields.

### Phase 4: Database Column Removal (AFTER Frontend Migration)

**Objective:** Physically drop legacy columns from database.

**Critical Rule:** Only execute AFTER frontend fully migrated and deployed.

**Tasks:**

1. **Run Pre-Validation** (for each domain)
   ```bash
   # Example for Offspring
   psql $DATABASE_URL -f prisma/sql/validate_step6_offspring_buyer_pre.sql
   ```
   - Confirm 100% coverage: all rows have `partyId` populated
   - Confirm no orphaned Party references
   - Confirm no conflicts (both contactId AND organizationId set)

2. **Execute Migration** (one domain at a time)
   ```bash
   # Example for Offspring
   psql $DATABASE_URL <<EOF
   ALTER TABLE "Offspring" DROP COLUMN IF EXISTS "buyerContactId";
   ALTER TABLE "Offspring" DROP COLUMN IF EXISTS "buyerOrganizationId";
   ALTER TABLE "Offspring" DROP COLUMN IF EXISTS "buyerPartyType";
   DROP INDEX IF EXISTS "Offspring_buyerContactId_idx";
   DROP INDEX IF EXISTS "Offspring_buyerOrganizationId_idx";
   EOF
   ```

3. **Run Post-Validation**
   ```bash
   psql $DATABASE_URL -f prisma/sql/validate_step6_offspring_buyer_post.sql
   ```
   - Confirm legacy columns removed
   - Confirm `partyId` indexes exist
   - Confirm FK constraints in place

4. **Update Prisma Schema**
   - Already done (schema.prisma shows party-only fields)
   - Run `npx prisma generate` to refresh client

**Deliverable:** Database physically cleaned of legacy columns.

### Phase 5: Final Backend Cleanup (AFTER Database Cleanup)

**Objective:** Remove compatibility mapping code.

**Tasks:**

1. **Remove Compatibility Functions** (src/services/party-mapper.ts)
   - Delete `partyToLegacyContactOrg()`
   - Delete `partyToLegacyBuyerFields()`
   - Delete `partyToLegacyOwnerFields()`
   - Delete `partyToLegacyStudOwnerContactId()`

2. **Remove Legacy Field Mapping** (src/routes/*.ts)
   - Stop spreading `partyToLegacy*()` results in responses
   - Return only `partyId` fields

3. **Remove Legacy Type Definitions**
   - Clean up any backend types that reference legacy fields

**Deliverable:** Backend code completely clean of legacy field handling.

---

## Domain Execution Order (Recommended)

Execute in this order to minimize risk:

1. **Tags** (Step 6B) - Low risk, isolated domain
2. **Attachments** (Step 6A) - Low risk, simple change
3. **PlanParty** (Step 6F) - No public API endpoints
4. **OffspringGroupBuyer** (Step 6C) - Internal linking table
5. **WaitlistEntry** (Step 6E) - Medium risk, has API
6. **Offspring** (Step 6D) - High risk, core domain
7. **Animal** (Step 6G) - High risk, buyer fields
8. **AnimalOwner** (Step 6H) - High risk, ownership logic
9. **BreedingAttempt** (Step 6I) - Medium risk
10. **Invoice** (Step 6J) - Medium risk, finance domain
11. **ContractParty** (Step 6K) - Medium risk
12. **OffspringContract** (Step 6L) - Medium risk

---

## Runtime Guardrails Implementation

Add input validation to **reject** legacy field writes while **allowing** reads.

### Example: Offspring Buyer Validation

```typescript
// src/routes/offspring.ts

function validateOffspringInput(input: any) {
  const legacyFields = ['buyerContactId', 'buyerOrganizationId', 'buyerPartyType'];
  const found = legacyFields.filter(f => input[f] !== undefined);

  if (found.length > 0) {
    throw new Error(
      `Legacy buyer fields are no longer supported: ${found.join(', ')}. ` +
      `Use 'buyerPartyId' instead. See migration docs.`
    );
  }
}

// Apply to all create/update endpoints
app.post('/offspring', async (req, res) => {
  validateOffspringInput(req.body);  // ✅ Reject legacy writes

  const offspring = await prisma.offspring.create({
    data: {
      buyerPartyId: req.body.buyerPartyId  // ✅ Only accept partyId
    }
  });

  // ❌ DO NOT DO THIS (dual-write removed)
  // contactId: req.body.contactId

  return offspring;
});
```

### Example: WaitlistEntry Validation

```typescript
// src/routes/waitlist.ts

function validateWaitlistInput(input: any) {
  const legacyFields = ['contactId', 'organizationId', 'partyType'];
  const found = legacyFields.filter(f => input[f] !== undefined);

  if (found.length > 0) {
    throw new Error(
      `Legacy client fields are no longer supported: ${found.join(', ')}. ` +
      `Use 'clientPartyId' instead.`
    );
  }
}
```

### Example: Tag Assignment Validation

```typescript
// src/routes/tags.ts

function validateTagAssignmentInput(input: any) {
  const legacyFields = ['contactId', 'organizationId'];
  const found = legacyFields.filter(f => input[f] !== undefined);

  if (found.length > 0) {
    throw new Error(
      `Legacy tag assignment fields are no longer supported: ${found.join(', ')}. ` +
      `Use 'taggedPartyId' instead.`
    );
  }
}
```

---

## Testing & Validation

### Pre-Migration Validation Checklist

For each domain, before dropping columns:

- [ ] Run pre-migration validation SQL
- [ ] Confirm 100% `partyId` coverage (no NULL where required)
- [ ] Confirm no orphaned Party references
- [ ] Confirm no dual-assignment conflicts
- [ ] Confirm all Parties have backing entities (Contact or Organization)

### Post-Migration Validation Checklist

For each domain, after dropping columns:

- [ ] Run post-migration validation SQL
- [ ] Confirm legacy columns dropped
- [ ] Confirm legacy indexes dropped
- [ ] Confirm `partyId` indexes exist
- [ ] Confirm FK constraints in place
- [ ] Confirm data coverage (no data loss)
- [ ] Confirm Party type distribution matches expectations

### Backend Code Testing

- [ ] Unit tests pass for all modified endpoints
- [ ] Integration tests pass (with frontend mocked)
- [ ] Guardrails correctly reject legacy field writes
- [ ] Responses still include legacy fields (until Phase 5)
- [ ] No dual-write logic remains

### Frontend Testing (Phase 3)

- [ ] TypeScript compilation succeeds
- [ ] All components using Party fields
- [ ] No references to legacy contactId/organizationId
- [ ] API calls send only `partyId` fields
- [ ] E2E tests pass

---

## Rollback Plan

If issues arise during column drop:

1. **Stop immediately** - Do not proceed with additional domains
2. **Restore from backup** - Database columns can't be "un-dropped" without backups
3. **Revert Prisma schema** - Add back legacy columns if needed
4. **Run `npx prisma db push`** - Recreate columns (data will be lost!)
5. **Re-run backfill scripts** - Repopulate legacy columns from Party relations
6. **Investigate root cause** - Check validation queries for missed edge cases

**Critical:** Always take database backup before dropping columns.

---

## Success Criteria

### Phase 2 Success (Backend Cleanup)
- ✅ No backend code writes to legacy columns
- ✅ All write endpoints reject legacy field input
- ✅ Read endpoints still return legacy fields (for frontend compatibility)
- ✅ All backend tests pass

### Phase 3 Success (Frontend Migration)
- ✅ Frontend uses only `partyId` fields
- ✅ No frontend code references legacy fields
- ✅ TypeScript compilation succeeds
- ✅ E2E tests pass

### Phase 4 Success (Database Cleanup)
- ✅ All legacy columns physically dropped
- ✅ All legacy indexes dropped
- ✅ All validation queries pass
- ✅ No data loss (100% coverage)

### Phase 5 Success (Final Cleanup)
- ✅ No compatibility mapping code remains
- ✅ Backend responses return only `partyId` fields
- ✅ All backend tests pass
- ✅ System fully migrated to Party-only model

---

## Notes

1. **Frontend Coordination Required:** This cleanup CANNOT be completed unilaterally. Frontend must migrate first (or simultaneously with backend guardrails).

2. **Backward Compatibility Period:** The `partyToLegacy*()` functions in `party-mapper.ts` provide a compatibility bridge. They should remain until frontend is fully migrated.

3. **Database Column Drop is Irreversible:** Once columns are dropped, data is lost. Ensure 100% validation before proceeding.

4. **Validation Scripts Already Exist:** All Step 6 validation SQL scripts are already written and available in `prisma/sql/`.

5. **Migration is Domain-Isolated:** Each domain can be cleaned up independently. Start with low-risk domains (Tags, Attachments) to build confidence.

6. **Step 7 Constraints:** The Step 7 migration (making `partyId` NOT NULL) is already in progress. This cleanup builds on that work.

---

## References

- [VALIDATION_QUERIES_BREEDING.md](../VALIDATION_QUERIES_BREEDING.md)
- [VALIDATION_QUERIES_STEP6_*.md](../) (6 files)
- [TEST_PLAN_STEP6_*.md](../) (6 files)
- [prisma/sql/validate_step6*.sql](../prisma/sql/) (13 files)

---

**Next Action:** Decide on execution timeline and coordinate with frontend team for Phase 3 migration.
