/*
  Warnings:

  - You are about to drop the column `contextId` on the `PortalInvite` table. All the data in the column will be lost.
  - You are about to drop the column `contextType` on the `PortalInvite` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PortalInvite" DROP COLUMN "contextId",
DROP COLUMN "contextType";

-- DropEnum
DROP TYPE "public"."PortalInviteContext";
