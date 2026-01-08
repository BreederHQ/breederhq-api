/**
 * Quota Enforcement Middleware
 *
 * Middleware functions to enforce subscription-based quotas and entitlements.
 * Use these to protect routes that require specific entitlements or quota limits.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { EntitlementKey, UsageMetricKey } from "@prisma/client";
import type { ActorContextRequest } from "./actor-context.js";
import {
  checkEntitlement,
  getQuotaLimit,
} from "../services/subscription/entitlement-service.js";
import {
  canAddResource,
  getUsageStatus,
} from "../services/subscription/usage-service.js";

// ---------- Error Types ----------

export type QuotaEnforcementError = {
  error: string;
  code:
    | "ENTITLEMENT_REQUIRED"
    | "QUOTA_EXCEEDED"
    | "SUBSCRIPTION_EXPIRED"
    | "SUBSCRIPTION_REQUIRED";
  message: string;
  details?: {
    requiredEntitlement?: EntitlementKey;
    currentUsage?: number;
    limit?: number;
    upgradeUrl?: string;
  };
};

// ---------- Entitlement Middleware ----------

/**
 * Require that the tenant has a specific entitlement.
 * Blocks request with 403 if entitlement is not granted.
 *
 * Example:
 *   fastify.get('/api/v1/marketplace/programs',
 *     { preHandler: [requireAuth, requireEntitlement('MARKETPLACE_ACCESS')] },
 *     async (req, reply) => { ... }
 *   )
 */
export function requireEntitlement(key: EntitlementKey) {
  return async (
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void | FastifyReply> => {
    const actorReq = req as unknown as ActorContextRequest;

    if (!actorReq.tenantId) {
      return reply.code(403).send({
        error: "ENTITLEMENT_REQUIRED",
        code: "ENTITLEMENT_REQUIRED",
        message: "No tenant context available",
        details: {
          requiredEntitlement: key,
        },
      } as QuotaEnforcementError);
    }

    const result = await checkEntitlement(actorReq.tenantId, key);

    if (!result.hasAccess) {
      return reply.code(403).send({
        error: "ENTITLEMENT_REQUIRED",
        code: "ENTITLEMENT_REQUIRED",
        message:
          result.reason ||
          `Your plan does not include access to ${key.replace(/_/g, " ").toLowerCase()}`,
        details: {
          requiredEntitlement: key,
          upgradeUrl: "/settings/billing",
        },
      } as QuotaEnforcementError);
    }

    // Entitlement granted, continue
  };
}

/**
 * Check quota before allowing creation of a resource.
 * Blocks request with 403 if quota would be exceeded.
 *
 * Example:
 *   fastify.post('/api/v1/animals',
 *     { preHandler: [requireAuth, checkQuota('ANIMAL_COUNT')] },
 *     async (req, reply) => { ... }
 *   )
 */
export function checkQuota(
  metricKey: Extract<
    UsageMetricKey,
    | "ANIMAL_COUNT"
    | "CONTACT_COUNT"
    | "PORTAL_USER_COUNT"
    | "BREEDING_PLAN_COUNT"
    | "MARKETPLACE_LISTING_COUNT"
  >,
  countToAdd: number = 1
) {
  return async (
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void | FastifyReply> => {
    const actorReq = req as unknown as ActorContextRequest;

    if (!actorReq.tenantId) {
      return reply.code(403).send({
        error: "QUOTA_EXCEEDED",
        code: "QUOTA_EXCEEDED",
        message: "No tenant context available",
      } as QuotaEnforcementError);
    }

    const canAdd = await canAddResource(
      actorReq.tenantId,
      metricKey,
      countToAdd
    );

    if (!canAdd) {
      const status = await getUsageStatus(actorReq.tenantId, metricKey);

      const resourceName = metricKey
        .replace("_COUNT", "")
        .replace(/_/g, " ")
        .toLowerCase();

      return reply.code(403).send({
        error: "QUOTA_EXCEEDED",
        code: "QUOTA_EXCEEDED",
        message: `You've reached your limit of ${status.limit} ${resourceName}${status.limit !== 1 ? "s" : ""}. Upgrade your plan to add more.`,
        details: {
          currentUsage: status.currentValue,
          limit: status.limit || undefined,
          upgradeUrl: "/settings/billing/upgrade",
        },
      } as QuotaEnforcementError);
    }

    // Quota available, continue
  };
}

/**
 * Check subscription status and warn/block based on status.
 * - TRIAL: Add header indicating trial status
 * - ACTIVE: Continue normally
 * - PAST_DUE: Add warning header, allow access (grace period)
 * - EXPIRED/CANCELED: Block with 403
 *
 * Example:
 *   fastify.register((f, opts, done) => {
 *     f.addHook('preHandler', checkSubscriptionStatus());
 *     // ... routes that require active subscription
 *     done();
 *   });
 */
export function checkSubscriptionStatus() {
  return async (
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void | FastifyReply> => {
    const actorReq = req as unknown as ActorContextRequest;

    if (!actorReq.tenantId) {
      // No subscription required if no tenant context
      return;
    }

    const prisma = (await import("../prisma.js")).default;

    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId: actorReq.tenantId,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription) {
      return reply.code(403).send({
        error: "SUBSCRIPTION_REQUIRED",
        code: "SUBSCRIPTION_REQUIRED",
        message:
          "No subscription found. Please subscribe to access this feature.",
        details: {
          upgradeUrl: "/settings/billing",
        },
      } as QuotaEnforcementError);
    }

    // Handle different subscription statuses
    switch (subscription.status) {
      case "TRIAL":
        // Add trial header
        if (subscription.trialEnd) {
          reply.header("X-Subscription-Status", "TRIAL");
          reply.header(
            "X-Trial-Ends",
            subscription.trialEnd.toISOString()
          );
        }
        break;

      case "ACTIVE":
        // All good
        break;

      case "PAST_DUE":
        // Grace period - allow access but warn
        reply.header("X-Subscription-Status", "PAST_DUE");
        if (subscription.currentPeriodEnd) {
          reply.header(
            "X-Grace-Period-Ends",
            subscription.currentPeriodEnd.toISOString()
          );
        }

        // Check if grace period has expired
        if (
          subscription.currentPeriodEnd &&
          new Date(subscription.currentPeriodEnd) < new Date()
        ) {
          return reply.code(403).send({
            error: "SUBSCRIPTION_EXPIRED",
            code: "SUBSCRIPTION_EXPIRED",
            message:
              "Your subscription payment failed and the grace period has expired. Please update your payment method.",
            details: {
              upgradeUrl: "/settings/billing",
            },
          } as QuotaEnforcementError);
        }
        break;

      case "EXPIRED":
      case "CANCELED":
        return reply.code(403).send({
          error: "SUBSCRIPTION_EXPIRED",
          code: "SUBSCRIPTION_EXPIRED",
          message: `Your subscription is ${subscription.status.toLowerCase()}. Please subscribe to continue using this feature.`,
          details: {
            upgradeUrl: "/settings/billing",
          },
        } as QuotaEnforcementError);

      case "INCOMPLETE":
        return reply.code(403).send({
          error: "SUBSCRIPTION_REQUIRED",
          code: "SUBSCRIPTION_REQUIRED",
          message:
            "Your subscription setup is incomplete. Please complete payment setup.",
          details: {
            upgradeUrl: "/settings/billing",
          },
        } as QuotaEnforcementError);

      case "PAUSED":
        return reply.code(403).send({
          error: "SUBSCRIPTION_EXPIRED",
          code: "SUBSCRIPTION_EXPIRED",
          message:
            "Your subscription is paused. Please resume to access this feature.",
          details: {
            upgradeUrl: "/settings/billing",
          },
        } as QuotaEnforcementError);
    }

    // Subscription status OK, continue
  };
}

/**
 * Combo middleware: Check subscription + require entitlement + check quota
 * Use this for routes that create quota-limited resources
 *
 * Example:
 *   fastify.post('/api/v1/animals',
 *     {
 *       preHandler: [
 *         requireAuth,
 *         requireSubscriptionAndQuota('ANIMAL_COUNT')
 *       ]
 *     },
 *     async (req, reply) => { ... }
 *   )
 */
export function requireSubscriptionAndQuota(
  metricKey: Extract<
    UsageMetricKey,
    | "ANIMAL_COUNT"
    | "CONTACT_COUNT"
    | "PORTAL_USER_COUNT"
    | "BREEDING_PLAN_COUNT"
    | "MARKETPLACE_LISTING_COUNT"
  >,
  countToAdd: number = 1
) {
  return async (
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void | FastifyReply> => {
    // Check subscription status first
    const statusCheck = await checkSubscriptionStatus()(req, reply);
    if (statusCheck !== undefined) return statusCheck;

    // Then check quota
    return await checkQuota(metricKey, countToAdd)(req, reply);
  };
}

/**
 * Optional middleware: Warn when approaching quota limit
 * Adds headers but doesn't block the request
 *
 * Example:
 *   fastify.get('/api/v1/animals',
 *     { preHandler: [requireAuth, warnQuotaLimit('ANIMAL_COUNT', 0.8)] },
 *     async (req, reply) => { ... }
 *   )
 */
export function warnQuotaLimit(
  metricKey: UsageMetricKey,
  threshold: number = 0.8 // Warn at 80% usage
) {
  return async (
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const actorReq = req as unknown as ActorContextRequest;

    if (!actorReq.tenantId) {
      return;
    }

    const status = await getUsageStatus(actorReq.tenantId, metricKey);

    if (
      status.limit !== null &&
      status.percentUsed !== null &&
      status.percentUsed >= threshold * 100
    ) {
      reply.header("X-Quota-Warning", "true");
      reply.header("X-Quota-Metric", metricKey);
      reply.header("X-Quota-Used", status.currentValue.toString());
      reply.header("X-Quota-Limit", status.limit.toString());
      reply.header(
        "X-Quota-Percent",
        status.percentUsed.toFixed(1)
      );
    }

    // Continue regardless
  };
}
