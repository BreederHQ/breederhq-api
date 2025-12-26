-- AlterTable: BreedingAttempt - Add studOwnerPartyId
ALTER TABLE "BreedingAttempt" ADD COLUMN "studOwnerPartyId" INTEGER;

-- AlterTable: PlanParty - Add partyId
ALTER TABLE "PlanParty" ADD COLUMN "partyId" INTEGER;

-- AlterTable: WaitlistEntry - Add clientPartyId
ALTER TABLE "WaitlistEntry" ADD COLUMN "clientPartyId" INTEGER;

-- AlterTable: OffspringGroupBuyer - Add buyerPartyId
ALTER TABLE "OffspringGroupBuyer" ADD COLUMN "buyerPartyId" INTEGER;

-- AlterTable: Offspring - Add buyerPartyId
ALTER TABLE "Offspring" ADD COLUMN "buyerPartyId" INTEGER;

-- AlterTable: Invoice - Add clientPartyId
ALTER TABLE "Invoice" ADD COLUMN "clientPartyId" INTEGER;

-- AlterTable: ContractParty - Add partyId
ALTER TABLE "ContractParty" ADD COLUMN "partyId" INTEGER;

-- AlterTable: OffspringContract - Add buyerPartyId
ALTER TABLE "OffspringContract" ADD COLUMN "buyerPartyId" INTEGER;

-- CreateIndex: BreedingAttempt_studOwnerPartyId
CREATE INDEX "BreedingAttempt_studOwnerPartyId_idx" ON "BreedingAttempt"("studOwnerPartyId");

-- CreateIndex: PlanParty_partyId
CREATE INDEX "PlanParty_partyId_idx" ON "PlanParty"("partyId");

-- CreateIndex: PlanParty_tenantId_partyId_role
CREATE INDEX "PlanParty_tenantId_partyId_role_idx" ON "PlanParty"("tenantId", "partyId", "role");

-- CreateIndex: WaitlistEntry_clientPartyId
CREATE INDEX "WaitlistEntry_clientPartyId_idx" ON "WaitlistEntry"("clientPartyId");

-- CreateIndex: WaitlistEntry_tenantId_clientPartyId
CREATE INDEX "WaitlistEntry_tenantId_clientPartyId_idx" ON "WaitlistEntry"("tenantId", "clientPartyId");

-- CreateIndex: OffspringGroupBuyer_buyerPartyId
CREATE INDEX "OffspringGroupBuyer_buyerPartyId_idx" ON "OffspringGroupBuyer"("buyerPartyId");

-- CreateIndex: OffspringGroupBuyer_tenantId_buyerPartyId
CREATE INDEX "OffspringGroupBuyer_tenantId_buyerPartyId_idx" ON "OffspringGroupBuyer"("tenantId", "buyerPartyId");

-- CreateIndex: Offspring_buyerPartyId
CREATE INDEX "Offspring_buyerPartyId_idx" ON "Offspring"("buyerPartyId");

-- CreateIndex: Offspring_tenantId_buyerPartyId
CREATE INDEX "Offspring_tenantId_buyerPartyId_idx" ON "Offspring"("tenantId", "buyerPartyId");

-- CreateIndex: Invoice_organizationId
CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");

-- CreateIndex: Invoice_clientPartyId
CREATE INDEX "Invoice_clientPartyId_idx" ON "Invoice"("clientPartyId");

-- CreateIndex: Invoice_tenantId_clientPartyId
CREATE INDEX "Invoice_tenantId_clientPartyId_idx" ON "Invoice"("tenantId", "clientPartyId");

-- CreateIndex: ContractParty_partyId
CREATE INDEX "ContractParty_partyId_idx" ON "ContractParty"("partyId");

-- CreateIndex: ContractParty_tenantId_partyId
CREATE INDEX "ContractParty_tenantId_partyId_idx" ON "ContractParty"("tenantId", "partyId");

-- CreateIndex: OffspringContract_buyerPartyId
CREATE INDEX "OffspringContract_buyerPartyId_idx" ON "OffspringContract"("buyerPartyId");

-- CreateIndex: OffspringContract_tenantId_buyerPartyId
CREATE INDEX "OffspringContract_tenantId_buyerPartyId_idx" ON "OffspringContract"("tenantId", "buyerPartyId");

-- AddForeignKey: BreedingAttempt to Party
ALTER TABLE "BreedingAttempt" ADD CONSTRAINT "BreedingAttempt_studOwnerPartyId_fkey" FOREIGN KEY ("studOwnerPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: PlanParty to Party
ALTER TABLE "PlanParty" ADD CONSTRAINT "PlanParty_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: WaitlistEntry to Party
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_clientPartyId_fkey" FOREIGN KEY ("clientPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: OffspringGroupBuyer to Party
ALTER TABLE "OffspringGroupBuyer" ADD CONSTRAINT "OffspringGroupBuyer_buyerPartyId_fkey" FOREIGN KEY ("buyerPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Offspring to Party
ALTER TABLE "Offspring" ADD CONSTRAINT "Offspring_buyerPartyId_fkey" FOREIGN KEY ("buyerPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Invoice to Party
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientPartyId_fkey" FOREIGN KEY ("clientPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: ContractParty to Party
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: OffspringContract to Party
ALTER TABLE "OffspringContract" ADD CONSTRAINT "OffspringContract_buyerPartyId_fkey" FOREIGN KEY ("buyerPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
