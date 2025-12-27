# Phase 2: Backend Cleanup Checklist

**Safe to execute NOW - No frontend coordination required**

---

## Overview

This phase removes dual-write logic and adds guardrails **without breaking the frontend**.

**Key Principle:** Backend stops WRITING legacy columns but still READS and RETURNS them for backward compatibility.

---

## Domain-by-Domain Checklist

### ✅ Tags (Low Risk - Start Here)

**File:** `src/routes/tags.ts`

- [ ] Add input validation function:
  ```typescript
  function validateTagAssignmentInput(input: any) {
    const legacyFields = ['contactId', 'organizationId', 'animalId'];
    const found = legacyFields.filter(f => input[f] !== undefined && f !== 'animalId');
    if (found.length > 0) {
      throw new Error(`Legacy tag fields no longer supported: ${found.join(', ')}. Use 'taggedPartyId' for Contact/Organization tags.`);
    }
  }
  ```

- [ ] Apply validation to tag assignment endpoints:
  - `POST /tags/:tagId/assign`
  - `DELETE /tags/:tagId/assign`

- [ ] Remove dual-write in tag assignment:
  ```typescript
  // BEFORE
  await prisma.tagAssignment.create({
    data: {
      tagId,
      contactId: input.contactId,      // ❌ REMOVE
      organizationId: input.organizationId,  // ❌ REMOVE
      taggedPartyId: input.taggedPartyId  // ✅ KEEP
    }
  });

  // AFTER
  await prisma.tagAssignment.create({
    data: {
      tagId,
      taggedPartyId: input.taggedPartyId  // ✅ ONLY THIS
    }
  });
  ```

- [ ] Keep response mapping:
  ```typescript
  // Still return legacy fields for frontend
  return {
    ...tagAssignment,
    ...partyToLegacyContactOrg(tagAssignment.taggedParty)
  };
  ```

- [ ] Test:
  - [ ] Attempting to create tag with `contactId` returns error
  - [ ] Creating tag with `taggedPartyId` succeeds
  - [ ] GET responses still include `contactId`/`organizationId`

---

### ✅ Attachments (Low Risk)

**File:** `src/routes/*` (wherever attachments are created)

- [ ] Add validation (if attachments accept contactId):
  ```typescript
  function validateAttachmentInput(input: any) {
    if (input.contactId !== undefined) {
      throw new Error('Legacy field contactId no longer supported. Use attachmentPartyId.');
    }
  }
  ```

- [ ] Remove dual-write:
  ```typescript
  await prisma.attachment.create({
    data: {
      attachmentPartyId: input.attachmentPartyId  // ✅ ONLY THIS
      // Remove: contactId
    }
  });
  ```

- [ ] Keep response mapping if needed

---

### ✅ PlanParty (Low Risk - No Public API)

**File:** `src/routes/breeding.ts`

- [ ] Add validation:
  ```typescript
  function validatePlanPartyInput(input: any) {
    const legacyFields = ['contactId', 'organizationId'];
    const found = legacyFields.filter(f => input[f] !== undefined);
    if (found.length > 0) {
      throw new Error(`Legacy party fields no longer supported: ${found.join(', ')}. Use 'partyId'.`);
    }
  }
  ```

- [ ] Remove dual-write in plan party creation/update
- [ ] Keep response mapping

---

### ⚠️ Offspring (Medium Risk - Core Domain)

**File:** `src/routes/offspring.ts`

- [ ] Add validation:
  ```typescript
  function validateOffspringBuyerInput(input: any) {
    const legacyFields = ['buyerContactId', 'buyerOrganizationId', 'buyerPartyType'];
    const found = legacyFields.filter(f => input[f] !== undefined);
    if (found.length > 0) {
      throw new Error(`Legacy buyer fields no longer supported: ${found.join(', ')}. Use 'buyerPartyId'.`);
    }
  }
  ```

- [ ] Apply to endpoints:
  - `POST /offspring`
  - `PUT /offspring/:id`
  - `PATCH /offspring/:id`

- [ ] Remove dual-write:
  ```typescript
  // Only write buyerPartyId, not legacy fields
  await prisma.offspring.create({
    data: {
      buyerPartyId: input.buyerPartyId  // ✅ ONLY THIS
      // Remove: buyerContactId, buyerOrganizationId, buyerPartyType
    }
  });
  ```

- [ ] Keep response mapping:
  ```typescript
  return {
    ...offspring,
    ...partyToLegacyBuyerFields(offspring.buyerParty)  // ✅ KEEP for now
  };
  ```

- [ ] Test thoroughly - this is a core domain

---

### ⚠️ WaitlistEntry (Medium Risk)

**File:** `src/routes/waitlist.ts`

- [ ] Add validation:
  ```typescript
  function validateWaitlistClientInput(input: any) {
    const legacyFields = ['contactId', 'organizationId', 'partyType'];
    const found = legacyFields.filter(f => input[f] !== undefined);
    if (found.length > 0) {
      throw new Error(`Legacy client fields no longer supported: ${found.join(', ')}. Use 'clientPartyId'.`);
    }
  }
  ```

- [ ] Remove dual-write:
  ```typescript
  await prisma.waitlistEntry.create({
    data: {
      clientPartyId: input.clientPartyId  // ✅ ONLY THIS
      // Remove: contactId, organizationId, partyType
    }
  });
  ```

- [ ] Keep response mapping:
  ```typescript
  return {
    ...waitlist,
    ...partyToLegacyContactOrg(waitlist.clientParty)
  };
  ```

---

### ⚠️ OffspringGroupBuyer (Medium Risk)

**File:** `src/routes/offspring.ts`

- [ ] Add validation for group buyer endpoints
- [ ] Remove dual-write logic
- [ ] Keep response mapping

---

### ⚠️ Animal (Medium Risk - Buyer Fields)

**File:** `src/routes/animals.ts`

- [ ] Add validation:
  ```typescript
  function validateAnimalBuyerInput(input: any) {
    const legacyFields = ['buyerContactId', 'buyerOrganizationId'];
    const found = legacyFields.filter(f => input[f] !== undefined);
    if (found.length > 0) {
      throw new Error(`Legacy buyer fields no longer supported: ${found.join(', ')}. Use 'buyerPartyId'.`);
    }
  }
  ```

- [ ] Remove dual-write
- [ ] Keep response mapping

---

### ⚠️ AnimalOwner (High Risk - Ownership Logic)

**File:** `src/routes/animals.ts`

- [ ] Add validation:
  ```typescript
  function validateOwnerInput(input: any) {
    const legacyFields = ['contactId', 'organizationId', 'partyType'];
    const found = legacyFields.filter(f => input[f] !== undefined);
    if (found.length > 0) {
      throw new Error(`Legacy owner fields no longer supported: ${found.join(', ')}. Use 'partyId'.`);
    }
  }
  ```

- [ ] Remove dual-write in owner create/update
- [ ] Keep response mapping:
  ```typescript
  return {
    ...owner,
    ...partyToLegacyOwnerFields(owner.party)
  };
  ```

---

### ⚠️ BreedingAttempt (Medium Risk)

**File:** `src/routes/breeding.ts`

- [ ] Add validation:
  ```typescript
  function validateBreedingAttemptInput(input: any) {
    if (input.studOwnerContactId !== undefined) {
      throw new Error('Legacy field studOwnerContactId no longer supported. Use studOwnerPartyId.');
    }
  }
  ```

- [ ] Remove dual-write
- [ ] Keep response mapping:
  ```typescript
  return {
    ...attempt,
    studOwnerContactId: partyToLegacyStudOwnerContactId(attempt.studOwnerParty)
  };
  ```

---

### ⚠️ Invoice (Medium Risk)

**File:** `src/routes/*` (invoice endpoints)

- [ ] Add validation:
  ```typescript
  function validateInvoiceClientInput(input: any) {
    const legacyFields = ['contactId', 'organizationId'];
    const found = legacyFields.filter(f => input[f] !== undefined);
    if (found.length > 0) {
      throw new Error(`Legacy client fields no longer supported: ${found.join(', ')}. Use 'clientPartyId'.`);
    }
  }
  ```

- [ ] Remove dual-write
- [ ] Keep response mapping

---

### ⚠️ ContractParty (Medium Risk)

**File:** Contract-related routes

- [ ] Add validation
- [ ] Remove dual-write
- [ ] Keep response mapping
- [ ] Note: `userId` field is intentionally kept (users can be contract parties)

---

### ⚠️ OffspringContract (Medium Risk)

**File:** Contract endpoints

- [ ] Add validation for buyer fields
- [ ] Remove dual-write
- [ ] Keep response mapping

---

## Code Maintenance Tasks

### Mark Compatibility Functions as Deprecated

**File:** `src/services/party-mapper.ts`

Add JSDoc comments to all `partyToLegacy*()` functions:

```typescript
/**
 * @deprecated Phase 2: Backend dual-write removed, but frontend still expects these fields.
 * This function derives legacy contactId/organizationId from Party for backward compatibility.
 * TODO: Remove in Phase 5 after frontend migration (see LEGACY_IDENTITY_CLEANUP_PLAN.md)
 */
export function partyToLegacyContactOrg(party: any): { contactId: number | null; organizationId: number | null } {
  // ... existing code
}

/**
 * @deprecated Phase 2: Backend dual-write removed, but frontend still expects these fields.
 * This function derives legacy buyer fields from Party for backward compatibility.
 * TODO: Remove in Phase 5 after frontend migration (see LEGACY_IDENTITY_CLEANUP_PLAN.md)
 */
export function partyToLegacyBuyerFields(party: any) {
  // ... existing code
}

/**
 * @deprecated Phase 2: Backend dual-write removed, but frontend still expects these fields.
 * This function derives legacy owner fields from Party for backward compatibility.
 * TODO: Remove in Phase 5 after frontend migration (see LEGACY_IDENTITY_CLEANUP_PLAN.md)
 */
export function partyToLegacyOwnerFields(party: any) {
  // ... existing code
}

/**
 * @deprecated Phase 2: Backend dual-write removed, but frontend still expects this field.
 * This function derives studOwnerContactId from Party for backward compatibility.
 * TODO: Remove in Phase 5 after frontend migration (see LEGACY_IDENTITY_CLEANUP_PLAN.md)
 */
export function partyToLegacyStudOwnerContactId(party: any): number | null {
  // ... existing code
}
```

---

## Testing Checklist

### Unit Tests

For each modified endpoint:

- [ ] Test with `partyId` input succeeds
- [ ] Test with legacy field input returns 400 error
- [ ] Test error message is clear and helpful
- [ ] Test GET response still includes legacy fields

### Integration Tests

- [ ] Create tag assignment with `taggedPartyId` works
- [ ] Create waitlist entry with `clientPartyId` works
- [ ] Create offspring with `buyerPartyId` works
- [ ] Create animal owner with `partyId` works
- [ ] All GET endpoints return both `partyId` AND legacy fields

### Regression Tests

- [ ] Existing frontend still works (no breaking changes)
- [ ] All backend tests pass
- [ ] No performance degradation

---

## Validation

### Runtime Validation

Run the comprehensive validation script:

```bash
cd ../breederhq-api
psql $DATABASE_URL -f prisma/sql/validate_step6_party_only_runtime.sql
```

Expected results:
- All tables should show 100% `partyId` coverage (or NULL where appropriate)
- No orphaned Party references
- No conflicts (both contactId AND organizationId set)

### Code Review Checklist

- [ ] No code writes to legacy columns (contactId, organizationId, etc.)
- [ ] All POST/PUT/PATCH endpoints have input validation
- [ ] All GET endpoints still return legacy fields
- [ ] `partyToLegacy*()` functions marked as deprecated
- [ ] Error messages are clear and reference migration docs

---

## Commit Message

```
feat(cleanup): Phase 2 - Remove legacy identity dual-write logic

- Add input validation to reject legacy field writes (contactId, organizationId, etc.)
- Remove dual-write logic across all domains (Tags, Waitlist, Offspring, Animals, etc.)
- Keep compatibility mapping for GET responses (frontend still expects legacy fields)
- Mark partyToLegacy*() functions as deprecated (remove in Phase 5)

BREAKING: API no longer accepts legacy identity fields in POST/PUT/PATCH requests.
Clients must use partyId, clientPartyId, buyerPartyId, etc. instead.

GET responses unchanged - still include legacy fields for backward compatibility.

See LEGACY_IDENTITY_CLEANUP_PLAN.md for migration roadmap.

Refs: Steps 6A-6M, Phase 2 (Backend Cleanup)
```

---

## Rollback Plan

If issues arise:

1. **Revert commit:** `git revert HEAD`
2. **Deploy rollback immediately**
3. **Investigate:** Check which legacy fields are still being used
4. **Fix:** Either add exception or update caller to use partyId

---

## Next Steps After Phase 2

1. **Deploy Phase 2 changes** to dev/staging
2. **Monitor error logs** for legacy field usage
3. **Notify frontend team** that legacy writes are now blocked
4. **Coordinate Phase 3** (frontend migration)

---

## Estimated Effort

- **Tags, Attachments, PlanParty:** 1-2 hours each
- **Offspring, Waitlist, Animals, AnimalOwner:** 2-4 hours each
- **BreedingAttempt, Invoice, Contracts:** 1-2 hours each
- **Testing & validation:** 4-6 hours
- **Total:** 2-3 days of focused work

---

## Success Criteria

✅ **Phase 2 Complete When:**
- All write endpoints reject legacy field input
- No backend code writes to legacy columns
- All GET responses still include legacy fields
- All tests pass
- No regressions observed in staging
