-- CreateEnum
CREATE TYPE "public"."BreedingRuleCategory" AS ENUM ('LISTING', 'PRICING', 'VISIBILITY', 'BUYER_INTERACTION', 'STATUS', 'NOTIFICATIONS');

-- CreateEnum
CREATE TYPE "public"."BreedingRuleLevel" AS ENUM ('PROGRAM', 'PLAN', 'GROUP', 'OFFSPRING');

-- CreateTable
CREATE TABLE "public"."BreedingProgramRule" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "category" "public"."BreedingRuleCategory" NOT NULL,
    "ruleType" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "level" "public"."BreedingRuleLevel" NOT NULL,
    "levelId" VARCHAR(50) NOT NULL,
    "inheritsFromId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingProgramRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BreedingProgramRuleExecution" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "triggeredBy" VARCHAR(50) NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "entityId" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "action" VARCHAR(100),
    "changes" JSONB,
    "error" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreedingProgramRuleExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreedingProgramRule_tenantId_idx" ON "public"."BreedingProgramRule"("tenantId");

-- CreateIndex
CREATE INDEX "BreedingProgramRule_level_levelId_idx" ON "public"."BreedingProgramRule"("level", "levelId");

-- CreateIndex
CREATE INDEX "BreedingProgramRule_inheritsFromId_idx" ON "public"."BreedingProgramRule"("inheritsFromId");

-- CreateIndex
CREATE INDEX "BreedingProgramRule_ruleType_idx" ON "public"."BreedingProgramRule"("ruleType");

-- CreateIndex
CREATE INDEX "BreedingProgramRule_tenantId_enabled_idx" ON "public"."BreedingProgramRule"("tenantId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingProgramRule_tenantId_level_levelId_ruleType_key" ON "public"."BreedingProgramRule"("tenantId", "level", "levelId", "ruleType");

-- CreateIndex
CREATE INDEX "BreedingProgramRuleExecution_tenantId_idx" ON "public"."BreedingProgramRuleExecution"("tenantId");

-- CreateIndex
CREATE INDEX "BreedingProgramRuleExecution_ruleId_idx" ON "public"."BreedingProgramRuleExecution"("ruleId");

-- CreateIndex
CREATE INDEX "BreedingProgramRuleExecution_entityType_entityId_idx" ON "public"."BreedingProgramRuleExecution"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "BreedingProgramRuleExecution_executedAt_idx" ON "public"."BreedingProgramRuleExecution"("executedAt");

-- AddForeignKey
ALTER TABLE "public"."BreedingProgramRule" ADD CONSTRAINT "BreedingProgramRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingProgramRule" ADD CONSTRAINT "BreedingProgramRule_inheritsFromId_fkey" FOREIGN KEY ("inheritsFromId") REFERENCES "public"."BreedingProgramRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingProgramRuleExecution" ADD CONSTRAINT "BreedingProgramRuleExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "public"."BreedingProgramRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
