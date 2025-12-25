-- AlterTable User: Add partyId for Party migration step 5
-- This is an additive change - legacy contactId remains unchanged

-- Add partyId column to User table (nullable)
ALTER TABLE "User" ADD COLUMN "partyId" INTEGER;

-- Create index on partyId for efficient lookups
CREATE INDEX "User_partyId_idx" ON "User"("partyId");

-- Add foreign key constraint to Party table
ALTER TABLE "User" ADD CONSTRAINT "User_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
