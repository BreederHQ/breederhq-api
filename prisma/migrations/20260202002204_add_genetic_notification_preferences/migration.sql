-- CreateEnum
CREATE TYPE "public"."GeneticSnoozeType" AS ENUM ('ANIMAL', 'TEST', 'ANIMAL_TEST');

-- CreateTable
CREATE TABLE "public"."GeneticNotificationPreference" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "inAppMissing" BOOLEAN NOT NULL DEFAULT true,
    "inAppIncomplete" BOOLEAN NOT NULL DEFAULT true,
    "inAppCarrier" BOOLEAN NOT NULL DEFAULT true,
    "inAppPrebreeding" BOOLEAN NOT NULL DEFAULT true,
    "inAppRegistry" BOOLEAN NOT NULL DEFAULT true,
    "inAppRecommended" BOOLEAN NOT NULL DEFAULT false,
    "emailMissing" BOOLEAN NOT NULL DEFAULT false,
    "emailIncomplete" BOOLEAN NOT NULL DEFAULT false,
    "emailCarrier" BOOLEAN NOT NULL DEFAULT true,
    "emailPrebreeding" BOOLEAN NOT NULL DEFAULT true,
    "emailRegistry" BOOLEAN NOT NULL DEFAULT true,
    "emailRecommended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneticNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GeneticNotificationSnooze" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "snoozeType" "public"."GeneticSnoozeType" NOT NULL,
    "animalId" INTEGER,
    "testCode" TEXT,
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneticNotificationSnooze_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneticNotificationPreference_tenantId_idx" ON "public"."GeneticNotificationPreference"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneticNotificationPreference_userId_tenantId_key" ON "public"."GeneticNotificationPreference"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "GeneticNotificationSnooze_tenantId_userId_idx" ON "public"."GeneticNotificationSnooze"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "GeneticNotificationSnooze_animalId_idx" ON "public"."GeneticNotificationSnooze"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneticNotificationSnooze_userId_tenantId_snoozeType_animal_key" ON "public"."GeneticNotificationSnooze"("userId", "tenantId", "snoozeType", "animalId", "testCode");

-- AddForeignKey
ALTER TABLE "public"."GeneticNotificationPreference" ADD CONSTRAINT "GeneticNotificationPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GeneticNotificationPreference" ADD CONSTRAINT "GeneticNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GeneticNotificationSnooze" ADD CONSTRAINT "GeneticNotificationSnooze_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GeneticNotificationSnooze" ADD CONSTRAINT "GeneticNotificationSnooze_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
