-- Add archive support to Tag model
ALTER TABLE "Tag" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tag" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Add index for efficient archived tag filtering
CREATE INDEX "Tag_tenantId_isArchived_module_idx" ON "Tag"("tenantId", "isArchived", "module");
