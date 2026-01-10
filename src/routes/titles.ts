// src/routes/titles.ts
// Title definitions and animal title CRUD
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { Species, TitleCategory, TitleStatus } from "@prisma/client";

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

/**
 * Rebuild cached title strings (titlePrefix, titleSuffix) for an animal
 */
async function rebuildTitleCache(animalId: number) {
  const titles = await prisma.animalTitle.findMany({
    where: { animalId, status: { in: [TitleStatus.EARNED, TitleStatus.VERIFIED] } },
    include: { titleDefinition: true },
    orderBy: { titleDefinition: { displayOrder: "asc" } },
  });

  const prefixes: string[] = [];
  const suffixes: string[] = [];

  for (const t of titles) {
    if (t.titleDefinition.prefixTitle) {
      prefixes.push(t.titleDefinition.abbreviation);
    }
    if (t.titleDefinition.suffixTitle) {
      suffixes.push(t.titleDefinition.abbreviation);
    }
  }

  await prisma.animal.update({
    where: { id: animalId },
    data: {
      titlePrefix: prefixes.length > 0 ? prefixes.join(" ") : null,
      titleSuffix: suffixes.length > 0 ? suffixes.join(" ") : null,
    },
  });
}

const titlesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // Title Definitions (global + tenant-specific)
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /api/v1/title-definitions
  // Query params: species, category, organization
  app.get("/title-definitions", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as { species?: string; category?: string; organization?: string };

    const where: any = {
      OR: [{ tenantId: null }, { tenantId }],
    };

    if (query.species && Object.values(Species).includes(query.species as Species)) {
      where.species = query.species as Species;
    }
    if (query.category && Object.values(TitleCategory).includes(query.category as TitleCategory)) {
      where.category = query.category as TitleCategory;
    }
    if (query.organization) {
      where.organization = query.organization;
    }

    const definitions = await prisma.titleDefinition.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { abbreviation: "asc" }],
      include: {
        parentTitle: { select: { id: true, abbreviation: true } },
      },
    });

    return definitions;
  });

  // POST /api/v1/title-definitions (tenant-specific custom title)
  app.post("/title-definitions", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
      species: Species;
      abbreviation: string;
      fullName: string;
      category: TitleCategory;
      organization?: string;
      parentTitleId?: number;
      pointsRequired?: number;
      description?: string;
      isProducingTitle?: boolean;
      prefixTitle?: boolean;
      suffixTitle?: boolean;
      displayOrder?: number;
    };

    if (!body.species || !body.abbreviation || !body.fullName || !body.category) {
      return reply.code(400).send({ error: "missing_required_fields" });
    }

    // Check for existing
    const existing = await prisma.titleDefinition.findFirst({
      where: {
        species: body.species,
        abbreviation: body.abbreviation,
        organization: body.organization ?? null,
        tenantId,
      },
    });

    if (existing) {
      return reply.code(409).send({ error: "title_already_exists" });
    }

    const created = await prisma.titleDefinition.create({
      data: {
        tenantId,
        species: body.species,
        abbreviation: body.abbreviation,
        fullName: body.fullName,
        category: body.category,
        organization: body.organization,
        parentTitleId: body.parentTitleId,
        pointsRequired: body.pointsRequired,
        description: body.description,
        isProducingTitle: body.isProducingTitle ?? false,
        prefixTitle: body.prefixTitle ?? true,
        suffixTitle: body.suffixTitle ?? false,
        displayOrder: body.displayOrder ?? 0,
      },
    });

    return reply.code(201).send(created);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Animal Titles
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /api/v1/animals/:animalId/titles
  app.get("/animals/:animalId/titles", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const titles = await prisma.animalTitle.findMany({
      where: { animalId, tenantId },
      include: {
        titleDefinition: {
          select: {
            id: true,
            abbreviation: true,
            fullName: true,
            category: true,
            organization: true,
            prefixTitle: true,
            suffixTitle: true,
            displayOrder: true,
            isProducingTitle: true,
          },
        },
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
      orderBy: { titleDefinition: { displayOrder: "asc" } },
    });

    return titles;
  });

  // POST /api/v1/animals/:animalId/titles
  app.post("/animals/:animalId/titles", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const body = req.body as {
      titleDefinitionId: number;
      dateEarned?: string;
      status?: TitleStatus;
      pointsEarned?: number;
      majorWins?: number;
      eventName?: string;
      eventLocation?: string;
      handlerName?: string;
      verified?: boolean;
      verifiedBy?: string;
      registryRef?: string;
      isPublic?: boolean;
      notes?: string;
    };

    if (!body.titleDefinitionId) {
      return reply.code(400).send({ error: "title_definition_id_required" });
    }

    // Verify title definition exists and is accessible
    const titleDef = await prisma.titleDefinition.findFirst({
      where: {
        id: body.titleDefinitionId,
        OR: [{ tenantId: null }, { tenantId }],
      },
    });

    if (!titleDef) {
      return reply.code(404).send({ error: "title_definition_not_found" });
    }

    // Check if animal already has this title
    const existing = await prisma.animalTitle.findUnique({
      where: { animalId_titleDefinitionId: { animalId, titleDefinitionId: body.titleDefinitionId } },
    });

    if (existing) {
      return reply.code(409).send({ error: "title_already_assigned" });
    }

    const created = await prisma.animalTitle.create({
      data: {
        tenantId,
        animalId,
        titleDefinitionId: body.titleDefinitionId,
        dateEarned: body.dateEarned ? new Date(body.dateEarned) : null,
        status: body.status ?? TitleStatus.EARNED,
        pointsEarned: body.pointsEarned,
        majorWins: body.majorWins,
        eventName: body.eventName,
        eventLocation: body.eventLocation,
        handlerName: body.handlerName,
        verified: body.verified ?? false,
        verifiedBy: body.verifiedBy,
        registryRef: body.registryRef,
        isPublic: body.isPublic ?? false,
        notes: body.notes,
      },
      include: {
        titleDefinition: true,
      },
    });

    // Rebuild title cache
    await rebuildTitleCache(animalId);

    return reply.code(201).send(created);
  });

  // PUT /api/v1/animals/:animalId/titles/:titleId
  app.put("/animals/:animalId/titles/:titleId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    const titleId = parseIntStrict((req.params as { titleId: string }).titleId);
    if (!animalId || !titleId) return reply.code(400).send({ error: "invalid_params" });

    await assertAnimalInTenant(animalId, tenantId);

    const existing = await prisma.animalTitle.findFirst({
      where: { id: titleId, animalId, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "title_not_found" });
    }

    const body = req.body as {
      dateEarned?: string | null;
      status?: TitleStatus;
      pointsEarned?: number | null;
      majorWins?: number | null;
      eventName?: string | null;
      eventLocation?: string | null;
      handlerName?: string | null;
      verified?: boolean;
      verifiedAt?: string | null;
      verifiedBy?: string | null;
      registryRef?: string | null;
      isPublic?: boolean;
      notes?: string | null;
    };

    const updated = await prisma.animalTitle.update({
      where: { id: titleId },
      data: {
        dateEarned: body.dateEarned !== undefined ? (body.dateEarned ? new Date(body.dateEarned) : null) : undefined,
        status: body.status,
        pointsEarned: body.pointsEarned,
        majorWins: body.majorWins,
        eventName: body.eventName,
        eventLocation: body.eventLocation,
        handlerName: body.handlerName,
        verified: body.verified,
        verifiedAt: body.verifiedAt !== undefined ? (body.verifiedAt ? new Date(body.verifiedAt) : null) : undefined,
        verifiedBy: body.verifiedBy,
        registryRef: body.registryRef,
        notes: body.notes,
      },
      include: {
        titleDefinition: true,
      },
    });

    // Rebuild title cache if status changed
    if (body.status !== undefined) {
      await rebuildTitleCache(animalId);
    }

    return updated;
  });

  // DELETE /api/v1/animals/:animalId/titles/:titleId
  app.delete("/animals/:animalId/titles/:titleId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    const titleId = parseIntStrict((req.params as { titleId: string }).titleId);
    if (!animalId || !titleId) return reply.code(400).send({ error: "invalid_params" });

    await assertAnimalInTenant(animalId, tenantId);

    const existing = await prisma.animalTitle.findFirst({
      where: { id: titleId, animalId, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "title_not_found" });
    }

    await prisma.animalTitle.delete({ where: { id: titleId } });

    // Rebuild title cache
    await rebuildTitleCache(animalId);

    return reply.code(204).send();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Producing Stats (computed from offspring titles)
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /api/v1/animals/:animalId/producing-record
  app.get("/animals/:animalId/producing-record", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    const animal = await assertAnimalInTenant(animalId, tenantId);

    // Get all offspring (both as dam and sire)
    const offspring = await prisma.animal.findMany({
      where: {
        OR: [{ damId: animalId }, { sireId: animalId }],
      },
      select: {
        id: true,
        name: true,
        titles: {
          where: { status: { in: [TitleStatus.EARNED, TitleStatus.VERIFIED] } },
          include: {
            titleDefinition: {
              select: {
                abbreviation: true,
                fullName: true,
                category: true,
                organization: true,
              },
            },
          },
        },
      },
    });

    // Count offspring with titles by category
    const titleCounts: Record<string, number> = {};
    const titledOffspring: Array<{
      id: number;
      name: string | null;
      titles: string[];
    }> = [];

    for (const o of offspring) {
      if (o.titles.length > 0) {
        titledOffspring.push({
          id: o.id,
          name: o.name,
          titles: o.titles.map((t) => t.titleDefinition.abbreviation),
        });

        for (const t of o.titles) {
          const key = `${t.titleDefinition.category}_${t.titleDefinition.organization}`;
          titleCounts[key] = (titleCounts[key] || 0) + 1;
        }
      }
    }

    // Compute common producing stats
    const championOffspring = offspring.filter((o) =>
      o.titles.some((t) => t.titleDefinition.abbreviation === "CH")
    ).length;

    const grandChampionOffspring = offspring.filter((o) =>
      o.titles.some((t) =>
        ["GCH", "GCHB", "GCHS", "GCHG", "GCHP", "GRCH"].includes(t.titleDefinition.abbreviation)
      )
    ).length;

    return {
      totalOffspring: offspring.length,
      titledOffspring: titledOffspring.length,
      championOffspring,
      grandChampionOffspring,
      titleCountsByCategory: titleCounts,
      titledOffspringList: titledOffspring,
    };
  });
};

export default titlesRoutes;
