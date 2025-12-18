-- AlterTable
ALTER TABLE "public"."Contact" ALTER COLUMN "firstName" SET DEFAULT '',
ALTER COLUMN "lastName" SET DEFAULT '',
ALTER COLUMN "whatsapp" DROP NOT NULL,
ALTER COLUMN "whatsapp" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."ContactAffiliation" (
    "id" SERIAL NOT NULL,
    "contactId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactAffiliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactAffiliation_contactId_idx" ON "public"."ContactAffiliation"("contactId");

-- CreateIndex
CREATE INDEX "ContactAffiliation_organizationId_idx" ON "public"."ContactAffiliation"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactAffiliation_contactId_organizationId_key" ON "public"."ContactAffiliation"("contactId", "organizationId");

-- AddForeignKey
ALTER TABLE "public"."ContactAffiliation" ADD CONSTRAINT "ContactAffiliation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContactAffiliation" ADD CONSTRAINT "ContactAffiliation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
