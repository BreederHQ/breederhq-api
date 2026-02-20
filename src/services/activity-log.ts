// src/services/activity-log.ts
// Generic activity logging for the entity_activity table.
// Never throws — fail-open design (same pattern as audit.ts).
//
// For entities with dedicated activity tables (PartyActivity, DealActivity),
// continue using their existing logging functions. This service covers
// everything else: animals, breeding plans, offspring, contracts, etc.
//
// Usage:
//   import { logEntityActivity } from "../services/activity-log.js";
//   await logEntityActivity({
//     tenantId: 123, entityType: "ANIMAL", entityId: 456,
//     kind: "ownership_transferred", category: "relationship",
//     title: "Ownership transferred to Jane Smith",
//     actorId: "user_abc", actorName: "John Doe",
//   });

import prisma from "../prisma.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ActivityEntityType =
  | "ANIMAL"
  | "BREEDING_PLAN"
  | "CONTACT"
  | "ORGANIZATION"
  | "OFFSPRING"
  | "LITTER"
  | "CONTRACT"
  | "WAITLIST_ENTRY"
  | "SEMEN_INVENTORY"
  | "INVOICE"
  | "DEAL";

export type TimelineCategory =
  | "communication"
  | "financial"
  | "status"
  | "note"
  | "event"
  | "portal"
  | "system"
  | "document"
  | "health"
  | "relationship";

export interface LogActivityParams {
  tenantId: number;
  entityType: ActivityEntityType;
  entityId: number;
  kind: string;
  category: TimelineCategory;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  actorId?: string;
  actorName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve actor display name from the User table when not supplied.
 * Returns null if the user cannot be found.
 */
async function resolveActorName(actorId: string | undefined | null): Promise<string | null> {
  if (!actorId || actorId === "unknown") return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: actorId },
      select: { firstName: true, lastName: true },
    });
    if (user) return `${user.firstName} ${user.lastName}`.trim() || null;
  } catch {
    // Non-critical — fail silently
  }
  return null;
}

/**
 * Log a narrative activity event for an entity.
 * Never throws — silently logs to console on failure.
 * If actorName is not provided, resolves it from the User table.
 */
export async function logEntityActivity(params: LogActivityParams): Promise<void> {
  try {
    const actorName = params.actorName || (await resolveActorName(params.actorId));

    await prisma.$executeRawUnsafe(
      `INSERT INTO "public"."entity_activity"
         ("tenantId", "entityType", "entityId", "kind", "category",
          "title", "description", "metadata", "actorId", "actorName")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      params.tenantId,
      params.entityType,
      params.entityId,
      params.kind,
      params.category,
      params.title,
      params.description ?? null,
      params.metadata ? JSON.stringify(params.metadata) : null,
      params.actorId ?? null,
      actorName,
    );
  } catch (err) {
    console.error("[activity-log] Failed to log activity:", {
      entityType: params.entityType,
      entityId: params.entityId,
      kind: params.kind,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Batch-insert multiple activity events. Useful for migrations or bulk operations.
 * Resolves missing actor names from the User table.
 * Never throws.
 */
export async function logEntityActivitiesBatch(
  entries: LogActivityParams[],
): Promise<void> {
  if (entries.length === 0) return;

  try {
    // Resolve missing actor names in bulk
    const needsName = entries.filter((e) => !e.actorName && e.actorId && e.actorId !== "unknown");
    const uniqueIds = [...new Set(needsName.map((e) => e.actorId!))];
    const nameMap = new Map<string, string>();
    if (uniqueIds.length > 0) {
      try {
        const users = await prisma.user.findMany({
          where: { id: { in: uniqueIds } },
          select: { id: true, firstName: true, lastName: true },
        });
        for (const u of users) {
          const name = `${u.firstName} ${u.lastName}`.trim();
          if (name) nameMap.set(u.id, name);
        }
      } catch {
        // Non-critical
      }
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "public"."entity_activity"
         ("tenantId", "entityType", "entityId", "kind", "category",
          "title", "description", "metadata", "actorId", "actorName")
       SELECT * FROM UNNEST(
         $1::int[], $2::varchar[], $3::int[], $4::varchar[], $5::varchar[],
         $6::varchar[], $7::text[], $8::jsonb[], $9::varchar[], $10::varchar[]
       )`,
      entries.map((e) => e.tenantId),
      entries.map((e) => e.entityType),
      entries.map((e) => e.entityId),
      entries.map((e) => e.kind),
      entries.map((e) => e.category),
      entries.map((e) => e.title),
      entries.map((e) => e.description ?? null),
      entries.map((e) => (e.metadata ? JSON.stringify(e.metadata) : null)),
      entries.map((e) => e.actorId ?? null),
      entries.map((e) => e.actorName || (e.actorId ? nameMap.get(e.actorId) ?? null : null)),
    );
  } catch (err) {
    console.error("[activity-log] Failed to batch-log activities:", {
      count: entries.length,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
