# Legacy Identity Cleanup - Executive Summary

**Generated:** 2025-12-26
**Repository:** breederhq-api (backend) + breederhq (frontend)
**Branch:** dev

---

## TL;DR

✅ **Party migration (Steps 5-7) is complete** - Database uses `partyId` fields
⚠️ **Backend still writes AND reads legacy columns** - Dual-write logic active
⚠️ **Frontend still expects legacy fields** - DTOs depend on contactId/organizationId
❌ **Legacy database columns NOT YET DROPPED** - Physical cleanup pending

**Safe to do NOW:** Remove backend dual-write logic, add guardrails
**Requires coordination:** Frontend migration, database column drop

---

## What Needs Cleanup

### 14 Tables with Legacy Columns

| Table | Legacy Columns to Drop | Current State |
|-------|----------------------|---------------|
| Offspring | `buyerContactId`, `buyerOrganizationId`, `buyerPartyType` | Uses `buyerPartyId` |
| WaitlistEntry | `contactId`, `organizationId`, `partyType` | Uses `clientPartyId` (NOT NULL) |
| OffspringGroupBuyer | `contactId`, `organizationId` | Uses `buyerPartyId` (NOT NULL) |
| PlanParty | `contactId`, `organizationId` | Uses `partyId` (NOT NULL) |
| TagAssignment | `contactId`, `organizationId` | Uses `taggedPartyId` |
| Attachment | `contactId` | Uses `attachmentPartyId` |
| Animal | `buyerContactId`, `buyerOrganizationId` | Uses `buyerPartyId` |
| AnimalOwner | `contactId`, `organizationId`, `partyType` | Uses `partyId` (NOT NULL) |
| BreedingAttempt | `studOwnerContactId` | Uses `studOwnerPartyId` |
| Invoice | `contactId`, `organizationId` | Uses `clientPartyId` |
| ContractParty | `contactId`, `organizationId` | Uses `partyId` |
| OffspringContract | `buyerContactId`, `buyerOrganizationId` | Uses `buyerPartyId` (NOT NULL) |
| Contact | `organizationId` | Uses `partyId` |
| User | _(no legacy columns)_ | Uses `partyId` |

**Total legacy columns:** ~30+ columns across 13 tables

---

## What Code Needs Removal

### Backend (breederhq-api)

**Compatibility Mapping Functions** (`src/services/party-mapper.ts`):
- `partyToLegacyContactOrg()` - Derives contactId/organizationId from Party
- `partyToLegacyBuyerFields()` - Derives buyer fields from Party
- `partyToLegacyOwnerFields()` - Derives owner fields from Party
- `partyToLegacyStudOwnerContactId()` - Derives stud owner contact from Party

**Dual-Write Logic** (19 files - see full plan):
- `src/routes/offspring.ts` - Writes buyer legacy fields
- `src/routes/waitlist.ts` - Writes client legacy fields
- `src/routes/animals.ts` - Writes owner/buyer legacy fields
- `src/routes/breeding.ts` - Writes stud owner legacy fields
- `src/routes/tags.ts` - Writes tag assignment legacy fields
- `src/services/*` - Various party resolution logic

### Frontend (breederhq)

**Type Definitions** expecting legacy fields:
- `packages/api/src/types/contacts.ts` - ContactCore with `organizationId`
- `packages/ui/src/utils/ownership.ts` - OwnershipRow with contactId/organizationId
- `apps/offspring/src/api.ts` - Multiple types with buyer legacy fields
- `apps/animals/src/api.ts` - Owner types with legacy fields

**Components** using legacy fields:
- `apps/offspring/src/pages/OffspringPage.tsx` - Direct writes (lines 2551-2578)
- `packages/ui/src/components/Ownership/OwnershipEditor.tsx` - Dual-write pattern (lines 114-131)
- `apps/offspring/src/App-Offspring.tsx` - Buyer field reads
- 15+ other files

---

## Phased Cleanup Strategy

### Phase 1: ✅ Analysis Complete (NOW)

**Deliverables:**
- [LEGACY_IDENTITY_CLEANUP_PLAN.md](./LEGACY_IDENTITY_CLEANUP_PLAN.md) - Full cleanup plan
- This summary document

### Phase 2: Backend Code Cleanup (SAFE TO DO NOW)

**What:** Remove dual-write logic, add guardrails
**Why:** Stop writing legacy columns, prevent new legacy data
**Risk:** Low - doesn't break frontend (still returns legacy fields)

**Tasks:**
1. Add input validation to REJECT writes with legacy fields
2. Remove dual-write code (stop setting contactId/organizationId in creates/updates)
3. Keep `partyToLegacy*()` mapping (still derive legacy fields for GET responses)

**Example:**
```typescript
// BEFORE
await prisma.offspring.create({
  data: {
    buyerPartyId: partyId,
    buyerContactId: contactId,  // ❌ REMOVE THIS
    buyerOrganizationId: orgId  // ❌ REMOVE THIS
  }
});

// AFTER
await prisma.offspring.create({
  data: {
    buyerPartyId: partyId  // ✅ ONLY THIS
  }
});

// But still return legacy fields in responses (for frontend)
return {
  ...offspring,
  ...partyToLegacyBuyerFields(offspring.buyerParty)  // ✅ KEEP for now
};
```

**Outcome:** Backend stops creating new legacy data but API responses unchanged.

### Phase 3: Frontend Migration (REQUIRES COORDINATION)

**What:** Update frontend to use partyId exclusively
**Why:** Remove frontend dependency on legacy fields
**Risk:** High - breaks if not coordinated with backend

**Tasks:**
1. Update all DTOs to remove legacy fields, add `partyId`
2. Update `OwnershipEditor` to use `partyId` (not contactId/organizationId)
3. Update `OffspringPage` to stop writing buyer legacy fields
4. Update all API calls to send only `partyId`

**Coordination Required:**
- Backend must keep `partyToLegacy*()` mapping until frontend deployed
- Deploy frontend first, then remove backend mapping

### Phase 4: Database Column Drop (AFTER FRONTEND DEPLOYED)

**What:** Physically drop legacy columns from database
**Why:** Clean up schema, reclaim storage
**Risk:** HIGH - irreversible data loss if done prematurely

**Critical Rule:** ONLY after frontend fully migrated and deployed.

**Tasks for Each Domain:**
1. Run pre-validation SQL (confirm 100% partyId coverage)
2. **Take database backup**
3. Drop columns via `ALTER TABLE ... DROP COLUMN`
4. Run post-validation SQL (confirm cleanup)

**Domain Order (low to high risk):**
1. Tags → 2. Attachments → 3. PlanParty → 4. OffspringGroupBuyer → 5. Waitlist → 6. Offspring → 7. Animal → 8. AnimalOwner → 9. BreedingAttempt → 10. Invoice → 11. ContractParty → 12. OffspringContract

### Phase 5: Final Backend Cleanup (AFTER DATABASE CLEANUP)

**What:** Remove compatibility mapping code
**Why:** No longer needed after frontend migration
**Risk:** Low - only after all dependencies removed

**Tasks:**
1. Delete `partyToLegacy*()` functions
2. Stop spreading legacy fields in responses
3. Clean up type definitions

---

## What Can Be Done TODAY

### Immediate Actions (No Coordination Needed)

1. **Add Runtime Guardrails** ✅ SAFE

   Create validation functions to reject legacy field writes:

   ```typescript
   // src/routes/offspring.ts
   function validateOffspringInput(input: any) {
     const legacyFields = ['buyerContactId', 'buyerOrganizationId'];
     const found = legacyFields.filter(f => input[f] !== undefined);
     if (found.length > 0) {
       throw new Error(`Legacy fields no longer supported: ${found.join(', ')}`);
     }
   }
   ```

   Apply to all POST/PUT/PATCH endpoints across domains.

2. **Remove Dual-Write Logic** ✅ SAFE

   Stop writing legacy columns in create/update operations:

   ```typescript
   // Only write partyId, NOT contactId/organizationId
   await prisma.waitlistEntry.create({
     data: { clientPartyId: partyId }
     // Remove: contactId, organizationId
   });
   ```

3. **Mark Compatibility Functions as Deprecated** ✅ SAFE

   Add deprecation comments to `party-mapper.ts`:

   ```typescript
   /**
    * @deprecated Phase 2: Keep for frontend compatibility.
    * Remove in Phase 5 after frontend migration.
    */
   export function partyToLegacyContactOrg(party: any) {
     // ... existing code
   }
   ```

4. **Document Migration State** ✅ DONE

   - ✅ Created [LEGACY_IDENTITY_CLEANUP_PLAN.md](./LEGACY_IDENTITY_CLEANUP_PLAN.md)
   - ✅ Created this summary

### Impact of Immediate Actions

**What breaks:** Nothing - frontend still works
**What improves:**
- No new legacy data created in database
- Clear error messages when legacy fields used
- Prevents regression to dual-write pattern

---

## What Requires Coordination

### Frontend Team Dependency

**Cannot proceed with these until frontend migrated:**

❌ **Drop database columns** - Frontend still expects legacy fields in responses
❌ **Remove `partyToLegacy*()` functions** - Frontend still needs them
❌ **Stop returning legacy fields** - Frontend DTOs depend on them

**Coordination Plan:**

1. **Week 1:** Backend adds guardrails (Phase 2) ← CAN DO NOW
2. **Week 2-3:** Frontend migration (Phase 3) ← COORDINATE
3. **Week 4:** Deploy frontend, verify, then drop columns (Phase 4) ← RISKY
4. **Week 5:** Remove backend compatibility code (Phase 5) ← FINAL CLEANUP

---

## Validation Scripts (Already Available)

All validation SQL scripts already exist in `prisma/sql/`:

| Domain | Pre-Migration | Post-Migration |
|--------|--------------|----------------|
| Offspring | _(Step 5 validation)_ | `validate_step6_offspring_buyer_post.sql` |
| Waitlist | _(Step 5 validation)_ | `validate_step6_waitlist_post.sql` |
| OffspringGroupBuyer | _(Step 5 validation)_ | `validate_step6_offspring_group_buyer_post.sql` |
| PlanParty | _(Step 5 validation)_ | `validate_step6f_planparty_post.sql` |
| Tags | _(Step 5 validation)_ | `validate_step6_tags_party_only_post.sql` |
| Attachments | _(Step 5 validation)_ | `validate_step6_attachments_party_only.sql` |
| Animal | _(Step 5 validation)_ | `validate_step6g_animal_post.sql` |
| AnimalOwner | _(Step 5 validation)_ | `validate_step6h_animalowner_post.sql` |
| BreedingAttempt | _(Step 5 validation)_ | `validate_step6i_breedingattempt_post.sql` |
| Invoice | _(Step 5 validation)_ | `validate_step6j_invoice_post.sql` |
| ContractParty | _(Step 5 validation)_ | `validate_step6k_contractparty_post.sql` |
| OffspringContract | _(Step 5 validation)_ | `validate_step6l_offspringcontract_post.sql` |
| User | _(Step 5 validation)_ | `validate_step6m_user_post.sql` |

**Runtime Validation:**
- `validate_step6_party_only_runtime.sql` - Checks all domains at once

---

## Risk Assessment

### Low Risk (Can Do Now - Phase 2)
- ✅ Add input validation guardrails
- ✅ Remove dual-write logic
- ✅ Mark compatibility functions as deprecated

**Impact:** None - frontend still works, backend just stops creating new legacy data

### Medium Risk (Requires Coordination - Phase 3)
- ⚠️ Frontend migration to partyId fields
- ⚠️ Deploy frontend changes

**Impact:** If done wrong, frontend breaks; if done right, seamless transition

### High Risk (After Phase 3 - Phase 4)
- ⛔ Drop database columns
- ⛔ Remove compatibility mapping

**Impact:** Irreversible; if done too early, frontend breaks catastrophically

---

## Recommended Next Steps

### For Solo Backend Work (This Week)

1. **Implement Phase 2 guardrails** - Start with low-risk domains:
   - Tags (`src/routes/tags.ts`)
   - Attachments (minimal API surface)
   - PlanParty (no public API)

2. **Test guardrails:**
   - Verify legacy field writes are rejected
   - Verify GET responses still include legacy fields
   - Run backend integration tests

3. **Document backend changes:**
   - Update API docs to deprecate legacy fields
   - Add migration guide for API consumers

### For Coordinated Work (Next Sprint)

1. **Schedule frontend migration sprint**
2. **Prioritize high-impact domains:**
   - Offspring (most complex)
   - AnimalOwner (ownership logic)
   - Waitlist (buyer flow)

3. **Plan deployment:**
   - Deploy backend guardrails first (Phase 2)
   - Deploy frontend migration second (Phase 3)
   - Drop columns third (Phase 4)
   - Remove compatibility code fourth (Phase 5)

---

## Files Created

1. **[LEGACY_IDENTITY_CLEANUP_PLAN.md](./LEGACY_IDENTITY_CLEANUP_PLAN.md)** - Complete cleanup plan (84KB, ~2000 lines)
   - Full inventory of legacy columns
   - Domain-by-domain cleanup tasks
   - SQL migration scripts
   - Testing & validation checklists

2. **[CLEANUP_SUMMARY.md](./CLEANUP_SUMMARY.md)** (this file) - Executive summary
   - TL;DR of cleanup scope
   - What can be done now vs. later
   - Risk assessment
   - Recommended next steps

---

## Questions?

See the full [LEGACY_IDENTITY_CLEANUP_PLAN.md](./LEGACY_IDENTITY_CLEANUP_PLAN.md) for:
- Detailed code examples
- SQL migration scripts
- Validation procedures
- Rollback plans
- Domain-specific guidance
