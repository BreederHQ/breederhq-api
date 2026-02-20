-- migrate:up
-- The previous migration attempted DROP CONSTRAINT which silently did nothing because
-- this uniqueness was enforced via a unique INDEX, not a named CONSTRAINT.
-- This migration correctly drops the unique index to enable multi-slot buyers.

DROP INDEX IF EXISTS "OffspringGroupBuyer_groupId_buyerPartyId_key";

-- migrate:down
CREATE UNIQUE INDEX "OffspringGroupBuyer_groupId_buyerPartyId_key"
  ON "public"."OffspringGroupBuyer" USING btree ("groupId", "buyerPartyId");
