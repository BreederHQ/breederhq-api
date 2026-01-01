-- CreateEnum
CREATE TYPE "PortalInviteContext" AS ENUM ('INQUIRY', 'WAITLIST', 'INVOICE');

-- AlterTable
ALTER TABLE "PortalInvite" ADD COLUMN     "contextId" INTEGER,
ADD COLUMN     "contextType" "PortalInviteContext",
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TenantMembership" ALTER COLUMN "updatedAt" DROP DEFAULT;
