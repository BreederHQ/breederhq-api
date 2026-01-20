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

// Validate PennHIP JSON structure
function validatePennHIPJson(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  // Expected shape: { di: number, notes?: string, side: "left" | "right" | "both" }
  if (typeof value.di !== "number") return false;
  if (value.notes !== undefined && value.notes !== null && typeof value.notes !== "string") return false;
  if (value.side && !["left", "right", "both"].includes(value.side)) return false;
  return true;
}

const animalTraitsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/animals/:animalId/traits
  app.get("/animals/:animalId/traits", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    const animal = await assertAnimalInTenant(animalId, tenantId);

    // Get trait definitions for this species, sorted by category and sortOrder
    const definitions = await prisma.traitDefinition.findMany({
      where: {
        species: animal.species,
        OR: [{ tenantId: null }, { tenantId: tenantId }],
      },
      orderBy: [{ sortOrder: "asc" }, { category: "asc" }],
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

    // Get historical entries for traits that support history
    const historyTraitIds = definitions.filter(d => d.supportsHistory).map(d => d.id);
    const historyEntries = historyTraitIds.length > 0
      ? await prisma.animalTraitEntry.findMany({
          where: {
            tenantId,
            animalId,
            traitDefinitionId: { in: historyTraitIds },
          },
          orderBy: { recordedAt: "desc" },
        })
      : [];

    // Group history entries by trait definition
    const historyMap = new Map<number, any[]>();
    for (const entry of historyEntries) {
      if (!historyMap.has(entry.traitDefinitionId)) {
        historyMap.set(entry.traitDefinitionId, []);
      }
      historyMap.get(entry.traitDefinitionId)!.push({
        id: entry.id,
        recordedAt: entry.recordedAt,
        data: entry.data,
        performedBy: entry.performedBy,
        location: entry.location,
        notes: entry.notes,
      });
    }

    for (const def of definitions) {
      const value = valueMap.get(def.id);
      const history = historyMap.get(def.id) || [];

      // HARDENED: Always return all value keys (null if unused)
      const item = {
        traitKey: def.key,
        displayName: def.displayName,
        valueType: def.valueType,
        enumValues: def.enumValues,
        requiresDocument: def.requiresDocument,
        marketplaceVisibleDefault: def.marketplaceVisibleDefault,
        supportsHistory: def.supportsHistory,
        value: value ? {
          boolean: value.valueBoolean,
          number: value.valueNumber,
          text: value.valueText,
          date: value.valueDate,
          json: value.valueJson,
        } : {
          boolean: null,
          number: null,
          text: null,
          date: null,
          json: null,
        },
        status: value?.status || null,
        performedAt: value?.performedAt || null,
        source: value?.source || null,
        verified: value?.verified || false,
        verifiedAt: value?.verifiedAt || null,
        marketplaceVisible: value?.marketplaceVisible || null,
        networkVisible: value?.networkVisible || false,
        notes: value?.notes || null,
        traitValueId: value?.id || null,  // Always present, null if not yet created
        documents: value?.documents?.map(d => ({
          documentId: d.document.id,
          title: d.document.title,
          status: d.document.status,
          visibility: d.document.visibility,
          mimeType: d.document.mimeType,
          sizeBytes: d.document.sizeBytes,
          originalFileName: d.document.originalFileName,
        })) || [],
        // Include history entries for traits that support it
        history: def.supportsHistory ? history : undefined,
        historyCount: def.supportsHistory ? history.length : undefined,
      };

      if (!categoryMap.has(def.category)) categoryMap.set(def.category, []);
      categoryMap.get(def.category)!.push(item);
    }

    // HARDENED: Sort categories by the first item's sortOrder
    const categories = Array.from(categoryMap.entries())
      .sort((a, b) => {
        const aSort = a[1][0]?.sortOrder || 999;
        const bSort = b[1][0]?.sortOrder || 999;
        return aSort - bSort;
      })
      .map(([category, items]) => ({
        category,
        items,  // Already sorted by sortOrder in the query
      }));

    return reply.send({ animalId, species: animal.species, categories });
  });

  // PUT /api/v1/animals/:animalId/traits
  app.put("/animals/:animalId/traits", async (req, reply) => {
    try {
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
          species: animal.species, key: traitKey,
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

      // Check if this is a metadata-only update (only visibility fields, no value changes)
      const isMetadataOnlyUpdate =
        (upd.networkVisible !== undefined || upd.marketplaceVisible !== undefined) &&
        upd.valueBoolean === undefined &&
        upd.valueNumber === undefined &&
        upd.valueText === undefined &&
        upd.valueDate === undefined &&
        upd.valueJson === undefined;

      // For metadata-only updates, create or update just the visibility fields
      if (isMetadataOnlyUpdate) {
        const existingTrait = await prisma.animalTraitValue.findUnique({
          where: { tenantId_animalId_traitDefinitionId: { tenantId, animalId, traitDefinitionId: def.id } },
        });
        if (existingTrait) {
          // Just update metadata fields on existing record
          await prisma.animalTraitValue.update({
            where: { id: existingTrait.id },
            data: {
              ...(upd.networkVisible !== undefined && { networkVisible: Boolean(upd.networkVisible) }),
              ...(upd.marketplaceVisible !== undefined && { marketplaceVisible: Boolean(upd.marketplaceVisible) }),
            },
          });
        } else {
          // Create a new record with just visibility metadata (no value)
          await prisma.animalTraitValue.create({
            data: {
              tenantId,
              animalId,
              traitDefinitionId: def.id,
              marketplaceVisible: upd.marketplaceVisible !== undefined ? Boolean(upd.marketplaceVisible) : def.marketplaceVisibleDefault,
              networkVisible: upd.networkVisible !== undefined ? Boolean(upd.networkVisible) : false,
            },
          });
        }
        continue; // Skip to next update
      }

      // HARDENED: Strict value type validation with clear error messages
      if (def.valueType === "BOOLEAN") {
        if (upd.valueBoolean === undefined) {
          return reply.code(400).send({
            error: "value_type_mismatch",
            message: `Trait ${traitKey} expects valueBoolean (type: BOOLEAN)`,
          });
        }
        valueData.valueBoolean = Boolean(upd.valueBoolean);
      } else if (def.valueType === "NUMBER") {
        if (upd.valueNumber === undefined) {
          return reply.code(400).send({
            error: "value_type_mismatch",
            message: `Trait ${traitKey} expects valueNumber (type: NUMBER)`,
          });
        }
        valueData.valueNumber = Number(upd.valueNumber);
      } else if (def.valueType === "TEXT") {
        if (upd.valueText === undefined) {
          return reply.code(400).send({
            error: "value_type_mismatch",
            message: `Trait ${traitKey} expects valueText (type: TEXT)`,
          });
        }
        valueData.valueText = String(upd.valueText);
      } else if (def.valueType === "DATE") {
        if (upd.valueDate === undefined) {
          return reply.code(400).send({
            error: "value_type_mismatch",
            message: `Trait ${traitKey} expects valueDate (type: DATE)`,
          });
        }
        valueData.valueDate = new Date(upd.valueDate);
      } else if (def.valueType === "JSON") {
        if (upd.valueJson === undefined) {
          return reply.code(400).send({
            error: "value_type_mismatch",
            message: `Trait ${traitKey} expects valueJson (type: JSON)`,
          });
        }
        // HARDENED: PennHIP-specific validation
        if (traitKey === "dog.hips.pennhip") {
          if (!validatePennHIPJson(upd.valueJson)) {
            return reply.code(400).send({
              error: "invalid_pennhip_json",
              message: `PennHIP JSON must have shape: { di: number, notes?: string, side?: "left" | "right" | "both" }`,
            });
          }
        }
        valueData.valueJson = upd.valueJson;
      } else if (def.valueType === "ENUM") {
        if (upd.valueText === undefined) {
          return reply.code(400).send({
            error: "value_type_mismatch",
            message: `Trait ${traitKey} expects valueText (type: ENUM)`,
          });
        }
        // HARDENED: Validate against enumValues (allow empty string for "not selected")
        const enumVals = Array.isArray(def.enumValues) ? def.enumValues : [];
        if (enumVals.length > 0 && upd.valueText !== "" && !enumVals.includes(upd.valueText)) {
          return reply.code(400).send({
            error: "invalid_enum_value",
            message: `Invalid value "${upd.valueText}" for ${traitKey}. Allowed: ${enumVals.join(", ")}`,
          });
        }
        valueData.valueText = String(upd.valueText);
      }

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
          networkVisible: upd.networkVisible !== undefined ? Boolean(upd.networkVisible) : undefined,
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
          networkVisible: upd.networkVisible !== undefined ? upd.networkVisible : false,
          notes: upd.notes || null,
        },
      });
    }

    return app.inject({
      method: "GET",
      url: `/animals/${animalId}/traits`,
      headers: req.headers,
    }).then(res => reply.code(200).send(res.json()));
    } catch (err: any) {
      console.error("[animal-traits] PUT error:", err);
      return reply.code(500).send({
        error: "internal_error",
        message: err?.message || "Failed to save trait",
        details: process.env.NODE_ENV === "development" ? err?.stack : undefined,
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Trait History Endpoints (for traits with supportsHistory=true)
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /api/v1/animals/:animalId/traits/:traitKey/history
  // Returns all historical entries for a trait
  app.get("/animals/:animalId/traits/:traitKey/history", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { animalId: animalIdStr, traitKey } = req.params as { animalId: string; traitKey: string };
    const animalId = parseIntStrict(animalIdStr);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    const animal = await assertAnimalInTenant(animalId, tenantId);

    // Find the trait definition
    const def = await prisma.traitDefinition.findFirst({
      where: {
        species: animal.species,
        key: traitKey,
        OR: [{ tenantId: null }, { tenantId: tenantId }],
      },
    });

    if (!def) {
      return reply.code(404).send({ error: "trait_not_found" });
    }

    if (!def.supportsHistory) {
      return reply.code(400).send({
        error: "history_not_supported",
        message: `Trait ${traitKey} does not support historical entries`,
      });
    }

    // Get all entries for this trait, sorted by recordedAt descending (most recent first)
    const entries = await prisma.animalTraitEntry.findMany({
      where: {
        tenantId,
        animalId,
        traitDefinitionId: def.id,
      },
      orderBy: { recordedAt: "desc" },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            mimeType: true,
            sizeBytes: true,
            originalFileName: true,
          },
        },
      },
    });

    return reply.send({
      traitKey,
      displayName: def.displayName,
      entries: entries.map(e => ({
        id: e.id,
        recordedAt: e.recordedAt,
        data: e.data,
        performedBy: e.performedBy,
        location: e.location,
        notes: e.notes,
        document: e.document,
        createdAt: e.createdAt,
      })),
    });
  });

  // POST /api/v1/animals/:animalId/traits/:traitKey/history
  // Add a new historical entry
  app.post("/animals/:animalId/traits/:traitKey/history", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { animalId: animalIdStr, traitKey } = req.params as { animalId: string; traitKey: string };
    const animalId = parseIntStrict(animalIdStr);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    const animal = await assertAnimalInTenant(animalId, tenantId);

    const def = await prisma.traitDefinition.findFirst({
      where: {
        species: animal.species,
        key: traitKey,
        OR: [{ tenantId: null }, { tenantId: tenantId }],
      },
    });

    if (!def) {
      return reply.code(404).send({ error: "trait_not_found" });
    }

    if (!def.supportsHistory) {
      return reply.code(400).send({
        error: "history_not_supported",
        message: `Trait ${traitKey} does not support historical entries`,
      });
    }

    const body = req.body as {
      recordedAt: string;
      data: any;
      performedBy?: string;
      location?: string;
      notes?: string;
      documentId?: number;
    };

    if (!body.recordedAt) {
      return reply.code(400).send({ error: "recordedAt_required" });
    }

    if (!body.data || typeof body.data !== "object") {
      return reply.code(400).send({ error: "data_required" });
    }

    const entry = await prisma.animalTraitEntry.create({
      data: {
        tenantId,
        animalId,
        traitDefinitionId: def.id,
        recordedAt: new Date(body.recordedAt),
        data: body.data,
        performedBy: body.performedBy || null,
        location: body.location || null,
        notes: body.notes || null,
        documentId: body.documentId || null,
      },
    });

    return reply.code(201).send({
      id: entry.id,
      recordedAt: entry.recordedAt,
      data: entry.data,
      performedBy: entry.performedBy,
      location: entry.location,
      notes: entry.notes,
    });
  });

  // PUT /api/v1/animals/:animalId/traits/:traitKey/history/:entryId
  // Update a historical entry
  app.put("/animals/:animalId/traits/:traitKey/history/:entryId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { animalId: animalIdStr, traitKey, entryId: entryIdStr } = req.params as {
      animalId: string;
      traitKey: string;
      entryId: string;
    };
    const animalId = parseIntStrict(animalIdStr);
    const entryId = parseIntStrict(entryIdStr);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });
    if (!entryId) return reply.code(400).send({ error: "entry_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    // Verify entry belongs to this tenant and animal
    const existing = await prisma.animalTraitEntry.findFirst({
      where: { id: entryId, tenantId, animalId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "entry_not_found" });
    }

    const body = req.body as {
      recordedAt?: string;
      data?: any;
      performedBy?: string;
      location?: string;
      notes?: string;
      documentId?: number | null;
    };

    const entry = await prisma.animalTraitEntry.update({
      where: { id: entryId },
      data: {
        ...(body.recordedAt && { recordedAt: new Date(body.recordedAt) }),
        ...(body.data && { data: body.data }),
        ...(body.performedBy !== undefined && { performedBy: body.performedBy || null }),
        ...(body.location !== undefined && { location: body.location || null }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
        ...(body.documentId !== undefined && { documentId: body.documentId }),
      },
    });

    return reply.send({
      id: entry.id,
      recordedAt: entry.recordedAt,
      data: entry.data,
      performedBy: entry.performedBy,
      location: entry.location,
      notes: entry.notes,
    });
  });

  // DELETE /api/v1/animals/:animalId/traits/:traitKey/history/:entryId
  // Delete a historical entry
  app.delete("/animals/:animalId/traits/:traitKey/history/:entryId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { animalId: animalIdStr, traitKey, entryId: entryIdStr } = req.params as {
      animalId: string;
      traitKey: string;
      entryId: string;
    };
    const animalId = parseIntStrict(animalIdStr);
    const entryId = parseIntStrict(entryIdStr);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });
    if (!entryId) return reply.code(400).send({ error: "entry_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    // Verify entry belongs to this tenant and animal
    const existing = await prisma.animalTraitEntry.findFirst({
      where: { id: entryId, tenantId, animalId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "entry_not_found" });
    }

    await prisma.animalTraitEntry.delete({ where: { id: entryId } });

    return reply.code(204).send();
  });
};

export default animalTraitsRoutes;
