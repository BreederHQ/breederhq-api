// src/routes/usage.ts
// Usage and quota API routes
//
// GET /api/v1/usage            - Get all usage metrics for tenant
// GET /api/v1/usage/:metricKey - Get specific metric details

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  getAllUsageStatuses,
  getUsageStatus,
  type UsageStatus,
} from "../services/subscription/usage-service.js";
import { checkEntitlement } from "../services/subscription/entitlement-service.js";
import type { UsageMetricKey } from "@prisma/client";

const usageRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/usage
   *
   * Returns all usage metrics and their limits for the current tenant.
   * Includes subscription plan information.
   *
   * Response:
   * {
   *   plan: {
   *     name: string,
   *     features: string[]
   *   },
   *   usage: {
   *     animals: { current: number, limit: number | null, percentUsed: number | null },
   *     contacts: { current: number, limit: number | null, percentUsed: number | null },
   *     portalUsers: { current: number, limit: number | null, percentUsed: number | null },
   *     breedingPlans: { current: number, limit: number | null, percentUsed: number | null },
   *     marketplaceListings: { current: number, limit: number | null, percentUsed: number | null },
   *     storage: { current: number, limit: number | null, percentUsed: number | null }
   *   },
   *   warnings: string[]
   * }
   */
  app.get("/usage", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      // Get all usage statuses
      const statuses = await getAllUsageStatuses(tenantId);

      // Get subscription info for plan details
      const subscription = await (app as any).prisma.subscription.findFirst({
        where: { tenantId, status: "ACTIVE" },
        include: {
          product: {
            select: {
              name: true,
              features: true,
            },
          },
        },
      });

      // Map usage statuses to friendly format
      const usage: Record<string, any> = {};
      const warnings: string[] = [];

      for (const status of statuses) {
        const key = getFriendlyMetricName(status.metricKey);
        usage[key] = {
          current: status.currentValue,
          limit: status.limit,
          percentUsed: status.percentUsed,
          isOverLimit: status.isOverLimit,
        };

        // Generate warnings for high usage
        if (status.percentUsed !== null && status.percentUsed >= 90 && !status.isOverLimit) {
          warnings.push(
            `${key} is at ${Math.round(status.percentUsed)}% of quota (${status.currentValue}/${status.limit})`
          );
        }
        if (status.isOverLimit) {
          warnings.push(
            `${key} has exceeded quota limit (${status.currentValue}/${status.limit})`
          );
        }
      }

      return reply.send({
        plan: subscription?.product
          ? {
              name: subscription.product.name,
              features: subscription.product.features || [],
            }
          : null,
        usage,
        warnings,
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get usage");
      return reply.code(500).send({ error: "get_usage_failed" });
    }
  });

  /**
   * GET /api/v1/usage/:metricKey
   *
   * Returns detailed usage information for a specific metric.
   *
   * Params:
   *   metricKey: "animals" | "contacts" | "portalUsers" | "breedingPlans" | "marketplaceListings" | "storage"
   *
   * Response:
   * {
   *   metric: string,
   *   current: number,
   *   limit: number | null,
   *   percentUsed: number | null,
   *   isOverLimit: boolean,
   *   entitlement: {
   *     hasAccess: boolean,
   *     limitValue: number | null,
   *     isUnlimited: boolean
   *   },
   *   canAdd: boolean
   * }
   */
  app.get<{ Params: { metricKey: string } }>("/usage/:metricKey", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const { metricKey } = req.params;

      // Convert friendly name to actual metric key
      const actualMetricKey = getActualMetricKey(metricKey);
      if (!actualMetricKey) {
        return reply.code(400).send({ error: "invalid_metric_key" });
      }

      // Get usage status
      const status = await getUsageStatus(tenantId, actualMetricKey);

      // Get entitlement details
      const entitlementKey = metricToEntitlementKey(actualMetricKey);
      const entitlement = entitlementKey
        ? await checkEntitlement(tenantId, entitlementKey as any)
        : null;

      // Check if can add more
      const canAdd = status.limit === null || status.currentValue < status.limit;

      return reply.send({
        metric: metricKey,
        current: status.currentValue,
        limit: status.limit,
        percentUsed: status.percentUsed,
        isOverLimit: status.isOverLimit,
        entitlement: entitlement
          ? {
              hasAccess: entitlement.hasAccess,
              limitValue: entitlement.limitValue,
              isUnlimited: entitlement.limitValue === null,
            }
          : null,
        canAdd,
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get metric usage");
      return reply.code(500).send({ error: "get_metric_failed" });
    }
  });
};

/**
 * Convert UsageMetricKey to friendly API name
 */
function getFriendlyMetricName(metricKey: UsageMetricKey): string {
  switch (metricKey) {
    case "ANIMAL_COUNT":
      return "animals";
    case "CONTACT_COUNT":
      return "contacts";
    case "PORTAL_USER_COUNT":
      return "portalUsers";
    case "BREEDING_PLAN_COUNT":
      return "breedingPlans";
    case "MARKETPLACE_LISTING_COUNT":
      return "marketplaceListings";
    case "STORAGE_BYTES":
      return "storage";
    default:
      return metricKey.toLowerCase();
  }
}

/**
 * Convert friendly API name to UsageMetricKey
 */
function getActualMetricKey(friendlyName: string): UsageMetricKey | null {
  switch (friendlyName) {
    case "animals":
      return "ANIMAL_COUNT";
    case "contacts":
      return "CONTACT_COUNT";
    case "portalUsers":
      return "PORTAL_USER_COUNT";
    case "breedingPlans":
      return "BREEDING_PLAN_COUNT";
    case "marketplaceListings":
      return "MARKETPLACE_LISTING_COUNT";
    case "storage":
      return "STORAGE_BYTES";
    default:
      return null;
  }
}

/**
 * Convert UsageMetricKey to EntitlementKey
 */
function metricToEntitlementKey(metricKey: UsageMetricKey): string | null {
  switch (metricKey) {
    case "ANIMAL_COUNT":
      return "ANIMAL_QUOTA";
    case "CONTACT_COUNT":
      return "CONTACT_QUOTA";
    case "PORTAL_USER_COUNT":
      return "PORTAL_USER_QUOTA";
    case "BREEDING_PLAN_COUNT":
      return "BREEDING_PLAN_QUOTA";
    case "MARKETPLACE_LISTING_COUNT":
      return "MARKETPLACE_LISTING_QUOTA";
    case "STORAGE_BYTES":
      return "STORAGE_QUOTA_GB";
    default:
      return null;
  }
}

export default usageRoutes;
