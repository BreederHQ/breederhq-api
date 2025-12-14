/*
  Warnings:

  - You are about to drop the column `tentativeName` on the `OffspringGroup` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "OffspringGroup"
  RENAME COLUMN "tentativeName" TO "name";

