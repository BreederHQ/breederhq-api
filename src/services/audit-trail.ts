// src/services/audit-trail.ts
// Field-level change audit trail for entity_audit_log table.
// Never throws — fail-open design (same pattern as audit.ts).
//
// Usage:
//   import { auditCreate, auditUpdate, auditDelete } from "../services/audit-trail.js";
//   await auditUpdate("ANIMAL", animalId, beforeData, afterData, ctx);

import prisma from "../prisma.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AuditEntityType =
  | "ANIMAL"
  | "BREEDING_PLAN"
  | "CONTACT"
  | "ORGANIZATION"
  | "OFFSPRING"
  | "LITTER"
  | "CONTRACT"
  | "WAITLIST_ENTRY"
  | "SEMEN_INVENTORY"
  | "TENANT"
  | "USER"
  | "INVOICE";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "ARCHIVE";

export type AuditChangeSource = "PLATFORM" | "PORTAL" | "API" | "SYSTEM";

export interface AuditContext {
  tenantId: number;
  userId: string;
  userName?: string;
  changeSource?: AuditChangeSource;
  ip?: string;
  requestId?: string;
}

interface AuditEntry {
  tenantId: number;
  entityType: string;
  entityId: number;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  changedByName: string | null;
  changeSource: string;
  ip: string | null;
  requestId: string | null;
  metadata: Record<string, unknown> | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Fields to always ignore when diffing — these change on every write and clutter the log */
const IGNORED_FIELDS = new Set([
  "updatedAt",
  "createdAt",
  "version",
]);

/** Per-entity ignored fields (some entities have noisy fields) */
const ENTITY_IGNORED_FIELDS: Partial<Record<AuditEntityType, Set<string>>> = {
  // Add entity-specific ignores here as needed, e.g.:
  // ANIMAL: new Set(["lastSeenAt"]),
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function serializeValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function shouldIgnoreField(entityType: AuditEntityType, field: string): boolean {
  if (IGNORED_FIELDS.has(field)) return true;
  return ENTITY_IGNORED_FIELDS[entityType]?.has(field) ?? false;
}

/**
 * Resolve actor display name from the User table when not supplied.
 * Returns null if the user cannot be found.
 */
async function resolveActorName(userId: string | undefined | null): Promise<string | null> {
  if (!userId || userId === "unknown") return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    if (user) return `${user.firstName} ${user.lastName}`.trim() || null;
  } catch {
    // Non-critical — fail silently
  }
  return null;
}

/**
 * Diff two objects and return per-field change entries.
 *
 * Only compares keys present in `after`. Keys only in `before` are
 * unselected fields (Prisma select clause) — not actual deletions.
 * Without this guard, every update generates phantom audit rows for
 * fields the select clause omitted (e.g. collarLocked, lineTypes).
 */
function diffFields(
  entityType: AuditEntityType,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { fieldName: string; oldValue: string | null; newValue: string | null }[] {
  const changes: { fieldName: string; oldValue: string | null; newValue: string | null }[] = [];

  for (const key of Object.keys(after)) {
    if (shouldIgnoreField(entityType, key)) continue;

    const oldVal = serializeValue(before[key]);
    const newVal = serializeValue(after[key]);

    if (oldVal !== newVal) {
      changes.push({ fieldName: key, oldValue: oldVal, newValue: newVal });
    }
  }

  return changes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk insert helper (uses raw SQL for performance)
// ─────────────────────────────────────────────────────────────────────────────

async function insertAuditEntries(entries: AuditEntry[]): Promise<void> {
  if (entries.length === 0) return;

  // Use createMany for simplicity since Prisma supports it on Postgres
  await prisma.$executeRawUnsafe(
    `INSERT INTO "public"."entity_audit_log"
       ("tenantId", "entityType", "entityId", "action", "fieldName",
        "oldValue", "newValue", "changedBy", "changedByName",
        "changeSource", "ip", "requestId", "metadata")
     SELECT t."tenantId", t."entityType", t."entityId", t."action", t."fieldName",
            t."oldValue", t."newValue", t."changedBy", t."changedByName",
            t."changeSource", t."ip", t."requestId", t."metadata"::jsonb
     FROM UNNEST(
       $1::int[], $2::varchar[], $3::int[], $4::varchar[], $5::varchar[],
       $6::text[], $7::text[], $8::varchar[], $9::varchar[],
       $10::varchar[], $11::varchar[], $12::varchar[], $13::text[]
     ) AS t("tenantId", "entityType", "entityId", "action", "fieldName",
            "oldValue", "newValue", "changedBy", "changedByName",
            "changeSource", "ip", "requestId", "metadata")`,
    entries.map((e) => e.tenantId),
    entries.map((e) => e.entityType),
    entries.map((e) => e.entityId),
    entries.map((e) => e.action),
    entries.map((e) => e.fieldName),
    entries.map((e) => e.oldValue),
    entries.map((e) => e.newValue),
    entries.map((e) => e.changedBy),
    entries.map((e) => e.changedByName),
    entries.map((e) => e.changeSource),
    entries.map((e) => e.ip),
    entries.map((e) => e.requestId),
    entries.map((e) => (e.metadata ? JSON.stringify(e.metadata) : null)),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log a CREATE action — records all initial field values.
 */
export async function auditCreate(
  entityType: AuditEntityType,
  entityId: number,
  data: Record<string, unknown>,
  ctx: AuditContext,
): Promise<void> {
  try {
    const changedByName = ctx.userName || (await resolveActorName(ctx.userId));

    const entries: AuditEntry[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (shouldIgnoreField(entityType, key)) continue;
      const serialized = serializeValue(value);
      if (serialized === null) continue; // skip null/undefined initial values
      entries.push({
        tenantId: ctx.tenantId,
        entityType,
        entityId,
        action: "CREATE",
        fieldName: key,
        oldValue: null,
        newValue: serialized,
        changedBy: ctx.userId,
        changedByName: changedByName ?? null,
        changeSource: ctx.changeSource ?? "PLATFORM",
        ip: ctx.ip ?? null,
        requestId: ctx.requestId ?? null,
        metadata: null,
      });
    }
    await insertAuditEntries(entries);
  } catch (err) {
    console.error("[audit-trail] Failed to log CREATE:", {
      entityType,
      entityId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Log an UPDATE action — diffs before/after states and records per-field changes.
 *
 * @param before - The entity state BEFORE the update (fetch this first!)
 * @param after  - The entity state AFTER the update
 */
export async function auditUpdate(
  entityType: AuditEntityType,
  entityId: number,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ctx: AuditContext,
): Promise<void> {
  try {
    const changes = diffFields(entityType, before, after);
    if (changes.length === 0) return; // Nothing actually changed

    const changedByName = ctx.userName || (await resolveActorName(ctx.userId));

    const entries: AuditEntry[] = changes.map((change) => ({
      tenantId: ctx.tenantId,
      entityType,
      entityId,
      action: "UPDATE",
      fieldName: change.fieldName,
      oldValue: change.oldValue,
      newValue: change.newValue,
      changedBy: ctx.userId,
      changedByName: changedByName ?? null,
      changeSource: ctx.changeSource ?? "PLATFORM",
      ip: ctx.ip ?? null,
      requestId: ctx.requestId ?? null,
      metadata: null,
    }));
    await insertAuditEntries(entries);
  } catch (err) {
    console.error("[audit-trail] Failed to log UPDATE:", {
      entityType,
      entityId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Log a DELETE action.
 */
export async function auditDelete(
  entityType: AuditEntityType,
  entityId: number,
  ctx: AuditContext,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await insertAuditEntries([
      {
        tenantId: ctx.tenantId,
        entityType,
        entityId,
        action: "DELETE",
        fieldName: null,
        oldValue: null,
        newValue: null,
        changedBy: ctx.userId,
        changedByName: ctx.userName ?? null,
        changeSource: ctx.changeSource ?? "PLATFORM",
        ip: ctx.ip ?? null,
        requestId: ctx.requestId ?? null,
        metadata: metadata ?? null,
      },
    ]);
  } catch (err) {
    console.error("[audit-trail] Failed to log DELETE:", {
      entityType,
      entityId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Log an ARCHIVE action.
 */
export async function auditArchive(
  entityType: AuditEntityType,
  entityId: number,
  ctx: AuditContext,
): Promise<void> {
  try {
    await insertAuditEntries([
      {
        tenantId: ctx.tenantId,
        entityType,
        entityId,
        action: "ARCHIVE",
        fieldName: "status",
        oldValue: null,
        newValue: '"ARCHIVED"',
        changedBy: ctx.userId,
        changedByName: ctx.userName ?? null,
        changeSource: ctx.changeSource ?? "PLATFORM",
        ip: ctx.ip ?? null,
        requestId: ctx.requestId ?? null,
        metadata: null,
      },
    ]);
  } catch (err) {
    console.error("[audit-trail] Failed to log ARCHIVE:", {
      entityType,
      entityId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Log a RESTORE action.
 */
export async function auditRestore(
  entityType: AuditEntityType,
  entityId: number,
  ctx: AuditContext,
): Promise<void> {
  try {
    await insertAuditEntries([
      {
        tenantId: ctx.tenantId,
        entityType,
        entityId,
        action: "RESTORE",
        fieldName: "status",
        oldValue: '"ARCHIVED"',
        newValue: null,
        changedBy: ctx.userId,
        changedByName: ctx.userName ?? null,
        changeSource: ctx.changeSource ?? "PLATFORM",
        ip: ctx.ip ?? null,
        requestId: ctx.requestId ?? null,
        metadata: null,
      },
    ]);
  } catch (err) {
    console.error("[audit-trail] Failed to log RESTORE:", {
      entityType,
      entityId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
