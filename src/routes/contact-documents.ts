// src/routes/contact-documents.ts
// Document management for contacts (scoped via partyId)
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

async function resolveContactPartyId(contactId: number, tenantId: number) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, tenantId },
    select: { id: true, partyId: true },
  });
  if (!contact) throw Object.assign(new Error("contact_not_found"), { statusCode: 404 });
  if (!contact.partyId) throw Object.assign(new Error("contact_has_no_party"), { statusCode: 400 });
  return contact.partyId;
}

const contactDocumentsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /contacts/:contactId/documents - List documents for a contact
  app.get("/contacts/:contactId/documents", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const contactId = parseIntStrict((req.params as { contactId: string }).contactId);
    if (!contactId) return reply.code(400).send({ error: "contact_id_invalid" });

    const partyId = await resolveContactPartyId(contactId, tenantId);

    const documents = await prisma.document.findMany({
      where: { tenantId, partyId, scope: "contact" },
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
      watermarkEnabled: doc.watermarkEnabled,
      category: doc.data && typeof doc.data === "object" && "category" in doc.data
        ? (doc.data as { category?: string }).category || null
        : null,
    }));

    return reply.send(result);
  });

  // POST /contacts/:contactId/documents - Upload a document for a contact
  app.post("/contacts/:contactId/documents", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const contactId = parseIntStrict((req.params as { contactId: string }).contactId);
    if (!contactId) return reply.code(400).send({ error: "contact_id_invalid" });

    const partyId = await resolveContactPartyId(contactId, tenantId);

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

    if (body.storageKey) {
      const existingDoc = await prisma.document.findFirst({
        where: { storageKey: body.storageKey, tenantId },
      });

      if (existingDoc) {
        createdDoc = await prisma.document.update({
          where: { id: existingDoc.id },
          data: {
            partyId,
            scope: "contact",
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
            tenantId, partyId, scope: "contact", title: body.title,
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
          tenantId, partyId, scope: "contact", title: body.title,
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

  // DELETE /contacts/:contactId/documents/:documentId
  app.delete("/contacts/:contactId/documents/:documentId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const contactId = parseIntStrict((req.params as { contactId: string }).contactId);
    const documentId = parseIntStrict((req.params as { documentId: string }).documentId);
    if (!contactId || !documentId) return reply.code(400).send({ error: "invalid_params" });

    const partyId = await resolveContactPartyId(contactId, tenantId);

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, tenantId: true, partyId: true },
    });

    if (!doc || doc.tenantId !== tenantId || doc.partyId !== partyId) {
      return reply.code(404).send({ error: "document_not_found" });
    }

    await prisma.document.delete({ where: { id: documentId } });
    return reply.code(204).send();
  });
};

export default contactDocumentsRoutes;
