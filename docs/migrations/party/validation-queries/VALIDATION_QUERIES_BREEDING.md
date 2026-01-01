# Validation Queries: Breeding Domain Party Migration (Step 5)

**Migration:** `20251224_party_step5_breeding_party`
**Date:** 2024-12-24
**Scope:** Breeding domain party-like references

---

## Overview

This document provides SQL validation queries to verify the success of the Breeding domain Party migration (Step 5). These queries check:
1. Backfill completeness for each new partyId field
2. Data integrity and FK consistency
3. Conflict detection (rows with both Contact and Organization IDs set)
4. Index existence
5. Unresolvable legacy IDs

---

## 1. Backfill Completeness Checks

### 1.1 BreedingAttempt - studOwnerPartyId

```sql
-- Count rows by backfill status
SELECT
  COUNT(*) FILTER (WHERE "studOwnerContactId" IS NOT NULL AND "studOwnerPartyId" IS NOT NULL) as backfilled,
  COUNT(*) FILTER (WHERE "studOwnerContactId" IS NOT NULL AND "studOwnerPartyId" IS NULL) as missing_party_id,
  COUNT(*) FILTER (WHERE "studOwnerContactId" IS NULL AND "studOwnerPartyId" IS NULL) as no_stud_owner,
  COUNT(*) as total
FROM "BreedingAttempt";
```

**Expected:** `missing_party_id` should be 0 if all Contacts have valid partyId values.

### 1.2 PlanParty - partyId

```sql
-- Count rows by backfill status
SELECT
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL AND "partyId" IS NOT NULL) as contact_backfilled,
  COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL AND "partyId" IS NOT NULL) as org_backfilled,
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL AND "partyId" IS NULL) as contact_missing_party,
  COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL AND "partyId" IS NULL) as org_missing_party,
  COUNT(*) FILTER (WHERE "contactId" IS NULL AND "organizationId" IS NULL AND "partyId" IS NULL) as no_party,
  COUNT(*) as total
FROM "PlanParty";
```

**Expected:** Both `contact_missing_party` and `org_missing_party` should be 0.

### 1.3 WaitlistEntry - clientPartyId

```sql
-- Count rows by backfill status
SELECT
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL AND "clientPartyId" IS NOT NULL) as contact_backfilled,
  COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL AND "clientPartyId" IS NOT NULL) as org_backfilled,
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL AND "clientPartyId" IS NULL) as contact_missing_party,
  COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL AND "clientPartyId" IS NULL) as org_missing_party,
  COUNT(*) FILTER (WHERE "contactId" IS NULL AND "organizationId" IS NULL AND "clientPartyId" IS NULL) as no_client,
  COUNT(*) as total
FROM "WaitlistEntry";
```

**Expected:** `contact_missing_party` and `org_missing_party` should be 0.

### 1.4 OffspringGroupBuyer - buyerPartyId

```sql
-- Count rows by backfill status
SELECT
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL AND "buyerPartyId" IS NOT NULL) as contact_backfilled,
  COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL AND "buyerPartyId" IS NOT NULL) as org_backfilled,
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL AND "buyerPartyId" IS NULL) as contact_missing_party,
  COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL AND "buyerPartyId" IS NULL) as org_missing_party,
  COUNT(*) FILTER (WHERE "contactId" IS NULL AND "organizationId" IS NULL AND "buyerPartyId" IS NULL) as no_buyer,
  COUNT(*) as total
FROM "OffspringGroupBuyer";
```

**Expected:** `contact_missing_party` and `org_missing_party` should be 0.

### 1.5 Offspring - buyerPartyId

```sql
-- Count rows by backfill status
SELECT
  COUNT(*) FILTER (WHERE "buyerContactId" IS NOT NULL AND "buyerPartyId" IS NOT NULL) as contact_backfilled,
  COUNT(*) FILTER (WHERE "buyerOrganizationId" IS NOT NULL AND "buyerPartyId" IS NOT NULL) as org_backfilled,
  COUNT(*) FILTER (WHERE "buyerContactId" IS NOT NULL AND "buyerPartyId" IS NULL) as contact_missing_party,
  COUNT(*) FILTER (WHERE "buyerOrganizationId" IS NOT NULL AND "buyerPartyId" IS NULL) as org_missing_party,
  COUNT(*) FILTER (WHERE "buyerContactId" IS NULL AND "buyerOrganizationId" IS NULL AND "buyerPartyId" IS NULL) as no_buyer,
  COUNT(*) as total
FROM "Offspring";
```

**Expected:** `contact_missing_party` and `org_missing_party` should be 0.

### 1.6 Invoice - clientPartyId

```sql
-- Count rows by backfill status
SELECT
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL AND "clientPartyId" IS NOT NULL) as contact_backfilled,
  COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL AND "clientPartyId" IS NOT NULL) as org_backfilled,
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL AND "clientPartyId" IS NULL) as contact_missing_party,
  COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL AND "clientPartyId" IS NULL) as org_missing_party,
  COUNT(*) FILTER (WHERE "contactId" IS NULL AND "organizationId" IS NULL AND "clientPartyId" IS NULL) as no_client,
  COUNT(*) as total
FROM "Invoice";
```

**Expected:** `contact_missing_party` and `org_missing_party` should be 0.

### 1.7 ContractParty - partyId

```sql
-- Count rows by backfill status
SELECT
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL AND "partyId" IS NOT NULL) as contact_backfilled,
  COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL AND "partyId" IS NOT NULL) as org_backfilled,
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL AND "partyId" IS NULL) as contact_missing_party,
  COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL AND "partyId" IS NULL) as org_missing_party,
  COUNT(*) FILTER (WHERE "contactId" IS NULL AND "organizationId" IS NULL AND "partyId" IS NULL AND "userId" IS NULL) as no_party_user,
  COUNT(*) as total
FROM "ContractParty";
```

**Expected:** `contact_missing_party` and `org_missing_party` should be 0.

### 1.8 OffspringContract - buyerPartyId

```sql
-- Count rows by backfill status
SELECT
  COUNT(*) FILTER (WHERE "buyerContactId" IS NOT NULL AND "buyerPartyId" IS NOT NULL) as contact_backfilled,
  COUNT(*) FILTER (WHERE "buyerOrganizationId" IS NOT NULL AND "buyerPartyId" IS NOT NULL) as org_backfilled,
  COUNT(*) FILTER (WHERE "buyerContactId" IS NOT NULL AND "buyerPartyId" IS NULL) as contact_missing_party,
  COUNT(*) FILTER (WHERE "buyerOrganizationId" IS NOT NULL AND "buyerPartyId" IS NULL) as org_missing_party,
  COUNT(*) FILTER (WHERE "buyerContactId" IS NULL AND "buyerOrganizationId" IS NULL AND "buyerPartyId" IS NULL) as no_buyer,
  COUNT(*) as total
FROM "OffspringContract";
```

**Expected:** `contact_missing_party` and `org_missing_party` should be 0.

---

## 2. Conflict Detection

### 2.1 PlanParty - Rows with both contactId and organizationId

```sql
SELECT
  id,
  "planId",
  role,
  "contactId",
  "organizationId",
  "partyId"
FROM "PlanParty"
WHERE "contactId" IS NOT NULL
  AND "organizationId" IS NOT NULL;
```

**Expected:** Should return 0 rows. If rows exist, determine business logic for which FK should take precedence.

### 2.2 WaitlistEntry - Rows with both contactId and organizationId

```sql
SELECT
  id,
  "contactId",
  "organizationId",
  "clientPartyId"
FROM "WaitlistEntry"
WHERE "contactId" IS NOT NULL
  AND "organizationId" IS NOT NULL;
```

**Expected:** Should return 0 rows or follow the `partyType` field to determine precedence.

### 2.3 OffspringGroupBuyer - Rows with both contactId and organizationId

```sql
SELECT
  id,
  "groupId",
  "contactId",
  "organizationId",
  "buyerPartyId"
FROM "OffspringGroupBuyer"
WHERE "contactId" IS NOT NULL
  AND "organizationId" IS NOT NULL;
```

**Expected:** Should return 0 rows (enforced by unique constraints).

### 2.4 Offspring - Rows with both buyerContactId and buyerOrganizationId

```sql
SELECT
  id,
  name,
  "buyerContactId",
  "buyerOrganizationId",
  "buyerPartyId",
  "buyerPartyType"
FROM "Offspring"
WHERE "buyerContactId" IS NOT NULL
  AND "buyerOrganizationId" IS NOT NULL;
```

**Expected:** Should return 0 rows or be resolved via `buyerPartyType`.

### 2.5 Invoice - Rows with both contactId and organizationId

```sql
SELECT
  id,
  "contactId",
  "organizationId",
  "clientPartyId"
FROM "Invoice"
WHERE "contactId" IS NOT NULL
  AND "organizationId" IS NOT NULL;
```

**Expected:** Should return 0 rows.

### 2.6 ContractParty - Rows with both contactId and organizationId

```sql
SELECT
  id,
  "contractId",
  "contactId",
  "organizationId",
  "userId",
  "partyId"
FROM "ContractParty"
WHERE "contactId" IS NOT NULL
  AND "organizationId" IS NOT NULL;
```

**Expected:** Should return 0 rows.

### 2.7 OffspringContract - Rows with both buyerContactId and buyerOrganizationId

```sql
SELECT
  id,
  "offspringId",
  "buyerContactId",
  "buyerOrganizationId",
  "buyerPartyId"
FROM "OffspringContract"
WHERE "buyerContactId" IS NOT NULL
  AND "buyerOrganizationId" IS NOT NULL;
```

**Expected:** Should return 0 rows.

---

## 3. Foreign Key Integrity

### 3.1 All partyId values must reference existing Party records

```sql
-- BreedingAttempt
SELECT COUNT(*) as orphaned_breeding_attempts
FROM "BreedingAttempt" ba
WHERE ba."studOwnerPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = ba."studOwnerPartyId");

-- PlanParty
SELECT COUNT(*) as orphaned_plan_parties
FROM "PlanParty" pp
WHERE pp."partyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = pp."partyId");

-- WaitlistEntry
SELECT COUNT(*) as orphaned_waitlist_entries
FROM "WaitlistEntry" we
WHERE we."clientPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = we."clientPartyId");

-- OffspringGroupBuyer
SELECT COUNT(*) as orphaned_offspring_group_buyers
FROM "OffspringGroupBuyer" ogb
WHERE ogb."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = ogb."buyerPartyId");

-- Offspring
SELECT COUNT(*) as orphaned_offspring
FROM "Offspring" o
WHERE o."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = o."buyerPartyId");

-- Invoice
SELECT COUNT(*) as orphaned_invoices
FROM "Invoice" i
WHERE i."clientPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = i."clientPartyId");

-- ContractParty
SELECT COUNT(*) as orphaned_contract_parties
FROM "ContractParty" cp
WHERE cp."partyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = cp."partyId");

-- OffspringContract
SELECT COUNT(*) as orphaned_offspring_contracts
FROM "OffspringContract" oc
WHERE oc."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = oc."buyerPartyId");
```

**Expected:** All counts should be 0.

---

## 4. Index Existence Verification

```sql
-- Verify all new indexes were created
SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'BreedingAttempt_studOwnerPartyId_idx',
    'PlanParty_partyId_idx',
    'PlanParty_tenantId_partyId_role_idx',
    'WaitlistEntry_clientPartyId_idx',
    'WaitlistEntry_tenantId_clientPartyId_idx',
    'OffspringGroupBuyer_buyerPartyId_idx',
    'OffspringGroupBuyer_tenantId_buyerPartyId_idx',
    'Offspring_buyerPartyId_idx',
    'Offspring_tenantId_buyerPartyId_idx',
    'Invoice_organizationId_idx',
    'Invoice_clientPartyId_idx',
    'Invoice_tenantId_clientPartyId_idx',
    'ContractParty_partyId_idx',
    'ContractParty_tenantId_partyId_idx',
    'OffspringContract_buyerPartyId_idx',
    'OffspringContract_tenantId_buyerPartyId_idx'
  )
ORDER BY tablename, indexname;
```

**Expected:** Should return all 16 indexes.

---

## 5. Unresolvable Legacy IDs

### 5.1 BreedingAttempt - Contacts without partyId

```sql
SELECT
  ba.id as breeding_attempt_id,
  ba."studOwnerContactId",
  c."display_name",
  c."partyId"
FROM "BreedingAttempt" ba
JOIN "Contact" c ON c.id = ba."studOwnerContactId"
WHERE ba."studOwnerContactId" IS NOT NULL
  AND ba."studOwnerPartyId" IS NULL
  AND c."partyId" IS NULL;
```

**Expected:** Should return 0 rows if Contact backfill (Step 3/4) was complete.

### 5.2 PlanParty - Contacts/Organizations without partyId

```sql
-- Contacts
SELECT
  pp.id as plan_party_id,
  pp."contactId",
  c."display_name",
  c."partyId"
FROM "PlanParty" pp
JOIN "Contact" c ON c.id = pp."contactId"
WHERE pp."contactId" IS NOT NULL
  AND pp."partyId" IS NULL
  AND c."partyId" IS NULL;

-- Organizations
SELECT
  pp.id as plan_party_id,
  pp."organizationId",
  o."name",
  o."partyId"
FROM "PlanParty" pp
JOIN "Organization" o ON o.id = pp."organizationId"
WHERE pp."organizationId" IS NOT NULL
  AND pp."partyId" IS NULL
  AND o."partyId" IS NULL;
```

**Expected:** Both should return 0 rows.

### 5.3 Similar checks for other tables

Apply the same pattern to WaitlistEntry, OffspringGroupBuyer, Offspring, Invoice, ContractParty, and OffspringContract.

---

## 6. Data Consistency Checks

### 6.1 Ensure partyId matches the legacy ID's partyId

```sql
-- BreedingAttempt
SELECT COUNT(*) as mismatched_breeding_attempts
FROM "BreedingAttempt" ba
JOIN "Contact" c ON c.id = ba."studOwnerContactId"
WHERE ba."studOwnerPartyId" IS NOT NULL
  AND c."partyId" IS NOT NULL
  AND ba."studOwnerPartyId" != c."partyId";

-- PlanParty (Contact)
SELECT COUNT(*) as mismatched_plan_parties_contact
FROM "PlanParty" pp
JOIN "Contact" c ON c.id = pp."contactId"
WHERE pp."partyId" IS NOT NULL
  AND c."partyId" IS NOT NULL
  AND pp."partyId" != c."partyId";

-- PlanParty (Organization)
SELECT COUNT(*) as mismatched_plan_parties_org
FROM "PlanParty" pp
JOIN "Organization" o ON o.id = pp."organizationId"
WHERE pp."partyId" IS NOT NULL
  AND o."partyId" IS NOT NULL
  AND pp."partyId" != o."partyId";

-- ... repeat for other tables ...
```

**Expected:** All counts should be 0.

---

## 7. Summary Query

```sql
SELECT
  'BreedingAttempt' as table_name,
  COUNT(*) as total_rows,
  COUNT("studOwnerPartyId") as with_party_id,
  COUNT(*) - COUNT("studOwnerPartyId") as without_party_id
FROM "BreedingAttempt"
UNION ALL
SELECT
  'PlanParty',
  COUNT(*),
  COUNT("partyId"),
  COUNT(*) - COUNT("partyId")
FROM "PlanParty"
UNION ALL
SELECT
  'WaitlistEntry',
  COUNT(*),
  COUNT("clientPartyId"),
  COUNT(*) - COUNT("clientPartyId")
FROM "WaitlistEntry"
UNION ALL
SELECT
  'OffspringGroupBuyer',
  COUNT(*),
  COUNT("buyerPartyId"),
  COUNT(*) - COUNT("buyerPartyId")
FROM "OffspringGroupBuyer"
UNION ALL
SELECT
  'Offspring',
  COUNT(*),
  COUNT("buyerPartyId"),
  COUNT(*) - COUNT("buyerPartyId")
FROM "Offspring"
UNION ALL
SELECT
  'Invoice',
  COUNT(*),
  COUNT("clientPartyId"),
  COUNT(*) - COUNT("clientPartyId")
FROM "Invoice"
UNION ALL
SELECT
  'ContractParty',
  COUNT(*),
  COUNT("partyId"),
  COUNT(*) - COUNT("partyId")
FROM "ContractParty"
UNION ALL
SELECT
  'OffspringContract',
  COUNT(*),
  COUNT("buyerPartyId"),
  COUNT(*) - COUNT("buyerPartyId")
FROM "OffspringContract";
```

---

## Acceptance Criteria

✅ All `missing_party` counts are 0
✅ No conflicts (both Contact and Organization set)
✅ No orphaned partyId FKs
✅ All 16 new indexes exist
✅ No unresolvable legacy IDs
✅ partyId values match legacy Contact/Organization partyId

If any query returns unexpected results, investigate before proceeding to backend code changes.
