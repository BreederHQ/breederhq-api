// src/services/neonatal-care-service.ts
// Service functions for neonatal care tracking (daily care entries and interventions)

import prisma from "../prisma.js";
import type { Prisma } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

export interface CreateNeonatalCareEntryInput {
  offspringId: number;
  tenantId: number;
  recordedAt: Date;
  recordedBy?: string;
  recordedById?: string;
  weightOz?: number;
  temperatureF?: number;
  feedingMethod?: string;
  feedingVolumeMl?: number;
  feedingNotes?: string;
  urinated?: boolean;
  stoolQuality?: string;
  activityLevel?: string;
  notes?: string;
}

export interface CreateNeonatalInterventionInput {
  offspringId: number;
  tenantId: number;
  occurredAt: Date;
  type: string;
  route?: string;
  dose?: string;
  administeredBy?: string;
  vetClinic?: string;
  reason?: string;
  response?: string;
  followUpNeeded?: boolean;
  followUpDate?: Date;
  cost?: number;
  notes?: string;
  recordedById?: string;
}

export interface NeonatalDashboardData {
  planId: number;
  species: string;
  birthDate: string | null;
  daysSinceBirth: number | null;
  criticalPeriodDays: number;
  offspring: Array<{
    id: number;
    name: string | null;
    collarColorName: string | null;
    collarColorHex: string | null;
    sex: string | null;
    birthWeightOz: number | null;
    isExtraNeeds: boolean;
    neonatalHealthStatus: string | null;
    neonatalFeedingMethod: string | null;
    latestEntry: {
      recordedAt: string;
      weightOz: number | null;
      weightChangePercent: number | null;
      temperatureF: number | null;
      feedingMethod: string | null;
      activityLevel: string | null;
    } | null;
    entryCount: number;
    interventionCount: number;
  }>;
  activeInterventions: Array<{
    id: number;
    offspringId: number;
    offspringName: string | null;
    type: string;
    occurredAt: string;
    followUpNeeded: boolean;
    followUpDate: string | null;
  }>;
}

// ============================================================================
// Care Entry CRUD
// ============================================================================

/**
 * Create a neonatal care entry for an offspring
 */
export async function createNeonatalCareEntry(input: CreateNeonatalCareEntryInput) {
  // Verify offspring exists and belongs to tenant
  const offspring = await prisma.offspring.findFirst({
    where: { id: input.offspringId, tenantId: input.tenantId },
  });

  if (!offspring) {
    throw new Error("Offspring not found");
  }

  // Calculate weight change percent from previous entry
  let weightChangePercent: number | null = null;
  if (input.weightOz != null) {
    const previousEntry = await prisma.neonatalCareEntry.findFirst({
      where: {
        offspringId: input.offspringId,
        tenantId: input.tenantId,
        weightOz: { not: null },
        recordedAt: { lt: input.recordedAt },
      },
      orderBy: { recordedAt: "desc" },
    });

    if (previousEntry?.weightOz) {
      const prevWeight = Number(previousEntry.weightOz);
      if (prevWeight > 0) {
        weightChangePercent = ((input.weightOz - prevWeight) / prevWeight) * 100;
      }
    }
  }

  const entry = await prisma.neonatalCareEntry.create({
    data: {
      tenantId: input.tenantId,
      offspringId: input.offspringId,
      recordedAt: input.recordedAt,
      recordedBy: input.recordedBy,
      recordedById: input.recordedById,
      weightOz: input.weightOz,
      weightChangePercent,
      temperatureF: input.temperatureF,
      feedingMethod: input.feedingMethod as any,
      feedingVolumeMl: input.feedingVolumeMl,
      feedingNotes: input.feedingNotes,
      urinated: input.urinated,
      stoolQuality: input.stoolQuality as any,
      activityLevel: input.activityLevel as any,
      notes: input.notes,
    },
  });

  // Update offspring's feeding method if provided
  if (input.feedingMethod) {
    await prisma.offspring.update({
      where: { id: input.offspringId },
      data: { neonatalFeedingMethod: input.feedingMethod as any },
    });
  }

  return entry;
}

/**
 * Get care entries for an offspring
 */
export async function getNeonatalCareEntries(
  offspringId: number,
  tenantId: number,
  options?: { limit?: number; offset?: number }
) {
  const [entries, total] = await Promise.all([
    prisma.neonatalCareEntry.findMany({
      where: { offspringId, tenantId },
      orderBy: { recordedAt: "desc" },
      take: options?.limit || 50,
      skip: options?.offset || 0,
      include: {
        recordedUser: { select: { id: true, name: true } },
      },
    }),
    prisma.neonatalCareEntry.count({ where: { offspringId, tenantId } }),
  ]);

  return { entries, total };
}

/**
 * Delete a care entry
 */
export async function deleteNeonatalCareEntry(entryId: number, tenantId: number) {
  const entry = await prisma.neonatalCareEntry.findFirst({
    where: { id: entryId, tenantId },
  });

  if (!entry) {
    throw new Error("Care entry not found");
  }

  await prisma.neonatalCareEntry.delete({ where: { id: entryId } });
  return { deleted: true };
}

// ============================================================================
// Intervention CRUD
// ============================================================================

/**
 * Create a neonatal intervention for an offspring
 */
export async function createNeonatalIntervention(input: CreateNeonatalInterventionInput) {
  // Verify offspring exists and belongs to tenant
  const offspring = await prisma.offspring.findFirst({
    where: { id: input.offspringId, tenantId: input.tenantId },
  });

  if (!offspring) {
    throw new Error("Offspring not found");
  }

  const intervention = await prisma.neonatalIntervention.create({
    data: {
      tenantId: input.tenantId,
      offspringId: input.offspringId,
      occurredAt: input.occurredAt,
      type: input.type as any,
      route: input.route as any,
      dose: input.dose,
      administeredBy: input.administeredBy as any,
      vetClinic: input.vetClinic,
      reason: input.reason,
      response: input.response as any,
      followUpNeeded: input.followUpNeeded || false,
      followUpDate: input.followUpDate,
      cost: input.cost,
      notes: input.notes,
      recordedById: input.recordedById,
    },
  });

  // Mark offspring as extra needs if this is a significant intervention
  const significantTypes = ["PLASMA_TRANSFUSION", "TUBE_FEEDING", "SUBQ_FLUIDS", "IV_FLUIDS", "OXYGEN_THERAPY"];
  if (significantTypes.includes(input.type)) {
    await prisma.offspring.update({
      where: { id: input.offspringId },
      data: { isExtraNeeds: true },
    });
  }

  return intervention;
}

/**
 * Get interventions for an offspring
 */
export async function getNeonatalInterventions(
  offspringId: number,
  tenantId: number,
  options?: { limit?: number; offset?: number }
) {
  const [interventions, total] = await Promise.all([
    prisma.neonatalIntervention.findMany({
      where: { offspringId, tenantId },
      orderBy: { occurredAt: "desc" },
      take: options?.limit || 50,
      skip: options?.offset || 0,
      include: {
        recordedUser: { select: { id: true, name: true } },
      },
    }),
    prisma.neonatalIntervention.count({ where: { offspringId, tenantId } }),
  ]);

  return { interventions, total };
}

/**
 * Update intervention response/follow-up
 */
export async function updateNeonatalIntervention(
  interventionId: number,
  tenantId: number,
  data: {
    response?: string;
    followUpNeeded?: boolean;
    followUpDate?: Date;
    notes?: string;
  }
) {
  const intervention = await prisma.neonatalIntervention.findFirst({
    where: { id: interventionId, tenantId },
  });

  if (!intervention) {
    throw new Error("Intervention not found");
  }

  return prisma.neonatalIntervention.update({
    where: { id: interventionId },
    data: {
      response: data.response as any,
      followUpNeeded: data.followUpNeeded,
      followUpDate: data.followUpDate,
      notes: data.notes,
    },
  });
}

// ============================================================================
// Dashboard Data
// ============================================================================

/**
 * Get neonatal dashboard data for a breeding plan
 */
export async function getNeonatalDashboard(
  planId: number,
  tenantId: number
): Promise<NeonatalDashboardData> {
  // Get the breeding plan with offspring group
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: planId, tenantId },
    include: {
      offspringGroup: {
        include: {
          Offspring: {
            where: { archivedAt: null },
            include: {
              NeonatalCareEntries: {
                orderBy: { recordedAt: "desc" },
                take: 1,
              },
              _count: {
                select: {
                  NeonatalCareEntries: true,
                  NeonatalInterventions: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!plan) {
    throw new Error("Breeding plan not found");
  }

  const species = plan.species || "DOG";
  const birthDate = plan.birthDateActual;

  // Calculate days since birth
  let daysSinceBirth: number | null = null;
  if (birthDate) {
    const birth = new Date(birthDate);
    const today = new Date();
    daysSinceBirth = Math.floor((today.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Get critical period based on species
  const criticalPeriodDays = getCriticalPeriodDays(species);

  // Get active interventions (with follow-up needed)
  const activeInterventions = await prisma.neonatalIntervention.findMany({
    where: {
      tenantId,
      offspring: {
        group: { planId },
      },
      followUpNeeded: true,
    },
    include: {
      offspring: { select: { id: true, name: true } },
    },
    orderBy: { followUpDate: "asc" },
    take: 20,
  });

  // Map offspring data
  const offspring = (plan.offspringGroup?.Offspring || []).map((o) => {
    const latestEntry = o.NeonatalCareEntries[0] || null;
    return {
      id: o.id,
      name: o.name,
      collarColorName: o.collarColorName,
      collarColorHex: o.collarColorHex,
      sex: o.sex,
      birthWeightOz: o.birthWeightOz,
      isExtraNeeds: o.isExtraNeeds,
      neonatalHealthStatus: o.neonatalHealthStatus,
      neonatalFeedingMethod: o.neonatalFeedingMethod,
      latestEntry: latestEntry ? {
        recordedAt: latestEntry.recordedAt.toISOString(),
        weightOz: latestEntry.weightOz ? Number(latestEntry.weightOz) : null,
        weightChangePercent: latestEntry.weightChangePercent ? Number(latestEntry.weightChangePercent) : null,
        temperatureF: latestEntry.temperatureF ? Number(latestEntry.temperatureF) : null,
        feedingMethod: latestEntry.feedingMethod,
        activityLevel: latestEntry.activityLevel,
      } : null,
      entryCount: o._count.NeonatalCareEntries,
      interventionCount: o._count.NeonatalInterventions,
    };
  });

  return {
    planId,
    species,
    birthDate: birthDate?.toISOString() || null,
    daysSinceBirth,
    criticalPeriodDays,
    offspring,
    activeInterventions: activeInterventions.map((i) => ({
      id: i.id,
      offspringId: i.offspringId,
      offspringName: i.offspring.name,
      type: i.type,
      occurredAt: i.occurredAt.toISOString(),
      followUpNeeded: i.followUpNeeded,
      followUpDate: i.followUpDate?.toISOString() || null,
    })),
  };
}

/**
 * Update offspring neonatal status
 */
export async function updateOffspringNeonatalStatus(
  offspringId: number,
  tenantId: number,
  data: {
    isExtraNeeds?: boolean;
    neonatalHealthStatus?: string;
    neonatalFeedingMethod?: string;
  }
) {
  const offspring = await prisma.offspring.findFirst({
    where: { id: offspringId, tenantId },
  });

  if (!offspring) {
    throw new Error("Offspring not found");
  }

  return prisma.offspring.update({
    where: { id: offspringId },
    data: {
      isExtraNeeds: data.isExtraNeeds,
      neonatalHealthStatus: data.neonatalHealthStatus as any,
      neonatalFeedingMethod: data.neonatalFeedingMethod as any,
    },
  });
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get critical period days based on species
 */
function getCriticalPeriodDays(species: string): number {
  const criticalPeriods: Record<string, number> = {
    DOG: 14,      // First 2 weeks critical for puppies
    CAT: 14,      // First 2 weeks critical for kittens
    RABBIT: 10,   // First 10 days critical for kits
    GOAT: 7,      // First week critical for kids
    SHEEP: 7,     // First week critical for lambs
    PIG: 7,       // First week critical for piglets
    CHICKEN: 7,   // First week critical for chicks
  };
  return criticalPeriods[species.toUpperCase()] || 14;
}

/**
 * Batch record weights for multiple offspring
 */
export async function batchRecordWeights(
  tenantId: number,
  entries: Array<{
    offspringId: number;
    weightOz: number;
    recordedAt?: Date;
  }>,
  recordedById?: string
) {
  const results = await Promise.all(
    entries.map((e) =>
      createNeonatalCareEntry({
        offspringId: e.offspringId,
        tenantId,
        recordedAt: e.recordedAt || new Date(),
        weightOz: e.weightOz,
        recordedById,
      })
    )
  );
  return results;
}
