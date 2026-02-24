import { PrismaClient, WaitlistEntry, BreedingPlan, BreedingPlanBuyerStage, MktListingBreedingProgram, WaitlistStatus } from "@prisma/client";
import type { MatchReason, BreedingPlanBuyerDTO } from "../types/breeding-plan-buyer.js";

export interface MatchResult {
  waitlistEntryId: number;
  score: number;
  reasons: MatchReason[];
}

type PlanWithProgram = BreedingPlan & {
  program: MktListingBreedingProgram | null;
};

type WaitlistEntryWithPrefs = WaitlistEntry & {
  clientParty: { name: string; email: string | null; phoneE164: string | null } | null;
  sirePref: { name: string } | null;
  damPref: { name: string } | null;
};

/**
 * Check if entry notes contain a program reference matching the program name.
 */
function matchesProgramByNotes(entry: WaitlistEntry, programName: string): boolean {
  if (!entry.notes) return false;
  const match = entry.notes.match(/^Program:\s*(.+)$/m);
  if (!match) return false;
  return match[1].trim().toLowerCase() === programName.toLowerCase();
}

/**
 * Calculate match score and reasons for a waitlist entry against a plan.
 */
function calculateMatch(
  entry: WaitlistEntryWithPrefs,
  plan: PlanWithProgram
): MatchResult {
  const reasons: MatchReason[] = [];
  let score = 0;

  // Program match (highest weight)
  if (entry.programId && entry.programId === plan.programId) {
    reasons.push("PROGRAM_MATCH");
    score += 50;
  } else if (plan.program && matchesProgramByNotes(entry, plan.program.name)) {
    reasons.push("PROGRAM_MATCH");
    score += 40; // Slightly lower for notes-based match
  }

  // Species match
  if (!entry.speciesPref || entry.speciesPref === plan.species) {
    reasons.push("SPECIES_MATCH");
    score += 10;
  }

  // Breed match
  const breedPrefs = entry.breedPrefs as string[] | null;
  if (breedPrefs?.length) {
    const planBreed = plan.breedText?.toLowerCase() || "";
    const hasBreedMatch = breedPrefs.some(
      (b: string) => planBreed.includes(b.toLowerCase())
    );
    if (hasBreedMatch) {
      reasons.push("BREED_MATCH");
      score += 15;
    }
  } else {
    // No breed preference = matches any breed
    score += 5;
  }

  // Sire preference
  if (entry.sirePrefId && entry.sirePrefId === plan.sireId) {
    reasons.push("SIRE_PREFERENCE");
    score += 25;
  }

  // Dam preference
  if (entry.damPrefId && entry.damPrefId === plan.damId) {
    reasons.push("DAM_PREFERENCE");
    score += 25;
  }

  // Deposit paid bonus
  if (entry.status === WaitlistStatus.DEPOSIT_PAID) {
    reasons.push("DEPOSIT_PAID");
    score += 10;
  }

  return {
    waitlistEntryId: entry.id,
    score,
    reasons,
  };
}

/**
 * Find possible matches for a breeding plan from the tenant's approved waitlist.
 */
export async function findPossibleMatches(
  prisma: PrismaClient,
  planId: number,
  tenantId: number
): Promise<MatchResult[]> {
  // Get plan with program
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: planId, tenantId },
    include: { program: true },
  });

  if (!plan) {
    return [];
  }

  // Get approved waitlist entries (not already assigned/matched to this plan)
  // Only exclude confirmed stages — POSSIBLE_MATCH entries need to be re-evaluated
  const confirmedPlanBuyers = await prisma.breedingPlanBuyer.findMany({
    where: { planId, stage: { notIn: ["POSSIBLE_MATCH"] } },
    select: { waitlistEntryId: true },
  });
  const excludeIds = confirmedPlanBuyers
    .filter((b) => b.waitlistEntryId !== null)
    .map((b) => b.waitlistEntryId as number);

  const waitlist = await prisma.waitlistEntry.findMany({
    where: {
      tenantId,
      status: { in: [WaitlistStatus.APPROVED, WaitlistStatus.DEPOSIT_PAID] },
      // Exclude those already linked to this plan as buyers
      id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
    },
    include: {
      clientParty: { select: { name: true, email: true, phoneE164: true } },
      sirePref: { select: { name: true } },
      damPref: { select: { name: true } },
    },
  });

  const matches: MatchResult[] = [];

  // Reasons that indicate a meaningful preference overlap (not just species)
  const MEANINGFUL_REASONS: MatchReason[] = [
    "PROGRAM_MATCH",
    "BREED_MATCH",
    "SIRE_PREFERENCE",
    "DAM_PREFERENCE",
  ];

  for (const entry of waitlist) {
    const result = calculateMatch(entry, plan);
    // Require at least one meaningful match reason — species-only is too generic
    const hasMeaningful = result.reasons.some((r) => MEANINGFUL_REASONS.includes(r));
    if (hasMeaningful && result.score > 0) {
      matches.push(result);
    }
  }

  // Sort by score descending, then by deposit status
  return matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Deposit paid entries first within same score
    const aDeposit = a.reasons.includes("DEPOSIT_PAID") ? 1 : 0;
    const bDeposit = b.reasons.includes("DEPOSIT_PAID") ? 1 : 0;
    return bDeposit - aDeposit;
  });
}

/**
 * Find possible matches using pre-fetched data (no DB queries).
 * Used by batch operations to avoid N+1.
 */
function findPossibleMatchesFromData(
  plan: PlanWithProgram,
  approvedEntries: WaitlistEntryWithPrefs[],
  existingLinks: { waitlistEntryId: number | null; stage: string }[],
): MatchResult[] {
  // Only exclude confirmed stages — POSSIBLE_MATCH entries need to be re-evaluated
  const excludeIds = new Set(
    existingLinks
      .filter((b) => b.waitlistEntryId !== null && b.stage !== "POSSIBLE_MATCH")
      .map((b) => b.waitlistEntryId as number)
  );

  const MEANINGFUL_REASONS: MatchReason[] = [
    "PROGRAM_MATCH",
    "BREED_MATCH",
    "SIRE_PREFERENCE",
    "DAM_PREFERENCE",
  ];

  const matches: MatchResult[] = [];
  for (const entry of approvedEntries) {
    if (excludeIds.has(entry.id)) continue;
    const result = calculateMatch(entry, plan);
    const hasMeaningful = result.reasons.some((r) => MEANINGFUL_REASONS.includes(r));
    if (hasMeaningful && result.score > 0) {
      matches.push(result);
    }
  }

  return matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aDeposit = a.reasons.includes("DEPOSIT_PAID") ? 1 : 0;
    const bDeposit = b.reasons.includes("DEPOSIT_PAID") ? 1 : 0;
    return bDeposit - aDeposit;
  });
}

/**
 * Refresh the POSSIBLE_MATCH entries for a breeding plan.
 * Removes stale matches and adds new ones.
 */
export async function refreshPlanMatches(
  prisma: PrismaClient,
  planId: number,
  tenantId: number
): Promise<{ added: number; removed: number; updated: number }> {
  // Get current possible matches (only POSSIBLE_MATCH stage)
  const existing = await prisma.breedingPlanBuyer.findMany({
    where: { planId, stage: "POSSIBLE_MATCH" },
  });
  const existingMap = new Map(
    existing.filter((e) => e.waitlistEntryId !== null).map((e) => [e.waitlistEntryId as number, e])
  );

  // Calculate new matches
  const newMatches = await findPossibleMatches(prisma, planId, tenantId);
  const newMatchMap = new Map(newMatches.map((m) => [m.waitlistEntryId, m]));

  let added = 0,
    removed = 0,
    updated = 0;

  // Remove entries no longer matching
  for (const [entryId, record] of existingMap) {
    if (!newMatchMap.has(entryId)) {
      await prisma.breedingPlanBuyer.delete({ where: { id: record.id } });
      removed++;
    }
  }

  // Add or update matches
  for (const [entryId, match] of newMatchMap) {
    const existingRecord = existingMap.get(entryId);
    if (existingRecord) {
      // Update score/reasons if changed
      if (existingRecord.matchScore !== match.score) {
        await prisma.breedingPlanBuyer.update({
          where: { id: existingRecord.id },
          data: { matchScore: match.score, matchReasons: match.reasons },
        });
        updated++;
      }
    } else {
      // Add new match
      await prisma.breedingPlanBuyer.create({
        data: {
          tenantId,
          planId,
          waitlistEntryId: entryId,
          stage: "POSSIBLE_MATCH",
          matchScore: match.score,
          matchReasons: match.reasons,
        },
      });
      added++;
    }
  }

  return { added, removed, updated };
}

/**
 * Batch-optimized version of refreshPlanMatches that accepts pre-fetched data.
 * Avoids N+1 by reusing already-fetched approved entries and existing links.
 */
async function refreshPlanMatchesWithData(
  prisma: PrismaClient,
  plan: PlanWithProgram,
  tenantId: number,
  approvedEntries: WaitlistEntryWithPrefs[],
  existingLinksForPlan: { id: number; waitlistEntryId: number | null; stage: string; matchScore: number | null; matchReasons: any }[],
): Promise<{ added: number; removed: number; updated: number }> {
  // Filter to POSSIBLE_MATCH stage only
  const possibleMatches = existingLinksForPlan.filter((e) => e.stage === "POSSIBLE_MATCH");
  const existingMap = new Map(
    possibleMatches
      .filter((e) => e.waitlistEntryId !== null)
      .map((e) => [e.waitlistEntryId as number, e])
  );

  // Calculate new matches from pre-fetched data (no DB queries)
  const newMatches = findPossibleMatchesFromData(plan, approvedEntries, existingLinksForPlan);
  const newMatchMap = new Map(newMatches.map((m) => [m.waitlistEntryId, m]));

  let added = 0,
    removed = 0,
    updated = 0;

  // Collect IDs to delete in batch
  const toDelete: number[] = [];
  for (const [entryId, record] of existingMap) {
    if (!newMatchMap.has(entryId)) {
      toDelete.push(record.id);
      removed++;
    }
  }
  if (toDelete.length > 0) {
    await prisma.breedingPlanBuyer.deleteMany({ where: { id: { in: toDelete } } });
  }

  // Collect creates and updates
  const toCreate: { tenantId: number; planId: number; waitlistEntryId: number; stage: BreedingPlanBuyerStage; matchScore: number; matchReasons: MatchReason[] }[] = [];
  const toUpdate: { id: number; matchScore: number; matchReasons: MatchReason[] }[] = [];

  for (const [entryId, match] of newMatchMap) {
    const existingRecord = existingMap.get(entryId);
    if (existingRecord) {
      if (existingRecord.matchScore !== match.score) {
        toUpdate.push({ id: existingRecord.id, matchScore: match.score, matchReasons: match.reasons });
        updated++;
      }
    } else {
      toCreate.push({
        tenantId,
        planId: plan.id,
        waitlistEntryId: entryId,
        stage: "POSSIBLE_MATCH" as BreedingPlanBuyerStage,
        matchScore: match.score,
        matchReasons: match.reasons,
      });
      added++;
    }
  }

  // Batch create
  if (toCreate.length > 0) {
    await prisma.breedingPlanBuyer.createMany({ data: toCreate });
  }

  // Batch update (Prisma doesn't support bulk update, use Promise.all for parallel)
  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map((u) =>
        prisma.breedingPlanBuyer.update({
          where: { id: u.id },
          data: { matchScore: u.matchScore, matchReasons: u.matchReasons },
        })
      )
    );
  }

  return { added, removed, updated };
}

/**
 * Refresh matches for all active plans under a program when a waitlist entry changes.
 */
export async function refreshMatchingPlansForEntry(
  prisma: PrismaClient,
  entryId: number,
  tenantId: number
): Promise<void> {
  const entry = await prisma.waitlistEntry.findUnique({
    where: { id: entryId },
    include: { program: true },
  });

  if (!entry) return;

  // Build plan filter: scope to program if the entry has one,
  // otherwise match against ALL active plans for the tenant (parking-lot entries)
  const planWhere: any = {
    tenantId,
    status: { notIn: ["PLAN_COMPLETE", "COMPLETE", "CANCELED", "UNSUCCESSFUL"] },
    deletedAt: null,
  };
  if (entry.programId) {
    planWhere.programId = entry.programId;
  }

  const plans = await prisma.breedingPlan.findMany({
    where: planWhere,
    include: { program: true },
  });

  if (plans.length === 0) return;

  // Pre-fetch shared data once instead of per-plan (avoids N+1):
  // 1. All approved waitlist entries for this tenant
  const allApprovedEntries = await prisma.waitlistEntry.findMany({
    where: {
      tenantId,
      status: { in: [WaitlistStatus.APPROVED, WaitlistStatus.DEPOSIT_PAID] },
    },
    include: {
      clientParty: { select: { name: true, email: true, phoneE164: true } },
      sirePref: { select: { name: true } },
      damPref: { select: { name: true } },
    },
  });

  // 2. All existing plan-buyer links for these plans
  const planIds = plans.map(p => p.id);
  const allExistingLinks = await prisma.breedingPlanBuyer.findMany({
    where: { planId: { in: planIds } },
  });

  // Group existing links by plan
  const linksByPlan = new Map<number, typeof allExistingLinks>();
  for (const link of allExistingLinks) {
    const list = linksByPlan.get(link.planId) || [];
    list.push(link);
    linksByPlan.set(link.planId, list);
  }

  // Refresh matches for each plan using pre-fetched data
  for (const plan of plans) {
    const existingForPlan = linksByPlan.get(plan.id) || [];
    await refreshPlanMatchesWithData(
      prisma, plan, tenantId, allApprovedEntries, existingForPlan,
    );
  }
}

/**
 * Batch-refresh matches for multiple waitlist entries at once.
 * Consolidates all DB queries to avoid the N+1 pattern that occurs when
 * refreshMatchingPlansForEntry is called per-entry in a loop.
 */
export async function refreshMatchingPlansForEntries(
  prisma: PrismaClient,
  entryIds: number[],
  tenantId: number
): Promise<void> {
  if (entryIds.length === 0) return;

  // 1. Batch-fetch all entries with their program info
  const entries = await prisma.waitlistEntry.findMany({
    where: { id: { in: entryIds } },
    include: { program: true },
  });

  if (entries.length === 0) return;

  // 2. Collect all unique program IDs (null = parking-lot entry that matches all plans)
  const programIds = [...new Set(entries.map(e => e.programId).filter((id): id is number => id !== null))];
  const hasParkingLot = entries.some(e => e.programId === null);

  // 3. Batch-fetch all relevant active plans
  const planWhere: any = {
    tenantId,
    status: { notIn: ["PLAN_COMPLETE", "COMPLETE", "CANCELED", "UNSUCCESSFUL"] },
    deletedAt: null,
  };
  if (!hasParkingLot && programIds.length > 0) {
    // All entries have programs — scope plans to those programs
    planWhere.programId = { in: programIds };
  }
  // If hasParkingLot is true, we need ALL active plans (no programId filter)

  const plans = await prisma.breedingPlan.findMany({
    where: planWhere,
    include: { program: true },
  });

  if (plans.length === 0) return;

  // 4. Batch-fetch all approved waitlist entries for matching
  const allApprovedEntries = await prisma.waitlistEntry.findMany({
    where: {
      tenantId,
      status: { in: [WaitlistStatus.APPROVED, WaitlistStatus.DEPOSIT_PAID] },
    },
    include: {
      clientParty: { select: { name: true, email: true, phoneE164: true } },
      sirePref: { select: { name: true } },
      damPref: { select: { name: true } },
    },
  });

  // 5. Batch-fetch all existing plan-buyer links
  const planIds = plans.map(p => p.id);
  const allExistingLinks = await prisma.breedingPlanBuyer.findMany({
    where: { planId: { in: planIds } },
  });

  // Group existing links by plan
  const linksByPlan = new Map<number, typeof allExistingLinks>();
  for (const link of allExistingLinks) {
    const list = linksByPlan.get(link.planId) || [];
    list.push(link);
    linksByPlan.set(link.planId, list);
  }

  // 6. Determine which plans each entry maps to, then deduplicate
  const plansToRefresh = new Set<number>();
  for (const entry of entries) {
    for (const plan of plans) {
      if (entry.programId === null || entry.programId === plan.programId) {
        plansToRefresh.add(plan.id);
      }
    }
  }

  // 7. Refresh matches for each unique plan using pre-fetched data (no extra DB queries)
  for (const planId of plansToRefresh) {
    const plan = plans.find(p => p.id === planId)!;
    const existingForPlan = linksByPlan.get(plan.id) || [];
    await refreshPlanMatchesWithData(
      prisma, plan, tenantId, allApprovedEntries, existingForPlan,
    );
  }
}
