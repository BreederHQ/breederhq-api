// src/services/buyer-automation-service.ts
// Buyer CRM automation service - lead scoring and follow-up task generation

import prisma from "../prisma.js";
import type { BuyerStatus, BuyerTaskType, BuyerTaskPriority } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface LeadScoreFactors {
  /** Number of interests expressed */
  interestCount: number;
  /** Number of active deals */
  activeDealCount: number;
  /** Number of activities in last 30 days */
  recentActivityCount: number;
  /** Has budget specified */
  hasBudget: boolean;
  /** Budget amount if specified */
  budgetAmount: number | null;
  /** Days since last activity */
  daysSinceLastActivity: number | null;
  /** Has preferred breeds specified */
  hasPreferences: boolean;
  /** Buyer status */
  status: BuyerStatus;
}

export interface LeadScore {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  factors: LeadScoreFactors;
  recommendations: string[];
}

export interface FollowUpRule {
  name: string;
  condition: (buyer: BuyerWithDetails) => boolean;
  taskType: BuyerTaskType;
  priority: BuyerTaskPriority;
  titleTemplate: string;
  daysFromNow: number;
}

interface BuyerWithDetails {
  id: number;
  tenantId: number;
  partyId: number;
  status: BuyerStatus;
  budget: any;
  preferredBreeds: string[];
  preferredUses: string[];
  party: {
    name: string | null;
  };
  interests: { id: number }[];
  deals: { id: number; stage: string }[];
  _count?: {
    interests: number;
    deals: number;
  };
  lastActivityAt?: Date | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Lead Scoring Configuration
// ────────────────────────────────────────────────────────────────────────────

const SCORE_WEIGHTS = {
  // Interest factors
  interestCount: 5, // per interest, max 25 points
  maxInterestPoints: 25,

  // Deal factors
  activeDealCount: 15, // per active deal, max 30 points
  maxDealPoints: 30,

  // Engagement factors
  recentActivityCount: 2, // per activity in last 30 days, max 20 points
  maxActivityPoints: 20,

  // Profile completeness
  hasBudget: 10,
  hasPreferences: 5,

  // Recency penalty
  inactivityPenaltyPerWeek: 5, // per week inactive, max 20 point penalty
  maxInactivityPenalty: 20,

  // Status bonuses
  statusBonus: {
    LEAD: 0,
    ACTIVE: 5,
    QUALIFIED: 15,
    NEGOTIATING: 20,
    PURCHASED: 0, // Already converted
    INACTIVE: -10,
    ARCHIVED: -20,
  } as Record<BuyerStatus, number>,
};

// ────────────────────────────────────────────────────────────────────────────
// Lead Scoring Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate lead score for a buyer
 */
export async function calculateLeadScore(
  tenantId: number,
  buyerId: number
): Promise<LeadScore | null> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get buyer with all relevant data
  const buyer = await prisma.buyer.findFirst({
    where: { id: buyerId, tenantId },
    include: {
      party: {
        select: { name: true },
      },
      interests: {
        select: { id: true },
      },
      deals: {
        where: {
          stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
        },
        select: { id: true, stage: true },
      },
    },
  });

  if (!buyer) {
    return null;
  }

  // Get recent activity count
  const recentActivityCount = await prisma.partyActivity.count({
    where: {
      tenantId,
      partyId: buyer.partyId,
      createdAt: { gte: thirtyDaysAgo },
    },
  });

  // Get last activity date
  const lastActivity = await prisma.partyActivity.findFirst({
    where: { tenantId, partyId: buyer.partyId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const daysSinceLastActivity = lastActivity
    ? Math.floor((Date.now() - lastActivity.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Build factors
  const factors: LeadScoreFactors = {
    interestCount: buyer.interests.length,
    activeDealCount: buyer.deals.length,
    recentActivityCount,
    hasBudget: buyer.budget !== null && Number(buyer.budget) > 0,
    budgetAmount: buyer.budget ? Number(buyer.budget) : null,
    daysSinceLastActivity,
    hasPreferences: buyer.preferredBreeds.length > 0 || buyer.preferredUses.length > 0,
    status: buyer.status,
  };

  // Calculate score
  let score = 0;

  // Interest points
  score += Math.min(factors.interestCount * SCORE_WEIGHTS.interestCount, SCORE_WEIGHTS.maxInterestPoints);

  // Deal points
  score += Math.min(factors.activeDealCount * SCORE_WEIGHTS.activeDealCount, SCORE_WEIGHTS.maxDealPoints);

  // Activity points
  score += Math.min(factors.recentActivityCount * SCORE_WEIGHTS.recentActivityCount, SCORE_WEIGHTS.maxActivityPoints);

  // Profile completeness
  if (factors.hasBudget) score += SCORE_WEIGHTS.hasBudget;
  if (factors.hasPreferences) score += SCORE_WEIGHTS.hasPreferences;

  // Status bonus
  score += SCORE_WEIGHTS.statusBonus[factors.status] || 0;

  // Inactivity penalty
  if (factors.daysSinceLastActivity !== null && factors.daysSinceLastActivity > 7) {
    const weeksInactive = Math.floor(factors.daysSinceLastActivity / 7);
    const penalty = Math.min(weeksInactive * SCORE_WEIGHTS.inactivityPenaltyPerWeek, SCORE_WEIGHTS.maxInactivityPenalty);
    score -= penalty;
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine grade
  let grade: LeadScore["grade"];
  if (score >= 80) grade = "A";
  else if (score >= 60) grade = "B";
  else if (score >= 40) grade = "C";
  else if (score >= 20) grade = "D";
  else grade = "F";

  // Generate recommendations
  const recommendations: string[] = [];

  if (factors.interestCount === 0) {
    recommendations.push("No interests recorded - try showing them specific animals");
  }
  if (factors.activeDealCount === 0 && factors.status !== "LEAD") {
    recommendations.push("No active deals - consider creating a deal to track progress");
  }
  if (!factors.hasBudget) {
    recommendations.push("Budget not specified - qualify their spending range");
  }
  if (!factors.hasPreferences) {
    recommendations.push("No preferences recorded - learn what they're looking for");
  }
  if (factors.daysSinceLastActivity !== null && factors.daysSinceLastActivity > 14) {
    recommendations.push(`No activity in ${factors.daysSinceLastActivity} days - schedule a follow-up`);
  }
  if (factors.status === "LEAD") {
    recommendations.push("Still in Lead status - qualify and move to Active");
  }

  return { score, grade, factors, recommendations };
}

/**
 * Get lead scores for all active buyers in a tenant
 */
export async function getBuyerLeadScores(
  tenantId: number,
  options?: {
    minScore?: number;
    maxScore?: number;
    grades?: LeadScore["grade"][];
    limit?: number;
  }
): Promise<Array<{ buyerId: number; buyerName: string; score: LeadScore }>> {
  const buyers = await prisma.buyer.findMany({
    where: {
      tenantId,
      status: { notIn: ["ARCHIVED", "PURCHASED"] },
    },
    select: {
      id: true,
      party: { select: { name: true } },
    },
  });

  const results: Array<{ buyerId: number; buyerName: string; score: LeadScore }> = [];

  for (const buyer of buyers) {
    const score = await calculateLeadScore(tenantId, buyer.id);
    if (!score) continue;

    // Apply filters
    if (options?.minScore !== undefined && score.score < options.minScore) continue;
    if (options?.maxScore !== undefined && score.score > options.maxScore) continue;
    if (options?.grades && !options.grades.includes(score.grade)) continue;

    results.push({
      buyerId: buyer.id,
      buyerName: buyer.party.name || "Unknown",
      score,
    });
  }

  // Sort by score descending
  results.sort((a, b) => b.score.score - a.score.score);

  // Apply limit
  if (options?.limit) {
    return results.slice(0, options.limit);
  }

  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// Follow-Up Automation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Default follow-up rules
 */
const DEFAULT_FOLLOW_UP_RULES: FollowUpRule[] = [
  {
    name: "new_lead_follow_up",
    condition: (buyer) =>
      buyer.status === "LEAD" &&
      buyer.interests.length === 0 &&
      buyer.deals.length === 0,
    taskType: "FOLLOW_UP",
    priority: "MEDIUM",
    titleTemplate: "Initial follow-up with {{buyerName}}",
    daysFromNow: 2,
  },
  {
    name: "stale_active_buyer",
    condition: (buyer) =>
      buyer.status === "ACTIVE" &&
      buyer.lastActivityAt != null &&
      Date.now() - new Date(buyer.lastActivityAt).getTime() > 7 * 24 * 60 * 60 * 1000,
    taskType: "CALL",
    priority: "HIGH",
    titleTemplate: "Re-engage {{buyerName}} - no activity in 7+ days",
    daysFromNow: 1,
  },
  {
    name: "qualified_no_deal",
    condition: (buyer) =>
      buyer.status === "QUALIFIED" &&
      buyer.deals.length === 0,
    taskType: "SCHEDULE_VIEWING",
    priority: "HIGH",
    titleTemplate: "Schedule viewing for qualified buyer {{buyerName}}",
    daysFromNow: 1,
  },
  {
    name: "negotiating_check_in",
    condition: (buyer) =>
      buyer.status === "NEGOTIATING",
    taskType: "FOLLOW_UP",
    priority: "URGENT",
    titleTemplate: "Check in on negotiation with {{buyerName}}",
    daysFromNow: 2,
  },
];

/**
 * Check if a task already exists for a buyer with the given automation rule
 */
async function hasExistingAutomatedTask(
  tenantId: number,
  buyerId: number,
  automationRule: string
): Promise<boolean> {
  const existingTask = await prisma.buyerTask.findFirst({
    where: {
      tenantId,
      buyerId,
      automationRule,
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
  });
  return existingTask !== null;
}

/**
 * Generate follow-up tasks for a single buyer based on rules
 */
export async function generateFollowUpTasksForBuyer(
  tenantId: number,
  buyerId: number,
  rules: FollowUpRule[] = DEFAULT_FOLLOW_UP_RULES
): Promise<number> {
  // Get buyer with details
  const buyer = await prisma.buyer.findFirst({
    where: { id: buyerId, tenantId },
    include: {
      party: { select: { name: true } },
      interests: { select: { id: true } },
      deals: {
        where: { stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
        select: { id: true, stage: true },
      },
    },
  });

  if (!buyer) return 0;

  // Get last activity
  const lastActivity = await prisma.partyActivity.findFirst({
    where: { tenantId, partyId: buyer.partyId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const buyerWithDetails: BuyerWithDetails = {
    ...buyer,
    lastActivityAt: lastActivity?.createdAt || null,
  };

  let tasksCreated = 0;

  for (const rule of rules) {
    // Check if rule applies
    if (!rule.condition(buyerWithDetails)) continue;

    // Check if task already exists
    const hasExisting = await hasExistingAutomatedTask(tenantId, buyerId, rule.name);
    if (hasExisting) continue;

    // Create task
    const buyerName = buyer.party.name || "Buyer";
    const title = rule.titleTemplate.replace("{{buyerName}}", buyerName);

    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + rule.daysFromNow);

    await prisma.buyerTask.create({
      data: {
        tenantId,
        buyerId,
        title,
        taskType: rule.taskType,
        priority: rule.priority,
        status: "PENDING",
        dueAt,
        isAutoGenerated: true,
        automationRule: rule.name,
      },
    });

    tasksCreated++;
  }

  return tasksCreated;
}

/**
 * Generate follow-up tasks for all active buyers in a tenant
 * Typically run as a scheduled job
 */
export async function generateFollowUpTasksForTenant(
  tenantId: number,
  rules: FollowUpRule[] = DEFAULT_FOLLOW_UP_RULES
): Promise<{ totalBuyers: number; tasksCreated: number }> {
  const buyers = await prisma.buyer.findMany({
    where: {
      tenantId,
      status: { notIn: ["ARCHIVED", "PURCHASED", "INACTIVE"] },
    },
    select: { id: true },
  });

  let tasksCreated = 0;

  for (const buyer of buyers) {
    const created = await generateFollowUpTasksForBuyer(tenantId, buyer.id, rules);
    tasksCreated += created;
  }

  return { totalBuyers: buyers.length, tasksCreated };
}

// ────────────────────────────────────────────────────────────────────────────
// Stale Lead Detection
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get buyers with no activity in the specified number of days
 */
export async function getStaleBuyers(
  tenantId: number,
  daysSinceActivity: number = 14
): Promise<Array<{
  buyerId: number;
  buyerName: string;
  status: BuyerStatus;
  daysSinceActivity: number;
  lastActivityAt: Date | null;
}>> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSinceActivity);

  const buyers = await prisma.buyer.findMany({
    where: {
      tenantId,
      status: { notIn: ["ARCHIVED", "PURCHASED", "INACTIVE"] },
    },
    include: {
      party: { select: { id: true, name: true } },
    },
  });

  const results: Array<{
    buyerId: number;
    buyerName: string;
    status: BuyerStatus;
    daysSinceActivity: number;
    lastActivityAt: Date | null;
  }> = [];

  for (const buyer of buyers) {
    const lastActivity = await prisma.partyActivity.findFirst({
      where: { tenantId, partyId: buyer.partyId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    // Include if no activity or last activity is before cutoff
    if (!lastActivity || lastActivity.createdAt < cutoffDate) {
      const days = lastActivity
        ? Math.floor((Date.now() - lastActivity.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      results.push({
        buyerId: buyer.id,
        buyerName: buyer.party.name || "Unknown",
        status: buyer.status,
        daysSinceActivity: days,
        lastActivityAt: lastActivity?.createdAt || null,
      });
    }
  }

  // Sort by days since activity descending
  results.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);

  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// Task Due Date Reminders
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get overdue tasks for a tenant
 */
export async function getOverdueTasks(tenantId: number) {
  const now = new Date();

  return prisma.buyerTask.findMany({
    where: {
      tenantId,
      status: { in: ["PENDING", "IN_PROGRESS"] },
      dueAt: { lt: now },
    },
    include: {
      buyer: {
        include: {
          party: { select: { name: true } },
        },
      },
      deal: { select: { name: true } },
      assignedToUser: { select: { firstName: true, lastName: true } },
    },
    orderBy: { dueAt: "asc" },
  });
}

/**
 * Get tasks due today or tomorrow
 */
export async function getUpcomingTasks(
  tenantId: number,
  daysAhead: number = 2
) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return prisma.buyerTask.findMany({
    where: {
      tenantId,
      status: { in: ["PENDING", "IN_PROGRESS"] },
      dueAt: {
        gte: now,
        lte: futureDate,
      },
    },
    include: {
      buyer: {
        include: {
          party: { select: { name: true } },
        },
      },
      deal: { select: { name: true } },
      assignedToUser: { select: { firstName: true, lastName: true } },
    },
    orderBy: { dueAt: "asc" },
  });
}
