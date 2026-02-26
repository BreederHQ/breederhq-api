// src/routes/admin-features.ts
// Admin routes for managing features, entitlement keys, and feature analytics
//
// FEATURES
// GET    /api/v1/admin/features                    - List all features (with filters)
// GET    /api/v1/admin/features/:id                - Get feature details
// POST   /api/v1/admin/features                    - Create new feature
// PATCH  /api/v1/admin/features/:id                - Update feature
// POST   /api/v1/admin/features/:id/archive        - Archive feature (soft delete)
// POST   /api/v1/admin/features/:id/restore        - Restore archived feature
// DELETE /api/v1/admin/features/:id                - Permanently delete feature
//
// ENTITLEMENT KEYS
// GET    /api/v1/admin/entitlement-keys            - List all entitlement keys with metadata
// GET    /api/v1/admin/entitlement-keys/:key/features - Get features for an entitlement key
//
// ANALYTICS
// GET    /api/v1/admin/features/analytics          - Get feature usage analytics
// GET    /api/v1/admin/features/checks             - Get recent feature checks
// GET    /api/v1/admin/features/orphaned           - Get orphaned features (in DB, not checked)
// GET    /api/v1/admin/features/ungated            - Get ungated keys (checked, not in DB)
//
// TELEMETRY (public endpoint for client logging)
// POST   /api/v1/features/checks                   - Log feature checks (batch)

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";
import { auditSuccess } from "../services/audit.js";
import type { FeatureModule, EntitlementKey } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Auth Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Require the current user to be a super admin.
 * Returns actor ID if authorized, or sends error response and returns null.
 */
async function requireSuperAdmin(
  req: any,
  reply: any
): Promise<string | null> {
  const actorId = getActorId(req);
  if (!actorId) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { isSuperAdmin: true },
  });

  if (!actor?.isSuperAdmin) {
    reply
      .code(403)
      .send({ error: "forbidden", message: "Super admin access required" });
    return null;
  }

  return actorId;
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const ENTITLEMENT_KEY_METADATA: Record<
  string,
  { name: string; description: string; type: "BOOLEAN" | "QUOTA" }
> = {
  // Surface access
  PLATFORM_ACCESS: {
    name: "Platform Access",
    description: "Access to the main breeder platform",
    type: "BOOLEAN",
  },
  MARKETPLACE_ACCESS: {
    name: "Marketplace Access",
    description: "Access to the breeder marketplace",
    type: "BOOLEAN",
  },
  PORTAL_ACCESS: {
    name: "Portal Access",
    description: "Access to the client portal",
    type: "BOOLEAN",
  },

  // Feature access
  BREEDING_PLANS: {
    name: "Breeding Plans",
    description: "Create and manage breeding plans",
    type: "BOOLEAN",
  },
  FINANCIAL_SUITE: {
    name: "Financial Suite",
    description: "Invoicing, payments, and financial tracking",
    type: "BOOLEAN",
  },
  DOCUMENT_MANAGEMENT: {
    name: "Document Management",
    description: "Upload and manage documents",
    type: "BOOLEAN",
  },
  HEALTH_RECORDS: {
    name: "Health Records",
    description: "Track animal health and vet records",
    type: "BOOLEAN",
  },
  WAITLIST_MANAGEMENT: {
    name: "Waitlist Management",
    description: "Manage buyer waitlists",
    type: "BOOLEAN",
  },
  ADVANCED_REPORTING: {
    name: "Advanced Reporting",
    description: "Advanced analytics and reports",
    type: "BOOLEAN",
  },
  API_ACCESS: {
    name: "API Access",
    description: "Access to the BreederHQ API",
    type: "BOOLEAN",
  },
  MULTI_LOCATION: {
    name: "Multi-Location",
    description: "Manage multiple breeding locations",
    type: "BOOLEAN",
  },
  E_SIGNATURES: {
    name: "E-Signatures",
    description: "Electronic signature capabilities",
    type: "BOOLEAN",
  },
  DATA_EXPORT: {
    name: "Data Export",
    description: "Export data in various formats",
    type: "BOOLEAN",
  },
  GENETICS_STANDARD: {
    name: "Genetics (Standard)",
    description: "Basic genetics features - Punnett squares, trait predictions",
    type: "BOOLEAN",
  },
  GENETICS_PRO: {
    name: "Genetics (Pro)",
    description: "Advanced genetics - COI calculations, best match finder, breeding goals",
    type: "BOOLEAN",
  },

  // Quotas
  ANIMAL_QUOTA: {
    name: "Animal Quota",
    description: "Maximum number of animals",
    type: "QUOTA",
  },
  CONTACT_QUOTA: {
    name: "Contact Quota",
    description: "Maximum number of contacts",
    type: "QUOTA",
  },
  PORTAL_USER_QUOTA: {
    name: "Portal User Quota",
    description: "Maximum number of portal users",
    type: "QUOTA",
  },
  BREEDING_PLAN_QUOTA: {
    name: "Breeding Plan Quota",
    description: "Maximum number of active breeding plans",
    type: "QUOTA",
  },
  MARKETPLACE_LISTING_QUOTA: {
    name: "Marketplace Listing Quota",
    description: "Maximum number of marketplace listings",
    type: "QUOTA",
  },
  STORAGE_QUOTA_GB: {
    name: "Storage (GB)",
    description: "Maximum storage in gigabytes",
    type: "QUOTA",
  },
  SMS_QUOTA: {
    name: "SMS Quota",
    description: "Maximum number of SMS messages per month",
    type: "QUOTA",
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Route Plugin
// ────────────────────────────────────────────────────────────────────────────

const adminFeatureRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────── FEATURES ───────────────────

  /**
   * GET /api/v1/admin/features
   *
   * List all features with optional filtering
   *
   * Query params:
   *   module?: FeatureModule
   *   entitlementKey?: string
   *   includeArchived?: boolean
   *   includeInactive?: boolean
   */
  app.get<{
    Querystring: {
      module?: string;
      entitlementKey?: string;
      includeArchived?: string;
      includeInactive?: string;
    };
  }>("/admin/features", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const { module, entitlementKey, includeArchived, includeInactive } = req.query;

      const where: any = {};

      if (module) {
        where.module = module;
      }

      if (entitlementKey) {
        where.entitlementKey = entitlementKey;
      }

      if (includeArchived !== "true") {
        where.archivedAt = null;
      }

      if (includeInactive !== "true") {
        where.isActive = true;
      }

      const features = await prisma.feature.findMany({
        where,
        orderBy: [{ module: "asc" }, { name: "asc" }],
      });

      return reply.send({ features });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list features");
      return reply.code(500).send({ error: "list_features_failed" });
    }
  });

  /**
   * GET /api/v1/admin/features/:id
   *
   * Get feature details
   */
  app.get<{ Params: { id: string } }>("/admin/features/:id", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const feature = await prisma.feature.findUnique({
        where: { id: Number(req.params.id) },
      });

      if (!feature) {
        return reply.code(404).send({ error: "feature_not_found" });
      }

      return reply.send({ feature });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to get feature");
      return reply.code(500).send({ error: "get_feature_failed" });
    }
  });

  /**
   * POST /api/v1/admin/features
   *
   * Create a new feature
   *
   * Body:
   * {
   *   key: string,           // UPPER_SNAKE_CASE, e.g., "GENETICS_COI_CALCULATIONS"
   *   name: string,          // Display name, e.g., "COI Calculations"
   *   description?: string,
   *   module: FeatureModule,
   *   entitlementKey: EntitlementKey,
   *   uiHint?: string,       // e.g., "Genetics Lab > Analysis Tools"
   *   isActive?: boolean
   * }
   */
  app.post<{
    Body: {
      key: string;
      name: string;
      description?: string;
      module: string;
      entitlementKey: string;
      uiHint?: string;
      isActive?: boolean;
    };
  }>("/admin/features", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const { key, name, description, module, entitlementKey, uiHint, isActive = true } = req.body;

      // Validate key format
      if (!key || !/^[A-Z][A-Z0-9_]*$/.test(key)) {
        return reply.code(400).send({
          error: "invalid_key",
          message: "Key must be UPPER_SNAKE_CASE (e.g., GENETICS_COI_CALC)",
        });
      }

      if (!name || typeof name !== "string") {
        return reply.code(400).send({ error: "invalid_name", message: "Name is required" });
      }

      // Check for duplicate key
      const existing = await prisma.feature.findUnique({ where: { key } });
      if (existing) {
        return reply.code(400).send({
          error: "duplicate_key",
          message: `Feature with key "${key}" already exists`,
        });
      }

      const feature = await prisma.feature.create({
        data: {
          key,
          name,
          description,
          module: module as FeatureModule,
          entitlementKey: entitlementKey as EntitlementKey,
          uiHint,
          isActive,
        },
      });

      await auditSuccess(req, "ADMIN_FEATURE_CREATED" as any, {
        userId: (req as any).userId,
        tenantId: (req as any).tenantId,
        surface: "PLATFORM",
        detail: { featureId: feature.id, key, name, module, entitlementKey },
      });

      return reply.send({ feature });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to create feature");
      return reply.code(500).send({ error: "create_feature_failed" });
    }
  });

  /**
   * PATCH /api/v1/admin/features/:id
   *
   * Update feature details
   */
  app.patch<{
    Params: { id: string };
    Body: {
      key?: string;
      name?: string;
      description?: string | null;
      module?: string;
      entitlementKey?: string;
      uiHint?: string | null;
      isActive?: boolean;
    };
  }>("/admin/features/:id", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const { key, name, description, module, entitlementKey, uiHint, isActive } = req.body;

      // Validate key format if provided
      if (key && !/^[A-Z][A-Z0-9_]*$/.test(key)) {
        return reply.code(400).send({
          error: "invalid_key",
          message: "Key must be UPPER_SNAKE_CASE",
        });
      }

      // Check for duplicate key if changing
      if (key) {
        const existing = await prisma.feature.findFirst({
          where: { key, id: { not: Number(req.params.id) } },
        });
        if (existing) {
          return reply.code(400).send({
            error: "duplicate_key",
            message: `Feature with key "${key}" already exists`,
          });
        }
      }

      const data: any = {};
      if (key !== undefined) data.key = key;
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (module !== undefined) data.module = module as FeatureModule;
      if (entitlementKey !== undefined) data.entitlementKey = entitlementKey as EntitlementKey;
      if (uiHint !== undefined) data.uiHint = uiHint;
      if (isActive !== undefined) data.isActive = isActive;

      const feature = await prisma.feature.update({
        where: { id: Number(req.params.id) },
        data,
      });

      await auditSuccess(req, "ADMIN_FEATURE_UPDATED" as any, {
        userId: (req as any).userId,
        tenantId: (req as any).tenantId,
        surface: "PLATFORM",
        detail: { featureId: feature.id, changes: data },
      });

      return reply.send({ feature });
    } catch (err: any) {
      if (err.code === "P2025") {
        return reply.code(404).send({ error: "feature_not_found" });
      }
      req.log?.error?.({ err }, "Failed to update feature");
      return reply.code(500).send({ error: "update_feature_failed" });
    }
  });

  /**
   * POST /api/v1/admin/features/:id/archive
   *
   * Archive a feature (soft delete)
   */
  app.post<{ Params: { id: string } }>("/admin/features/:id/archive", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const feature = await prisma.feature.update({
        where: { id: Number(req.params.id) },
        data: { archivedAt: new Date() },
      });

      await auditSuccess(req, "ADMIN_FEATURE_ARCHIVED" as any, {
        userId: (req as any).userId,
        tenantId: (req as any).tenantId,
        surface: "PLATFORM",
        detail: { featureId: feature.id, key: feature.key },
      });

      return reply.send({ feature });
    } catch (err: any) {
      if (err.code === "P2025") {
        return reply.code(404).send({ error: "feature_not_found" });
      }
      req.log?.error?.({ err }, "Failed to archive feature");
      return reply.code(500).send({ error: "archive_feature_failed" });
    }
  });

  /**
   * POST /api/v1/admin/features/:id/restore
   *
   * Restore an archived feature
   */
  app.post<{ Params: { id: string } }>("/admin/features/:id/restore", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const feature = await prisma.feature.update({
        where: { id: Number(req.params.id) },
        data: { archivedAt: null },
      });

      await auditSuccess(req, "ADMIN_FEATURE_RESTORED" as any, {
        userId: (req as any).userId,
        tenantId: (req as any).tenantId,
        surface: "PLATFORM",
        detail: { featureId: feature.id, key: feature.key },
      });

      return reply.send({ feature });
    } catch (err: any) {
      if (err.code === "P2025") {
        return reply.code(404).send({ error: "feature_not_found" });
      }
      req.log?.error?.({ err }, "Failed to restore feature");
      return reply.code(500).send({ error: "restore_feature_failed" });
    }
  });

  /**
   * DELETE /api/v1/admin/features/:id
   *
   * Permanently delete a feature (use with caution)
   */
  app.delete<{ Params: { id: string } }>("/admin/features/:id", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const feature = await prisma.feature.delete({
        where: { id: Number(req.params.id) },
      });

      await auditSuccess(req, "ADMIN_FEATURE_DELETED" as any, {
        userId: (req as any).userId,
        tenantId: (req as any).tenantId,
        surface: "PLATFORM",
        detail: { featureId: feature.id, key: feature.key },
      });

      return reply.send({ ok: true });
    } catch (err: any) {
      if (err.code === "P2025") {
        return reply.code(404).send({ error: "feature_not_found" });
      }
      req.log?.error?.({ err }, "Failed to delete feature");
      return reply.code(500).send({ error: "delete_feature_failed" });
    }
  });

  // ─────────────────── ENTITLEMENT KEYS ───────────────────

  /**
   * GET /api/v1/admin/entitlement-keys
   *
   * List all entitlement keys with metadata and counts
   */
  app.get("/admin/entitlement-keys", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      // Get feature counts per entitlement key
      const featureCounts = await prisma.feature.groupBy({
        by: ["entitlementKey"],
        where: { archivedAt: null },
        _count: { id: true },
      });

      // Get product counts per entitlement key
      const productCounts = await prisma.productEntitlement.groupBy({
        by: ["entitlementKey"],
        _count: { id: true },
      });

      const featureCountMap = new Map(
        featureCounts.map((fc) => [fc.entitlementKey, fc._count.id])
      );
      const productCountMap = new Map(
        productCounts.map((pc) => [pc.entitlementKey, pc._count.id])
      );

      const entitlementKeys = Object.entries(ENTITLEMENT_KEY_METADATA).map(([key, meta]) => ({
        key,
        ...meta,
        featureCount: featureCountMap.get(key as EntitlementKey) || 0,
        productCount: productCountMap.get(key as EntitlementKey) || 0,
      }));

      return reply.send({ entitlementKeys });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list entitlement keys");
      return reply.code(500).send({ error: "list_entitlement_keys_failed" });
    }
  });

  /**
   * GET /api/v1/admin/entitlement-keys/:key/features
   *
   * Get all features mapped to an entitlement key
   */
  app.get<{ Params: { key: string } }>(
    "/admin/entitlement-keys/:key/features",
    async (req, reply) => {
      try {
        const actorId = await requireSuperAdmin(req, reply);
        if (!actorId) return;

        const features = await prisma.feature.findMany({
          where: {
            entitlementKey: req.params.key as EntitlementKey,
            archivedAt: null,
          },
          orderBy: { name: "asc" },
        });

        return reply.send({ features });
      } catch (err: any) {
        req.log?.error?.({ err }, "Failed to get features for entitlement key");
        return reply.code(500).send({ error: "get_entitlement_features_failed" });
      }
    }
  );

  // ─────────────────── ANALYTICS ───────────────────

  /**
   * GET /api/v1/admin/features/analytics
   *
   * Get feature usage analytics
   *
   * Query params:
   *   startDate?: string (ISO date)
   *   endDate?: string (ISO date)
   *   module?: FeatureModule
   */
  app.get<{
    Querystring: {
      startDate?: string;
      endDate?: string;
      module?: string;
    };
  }>("/admin/features/analytics", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const { startDate, endDate, module } = req.query;

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      // Base where clause for checks
      const checkWhere: any = {
        timestamp: { gte: start, lte: end },
      };

      // Get all features for metadata
      const featureWhere: any = { archivedAt: null };
      if (module) featureWhere.module = module;

      const features = await prisma.feature.findMany({
        where: featureWhere,
        select: { key: true, name: true, module: true },
      });

      const featureMap = new Map(features.map((f) => [f.key, f]));
      const featureKeys = features.map((f) => f.key);

      if (module) {
        checkWhere.featureKey = { in: featureKeys };
      }

      // Get check aggregates
      const checkAggregates = await prisma.featureCheck.groupBy({
        by: ["featureKey", "granted"],
        where: checkWhere,
        _count: { id: true },
      });

      // Build top features and denied attempts
      const featureStats = new Map<
        string,
        { checkCount: number; grantCount: number; denyCount: number; tenants: Set<number> }
      >();

      for (const agg of checkAggregates) {
        if (!featureStats.has(agg.featureKey)) {
          featureStats.set(agg.featureKey, {
            checkCount: 0,
            grantCount: 0,
            denyCount: 0,
            tenants: new Set(),
          });
        }
        const stats = featureStats.get(agg.featureKey)!;
        stats.checkCount += agg._count.id;
        if (agg.granted) {
          stats.grantCount += agg._count.id;
        } else {
          stats.denyCount += agg._count.id;
        }
      }

      // Get tenant counts for denied features
      const deniedTenantCounts = await prisma.featureCheck.groupBy({
        by: ["featureKey"],
        where: { ...checkWhere, granted: false },
        _count: { tenantId: true },
      });

      const deniedTenantMap = new Map(
        deniedTenantCounts.map((d) => [d.featureKey, d._count.tenantId])
      );

      // Build response arrays
      const topFeatures = Array.from(featureStats.entries())
        .map(([featureKey, stats]) => ({
          featureKey,
          featureName: featureMap.get(featureKey)?.name || featureKey,
          checkCount: stats.checkCount,
          grantCount: stats.grantCount,
          denyCount: stats.denyCount,
        }))
        .sort((a, b) => b.checkCount - a.checkCount)
        .slice(0, 20);

      const deniedAttempts = Array.from(featureStats.entries())
        .filter(([, stats]) => stats.denyCount > 0)
        .map(([featureKey, stats]) => ({
          featureKey,
          featureName: featureMap.get(featureKey)?.name || featureKey,
          denyCount: stats.denyCount,
          tenantCount: deniedTenantMap.get(featureKey) || 0,
        }))
        .sort((a, b) => b.denyCount - a.denyCount)
        .slice(0, 20);

      // Features by module count
      const featuresByModule: Record<string, number> = {};
      for (const f of features) {
        featuresByModule[f.module] = (featuresByModule[f.module] || 0) + 1;
      }

      // Totals
      let totalChecks = 0;
      let totalDenied = 0;
      for (const stats of featureStats.values()) {
        totalChecks += stats.checkCount;
        totalDenied += stats.denyCount;
      }

      return reply.send({
        topFeatures,
        deniedAttempts,
        featuresByModule,
        totalChecks,
        totalDenied,
        period: { start: start.toISOString(), end: end.toISOString() },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to get feature analytics");
      return reply.code(500).send({ error: "get_analytics_failed" });
    }
  });

  /**
   * GET /api/v1/admin/features/checks
   *
   * Get recent feature checks (for debugging)
   *
   * Query params:
   *   featureKey?: string
   *   tenantId?: number
   *   granted?: boolean
   *   limit?: number (default 100, max 500)
   */
  app.get<{
    Querystring: {
      featureKey?: string;
      tenantId?: string;
      granted?: string;
      limit?: string;
    };
  }>("/admin/features/checks", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const { featureKey, tenantId, granted, limit = "100" } = req.query;

      const where: any = {};
      if (featureKey) where.featureKey = featureKey;
      if (tenantId) where.tenantId = Number(tenantId);
      if (granted !== undefined) where.granted = granted === "true";

      const take = Math.min(Number(limit), 500);

      const [checks, total] = await Promise.all([
        prisma.featureCheck.findMany({
          where,
          orderBy: { timestamp: "desc" },
          take,
          include: {
            tenant: { select: { id: true, name: true } },
          },
        }),
        prisma.featureCheck.count({ where }),
      ]);

      // Convert BigInt id to string for JSON serialization
      const serializedChecks = checks.map((c) => ({
        ...c,
        id: c.id.toString(),
      }));

      return reply.send({ checks: serializedChecks, total });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to get feature checks");
      return reply.code(500).send({ error: "get_checks_failed" });
    }
  });

  /**
   * GET /api/v1/admin/features/orphaned
   *
   * Get orphaned features - features in DB but never checked in code
   *
   * Query params:
   *   days?: number (default 30)
   */
  app.get<{
    Querystring: { days?: string };
  }>("/admin/features/orphaned", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const days = Number(req.query.days) || 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get all active features
      const allFeatures = await prisma.feature.findMany({
        where: { archivedAt: null, isActive: true },
      });

      // Get feature keys that have been checked
      const checkedKeys = await prisma.featureCheck.findMany({
        where: { timestamp: { gte: since } },
        distinct: ["featureKey"],
        select: { featureKey: true },
      });

      const checkedKeySet = new Set(checkedKeys.map((c) => c.featureKey));

      // Find features that haven't been checked
      const orphanedFeatures = allFeatures.filter((f) => !checkedKeySet.has(f.key));

      return reply.send({ features: orphanedFeatures });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to get orphaned features");
      return reply.code(500).send({ error: "get_orphaned_failed" });
    }
  });

  /**
   * GET /api/v1/admin/features/ungated
   *
   * Get ungated feature keys - keys checked in code but not registered in DB
   *
   * Query params:
   *   days?: number (default 30)
   */
  app.get<{
    Querystring: { days?: string };
  }>("/admin/features/ungated", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const days = Number(req.query.days) || 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get all registered feature keys
      const registeredFeatures = await prisma.feature.findMany({
        where: { archivedAt: null },
        select: { key: true },
      });
      const registeredKeySet = new Set(registeredFeatures.map((f) => f.key));

      // Get all checked feature keys
      const checkedKeys = await prisma.featureCheck.findMany({
        where: { timestamp: { gte: since } },
        distinct: ["featureKey"],
        select: { featureKey: true },
      });

      // Find keys that are checked but not registered
      const ungatedKeys = checkedKeys
        .map((c) => c.featureKey)
        .filter((key) => !registeredKeySet.has(key));

      return reply.send({ featureKeys: ungatedKeys });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to get ungated feature keys");
      return reply.code(500).send({ error: "get_ungated_failed" });
    }
  });

  // ─────────────────── TELEMETRY (Public Endpoint) ───────────────────

  /**
   * POST /api/v1/features/checks
   *
   * Log feature checks from the client (batch endpoint)
   * This is a public endpoint (no admin auth required) for client telemetry
   *
   * Body:
   * {
   *   checks: Array<{
   *     featureKey: string,
   *     tenantId: number,
   *     userId?: string,
   *     granted: boolean,
   *     context?: string,
   *     timestamp?: string (ISO)
   *   }>
   * }
   */
  app.post<{
    Body: {
      checks: Array<{
        featureKey: string;
        tenantId: number;
        userId?: string;
        granted: boolean;
        context?: string;
        timestamp?: string;
      }>;
    };
  }>("/features/checks", async (req, reply) => {
    try {
      const { checks } = req.body;

      if (!Array.isArray(checks) || checks.length === 0) {
        return reply.code(400).send({ error: "invalid_checks", message: "checks array required" });
      }

      // Limit batch size
      const batch = checks.slice(0, 100);

      const data = batch.map((c) => ({
        featureKey: c.featureKey,
        tenantId: c.tenantId,
        userId: c.userId || null,
        granted: c.granted,
        context: c.context || null,
        timestamp: c.timestamp ? new Date(c.timestamp) : new Date(),
      }));

      await prisma.featureCheck.createMany({ data });

      return reply.send({ logged: data.length });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to log feature checks");
      return reply.code(500).send({ error: "log_checks_failed" });
    }
  });
};

export default adminFeatureRoutes;
