-- CreateEnum
CREATE TYPE "public"."Sex" AS ENUM ('FEMALE', 'MALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."Species" AS ENUM ('DOG', 'CAT', 'HORSE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'VOID', 'PARTIAL');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER', 'CASH', 'CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."Currency" AS ENUM ('USD', 'EUR', 'GBP', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."TargetType" AS ENUM ('CONTACT', 'ORGANIZATION', 'ANIMAL', 'BREEDING', 'OFFSPRING_GROUP', 'INVOICE', 'PAYMENT', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."FieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTISELECT', 'JSON');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contact" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Animal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "sex" "public"."Sex" NOT NULL,
    "species" "public"."Species" NOT NULL,
    "breed" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "registration" TEXT,
    "microchip" TEXT,
    "color" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CycleHistory" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CycleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Breeding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "damAnimalId" TEXT,
    "sireAnimalId" TEXT,
    "plannedDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "whelpWindowStart" TIMESTAMP(3),
    "whelpWindowEnd" TIMESTAMP(3),
    "location" TEXT,
    "status" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Breeding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OffspringGroup" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "count" INTEGER,
    "birthDate" TIMESTAMP(3),
    "weanDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "breedingId" TEXT,

    CONSTRAINT "OffspringGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" "public"."Currency" NOT NULL DEFAULT 'USD',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tax" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT,
    "contactId" TEXT,
    "breedingId" TEXT,
    "offspringGroupId" TEXT,
    "animalId" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "breedingId" TEXT,
    "offspringGroupId" TEXT,
    "animalId" TEXT,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "public"."Currency" NOT NULL DEFAULT 'USD',
    "method" "public"."PaymentMethod" NOT NULL DEFAULT 'OTHER',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT,
    "contactId" TEXT,
    "invoiceId" TEXT,
    "breedingId" TEXT,
    "offspringGroupId" TEXT,
    "animalId" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TagAssignment" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "targetType" "public"."TargetType" NOT NULL,
    "contactId" TEXT,
    "organizationId" TEXT,
    "animalId" TEXT,
    "breedingId" TEXT,
    "offspringGroupId" TEXT,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomFieldDef" (
    "id" TEXT NOT NULL,
    "targetType" "public"."TargetType" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "public"."FieldType" NOT NULL,
    "optionsJson" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomFieldValue" (
    "id" TEXT NOT NULL,
    "defId" TEXT NOT NULL,
    "targetType" "public"."TargetType" NOT NULL,
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueBool" BOOLEAN,
    "valueDate" TIMESTAMP(3),
    "valueJson" JSONB,
    "contactId" TEXT,
    "organizationId" TEXT,
    "animalId" TEXT,
    "breedingId" TEXT,
    "offspringGroupId" TEXT,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "url" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DocumentLink" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "targetType" "public"."TargetType" NOT NULL,
    "contactId" TEXT,
    "organizationId" TEXT,
    "animalId" TEXT,
    "breedingId" TEXT,
    "offspringGroupId" TEXT,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" "public"."TargetType" NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IntegrationAccount" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "label" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT,

    CONSTRAINT "IntegrationAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "public"."Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_microchip_key" ON "public"."Animal"("microchip");

-- CreateIndex
CREATE INDEX "CycleHistory_animalId_startDate_idx" ON "public"."CycleHistory"("animalId", "startDate");

-- CreateIndex
CREATE INDEX "Breeding_whelpWindowStart_whelpWindowEnd_idx" ON "public"."Breeding"("whelpWindowStart", "whelpWindowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "OffspringGroup_breedingId_key" ON "public"."OffspringGroup"("breedingId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "public"."Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_status_issueDate_idx" ON "public"."Invoice"("status", "issueDate");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_idx" ON "public"."Invoice"("organizationId");

-- CreateIndex
CREATE INDEX "Invoice_contactId_idx" ON "public"."Invoice"("contactId");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "public"."InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_receivedAt_idx" ON "public"."Payment"("receivedAt");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "public"."PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_invoiceId_key" ON "public"."PaymentAllocation"("paymentId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "public"."Tag"("name");

-- CreateIndex
CREATE INDEX "TagAssignment_targetType_idx" ON "public"."TagAssignment"("targetType");

-- CreateIndex
CREATE INDEX "TagAssignment_contactId_idx" ON "public"."TagAssignment"("contactId");

-- CreateIndex
CREATE INDEX "TagAssignment_organizationId_idx" ON "public"."TagAssignment"("organizationId");

-- CreateIndex
CREATE INDEX "TagAssignment_animalId_idx" ON "public"."TagAssignment"("animalId");

-- CreateIndex
CREATE INDEX "TagAssignment_breedingId_idx" ON "public"."TagAssignment"("breedingId");

-- CreateIndex
CREATE INDEX "TagAssignment_offspringGroupId_idx" ON "public"."TagAssignment"("offspringGroupId");

-- CreateIndex
CREATE INDEX "TagAssignment_invoiceId_idx" ON "public"."TagAssignment"("invoiceId");

-- CreateIndex
CREATE INDEX "TagAssignment_paymentId_idx" ON "public"."TagAssignment"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDef_targetType_key_key" ON "public"."CustomFieldDef"("targetType", "key");

-- CreateIndex
CREATE INDEX "CustomFieldValue_defId_idx" ON "public"."CustomFieldValue"("defId");

-- CreateIndex
CREATE INDEX "CustomFieldValue_targetType_idx" ON "public"."CustomFieldValue"("targetType");

-- CreateIndex
CREATE INDEX "DocumentLink_documentId_idx" ON "public"."DocumentLink"("documentId");

-- CreateIndex
CREATE INDEX "DocumentLink_targetType_idx" ON "public"."DocumentLink"("targetType");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "public"."AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "public"."AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationAccount_provider_idx" ON "public"."IntegrationAccount"("provider");

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Animal" ADD CONSTRAINT "Animal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CycleHistory" ADD CONSTRAINT "CycleHistory_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Breeding" ADD CONSTRAINT "Breeding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Breeding" ADD CONSTRAINT "Breeding_damAnimalId_fkey" FOREIGN KEY ("damAnimalId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Breeding" ADD CONSTRAINT "Breeding_sireAnimalId_fkey" FOREIGN KEY ("sireAnimalId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffspringGroup" ADD CONSTRAINT "OffspringGroup_breedingId_fkey" FOREIGN KEY ("breedingId") REFERENCES "public"."Breeding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_breedingId_fkey" FOREIGN KEY ("breedingId") REFERENCES "public"."Breeding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "public"."OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceLine" ADD CONSTRAINT "InvoiceLine_breedingId_fkey" FOREIGN KEY ("breedingId") REFERENCES "public"."Breeding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceLine" ADD CONSTRAINT "InvoiceLine_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "public"."OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceLine" ADD CONSTRAINT "InvoiceLine_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_breedingId_fkey" FOREIGN KEY ("breedingId") REFERENCES "public"."Breeding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "public"."OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_breedingId_fkey" FOREIGN KEY ("breedingId") REFERENCES "public"."Breeding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "public"."OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_defId_fkey" FOREIGN KEY ("defId") REFERENCES "public"."CustomFieldDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_breedingId_fkey" FOREIGN KEY ("breedingId") REFERENCES "public"."Breeding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "public"."OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentLink" ADD CONSTRAINT "DocumentLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentLink" ADD CONSTRAINT "DocumentLink_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentLink" ADD CONSTRAINT "DocumentLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentLink" ADD CONSTRAINT "DocumentLink_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentLink" ADD CONSTRAINT "DocumentLink_breedingId_fkey" FOREIGN KEY ("breedingId") REFERENCES "public"."Breeding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentLink" ADD CONSTRAINT "DocumentLink_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "public"."OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentLink" ADD CONSTRAINT "DocumentLink_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentLink" ADD CONSTRAINT "DocumentLink_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntegrationAccount" ADD CONSTRAINT "IntegrationAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
