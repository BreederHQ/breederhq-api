-- AlterTable
ALTER TABLE "CustomBreed" ADD COLUMN     "composition" JSONB;

-- CreateIndex
CREATE INDEX "CustomBreed_tenantId_createdByOrganizationId_idx" ON "CustomBreed"("tenantId", "createdByOrganizationId");
