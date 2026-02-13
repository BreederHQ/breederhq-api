// src/routes/animal-documents.ts
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

const animalDocumentsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/animals/:animalId/documents", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const documents = await prisma.document.findMany({
      where: { tenantId, animalId },
      include: {
        traitValueLinks: {
          include: {
            animalTraitValue: {
              include: {
                traitDefinition: {
                  select: { key: true, displayName: true, category: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      mimeType: doc.mimeType,
      bytes: doc.bytes,
      sizeBytes: doc.sizeBytes,
      originalFileName: doc.originalFileName,
      visibility: doc.visibility,
      status: doc.status,
      storageKey: doc.storageKey,
      externalUrl: doc.externalUrl,
      url: doc.url,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      // Extract category from data JSON field (safely handle null/undefined)
      category: doc.data && typeof doc.data === 'object' && 'category' in doc.data
        ? (doc.data as { category?: string }).category || null
        : null,
      linkedTraits: doc.traitValueLinks.map(link => ({
        traitKey: link.animalTraitValue.traitDefinition.key,
        displayName: link.animalTraitValue.traitDefinition.displayName,
        category: link.animalTraitValue.traitDefinition.category,
        traitValueId: link.animalTraitValueId,
      })),
    }));

    return reply.send(result);
  });

  app.post("/animals/:animalId/documents", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    const animal = await assertAnimalInTenant(animalId, tenantId);

    const body = (req.body || {}) as {
      title: string;
      originalFileName?: string;
      mimeType?: string;
      sizeBytes?: number;
      visibility?: string;
      linkTraitKeys?: string[];
      storageKey?: string;
      cdnUrl?: string;
      category?: string;
    };

    if (!body.title) return reply.code(400).send({ error: "title_required" });

    let createdDoc;

    // Check if document already exists from media upload flow (has storageKey)
    // This prevents duplicate documents when /media/upload-url already created one
    if (body.storageKey) {
      const existingDoc = await prisma.document.findFirst({
        where: { storageKey: body.storageKey, tenantId },
      });

      if (existingDoc) {
        // Update existing document with the user-provided title and metadata
        createdDoc = await prisma.document.update({
          where: { id: existingDoc.id },
          data: {
            animalId,
            title: body.title,
            originalFileName: body.originalFileName || existingDoc.originalFileName,
            mimeType: body.mimeType || existingDoc.mimeType,
            sizeBytes: body.sizeBytes || existingDoc.sizeBytes,
            visibility: body.visibility as any || existingDoc.visibility || "PRIVATE",
            status: "READY",
            // Store category in data JSON field (Document model doesn't have category column yet)
            data: body.category ? { category: body.category } : existingDoc.data,
          },
        });
      } else {
        // storageKey provided but no existing doc - create new with storageKey
        createdDoc = await prisma.document.create({
          data: {
            tenantId, animalId, scope: "animal", title: body.title,
            storageKey: body.storageKey,
            url: body.cdnUrl || null,
            originalFileName: body.originalFileName || null,
            mimeType: body.mimeType || null,
            sizeBytes: body.sizeBytes || null,
            visibility: body.visibility as any || "PRIVATE",
            status: "READY",
            data: body.category ? { category: body.category } : null,
          },
        });
      }
    } else {
      // No storageKey - create placeholder document (legacy flow)
      createdDoc = await prisma.document.create({
        data: {
          tenantId, animalId, scope: "animal", title: body.title,
          originalFileName: body.originalFileName || null,
          mimeType: body.mimeType || null,
          sizeBytes: body.sizeBytes || null,
          visibility: body.visibility as any || "PRIVATE",
          status: "PLACEHOLDER",
          data: body.category ? { category: body.category } : null,
        },
      });
    }

    const linkedTraits: any[] = [];

    if (Array.isArray(body.linkTraitKeys) && body.linkTraitKeys.length > 0) {
      for (const traitKey of body.linkTraitKeys) {
        // Validate trait belongs to this animal's species
        const def = await prisma.traitDefinition.findFirst({
          where: {
            species: animal.species, key: traitKey,
            OR: [{ tenantId: null }, { tenantId: tenantId }],
          },
        });

        if (!def) {
          return reply.code(404).send({
            error: "trait_not_found_for_species",
            message: `Trait ${traitKey} not found for species ${animal.species}`,
          });
        }

        let traitValue = await prisma.animalTraitValue.findUnique({
          where: { tenantId_animalId_traitDefinitionId: { tenantId, animalId, traitDefinitionId: def.id } },
        });

        if (!traitValue) {
          traitValue = await prisma.animalTraitValue.create({
            data: { tenantId, animalId, traitDefinitionId: def.id, status: "NOT_PROVIDED" },
          });
        }

        await prisma.animalTraitValueDocument.create({
          data: { tenantId, animalId, animalTraitValueId: traitValue.id, documentId: createdDoc.id },
        });

        linkedTraits.push({
          traitKey: def.key, displayName: def.displayName, category: def.category, traitValueId: traitValue.id,
        });
      }
    }

    return reply.code(201).send({ ...createdDoc, linkedTraits });
  });

  app.post("/animals/:animalId/traits/:traitKey/documents", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    const traitKey = (req.params as { traitKey: string }).traitKey;
    if (!animalId || !traitKey) return reply.code(400).send({ error: "invalid_params" });

    const animal = await assertAnimalInTenant(animalId, tenantId);
    const body = (req.body || {}) as {
      title: string;
      originalFileName?: string;
      mimeType?: string;
      sizeBytes?: number;
      visibility?: string;
      storageKey?: string;
      cdnUrl?: string;
    };

    if (!body.title) return reply.code(400).send({ error: "title_required" });

    // Validate trait belongs to this animal's species
    const def = await prisma.traitDefinition.findFirst({
      where: {
        species: animal.species, key: traitKey,
        OR: [{ tenantId: null }, { tenantId: tenantId }],
      },
    });

    if (!def) {
      return reply.code(404).send({
        error: "trait_not_found_for_species",
        message: `Trait ${traitKey} not found for species ${animal.species}`
      });
    }

    let createdDoc;

    // If storageKey provided, find the document created by /media/upload-url flow
    // and update it rather than creating a duplicate PLACEHOLDER
    if (body.storageKey) {
      const existingDoc = await prisma.document.findFirst({
        where: { storageKey: body.storageKey, tenantId },
      });

      if (existingDoc) {
        createdDoc = await prisma.document.update({
          where: { id: existingDoc.id },
          data: {
            animalId,
            title: body.title,
            originalFileName: body.originalFileName || existingDoc.originalFileName,
            mimeType: body.mimeType || existingDoc.mimeType,
            sizeBytes: body.sizeBytes || existingDoc.sizeBytes,
            visibility: body.visibility as any || existingDoc.visibility || "PRIVATE",
            status: "READY",
          },
        });
      } else {
        createdDoc = await prisma.document.create({
          data: {
            tenantId, animalId, scope: "animal", title: body.title,
            storageKey: body.storageKey,
            url: body.cdnUrl || null,
            originalFileName: body.originalFileName || null,
            mimeType: body.mimeType || null,
            sizeBytes: body.sizeBytes || null,
            visibility: body.visibility as any || "PRIVATE",
            status: "READY",
          },
        });
      }
    } else {
      // No storageKey - create placeholder document (legacy flow)
      createdDoc = await prisma.document.create({
        data: {
          tenantId, animalId, scope: "animal", title: body.title,
          originalFileName: body.originalFileName || null,
          mimeType: body.mimeType || null,
          sizeBytes: body.sizeBytes || null,
          visibility: body.visibility as any || "PRIVATE",
          status: "PLACEHOLDER",
        },
      });
    }

    let traitValue = await prisma.animalTraitValue.findUnique({
      where: { tenantId_animalId_traitDefinitionId: { tenantId, animalId, traitDefinitionId: def.id } },
    });

    if (!traitValue) {
      traitValue = await prisma.animalTraitValue.create({
        data: { tenantId, animalId, traitDefinitionId: def.id, status: "PROVIDED" },
      });
    }

    await prisma.animalTraitValueDocument.create({
      data: { tenantId, animalId, animalTraitValueId: traitValue.id, documentId: createdDoc.id },
    });

    return reply.code(201).send({
      ...createdDoc,
      linkedTraits: [{ traitKey: def.key, displayName: def.displayName, category: def.category, traitValueId: traitValue.id }],
    });
  });

  // ── Update document visibility ────────────────────────────────────
  app.put("/animals/:animalId/documents/:documentId/visibility", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    const documentId = parseIntStrict((req.params as { documentId: string }).documentId);
    if (!animalId || !documentId) return reply.code(400).send({ error: "invalid_params" });

    await assertAnimalInTenant(animalId, tenantId);

    const body = req.body as { visibility?: string };
    const validVisibilities = ["PRIVATE", "BUYERS", "PUBLIC"];
    if (!body.visibility || !validVisibilities.includes(body.visibility)) {
      return reply.code(400).send({ error: "invalid_visibility", message: "Must be PRIVATE, BUYERS, or PUBLIC" });
    }

    // Verify document belongs to this tenant and animal
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, tenantId: true, animalId: true },
    });

    if (!doc || doc.tenantId !== tenantId || doc.animalId !== animalId) {
      return reply.code(404).send({ error: "document_not_found" });
    }

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: { visibility: body.visibility as any },
      select: { id: true, visibility: true },
    });

    return reply.send(updated);
  });

  app.delete("/animals/:animalId/documents/:documentId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    const documentId = parseIntStrict((req.params as { documentId: string }).documentId);
    if (!animalId || !documentId) return reply.code(400).send({ error: "invalid_params" });

    await assertAnimalInTenant(animalId, tenantId);

    // SAFETY: Verify document belongs to this tenant AND this animal before deletion
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, tenantId: true, animalId: true },
    });

    if (!doc || doc.tenantId !== tenantId || doc.animalId !== animalId) {
      return reply.code(404).send({ error: "document_not_found" });
    }

    // Delete trait links first (explicit cascade safety)
    await prisma.animalTraitValueDocument.deleteMany({ where: { documentId } });

    // Delete the document
    await prisma.document.delete({ where: { id: documentId } });

    return reply.code(204).send();
  });
};

export default animalDocumentsRoutes;
