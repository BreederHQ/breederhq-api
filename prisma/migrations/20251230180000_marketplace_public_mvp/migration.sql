-- Marketplace MVP: Add public program profile fields to Organization
ALTER TABLE "Organization" ADD COLUMN "programSlug" TEXT;
ALTER TABLE "Organization" ADD COLUMN "isPublicProgram" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "programBio" TEXT;
ALTER TABLE "Organization" ADD COLUMN "publicContactEmail" TEXT;

-- Composite unique constraint for tenant-scoped slugs
CREATE UNIQUE INDEX "Organization_tenantId_programSlug_key" ON "Organization"("tenantId", "programSlug");

-- Index for filtering public programs
CREATE INDEX "Organization_isPublicProgram_idx" ON "Organization"("isPublicProgram");

-- Marketplace MVP: Add public listing fields to OffspringGroup
ALTER TABLE "OffspringGroup" ADD COLUMN "listingSlug" TEXT;
ALTER TABLE "OffspringGroup" ADD COLUMN "listingTitle" TEXT;
ALTER TABLE "OffspringGroup" ADD COLUMN "listingDescription" TEXT;

-- Composite unique constraint for tenant-scoped listing slugs
CREATE UNIQUE INDEX "OffspringGroup_tenantId_listingSlug_key" ON "OffspringGroup"("tenantId", "listingSlug");

-- Index for filtering published groups
CREATE INDEX "OffspringGroup_published_idx" ON "OffspringGroup"("published");

-- Marketplace MVP: Add inquiry context fields to MessageThread
ALTER TABLE "MessageThread" ADD COLUMN "inquiryType" TEXT;
ALTER TABLE "MessageThread" ADD COLUMN "sourceListingSlug" TEXT;
ALTER TABLE "MessageThread" ADD COLUMN "guestEmail" TEXT;
ALTER TABLE "MessageThread" ADD COLUMN "guestName" TEXT;

-- Index for filtering by inquiry type
CREATE INDEX "MessageThread_inquiryType_idx" ON "MessageThread"("inquiryType");
