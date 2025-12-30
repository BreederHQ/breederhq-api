-- CreateEnum
CREATE TYPE "PortalAccessStatus" AS ENUM ('NO_ACCESS', 'INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "PortalAccess" (
    "id" SERIAL NOT NULL,
    "partyId" INTEGER NOT NULL,
    "status" "PortalAccessStatus" NOT NULL DEFAULT 'NO_ACCESS',
    "userId" TEXT,
    "invitedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalInvite" (
    "id" SERIAL NOT NULL,
    "portalAccessId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "sentByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalAccess_partyId_key" ON "PortalAccess"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalAccess_userId_key" ON "PortalAccess"("userId");

-- CreateIndex
CREATE INDEX "PortalAccess_partyId_idx" ON "PortalAccess"("partyId");

-- CreateIndex
CREATE INDEX "PortalAccess_userId_idx" ON "PortalAccess"("userId");

-- CreateIndex
CREATE INDEX "PortalAccess_status_idx" ON "PortalAccess"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PortalInvite_tokenHash_key" ON "PortalInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "PortalInvite_portalAccessId_idx" ON "PortalInvite"("portalAccessId");

-- CreateIndex
CREATE INDEX "PortalInvite_expiresAt_idx" ON "PortalInvite"("expiresAt");

-- AddForeignKey
ALTER TABLE "PortalAccess" ADD CONSTRAINT "PortalAccess_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAccess" ADD CONSTRAINT "PortalAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAccess" ADD CONSTRAINT "PortalAccess_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAccess" ADD CONSTRAINT "PortalAccess_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalInvite" ADD CONSTRAINT "PortalInvite_portalAccessId_fkey" FOREIGN KEY ("portalAccessId") REFERENCES "PortalAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalInvite" ADD CONSTRAINT "PortalInvite_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
