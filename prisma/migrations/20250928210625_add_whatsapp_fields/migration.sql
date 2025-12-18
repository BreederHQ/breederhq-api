/*
  Warnings:

  - A unique constraint covering the columns `[contactId,tagId]` on the table `TagAssignment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Contact" ADD COLUMN     "whatsapp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappPhone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_contactId_tagId_key" ON "public"."TagAssignment"("contactId", "tagId");
