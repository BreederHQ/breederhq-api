// src/routes/animal-traits.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

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

const animalTraitsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/animals/:animalId/traits
  app.get("/animals/:animalId/traits", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    const animal = await assertAnimalInTenant(animalId, tenantId);

    const definitions = await prisma.traitDefinition.findMany({
      where: {
        species: animal.species,
        OR: [{ tenantId: null }, { tenantId: tenantId }],
      },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    });

    const existingValues = await prisma.animalTraitValue.findMany({
      where: { tenantId, animalId },
      include: {
        documents: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                status: true,
                visibility: true,
                mimeType: true,
                sizeBytes: true,
                originalFileName: true,
              },
            },
          },
        },
      },
    });

    const valueMap = new Map(existingValues.map(v => [v.traitDefinitionId, v]));
    const categoryMap = new Map<string, any[]>();

    for (const def of definitions) {
      const value = valueMap.get(def.id);
      const item = {
        traitKey: def.key,
        displayName: def.displayName,
        valueType: def.valueType,
        enumValues: def.enumValues,
        requiresDocument: def.requiresDocument,
        marketplaceVisibleDefault: def.marketplaceVisibleDefault,
        value: value ? {
          boolean: value.valueBoolean,
          number: value.valueNumber,
          text: value.valueText,
          date: value.valueDate,
          json: value.valueJson,
        } : null,
        status: value?.status || null,
        performedAt: value?.performedAt || null,
        source: value?.source || null,
        verified: value?.verified || false,
        verifiedAt: value?.verifiedAt || null,
        marketplaceVisible: value?.marketplaceVisible || null,
        notes: value?.notes || null,
        traitValueId: value?.id || null,
        documents: value?.documents?.map(d => ({
          documentId: d.document.id,
          title: d.document.title,
          status: d.document.status,
          visibility: d.document.visibility,
          mimeType: d.document.mimeType,
          sizeBytes: d.document.sizeBytes,
          originalFileName: d.document.originalFileName,
        })) || [],
      };

      if (!categoryMap.has(def.category)) categoryMap.set(def.category, []);
      categoryMap.get(def.category)!.push(item);
    }

    const categories = Array.from(categoryMap.entries()).map(([category, items]) => ({
      category,
      items,
    }));

    return reply.send({ animalId, species: animal.species, categories });
  });

  // PUT /api/v1/animals/:animalId/traits
  app.put("/animals/:animalId/traits", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    const animal = await assertAnimalInTenant(animalId, tenantId);
    const body = (req.body || {}) as { updates?: Array<any> };
    const updates = Array.isArray(body.updates) ? body.updates : [];

    for (const upd of updates) {
      const traitKey = upd.traitKey;
      if (!traitKey) continue;

      const def = await prisma.traitDefinition.findFirst({
        where: {
          species: animal.species,
          key: traitKey,
          OR: [{ tenantId: null }, { tenantId: tenantId }],
        },
      });

      if (!def) {
        return reply.code(404).send({ 
          error: "trait_not_found", 
          message: `Trait ${traitKey} not found for species ${animal.species}` 
        });
      }

      const valueData: any = {};
      if (def.valueType === "BOOLEAN" && upd.valueBoolean !== undefined) valueData.valueBoolean = Boolean(upd.valueBoolean);
      else if (def.valueType === "NUMBER" && upd.valueNumber !== undefined) valueData.valueNumber = Number(upd.valueNumber);
      else if (def.valueType === "TEXT" && upd.valueText !== undefined) valueData.valueText = String(upd.valueText);
      else if (def.valueType === "DATE" && upd.valueDate !== undefined) valueData.valueDate = new Date(upd.valueDate);
      else if (def.valueType === "JSON" && upd.valueJson !== undefined) valueData.valueJson = upd.valueJson;
      else if (def.valueType === "ENUM" && upd.valueText !== undefined) valueData.valueText = String(upd.valueText);

      await prisma.animalTraitValue.upsert({
        where: { tenantId_animalId_traitDefinitionId: { tenantId, animalId, traitDefinitionId: def.id } },
        update: {
          ...valueData,
          status: upd.status || undefined,
          performedAt: upd.performedAt ? new Date(upd.performedAt) : undefined,
          source: upd.source || undefined,
          verified: upd.verified !== undefined ? Boolean(upd.verified) : undefined,
          verifiedAt: upd.verifiedAt ? new Date(upd.verifiedAt) : undefined,
          marketplaceVisible: upd.marketplaceVisible !== undefined ? Boolean(upd.marketplaceVisible) : undefined,
          notes: upd.notes !== undefined ? upd.notes : undefined,
        },
        create: {
          tenantId, animalId, traitDefinitionId: def.id, ...valueData,
          status: upd.status || null,
          performedAt: upd.performedAt ? new Date(upd.performedAt) : null,
          source: upd.source || null,
          verified: upd.verified || false,
          verifiedAt: upd.verifiedAt ? new Date(upd.verifiedAt) : null,
          marketplaceVisible: upd.marketplaceVisible !== undefined ? upd.marketplaceVisible : def.marketplaceVisibleDefault,
          notes: upd.notes || null,
        },
      });
    }

    return app.inject({
      method: "GET",
      url: `/animals/${animalId}/traits`,
      headers: req.headers,
    }).then(res => reply.code(200).send(res.json()));
  });
};

export default animalTraitsRoutes;
