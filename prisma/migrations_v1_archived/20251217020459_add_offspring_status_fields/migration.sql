-- CreateEnum
CREATE TYPE "OffspringLifeState" AS ENUM ('ALIVE', 'DECEASED');

-- CreateEnum
CREATE TYPE "OffspringPlacementState" AS ENUM ('UNASSIGNED', 'OPTION_HOLD', 'RESERVED', 'PLACED', 'RETURNED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "OffspringKeeperIntent" AS ENUM ('AVAILABLE', 'UNDER_EVALUATION', 'WITHHELD', 'KEEP');

-- CreateEnum
CREATE TYPE "OffspringFinancialState" AS ENUM ('NONE', 'DEPOSIT_PENDING', 'DEPOSIT_PAID', 'PAID_IN_FULL', 'REFUNDED', 'CHARGEBACK');

-- CreateEnum
CREATE TYPE "OffspringPaperworkState" AS ENUM ('NONE', 'SENT', 'SIGNED', 'COMPLETE');

-- AlterTable
ALTER TABLE "Offspring" ADD COLUMN     "financialState" "OffspringFinancialState" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "keeperIntent" "OffspringKeeperIntent" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "lifeState" "OffspringLifeState" NOT NULL DEFAULT 'ALIVE',
ADD COLUMN     "paperworkState" "OffspringPaperworkState" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "placementState" "OffspringPlacementState" NOT NULL DEFAULT 'UNASSIGNED';

-- CreateIndex
CREATE INDEX "Offspring_tenantId_lifeState_idx" ON "Offspring"("tenantId", "lifeState");

-- CreateIndex
CREATE INDEX "Offspring_tenantId_placementState_idx" ON "Offspring"("tenantId", "placementState");

-- CreateIndex
CREATE INDEX "Offspring_tenantId_keeperIntent_idx" ON "Offspring"("tenantId", "keeperIntent");

-- CreateIndex
CREATE INDEX "Offspring_tenantId_financialState_idx" ON "Offspring"("tenantId", "financialState");

-- CreateIndex
CREATE INDEX "Offspring_tenantId_paperworkState_idx" ON "Offspring"("tenantId", "paperworkState");
