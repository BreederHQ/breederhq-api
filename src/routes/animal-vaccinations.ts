// src/routes/animal-vaccinations.ts
// Vaccination records API endpoints for animals
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
// Vaccination Protocol Definitions (static data)
// ────────────────────────────────────────────────────────────────────────────

type VaccinationProtocol = {
  key: string;
  name: string;
  species: string[];
  intervalMonths: number;
  isCore: boolean;
  description?: string;
};

const VACCINATION_PROTOCOLS: VaccinationProtocol[] = [
  // Dogs - Core
  { key: "dog.rabies", name: "Rabies", species: ["DOG"], intervalMonths: 36, isCore: true, description: "Required by law in most areas. 1-year or 3-year depending on vaccine type." },
  { key: "dog.dhpp", name: "DHPP (Distemper, Hepatitis, Parvo, Parainfluenza)", species: ["DOG"], intervalMonths: 12, isCore: true, description: "Core combination vaccine protecting against multiple diseases." },
  { key: "dog.bordetella", name: "Bordetella (Kennel Cough)", species: ["DOG"], intervalMonths: 12, isCore: true, description: "Often required for boarding, grooming, and dog parks." },

  // Dogs - Non-Core
  { key: "dog.leptospirosis", name: "Leptospirosis", species: ["DOG"], intervalMonths: 12, isCore: false, description: "Recommended in areas with wildlife exposure or standing water." },
  { key: "dog.lyme", name: "Lyme Disease", species: ["DOG"], intervalMonths: 12, isCore: false, description: "Recommended in tick-endemic areas." },
  { key: "dog.canine_influenza", name: "Canine Influenza (H3N2/H3N8)", species: ["DOG"], intervalMonths: 12, isCore: false, description: "Recommended for dogs in social environments." },

  // Cats - Core
  { key: "cat.rabies", name: "Rabies", species: ["CAT"], intervalMonths: 36, isCore: true, description: "Required by law in most areas." },
  { key: "cat.fvrcp", name: "FVRCP (Feline Viral Rhinotracheitis, Calicivirus, Panleukopenia)", species: ["CAT"], intervalMonths: 36, isCore: true, description: "Core combination vaccine for cats." },

  // Cats - Non-Core
  { key: "cat.felv", name: "FeLV (Feline Leukemia Virus)", species: ["CAT"], intervalMonths: 12, isCore: false, description: "Recommended for outdoor cats or multi-cat households." },

  // Horses - Core
  { key: "horse.rabies", name: "Rabies", species: ["HORSE"], intervalMonths: 12, isCore: true, description: "Annual vaccination required." },
  { key: "horse.tetanus", name: "Tetanus", species: ["HORSE"], intervalMonths: 12, isCore: true, description: "Essential for all horses." },
  { key: "horse.ewt", name: "Eastern/Western Encephalomyelitis + Tetanus", species: ["HORSE"], intervalMonths: 12, isCore: true, description: "Core vaccine protecting against mosquito-borne diseases." },
  { key: "horse.west_nile", name: "West Nile Virus", species: ["HORSE"], intervalMonths: 12, isCore: true, description: "Mosquito-borne disease prevention." },

  // Horses - Non-Core
  { key: "horse.influenza", name: "Equine Influenza", species: ["HORSE"], intervalMonths: 6, isCore: false, description: "Recommended for horses that travel or compete." },
  { key: "horse.rhinopneumonitis", name: "Rhinopneumonitis (EHV-1/EHV-4)", species: ["HORSE"], intervalMonths: 6, isCore: false, description: "Important for breeding horses and those in contact with pregnant mares." },
  { key: "horse.strangles", name: "Strangles", species: ["HORSE"], intervalMonths: 12, isCore: false, description: "Bacterial infection prevention." },

  // Goats - Core
  { key: "goat.cdt", name: "CDT (Clostridium Perfringens C&D + Tetanus)", species: ["GOAT"], intervalMonths: 12, isCore: true, description: "Essential vaccine for all goats." },
  { key: "goat.rabies", name: "Rabies", species: ["GOAT"], intervalMonths: 12, isCore: false, description: "Recommended in endemic areas." },

  // Sheep - Core
  { key: "sheep.cdt", name: "CDT (Clostridium Perfringens C&D + Tetanus)", species: ["SHEEP"], intervalMonths: 12, isCore: true, description: "Essential vaccine for all sheep." },
];

function getProtocolsForSpecies(species: string): VaccinationProtocol[] {
  const upper = species.toUpperCase();
  return VACCINATION_PROTOCOLS.filter(p => p.species.includes(upper));
}

// ────────────────────────────────────────────────────────────────────────────
// Status Calculation
// ────────────────────────────────────────────────────────────────────────────

type VaccinationStatus = "current" | "due_soon" | "expired" | "not_recorded";

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function differenceInDays(dateA: Date, dateB: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((dateA.getTime() - dateB.getTime()) / msPerDay);
}

function calculateVaccinationStatus(
  administeredAt: Date,
  intervalMonths: number,
  expiresAtOverride?: Date | null
): { status: VaccinationStatus; expiresAt: Date; daysRemaining: number; statusText: string } {
  const expires = expiresAtOverride || addMonths(administeredAt, intervalMonths);
  const now = new Date();
  const daysRemaining = differenceInDays(expires, now);

  if (daysRemaining < 0) {
    return {
      status: "expired",
      expiresAt: expires,
      daysRemaining,
      statusText: `Expired ${Math.abs(daysRemaining)} days ago`,
    };
  }
  if (daysRemaining < 30) {
    return {
      status: "due_soon",
      expiresAt: expires,
      daysRemaining,
      statusText: `Due in ${daysRemaining} days`,
    };
  }
  return {
    status: "current",
    expiresAt: expires,
    daysRemaining,
    statusText: "Current",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────

const animalVaccinationsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/vaccinations/protocols?species=DOG
  // Returns available vaccination protocols for a species
  app.get("/vaccinations/protocols", async (req, reply) => {
    const query = req.query as { species?: string };
    const species = (query.species || "DOG").toUpperCase();
    const protocols = getProtocolsForSpecies(species);
    return reply.send({ protocols });
  });

  // GET /api/v1/animals/:animalId/vaccinations
  // Returns all vaccination records for an animal with status calculations
  app.get("/animals/:animalId/vaccinations", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    const animal = await assertAnimalInTenant(animalId, tenantId);
    const protocols = getProtocolsForSpecies(animal.species);

    // Get existing vaccination records
    const records = await prisma.vaccinationRecord.findMany({
      where: { tenantId, animalId },
      orderBy: { administeredAt: "desc" },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            originalFileName: true,
            mimeType: true,
          },
        },
      },
    });

    // Calculate status for each record
    const recordsWithStatus = records.map(rec => {
      const protocol = protocols.find(p => p.key === rec.protocolKey);
      const intervalMonths = protocol?.intervalMonths || 12;
      const statusInfo = calculateVaccinationStatus(
        rec.administeredAt,
        intervalMonths,
        rec.expiresAt
      );

      return {
        id: rec.id,
        protocolKey: rec.protocolKey,
        administeredAt: rec.administeredAt.toISOString(),
        expiresAt: statusInfo.expiresAt.toISOString(),
        veterinarian: rec.veterinarian,
        clinic: rec.clinic,
        batchLotNumber: rec.batchLotNumber,
        documentId: rec.documentId,
        document: rec.document,
        notes: rec.notes,
        status: statusInfo.status,
        statusText: statusInfo.statusText,
        daysRemaining: statusInfo.daysRemaining,
      };
    });

    // Calculate summary
    const expiredCount = recordsWithStatus.filter(r => r.status === "expired").length;
    const dueSoonCount = recordsWithStatus.filter(r => r.status === "due_soon").length;
    const currentCount = recordsWithStatus.filter(r => r.status === "current").length;
    const notRecordedCount = protocols.length - new Set(records.map(r => r.protocolKey)).size;

    const summary = {
      total: protocols.length,
      current: currentCount,
      dueSoon: dueSoonCount,
      expired: expiredCount,
      notRecorded: notRecordedCount,
      hasIssues: expiredCount > 0 || dueSoonCount > 0,
    };

    return reply.send({ records: recordsWithStatus, summary });
  });

  // POST /api/v1/animals/:animalId/vaccinations
  // Create a new vaccination record
  app.post("/animals/:animalId/vaccinations", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const body = req.body as {
      protocolKey: string;
      administeredAt: string;
      expiresAt?: string;
      veterinarian?: string;
      clinic?: string;
      batchLotNumber?: string;
      notes?: string;
    };

    if (!body.protocolKey) {
      return reply.code(400).send({ error: "protocolKey_required" });
    }
    if (!body.administeredAt) {
      return reply.code(400).send({ error: "administeredAt_required" });
    }

    const administeredAt = parseDateIso(body.administeredAt);
    if (!administeredAt) {
      return reply.code(400).send({ error: "administeredAt_invalid" });
    }

    const expiresAt = body.expiresAt ? parseDateIso(body.expiresAt) : null;

    const record = await prisma.vaccinationRecord.create({
      data: {
        tenantId,
        animalId,
        protocolKey: body.protocolKey,
        administeredAt,
        expiresAt,
        veterinarian: body.veterinarian || null,
        clinic: body.clinic || null,
        batchLotNumber: body.batchLotNumber || null,
        notes: body.notes || null,
      },
    });

    return reply.code(201).send(record);
  });

  // PATCH /api/v1/animals/:animalId/vaccinations/:recordId
  // Update an existing vaccination record
  app.patch("/animals/:animalId/vaccinations/:recordId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const params = req.params as { animalId: string; recordId: string };
    const animalId = parseIntStrict(params.animalId);
    const recordId = parseIntStrict(params.recordId);

    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });
    if (!recordId) return reply.code(400).send({ error: "record_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    // Verify record belongs to this animal and tenant
    const existing = await prisma.vaccinationRecord.findFirst({
      where: { id: recordId, animalId, tenantId },
    });
    if (!existing) {
      return reply.code(404).send({ error: "record_not_found" });
    }

    const body = req.body as {
      administeredAt?: string;
      expiresAt?: string | null;
      veterinarian?: string | null;
      clinic?: string | null;
      batchLotNumber?: string | null;
      notes?: string | null;
    };

    const updates: any = {};

    if (body.administeredAt !== undefined) {
      const administeredAt = parseDateIso(body.administeredAt);
      if (!administeredAt) {
        return reply.code(400).send({ error: "administeredAt_invalid" });
      }
      updates.administeredAt = administeredAt;
    }

    if (body.expiresAt !== undefined) {
      updates.expiresAt = body.expiresAt ? parseDateIso(body.expiresAt) : null;
    }

    if (body.veterinarian !== undefined) updates.veterinarian = body.veterinarian;
    if (body.clinic !== undefined) updates.clinic = body.clinic;
    if (body.batchLotNumber !== undefined) updates.batchLotNumber = body.batchLotNumber;
    if (body.notes !== undefined) updates.notes = body.notes;

    const record = await prisma.vaccinationRecord.update({
      where: { id: recordId },
      data: updates,
    });

    return reply.send(record);
  });

  // DELETE /api/v1/animals/:animalId/vaccinations/:recordId
  // Delete a vaccination record
  app.delete("/animals/:animalId/vaccinations/:recordId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const params = req.params as { animalId: string; recordId: string };
    const animalId = parseIntStrict(params.animalId);
    const recordId = parseIntStrict(params.recordId);

    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });
    if (!recordId) return reply.code(400).send({ error: "record_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    // Verify record belongs to this animal and tenant
    const existing = await prisma.vaccinationRecord.findFirst({
      where: { id: recordId, animalId, tenantId },
    });
    if (!existing) {
      return reply.code(404).send({ error: "record_not_found" });
    }

    await prisma.vaccinationRecord.delete({ where: { id: recordId } });

    return reply.code(204).send();
  });

  // POST /api/v1/animals/:animalId/vaccinations/:recordId/document
  // Link a document to a vaccination record
  app.post("/animals/:animalId/vaccinations/:recordId/document", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const params = req.params as { animalId: string; recordId: string };
    const animalId = parseIntStrict(params.animalId);
    const recordId = parseIntStrict(params.recordId);

    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });
    if (!recordId) return reply.code(400).send({ error: "record_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const body = req.body as { documentId: number };
    if (!body.documentId) {
      return reply.code(400).send({ error: "documentId_required" });
    }

    // Verify document exists and belongs to tenant
    const doc = await prisma.document.findFirst({
      where: { id: body.documentId, tenantId },
    });
    if (!doc) {
      return reply.code(404).send({ error: "document_not_found" });
    }

    const record = await prisma.vaccinationRecord.update({
      where: { id: recordId },
      data: { documentId: body.documentId },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            originalFileName: true,
            mimeType: true,
          },
        },
      },
    });

    return reply.send(record);
  });

  // DELETE /api/v1/animals/:animalId/vaccinations/:recordId/document
  // Unlink a document from a vaccination record
  app.delete("/animals/:animalId/vaccinations/:recordId/document", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const params = req.params as { animalId: string; recordId: string };
    const animalId = parseIntStrict(params.animalId);
    const recordId = parseIntStrict(params.recordId);

    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });
    if (!recordId) return reply.code(400).send({ error: "record_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const record = await prisma.vaccinationRecord.update({
      where: { id: recordId },
      data: { documentId: null },
    });

    return reply.send(record);
  });
};

export default animalVaccinationsRoutes;
