-- ============================================================================
-- Step 7: Party Constraints and Performance Indexes
-- Purpose: Enforce database invariants and add performance indexes after Party migration
-- Date: 2025-12-26
-- Irreversible: Partially (NOT NULL constraints are hard to reverse)
-- ============================================================================

-- ============================================================================
-- SECTION 1: Add NOT NULL constraints to mandatory partyId columns
-- ============================================================================

-- These columns MUST always reference a Party based on business logic
-- Pre-validation confirmed zero NULL values exist

-- AnimalOwner.partyId: Every co-owner MUST be a Party
ALTER TABLE "AnimalOwner"
  ALTER COLUMN "partyId" SET NOT NULL;

-- WaitlistEntry.clientPartyId: Every waitlist entry MUST have a client
ALTER TABLE "WaitlistEntry"
  ALTER COLUMN "clientPartyId" SET NOT NULL;

-- OffspringGroupBuyer.buyerPartyId: Every buyer link MUST reference a Party
ALTER TABLE "OffspringGroupBuyer"
  ALTER COLUMN "buyerPartyId" SET NOT NULL;

-- OffspringContract.buyerPartyId: Every contract MUST have a buyer
ALTER TABLE "OffspringContract"
  ALTER COLUMN "buyerPartyId" SET NOT NULL;

-- PlanParty.partyId: Every plan party role MUST reference a Party
ALTER TABLE "PlanParty"
  ALTER COLUMN "partyId" SET NOT NULL;

-- ============================================================================
-- SECTION 2: Fix ON DELETE behavior for critical relationships
-- ============================================================================

-- AnimalOwner.partyId: Change from SET NULL to RESTRICT
-- Rationale: Cannot delete a Party if they own animals - prevents accidental data loss
ALTER TABLE "AnimalOwner"
  DROP CONSTRAINT IF EXISTS "AnimalOwner_partyId_fkey";

ALTER TABLE "AnimalOwner"
  ADD CONSTRAINT "AnimalOwner_partyId_fkey"
    FOREIGN KEY ("partyId")
    REFERENCES "Party"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- SECTION 3: Add performance indexes for common query patterns
-- ============================================================================

-- Invoice queries by client and status
-- Pattern: "Find all open/paid invoices for this client"
CREATE INDEX IF NOT EXISTS "Invoice_clientPartyId_status_idx"
  ON "Invoice"("clientPartyId", "status")
  WHERE "clientPartyId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Invoice_tenantId_clientPartyId_status_idx"
  ON "Invoice"("tenantId", "clientPartyId", "status")
  WHERE "clientPartyId" IS NOT NULL;

-- Contract queries by party and status
-- Pattern: "Find all signed/pending contracts for this party"
CREATE INDEX IF NOT EXISTS "ContractParty_partyId_status_idx"
  ON "ContractParty"("partyId", "status")
  WHERE "partyId" IS NOT NULL;

-- OffspringGroupBuyer reverse lookup
-- Pattern: "What groups has this buyer purchased from?"
CREATE INDEX IF NOT EXISTS "OffspringGroupBuyer_buyerPartyId_groupId_idx"
  ON "OffspringGroupBuyer"("buyerPartyId", "groupId");

-- PlanParty by role within plan
-- Pattern: "Find all co-owners/stud owners for this plan"
CREATE INDEX IF NOT EXISTS "PlanParty_planId_role_idx"
  ON "PlanParty"("planId", "role");

-- Offspring by buyer and placement state
-- Pattern: "Find all offspring for this buyer by placement status"
CREATE INDEX IF NOT EXISTS "Offspring_buyerPartyId_placementState_idx"
  ON "Offspring"("buyerPartyId", "placementState")
  WHERE "buyerPartyId" IS NOT NULL;

-- OffspringContract by buyer and status
-- Pattern: "Find all contracts for this buyer by status"
CREATE INDEX IF NOT EXISTS "OffspringContract_buyerPartyId_status_idx"
  ON "OffspringContract"("buyerPartyId", "status");

-- WaitlistEntry by client and status for quick filtering
-- Pattern: "Show me all DEPOSIT_DUE entries for this client"
CREATE INDEX IF NOT EXISTS "WaitlistEntry_clientPartyId_status_idx"
  ON "WaitlistEntry"("clientPartyId", "status");

-- ============================================================================
-- SECTION 4: Add composite indexes for association table lookups
-- ============================================================================

-- TagAssignment: Reverse lookup by party
-- Pattern: "Find all tags assigned to this party"
CREATE INDEX IF NOT EXISTS "TagAssignment_taggedPartyId_tagId_idx"
  ON "TagAssignment"("taggedPartyId", "tagId")
  WHERE "taggedPartyId" IS NOT NULL;

-- ============================================================================
-- Validation Notes
-- ============================================================================

-- Pre-migration validation confirmed:
-- ✓ AnimalOwner.partyId: 0 NULL values, 11/11 (100.00%) coverage
-- ✓ WaitlistEntry.clientPartyId: 0 NULL values, 9/9 (100.00%) coverage
-- ✓ OffspringGroupBuyer.buyerPartyId: 0 NULL values
-- ✓ OffspringContract.buyerPartyId: 0 NULL values
-- ✓ PlanParty.partyId: 0 NULL values
-- ✓ Invoice.clientPartyId (non-general): 0 NULL values

-- Post-migration validation should verify:
-- 1. All NOT NULL constraints are active
-- 2. AnimalOwner FK uses ON DELETE RESTRICT
-- 3. All new indexes exist and are being used by query planner
-- 4. No INSERT/UPDATE operations fail due to new constraints

-- ============================================================================
-- End of Migration
-- ============================================================================
