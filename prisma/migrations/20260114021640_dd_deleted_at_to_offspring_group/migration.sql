-- AlterTable
ALTER TABLE "public"."OffspringGroup" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "OffspringGroup_deletedAt_idx" ON "public"."OffspringGroup"("deletedAt");
