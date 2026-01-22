import { PrismaClient, WaitlistEntry, BreedingPlan, MktListingBreedingProgram, WaitlistStatus } from "@prisma/client";
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

  // Get approved waitlist entries (not already assigned to this plan)
  const existingPlanBuyers = await prisma.breedingPlanBuyer.findMany({
    where: { planId },
    select: { waitlistEntryId: true },
  });
  const excludeIds = existingPlanBuyers
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

  for (const entry of waitlist) {
    const result = calculateMatch(entry, plan);
    // Only include if there's some relevance (score > 0)
    if (result.score > 0) {
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

  if (!entry?.programId) return;

  // Find all active plans under this program
  const plans = await prisma.breedingPlan.findMany({
    where: {
      tenantId,
      programId: entry.programId,
      status: { notIn: ["COMPLETE", "CANCELED", "UNSUCCESSFUL"] },
      deletedAt: null,
    },
  });

  // Refresh matches for each plan
  for (const plan of plans) {
    await refreshPlanMatches(prisma, plan.id, tenantId);
  }
}
