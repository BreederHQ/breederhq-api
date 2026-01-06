// src/services/marketplace-flag.ts
// Service for managing platform-level marketplace user flags and aggregation

import type { MarketplaceBlockLevel, Prisma } from "@prisma/client";
import prisma from "../prisma.js";

// ============================================================================
// Types
// ============================================================================

export interface MarketplaceAbuseSettings {
  flagThreshold: number;        // Flag for review after N blocks
  autoSuspendThreshold: number; // Auto-suspend after N blocks
  countWindow: number | null;   // null = all-time, or days to look back
}

export interface FlaggedUserInfo {
  id: number;
  userId: string;
  totalBlocks: number;
  activeBlocks: number;
  lightBlocks: number;
  mediumBlocks: number;
  heavyBlocks: number;
  totalApprovals: number;
  totalRejections: number;
  flaggedAt: Date | null;
  flagReason: string | null;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    firstName: string;
    lastName: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const MARKETPLACE_ABUSE_NAMESPACE = "marketplace-abuse";

const DEFAULT_SETTINGS: MarketplaceAbuseSettings = {
  flagThreshold: 3,
  autoSuspendThreshold: 10,
  countWindow: null,
};

// ============================================================================
// Settings Functions
// ============================================================================

/**
 * Get marketplace abuse settings
 */
export async function getAbuseSettings(): Promise<MarketplaceAbuseSettings> {
  const setting = await prisma.platformSetting.findUnique({
    where: { namespace: MARKETPLACE_ABUSE_NAMESPACE },
  });

  if (!setting) {
    return DEFAULT_SETTINGS;
  }

  const data = setting.data as Partial<MarketplaceAbuseSettings>;
  return {
    flagThreshold: data.flagThreshold ?? DEFAULT_SETTINGS.flagThreshold,
    autoSuspendThreshold: data.autoSuspendThreshold ?? DEFAULT_SETTINGS.autoSuspendThreshold,
    countWindow: data.countWindow ?? DEFAULT_SETTINGS.countWindow,
  };
}

/**
 * Update marketplace abuse settings
 */
export async function updateAbuseSettings(
  updates: Partial<MarketplaceAbuseSettings>
): Promise<MarketplaceAbuseSettings> {
  const current = await getAbuseSettings();
  const newSettings: MarketplaceAbuseSettings = {
    ...current,
    ...updates,
  };

  await prisma.platformSetting.upsert({
    where: { namespace: MARKETPLACE_ABUSE_NAMESPACE },
    create: {
      namespace: MARKETPLACE_ABUSE_NAMESPACE,
      data: newSettings as unknown as Prisma.InputJsonValue,
    },
    update: {
      data: newSettings as unknown as Prisma.InputJsonValue,
    },
  });

  return newSettings;
}

// ============================================================================
// Flag Management Functions
// ============================================================================

/**
 * Get or create a MarketplaceUserFlag for a user
 */
async function getOrCreateFlag(userId: string) {
  let flag = await prisma.marketplaceUserFlag.findUnique({
    where: { userId },
  });

  if (!flag) {
    flag = await prisma.marketplaceUserFlag.create({
      data: { userId },
    });
  }

  return flag;
}

/**
 * Update flag counters when a user is blocked
 */
export async function updateFlagOnBlock(
  userId: string,
  level: MarketplaceBlockLevel,
  isNewBlock: boolean
): Promise<void> {
  const flag = await getOrCreateFlag(userId);
  const settings = await getAbuseSettings();

  // Build update data
  const updateData: Record<string, unknown> = {
    activeBlocks: { increment: 1 },
  };

  // Increment level-specific counter
  if (level === "LIGHT") {
    updateData.lightBlocks = { increment: 1 };
  } else if (level === "MEDIUM") {
    updateData.mediumBlocks = { increment: 1 };
  } else if (level === "HEAVY") {
    updateData.heavyBlocks = { increment: 1 };
  }

  // Only increment totalBlocks for truly new blocks
  if (isNewBlock) {
    updateData.totalBlocks = { increment: 1 };
  }

  // Check if we need to flag the user
  const newActiveBlocks = flag.activeBlocks + 1;
  if (!flag.flaggedAt && newActiveBlocks >= settings.flagThreshold) {
    updateData.flaggedAt = new Date();
    updateData.flagReason = `User has been blocked by ${newActiveBlocks} breeder(s)`;
  }

  // Check if we need to auto-suspend
  if (!flag.suspendedAt && newActiveBlocks >= settings.autoSuspendThreshold) {
    updateData.suspendedAt = new Date();
    updateData.suspendedReason = `Auto-suspended: blocked by ${newActiveBlocks} breeder(s)`;
  }

  await prisma.marketplaceUserFlag.update({
    where: { id: flag.id },
    data: updateData,
  });
}

/**
 * Update flag counters when a block is lifted
 */
export async function updateFlagOnUnblock(
  userId: string,
  level: MarketplaceBlockLevel
): Promise<void> {
  const flag = await prisma.marketplaceUserFlag.findUnique({
    where: { userId },
  });

  if (!flag) return;

  // Build update data - decrement active blocks
  const updateData: Record<string, unknown> = {
    activeBlocks: { decrement: 1 },
  };

  // Decrement level-specific counter
  if (level === "LIGHT") {
    updateData.lightBlocks = { decrement: 1 };
  } else if (level === "MEDIUM") {
    updateData.mediumBlocks = { decrement: 1 };
  } else if (level === "HEAVY") {
    updateData.heavyBlocks = { decrement: 1 };
  }

  await prisma.marketplaceUserFlag.update({
    where: { id: flag.id },
    data: updateData,
  });
}

/**
 * Record a waitlist outcome (approval or rejection)
 */
export async function recordWaitlistOutcome(
  userId: string,
  approved: boolean
): Promise<void> {
  const flag = await getOrCreateFlag(userId);

  await prisma.marketplaceUserFlag.update({
    where: { id: flag.id },
    data: approved
      ? { totalApprovals: { increment: 1 } }
      : { totalRejections: { increment: 1 } },
  });
}

// ============================================================================
// Admin Query Functions
// ============================================================================

export type FlaggedUserStatus = "flagged" | "suspended" | "all";

export interface GetFlaggedUsersParams {
  status: FlaggedUserStatus;
  page: number;
  limit: number;
}

/**
 * Get flagged users for admin review
 */
export async function getFlaggedUsers(
  params: GetFlaggedUsersParams
): Promise<{ items: FlaggedUserInfo[]; total: number }> {
  const { status, page, limit } = params;
  const skip = (page - 1) * limit;

  // Build where clause based on status
  let where: Record<string, unknown> = {};
  if (status === "flagged") {
    where = {
      flaggedAt: { not: null },
      suspendedAt: null,
    };
  } else if (status === "suspended") {
    where = {
      suspendedAt: { not: null },
    };
  } else {
    // "all" - get any flagged or suspended users
    where = {
      OR: [
        { flaggedAt: { not: null } },
        { suspendedAt: { not: null } },
      ],
    };
  }

  const [items, total] = await prisma.$transaction([
    prisma.marketplaceUserFlag.findMany({
      where,
      skip,
      take: limit,
      orderBy: [
        { suspendedAt: "desc" },
        { flaggedAt: "desc" },
        { activeBlocks: "desc" },
      ],
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.marketplaceUserFlag.count({ where }),
  ]);

  return {
    items: items.map((f) => ({
      id: f.id,
      userId: f.userId,
      totalBlocks: f.totalBlocks,
      activeBlocks: f.activeBlocks,
      lightBlocks: f.lightBlocks,
      mediumBlocks: f.mediumBlocks,
      heavyBlocks: f.heavyBlocks,
      totalApprovals: f.totalApprovals,
      totalRejections: f.totalRejections,
      flaggedAt: f.flaggedAt,
      flagReason: f.flagReason,
      suspendedAt: f.suspendedAt,
      suspendedReason: f.suspendedReason,
      updatedAt: f.updatedAt,
      user: f.user,
    })),
    total,
  };
}

/**
 * Get flag details for a specific user
 */
export async function getUserFlag(userId: string): Promise<FlaggedUserInfo | null> {
  const flag = await prisma.marketplaceUserFlag.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!flag) return null;

  return {
    id: flag.id,
    userId: flag.userId,
    totalBlocks: flag.totalBlocks,
    activeBlocks: flag.activeBlocks,
    lightBlocks: flag.lightBlocks,
    mediumBlocks: flag.mediumBlocks,
    heavyBlocks: flag.heavyBlocks,
    totalApprovals: flag.totalApprovals,
    totalRejections: flag.totalRejections,
    flaggedAt: flag.flaggedAt,
    flagReason: flag.flagReason,
    suspendedAt: flag.suspendedAt,
    suspendedReason: flag.suspendedReason,
    updatedAt: flag.updatedAt,
    user: flag.user,
  };
}

// ============================================================================
// Admin Action Functions
// ============================================================================

/**
 * Manually suspend a marketplace user
 */
export async function suspendUser(
  userId: string,
  reason: string
): Promise<void> {
  const flag = await getOrCreateFlag(userId);

  await prisma.marketplaceUserFlag.update({
    where: { id: flag.id },
    data: {
      suspendedAt: new Date(),
      suspendedReason: reason,
    },
  });
}

/**
 * Unsuspend a marketplace user
 */
export async function unsuspendUser(userId: string): Promise<void> {
  const flag = await prisma.marketplaceUserFlag.findUnique({
    where: { userId },
  });

  if (!flag) return;

  await prisma.marketplaceUserFlag.update({
    where: { id: flag.id },
    data: {
      suspendedAt: null,
      suspendedReason: null,
    },
  });
}

/**
 * Clear flagged status (keep historical data)
 */
export async function clearFlaggedStatus(userId: string): Promise<void> {
  const flag = await prisma.marketplaceUserFlag.findUnique({
    where: { userId },
  });

  if (!flag) return;

  await prisma.marketplaceUserFlag.update({
    where: { id: flag.id },
    data: {
      flaggedAt: null,
      flagReason: null,
    },
  });
}

/**
 * Check if a user is suspended
 */
export async function isUserSuspended(userId: string): Promise<boolean> {
  const flag = await prisma.marketplaceUserFlag.findUnique({
    where: { userId },
    select: { suspendedAt: true },
  });

  return flag?.suspendedAt !== null && flag?.suspendedAt !== undefined;
}
