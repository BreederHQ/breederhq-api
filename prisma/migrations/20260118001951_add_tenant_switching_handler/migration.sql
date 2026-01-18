-- AlterTable
ALTER TABLE "public"."Tenant" ADD COLUMN     "demoResetType" TEXT,
ADD COLUMN     "isDemoTenant" BOOLEAN NOT NULL DEFAULT false;
