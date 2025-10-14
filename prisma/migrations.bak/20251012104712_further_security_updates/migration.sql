/*
  Warnings:

  - The primary key for the `VerificationToken` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[tokenHash]` on the table `VerificationToken` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tokenHash` to the `VerificationToken` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VerificationPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD', 'INVITE', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "passwordUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VerificationToken" DROP CONSTRAINT "VerificationToken_pkey",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "purpose" "VerificationPurpose" NOT NULL DEFAULT 'VERIFY_EMAIL',
ADD COLUMN     "tokenHash" TEXT NOT NULL,
ALTER COLUMN "token" DROP NOT NULL,
ADD CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier", "tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "VerificationToken_identifier_purpose_idx" ON "VerificationToken"("identifier", "purpose");
