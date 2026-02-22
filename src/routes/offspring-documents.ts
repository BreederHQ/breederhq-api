// src/routes/offspring-documents.ts
// Document CRUD for offspring media (photos, videos, files).
// Mirrors animal-documents.ts but without trait-linking logic.
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
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

async function assertOffspringInTenant(offspringId: number, tenantId: number) {
  const offspring = await prisma.offspring.findFirst({
    where: { id: offspringId, tenantId },
    select: { id: true, tenantId: true },
  });
  if (!offspring) throw Object.assign(new Error("offspring_not_found"), { statusCode: 404 });
  return offspring;
}

const offspringDocumentsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ── List documents for an offspring ────────────────────────────────
  app.get("/offspring/individuals/:offspringId/documents", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const offspringId = parseIntStrict((req.params as { offspringId: string }).offspringId);
    if (!offspringId) return reply.code(400).send({ error: "offspring_id_invalid" });

    await assertOffspringInTenant(offspringId, tenantId);

    const documents = await prisma.document.findMany({
      where: { tenantId, offspringId },
      orderBy: { createdAt: "desc" },
    });

    const result = documents.map((doc) => ({
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
      category: doc.data && typeof doc.data === "object" && "category" in doc.data
        ? (doc.data as { category?: string }).category || null
        : null,
    }));

    return reply.send(result);
  });

  // ── Create document for an offspring ───────────────────────────────
  app.post("/offspring/individuals/:offspringId/documents", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const offspringId = parseIntStrict((req.params as { offspringId: string }).offspringId);
    if (!offspringId) return reply.code(400).send({ error: "offspring_id_invalid" });

    await assertOffspringInTenant(offspringId, tenantId);

    const body = (req.body || {}) as {
      title: string;
      originalFileName?: string;
      mimeType?: string;
      sizeBytes?: number;
      visibility?: string;
      storageKey?: string;
      cdnUrl?: string;
      category?: string;
    };

    if (!body.title) return reply.code(400).send({ error: "title_required" });

    let createdDoc;

    // Check if document already exists from media upload flow (has storageKey)
    if (body.storageKey) {
      const existingDoc = await prisma.document.findFirst({
        where: { storageKey: body.storageKey, tenantId },
      });

      if (existingDoc) {
        createdDoc = await prisma.document.update({
          where: { id: existingDoc.id },
          data: {
            offspringId,
            title: body.title,
            originalFileName: body.originalFileName || existingDoc.originalFileName,
            mimeType: body.mimeType || existingDoc.mimeType,
            sizeBytes: body.sizeBytes || existingDoc.sizeBytes,
            visibility: body.visibility as any || existingDoc.visibility || "PRIVATE",
            status: "READY",
            data: body.category ? { category: body.category } : (existingDoc.data ?? Prisma.DbNull),
          },
        });
      } else {
        createdDoc = await prisma.document.create({
          data: {
            tenantId, offspringId, scope: "offspring", title: body.title,
            storageKey: body.storageKey,
            url: body.cdnUrl || null,
            originalFileName: body.originalFileName || null,
            mimeType: body.mimeType || null,
            sizeBytes: body.sizeBytes || null,
            visibility: body.visibility as any || "PRIVATE",
            status: "READY",
            data: body.category ? { category: body.category } : Prisma.DbNull,
          },
        });
      }
    } else {
      createdDoc = await prisma.document.create({
        data: {
          tenantId, offspringId, scope: "offspring", title: body.title,
          originalFileName: body.originalFileName || null,
          mimeType: body.mimeType || null,
          sizeBytes: body.sizeBytes || null,
          visibility: body.visibility as any || "PRIVATE",
          status: "PLACEHOLDER",
          data: body.category ? { category: body.category } : Prisma.DbNull,
        },
      });
    }

    return reply.code(201).send(createdDoc);
  });

  // ── Update document visibility ─────────────────────────────────────
  app.put("/offspring/individuals/:offspringId/documents/:documentId/visibility", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const offspringId = parseIntStrict((req.params as { offspringId: string }).offspringId);
    const documentId = parseIntStrict((req.params as { documentId: string }).documentId);
    if (!offspringId || !documentId) return reply.code(400).send({ error: "invalid_params" });

    await assertOffspringInTenant(offspringId, tenantId);

    const body = req.body as { visibility?: string };
    const validVisibilities = ["PRIVATE", "BUYERS", "PUBLIC"];
    if (!body.visibility || !validVisibilities.includes(body.visibility)) {
      return reply.code(400).send({ error: "invalid_visibility", message: "Must be PRIVATE, BUYERS, or PUBLIC" });
    }

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, tenantId: true, offspringId: true },
    });

    if (!doc || doc.tenantId !== tenantId || doc.offspringId !== offspringId) {
      return reply.code(404).send({ error: "document_not_found" });
    }

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: { visibility: body.visibility as any },
      select: { id: true, visibility: true },
    });

    return reply.send(updated);
  });

  // ── Delete document ────────────────────────────────────────────────
  app.delete("/offspring/individuals/:offspringId/documents/:documentId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const offspringId = parseIntStrict((req.params as { offspringId: string }).offspringId);
    const documentId = parseIntStrict((req.params as { documentId: string }).documentId);
    if (!offspringId || !documentId) return reply.code(400).send({ error: "invalid_params" });

    await assertOffspringInTenant(offspringId, tenantId);

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, tenantId: true, offspringId: true },
    });

    if (!doc || doc.tenantId !== tenantId || doc.offspringId !== offspringId) {
      return reply.code(404).send({ error: "document_not_found" });
    }

    await prisma.document.delete({ where: { id: documentId } });

    return reply.code(204).send();
  });
};

export default offspringDocumentsRoutes;
