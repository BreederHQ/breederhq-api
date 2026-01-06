-- CreateEnum
CREATE TYPE "MarketplaceBlockLevel" AS ENUM ('LIGHT', 'MEDIUM', 'HEAVY');

-- CreateTable
CREATE TABLE "MarketplaceUserBlock" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "blockedUserId" VARCHAR(36) NOT NULL,
    "level" "MarketplaceBlockLevel" NOT NULL,
    "reason" TEXT,
    "blockedByPartyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),
    "liftedByPartyId" INTEGER,

    CONSTRAINT "MarketplaceUserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceUserFlag" (
    "id" SERIAL NOT NULL,
    "userId" VARCHAR(36) NOT NULL,
    "totalBlocks" INTEGER NOT NULL DEFAULT 0,
    "activeBlocks" INTEGER NOT NULL DEFAULT 0,
    "lightBlocks" INTEGER NOT NULL DEFAULT 0,
    "mediumBlocks" INTEGER NOT NULL DEFAULT 0,
    "heavyBlocks" INTEGER NOT NULL DEFAULT 0,
    "totalApprovals" INTEGER NOT NULL DEFAULT 0,
    "totalRejections" INTEGER NOT NULL DEFAULT 0,
    "flaggedAt" TIMESTAMP(3),
    "flagReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceUserFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" SERIAL NOT NULL,
    "namespace" VARCHAR(64) NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceUserBlock_blockedUserId_idx" ON "MarketplaceUserBlock"("blockedUserId");

-- CreateIndex
CREATE INDEX "MarketplaceUserBlock_tenantId_idx" ON "MarketplaceUserBlock"("tenantId");

-- CreateIndex
CREATE INDEX "MarketplaceUserBlock_tenantId_liftedAt_idx" ON "MarketplaceUserBlock"("tenantId", "liftedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceUserBlock_tenantId_blockedUserId_key" ON "MarketplaceUserBlock"("tenantId", "blockedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceUserFlag_userId_key" ON "MarketplaceUserFlag"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceUserFlag_flaggedAt_idx" ON "MarketplaceUserFlag"("flaggedAt");

-- CreateIndex
CREATE INDEX "MarketplaceUserFlag_suspendedAt_idx" ON "MarketplaceUserFlag"("suspendedAt");

-- CreateIndex
CREATE INDEX "MarketplaceUserFlag_activeBlocks_idx" ON "MarketplaceUserFlag"("activeBlocks");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSetting_namespace_key" ON "PlatformSetting"("namespace");

-- AddForeignKey
ALTER TABLE "MarketplaceUserBlock" ADD CONSTRAINT "MarketplaceUserBlock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceUserBlock" ADD CONSTRAINT "MarketplaceUserBlock_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceUserBlock" ADD CONSTRAINT "MarketplaceUserBlock_blockedByPartyId_fkey" FOREIGN KEY ("blockedByPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceUserBlock" ADD CONSTRAINT "MarketplaceUserBlock_liftedByPartyId_fkey" FOREIGN KEY ("liftedByPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceUserFlag" ADD CONSTRAINT "MarketplaceUserFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
