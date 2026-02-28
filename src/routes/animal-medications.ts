// src/routes/animal-medications.ts
// Medication/treatment tracking API endpoints — course + dose pattern
// Mirrors animal-vaccinations.ts for CRUD, supplements.ts for course+dose model
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

// ────────────────────────────────────────────────────────────────────────────
// Utils
// ────────────────────────────────────────────────────────────────────────────

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseDateIso(v: unknown): Date | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(+d) ? null : d;
}

async function assertTenant(req: any, reply: any): Promise<number | null> {
  const tenantId = Number((req as any).tenantId);
  if (!tenantId) {
    reply.code(400).send({ error: "missing_tenant" });
    return null;
  }
  return tenantId;
}

async function assertAnimalInTenant(animalId: number, tenantId: number) {
  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    select: { id: true, tenantId: true, species: true, name: true },
  });
  if (!animal) throw Object.assign(new Error("animal_not_found"), { statusCode: 404 });
  if (animal.tenantId !== tenantId) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  return animal;
}

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type MedicationCategory =
  | "ANTIBIOTIC" | "NSAID" | "ANTIPARASITIC" | "ANTIFUNGAL"
  | "STEROID" | "HORMONE" | "SUPPLEMENT" | "SEDATIVE" | "ANESTHETIC" | "OTHER";

type MedicationFrequency =
  | "ONCE" | "DAILY" | "BID" | "TID" | "QID"
  | "EVERY_OTHER_DAY" | "WEEKLY" | "AS_NEEDED" | "OTHER";

type MedicationStatus = "ACTIVE" | "COMPLETED" | "DISCONTINUED" | "SCHEDULED";

type MedicationTemplate = {
  name: string;
  genericName?: string;
  category: MedicationCategory;
  species: string[];
  commonRoute?: string;
  commonDosageRange?: string;
  defaultWithdrawalDays?: number;
  isControlledSubstance?: boolean;
  description?: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Static Medication Templates (per species, like VACCINATION_PROTOCOLS)
// ────────────────────────────────────────────────────────────────────────────

const MEDICATION_TEMPLATES: MedicationTemplate[] = [
  // Horses
  { name: "Banamine", genericName: "Flunixin Meglumine", category: "NSAID", species: ["HORSE"], commonRoute: "IV/IM/Oral", commonDosageRange: "1.1 mg/kg", defaultWithdrawalDays: 10, description: "NSAID for pain, fever, and inflammation. Common post-colic or post-surgical." },
  { name: "Bute", genericName: "Phenylbutazone", category: "NSAID", species: ["HORSE"], commonRoute: "Oral/IV", commonDosageRange: "2.2-4.4 mg/kg", defaultWithdrawalDays: 7, description: "Most commonly used NSAID in horses for musculoskeletal pain." },
  { name: "SMZs", genericName: "Sulfamethoxazole/Trimethoprim", category: "ANTIBIOTIC", species: ["HORSE"], commonRoute: "Oral", commonDosageRange: "15-30 mg/kg", description: "Broad-spectrum antibiotic, commonly used for respiratory infections." },
  { name: "GastroGard", genericName: "Omeprazole", category: "SUPPLEMENT", species: ["HORSE"], commonRoute: "Oral", commonDosageRange: "4 mg/kg", description: "Proton pump inhibitor for gastric ulcers." },
  { name: "Regumate", genericName: "Altrenogest", category: "HORMONE", species: ["HORSE"], commonRoute: "Oral", commonDosageRange: "0.044 mg/kg", defaultWithdrawalDays: 15, isControlledSubstance: true, description: "Progesterone supplement for cycle management in mares. Handle with extreme care." },
  { name: "Adequan", genericName: "Polysulfated Glycosaminoglycan", category: "SUPPLEMENT", species: ["HORSE"], commonRoute: "IM", commonDosageRange: "500 mg", description: "Joint therapy for degenerative joint disease." },
  { name: "Legend", genericName: "Hyaluronic Acid", category: "SUPPLEMENT", species: ["HORSE"], commonRoute: "IV", commonDosageRange: "40 mg", description: "Joint supplement for synovial fluid support." },
  { name: "Depo-Medrol", genericName: "Methylprednisolone Acetate", category: "STEROID", species: ["HORSE"], commonRoute: "Intra-articular", commonDosageRange: "40-120 mg", defaultWithdrawalDays: 30, description: "Corticosteroid injection for joint inflammation." },
  { name: "Excede", genericName: "Ceftiofur Crystalline Free Acid", category: "ANTIBIOTIC", species: ["HORSE"], commonRoute: "IM", commonDosageRange: "6.6 mg/kg", defaultWithdrawalDays: 14, description: "Long-acting antibiotic for respiratory disease." },
  { name: "Dormosedan", genericName: "Detomidine", category: "SEDATIVE", species: ["HORSE"], commonRoute: "IV/IM/Sublingual", commonDosageRange: "0.02-0.04 mg/kg", defaultWithdrawalDays: 3, isControlledSubstance: true, description: "Alpha-2 agonist sedative for standing procedures." },
  { name: "Acepromazine", genericName: "Acepromazine Maleate", category: "SEDATIVE", species: ["HORSE"], commonRoute: "IV/IM", commonDosageRange: "0.02-0.05 mg/kg", defaultWithdrawalDays: 5, description: "Tranquilizer for mild sedation. Do NOT use in stallions." },

  // Dogs
  { name: "Rimadyl", genericName: "Carprofen", category: "NSAID", species: ["DOG"], commonRoute: "Oral", commonDosageRange: "2-4 mg/kg", description: "NSAID for pain and inflammation, commonly post-surgical." },
  { name: "Cephalexin", genericName: "Cephalexin", category: "ANTIBIOTIC", species: ["DOG"], commonRoute: "Oral", commonDosageRange: "22-30 mg/kg", description: "First-generation cephalosporin for skin and urinary infections." },
  { name: "Metronidazole", genericName: "Metronidazole", category: "ANTIBIOTIC", species: ["DOG"], commonRoute: "Oral", commonDosageRange: "10-15 mg/kg", description: "Antibiotic/antiprotozoal for GI infections and giardia." },
  { name: "Apoquel", genericName: "Oclacitinib", category: "OTHER", species: ["DOG"], commonRoute: "Oral", commonDosageRange: "0.4-0.6 mg/kg", description: "JAK inhibitor for allergic/atopic dermatitis." },
  { name: "Simparica", genericName: "Sarolaner", category: "ANTIPARASITIC", species: ["DOG"], commonRoute: "Oral", commonDosageRange: "2-4 mg/kg monthly", description: "Monthly flea and tick prevention." },
  { name: "Heartgard", genericName: "Ivermectin", category: "ANTIPARASITIC", species: ["DOG"], commonRoute: "Oral", commonDosageRange: "6 mcg/kg monthly", description: "Monthly heartworm prevention." },
  { name: "Prednisone", genericName: "Prednisone", category: "STEROID", species: ["DOG"], commonRoute: "Oral", commonDosageRange: "0.5-2 mg/kg", description: "Corticosteroid for inflammation, allergies, and immune-mediated conditions." },
  { name: "Trazodone", genericName: "Trazodone", category: "SEDATIVE", species: ["DOG"], commonRoute: "Oral", commonDosageRange: "2-5 mg/kg", description: "Anxiolytic/sedative for situational anxiety, pre-vet visits." },

  // Cats
  { name: "Clavamox", genericName: "Amoxicillin-Clavulanate", category: "ANTIBIOTIC", species: ["CAT"], commonRoute: "Oral", commonDosageRange: "12.5-25 mg/kg", description: "Broad-spectrum antibiotic for skin, urinary, and respiratory infections." },
  { name: "Prednisolone", genericName: "Prednisolone", category: "STEROID", species: ["CAT"], commonRoute: "Oral", commonDosageRange: "0.5-2 mg/kg", description: "Corticosteroid (cats metabolize prednisolone better than prednisone)." },
  { name: "Buprenorphine", genericName: "Buprenorphine", category: "SEDATIVE", species: ["CAT"], commonRoute: "Buccal/IM", commonDosageRange: "0.01-0.03 mg/kg", isControlledSubstance: true, description: "Opioid analgesic for moderate pain management." },
  { name: "Revolution", genericName: "Selamectin", category: "ANTIPARASITIC", species: ["CAT"], commonRoute: "Topical", commonDosageRange: "6 mg/kg monthly", description: "Monthly parasite prevention (fleas, ear mites, heartworm)." },
  { name: "Cerenia", genericName: "Maropitant Citrate", category: "OTHER", species: ["CAT"], commonRoute: "Oral/Injectable", commonDosageRange: "1-2 mg/kg", description: "Anti-emetic for nausea and vomiting." },

  // Goats & Sheep
  { name: "Ivermectin", genericName: "Ivermectin", category: "ANTIPARASITIC", species: ["GOAT", "SHEEP"], commonRoute: "Oral/Injectable", commonDosageRange: "0.2-0.4 mg/kg", description: "Broad-spectrum antiparasitic. Goats often need higher doses than label." },
  { name: "Penicillin G", genericName: "Penicillin G Procaine", category: "ANTIBIOTIC", species: ["GOAT", "SHEEP"], commonRoute: "IM/SQ", commonDosageRange: "22,000 IU/kg", description: "First-line antibiotic for many bacterial infections." },
  { name: "SafeGuard", genericName: "Fenbendazole", category: "ANTIPARASITIC", species: ["GOAT", "SHEEP"], commonRoute: "Oral", commonDosageRange: "5-10 mg/kg", description: "Benzimidazole dewormer, effective against GI nematodes." },
  { name: "Banamine (Ruminant)", genericName: "Flunixin Meglumine", category: "NSAID", species: ["GOAT", "SHEEP"], commonRoute: "IV", commonDosageRange: "1.1-2.2 mg/kg", description: "NSAID for pain and inflammation in ruminants." },
  { name: "Thiamine", genericName: "Vitamin B1", category: "SUPPLEMENT", species: ["GOAT", "SHEEP"], commonRoute: "IM/IV", commonDosageRange: "10-20 mg/kg", description: "Critical for polioencephalomalacia (goat polio) treatment." },

  // Rabbits
  { name: "Meloxicam", genericName: "Meloxicam", category: "NSAID", species: ["RABBIT"], commonRoute: "Oral", commonDosageRange: "0.3-0.6 mg/kg", description: "NSAID for pain management, commonly used post-surgery." },
  { name: "Panacur", genericName: "Fenbendazole", category: "ANTIPARASITIC", species: ["RABBIT"], commonRoute: "Oral", commonDosageRange: "20 mg/kg for 28 days", description: "Antiparasitic, particularly for E. cuniculi treatment." },
  { name: "Revolution (Rabbit)", genericName: "Selamectin", category: "ANTIPARASITIC", species: ["RABBIT"], commonRoute: "Topical", commonDosageRange: "6-18 mg/kg monthly", description: "Parasite prevention for fur mites, ear mites." },
  { name: "Baytril", genericName: "Enrofloxacin", category: "ANTIBIOTIC", species: ["RABBIT"], commonRoute: "Oral/Injectable", commonDosageRange: "5-10 mg/kg", description: "Fluoroquinolone antibiotic for respiratory and urinary infections." },
];

function getTemplatesForSpecies(species: string): MedicationTemplate[] {
  const upper = species.toUpperCase();
  return MEDICATION_TEMPLATES.filter(t => t.species.includes(upper));
}

// ────────────────────────────────────────────────────────────────────────────
// Withdrawal + NextDueDate Recalculation
// ────────────────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculate next due date based on frequency and last dose time.
 * Returns null for ONCE/AS_NEEDED frequencies.
 */
function calculateNextDueDate(frequency: string, lastDoseDate: Date): Date | null {
  switch (frequency) {
    case "DAILY": return addDays(lastDoseDate, 1);
    case "BID": { // every 12 hours
      const next = new Date(lastDoseDate);
      next.setHours(next.getHours() + 12);
      return next;
    }
    case "TID": { // every 8 hours
      const next = new Date(lastDoseDate);
      next.setHours(next.getHours() + 8);
      return next;
    }
    case "QID": { // every 6 hours
      const next = new Date(lastDoseDate);
      next.setHours(next.getHours() + 6);
      return next;
    }
    case "EVERY_OTHER_DAY": return addDays(lastDoseDate, 2);
    case "WEEKLY": return addDays(lastDoseDate, 7);
    case "ONCE":
    case "AS_NEEDED":
    default:
      return null;
  }
}

/**
 * After a dose is created/deleted, recalculate:
 * - completedDoses count
 * - withdrawalExpiryDate (last dose + withdrawalPeriodDays)
 * - nextDueDate (based on frequency)
 * - status (auto-complete if totalDoses reached)
 */
async function recalculateCourse(courseId: number): Promise<void> {
  // Get course + all doses
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT c."id", c."withdrawalPeriodDays", c."frequency", c."totalDoses", c."startDate", c."status"
     FROM "public"."MedicationCourse" c WHERE c."id" = $1`,
    courseId,
  );
  const course = rows[0];
  if (!course) return;

  // Count doses and find the latest
  const doseStats = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*)::int AS "count", MAX("administeredAt") AS "lastDoseAt"
     FROM "public"."MedicationDose" WHERE "courseId" = $1`,
    courseId,
  );
  const { count: completedDoses, lastDoseAt } = doseStats[0] ?? { count: 0, lastDoseAt: null };

  // Recalculate withdrawal
  let withdrawalExpiryDate: Date | null = null;
  if (course.withdrawalPeriodDays) {
    const baseDate = lastDoseAt ? new Date(lastDoseAt) : new Date(course.startDate);
    withdrawalExpiryDate = addDays(baseDate, course.withdrawalPeriodDays);
  }

  // Recalculate next due
  let nextDueDate: Date | null = null;
  if (lastDoseAt && course.frequency) {
    nextDueDate = calculateNextDueDate(course.frequency, new Date(lastDoseAt));
  }

  // Auto-complete if all doses administered
  let newStatus = course.status;
  if (course.totalDoses && completedDoses >= course.totalDoses && course.status === "ACTIVE") {
    newStatus = "COMPLETED";
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "public"."MedicationCourse"
     SET "completedDoses" = $1,
         "withdrawalExpiryDate" = $2,
         "nextDueDate" = $3,
         "status" = $4,
         "updatedAt" = NOW()
     WHERE "id" = $5`,
    completedDoses,
    withdrawalExpiryDate,
    nextDueDate,
    newStatus,
    courseId,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────

const animalMedicationsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  // ══════════════════════════════════════════════════════════════════════════
  // TEMPLATES (static data)
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/medications/templates?species=HORSE
  app.get("/medications/templates", async (req, reply) => {
    const query = req.query as { species?: string };
    const species = (query.species || "DOG").toUpperCase();
    const templates = getTemplatesForSpecies(species);
    return reply.send({ templates });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // COURSES
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/animals/:animalId/medications
  // List medication courses + optional doses + summary
  app.get("/animals/:animalId/medications", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const query = req.query as { include?: string };
    const includeDoses = query.include?.includes("doses");

    // Fetch courses (soft-delete filtered)
    const courses = await prisma.$queryRawUnsafe<any[]>(
      `SELECT c.*,
              d."id" as "documentIdRef",
              d."title" as "documentTitle",
              d."originalFileName" as "documentFileName"
       FROM "public"."MedicationCourse" c
       LEFT JOIN "public"."Document" d ON d."id" = c."documentId"
       WHERE c."tenantId" = $1 AND c."animalId" = $2 AND c."deletedAt" IS NULL
       ORDER BY
         CASE c."status"
           WHEN 'ACTIVE' THEN 0
           WHEN 'SCHEDULED' THEN 1
           WHEN 'COMPLETED' THEN 2
           WHEN 'DISCONTINUED' THEN 3
         END,
         c."startDate" DESC`,
      tenantId,
      animalId,
    );

    // Optionally include doses per course
    let dosesMap: Map<number, any[]> = new Map();
    if (includeDoses && courses.length > 0) {
      const courseIds = courses.map((c: any) => c.id);
      const allDoses = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "public"."MedicationDose"
         WHERE "courseId" = ANY($1::int[])
         ORDER BY "administeredAt" DESC`,
        courseIds,
      );
      for (const dose of allDoses) {
        const arr = dosesMap.get(dose.courseId) ?? [];
        arr.push(dose);
        dosesMap.set(dose.courseId, arr);
      }
    }

    const now = new Date();
    const enriched = courses.map((c: any) => {
      const isOverdue = c.nextDueDate && new Date(c.nextDueDate) < now && c.status === "ACTIVE";
      const withdrawalActive = c.withdrawalExpiryDate && new Date(c.withdrawalExpiryDate) > now;
      const withdrawalDaysRemaining = c.withdrawalExpiryDate
        ? Math.ceil((new Date(c.withdrawalExpiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        id: c.id,
        animalId: c.animalId,
        medicationName: c.medicationName,
        category: c.category,
        isControlledSubstance: c.isControlledSubstance,
        dosageAmount: c.dosageAmount ? Number(c.dosageAmount) : null,
        dosageUnit: c.dosageUnit,
        administrationRoute: c.administrationRoute,
        frequency: c.frequency,
        startDate: c.startDate,
        endDate: c.endDate,
        nextDueDate: c.nextDueDate,
        totalDoses: c.totalDoses,
        completedDoses: c.completedDoses,
        prescribingVet: c.prescribingVet,
        clinic: c.clinic,
        rxNumber: c.rxNumber,
        lotBatchNumber: c.lotBatchNumber,
        refillsTotal: c.refillsTotal,
        refillsRemaining: c.refillsRemaining,
        withdrawalPeriodDays: c.withdrawalPeriodDays,
        withdrawalExpiryDate: c.withdrawalExpiryDate,
        costPerDose: c.costPerDose ? Number(c.costPerDose) : null,
        status: c.status as MedicationStatus,
        discontinuedReason: c.discontinuedReason,
        notes: c.notes,
        documentId: c.documentId,
        document: c.documentId ? { id: c.documentId, title: c.documentTitle, originalFileName: c.documentFileName } : null,
        isOverdue: !!isOverdue,
        withdrawalActive: !!withdrawalActive,
        withdrawalDaysRemaining,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        ...(includeDoses ? { doses: dosesMap.get(c.id) ?? [] } : {}),
      };
    });

    // Summary
    const active = enriched.filter(c => c.status === "ACTIVE").length;
    const scheduled = enriched.filter(c => c.status === "SCHEDULED").length;
    const withdrawalActiveCount = enriched.filter(c => c.withdrawalActive).length;
    const overdueCount = enriched.filter(c => c.isOverdue).length;
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const completedLast30Days = courses.filter((c: any) =>
      c.status === "COMPLETED" && c.updatedAt && new Date(c.updatedAt) >= thirtyDaysAgo
    ).length;
    const controlledSubstanceCount = enriched.filter(c => c.isControlledSubstance && c.status === "ACTIVE").length;

    const summary = {
      active,
      scheduled,
      withdrawalActive: withdrawalActiveCount,
      overdueCount,
      completedLast30Days,
      controlledSubstanceCount,
    };

    return reply.send({ courses: enriched, summary });
  });

  // GET /api/v1/animals/:animalId/medications/summary
  // Alert counts only — lightweight for badge propagation
  app.get("/animals/:animalId/medications/summary", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const now = new Date();
    const stats = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         COUNT(*) FILTER (WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL)::int AS "active",
         COUNT(*) FILTER (WHERE "withdrawalExpiryDate" > NOW() AND "deletedAt" IS NULL)::int AS "withdrawalActive",
         COUNT(*) FILTER (WHERE "status" = 'ACTIVE' AND "nextDueDate" < NOW() AND "deletedAt" IS NULL)::int AS "overdueCount"
       FROM "public"."MedicationCourse"
       WHERE "tenantId" = $1 AND "animalId" = $2`,
      tenantId,
      animalId,
    );

    const s = stats[0] ?? { active: 0, withdrawalActive: 0, overdueCount: 0 };
    return reply.send({
      activeCount: s.active,
      withdrawalActiveCount: s.withdrawalActive,
      overdueCount: s.overdueCount,
      hasIssues: s.overdueCount > 0 || s.withdrawalActive > 0,
    });
  });

  // POST /api/v1/animals/:animalId/medications
  // Create a medication course
  app.post("/animals/:animalId/medications", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const body = req.body as {
      medicationName: string;
      category?: MedicationCategory;
      isControlledSubstance?: boolean;
      dosageAmount?: number;
      dosageUnit?: string;
      administrationRoute?: string;
      frequency?: MedicationFrequency;
      startDate: string;
      endDate?: string;
      totalDoses?: number;
      prescribingVet?: string;
      clinic?: string;
      rxNumber?: string;
      lotBatchNumber?: string;
      refillsTotal?: number;
      refillsRemaining?: number;
      withdrawalPeriodDays?: number;
      costPerDose?: number;
      status?: MedicationStatus;
      notes?: string;
    };

    if (!body.medicationName?.trim()) {
      return reply.code(400).send({ error: "medicationName_required" });
    }
    if (!body.startDate) {
      return reply.code(400).send({ error: "startDate_required" });
    }

    const startDate = parseDateIso(body.startDate);
    if (!startDate) return reply.code(400).send({ error: "startDate_invalid" });

    const endDate = body.endDate ? parseDateIso(body.endDate) : null;

    // Calculate initial withdrawal expiry based on start date
    let withdrawalExpiryDate: Date | null = null;
    if (body.withdrawalPeriodDays) {
      withdrawalExpiryDate = addDays(startDate, body.withdrawalPeriodDays);
    }

    const result = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "public"."MedicationCourse" (
         "tenantId", "animalId", "medicationName", "category", "isControlledSubstance",
         "dosageAmount", "dosageUnit", "administrationRoute", "frequency",
         "startDate", "endDate", "totalDoses",
         "prescribingVet", "clinic", "rxNumber", "lotBatchNumber",
         "refillsTotal", "refillsRemaining", "withdrawalPeriodDays", "withdrawalExpiryDate",
         "costPerDose", "status", "notes", "updatedAt"
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10, $11, $12,
         $13, $14, $15, $16,
         $17, $18, $19, $20,
         $21, $22, $23, NOW()
       ) RETURNING *`,
      tenantId, animalId, body.medicationName.trim(), body.category ?? "OTHER", body.isControlledSubstance ?? false,
      body.dosageAmount ?? null, body.dosageUnit ?? null, body.administrationRoute ?? null, body.frequency ?? "ONCE",
      startDate, endDate, body.totalDoses ?? null,
      body.prescribingVet ?? null, body.clinic ?? null, body.rxNumber ?? null, body.lotBatchNumber ?? null,
      body.refillsTotal ?? null, body.refillsRemaining ?? null, body.withdrawalPeriodDays ?? null, withdrawalExpiryDate,
      body.costPerDose ?? null, body.status ?? "ACTIVE", body.notes ?? null,
    );

    return reply.code(201).send(result[0]);
  });

  // PATCH /api/v1/animals/:animalId/medications/:courseId
  // Update a medication course
  app.patch("/animals/:animalId/medications/:courseId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const params = req.params as { animalId: string; courseId: string };
    const animalId = parseIntStrict(params.animalId);
    const courseId = parseIntStrict(params.courseId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });
    if (!courseId) return reply.code(400).send({ error: "course_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    // Verify course belongs to this animal + tenant
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id" FROM "public"."MedicationCourse"
       WHERE "id" = $1 AND "animalId" = $2 AND "tenantId" = $3 AND "deletedAt" IS NULL`,
      courseId, animalId, tenantId,
    );
    if (!existing.length) return reply.code(404).send({ error: "course_not_found" });

    const body = req.body as Record<string, any>;

    // Build dynamic SET clause
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    const allowedFields: Record<string, string> = {
      medicationName: "medicationName",
      category: "category",
      isControlledSubstance: "isControlledSubstance",
      dosageAmount: "dosageAmount",
      dosageUnit: "dosageUnit",
      administrationRoute: "administrationRoute",
      frequency: "frequency",
      startDate: "startDate",
      endDate: "endDate",
      totalDoses: "totalDoses",
      prescribingVet: "prescribingVet",
      clinic: "clinic",
      rxNumber: "rxNumber",
      lotBatchNumber: "lotBatchNumber",
      refillsTotal: "refillsTotal",
      refillsRemaining: "refillsRemaining",
      withdrawalPeriodDays: "withdrawalPeriodDays",
      costPerDose: "costPerDose",
      notes: "notes",
    };

    for (const [key, col] of Object.entries(allowedFields)) {
      if (body[key] !== undefined) {
        sets.push(`"${col}" = $${idx}`);
        vals.push(body[key]);
        idx++;
      }
    }

    if (sets.length === 0) return reply.code(400).send({ error: "no_fields_to_update" });

    sets.push(`"updatedAt" = NOW()`);
    vals.push(courseId);

    const result = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE "public"."MedicationCourse" SET ${sets.join(", ")} WHERE "id" = $${idx} RETURNING *`,
      ...vals,
    );

    // If withdrawal period changed, recalculate
    if (body.withdrawalPeriodDays !== undefined) {
      await recalculateCourse(courseId);
    }

    return reply.send(result[0]);
  });

  // DELETE /api/v1/animals/:animalId/medications/:courseId
  // Soft-delete a medication course
  app.delete("/animals/:animalId/medications/:courseId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const params = req.params as { animalId: string; courseId: string };
    const animalId = parseIntStrict(params.animalId);
    const courseId = parseIntStrict(params.courseId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });
    if (!courseId) return reply.code(400).send({ error: "course_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id" FROM "public"."MedicationCourse"
       WHERE "id" = $1 AND "animalId" = $2 AND "tenantId" = $3 AND "deletedAt" IS NULL`,
      courseId, animalId, tenantId,
    );
    if (!existing.length) return reply.code(404).send({ error: "course_not_found" });

    await prisma.$executeRawUnsafe(
      `UPDATE "public"."MedicationCourse" SET "deletedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`,
      courseId,
    );

    return reply.code(204).send();
  });

  // PATCH /api/v1/animals/:animalId/medications/:courseId/status
  // Complete or discontinue a course (with reason)
  app.patch("/animals/:animalId/medications/:courseId/status", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const params = req.params as { animalId: string; courseId: string };
    const animalId = parseIntStrict(params.animalId);
    const courseId = parseIntStrict(params.courseId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });
    if (!courseId) return reply.code(400).send({ error: "course_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const body = req.body as { status: MedicationStatus; discontinuedReason?: string };
    if (!body.status || !["COMPLETED", "DISCONTINUED", "ACTIVE", "SCHEDULED"].includes(body.status)) {
      return reply.code(400).send({ error: "status_invalid" });
    }

    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id" FROM "public"."MedicationCourse"
       WHERE "id" = $1 AND "animalId" = $2 AND "tenantId" = $3 AND "deletedAt" IS NULL`,
      courseId, animalId, tenantId,
    );
    if (!existing.length) return reply.code(404).send({ error: "course_not_found" });

    const result = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE "public"."MedicationCourse"
       SET "status" = $1, "discontinuedReason" = $2, "updatedAt" = NOW()
       WHERE "id" = $3 RETURNING *`,
      body.status,
      body.status === "DISCONTINUED" ? (body.discontinuedReason ?? null) : null,
      courseId,
    );

    return reply.send(result[0]);
  });

  // POST /api/v1/animals/:animalId/medications/:courseId/document
  // Link a document (prescription PDF) to a course
  app.post("/animals/:animalId/medications/:courseId/document", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const params = req.params as { animalId: string; courseId: string };
    const animalId = parseIntStrict(params.animalId);
    const courseId = parseIntStrict(params.courseId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });
    if (!courseId) return reply.code(400).send({ error: "course_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const body = req.body as { documentId: number };
    if (!body.documentId) return reply.code(400).send({ error: "documentId_required" });

    // Verify document exists and belongs to tenant
    const doc = await prisma.document.findFirst({ where: { id: body.documentId, tenantId } });
    if (!doc) return reply.code(404).send({ error: "document_not_found" });

    const result = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE "public"."MedicationCourse" SET "documentId" = $1, "updatedAt" = NOW() WHERE "id" = $2 RETURNING *`,
      body.documentId, courseId,
    );

    return reply.send(result[0]);
  });

  // DELETE /api/v1/animals/:animalId/medications/:courseId/document
  // Unlink document from a course
  app.delete("/animals/:animalId/medications/:courseId/document", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const params = req.params as { animalId: string; courseId: string };
    const animalId = parseIntStrict(params.animalId);
    const courseId = parseIntStrict(params.courseId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });
    if (!courseId) return reply.code(400).send({ error: "course_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const result = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE "public"."MedicationCourse" SET "documentId" = NULL, "updatedAt" = NOW() WHERE "id" = $1 RETURNING *`,
      courseId,
    );

    return reply.send(result[0]);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DOSES
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/animals/:animalId/medications/:courseId/doses
  // List doses for a course
  app.get("/animals/:animalId/medications/:courseId/doses", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const params = req.params as { animalId: string; courseId: string };
    const animalId = parseIntStrict(params.animalId);
    const courseId = parseIntStrict(params.courseId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });
    if (!courseId) return reply.code(400).send({ error: "course_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const doses = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "public"."MedicationDose"
       WHERE "courseId" = $1 AND "tenantId" = $2
       ORDER BY "administeredAt" DESC`,
      courseId, tenantId,
    );

    return reply.send({ doses });
  });

  // POST /api/v1/animals/:animalId/medications/:courseId/doses
  // Record a dose — recalculates withdrawal + nextDueDate + completedDoses
  app.post("/animals/:animalId/medications/:courseId/doses", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const params = req.params as { animalId: string; courseId: string };
    const animalId = parseIntStrict(params.animalId);
    const courseId = parseIntStrict(params.courseId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });
    if (!courseId) return reply.code(400).send({ error: "course_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    // Verify course exists
    const courseRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id" FROM "public"."MedicationCourse"
       WHERE "id" = $1 AND "animalId" = $2 AND "tenantId" = $3 AND "deletedAt" IS NULL`,
      courseId, animalId, tenantId,
    );
    if (!courseRows.length) return reply.code(404).send({ error: "course_not_found" });

    const body = req.body as {
      administeredAt: string;
      actualDosage?: string;
      givenBy?: string;
      adverseReaction?: string;
      notes?: string;
    };

    if (!body.administeredAt) return reply.code(400).send({ error: "administeredAt_required" });
    const administeredAt = parseDateIso(body.administeredAt);
    if (!administeredAt) return reply.code(400).send({ error: "administeredAt_invalid" });

    // Get next dose number
    const countResult = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS "count" FROM "public"."MedicationDose" WHERE "courseId" = $1`,
      courseId,
    );
    const doseNumber = (countResult[0]?.count ?? 0) + 1;

    const result = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "public"."MedicationDose" (
         "tenantId", "courseId", "animalId", "doseNumber", "administeredAt",
         "actualDosage", "givenBy", "adverseReaction", "notes"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      tenantId, courseId, animalId, doseNumber, administeredAt,
      body.actualDosage ?? null, body.givenBy ?? null, body.adverseReaction ?? null, body.notes ?? null,
    );

    // Recalculate course stats
    await recalculateCourse(courseId);

    return reply.code(201).send(result[0]);
  });

  // PATCH /api/v1/medication-doses/:doseId
  // Edit a dose
  app.patch("/medication-doses/:doseId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const doseId = parseIntStrict((req.params as { doseId: string }).doseId);
    if (!doseId) return reply.code(400).send({ error: "dose_id_invalid" });

    // Verify dose belongs to tenant
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id", "courseId" FROM "public"."MedicationDose" WHERE "id" = $1 AND "tenantId" = $2`,
      doseId, tenantId,
    );
    if (!existing.length) return reply.code(404).send({ error: "dose_not_found" });

    const body = req.body as {
      administeredAt?: string;
      actualDosage?: string | null;
      givenBy?: string | null;
      adverseReaction?: string | null;
      notes?: string | null;
    };

    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (body.administeredAt !== undefined) {
      const d = parseDateIso(body.administeredAt);
      if (!d) return reply.code(400).send({ error: "administeredAt_invalid" });
      sets.push(`"administeredAt" = $${idx}`); vals.push(d); idx++;
    }
    if (body.actualDosage !== undefined) { sets.push(`"actualDosage" = $${idx}`); vals.push(body.actualDosage); idx++; }
    if (body.givenBy !== undefined) { sets.push(`"givenBy" = $${idx}`); vals.push(body.givenBy); idx++; }
    if (body.adverseReaction !== undefined) { sets.push(`"adverseReaction" = $${idx}`); vals.push(body.adverseReaction); idx++; }
    if (body.notes !== undefined) { sets.push(`"notes" = $${idx}`); vals.push(body.notes); idx++; }

    if (sets.length === 0) return reply.code(400).send({ error: "no_fields_to_update" });

    vals.push(doseId);
    const result = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE "public"."MedicationDose" SET ${sets.join(", ")} WHERE "id" = $${idx} RETURNING *`,
      ...vals,
    );

    // Recalculate course if administeredAt changed (affects withdrawal + nextDue)
    if (body.administeredAt !== undefined) {
      await recalculateCourse(existing[0].courseId);
    }

    return reply.send(result[0]);
  });

  // DELETE /api/v1/medication-doses/:doseId
  // Delete a dose — recalculates withdrawal
  app.delete("/medication-doses/:doseId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const doseId = parseIntStrict((req.params as { doseId: string }).doseId);
    if (!doseId) return reply.code(400).send({ error: "dose_id_invalid" });

    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id", "courseId" FROM "public"."MedicationDose" WHERE "id" = $1 AND "tenantId" = $2`,
      doseId, tenantId,
    );
    if (!existing.length) return reply.code(404).send({ error: "dose_not_found" });

    const courseId = existing[0].courseId;

    await prisma.$executeRawUnsafe(
      `DELETE FROM "public"."MedicationDose" WHERE "id" = $1`,
      doseId,
    );

    // Recalculate course stats after dose removal
    await recalculateCourse(courseId);

    return reply.code(204).send();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SMART DOCUMENT PARSING (AI)
  // ══════════════════════════════════════════════════════════════════════════

  // POST /api/v1/animals/:animalId/medications/parse-document
  // Upload a vet document → AI extracts medications + Coggins data
  // Rate limited: 5 parses/hr/user
  app.post("/animals/:animalId/medications/parse-document", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    const animal = await assertAnimalInTenant(animalId, tenantId);

    const userId = Number((req as any).userId) || 0;

    // Rate limit check
    const { checkParseRateLimit, recordParseUsage, parseMedicationDocument } = await import(
      "../services/medication-document-parser.js"
    );

    const rateCheck = checkParseRateLimit(userId, tenantId);
    if (!rateCheck.allowed) {
      return reply.code(429).send({
        error: "rate_limit_exceeded",
        message: `Document parsing is limited to 5 per hour. Try again after ${rateCheck.resetAt.toISOString()}.`,
        remaining: 0,
        resetAt: rateCheck.resetAt.toISOString(),
      });
    }

    const body = req.body as { documentId: number };
    if (!body.documentId) return reply.code(400).send({ error: "documentId_required" });

    // Verify document exists and belongs to tenant
    const doc = await prisma.document.findFirst({
      where: { id: body.documentId, tenantId },
      select: { id: true, storageKey: true, mimeType: true, originalFileName: true },
    });
    if (!doc) return reply.code(404).send({ error: "document_not_found" });
    if (!doc.storageKey) return reply.code(400).send({ error: "document_has_no_file" });

    const contentType = doc.mimeType || "application/pdf";

    try {
      // Record usage BEFORE calling AI (charge even on failure)
      recordParseUsage(userId, tenantId);

      const result = await parseMedicationDocument(doc.storageKey, contentType);

      return reply.send({
        ...result,
        documentId: doc.id,
        originalFileName: doc.originalFileName,
        animalSpecies: animal.species,
        rateLimit: {
          remaining: rateCheck.remaining - 1,
          resetAt: rateCheck.resetAt.toISOString(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Parse failed";
      req.log?.error?.(err, "medication document parse failed");
      return reply.code(500).send({ error: "parse_failed", message });
    }
  });

  // POST /api/v1/animals/:animalId/medications/apply-coggins
  // Auto-populate coggins health traits from parsed Coggins data
  // Uses TraitDefinition keys: horse.infectious.cogginsStatus, horse.infectious.cogginsDate
  // Only applicable for HORSE species
  app.post("/animals/:animalId/medications/apply-coggins", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    const animal = await assertAnimalInTenant(animalId, tenantId);

    if (animal.species?.toUpperCase() !== "HORSE") {
      return reply.code(400).send({ error: "coggins_horse_only", message: "Coggins tests are only applicable to horses." });
    }

    const body = req.body as {
      testDate: string;
      result: "Negative" | "Positive";
      labName?: string;
      accessionNumber?: string;
      veterinarian?: string;
      documentId?: number;
    };

    if (!body.testDate || !body.result) {
      return reply.code(400).send({ error: "coggins_data_required" });
    }
    if (!["Negative", "Positive"].includes(body.result)) {
      return reply.code(400).send({ error: "coggins_result_invalid" });
    }

    // Look up TraitDefinition IDs for coggins traits
    const statusDef = await prisma.traitDefinition.findFirst({
      where: { key: "horse.infectious.cogginsStatus", species: "HORSE" },
      select: { id: true },
    });
    const dateDef = await prisma.traitDefinition.findFirst({
      where: { key: "horse.infectious.cogginsDate", species: "HORSE" },
      select: { id: true },
    });

    if (!statusDef || !dateDef) {
      return reply.code(500).send({ error: "coggins_trait_definitions_missing" });
    }

    const updatedTraits: string[] = [];

    // Read previous values for response
    const prevStatus = await prisma.animalTraitValue.findUnique({
      where: { tenantId_animalId_traitDefinitionId: { tenantId, animalId, traitDefinitionId: statusDef.id } },
      select: { id: true, valueText: true },
    });
    const prevDate = await prisma.animalTraitValue.findUnique({
      where: { tenantId_animalId_traitDefinitionId: { tenantId, animalId, traitDefinitionId: dateDef.id } },
      select: { id: true, valueDate: true },
    });

    // Upsert coggins status
    const statusVal = await prisma.animalTraitValue.upsert({
      where: { tenantId_animalId_traitDefinitionId: { tenantId, animalId, traitDefinitionId: statusDef.id } },
      update: {
        valueText: body.result,
        status: body.result === "Negative" ? "PASS" : "FAIL",
        source: "LAB",
        performedAt: new Date(body.testDate),
        verified: true,
        verifiedAt: new Date(),
      },
      create: {
        tenantId,
        animalId,
        traitDefinitionId: statusDef.id,
        valueText: body.result,
        status: body.result === "Negative" ? "PASS" : "FAIL",
        source: "LAB",
        performedAt: new Date(body.testDate),
        verified: true,
        verifiedAt: new Date(),
      },
    });
    updatedTraits.push("cogginsStatus");

    // Upsert coggins date
    const dateVal = await prisma.animalTraitValue.upsert({
      where: { tenantId_animalId_traitDefinitionId: { tenantId, animalId, traitDefinitionId: dateDef.id } },
      update: {
        valueDate: new Date(body.testDate),
        status: "PROVIDED",
        source: "LAB",
      },
      create: {
        tenantId,
        animalId,
        traitDefinitionId: dateDef.id,
        valueDate: new Date(body.testDate),
        status: "PROVIDED",
        source: "LAB",
      },
    });
    updatedTraits.push("cogginsDate");

    // Link document to coggins trait values if documentId provided
    if (body.documentId) {
      for (const traitValue of [statusVal, dateVal]) {
        const existingLink = await prisma.animalTraitValueDocument.findFirst({
          where: { tenantId, animalTraitValueId: traitValue.id, documentId: body.documentId },
        });
        if (!existingLink) {
          await prisma.animalTraitValueDocument.create({
            data: {
              tenantId,
              animalId,
              animalTraitValueId: traitValue.id,
              documentId: body.documentId,
            },
          });
        }
      }
    }

    return reply.send({
      success: true,
      updatedTraits,
      previousStatus: prevStatus?.valueText ?? null,
      previousDate: prevDate?.valueDate?.toISOString().split("T")[0] ?? null,
      newStatus: body.result,
      newDate: body.testDate,
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BATCH
  // ══════════════════════════════════════════════════════════════════════════

  // POST /api/v1/medications/batch
  // Create same course for multiple animals (e.g., deworming the whole barn)
  app.post("/medications/batch", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
      animalIds: number[];
      medication: {
        medicationName: string;
        category?: MedicationCategory;
        isControlledSubstance?: boolean;
        dosageAmount?: number;
        dosageUnit?: string;
        administrationRoute?: string;
        frequency?: MedicationFrequency;
        startDate: string;
        endDate?: string;
        totalDoses?: number;
        prescribingVet?: string;
        clinic?: string;
        rxNumber?: string;
        lotBatchNumber?: string;
        withdrawalPeriodDays?: number;
        costPerDose?: number;
        notes?: string;
      };
    };

    if (!body.animalIds?.length) return reply.code(400).send({ error: "animalIds_required" });
    if (!body.medication?.medicationName?.trim()) return reply.code(400).send({ error: "medicationName_required" });
    if (!body.medication?.startDate) return reply.code(400).send({ error: "startDate_required" });
    if (body.animalIds.length > 100) return reply.code(400).send({ error: "max_100_animals" });

    const startDate = parseDateIso(body.medication.startDate);
    if (!startDate) return reply.code(400).send({ error: "startDate_invalid" });
    const endDate = body.medication.endDate ? parseDateIso(body.medication.endDate) : null;

    // Verify all animals belong to tenant
    const animals = await prisma.animal.findMany({
      where: { id: { in: body.animalIds }, tenantId },
      select: { id: true },
    });
    const validIds = new Set(animals.map(a => a.id));
    const invalidIds = body.animalIds.filter(id => !validIds.has(id));
    if (invalidIds.length) {
      return reply.code(400).send({ error: "invalid_animal_ids", invalidIds });
    }

    let withdrawalExpiryDate: Date | null = null;
    if (body.medication.withdrawalPeriodDays) {
      withdrawalExpiryDate = addDays(startDate, body.medication.withdrawalPeriodDays);
    }

    const med = body.medication;
    const created: any[] = [];

    for (const animalId of body.animalIds) {
      const result = await prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO "public"."MedicationCourse" (
           "tenantId", "animalId", "medicationName", "category", "isControlledSubstance",
           "dosageAmount", "dosageUnit", "administrationRoute", "frequency",
           "startDate", "endDate", "totalDoses",
           "prescribingVet", "clinic", "rxNumber", "lotBatchNumber",
           "withdrawalPeriodDays", "withdrawalExpiryDate",
           "costPerDose", "status", "notes", "updatedAt"
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12,
           $13, $14, $15, $16,
           $17, $18,
           $19, 'ACTIVE', $20, NOW()
         ) RETURNING *`,
        tenantId, animalId, med.medicationName.trim(), med.category ?? "OTHER", med.isControlledSubstance ?? false,
        med.dosageAmount ?? null, med.dosageUnit ?? null, med.administrationRoute ?? null, med.frequency ?? "ONCE",
        startDate, endDate, med.totalDoses ?? null,
        med.prescribingVet ?? null, med.clinic ?? null, med.rxNumber ?? null, med.lotBatchNumber ?? null,
        med.withdrawalPeriodDays ?? null, withdrawalExpiryDate,
        med.costPerDose ?? null, med.notes ?? null,
      );
      created.push(result[0]);
    }

    return reply.code(201).send({ courses: created, count: created.length });
  });
};

export default animalMedicationsRoutes;
