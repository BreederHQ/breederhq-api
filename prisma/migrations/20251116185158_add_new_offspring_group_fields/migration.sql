-- CreateTable
CREATE TABLE "OffspringGroupBuyer" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "organizationId" INTEGER,
    "waitlistEntryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringGroupBuyer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OffspringGroupBuyer_tenantId_idx" ON "OffspringGroupBuyer"("tenantId");

-- CreateIndex
CREATE INDEX "OffspringGroupBuyer_groupId_idx" ON "OffspringGroupBuyer"("groupId");

-- CreateIndex
CREATE INDEX "OffspringGroupBuyer_contactId_idx" ON "OffspringGroupBuyer"("contactId");

-- CreateIndex
CREATE INDEX "OffspringGroupBuyer_organizationId_idx" ON "OffspringGroupBuyer"("organizationId");

-- CreateIndex
CREATE INDEX "OffspringGroupBuyer_waitlistEntryId_idx" ON "OffspringGroupBuyer"("waitlistEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "OffspringGroupBuyer_groupId_contactId_key" ON "OffspringGroupBuyer"("groupId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "OffspringGroupBuyer_groupId_organizationId_key" ON "OffspringGroupBuyer"("groupId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OffspringGroupBuyer_groupId_waitlistEntryId_key" ON "OffspringGroupBuyer"("groupId", "waitlistEntryId");

-- AddForeignKey
ALTER TABLE "OffspringGroupBuyer" ADD CONSTRAINT "OffspringGroupBuyer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroupBuyer" ADD CONSTRAINT "OffspringGroupBuyer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OffspringGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroupBuyer" ADD CONSTRAINT "OffspringGroupBuyer_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroupBuyer" ADD CONSTRAINT "OffspringGroupBuyer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroupBuyer" ADD CONSTRAINT "OffspringGroupBuyer_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES "WaitlistEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
