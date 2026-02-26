-- migrate:up
-- Create ClientHealthRecord table for client health portal health record uploads (Phase 2)

CREATE TABLE "public"."ClientHealthRecord" (
  "id" SERIAL PRIMARY KEY,
  "tenantId" integer NOT NULL,
  "offspringId" integer NOT NULL,
  "contactId" integer NOT NULL,
  "recordType" varchar(50) NOT NULL,
  "occurredAt" timestamptz NOT NULL,
  "vetClinic" varchar(255),
  "veterinarian" varchar(255),
  "weight" decimal(10,2),
  "weightUnit" varchar(10),
  "findings" text,
  "recommendations" text,
  "documentId" integer,
  "sharedWithBreeder" boolean NOT NULL DEFAULT true,
  "sharedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "ClientHealthRecord_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "ClientHealthRecord_offspringId_fkey"
    FOREIGN KEY ("offspringId") REFERENCES "public"."Offspring"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "ClientHealthRecord_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "public"."Party"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "ClientHealthRecord_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id")
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX "idx_client_health_record_tenant_offspring"
  ON "public"."ClientHealthRecord" USING btree ("tenantId", "offspringId");

CREATE INDEX "idx_client_health_record_contact"
  ON "public"."ClientHealthRecord" USING btree ("contactId");

CREATE INDEX "idx_client_health_record_type"
  ON "public"."ClientHealthRecord" USING btree ("recordType");

-- migrate:down
DROP TABLE IF EXISTS "public"."ClientHealthRecord";
