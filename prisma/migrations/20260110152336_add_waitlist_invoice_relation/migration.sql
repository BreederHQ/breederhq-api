/*
  Warnings:

  - The `depositInvoiceId` column on the `WaitlistEntry` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[waitlistEntryId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "FinanceScope" ADD VALUE 'waitlist';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "waitlistEntryId" INTEGER;

-- AlterTable
ALTER TABLE "WaitlistEntry" DROP COLUMN "depositInvoiceId",
ADD COLUMN     "depositInvoiceId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_waitlistEntryId_key" ON "Invoice"("waitlistEntryId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES "WaitlistEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
