// src/services/copilot/copilot-handlers.ts
// Tool execution handlers for the AI Copilot.
// Every handler MUST filter by tenantId for security.
// Every handler MUST convert BigInt fields with Number() before returning.

import prisma from "../../prisma.js";
import { searchArticles } from "../help-search-service.js";

type ToolHandler = (
  tenantId: number,
  input: Record<string, unknown>
) => Promise<unknown>;

/** Max chars for a single tool result JSON. Prevents token explosion. */
const MAX_RESULT_CHARS = Number(
  process.env.COPILOT_TOOL_RESULT_MAX_CHARS ?? "4000"
);

/**
 * Truncate a tool result if it exceeds MAX_RESULT_CHARS.
 * Serialises the value, and if over budget, trims the array and appends a note.
 */
export function truncateResult(value: unknown): string {
  const json = JSON.stringify(value);
  if (json.length <= MAX_RESULT_CHARS) return json;

  // If the value is an array, trim items until under budget
  if (Array.isArray(value)) {
    let trimmed = [...value];
    while (trimmed.length > 1) {
      trimmed = trimmed.slice(0, trimmed.length - 1);
      const attempt = JSON.stringify({
        results: trimmed,
        note: `Showing first ${trimmed.length} of ${value.length} results`,
      });
      if (attempt.length <= MAX_RESULT_CHARS) return attempt;
    }
  }

  // Fallback: hard truncate
  return json.slice(0, MAX_RESULT_CHARS) + '..."truncated"}';
}

// ── Handlers ─────────────────────────────────────────────────────────────

async function searchAnimals(
  tenantId: number,
  input: Record<string, unknown>
) {
  const species = input.species as string | undefined;
  const breed = input.breed as string | undefined;
  const name = input.name as string | undefined;
  const sex = input.sex as string | undefined;
  const status = input.status as string | undefined;
  const limit = Math.min(Number(input.limit ?? 20), 50);

  const animals = await prisma.animal.findMany({
    where: {
      tenantId,
      archived: false,
      deletedAt: null,
      ...(species ? { species: species as any } : {}),
      ...(breed ? { breed: { contains: breed, mode: "insensitive" as const } } : {}),
      ...(name ? { name: { contains: name, mode: "insensitive" as const } } : {}),
      ...(sex ? { sex: sex as any } : {}),
      ...(status ? { status: status as any } : {}),
    },
    select: {
      id: true,
      name: true,
      nickname: true,
      species: true,
      breed: true,
      sex: true,
      status: true,
      birthDate: true,
      microchip: true,
      notes: true,
      forSale: true,
      inSyndication: true,
      isLeased: true,
    },
    take: limit,
    orderBy: { name: "asc" },
  });

  return animals;
}

async function getAnimalDetails(
  tenantId: number,
  input: Record<string, unknown>
) {
  const animalId = Number(input.animal_id);
  if (!animalId) return { error: "animal_id is required" };

  const animal = await prisma.animal.findFirst({
    where: { id: animalId, tenantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      nickname: true,
      species: true,
      breed: true,
      sex: true,
      status: true,
      birthDate: true,
      microchip: true,
      dam: { select: { id: true, name: true, breed: true } },
      sire: { select: { id: true, name: true, breed: true } },
      notes: true,
      // Vaccination history
      VaccinationRecord: {
        select: {
          protocolKey: true,
          administeredAt: true,
          expiresAt: true,
          veterinarian: true,
          clinic: true,
          notes: true,
        },
        orderBy: { administeredAt: "desc" as const },
        take: 20,
      },
      // Titles earned
      titles: {
        where: { status: { in: ["EARNED", "VERIFIED"] as any[] } },
        select: {
          dateEarned: true,
          status: true,
          registryRef: true,
          eventName: true,
          titleDefinition: {
            select: {
              abbreviation: true,
              fullName: true,
              organization: true,
              category: true,
            },
          },
        },
        orderBy: { dateEarned: "asc" as const },
      },
      // Genetics — health panel + breed composition are most useful for vet visits
      genetics: {
        select: {
          testProvider: true,
          testDate: true,
          testId: true,
          healthGeneticsData: true,
          breedComposition: true,
          coatColorData: true,
        },
      },
    },
  });

  if (!animal) return { error: "Animal not found" };

  // Rename Prisma PascalCase relation to camelCase for cleaner AI output
  const { VaccinationRecord, ...rest } = animal;
  return {
    ...rest,
    vaccinationRecords: VaccinationRecord,
  };
}

async function searchBreedingPlans(
  tenantId: number,
  input: Record<string, unknown>
) {
  const status = input.status as string | undefined;
  const species = input.species as string | undefined;
  const name = input.name as string | undefined;
  const limit = Math.min(Number(input.limit ?? 20), 50);

  const plans = await prisma.breedingPlan.findMany({
    where: {
      tenantId,
      deletedAt: null,
      archived: false,
      ...(status ? { status: status as any } : {}),
      ...(species ? { species: species as any } : {}),
      ...(name ? { name: { contains: name, mode: "insensitive" as const } } : {}),
    },
    select: {
      id: true,
      name: true,
      species: true,
      status: true,
      expectedBirthDate: true,
      dam: { select: { id: true, name: true } },
      sire: { select: { id: true, name: true } },
      _count: { select: { Offspring: true } },
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    species: p.species,
    status: p.status,
    expectedBirthDate: p.expectedBirthDate,
    damName: p.dam?.name ?? null,
    sireName: p.sire?.name ?? null,
    offspringCount: p._count.Offspring,
  }));
}

async function getBreedingPlanDetails(
  tenantId: number,
  input: Record<string, unknown>
) {
  const planId = Number(input.plan_id);
  if (!planId) return { error: "plan_id is required" };

  const plan = await prisma.breedingPlan.findFirst({
    where: { id: planId, tenantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      species: true,
      status: true,
      expectedBirthDate: true,
      birthDateActual: true,
      expectedCycleStart: true,
      expectedBreedDate: true,
      expectedWeaned: true,
      weanedDateActual: true,
      dam: { select: { id: true, name: true, breed: true } },
      sire: { select: { id: true, name: true, breed: true } },
      Litter: {
        select: {
          countBorn: true,
          countLive: true,
          countStillborn: true,
          countMale: true,
          countFemale: true,
          countWeaned: true,
          countPlaced: true,
        },
      },
      Offspring: {
        select: {
          id: true,
          name: true,
          sex: true,
          status: true,
          placementState: true,
          keeperIntent: true,
          priceCents: true,
        },
        take: 30,
        orderBy: { createdAt: "asc" },
      },
      Waitlist: {
        select: {
          id: true,
          status: true,
          priority: true,
          depositPaidCents: true,
          clientParty: {
            select: {
              contact: { select: { display_name: true } },
            },
          },
        },
        take: 20,
        orderBy: { priority: "asc" },
      },
      notes: true,
    },
  });

  if (!plan) return { error: "Breeding plan not found" };

  return {
    ...plan,
    litter: plan.Litter,
    offspring: plan.Offspring,
    waitlistEntries: plan.Waitlist.map((w: any) => ({
      id: w.id,
      status: w.status,
      priority: w.priority,
      depositPaidCents: w.depositPaidCents,
      clientName: w.clientParty?.contact?.display_name ?? "Unknown",
    })),
  };
}

async function searchOffspring(
  tenantId: number,
  input: Record<string, unknown>
) {
  const species = input.species as string | undefined;
  const status = input.status as string | undefined;
  const placementState = input.placement_state as string | undefined;
  const planId = input.plan_id ? Number(input.plan_id) : undefined;
  const limit = Math.min(Number(input.limit ?? 20), 50);

  const offspring = await prisma.offspring.findMany({
    where: {
      tenantId,
      ...(species ? { species: species as any } : {}),
      ...(status ? { status: status as any } : {}),
      ...(placementState ? { placementState: placementState as any } : {}),
      ...(planId ? { breedingPlanId: planId } : {}),
    },
    select: {
      id: true,
      name: true,
      sex: true,
      species: true,
      breed: true,
      bornAt: true,
      diedAt: true,
      status: true,
      lifeState: true,
      placementState: true,
      financialState: true,
      paperworkState: true,
      keeperIntent: true,
      priceCents: true,
      healthStatus: true,
      healthNotes: true,
      isExtraNeeds: true,
      BreedingPlan: { select: { id: true, name: true } },
      buyerParty: {
        select: {
          contact: { select: { display_name: true } },
        },
      },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return offspring.map((o) => ({
    id: o.id,
    name: o.name,
    sex: o.sex,
    species: o.species,
    breed: o.breed,
    bornAt: o.bornAt,
    diedAt: o.diedAt,
    status: o.status,
    lifeState: o.lifeState,
    placementState: o.placementState,
    financialState: o.financialState,
    paperworkState: o.paperworkState,
    keeperIntent: o.keeperIntent,
    priceCents: o.priceCents,
    healthStatus: o.healthStatus,
    healthNotes: o.healthNotes,
    isExtraNeeds: o.isExtraNeeds,
    planName: o.BreedingPlan?.name ?? null,
    buyerName: o.buyerParty?.contact?.display_name ?? null,
  }));
}

async function searchContacts(
  tenantId: number,
  input: Record<string, unknown>
) {
  const query = input.query as string | undefined;
  const limit = Math.min(Number(input.limit ?? 20), 50);

  const contacts = await prisma.contact.findMany({
    where: {
      tenantId,
      archived: false,
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { display_name: { contains: query, mode: "insensitive" as const } },
              { email: { contains: query, mode: "insensitive" as const } },
              { phoneE164: { contains: query } },
              { first_name: { contains: query, mode: "insensitive" as const } },
              { last_name: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      display_name: true,
      first_name: true,
      last_name: true,
      nickname: true,
      email: true,
      phoneE164: true,
      whatsappE164: true,
      street: true,
      city: true,
      state: true,
      zip: true,
      country: true,
      archived: true,
    },
    take: limit,
    orderBy: { display_name: "asc" },
  });

  return contacts;
}

async function getWaitlist(
  tenantId: number,
  input: Record<string, unknown>
) {
  const planId = input.plan_id ? Number(input.plan_id) : undefined;
  const status = input.status as string | undefined;
  const limit = Math.min(Number(input.limit ?? 20), 50);

  const entries = await prisma.waitlistEntry.findMany({
    where: {
      tenantId,
      ...(planId ? { planId } : {}),
      ...(status ? { status: status as any } : {}),
    },
    select: {
      id: true,
      status: true,
      priority: true,
      speciesPref: true,
      breedPrefs: true,
      depositRequiredCents: true,
      depositPaidCents: true,
      balanceDueCents: true,
      notes: true,
      offspringId: true,
      animalId: true,
      skipCount: true,
      rejectedReason: true,
      createdAt: true,
      clientParty: {
        select: {
          contact: {
            select: { display_name: true, email: true },
          },
        },
      },
      plan: { select: { id: true, name: true } },
    },
    take: limit,
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  return entries.map((e) => ({
    id: e.id,
    status: e.status,
    priority: e.priority,
    speciesPref: e.speciesPref,
    breedPrefs: e.breedPrefs,
    depositRequiredCents: e.depositRequiredCents,
    depositPaidCents: e.depositPaidCents,
    balanceDueCents: e.balanceDueCents,
    notes: e.notes,
    allocatedOffspringId: e.offspringId ?? null,
    allocatedAnimalId: e.animalId ?? null,
    skipCount: e.skipCount,
    rejectedReason: e.rejectedReason ?? null,
    clientName: e.clientParty?.contact?.display_name ?? "Unknown",
    clientEmail: e.clientParty?.contact?.email ?? null,
    planName: e.plan?.name ?? null,
    createdAt: e.createdAt,
  }));
}

async function getFinancialSummary(
  tenantId: number,
  input: Record<string, unknown>
) {
  const status = input.status as string | undefined;

  const baseWhere = {
    tenantId,
    ...(status ? { status: status as any } : {}),
  };

  const [totals, outstanding, overdue, recent] = await Promise.all([
    prisma.invoice.aggregate({
      where: baseWhere,
      _count: { id: true },
      _sum: { amountCents: true },
    }),
    prisma.invoice.aggregate({
      where: {
        tenantId,
        status: { in: ["issued", "partially_paid"] },
      },
      _sum: { balanceCents: true },
      _count: { id: true },
    }),
    prisma.invoice.count({
      where: {
        tenantId,
        status: { in: ["issued", "partially_paid"] },
        dueAt: { lt: new Date() },
      },
    }),
    prisma.invoice.findMany({
      where: { tenantId },
      select: {
        id: true,
        invoiceNumber: true,
        amountCents: true,
        balanceCents: true,
        status: true,
        dueAt: true,
        createdAt: true,
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    totalInvoices: totals._count.id,
    totalAmountCents: Number(totals._sum.amountCents ?? 0n),
    outstandingCents: Number(outstanding._sum.balanceCents ?? 0n),
    outstandingCount: outstanding._count.id,
    overdueCount: overdue,
    recentInvoices: recent.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amountCents: Number(inv.amountCents),
      balanceCents: Number(inv.balanceCents),
      status: inv.status,
      dueAt: inv.dueAt,
      createdAt: inv.createdAt,
    })),
  };
}

async function searchHelpArticles(
  _tenantId: number,
  input: Record<string, unknown>
) {
  const query = input.query as string;
  const module = input.module as string | undefined;
  if (!query) return { error: "query is required" };

  const results = await searchArticles(query, { module, limit: 5 });
  return results.map((r) => ({
    slug: r.slug,
    title: r.title,
    module: r.module,
    excerpt: r.chunkText.slice(0, 300),
    score: Math.round(r.score * 100) / 100,
  }));
}

async function getLitterHealthSummary(
  tenantId: number,
  input: Record<string, unknown>
) {
  const planId = Number(input.plan_id);
  if (!planId) return { error: "plan_id is required" };

  const plan = await prisma.breedingPlan.findFirst({
    where: { id: planId, tenantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      species: true,
      status: true,
      birthDateActual: true,
      expectedBirthDate: true,
      dam: { select: { id: true, name: true } },
      sire: { select: { id: true, name: true } },
      // Dam's active feeding/nutrition plan
      FeedingPlan: {
        where: { isActive: true },
        select: {
          portionOz: true,
          feedingsPerDay: true,
          feedingTimes: true,
          notes: true,
          foodProduct: {
            select: { name: true, brand: true, foodType: true, proteinPct: true, fatPct: true, caloriesPerCup: true },
          },
        },
        take: 3,
      },
      // All offspring with health events + neonatal care
      Offspring: {
        select: {
          id: true,
          name: true,
          sex: true,
          breed: true,
          bornAt: true,
          status: true,
          lifeState: true,
          healthStatus: true,
          healthNotes: true,
          isExtraNeeds: true,
          // Vaccinations, dewormings, weight checks
          HealthLogs: {
            select: {
              kind: true,
              occurredAt: true,
              weightGrams: true,
              vaccineCode: true,
              dose: true,
              vetClinic: true,
              result: true,
              notes: true,
            },
            orderBy: { occurredAt: "desc" as const },
            take: 15,
          },
          // Neonatal care: temperature, weight, feeding logs
          NeonatalCareEntries: {
            select: {
              recordedAt: true,
              weightOz: true,
              weightChangePercent: true,
              temperatureF: true,
              feedingMethod: true,
              feedingVolumeMl: true,
              feedingNotes: true,
              activityLevel: true,
              notes: true,
            },
            orderBy: { recordedAt: "desc" as const },
            take: 5,
          },
        },
        orderBy: { bornAt: "asc" as const },
      },
    },
  });

  if (!plan) return { error: "Breeding plan not found" };

  // Rename PascalCase Prisma relations for cleaner AI output
  const { FeedingPlan, Offspring, ...planRest } = plan;
  return {
    ...planRest,
    damFeedingPlans: FeedingPlan,
    offspring: Offspring.map(({ HealthLogs, NeonatalCareEntries, ...o }) => ({
      ...o,
      healthEvents: HealthLogs,
      neonatalCareEntries: NeonatalCareEntries,
    })),
  };
}

async function getFarmOverview(
  tenantId: number,
  _input: Record<string, unknown>
) {
  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    animalsBySpecies,
    activePlans,
    upcomingDue,
    recentOffspring,
    waitlistTotal,
    outstandingInvoices,
  ] = await Promise.all([
    // Animal counts by species
    prisma.animal.groupBy({
      by: ["species"],
      where: { tenantId, archived: false, deletedAt: null },
      _count: { id: true },
    }),

    // Active breeding plans
    prisma.breedingPlan.count({
      where: {
        tenantId,
        deletedAt: null,
        archived: false,
        status: {
          in: [
            "PLANNING", "COMMITTED", "CYCLE_EXPECTED", "HORMONE_TESTING",
            "BRED", "PREGNANT", "BIRTHED", "WEANED", "PLACEMENT",
          ] as any[],
        },
      },
    }),

    // Upcoming due dates (next 30 days)
    prisma.breedingPlan.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ["BRED", "PREGNANT"] as any[] },
        expectedBirthDate: { gte: now, lte: thirtyDaysOut },
      },
      select: {
        id: true,
        name: true,
        expectedBirthDate: true,
        dam: { select: { name: true } },
        sire: { select: { name: true } },
      },
      orderBy: { expectedBirthDate: "asc" },
      take: 10,
    }),

    // Recent offspring (last 30 days)
    prisma.offspring.count({
      where: {
        tenantId,
        bornAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),

    // Total active waitlist entries
    prisma.waitlistEntry.count({
      where: {
        tenantId,
        status: { in: ["INQUIRY", "DEPOSIT_DUE", "DEPOSIT_PAID", "READY", "APPROVED"] as any[] },
      },
    }),

    // Outstanding invoice balance
    prisma.invoice.aggregate({
      where: {
        tenantId,
        status: { in: ["issued", "partially_paid"] as any[] },
      },
      _sum: { balanceCents: true },
    }),
  ]);

  return {
    animalsBySpecies: animalsBySpecies.map((g) => ({
      species: g.species,
      count: g._count.id,
    })),
    activePlanCount: activePlans,
    upcomingDueDates: upcomingDue.map((p) => ({
      planName: p.name,
      expectedBirthDate: p.expectedBirthDate,
      damName: p.dam?.name ?? null,
      sireName: p.sire?.name ?? null,
    })),
    recentOffspringCount: recentOffspring,
    activeWaitlistCount: waitlistTotal,
    outstandingInvoiceCents: Number(
      outstandingInvoices._sum.balanceCents ?? 0n
    ),
  };
}

// ── Handler Map ──────────────────────────────────────────────────────────

export const toolHandlers: Record<string, ToolHandler> = {
  search_animals: searchAnimals,
  get_animal_details: getAnimalDetails,
  search_breeding_plans: searchBreedingPlans,
  get_breeding_plan_details: getBreedingPlanDetails,
  search_offspring: searchOffspring,
  search_contacts: searchContacts,
  get_waitlist: getWaitlist,
  get_financial_summary: getFinancialSummary,
  search_help_articles: searchHelpArticles,
  get_litter_health_summary: getLitterHealthSummary,
  get_farm_overview: getFarmOverview,
};

/**
 * Generate a short human-readable summary of a tool result.
 * Shown in the SSE `tool_result` event for the frontend indicator.
 */
export function generateToolSummary(
  toolName: string,
  result: unknown
): string {
  if (!result || typeof result !== "object") return "Done";
  const r = result as any;

  if (r.error) return `Error: ${r.error}`;

  if (Array.isArray(r)) {
    return `Found ${r.length} result${r.length !== 1 ? "s" : ""}`;
  }

  switch (toolName) {
    case "get_animal_details":
      return r.name ? `Retrieved ${r.name}` : "Retrieved animal details";
    case "get_breeding_plan_details":
      return r.name ? `Retrieved plan "${r.name}"` : "Retrieved plan details";
    case "get_financial_summary":
      return `${r.totalInvoices ?? 0} invoices, $${((r.outstandingCents ?? 0) / 100).toFixed(2)} outstanding`;
    case "get_farm_overview": {
      const total = (r.animalsBySpecies ?? []).reduce(
        (sum: number, g: any) => sum + (g.count ?? 0),
        0
      );
      return `${total} animals, ${r.activePlanCount ?? 0} active plans`;
    }
    default:
      if (r.results && Array.isArray(r.results)) {
        return `Found ${r.results.length} result${r.results.length !== 1 ? "s" : ""}`;
      }
      return "Done";
  }
}
