// src/middleware/require-permission.ts
// Fastify preHandler factory for capability-based permission checks.
//
// Usage in route definitions:
//   app.put("/breeding-plans", { preHandler: requirePermission("breeding.edit") }, handler);
//   app.get("/animals",       { preHandler: requirePermission("animals.view") }, handler);

import type { FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";
import { can } from "../utils/can.js";

/**
 * Returns a Fastify preHandler that verifies the authenticated user has
 * the requested capability within their current tenant.
 *
 * Flow:
 *  1. Extract userId from session (401 if missing)
 *  2. Extract tenantId from request context (400 if missing)
 *  3. SuperAdmin bypass → always allowed
 *  4. Look up TenantMembership → get role
 *  5. Evaluate can(role, capability) → 403 if denied
 *
 * @param capability Dot-delimited capability string, e.g. "breeding.edit"
 */
export function requirePermission(capability: string) {
  return async function permissionGuard(
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // 1. Authenticated?
    const actorId = getActorId(req);
    if (!actorId) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }

    // 2. Tenant context present?
    const tenantId = req.tenantId;
    if (!tenantId) {
      reply.code(400).send({ error: "tenant_required", message: "X-Tenant-Id header required" });
      return;
    }

    // 3. SuperAdmin bypass
    const user = await prisma.user.findUnique({
      where: { id: actorId },
      select: { isSuperAdmin: true },
    });
    if (user?.isSuperAdmin) return;

    // 4. Look up membership
    const mem = await prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId: actorId, tenantId } },
      select: { role: true },
    });

    if (!mem) {
      reply.code(403).send({ error: "forbidden", message: "Not a member of this tenant" });
      return;
    }

    // 5. Evaluate capability
    if (!can(mem.role, capability)) {
      reply.code(403).send({ error: "forbidden", message: `Missing capability: ${capability}` });
      return;
    }
  };
}
