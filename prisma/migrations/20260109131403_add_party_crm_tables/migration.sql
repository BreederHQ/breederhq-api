-- CreateEnum
CREATE TYPE "PartyEventKind" AS ENUM ('FOLLOW_UP', 'MEETING', 'CALL', 'VISIT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PartyEventStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartyMilestoneKind" AS ENUM ('BIRTHDAY', 'CUSTOMER_ANNIVERSARY', 'PLACEMENT_ANNIVERSARY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PartyActivityKind" AS ENUM ('NOTE_ADDED', 'NOTE_UPDATED', 'EMAIL_SENT', 'EVENT_CREATED', 'EVENT_COMPLETED', 'MILESTONE_OCCURRED', 'STATUS_CHANGED', 'TAG_ADDED', 'TAG_REMOVED', 'INVOICE_CREATED', 'PAYMENT_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_RECEIVED');

-- AlterEnum
ALTER TYPE "EntitlementKey" ADD VALUE 'DATA_EXPORT';

-- CreateTable
CREATE TABLE "PartyNote" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "kind" "PartyEventKind" NOT NULL DEFAULT 'FOLLOW_UP',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "PartyEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "completedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyMilestone" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "kind" "PartyMilestoneKind" NOT NULL DEFAULT 'CUSTOM',
    "label" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "annual" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyEmail" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "messageId" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyActivity" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "kind" "PartyActivityKind" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "metadata" JSONB,
    "actorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartyNote_tenantId_partyId_idx" ON "PartyNote"("tenantId", "partyId");

-- CreateIndex
CREATE INDEX "PartyNote_partyId_pinned_idx" ON "PartyNote"("partyId", "pinned");

-- CreateIndex
CREATE INDEX "PartyEvent_tenantId_partyId_idx" ON "PartyEvent"("tenantId", "partyId");

-- CreateIndex
CREATE INDEX "PartyEvent_partyId_scheduledAt_idx" ON "PartyEvent"("partyId", "scheduledAt");

-- CreateIndex
CREATE INDEX "PartyEvent_tenantId_status_scheduledAt_idx" ON "PartyEvent"("tenantId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "PartyMilestone_tenantId_partyId_idx" ON "PartyMilestone"("tenantId", "partyId");

-- CreateIndex
CREATE INDEX "PartyMilestone_partyId_date_idx" ON "PartyMilestone"("partyId", "date");

-- CreateIndex
CREATE INDEX "PartyMilestone_tenantId_annual_idx" ON "PartyMilestone"("tenantId", "annual");

-- CreateIndex
CREATE INDEX "PartyEmail_tenantId_partyId_idx" ON "PartyEmail"("tenantId", "partyId");

-- CreateIndex
CREATE INDEX "PartyEmail_partyId_sentAt_idx" ON "PartyEmail"("partyId", "sentAt");

-- CreateIndex
CREATE INDEX "PartyActivity_tenantId_partyId_idx" ON "PartyActivity"("tenantId", "partyId");

-- CreateIndex
CREATE INDEX "PartyActivity_partyId_createdAt_idx" ON "PartyActivity"("partyId", "createdAt");

-- CreateIndex
CREATE INDEX "PartyActivity_tenantId_kind_idx" ON "PartyActivity"("tenantId", "kind");

-- AddForeignKey
ALTER TABLE "PartyNote" ADD CONSTRAINT "PartyNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyNote" ADD CONSTRAINT "PartyNote_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyEvent" ADD CONSTRAINT "PartyEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyEvent" ADD CONSTRAINT "PartyEvent_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyMilestone" ADD CONSTRAINT "PartyMilestone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyMilestone" ADD CONSTRAINT "PartyMilestone_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyEmail" ADD CONSTRAINT "PartyEmail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyEmail" ADD CONSTRAINT "PartyEmail_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyActivity" ADD CONSTRAINT "PartyActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyActivity" ADD CONSTRAINT "PartyActivity_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
