-- migrate:up
-- Drop the unique constraint on (groupId, buyerPartyId) to allow multi-slot buyers.
-- A single party (contact or organization) can now hold multiple OffspringGroupBuyer
-- records in the same group, each with their own placementRank (pick slot).
-- The @@unique([groupId, waitlistEntryId]) constraint is intentionally retained to
-- prevent the same waitlist entry from being linked to a group more than once.
-- Additional slots created via POST /offspring/groups/:id/buyers/:buyerId/slots
-- will have waitlistEntryId = NULL, which does not violate the remaining constraint.

ALTER TABLE "public"."OffspringGroupBuyer"
  DROP CONSTRAINT IF EXISTS "OffspringGroupBuyer_groupId_buyerPartyId_key";

-- migrate:down
-- Restore the unique constraint (only safe if no duplicate groupId+buyerPartyId rows exist)
ALTER TABLE "public"."OffspringGroupBuyer"
  ADD CONSTRAINT "OffspringGroupBuyer_groupId_buyerPartyId_key"
    UNIQUE ("groupId", "buyerPartyId");
