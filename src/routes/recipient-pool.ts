// src/routes/recipient-pool.ts
// Recipient Pool API — tracks recipient mare status for embryo transfer programs.
// Status is derived from the breeding plan phase, not stored separately.

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

// ════════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

type RecipientStatus =
  | "available"
  | "assigned"
  | "synced"
  | "transferred"
  | "confirmed_pregnant"
  | "foaling_soon"
  | "nursing"
  | "resting";

/** Map plan phase → recipient status */
function deriveRecipientStatus(planStatus: string | null, daysUntilDue: number | null): RecipientStatus {
  if (!planStatus) return "available";
  switch (planStatus) {
    case "PLANNING":
      return "assigned";
    case "CYCLE":
    case "COMMITTED":
    case "CYCLE_EXPECTED":
    case "HORMONE_TESTING":
      return "synced";
    case "BRED":
      return "transferred";
    case "PREGNANT":
      if (daysUntilDue != null && daysUntilDue <= 14) return "foaling_soon";
      return "confirmed_pregnant";
    case "BIRTHED":
      return "nursing";
    case "WEANED":
    case "PLACEMENT":
    case "COMPLETE":
      return "resting";
    default:
      return "available";
  }
}

/** Active plan statuses (not cancelled/complete) */
const ACTIVE_STATUSES = [
  "PLANNING", "CYCLE", "COMMITTED", "CYCLE_EXPECTED", "HORMONE_TESTING",
  "BRED", "PREGNANT", "BIRTHED", "WEANED", "PLACEMENT",
];

function parsePaging(query: any) {
  const page = Math.max(1, Number(query?.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(query?.limit ?? 50) || 50));
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

// ════════════════════════════════════════════════════════════════════════════
// ROUTE PLUGIN
// ════════════════════════════════════════════════════════════════════════════

const recipientPoolRoutes: FastifyPluginAsync = async (api: FastifyInstance) => {

  // ────────────── GET /api/v1/recipient-pool ──────────────
  api.get("/api/v1/recipient-pool", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      page?: string;
      limit?: string;
      status?: string; // comma-separated
      species?: string;
      search?: string;
    };

    const { page, limit, skip } = parsePaging(query);

    // Find all animals that have ever been recipientDamId on an ET plan
    // ET plans are identified by having geneticDamId set (no breedingMethod field)
    const recipientAnimalIds = await prisma.breedingPlan.findMany({
      where: {
        tenantId,
        geneticDamId: { not: null },
        recipientDamId: { not: null },
      },
      select: { recipientDamId: true },
      distinct: ["recipientDamId"],
    });

    const uniqueRecipientIds = recipientAnimalIds
      .map((r) => r.recipientDamId)
      .filter((id): id is number => id != null);

    if (uniqueRecipientIds.length === 0) {
      return reply.send({
        data: [],
        total: 0,
        statusCounts: {} as Record<RecipientStatus, number>,
      });
    }

    // Fetch all recipient animals with species/name filter
    const animalWhere: any = {
      id: { in: uniqueRecipientIds },
      tenantId,
    };
    if (query.species) animalWhere.species = query.species;
    if (query.search) {
      animalWhere.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { nickname: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const animals = await prisma.animal.findMany({
      where: animalWhere,
      select: {
        id: true,
        name: true,
        nickname: true,
        species: true,
        breed: true,
        photoUrl: true,
      },
    });

    const animalIds = animals.map((a) => a.id);

    // Fetch all ET plans for these recipients (batch — no N+1)
    const etPlans = await prisma.breedingPlan.findMany({
      where: {
        tenantId,
        geneticDamId: { not: null },
        recipientDamId: { in: animalIds },
      },
      select: {
        id: true,
        name: true,
        status: true,
        recipientDamId: true,
        geneticDamId: true,
        sireId: true,
        expectedBirthDate: true,
        countLive: true,
        birthDateActual: true,
        Animal_BreedingPlan_geneticDamIdToAnimal: { select: { id: true, name: true } },
        sire: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Group plans by recipient
    const plansByRecipient = new Map<number, typeof etPlans>();
    for (const plan of etPlans) {
      if (plan.recipientDamId == null) continue;
      const existing = plansByRecipient.get(plan.recipientDamId) || [];
      existing.push(plan);
      plansByRecipient.set(plan.recipientDamId, existing);
    }

    // Build entries
    const now = new Date();
    const allEntries: any[] = [];

    for (const animal of animals) {
      const plans = plansByRecipient.get(animal.id) || [];
      const activePlan = plans.find((p) => ACTIVE_STATUSES.includes(p.status));

      let daysUntilDue: number | null = null;
      if (activePlan?.expectedBirthDate) {
        daysUntilDue = Math.ceil((new Date(activePlan.expectedBirthDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      const recipientStatus = deriveRecipientStatus(activePlan?.status ?? null, daysUntilDue);

      const totalETCarried = plans.length;
      const totalETOffspring = plans.reduce((sum, p) => sum + (p.countLive ?? 0), 0);

      allEntries.push({
        animalId: animal.id,
        name: animal.name ?? animal.nickname,
        species: animal.species,
        breed: animal.breed,
        photoUrl: animal.photoUrl,
        recipientStatus,
        activePlanId: activePlan?.id,
        activePlanName: activePlan?.name,
        geneticDamName: activePlan?.Animal_BreedingPlan_geneticDamIdToAnimal?.name,
        sireName: activePlan?.sire?.name,
        dueDate: activePlan?.expectedBirthDate?.toISOString()?.split("T")[0] ?? null,
        daysUntilDue,
        totalETCarried,
        totalETOffspring,
      });
    }

    // Filter by status if requested
    let filteredEntries = allEntries;
    if (query.status) {
      const statusFilter = query.status.split(",").map((s) => s.trim());
      filteredEntries = allEntries.filter((e) => statusFilter.includes(e.recipientStatus));
    }

    // Compute status counts from ALL entries (before pagination, after species/search filter)
    const statusCounts: Record<string, number> = {};
    for (const e of allEntries) {
      statusCounts[e.recipientStatus] = (statusCounts[e.recipientStatus] || 0) + 1;
    }

    // Sort: foaling_soon first, then pregnant, then by name
    const statusPriority: Record<string, number> = {
      foaling_soon: 0,
      confirmed_pregnant: 1,
      transferred: 2,
      synced: 3,
      nursing: 4,
      assigned: 5,
      resting: 6,
      available: 7,
    };
    filteredEntries.sort((a, b) => {
      const pa = statusPriority[a.recipientStatus] ?? 99;
      const pb = statusPriority[b.recipientStatus] ?? 99;
      if (pa !== pb) return pa - pb;
      return (a.name || "").localeCompare(b.name || "");
    });

    const total = filteredEntries.length;
    const paginated = filteredEntries.slice(skip, skip + limit);

    return reply.send({ data: paginated, total, page, limit, statusCounts });
  });
};

export default recipientPoolRoutes;
