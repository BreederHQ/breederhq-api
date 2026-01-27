-- AlterTable
ALTER TABLE "public"."MessageThread" ADD COLUMN     "authenticationPass" BOOLEAN,
ADD COLUMN     "isQuarantined" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "spamFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "spamScore" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."EmailFilter" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "pattern" VARCHAR(255) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "reason" TEXT,
    "autoAdded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "lastMatched" TIMESTAMP(3),

    CONSTRAINT "EmailFilter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailFilter_tenantId_pattern_idx" ON "public"."EmailFilter"("tenantId", "pattern");

-- CreateIndex
CREATE INDEX "EmailFilter_tenantId_type_idx" ON "public"."EmailFilter"("tenantId", "type");

-- AddForeignKey
ALTER TABLE "public"."EmailFilter" ADD CONSTRAINT "EmailFilter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
