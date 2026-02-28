-- migrate:up
-- Create ClientVaccinationRecord table for client health portal vaccination tracking

CREATE TABLE "public"."ClientVaccinationRecord" (
  "id" SERIAL PRIMARY KEY,
  "tenantId" integer NOT NULL,
  "offspringId" integer NOT NULL,
  "contactId" integer NOT NULL,
  "protocolKey" varchar(100) NOT NULL,
  "administeredAt" timestamptz NOT NULL,
  "expiresAt" timestamptz,
  "veterinarian" varchar(255),
  "clinic" varchar(255),
  "batchLotNumber" varchar(100),
  "notes" text,
  "documentId" integer,
  "sharedWithBreeder" boolean NOT NULL DEFAULT true,
  "sharedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "ClientVaccinationRecord_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "ClientVaccinationRecord_offspringId_fkey"
    FOREIGN KEY ("offspringId") REFERENCES "public"."Offspring"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "ClientVaccinationRecord_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "public"."Party"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "ClientVaccinationRecord_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id")
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX "idx_client_vaccination_record_tenant_offspring"
  ON "public"."ClientVaccinationRecord" USING btree ("tenantId", "offspringId");

CREATE INDEX "idx_client_vaccination_record_offspring_protocol"
  ON "public"."ClientVaccinationRecord" USING btree ("offspringId", "protocolKey");

-- migrate:down
DROP TABLE IF EXISTS "public"."ClientVaccinationRecord";
