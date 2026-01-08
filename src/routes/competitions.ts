// src/routes/competitions.ts
// Competition entry CRUD for tracking show/performance records
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { CompetitionType } from "@prisma/client";

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
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
    select: { id: true, tenantId: true, species: true },
  });
  if (!animal) throw Object.assign(new Error("animal_not_found"), { statusCode: 404 });
  if (animal.tenantId !== tenantId) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  return animal;
}

const competitionsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // Competition Entries
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /api/v1/animals/:animalId/competitions
  // Query params: type, year
  app.get("/animals/:animalId/competitions", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const query = req.query as { type?: string; year?: string };

    const where: any = { animalId, tenantId };

    if (query.type && Object.values(CompetitionType).includes(query.type as CompetitionType)) {
      where.competitionType = query.type as CompetitionType;
    }

    if (query.year) {
      const year = parseInt(query.year, 10);
      if (!isNaN(year)) {
        where.eventDate = {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        };
      }
    }

    const entries = await prisma.competitionEntry.findMany({
      where,
      include: {
        documents: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                mimeType: true,
                url: true,
              },
            },
          },
        },
      },
      orderBy: { eventDate: "desc" },
    });

    return entries;
  });

  // GET /api/v1/animals/:animalId/competitions/stats
  // Aggregate stats for an animal's competition history
  app.get("/animals/:animalId/competitions/stats", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const entries = await prisma.competitionEntry.findMany({
      where: { animalId, tenantId },
      select: {
        competitionType: true,
        placement: true,
        pointsEarned: true,
        isMajorWin: true,
        qualifyingScore: true,
        eventDate: true,
      },
    });

    // Calculate stats
    const totalEntries = entries.length;
    const totalPoints = entries.reduce((sum, e) => sum + (e.pointsEarned ?? 0), 0);
    const majorWins = entries.filter((e) => e.isMajorWin).length;
    const qualifyingScores = entries.filter((e) => e.qualifyingScore).length;
    const wins = entries.filter((e) => e.placement === 1).length;
    const placements = entries.filter((e) => e.placement !== null && e.placement <= 4).length;

    // Group by competition type
    const byType: Record<string, { entries: number; points: number; wins: number }> = {};
    for (const e of entries) {
      if (!byType[e.competitionType]) {
        byType[e.competitionType] = { entries: 0, points: 0, wins: 0 };
      }
      byType[e.competitionType].entries++;
      byType[e.competitionType].points += e.pointsEarned ?? 0;
      if (e.placement === 1) byType[e.competitionType].wins++;
    }

    // Years active
    const years = new Set(entries.map((e) => e.eventDate.getFullYear()));

    return {
      totalEntries,
      totalPoints,
      majorWins,
      qualifyingScores,
      wins,
      placements,
      yearsActive: Array.from(years).sort((a, b) => b - a),
      byType,
    };
  });

  // POST /api/v1/animals/:animalId/competitions
  app.post("/animals/:animalId/competitions", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const body = req.body as {
      eventName: string;
      eventDate: string;
      competitionType: CompetitionType;
      location?: string;
      organization?: string;
      className?: string;
      placement?: number;
      placementLabel?: string;
      pointsEarned?: number;
      isMajorWin?: boolean;
      qualifyingScore?: boolean;
      score?: number;
      scoreMax?: number;
      // Racing fields
      prizeMoneyCents?: number;
      trackName?: string;
      trackSurface?: string;
      distanceFurlongs?: number;
      distanceMeters?: number;
      raceGrade?: string;
      finishTime?: string;
      speedFigure?: number;
      // Handler/rider
      handlerName?: string;
      trainerName?: string;
      judgeName?: string;
      notes?: string;
    };

    if (!body.eventName || !body.eventDate || !body.competitionType) {
      return reply.code(400).send({ error: "missing_required_fields" });
    }

    if (!Object.values(CompetitionType).includes(body.competitionType)) {
      return reply.code(400).send({ error: "invalid_competition_type" });
    }

    const created = await prisma.competitionEntry.create({
      data: {
        tenantId,
        animalId,
        eventName: body.eventName,
        eventDate: new Date(body.eventDate),
        competitionType: body.competitionType,
        location: body.location,
        organization: body.organization,
        className: body.className,
        placement: body.placement,
        placementLabel: body.placementLabel,
        pointsEarned: body.pointsEarned,
        isMajorWin: body.isMajorWin ?? false,
        qualifyingScore: body.qualifyingScore ?? false,
        score: body.score,
        scoreMax: body.scoreMax,
        prizeMoneyCents: body.prizeMoneyCents,
        trackName: body.trackName,
        trackSurface: body.trackSurface,
        distanceFurlongs: body.distanceFurlongs,
        distanceMeters: body.distanceMeters,
        raceGrade: body.raceGrade,
        finishTime: body.finishTime,
        speedFigure: body.speedFigure,
        handlerName: body.handlerName,
        trainerName: body.trainerName,
        judgeName: body.judgeName,
        notes: body.notes,
      },
    });

    return reply.code(201).send(created);
  });

  // PUT /api/v1/animals/:animalId/competitions/:entryId
  app.put("/animals/:animalId/competitions/:entryId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    const entryId = parseIntStrict((req.params as { entryId: string }).entryId);
    if (!animalId || !entryId) return reply.code(400).send({ error: "invalid_params" });

    await assertAnimalInTenant(animalId, tenantId);

    const existing = await prisma.competitionEntry.findFirst({
      where: { id: entryId, animalId, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "entry_not_found" });
    }

    const body = req.body as {
      eventName?: string;
      eventDate?: string;
      competitionType?: CompetitionType;
      location?: string | null;
      organization?: string | null;
      className?: string | null;
      placement?: number | null;
      placementLabel?: string | null;
      pointsEarned?: number | null;
      isMajorWin?: boolean;
      qualifyingScore?: boolean;
      score?: number | null;
      scoreMax?: number | null;
      // Racing fields
      prizeMoneyCents?: number | null;
      trackName?: string | null;
      trackSurface?: string | null;
      distanceFurlongs?: number | null;
      distanceMeters?: number | null;
      raceGrade?: string | null;
      finishTime?: string | null;
      speedFigure?: number | null;
      // Handler/rider
      handlerName?: string | null;
      trainerName?: string | null;
      judgeName?: string | null;
      notes?: string | null;
    };

    const updated = await prisma.competitionEntry.update({
      where: { id: entryId },
      data: {
        eventName: body.eventName,
        eventDate: body.eventDate ? new Date(body.eventDate) : undefined,
        competitionType: body.competitionType,
        location: body.location,
        organization: body.organization,
        className: body.className,
        placement: body.placement,
        placementLabel: body.placementLabel,
        pointsEarned: body.pointsEarned,
        isMajorWin: body.isMajorWin,
        qualifyingScore: body.qualifyingScore,
        score: body.score,
        scoreMax: body.scoreMax,
        prizeMoneyCents: body.prizeMoneyCents,
        trackName: body.trackName,
        trackSurface: body.trackSurface,
        distanceFurlongs: body.distanceFurlongs,
        distanceMeters: body.distanceMeters,
        raceGrade: body.raceGrade,
        finishTime: body.finishTime,
        speedFigure: body.speedFigure,
        handlerName: body.handlerName,
        trainerName: body.trainerName,
        judgeName: body.judgeName,
        notes: body.notes,
      },
    });

    return updated;
  });

  // DELETE /api/v1/animals/:animalId/competitions/:entryId
  app.delete("/animals/:animalId/competitions/:entryId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    const entryId = parseIntStrict((req.params as { entryId: string }).entryId);
    if (!animalId || !entryId) return reply.code(400).send({ error: "invalid_params" });

    await assertAnimalInTenant(animalId, tenantId);

    const existing = await prisma.competitionEntry.findFirst({
      where: { id: entryId, animalId, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "entry_not_found" });
    }

    await prisma.competitionEntry.delete({ where: { id: entryId } });

    return reply.code(204).send();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Tenant-wide competition stats
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /api/v1/competitions/recent
  // Get recent competition entries across all tenant animals
  app.get("/competitions/recent", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit ?? "20", 10), 100);

    const entries = await prisma.competitionEntry.findMany({
      where: { tenantId },
      include: {
        animal: {
          select: {
            id: true,
            name: true,
            titlePrefix: true,
            photoUrl: true,
          },
        },
      },
      orderBy: { eventDate: "desc" },
      take: limit,
    });

    return entries;
  });

  // GET /api/v1/competitions/stats
  // Aggregate competition stats for the entire tenant
  app.get("/competitions/stats", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const entries = await prisma.competitionEntry.findMany({
      where: { tenantId },
      select: {
        competitionType: true,
        pointsEarned: true,
        isMajorWin: true,
        qualifyingScore: true,
        placement: true,
        eventDate: true,
        animalId: true,
      },
    });

    const totalEntries = entries.length;
    const totalPoints = entries.reduce((sum, e) => sum + (e.pointsEarned ?? 0), 0);
    const majorWins = entries.filter((e) => e.isMajorWin).length;
    const qualifyingScores = entries.filter((e) => e.qualifyingScore).length;
    const wins = entries.filter((e) => e.placement === 1).length;
    const uniqueAnimals = new Set(entries.map((e) => e.animalId)).size;

    return {
      totalEntries,
      totalPoints,
      majorWins,
      qualifyingScores,
      wins,
      uniqueAnimals,
    };
  });
};

export default competitionsRoutes;
