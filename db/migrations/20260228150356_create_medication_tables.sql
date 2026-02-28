-- migrate:up transaction:false
-- Create MedicationCourse and MedicationDose tables for medication/treatment tracking.
-- Pattern follows VaccinationRecord + SupplementSchedule/SupplementAdministration.
-- transaction:false required because ALTER TYPE ... ADD VALUE cannot run inside a transaction.

-- Add medication notification types to the NotificationType enum
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'medication_overdue';
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'medication_withdrawal_expiring_7d';
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'medication_withdrawal_cleared';

-- Table 1: MedicationCourse (the prescription/treatment course)
CREATE TABLE "public"."MedicationCourse" (
  "id"                    SERIAL PRIMARY KEY,
  "tenantId"              integer NOT NULL,
  "animalId"              integer NOT NULL,
  "medicationName"        varchar(255) NOT NULL,
  "category"              varchar(50) NOT NULL DEFAULT 'OTHER',
  "isControlledSubstance" boolean NOT NULL DEFAULT false,
  "dosageAmount"          decimal(10,3),
  "dosageUnit"            varchar(30),
  "administrationRoute"   varchar(50),
  "frequency"             varchar(30) DEFAULT 'ONCE',
  "startDate"             date NOT NULL,
  "endDate"               date,
  "nextDueDate"           date,
  "totalDoses"            integer,
  "completedDoses"        integer NOT NULL DEFAULT 0,
  "prescribingVet"        varchar(255),
  "clinic"                varchar(255),
  "rxNumber"              varchar(100),
  "lotBatchNumber"        varchar(100),
  "refillsTotal"          integer,
  "refillsRemaining"      integer,
  "withdrawalPeriodDays"  integer,
  "withdrawalExpiryDate"  date,
  "costPerDose"           decimal(10,2),
  "status"                varchar(30) NOT NULL DEFAULT 'ACTIVE',
  "discontinuedReason"    text,
  "notes"                 text,
  "documentId"            integer,
  "deletedAt"             timestamptz,
  "createdAt"             timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt"             timestamp(3) without time zone NOT NULL,
  "createdBy"             integer,
  "updatedBy"             integer,
  CONSTRAINT "MedicationCourse_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "MedicationCourse_animalId_fkey"
    FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "MedicationCourse_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id")
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX "MedicationCourse_tenantId_animalId_idx"
  ON "public"."MedicationCourse" ("tenantId", "animalId") WHERE "deletedAt" IS NULL;
CREATE INDEX "MedicationCourse_tenantId_status_idx"
  ON "public"."MedicationCourse" ("tenantId", "status") WHERE "deletedAt" IS NULL;
CREATE INDEX "MedicationCourse_withdrawalExpiryDate_idx"
  ON "public"."MedicationCourse" ("withdrawalExpiryDate")
  WHERE "withdrawalExpiryDate" IS NOT NULL AND "deletedAt" IS NULL;
CREATE INDEX "MedicationCourse_nextDueDate_idx"
  ON "public"."MedicationCourse" ("nextDueDate")
  WHERE "nextDueDate" IS NOT NULL AND "deletedAt" IS NULL;

-- Table 2: MedicationDose (individual administration records)
CREATE TABLE "public"."MedicationDose" (
  "id"              SERIAL PRIMARY KEY,
  "tenantId"        integer NOT NULL,
  "courseId"         integer NOT NULL,
  "animalId"        integer NOT NULL,
  "doseNumber"      integer,
  "administeredAt"  timestamptz NOT NULL,
  "actualDosage"    varchar(100),
  "givenBy"         varchar(255),
  "adverseReaction" text,
  "notes"           text,
  "createdAt"       timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "createdBy"       integer,
  CONSTRAINT "MedicationDose_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "MedicationDose_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "public"."MedicationCourse"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "MedicationDose_animalId_fkey"
    FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id")
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX "MedicationDose_courseId_idx"
  ON "public"."MedicationDose" ("courseId");
CREATE INDEX "MedicationDose_tenantId_animalId_idx"
  ON "public"."MedicationDose" ("tenantId", "animalId");
CREATE INDEX "MedicationDose_administeredAt_idx"
  ON "public"."MedicationDose" ("administeredAt");

-- migrate:down
DROP TABLE IF EXISTS "public"."MedicationDose";
DROP TABLE IF EXISTS "public"."MedicationCourse";
-- Note: PostgreSQL cannot remove enum values; medication_overdue, medication_withdrawal_expiring_7d,
-- medication_withdrawal_cleared will remain in the NotificationType enum.
