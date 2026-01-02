-- CreateEnum
CREATE TYPE "SchedulingEventStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SchedulingSlotStatus" AS ENUM ('AVAILABLE', 'FULL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SchedulingSlotMode" AS ENUM ('IN_PERSON', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "SchedulingBookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "SchedulingEventTemplate" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT,
    "status" "SchedulingEventStatus" NOT NULL DEFAULT 'DRAFT',
    "defaultDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "defaultCapacity" INTEGER NOT NULL DEFAULT 1,
    "canCancel" BOOLEAN NOT NULL DEFAULT true,
    "canReschedule" BOOLEAN NOT NULL DEFAULT true,
    "cancellationDeadlineHours" INTEGER,
    "rescheduleDeadlineHours" INTEGER,
    "nextStepsText" TEXT,
    "subjectType" TEXT,
    "offspringId" INTEGER,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulingEventTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulingAvailabilityBlock" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "templateId" INTEGER,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/New_York',
    "status" "SchedulingEventStatus" NOT NULL DEFAULT 'OPEN',
    "canCancel" BOOLEAN,
    "canReschedule" BOOLEAN,
    "cancellationDeadlineHours" INTEGER,
    "rescheduleDeadlineHours" INTEGER,
    "nextStepsText" TEXT,
    "location" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulingAvailabilityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulingSlot" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "blockId" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SchedulingSlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "mode" "SchedulingSlotMode",
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulingSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulingBooking" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "slotId" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "eventId" VARCHAR(64) NOT NULL,
    "status" "SchedulingBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "rescheduledAt" TIMESTAMP(3),
    "clientNotes" TEXT,
    "breederNotes" TEXT,
    "nextSteps" TEXT,
    "rescheduledFromId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulingBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchedulingEventTemplate_tenantId_idx" ON "SchedulingEventTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "SchedulingEventTemplate_tenantId_status_idx" ON "SchedulingEventTemplate"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SchedulingEventTemplate_tenantId_eventType_idx" ON "SchedulingEventTemplate"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "SchedulingEventTemplate_offspringId_idx" ON "SchedulingEventTemplate"("offspringId");

-- CreateIndex
CREATE INDEX "SchedulingAvailabilityBlock_tenantId_idx" ON "SchedulingAvailabilityBlock"("tenantId");

-- CreateIndex
CREATE INDEX "SchedulingAvailabilityBlock_tenantId_status_idx" ON "SchedulingAvailabilityBlock"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SchedulingAvailabilityBlock_tenantId_startAt_idx" ON "SchedulingAvailabilityBlock"("tenantId", "startAt");

-- CreateIndex
CREATE INDEX "SchedulingAvailabilityBlock_templateId_idx" ON "SchedulingAvailabilityBlock"("templateId");

-- CreateIndex
CREATE INDEX "SchedulingSlot_tenantId_idx" ON "SchedulingSlot"("tenantId");

-- CreateIndex
CREATE INDEX "SchedulingSlot_tenantId_status_idx" ON "SchedulingSlot"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SchedulingSlot_tenantId_startsAt_idx" ON "SchedulingSlot"("tenantId", "startsAt");

-- CreateIndex
CREATE INDEX "SchedulingSlot_blockId_idx" ON "SchedulingSlot"("blockId");

-- CreateIndex
CREATE INDEX "SchedulingSlot_blockId_startsAt_idx" ON "SchedulingSlot"("blockId", "startsAt");

-- CreateIndex
CREATE INDEX "SchedulingBooking_tenantId_idx" ON "SchedulingBooking"("tenantId");

-- CreateIndex
CREATE INDEX "SchedulingBooking_tenantId_partyId_idx" ON "SchedulingBooking"("tenantId", "partyId");

-- CreateIndex
CREATE INDEX "SchedulingBooking_tenantId_eventId_idx" ON "SchedulingBooking"("tenantId", "eventId");

-- CreateIndex
CREATE INDEX "SchedulingBooking_slotId_idx" ON "SchedulingBooking"("slotId");

-- CreateIndex
CREATE INDEX "SchedulingBooking_partyId_idx" ON "SchedulingBooking"("partyId");

-- CreateIndex
CREATE INDEX "SchedulingBooking_eventId_partyId_idx" ON "SchedulingBooking"("eventId", "partyId");

-- CreateIndex
CREATE INDEX "SchedulingBooking_status_idx" ON "SchedulingBooking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulingBooking_slotId_partyId_key" ON "SchedulingBooking"("slotId", "partyId");

-- AddForeignKey
ALTER TABLE "SchedulingEventTemplate" ADD CONSTRAINT "SchedulingEventTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingEventTemplate" ADD CONSTRAINT "SchedulingEventTemplate_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingAvailabilityBlock" ADD CONSTRAINT "SchedulingAvailabilityBlock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingAvailabilityBlock" ADD CONSTRAINT "SchedulingAvailabilityBlock_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SchedulingEventTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingSlot" ADD CONSTRAINT "SchedulingSlot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingSlot" ADD CONSTRAINT "SchedulingSlot_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "SchedulingAvailabilityBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingBooking" ADD CONSTRAINT "SchedulingBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingBooking" ADD CONSTRAINT "SchedulingBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "SchedulingSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingBooking" ADD CONSTRAINT "SchedulingBooking_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingBooking" ADD CONSTRAINT "SchedulingBooking_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "SchedulingBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
