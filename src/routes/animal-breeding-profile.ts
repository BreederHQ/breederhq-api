// src/routes/animal-breeding-profile.ts
// Animal Breeding Profile API - User-entered breeding preferences and events

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import prisma from "../prisma.js";

// ════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parsePaging(query: any) {
  const page = Math.max(1, Number(query?.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(query?.limit ?? 25) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

async function assertTenant(req: any, reply: any): Promise<number | null> {
  const tenantId = Number((req as any).tenantId);
  if (!tenantId) {
    reply.code(400).send({ error: { code: "missing_tenant", message: "Tenant ID is required" } });
    return null;
  }
  return tenantId;
}

async function assertAnimalInTenant(
  animalId: number,
  tenantId: number
): Promise<{ id: number; tenantId: number; sex: string; species: string } | null> {
  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    select: { id: true, tenantId: true, sex: true, species: true },
  });
  if (!animal) return null;
  if (animal.tenantId !== tenantId) return null;
  return animal;
}

// ════════════════════════════════════════════════════════════════════════════
// ZOD VALIDATION SCHEMAS
// ════════════════════════════════════════════════════════════════════════════

const BreedingStatusSchema = z.enum([
  "INTACT",
  "PROVEN",
  "RETIRED",
  "NEUTERED",
  "SUSPECTED_ISSUES",
  "UNDER_EVALUATION",
]);

const BreedingEnvironmentSchema = z.enum([
  "INDOOR_ONLY",
  "OUTDOOR_ONLY",
  "EITHER",
  "SPECIFIC_LOCATION",
]);

const BreedingTemperamentSchema = z.enum([
  "CALM",
  "RECEPTIVE",
  "EAGER",
  "NERVOUS",
  "AGGRESSIVE",
  "REQUIRES_ASSISTANCE",
  "VARIABLE",
]);

const LibidoRatingSchema = z.enum(["HIGH", "MEDIUM", "LOW", "VARIABLE", "UNKNOWN"]);

const FertilityStatusSchema = z.enum([
  "PROVEN",
  "UNPROVEN",
  "SUSPECTED_LOW",
  "CONFIRMED_LOW",
  "UNKNOWN",
]);

const ServiceTypeSchema = z.enum(["NATURAL_ONLY", "AI_ONLY", "BOTH", "UNKNOWN"]);

const HeatCycleRegularitySchema = z.enum([
  "REGULAR",
  "IRREGULAR",
  "SILENT",
  "SPLIT",
  "UNKNOWN",
]);

const MaternalRatingSchema = z.enum([
  "EXCELLENT",
  "GOOD",
  "FAIR",
  "POOR",
  "UNKNOWN",
]);

const MilkProductionStatusSchema = z.enum([
  "ABUNDANT",
  "SUFFICIENT",
  "INSUFFICIENT",
  "NONE",
  "UNKNOWN",
]);

const IncompatibilitySeveritySchema = z.enum(["AVOID", "CAUTION"]);

const BreedingEventTypeSchema = z.enum([
  "BREEDING_ATTEMPT",
  "SUCCESSFUL_BREEDING",
  "FAILED_BREEDING",
  "PREGNANCY_CONFIRMED",
  "PREGNANCY_LOSS",
  "BIRTH_OUTCOME",
  "FERTILITY_TEST",
  "HEAT_CYCLE",
  "BEHAVIORAL_NOTE",
  "VET_CONSULTATION",
  "INCOMPATIBILITY",
  "OTHER",
]);

const BreedingEventOutcomeSchema = z.enum([
  "SUCCESSFUL",
  "UNSUCCESSFUL",
  "PARTIAL",
  "PENDING",
  "NOT_APPLICABLE",
]);

const DeliveryTypeSchema = z.enum(["NATURAL", "C_SECTION", "ASSISTED"]);

const BreedingServiceTypeSchema = z.enum(["NATURAL", "AI"]);

// Profile update schema (all fields optional for PATCH)
const UpdateBreedingProfileSchema = z.object({
  // Status
  breedingStatus: BreedingStatusSchema.optional(),
  statusNotes: z.string().optional().nullable(),

  // Preferences (all animals)
  environmentPreference: BreedingEnvironmentSchema.optional().nullable(),
  environmentNotes: z.string().optional().nullable(),
  temperament: BreedingTemperamentSchema.optional().nullable(),
  temperamentNotes: z.string().optional().nullable(),
  specialRequirements: z.string().optional().nullable(),
  generalNotes: z.string().optional().nullable(),

  // Male-specific fields
  libido: LibidoRatingSchema.optional().nullable(),
  libidoNotes: z.string().optional().nullable(),
  serviceType: ServiceTypeSchema.optional().nullable(),
  collectionTrained: z.boolean().optional().nullable(),
  collectionNotes: z.string().optional().nullable(),
  fertilityStatus: FertilityStatusSchema.optional().nullable(),
  lastFertilityTestDate: z.string().optional().nullable(),
  lastFertilityTestResult: z.string().optional().nullable(),
  fertilityNotes: z.string().optional().nullable(),

  // Female-specific fields
  heatCycleRegularity: HeatCycleRegularitySchema.optional().nullable(),
  avgCycleLengthDays: z.number().int().min(1).max(365).optional().nullable(),
  lastHeatDate: z.string().optional().nullable(),
  heatNotes: z.string().optional().nullable(),
  pregnancyComplications: z.string().optional().nullable(),
  proneToComplications: z.boolean().optional().nullable(),
  naturalBirthCount: z.number().int().min(0).optional(),
  cSectionCount: z.number().int().min(0).optional(),
  cSectionNotes: z.string().optional().nullable(),
  lastBirthType: z.enum(["NATURAL", "C_SECTION"]).optional().nullable(),
  lastBirthDate: z.string().optional().nullable(),
  maternalRating: MaternalRatingSchema.optional().nullable(),
  maternalNotes: z.string().optional().nullable(),
  milkProduction: MilkProductionStatusSchema.optional().nullable(),
  mastitisHistory: z.boolean().optional().nullable(),
  milkNotes: z.string().optional().nullable(),
  recoveryPattern: z.string().optional().nullable(),
});

const AddIncompatibilitySchema = z.object({
  incompatibleAnimalId: z.number().int().positive(),
  reason: z.string().min(1).max(500),
  severity: IncompatibilitySeveritySchema.default("AVOID"),
});

const CreateBreedingEventSchema = z.object({
  eventType: BreedingEventTypeSchema,
  occurredAt: z.string().min(1), // ISO date string
  outcome: BreedingEventOutcomeSchema.optional(),
  breedingPlanId: z.number().int().positive().optional().nullable(),
  partnerAnimalId: z.number().int().positive().optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  serviceType: BreedingServiceTypeSchema.optional().nullable(),
  tieDurationMinutes: z.number().int().min(0).max(120).optional().nullable(),
  totalBorn: z.number().int().min(0).optional().nullable(),
  bornAlive: z.number().int().min(0).optional().nullable(),
  stillborn: z.number().int().min(0).optional().nullable(),
  deliveryType: DeliveryTypeSchema.optional().nullable(),
  testType: z.string().max(100).optional().nullable(),
  testResult: z.string().max(500).optional().nullable(),
});

const UpdateBreedingEventSchema = CreateBreedingEventSchema.partial();

// ════════════════════════════════════════════════════════════════════════════
// HELPER: BUILD EMPTY PROFILE RESPONSE
// ════════════════════════════════════════════════════════════════════════════

function buildEmptyProfile(animalId: number, sex: string) {
  const base = {
    id: null,
    animalId,
    breedingStatus: "INTACT",
    statusNotes: null,
    statusChangedAt: null,
    environmentPreference: null,
    environmentNotes: null,
    temperament: null,
    temperamentNotes: null,
    specialRequirements: null,
    generalNotes: null,
    incompatibleAnimals: [],
    createdAt: null,
    updatedAt: null,
  };

  if (sex === "MALE") {
    return {
      ...base,
      sex: "MALE",
      libido: null,
      libidoNotes: null,
      serviceType: null,
      collectionTrained: null,
      collectionNotes: null,
      fertilityStatus: null,
      lastFertilityTestDate: null,
      lastFertilityTestResult: null,
      fertilityNotes: null,
    };
  } else {
    return {
      ...base,
      sex: "FEMALE",
      heatCycleRegularity: null,
      avgCycleLengthDays: null,
      lastHeatDate: null,
      heatNotes: null,
      pregnancyComplications: null,
      proneToComplications: false,
      naturalBirthCount: 0,
      cSectionCount: 0,
      cSectionNotes: null,
      lastBirthType: null,
      lastBirthDate: null,
      maternalRating: null,
      maternalNotes: null,
      milkProduction: null,
      mastitisHistory: false,
      milkNotes: null,
      recoveryPattern: null,
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// HELPER: FORMAT PROFILE RESPONSE
// ════════════════════════════════════════════════════════════════════════════

function formatProfileResponse(profile: any, animal: { sex: string }, incompatibilities: any[]) {
  const formattedIncompatibilities = incompatibilities.map((inc) => ({
    id: inc.id,
    animalId: profile.animalId,
    incompatibleAnimalId: inc.incompatibleAnimalId,
    incompatibleAnimalName: inc.incompatibleAnimal?.name || null,
    reason: inc.reason,
    severity: inc.severity,
    recordedAt: inc.recordedAt?.toISOString() || null,
    recordedBy: inc.recordedBy,
  }));

  const base = {
    id: profile.id,
    animalId: profile.animalId,
    tenantId: profile.tenantId,
    breedingStatus: profile.breedingStatus,
    statusNotes: profile.statusNotes,
    statusChangedAt: profile.statusChangedAt?.toISOString() || null,
    environmentPreference: profile.environmentPreference,
    environmentNotes: profile.environmentNotes,
    temperament: profile.temperament,
    temperamentNotes: profile.temperamentNotes,
    specialRequirements: profile.specialRequirements,
    generalNotes: profile.generalNotes,
    incompatibleAnimals: formattedIncompatibilities,
    createdAt: profile.createdAt?.toISOString() || null,
    updatedAt: profile.updatedAt?.toISOString() || null,
  };

  if (animal.sex === "MALE") {
    return {
      ...base,
      sex: "MALE",
      libido: profile.libido,
      libidoNotes: profile.libidoNotes,
      serviceType: profile.serviceType,
      collectionTrained: profile.collectionTrained,
      collectionNotes: profile.collectionNotes,
      fertilityStatus: profile.fertilityStatus,
      lastFertilityTestDate: profile.lastFertilityTestDate?.toISOString()?.split("T")[0] || null,
      lastFertilityTestResult: profile.lastFertilityTestResult,
      fertilityNotes: profile.fertilityNotes,
    };
  } else {
    return {
      ...base,
      sex: "FEMALE",
      heatCycleRegularity: profile.heatCycleRegularity,
      avgCycleLengthDays: profile.avgCycleLengthDays,
      lastHeatDate: profile.lastHeatDate?.toISOString()?.split("T")[0] || null,
      heatNotes: profile.heatNotes,
      pregnancyComplications: profile.pregnancyComplications,
      proneToComplications: profile.proneToComplications ?? false,
      naturalBirthCount: profile.naturalBirthCount ?? 0,
      cSectionCount: profile.cSectionCount ?? 0,
      cSectionNotes: profile.cSectionNotes,
      lastBirthType: profile.lastBirthType,
      lastBirthDate: profile.lastBirthDate?.toISOString()?.split("T")[0] || null,
      maternalRating: profile.maternalRating,
      maternalNotes: profile.maternalNotes,
      milkProduction: profile.milkProduction,
      mastitisHistory: profile.mastitisHistory ?? false,
      milkNotes: profile.milkNotes,
      recoveryPattern: profile.recoveryPattern,
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// HELPER: COMPUTE BREEDING STATS
// ════════════════════════════════════════════════════════════════════════════

async function computeMaleBreedingStats(animalId: number, tenantId: number) {
  // Get all breeding plans where this animal is the sire
  const plans = await prisma.breedingPlan.findMany({
    where: { tenantId, sireId: animalId },
    select: {
      id: true,
      status: true,
      birthDateActual: true,
      breedDateActual: true,
      countBorn: true,
      countLive: true,
      BreedingAttempts: {
        select: {
          id: true,
          success: true,
          attemptAt: true,
        },
      },
    },
  });

  let totalBreedingAttempts = 0;
  let successfulBreedings = 0;
  let pregnanciesProduced = 0;
  let totalOffspring = 0;
  const litterSizes: number[] = [];
  let lastBreedingDate: Date | null = null;

  for (const plan of plans) {
    // Count breeding attempts
    totalBreedingAttempts += plan.BreedingAttempts.length;
    successfulBreedings += plan.BreedingAttempts.filter((a) => a.success === true).length;

    // Track last breeding date
    for (const attempt of plan.BreedingAttempts) {
      if (attempt.attemptAt && (!lastBreedingDate || attempt.attemptAt > lastBreedingDate)) {
        lastBreedingDate = attempt.attemptAt;
      }
    }

    // Also check plan-level breedDateActual
    if (plan.breedDateActual && (!lastBreedingDate || plan.breedDateActual > lastBreedingDate)) {
      lastBreedingDate = plan.breedDateActual;
    }

    // Count pregnancies and offspring (data now directly on breedingPlan)
    if (plan.birthDateActual) {
      pregnanciesProduced++;
      const litterSize = plan.countLive ?? plan.countBorn ?? 0;
      if (litterSize > 0) {
        totalOffspring += litterSize;
        litterSizes.push(litterSize);
      }
    }
  }

  return {
    totalBreedingAttempts,
    successfulBreedings,
    pregnanciesProduced,
    conceptionRate: successfulBreedings > 0 ? Math.round((pregnanciesProduced / successfulBreedings) * 100) : 0,
    totalOffspring,
    avgLitterSize: litterSizes.length > 0 ? Math.round((litterSizes.reduce((a, b) => a + b, 0) / litterSizes.length) * 10) / 10 : 0,
    largestLitter: litterSizes.length > 0 ? Math.max(...litterSizes) : 0,
    smallestLitter: litterSizes.length > 0 ? Math.min(...litterSizes) : 0,
    lastBreedingDate: lastBreedingDate?.toISOString()?.split("T")[0] || null,
  };
}

async function computeFemaleBreedingStats(animalId: number, tenantId: number) {
  // Get all breeding plans where this animal is the dam
  const plans = await prisma.breedingPlan.findMany({
    where: { tenantId, damId: animalId },
    select: {
      id: true,
      status: true,
      birthDateActual: true,
      countBorn: true,
      countLive: true,
      countStillborn: true,
    },
  });

  let totalPregnancies = 0;
  let liveLitters = 0;
  let pregnancyLosses = 0;
  let totalOffspring = 0;
  let totalDeceased = 0;
  const litterSizes: number[] = [];
  let lastPregnancyDate: Date | null = null;
  let lastBirthDate: Date | null = null;

  for (const plan of plans) {
    const hasBirth = plan.birthDateActual;

    if (hasBirth) {
      totalPregnancies++;
      liveLitters++;
      const birthDate = plan.birthDateActual;
      if (birthDate && (!lastBirthDate || birthDate > lastBirthDate)) {
        lastBirthDate = birthDate;
        lastPregnancyDate = birthDate;
      }

      const litterSize = plan.countLive ?? plan.countBorn ?? 0;
      if (litterSize > 0) {
        totalOffspring += litterSize;
        litterSizes.push(litterSize);
      }
      totalDeceased += plan.countStillborn ?? 0;
    } else if (plan.status === "CANCELED" || plan.status === "UNSUCCESSFUL") {
      // Count as pregnancy loss if plan was cancelled/failed
      pregnancyLosses++;
    }
  }

  const totalBorn = totalOffspring + totalDeceased;

  return {
    totalPregnancies,
    liveLitters,
    pregnancyLosses,
    totalOffspring,
    avgLitterSize: litterSizes.length > 0 ? Math.round((litterSizes.reduce((a, b) => a + b, 0) / litterSizes.length) * 10) / 10 : 0,
    largestLitter: litterSizes.length > 0 ? Math.max(...litterSizes) : 0,
    smallestLitter: litterSizes.length > 0 ? Math.min(...litterSizes) : 0,
    offspringMortalityRate: totalBorn > 0 ? Math.round((totalDeceased / totalBorn) * 1000) / 10 : 0,
    lastPregnancyDate: lastPregnancyDate?.toISOString()?.split("T")[0] || null,
    lastBirthDate: lastBirthDate?.toISOString()?.split("T")[0] || null,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════════════════════

const animalBreedingProfileRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ══════════════════════════════════════════════════════════════════════════
  // GET /animals/:animalId/breeding-profile
  // Returns profile or empty structure if none exists (never 404)
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/animals/:animalId/breeding-profile", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) {
      return reply.code(400).send({
        error: { code: "invalid_animal_id", message: "Invalid animal ID" },
      });
    }

    const animal = await assertAnimalInTenant(animalId, tenantId);
    if (!animal) {
      return reply.code(404).send({
        error: { code: "animal_not_found", message: "Animal not found" },
      });
    }

    // Check for existing profile
    const profile = await prisma.animalBreedingProfile.findUnique({
      where: { animalId },
    });

    // If no profile exists, return empty structure
    if (!profile) {
      return reply.send(buildEmptyProfile(animalId, animal.sex));
    }

    // Get incompatibilities
    const incompatibilities = await prisma.animalIncompatibility.findMany({
      where: { profileId: profile.id },
      include: {
        incompatibleAnimal: {
          select: { id: true, name: true },
        },
      },
    });

    return reply.send(formatProfileResponse(profile, animal, incompatibilities));
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PATCH /animals/:animalId/breeding-profile
  // Upsert pattern: creates if not exists, updates if exists
  // ══════════════════════════════════════════════════════════════════════════
  app.patch("/animals/:animalId/breeding-profile", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) {
      return reply.code(400).send({
        error: { code: "invalid_animal_id", message: "Invalid animal ID" },
      });
    }

    const animal = await assertAnimalInTenant(animalId, tenantId);
    if (!animal) {
      return reply.code(404).send({
        error: { code: "animal_not_found", message: "Animal not found" },
      });
    }

    // Validate request body
    const parsed = UpdateBreedingProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "validation_error",
          message: "Invalid request body",
          details: parsed.error.issues,
        },
      });
    }

    const data = parsed.data;

    // Build update data
    const updateData: any = {};

    // Common fields
    if (data.breedingStatus !== undefined) {
      updateData.breedingStatus = data.breedingStatus;
      updateData.statusChangedAt = new Date();
    }
    if (data.statusNotes !== undefined) updateData.statusNotes = data.statusNotes;
    if (data.environmentPreference !== undefined) updateData.environmentPreference = data.environmentPreference;
    if (data.environmentNotes !== undefined) updateData.environmentNotes = data.environmentNotes;
    if (data.temperament !== undefined) updateData.temperament = data.temperament;
    if (data.temperamentNotes !== undefined) updateData.temperamentNotes = data.temperamentNotes;
    if (data.specialRequirements !== undefined) updateData.specialRequirements = data.specialRequirements;
    if (data.generalNotes !== undefined) updateData.generalNotes = data.generalNotes;

    // Male-specific fields
    if (animal.sex === "MALE") {
      if (data.libido !== undefined) updateData.libido = data.libido;
      if (data.libidoNotes !== undefined) updateData.libidoNotes = data.libidoNotes;
      if (data.serviceType !== undefined) updateData.serviceType = data.serviceType;
      if (data.collectionTrained !== undefined) updateData.collectionTrained = data.collectionTrained;
      if (data.collectionNotes !== undefined) updateData.collectionNotes = data.collectionNotes;
      if (data.fertilityStatus !== undefined) updateData.fertilityStatus = data.fertilityStatus;
      if (data.lastFertilityTestDate !== undefined) {
        updateData.lastFertilityTestDate = data.lastFertilityTestDate
          ? new Date(data.lastFertilityTestDate)
          : null;
      }
      if (data.lastFertilityTestResult !== undefined) updateData.lastFertilityTestResult = data.lastFertilityTestResult;
      if (data.fertilityNotes !== undefined) updateData.fertilityNotes = data.fertilityNotes;
    }

    // Female-specific fields
    if (animal.sex === "FEMALE") {
      if (data.heatCycleRegularity !== undefined) updateData.heatCycleRegularity = data.heatCycleRegularity;
      if (data.avgCycleLengthDays !== undefined) updateData.avgCycleLengthDays = data.avgCycleLengthDays;
      if (data.lastHeatDate !== undefined) {
        updateData.lastHeatDate = data.lastHeatDate ? new Date(data.lastHeatDate) : null;
      }
      if (data.heatNotes !== undefined) updateData.heatNotes = data.heatNotes;
      if (data.pregnancyComplications !== undefined) updateData.pregnancyComplications = data.pregnancyComplications;
      if (data.proneToComplications !== undefined) updateData.proneToComplications = data.proneToComplications;
      if (data.naturalBirthCount !== undefined) updateData.naturalBirthCount = data.naturalBirthCount;
      if (data.cSectionCount !== undefined) updateData.cSectionCount = data.cSectionCount;
      if (data.cSectionNotes !== undefined) updateData.cSectionNotes = data.cSectionNotes;
      if (data.lastBirthType !== undefined) updateData.lastBirthType = data.lastBirthType;
      if (data.lastBirthDate !== undefined) {
        updateData.lastBirthDate = data.lastBirthDate ? new Date(data.lastBirthDate) : null;
      }
      if (data.maternalRating !== undefined) updateData.maternalRating = data.maternalRating;
      if (data.maternalNotes !== undefined) updateData.maternalNotes = data.maternalNotes;
      if (data.milkProduction !== undefined) updateData.milkProduction = data.milkProduction;
      if (data.mastitisHistory !== undefined) updateData.mastitisHistory = data.mastitisHistory;
      if (data.milkNotes !== undefined) updateData.milkNotes = data.milkNotes;
      if (data.recoveryPattern !== undefined) updateData.recoveryPattern = data.recoveryPattern;
    }

    // Upsert the profile
    const profile = await prisma.animalBreedingProfile.upsert({
      where: { animalId },
      create: {
        tenantId,
        animalId,
        breedingStatus: "INTACT",
        ...updateData,
      },
      update: updateData,
    });

    // Get incompatibilities for response
    const incompatibilities = await prisma.animalIncompatibility.findMany({
      where: { profileId: profile.id },
      include: {
        incompatibleAnimal: {
          select: { id: true, name: true },
        },
      },
    });

    return reply.send(formatProfileResponse(profile, animal, incompatibilities));
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /animals/:animalId/breeding-stats
  // Compute stats from breeding plans (read-only, always computed)
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/animals/:animalId/breeding-stats", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) {
      return reply.code(400).send({
        error: { code: "invalid_animal_id", message: "Invalid animal ID" },
      });
    }

    const animal = await assertAnimalInTenant(animalId, tenantId);
    if (!animal) {
      return reply.code(404).send({
        error: { code: "animal_not_found", message: "Animal not found" },
      });
    }

    const stats =
      animal.sex === "MALE"
        ? await computeMaleBreedingStats(animalId, tenantId)
        : await computeFemaleBreedingStats(animalId, tenantId);

    return reply.send({
      animalId,
      sex: animal.sex,
      stats,
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /animals/:animalId/breeding-events
  // List breeding events (paginated, filterable)
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/animals/:animalId/breeding-events", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) {
      return reply.code(400).send({
        error: { code: "invalid_animal_id", message: "Invalid animal ID" },
      });
    }

    const animal = await assertAnimalInTenant(animalId, tenantId);
    if (!animal) {
      return reply.code(404).send({
        error: { code: "animal_not_found", message: "Animal not found" },
      });
    }

    const query = req.query as {
      eventType?: string;
      outcome?: string;
      dateFrom?: string;
      dateTo?: string;
      breedingPlanId?: string;
      page?: string;
      limit?: string;
    };

    const { page, limit, skip } = parsePaging(query);

    const where: any = { tenantId, animalId };

    if (query.eventType) {
      // Support comma-separated list of event types
      const types = query.eventType.split(",").map((t) => t.trim().toUpperCase());
      where.eventType = { in: types };
    }
    if (query.outcome) {
      where.outcome = query.outcome.toUpperCase();
    }
    if (query.dateFrom || query.dateTo) {
      where.occurredAt = {};
      if (query.dateFrom) where.occurredAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.occurredAt.lte = new Date(query.dateTo);
    }
    if (query.breedingPlanId) {
      const planId = parseIntStrict(query.breedingPlanId);
      if (planId) where.breedingPlanId = planId;
    }

    const [events, total] = await prisma.$transaction([
      prisma.breedingEvent.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip,
        take: limit,
        include: {
          partnerAnimal: {
            select: { id: true, name: true },
          },
          breedingPlan: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
      prisma.breedingEvent.count({ where }),
    ]);

    const items = events.map((event) => ({
      id: event.id,
      animalId: event.animalId,
      tenantId: event.tenantId,
      eventType: event.eventType,
      occurredAt: event.occurredAt.toISOString(),
      outcome: event.outcome,
      breedingPlanId: event.breedingPlanId,
      breedingPlanName: event.breedingPlan?.name || null,
      breedingPlanCode: event.breedingPlan?.code || null,
      partnerAnimalId: event.partnerAnimalId,
      partnerAnimalName: event.partnerAnimal?.name || null,
      title: event.title,
      description: event.description,
      serviceType: event.serviceType,
      tieDurationMinutes: event.tieDurationMinutes,
      totalBorn: event.totalBorn,
      bornAlive: event.bornAlive,
      stillborn: event.stillborn,
      deliveryType: event.deliveryType,
      testType: event.testType,
      testResult: event.testResult,
      createdAt: event.createdAt.toISOString(),
      createdBy: event.createdBy,
      updatedAt: event.updatedAt.toISOString(),
    }));

    return reply.send({ items, total, page, limit });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /animals/:animalId/breeding-events
  // Create a new breeding event
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/animals/:animalId/breeding-events", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) {
      return reply.code(400).send({
        error: { code: "invalid_animal_id", message: "Invalid animal ID" },
      });
    }

    const animal = await assertAnimalInTenant(animalId, tenantId);
    if (!animal) {
      return reply.code(404).send({
        error: { code: "animal_not_found", message: "Animal not found" },
      });
    }

    // Validate request body
    const parsed = CreateBreedingEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "validation_error",
          message: "Invalid request body",
          details: parsed.error.issues,
        },
      });
    }

    const data = parsed.data;

    // Validate partner animal if provided
    if (data.partnerAnimalId) {
      const partnerAnimal = await assertAnimalInTenant(data.partnerAnimalId, tenantId);
      if (!partnerAnimal) {
        return reply.code(400).send({
          error: { code: "invalid_partner_animal", message: "Partner animal not found" },
        });
      }
    }

    // Validate breeding plan if provided
    if (data.breedingPlanId) {
      const plan = await prisma.breedingPlan.findFirst({
        where: { id: data.breedingPlanId, tenantId },
        select: { id: true },
      });
      if (!plan) {
        return reply.code(400).send({
          error: { code: "invalid_breeding_plan", message: "Breeding plan not found" },
        });
      }
    }

    const event = await prisma.breedingEvent.create({
      data: {
        tenantId,
        animalId,
        eventType: data.eventType,
        occurredAt: new Date(data.occurredAt),
        outcome: data.outcome || null,
        breedingPlanId: data.breedingPlanId || null,
        partnerAnimalId: data.partnerAnimalId || null,
        title: data.title || null,
        description: data.description || null,
        serviceType: data.serviceType || null,
        tieDurationMinutes: data.tieDurationMinutes ?? null,
        totalBorn: data.totalBorn ?? null,
        bornAlive: data.bornAlive ?? null,
        stillborn: data.stillborn ?? null,
        deliveryType: data.deliveryType || null,
        testType: data.testType || null,
        testResult: data.testResult || null,
        createdBy: (req as any).user?.email || null,
      },
      include: {
        partnerAnimal: {
          select: { id: true, name: true },
        },
      },
    });

    return reply.code(201).send({
      id: event.id,
      animalId: event.animalId,
      tenantId: event.tenantId,
      eventType: event.eventType,
      occurredAt: event.occurredAt.toISOString(),
      outcome: event.outcome,
      breedingPlanId: event.breedingPlanId,
      partnerAnimalId: event.partnerAnimalId,
      partnerAnimalName: event.partnerAnimal?.name || null,
      title: event.title,
      description: event.description,
      serviceType: event.serviceType,
      tieDurationMinutes: event.tieDurationMinutes,
      totalBorn: event.totalBorn,
      bornAlive: event.bornAlive,
      stillborn: event.stillborn,
      deliveryType: event.deliveryType,
      testType: event.testType,
      testResult: event.testResult,
      createdAt: event.createdAt.toISOString(),
      createdBy: event.createdBy,
      updatedAt: event.updatedAt.toISOString(),
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PATCH /breeding-events/:eventId
  // Update an existing breeding event
  // ══════════════════════════════════════════════════════════════════════════
  app.patch("/breeding-events/:eventId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const eventId = parseIntStrict((req.params as { eventId: string }).eventId);
    if (!eventId) {
      return reply.code(400).send({
        error: { code: "invalid_event_id", message: "Invalid event ID" },
      });
    }

    // Check event exists and belongs to tenant
    const existingEvent = await prisma.breedingEvent.findFirst({
      where: { id: eventId, tenantId },
      select: { id: true, animalId: true },
    });

    if (!existingEvent) {
      return reply.code(404).send({
        error: { code: "event_not_found", message: "Breeding event not found" },
      });
    }

    // Validate request body
    const parsed = UpdateBreedingEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "validation_error",
          message: "Invalid request body",
          details: parsed.error.issues,
        },
      });
    }

    const data = parsed.data;

    // Validate partner animal if provided
    if (data.partnerAnimalId) {
      const partnerAnimal = await assertAnimalInTenant(data.partnerAnimalId, tenantId);
      if (!partnerAnimal) {
        return reply.code(400).send({
          error: { code: "invalid_partner_animal", message: "Partner animal not found" },
        });
      }
    }

    // Validate breeding plan if provided
    if (data.breedingPlanId) {
      const plan = await prisma.breedingPlan.findFirst({
        where: { id: data.breedingPlanId, tenantId },
        select: { id: true },
      });
      if (!plan) {
        return reply.code(400).send({
          error: { code: "invalid_breeding_plan", message: "Breeding plan not found" },
        });
      }
    }

    const updateData: any = {};
    if (data.eventType !== undefined) updateData.eventType = data.eventType;
    if (data.occurredAt !== undefined) updateData.occurredAt = new Date(data.occurredAt);
    if (data.outcome !== undefined) updateData.outcome = data.outcome;
    if (data.breedingPlanId !== undefined) updateData.breedingPlanId = data.breedingPlanId;
    if (data.partnerAnimalId !== undefined) updateData.partnerAnimalId = data.partnerAnimalId;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.serviceType !== undefined) updateData.serviceType = data.serviceType;
    if (data.tieDurationMinutes !== undefined) updateData.tieDurationMinutes = data.tieDurationMinutes;
    if (data.totalBorn !== undefined) updateData.totalBorn = data.totalBorn;
    if (data.bornAlive !== undefined) updateData.bornAlive = data.bornAlive;
    if (data.stillborn !== undefined) updateData.stillborn = data.stillborn;
    if (data.deliveryType !== undefined) updateData.deliveryType = data.deliveryType;
    if (data.testType !== undefined) updateData.testType = data.testType;
    if (data.testResult !== undefined) updateData.testResult = data.testResult;

    const event = await prisma.breedingEvent.update({
      where: { id: eventId },
      data: updateData,
      include: {
        partnerAnimal: {
          select: { id: true, name: true },
        },
      },
    });

    return reply.send({
      id: event.id,
      animalId: event.animalId,
      tenantId: event.tenantId,
      eventType: event.eventType,
      occurredAt: event.occurredAt.toISOString(),
      outcome: event.outcome,
      breedingPlanId: event.breedingPlanId,
      partnerAnimalId: event.partnerAnimalId,
      partnerAnimalName: event.partnerAnimal?.name || null,
      title: event.title,
      description: event.description,
      serviceType: event.serviceType,
      tieDurationMinutes: event.tieDurationMinutes,
      totalBorn: event.totalBorn,
      bornAlive: event.bornAlive,
      stillborn: event.stillborn,
      deliveryType: event.deliveryType,
      testType: event.testType,
      testResult: event.testResult,
      createdAt: event.createdAt.toISOString(),
      createdBy: event.createdBy,
      updatedAt: event.updatedAt.toISOString(),
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DELETE /breeding-events/:eventId
  // Delete a breeding event
  // ══════════════════════════════════════════════════════════════════════════
  app.delete("/breeding-events/:eventId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const eventId = parseIntStrict((req.params as { eventId: string }).eventId);
    if (!eventId) {
      return reply.code(400).send({
        error: { code: "invalid_event_id", message: "Invalid event ID" },
      });
    }

    // Check event exists and belongs to tenant
    const existingEvent = await prisma.breedingEvent.findFirst({
      where: { id: eventId, tenantId },
      select: { id: true },
    });

    if (!existingEvent) {
      return reply.code(404).send({
        error: { code: "event_not_found", message: "Breeding event not found" },
      });
    }

    await prisma.breedingEvent.delete({ where: { id: eventId } });

    return reply.code(204).send();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /animals/:animalId/breeding-profile/incompatibilities
  // Add an incompatibility to the profile
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/animals/:animalId/breeding-profile/incompatibilities", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) {
      return reply.code(400).send({
        error: { code: "invalid_animal_id", message: "Invalid animal ID" },
      });
    }

    const animal = await assertAnimalInTenant(animalId, tenantId);
    if (!animal) {
      return reply.code(404).send({
        error: { code: "animal_not_found", message: "Animal not found" },
      });
    }

    // Validate request body
    const parsed = AddIncompatibilitySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "validation_error",
          message: "Invalid request body",
          details: parsed.error.issues,
        },
      });
    }

    const data = parsed.data;

    // Validate incompatible animal exists and belongs to tenant
    const incompatibleAnimal = await assertAnimalInTenant(data.incompatibleAnimalId, tenantId);
    if (!incompatibleAnimal) {
      return reply.code(400).send({
        error: { code: "invalid_incompatible_animal", message: "Incompatible animal not found" },
      });
    }

    // Prevent self-incompatibility
    if (data.incompatibleAnimalId === animalId) {
      return reply.code(400).send({
        error: { code: "self_incompatibility", message: "Cannot mark animal as incompatible with itself" },
      });
    }

    // Ensure profile exists (upsert)
    const profile = await prisma.animalBreedingProfile.upsert({
      where: { animalId },
      create: {
        tenantId,
        animalId,
        breedingStatus: "INTACT",
      },
      update: {},
    });

    // Check if incompatibility already exists
    const existingIncompatibility = await prisma.animalIncompatibility.findFirst({
      where: {
        profileId: profile.id,
        incompatibleAnimalId: data.incompatibleAnimalId,
      },
    });

    if (existingIncompatibility) {
      return reply.code(409).send({
        error: {
          code: "incompatibility_exists",
          message: "Incompatibility already exists for this animal pair",
        },
      });
    }

    // Create incompatibility
    const incompatibility = await prisma.animalIncompatibility.create({
      data: {
        tenantId,
        profileId: profile.id,
        incompatibleAnimalId: data.incompatibleAnimalId,
        reason: data.reason,
        severity: data.severity,
        recordedBy: (req as any).user?.email || null,
      },
      include: {
        incompatibleAnimal: {
          select: { id: true, name: true },
        },
      },
    });

    return reply.code(201).send({
      id: incompatibility.id,
      animalId,
      incompatibleAnimalId: incompatibility.incompatibleAnimalId,
      incompatibleAnimalName: incompatibility.incompatibleAnimal?.name || null,
      reason: incompatibility.reason,
      severity: incompatibility.severity,
      recordedAt: incompatibility.recordedAt.toISOString(),
      recordedBy: incompatibility.recordedBy,
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DELETE /breeding-profile/incompatibilities/:id
  // Remove an incompatibility
  // ══════════════════════════════════════════════════════════════════════════
  app.delete("/breeding-profile/incompatibilities/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const incompatibilityId = parseIntStrict((req.params as { id: string }).id);
    if (!incompatibilityId) {
      return reply.code(400).send({
        error: { code: "invalid_id", message: "Invalid incompatibility ID" },
      });
    }

    // Check incompatibility exists and belongs to tenant
    const incompatibility = await prisma.animalIncompatibility.findFirst({
      where: { id: incompatibilityId, tenantId },
      select: { id: true },
    });

    if (!incompatibility) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Incompatibility not found" },
      });
    }

    await prisma.animalIncompatibility.delete({ where: { id: incompatibilityId } });

    return reply.code(204).send();
  });
};

export default animalBreedingProfileRoutes;
