-- CreateEnum
CREATE TYPE "EntitlementKey" AS ENUM ('MARKETPLACE_ACCESS');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "UserEntitlement" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "key" "EntitlementKey" NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "grantedByUserId" TEXT,

    CONSTRAINT "UserEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserEntitlement_userId_idx" ON "UserEntitlement"("userId");

-- CreateIndex
CREATE INDEX "UserEntitlement_key_status_idx" ON "UserEntitlement"("key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserEntitlement_userId_key_key" ON "UserEntitlement"("userId", "key");

-- AddForeignKey
ALTER TABLE "UserEntitlement" ADD CONSTRAINT "UserEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
