-- migrate:up

-- ─────────────────────────────────────────────────────────────────────────────
-- entity_audit_log: Field-level change tracking for compliance (Enterprise)
-- Captures WHO changed WHAT field, from WHAT value to WHAT value, and WHEN.
-- Immutable append-only table — rows are never updated or deleted.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "public"."entity_audit_log" (
  "id"              BIGSERIAL    PRIMARY KEY,
  "tenantId"        INTEGER      NOT NULL,
  "entityType"      VARCHAR(50)  NOT NULL,
  "entityId"        INTEGER      NOT NULL,
  "action"          VARCHAR(20)  NOT NULL,
  "fieldName"       VARCHAR(100),
  "oldValue"        TEXT,
  "newValue"        TEXT,
  "changedBy"       VARCHAR(64)  NOT NULL,
  "changedByName"   VARCHAR(200),
  "changeSource"    VARCHAR(30)  NOT NULL DEFAULT 'PLATFORM',
  "ip"              VARCHAR(45),
  "requestId"       VARCHAR(64),
  "metadata"        JSONB,
  "createdAt"       TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Primary lookup: all changes for a specific entity
CREATE INDEX "idx_eal_tenant_entity"
  ON "public"."entity_audit_log" ("tenantId", "entityType", "entityId", "createdAt" DESC);

-- Tenant-wide log (admin/compliance review)
CREATE INDEX "idx_eal_tenant_created"
  ON "public"."entity_audit_log" ("tenantId", "createdAt" DESC);

-- Who made changes (user investigation)
CREATE INDEX "idx_eal_changed_by"
  ON "public"."entity_audit_log" ("changedBy", "createdAt" DESC);

COMMENT ON TABLE "public"."entity_audit_log" IS 'Field-level change audit trail for compliance. Enterprise tier only.';


-- ─────────────────────────────────────────────────────────────────────────────
-- entity_activity: Generic activity timeline for entities without dedicated tables
-- Narrative timeline of "what happened" — available to ALL tiers.
-- Entities with existing activity tables (PartyActivity, DealActivity) are
-- queried directly; this table covers all other entities.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "public"."entity_activity" (
  "id"          SERIAL       PRIMARY KEY,
  "tenantId"    INTEGER      NOT NULL,
  "entityType"  VARCHAR(50)  NOT NULL,
  "entityId"    INTEGER      NOT NULL,
  "kind"        VARCHAR(50)  NOT NULL,
  "category"    VARCHAR(30)  NOT NULL DEFAULT 'system',
  "title"       VARCHAR(500) NOT NULL,
  "description" TEXT,
  "metadata"    JSONB,
  "actorId"     VARCHAR(64),
  "actorName"   VARCHAR(200),
  "createdAt"   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Primary lookup: all activity for a specific entity
CREATE INDEX "idx_ea_tenant_entity"
  ON "public"."entity_activity" ("tenantId", "entityType", "entityId", "createdAt" DESC);

-- Tenant-wide recent activity (dashboard feed)
CREATE INDEX "idx_ea_tenant_created"
  ON "public"."entity_activity" ("tenantId", "createdAt" DESC);

COMMENT ON TABLE "public"."entity_activity" IS 'Narrative activity timeline. All tiers. For entities without dedicated activity tables.';


-- migrate:down

DROP TABLE IF EXISTS "public"."entity_activity";
DROP TABLE IF EXISTS "public"."entity_audit_log";
