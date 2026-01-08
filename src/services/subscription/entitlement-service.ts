/**
 * Entitlement Service
 *
 * Handles checking and granting feature/quota entitlements based on subscriptions.
 * Entitlements determine what features a tenant can access and their usage limits.
 */

import type { EntitlementKey, Prisma } from "@prisma/client";
import prisma from "../../prisma.js";

export type EntitlementCheckResult = {
  hasAccess: boolean;
  limitValue: number | null; // null = unlimited
  reason?: string;
};

/**
 * Check if a tenant has a specific entitlement
 *
 * @param tenantId - The tenant to check
 * @param key - The entitlement key to check
 * @returns EntitlementCheckResult with access status and limit
 */
export async function checkEntitlement(
  tenantId: number,
  key: EntitlementKey
): Promise<EntitlementCheckResult> {
  // Get active subscription for tenant
  const subscription = await prisma.subscription.findFirst({
    where: {
      tenantId,
      status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] }, // Allow grace period
    },
    include: {
      product: {
        include: {
          entitlements: {
            where: { entitlementKey: key },
          },
        },
      },
      addOns: {
        include: {
          product: {
            include: {
              entitlements: {
                where: { entitlementKey: key },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return {
      hasAccess: false,
      limitValue: null,
      reason: "No active subscription",
    };
  }

  // Check if past due and grace period expired
  if (
    subscription.status === "PAST_DUE" &&
    subscription.currentPeriodEnd &&
    new Date(subscription.currentPeriodEnd) < new Date()
  ) {
    return {
      hasAccess: false,
      limitValue: null,
      reason: "Subscription past due and grace period expired",
    };
  }

  // Check base product entitlements
  const productEntitlement = subscription.product.entitlements.find(
    (e) => e.entitlementKey === key
  );

  if (!productEntitlement) {
    return {
      hasAccess: false,
      limitValue: null,
      reason: `Entitlement ${key} not included in ${subscription.product.name}`,
    };
  }

  // For quota entitlements, sum up add-ons
  let totalLimit = productEntitlement.limitValue;

  if (
    key.endsWith("_QUOTA") &&
    totalLimit !== null &&
    subscription.addOns.length > 0
  ) {
    for (const addOn of subscription.addOns) {
      const addOnEntitlement = addOn.product.entitlements.find(
        (e) => e.entitlementKey === key
      );
      if (addOnEntitlement && addOnEntitlement.limitValue !== null) {
        totalLimit =
          (totalLimit || 0) + addOnEntitlement.limitValue * addOn.quantity;
      }
    }
  }

  return {
    hasAccess: true,
    limitValue: totalLimit,
  };
}

/**
 * Get all entitlements for a tenant (includes quotas from add-ons)
 *
 * @param tenantId - The tenant to check
 * @returns Map of entitlement keys to their limits
 */
export async function getTenantEntitlements(
  tenantId: number
): Promise<Map<EntitlementKey, number | null>> {
  const entitlements = new Map<EntitlementKey, number | null>();

  const subscription = await prisma.subscription.findFirst({
    where: {
      tenantId,
      status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
    },
    include: {
      product: {
        include: {
          entitlements: true,
        },
      },
      addOns: {
        include: {
          product: {
            include: {
              entitlements: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return entitlements;
  }

  // Add base product entitlements
  for (const ent of subscription.product.entitlements) {
    entitlements.set(ent.entitlementKey, ent.limitValue);
  }

  // Add add-on entitlements (sum quotas)
  for (const addOn of subscription.addOns) {
    for (const ent of addOn.product.entitlements) {
      const currentLimit = entitlements.get(ent.entitlementKey);

      if (ent.entitlementKey.endsWith("_QUOTA")) {
        // Sum quota limits
        if (currentLimit !== null && ent.limitValue !== null) {
          entitlements.set(
            ent.entitlementKey,
            (currentLimit || 0) + ent.limitValue * addOn.quantity
          );
        } else if (currentLimit === null) {
          // If base is unlimited, keep unlimited
          entitlements.set(ent.entitlementKey, null);
        }
      } else {
        // For boolean entitlements, just ensure it's granted
        entitlements.set(ent.entitlementKey, ent.limitValue);
      }
    }
  }

  return entitlements;
}

/**
 * Grant a user-level entitlement (e.g., MARKETPLACE_ACCESS for specific users)
 * Note: This is separate from subscription-based entitlements
 *
 * @param userId - The user to grant entitlement to
 * @param key - The entitlement key
 * @param grantedByUserId - Optional ID of user who granted this
 */
export async function grantUserEntitlement(
  userId: string,
  key: EntitlementKey,
  grantedByUserId?: string
): Promise<void> {
  await prisma.userEntitlement.upsert({
    where: {
      userId_key: {
        userId,
        key,
      },
    },
    create: {
      userId,
      key,
      status: "ACTIVE",
      grantedByUserId,
      grantedAt: new Date(),
    },
    update: {
      status: "ACTIVE",
      revokedAt: null,
    },
  });
}

/**
 * Revoke a user-level entitlement
 *
 * @param userId - The user to revoke entitlement from
 * @param key - The entitlement key
 */
export async function revokeUserEntitlement(
  userId: string,
  key: EntitlementKey
): Promise<void> {
  await prisma.userEntitlement.update({
    where: {
      userId_key: {
        userId,
        key,
      },
    },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
    },
  });
}

/**
 * Check if a user has a specific entitlement (user-level, not tenant-level)
 *
 * @param userId - The user to check
 * @param key - The entitlement key
 * @returns boolean
 */
export async function checkUserEntitlement(
  userId: string,
  key: EntitlementKey
): Promise<boolean> {
  const entitlement = await prisma.userEntitlement.findUnique({
    where: {
      userId_key: {
        userId,
        key,
      },
    },
  });

  return entitlement?.status === "ACTIVE";
}

/**
 * Get quota limit for a specific metric
 *
 * @param tenantId - The tenant to check
 * @param quotaKey - The quota entitlement key (must end with _QUOTA)
 * @returns The limit (null = unlimited, number = hard limit)
 */
export async function getQuotaLimit(
  tenantId: number,
  quotaKey: Extract<
    EntitlementKey,
    | "ANIMAL_QUOTA"
    | "CONTACT_QUOTA"
    | "PORTAL_USER_QUOTA"
    | "BREEDING_PLAN_QUOTA"
    | "MARKETPLACE_LISTING_QUOTA"
    | "STORAGE_QUOTA_GB"
    | "SMS_QUOTA"
  >
): Promise<number | null> {
  const result = await checkEntitlement(tenantId, quotaKey);

  if (!result.hasAccess) {
    // No subscription = treat as 0 limit (or could throw error)
    return 0;
  }

  return result.limitValue;
}
