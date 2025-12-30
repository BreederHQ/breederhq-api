-- Party Migration Step 5: Tags Domain
-- Add partyId-based foreign keys to TagAssignment table
-- This is an additive schema change; legacy columns remain unchanged

-- Add taggedPartyId column to TagAssignment
ALTER TABLE "TagAssignment" ADD COLUMN "taggedPartyId" INTEGER;

-- Add foreign key constraint
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_taggedPartyId_fkey"
  FOREIGN KEY ("taggedPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for performance
CREATE INDEX "TagAssignment_taggedPartyId_idx" ON "TagAssignment"("taggedPartyId");
CREATE INDEX "TagAssignment_tagId_taggedPartyId_idx" ON "TagAssignment"("tagId", "taggedPartyId");

-- Backfill comment: Run backfill SQL separately after this migration
