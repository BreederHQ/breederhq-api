// src/services/marketplace-block.ts
// Service for checking and managing marketplace user blocks with LRU caching

import type { MarketplaceBlockLevel } from "@prisma/client";
import prisma from "../prisma.js";
import { updateFlagOnBlock, updateFlagOnUnblock } from "./marketplace-flag.js";

// ============================================================================
// Types
// ============================================================================

export interface BlockCheckResult {
  blocked: boolean;
  level?: MarketplaceBlockLevel;
}

export interface BlockUserParams {
  tenantId: number;
  userId: string;
  level: MarketplaceBlockLevel;
  reason?: string;
  blockedByPartyId?: number;
}

export interface UnblockUserParams {
  tenantId: number;
  userId: string;
  liftedByPartyId?: number;
}

export interface BlockedUserInfo {
  id: number;
  userId: string;
  level: MarketplaceBlockLevel;
  reason: string | null;
  createdAt: Date;
  blockedByPartyId: number | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    firstName: string;
    lastName: string;
  };
}

// ============================================================================
// LRU Cache Implementation
// ============================================================================

interface CacheEntry {
  result: BlockCheckResult;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const CACHE_MAX_SIZE = 10000;

class LRUCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  private makeKey(tenantId: number, userId: string): string {
    return `${tenantId}:${userId}`;
  }

  get(tenantId: number, userId: string): BlockCheckResult | null {
    const key = this.makeKey(tenantId, userId);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.result;
  }

  set(tenantId: number, userId: string, result: BlockCheckResult): void {
    const key = this.makeKey(tenantId, userId);

    // Remove if exists (to update position)
    this.cache.delete(key);

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      result,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  invalidate(tenantId: number, userId: string): void {
    const key = this.makeKey(tenantId, userId);
    this.cache.delete(key);
  }

  invalidateUser(userId: string): void {
    // Remove all entries for this user across all tenants
    for (const key of this.cache.keys()) {
      if (key.endsWith(`:${userId}`)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global cache instance
const blockCache = new LRUCache(CACHE_MAX_SIZE, CACHE_TTL_MS);

// ============================================================================
// Block Level Helpers
// ============================================================================

/**
 * Check if a block level is sufficient to block a specific action
 */
export function isBlockedAt(blockLevel: MarketplaceBlockLevel, requiredLevel: MarketplaceBlockLevel): boolean {
  const levelOrder: Record<MarketplaceBlockLevel, number> = {
    LIGHT: 1,
    MEDIUM: 2,
    HEAVY: 3,
  };

  return levelOrder[blockLevel] >= levelOrder[requiredLevel];
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Check if a marketplace user is blocked by a specific tenant
 * Uses LRU cache with 60-second TTL
 */
export async function checkBlock(tenantId: number, userId: string): Promise<BlockCheckResult> {
  // Check cache first
  const cached = blockCache.get(tenantId, userId);
  if (cached !== null) {
    return cached;
  }

  // Query database
  const block = await prisma.marketplaceUserBlock.findFirst({
    where: {
      tenantId,
      blockedUserId: userId,
      liftedAt: null, // Only active blocks
    },
    select: {
      level: true,
    },
  });

  const result: BlockCheckResult = block
    ? { blocked: true, level: block.level }
    : { blocked: false };

  // Cache result
  blockCache.set(tenantId, userId, result);

  return result;
}

/**
 * Check if user is blocked at a specific level or higher
 * Convenience function for guard middleware
 */
export async function isBlocked(
  tenantId: number,
  userId: string,
  requiredLevel: MarketplaceBlockLevel
): Promise<boolean> {
  const result = await checkBlock(tenantId, userId);
  if (!result.blocked || !result.level) return false;
  return isBlockedAt(result.level, requiredLevel);
}

/**
 * Block a marketplace user for a specific tenant
 */
export async function blockUser(params: BlockUserParams): Promise<{ id: number; isNew: boolean }> {
  const { tenantId, userId, level, reason, blockedByPartyId } = params;

  // Check if block already exists (active or lifted)
  const existing = await prisma.marketplaceUserBlock.findUnique({
    where: {
      tenantId_blockedUserId: { tenantId, blockedUserId: userId },
    },
  });

  let blockId: number;
  let isNew = true;

  if (existing) {
    // Update existing block
    const updated = await prisma.marketplaceUserBlock.update({
      where: { id: existing.id },
      data: {
        level,
        reason,
        blockedByPartyId,
        liftedAt: null, // Re-activate if was lifted
        liftedByPartyId: null,
        createdAt: new Date(), // Reset creation time
      },
    });
    blockId = updated.id;
    isNew = existing.liftedAt !== null; // Only "new" if it was previously lifted
  } else {
    // Create new block
    const created = await prisma.marketplaceUserBlock.create({
      data: {
        tenantId,
        blockedUserId: userId,
        level,
        reason,
        blockedByPartyId,
      },
    });
    blockId = created.id;
  }

  // Update platform-level flag
  await updateFlagOnBlock(userId, level, isNew);

  // Invalidate cache
  blockCache.invalidate(tenantId, userId);

  return { id: blockId, isNew };
}

/**
 * Lift a block for a marketplace user
 */
export async function unblockUser(params: UnblockUserParams): Promise<boolean> {
  const { tenantId, userId, liftedByPartyId } = params;

  // Find and update the active block
  const block = await prisma.marketplaceUserBlock.findFirst({
    where: {
      tenantId,
      blockedUserId: userId,
      liftedAt: null,
    },
  });

  if (!block) {
    return false; // No active block to lift
  }

  await prisma.marketplaceUserBlock.update({
    where: { id: block.id },
    data: {
      liftedAt: new Date(),
      liftedByPartyId,
    },
  });

  // Update platform-level flag
  await updateFlagOnUnblock(userId, block.level);

  // Invalidate cache
  blockCache.invalidate(tenantId, userId);

  return true;
}

/**
 * Get all blocked users for a tenant
 */
export async function getBlockedUsers(tenantId: number): Promise<BlockedUserInfo[]> {
  const blocks = await prisma.marketplaceUserBlock.findMany({
    where: {
      tenantId,
      liftedAt: null, // Only active blocks
    },
    select: {
      id: true,
      blockedUserId: true,
      level: true,
      reason: true,
      createdAt: true,
      blockedByPartyId: true,
      blockedUser: {
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return blocks.map((b) => ({
    id: b.id,
    userId: b.blockedUserId,
    level: b.level,
    reason: b.reason,
    createdAt: b.createdAt,
    blockedByPartyId: b.blockedByPartyId,
    user: b.blockedUser,
  }));
}

/**
 * Get block history for a user (including lifted blocks)
 */
export async function getUserBlockHistory(
  userId: string
): Promise<Array<{
  id: number;
  tenantId: number;
  level: MarketplaceBlockLevel;
  reason: string | null;
  createdAt: Date;
  liftedAt: Date | null;
}>> {
  return prisma.marketplaceUserBlock.findMany({
    where: { blockedUserId: userId },
    select: {
      id: true,
      tenantId: true,
      level: true,
      reason: true,
      createdAt: true,
      liftedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Clear cache for testing purposes
 */
export function clearBlockCache(): void {
  blockCache.clear();
}
