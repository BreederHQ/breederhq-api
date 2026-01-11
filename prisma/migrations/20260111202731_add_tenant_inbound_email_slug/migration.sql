/*
  Warnings:

  - A unique constraint covering the columns `[inboundEmailSlug]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "inboundEmailSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_inboundEmailSlug_key" ON "Tenant"("inboundEmailSlug");
