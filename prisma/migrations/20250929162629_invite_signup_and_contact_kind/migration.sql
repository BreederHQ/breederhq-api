-- CreateEnum
CREATE TYPE "public"."ContactKind" AS ENUM ('NORMAL', 'SUBSCRIBER');

-- AlterTable
ALTER TABLE "public"."Contact" ADD COLUMN     "kind" "public"."ContactKind" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "public"."Invite" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER,
    "email" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'STAFF',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "public"."Invite"("token");

-- CreateIndex
CREATE INDEX "Invite_organizationId_idx" ON "public"."Invite"("organizationId");

-- CreateIndex
CREATE INDEX "Invite_email_idx" ON "public"."Invite"("email");

-- CreateIndex
CREATE INDEX "Invite_expiresAt_idx" ON "public"."Invite"("expiresAt");

-- CreateIndex
CREATE INDEX "Contact_kind_idx" ON "public"."Contact"("kind");

-- AddForeignKey
ALTER TABLE "public"."Invite" ADD CONSTRAINT "Invite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
