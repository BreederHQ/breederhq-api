-- CreateEnum
CREATE TYPE "FinanceScope" AS ENUM ('group', 'offspring');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded', 'disputed', 'cancelled');

-- CreateEnum
CREATE TYPE "CampaignChannel" AS ENUM ('email', 'social', 'ads', 'marketplace', 'website', 'other');

-- CreateEnum
CREATE TYPE "TaskScope" AS ENUM ('group', 'offspring');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'in_progress', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "HealthType" AS ENUM ('weight', 'vaccine', 'deworm', 'vet_visit', 'treatment', 'other');

-- CreateEnum
CREATE TYPE "DocumentScope" AS ENUM ('group', 'offspring', 'invoice', 'contract');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('generic', 'health_certificate', 'registration', 'contract_pdf', 'invoice_pdf', 'photo', 'other');

-- CreateEnum
CREATE TYPE "SignatureProvider" AS ENUM ('internal', 'docusign', 'hellosign', 'adobe', 'other');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('draft', 'sent', 'viewed', 'signed', 'declined', 'voided', 'expired');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('pending', 'viewed', 'signed', 'declined', 'voided', 'expired');

-- CreateEnum
CREATE TYPE "InvoiceRole" AS ENUM ('RESERVATION', 'DEPOSIT', 'FINAL', 'MISC');

-- CreateEnum
CREATE TYPE "EsignProvider" AS ENUM ('DOCUSIGN', 'HELLOSIGN', 'ADOBE', 'OTHER');

-- CreateEnum
CREATE TYPE "EsignStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'SIGNED', 'DECLINED', 'EXPIRED', 'VOIDED');

-- CreateTable
CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "scope" "FinanceScope" NOT NULL,
    "groupId" INTEGER,
    "offspringId" INTEGER,
    "contactId" INTEGER,
    "organizationId" INTEGER,
    "number" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amountCents" INTEGER NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "depositCents" INTEGER,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "dueAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "externalProvider" TEXT,
    "externalId" TEXT,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "amountCents" INTEGER NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3),
    "externalProvider" TEXT,
    "externalId" TEXT,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringGroupId" INTEGER,
    "name" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "budgetCents" INTEGER,
    "spendCents" INTEGER,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "inquiries" INTEGER,
    "reservations" INTEGER,
    "conversions" INTEGER,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignAttribution" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "offspringId" INTEGER,
    "weight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "scope" "TaskScope" NOT NULL,
    "groupId" INTEGER,
    "offspringId" INTEGER,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "assignedToUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "kind" "HealthType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "weightGrams" INTEGER,
    "vaccineCode" TEXT,
    "dose" TEXT,
    "vetClinic" TEXT,
    "result" TEXT,
    "notes" TEXT,
    "data" JSONB,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "scope" "DocumentScope" NOT NULL,
    "kind" "DocumentKind" NOT NULL DEFAULT 'generic',
    "offspringId" INTEGER,
    "groupId" INTEGER,
    "invoiceId" INTEGER,
    "contractId" INTEGER,
    "title" TEXT NOT NULL,
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "mimeType" TEXT,
    "bytes" INTEGER,
    "sha256" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT,
    "storageKey" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "templateId" INTEGER,
    "offspringId" INTEGER,
    "groupId" INTEGER,
    "invoiceId" INTEGER,
    "title" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'draft',
    "provider" "SignatureProvider" NOT NULL DEFAULT 'internal',
    "providerEnvelopeId" TEXT,
    "providerDocId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractParty" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "organizationId" INTEGER,
    "userId" TEXT,
    "role" TEXT,
    "email" TEXT,
    "name" TEXT,
    "signer" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER,
    "status" "SignatureStatus" NOT NULL DEFAULT 'pending',
    "signedAt" TIMESTAMP(3),
    "providerRecipientId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,
    "partyId" INTEGER,
    "status" "SignatureStatus" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "message" TEXT,
    "data" JSONB,

    CONSTRAINT "SignatureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffspringDocument" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT,
    "provider" "EsignProvider",
    "status" "EsignStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "fileId" INTEGER,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffspringContract" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT,
    "provider" "EsignProvider",
    "status" "EsignStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "fileId" INTEGER,
    "buyerContactId" INTEGER,
    "buyerOrganizationId" INTEGER,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffspringInvoiceLink" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "invoiceId" INTEGER,
    "role" "InvoiceRole" NOT NULL DEFAULT 'MISC',
    "amountCents" INTEGER,
    "currency" TEXT,
    "externalProvider" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringInvoiceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX "Invoice_scope_groupId_idx" ON "Invoice"("scope", "groupId");

-- CreateIndex
CREATE INDEX "Invoice_scope_offspringId_idx" ON "Invoice"("scope", "offspringId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_contactId_idx" ON "Invoice"("contactId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_tenantId_idx" ON "InvoiceLineItem"("tenantId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_idx" ON "Campaign"("tenantId");

-- CreateIndex
CREATE INDEX "Campaign_offspringGroupId_idx" ON "Campaign"("offspringGroupId");

-- CreateIndex
CREATE INDEX "Campaign_channel_idx" ON "Campaign"("channel");

-- CreateIndex
CREATE INDEX "CampaignAttribution_tenantId_idx" ON "CampaignAttribution"("tenantId");

-- CreateIndex
CREATE INDEX "CampaignAttribution_campaignId_idx" ON "CampaignAttribution"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignAttribution_offspringId_idx" ON "CampaignAttribution"("offspringId");

-- CreateIndex
CREATE INDEX "Task_tenantId_idx" ON "Task"("tenantId");

-- CreateIndex
CREATE INDEX "Task_scope_groupId_idx" ON "Task"("scope", "groupId");

-- CreateIndex
CREATE INDEX "Task_scope_offspringId_idx" ON "Task"("scope", "offspringId");

-- CreateIndex
CREATE INDEX "Task_status_dueAt_idx" ON "Task"("status", "dueAt");

-- CreateIndex
CREATE INDEX "HealthEvent_tenantId_idx" ON "HealthEvent"("tenantId");

-- CreateIndex
CREATE INDEX "HealthEvent_offspringId_occurredAt_idx" ON "HealthEvent"("offspringId", "occurredAt");

-- CreateIndex
CREATE INDEX "HealthEvent_kind_idx" ON "HealthEvent"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Document_invoiceId_key" ON "Document"("invoiceId");

-- CreateIndex
CREATE INDEX "Document_tenantId_idx" ON "Document"("tenantId");

-- CreateIndex
CREATE INDEX "Document_scope_offspringId_idx" ON "Document"("scope", "offspringId");

-- CreateIndex
CREATE INDEX "Document_scope_groupId_idx" ON "Document"("scope", "groupId");

-- CreateIndex
CREATE INDEX "Document_scope_invoiceId_idx" ON "Document"("scope", "invoiceId");

-- CreateIndex
CREATE INDEX "Document_scope_contractId_idx" ON "Document"("scope", "contractId");

-- CreateIndex
CREATE INDEX "Document_kind_idx" ON "Document"("kind");

-- CreateIndex
CREATE INDEX "ContractTemplate_tenantId_idx" ON "ContractTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "ContractTemplate_isActive_idx" ON "ContractTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_invoiceId_key" ON "Contract"("invoiceId");

-- CreateIndex
CREATE INDEX "Contract_tenantId_idx" ON "Contract"("tenantId");

-- CreateIndex
CREATE INDEX "Contract_offspringId_idx" ON "Contract"("offspringId");

-- CreateIndex
CREATE INDEX "Contract_groupId_idx" ON "Contract"("groupId");

-- CreateIndex
CREATE INDEX "Contract_invoiceId_idx" ON "Contract"("invoiceId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "Contract_provider_providerEnvelopeId_idx" ON "Contract"("provider", "providerEnvelopeId");

-- CreateIndex
CREATE INDEX "ContractParty_tenantId_idx" ON "ContractParty"("tenantId");

-- CreateIndex
CREATE INDEX "ContractParty_contractId_idx" ON "ContractParty"("contractId");

-- CreateIndex
CREATE INDEX "ContractParty_status_idx" ON "ContractParty"("status");

-- CreateIndex
CREATE INDEX "SignatureEvent_tenantId_idx" ON "SignatureEvent"("tenantId");

-- CreateIndex
CREATE INDEX "SignatureEvent_contractId_idx" ON "SignatureEvent"("contractId");

-- CreateIndex
CREATE INDEX "SignatureEvent_partyId_idx" ON "SignatureEvent"("partyId");

-- CreateIndex
CREATE INDEX "SignatureEvent_status_at_idx" ON "SignatureEvent"("status", "at");

-- CreateIndex
CREATE INDEX "OffspringDocument_tenantId_idx" ON "OffspringDocument"("tenantId");

-- CreateIndex
CREATE INDEX "OffspringDocument_offspringId_idx" ON "OffspringDocument"("offspringId");

-- CreateIndex
CREATE INDEX "OffspringDocument_status_idx" ON "OffspringDocument"("status");

-- CreateIndex
CREATE INDEX "OffspringContract_tenantId_idx" ON "OffspringContract"("tenantId");

-- CreateIndex
CREATE INDEX "OffspringContract_offspringId_idx" ON "OffspringContract"("offspringId");

-- CreateIndex
CREATE INDEX "OffspringContract_status_idx" ON "OffspringContract"("status");

-- CreateIndex
CREATE INDEX "OffspringInvoiceLink_tenantId_idx" ON "OffspringInvoiceLink"("tenantId");

-- CreateIndex
CREATE INDEX "OffspringInvoiceLink_offspringId_idx" ON "OffspringInvoiceLink"("offspringId");

-- CreateIndex
CREATE INDEX "OffspringInvoiceLink_invoiceId_idx" ON "OffspringInvoiceLink"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "OffspringInvoiceLink_offspringId_invoiceId_role_key" ON "OffspringInvoiceLink"("offspringId", "invoiceId", "role");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAttribution" ADD CONSTRAINT "CampaignAttribution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAttribution" ADD CONSTRAINT "CampaignAttribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAttribution" ADD CONSTRAINT "CampaignAttribution_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractTemplate" ADD CONSTRAINT "ContractTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureEvent" ADD CONSTRAINT "SignatureEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureEvent" ADD CONSTRAINT "SignatureEvent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureEvent" ADD CONSTRAINT "SignatureEvent_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "ContractParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringDocument" ADD CONSTRAINT "OffspringDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringDocument" ADD CONSTRAINT "OffspringDocument_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringDocument" ADD CONSTRAINT "OffspringDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringContract" ADD CONSTRAINT "OffspringContract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringContract" ADD CONSTRAINT "OffspringContract_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringContract" ADD CONSTRAINT "OffspringContract_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringContract" ADD CONSTRAINT "OffspringContract_buyerContactId_fkey" FOREIGN KEY ("buyerContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringContract" ADD CONSTRAINT "OffspringContract_buyerOrganizationId_fkey" FOREIGN KEY ("buyerOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringInvoiceLink" ADD CONSTRAINT "OffspringInvoiceLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringInvoiceLink" ADD CONSTRAINT "OffspringInvoiceLink_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringInvoiceLink" ADD CONSTRAINT "OffspringInvoiceLink_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
