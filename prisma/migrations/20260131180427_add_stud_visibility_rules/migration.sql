-- CreateEnum
CREATE TYPE "public"."StudVisibilityLevel" AS ENUM ('TENANT', 'PROGRAM', 'PARTICIPANT');

-- CreateTable
CREATE TABLE "public"."StudVisibilityRule" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "level" "public"."StudVisibilityLevel" NOT NULL,
    "levelId" VARCHAR(50) NOT NULL,
    "inheritsFromId" INTEGER,
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "StudVisibilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudVisibilityRule_tenantId_idx" ON "public"."StudVisibilityRule"("tenantId");

-- CreateIndex
CREATE INDEX "StudVisibilityRule_level_levelId_idx" ON "public"."StudVisibilityRule"("level", "levelId");

-- CreateIndex
CREATE INDEX "StudVisibilityRule_inheritsFromId_idx" ON "public"."StudVisibilityRule"("inheritsFromId");

-- CreateIndex
CREATE UNIQUE INDEX "StudVisibilityRule_tenantId_level_levelId_key" ON "public"."StudVisibilityRule"("tenantId", "level", "levelId");

-- AddForeignKey
ALTER TABLE "public"."StudVisibilityRule" ADD CONSTRAINT "StudVisibilityRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudVisibilityRule" ADD CONSTRAINT "StudVisibilityRule_inheritsFromId_fkey" FOREIGN KEY ("inheritsFromId") REFERENCES "public"."StudVisibilityRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
