// src/routes/marketplace-profile.ts
// Marketplace profile endpoints for tenant settings (draft + published)
//
// Auth: Requires session + tenant membership (OWNER/ADMIN for writes)
// Endpoints:
//   GET    /api/v1/marketplace/profile       - Read draft + published data
//   PUT    /api/v1/marketplace/profile/draft - Save draft
//   POST   /api/v1/marketplace/profile/publish - Publish (validates + strips address)

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";

// ============================================================================
// Constants
// ============================================================================

const NAMESPACE = "marketplace-profile";

// Fields that must be stripped from published data for privacy
const ADDRESS_FIELDS_TO_STRIP = [
  "streetAddress",
  "streetAddress2",
  "addressLine1",
  "addressLine2",
];

// ============================================================================
// Types
// ============================================================================

interface MarketplaceProfileData {
  draft?: Record<string, unknown>;
  draftUpdatedAt?: string;
  published?: Record<string, unknown>;
  publishedAt?: string;
}

// ============================================================================
// Helpers
// ============================================================================

async function requireTenantMemberOrAdmin(req: FastifyRequest, tenantId: number) {
  const actorId = getActorId(req);
  if (!actorId) return { ok: false as const, code: 401 as const };

  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { isSuperAdmin: true },
  });
  if (user?.isSuperAdmin) return { ok: true as const, role: "OWNER" as const };

  const mem = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId: actorId, tenantId } },
    select: { role: true },
  });
  if (!mem) return { ok: false as const, code: 403 as const };
  return { ok: true as const, role: mem.role };
}

function isAdminLike(role?: string | null) {
  return role === "OWNER" || role === "ADMIN";
}

async function readProfileSetting(tenantId: number): Promise<MarketplaceProfileData> {
  const row = await prisma.tenantSetting.findUnique({
    where: { tenantId_namespace: { tenantId, namespace: NAMESPACE } },
    select: { data: true },
  });
  return (row?.data as MarketplaceProfileData) ?? {};
}

async function writeProfileSetting(
  tenantId: number,
  data: MarketplaceProfileData,
  userId: string | null
) {
  return prisma.tenantSetting.upsert({
    where: { tenantId_namespace: { tenantId, namespace: NAMESPACE } },
    update: { data: data as object, version: { increment: 1 }, updatedBy: userId ?? undefined },
    create: { tenantId, namespace: NAMESPACE, data: data as object, version: 1, updatedBy: userId ?? undefined },
    select: { data: true, version: true, updatedAt: true },
  });
}

/**
 * Strip street address fields from data for privacy on publish.
 */
function stripAddressFields(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  for (const field of ADDRESS_FIELDS_TO_STRIP) {
    delete result[field];
  }
  // Also handle nested address object
  if (result.address && typeof result.address === "object") {
    const addr = { ...(result.address as Record<string, unknown>) };
    for (const field of ADDRESS_FIELDS_TO_STRIP) {
      delete addr[field];
    }
    // Remove street-related fields
    delete addr.street;
    delete addr.street2;
    result.address = addr;
  }
  return result;
}

/**
 * Validate that minimum required fields are present for publishing.
 */
function validatePublishPayload(
  data: Record<string, unknown>
): { valid: true } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  // businessName required
  if (!data.businessName || typeof data.businessName !== "string" || !data.businessName.trim()) {
    errors.push("businessName is required");
  }

  // breeds >= 1
  if (!Array.isArray(data.breeds) || data.breeds.length < 1) {
    errors.push("at least one breed is required");
  }

  // listedPrograms >= 1
  if (!Array.isArray(data.listedPrograms) || data.listedPrograms.length < 1) {
    errors.push("at least one listed program is required");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
}

// ============================================================================
// Routes
// ============================================================================

const marketplaceProfileRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // GET /profile - Read marketplace profile (draft + published)
  // --------------------------------------------------------------------------
  app.get("/profile", async (req, reply) => {
    const tenantId = (req as unknown as { tenantId: number | null }).tenantId;

    // For marketplace surface (no tenant context), return 400
    if (!tenantId) {
      return reply.code(400).send({
        error: "tenant_required",
        message: "X-Tenant-Id header required for profile endpoints",
      });
    }

    const gate = await requireTenantMemberOrAdmin(req, tenantId);
    if (!gate.ok) {
      return reply.code(gate.code).send({
        error: gate.code === 401 ? "unauthorized" : "forbidden",
      });
    }

    const data = await readProfileSetting(tenantId);

    return reply.send({
      draft: data.draft ?? null,
      draftUpdatedAt: data.draftUpdatedAt ?? null,
      published: data.published ?? null,
      publishedAt: data.publishedAt ?? null,
    });
  });

  // --------------------------------------------------------------------------
  // PUT /profile/draft - Save draft marketplace profile
  // --------------------------------------------------------------------------
  app.put<{ Body: Record<string, unknown> }>("/profile/draft", async (req, reply) => {
    const tenantId = (req as unknown as { tenantId: number | null }).tenantId;

    if (!tenantId) {
      return reply.code(400).send({
        error: "tenant_required",
        message: "X-Tenant-Id header required for profile endpoints",
      });
    }

    const gate = await requireTenantMemberOrAdmin(req, tenantId);
    if (!gate.ok) {
      return reply.code(gate.code).send({
        error: gate.code === 401 ? "unauthorized" : "forbidden",
      });
    }

    if (!isAdminLike(gate.role)) {
      return reply.code(403).send({ error: "forbidden", message: "Admin role required" });
    }

    const draftPayload = req.body ?? {};
    if (typeof draftPayload !== "object") {
      return reply.code(400).send({ error: "invalid_payload" });
    }

    const existing = await readProfileSetting(tenantId);
    const now = new Date().toISOString();

    const updated: MarketplaceProfileData = {
      ...existing,
      draft: draftPayload,
      draftUpdatedAt: now,
    };

    await writeProfileSetting(tenantId, updated, getActorId(req));

    return reply.send({
      ok: true,
      draftUpdatedAt: now,
    });
  });

  // --------------------------------------------------------------------------
  // POST /profile/publish - Publish marketplace profile
  // --------------------------------------------------------------------------
  app.post<{ Body: Record<string, unknown> }>("/profile/publish", async (req, reply) => {
    const tenantId = (req as unknown as { tenantId: number | null }).tenantId;

    if (!tenantId) {
      return reply.code(400).send({
        error: "tenant_required",
        message: "X-Tenant-Id header required for profile endpoints",
      });
    }

    const gate = await requireTenantMemberOrAdmin(req, tenantId);
    if (!gate.ok) {
      return reply.code(gate.code).send({
        error: gate.code === 401 ? "unauthorized" : "forbidden",
      });
    }

    if (!isAdminLike(gate.role)) {
      return reply.code(403).send({ error: "forbidden", message: "Admin role required" });
    }

    const publishPayload = req.body ?? {};
    if (typeof publishPayload !== "object") {
      return reply.code(400).send({ error: "invalid_payload" });
    }

    // Validate required fields
    const validation = validatePublishPayload(publishPayload);
    if (!validation.valid) {
      return reply.code(400).send({
        error: "validation_failed",
        errors: validation.errors,
      });
    }

    // Strip address fields from published data for privacy
    const sanitizedPublished = stripAddressFields(publishPayload);

    const existing = await readProfileSetting(tenantId);
    const now = new Date().toISOString();

    const updated: MarketplaceProfileData = {
      ...existing,
      published: sanitizedPublished,
      publishedAt: now,
    };

    await writeProfileSetting(tenantId, updated, getActorId(req));

    return reply.send({
      ok: true,
      publishedAt: now,
    });
  });
};

export default marketplaceProfileRoutes;
