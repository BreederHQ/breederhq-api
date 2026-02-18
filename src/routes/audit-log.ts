// src/routes/audit-log.ts
// API endpoints for the entity_audit_log and entity_activity tables.
//
// Audit Log:  GET /api/v1/audit-log/:entityType/:entityId  (Enterprise only)
//             GET /api/v1/audit-log                        (Enterprise only, tenant-wide)
//
// Activity:   GET /api/v1/entities/:entityType/:entityId/activity  (All tiers)

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q?.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q?.limit ?? "25", 10) || 25));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

const VALID_ENTITY_TYPES = new Set([
  "ANIMAL", "BREEDING_PLAN", "CONTACT", "ORGANIZATION",
  "OFFSPRING", "LITTER", "CONTRACT", "WAITLIST_ENTRY",
  "SEMEN_INVENTORY", "TENANT", "USER", "INVOICE", "DEAL",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

const auditLogRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  // ─── Audit Log: Entity-specific ────────────────────────────────────────────
  // GET /api/v1/audit-log/:entityType/:entityId
  app.get("/audit-log/:entityType/:entityId", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    // TODO: Check AUDIT_TRAIL entitlement when subscription system is wired up
    // For now, any authenticated user can access

    const { entityType, entityId } = req.params as { entityType: string; entityId: string };
    if (!VALID_ENTITY_TYPES.has(entityType)) {
      return reply.code(400).send({ error: "invalid_entity_type" });
    }

    const entId = parseInt(entityId, 10);
    if (isNaN(entId)) {
      return reply.code(400).send({ error: "invalid_entity_id" });
    }

    const { page, limit, offset } = parsePaging(req.query);
    const q = req.query as any;

    // Build WHERE conditions
    const conditions: string[] = [
      `"tenantId" = ${tenantId}`,
      `"entityType" = '${entityType}'`,
      `"entityId" = ${entId}`,
    ];

    if (q.fieldName) {
      conditions.push(`"fieldName" = '${String(q.fieldName).replace(/'/g, "''")}'`);
    }
    if (q.changedBy) {
      conditions.push(`"changedBy" = '${String(q.changedBy).replace(/'/g, "''")}'`);
    }
    if (q.action) {
      conditions.push(`"action" = '${String(q.action).replace(/'/g, "''")}'`);
    }
    if (q.from) {
      conditions.push(`"createdAt" >= '${String(q.from).replace(/'/g, "''")}'`);
    }
    if (q.to) {
      conditions.push(`"createdAt" <= '${String(q.to).replace(/'/g, "''")}'`);
    }

    const where = conditions.join(" AND ");

    const [items, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "public"."entity_audit_log"
         WHERE ${where}
         ORDER BY "createdAt" DESC
         LIMIT ${limit} OFFSET ${offset}`
      ),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint as count FROM "public"."entity_audit_log" WHERE ${where}`
      ),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return reply.send({ items, total, page, limit });
  });

  // ─── Audit Log: Tenant-wide ────────────────────────────────────────────────
  // GET /api/v1/audit-log
  app.get("/audit-log", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { page, limit, offset } = parsePaging(req.query);
    const q = req.query as any;

    const conditions: string[] = [`"tenantId" = ${tenantId}`];

    if (q.entityType && VALID_ENTITY_TYPES.has(q.entityType)) {
      conditions.push(`"entityType" = '${String(q.entityType)}'`);
    }
    if (q.entityId) {
      const eid = parseInt(q.entityId, 10);
      if (!isNaN(eid)) conditions.push(`"entityId" = ${eid}`);
    }
    if (q.changedBy) {
      conditions.push(`"changedBy" = '${String(q.changedBy).replace(/'/g, "''")}'`);
    }
    if (q.action) {
      conditions.push(`"action" = '${String(q.action).replace(/'/g, "''")}'`);
    }
    if (q.from) {
      conditions.push(`"createdAt" >= '${String(q.from).replace(/'/g, "''")}'`);
    }
    if (q.to) {
      conditions.push(`"createdAt" <= '${String(q.to).replace(/'/g, "''")}'`);
    }

    const where = conditions.join(" AND ");

    const [items, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "public"."entity_audit_log"
         WHERE ${where}
         ORDER BY "createdAt" DESC
         LIMIT ${limit} OFFSET ${offset}`
      ),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint as count FROM "public"."entity_audit_log" WHERE ${where}`
      ),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return reply.send({ items, total, page, limit });
  });

  // ─── Activity: Entity-specific (unified endpoint) ──────────────────────────
  // GET /api/v1/entities/:entityType/:entityId/activity
  app.get("/entities/:entityType/:entityId/activity", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { entityType, entityId } = req.params as { entityType: string; entityId: string };
    if (!VALID_ENTITY_TYPES.has(entityType)) {
      return reply.code(400).send({ error: "invalid_entity_type" });
    }

    const entId = parseInt(entityId, 10);
    if (isNaN(entId)) {
      return reply.code(400).send({ error: "invalid_entity_id" });
    }

    const { page, limit, offset } = parsePaging(req.query);
    const q = req.query as any;

    // For CONTACT/ORGANIZATION, route to PartyActivity table (existing)
    if (entityType === "CONTACT" || entityType === "ORGANIZATION") {
      const conditions: string[] = [
        `"tenantId" = ${tenantId}`,
        `"partyId" = ${entId}`,
      ];
      if (q.category) {
        // PartyActivity doesn't have a category column — filter by kind mapping would be needed
        // For now, skip category filter on legacy table
      }
      if (q.from) conditions.push(`"createdAt" >= '${String(q.from).replace(/'/g, "''")}'`);
      if (q.to) conditions.push(`"createdAt" <= '${String(q.to).replace(/'/g, "''")}'`);

      const where = conditions.join(" AND ");

      const [items, countResult] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(
          `SELECT id, "partyId" as "entityId", 'CONTACT' as "entityType",
                  kind, title, detail as description,
                  metadata, "actorId", null as "actorName", "createdAt",
                  CASE
                    WHEN kind IN ('email_sent','email_received','message_sent','message_received','call_logged') THEN 'communication'
                    WHEN kind IN ('note_added','note_updated') THEN 'note'
                    WHEN kind IN ('invoice_created','payment_received') THEN 'financial'
                    WHEN kind IN ('event_created','event_completed','milestone_reached','follow_up_set','follow_up_completed') THEN 'event'
                    WHEN kind IN ('status_changed','lead_status_changed','tag_added','tag_removed') THEN 'status'
                    WHEN kind IN ('animal_linked','animal_unlinked') THEN 'relationship'
                    WHEN kind IN ('portal_invited','portal_activated') THEN 'portal'
                    ELSE 'system'
                  END as category
           FROM "public"."PartyActivity"
           WHERE ${where}
           ORDER BY "createdAt" DESC
           LIMIT ${limit} OFFSET ${offset}`
        ),
        prisma.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT COUNT(*)::bigint as count FROM "public"."PartyActivity" WHERE ${where}`
        ),
      ]);

      return reply.send({
        items,
        total: Number(countResult[0]?.count ?? 0),
        page,
        limit,
      });
    }

    // For all other entity types, query entity_activity table
    const conditions: string[] = [
      `"tenantId" = ${tenantId}`,
      `"entityType" = '${entityType}'`,
      `"entityId" = ${entId}`,
    ];
    if (q.category) {
      conditions.push(`"category" = '${String(q.category).replace(/'/g, "''")}'`);
    }
    if (q.from) conditions.push(`"createdAt" >= '${String(q.from).replace(/'/g, "''")}'`);
    if (q.to) conditions.push(`"createdAt" <= '${String(q.to).replace(/'/g, "''")}'`);

    const where = conditions.join(" AND ");

    const [items, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "public"."entity_activity"
         WHERE ${where}
         ORDER BY "createdAt" DESC
         LIMIT ${limit} OFFSET ${offset}`
      ),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint as count FROM "public"."entity_activity" WHERE ${where}`
      ),
    ]);

    return reply.send({
      items,
      total: Number(countResult[0]?.count ?? 0),
      page,
      limit,
    });
  });
};

export default auditLogRoutes;
