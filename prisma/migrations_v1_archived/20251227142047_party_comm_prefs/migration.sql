-- CreateEnum
CREATE TYPE "CommChannel" AS ENUM ('EMAIL', 'SMS', 'PHONE', 'MAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "PreferenceLevel" AS ENUM ('ALLOW', 'NOT_PREFERRED', 'NEVER');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('SUBSCRIBED', 'UNSUBSCRIBED');

-- CreateTable
CREATE TABLE "PartyCommPreference" (
    "id" SERIAL NOT NULL,
    "partyId" INTEGER NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "preference" "PreferenceLevel" NOT NULL DEFAULT 'ALLOW',
    "compliance" "ComplianceStatus",
    "complianceSetAt" TIMESTAMP(3),
    "complianceSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyCommPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyCommPreferenceEvent" (
    "id" SERIAL NOT NULL,
    "partyId" INTEGER NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "prevPreference" "PreferenceLevel",
    "newPreference" "PreferenceLevel",
    "prevCompliance" "ComplianceStatus",
    "newCompliance" "ComplianceStatus",
    "actorPartyId" INTEGER,
    "reason" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyCommPreferenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartyCommPreference_partyId_idx" ON "PartyCommPreference"("partyId");

-- CreateIndex
CREATE INDEX "PartyCommPreference_channel_compliance_idx" ON "PartyCommPreference"("channel", "compliance");

-- CreateIndex
CREATE UNIQUE INDEX "PartyCommPreference_partyId_channel_key" ON "PartyCommPreference"("partyId", "channel");

-- CreateIndex
CREATE INDEX "PartyCommPreferenceEvent_partyId_createdAt_idx" ON "PartyCommPreferenceEvent"("partyId", "createdAt");

-- CreateIndex
CREATE INDEX "PartyCommPreferenceEvent_channel_createdAt_idx" ON "PartyCommPreferenceEvent"("channel", "createdAt");

-- AddForeignKey
ALTER TABLE "PartyCommPreference" ADD CONSTRAINT "PartyCommPreference_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyCommPreferenceEvent" ADD CONSTRAINT "PartyCommPreferenceEvent_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
