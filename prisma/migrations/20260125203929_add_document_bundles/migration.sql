-- CreateEnum
CREATE TYPE "public"."BundleStatus" AS ENUM ('active', 'archived');

-- CreateTable
CREATE TABLE "public"."DocumentBundle" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."BundleStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DocumentBundleItem" (
    "id" SERIAL NOT NULL,
    "bundleId" INTEGER NOT NULL,
    "documentId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentBundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentBundle_tenantId_idx" ON "public"."DocumentBundle"("tenantId");

-- CreateIndex
CREATE INDEX "DocumentBundle_tenantId_status_idx" ON "public"."DocumentBundle"("tenantId", "status");

-- CreateIndex
CREATE INDEX "DocumentBundleItem_bundleId_idx" ON "public"."DocumentBundleItem"("bundleId");

-- CreateIndex
CREATE INDEX "DocumentBundleItem_documentId_idx" ON "public"."DocumentBundleItem"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentBundleItem_bundleId_documentId_key" ON "public"."DocumentBundleItem"("bundleId", "documentId");

-- AddForeignKey
ALTER TABLE "public"."DocumentBundle" ADD CONSTRAINT "DocumentBundle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentBundleItem" ADD CONSTRAINT "DocumentBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "public"."DocumentBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentBundleItem" ADD CONSTRAINT "DocumentBundleItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
