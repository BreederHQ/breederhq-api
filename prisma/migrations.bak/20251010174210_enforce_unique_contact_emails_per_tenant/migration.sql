/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,email]` on the table `Contact` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Contact" DROP CONSTRAINT "Contact_tenantId_fkey";

-- AlterTable
ALTER TABLE "Contact" ALTER COLUMN "email" SET DATA TYPE CITEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" SET DATA TYPE CITEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Contact_tenantId_email_key" ON "Contact"("tenantId", "email");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
