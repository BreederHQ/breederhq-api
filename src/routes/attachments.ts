// src/routes/attachments.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/* ───────────────────────── helpers ───────────────────────── */

function parseIntOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parsePaging(q: any) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(200, Math.max(1, Number(q?.limit ?? 50) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function errorReply(err: unknown) {
  const any = err as any;
  const code = any?.code;
  if (code === "P2002") {
    return { status: 409, payload: { error: "duplicate", detail: any?.meta?.target } };
  }
  if (code === "P2025") {
    return { status: 404, payload: { error: "not_found" } };
  }
  return { status: 500, payload: { error: "internal_error", detail: any?.message } };
}

function attachmentDTO(a: any) {
  return {
    id: a.id,
    tenantId: a.tenantId,
    kind: a.kind,
    storageProvider: a.storageProvider,
    storageKey: a.storageKey,
    filename: a.filename,
    mime: a.mime,
    bytes: a.bytes,
    invoiceId: a.invoiceId,
    paymentId: a.paymentId,
    expenseId: a.expenseId,
    createdByUserId: a.createdByUserId,
    createdAt: a.createdAt,
  };
}

/* ───────────────────────── routes ───────────────────────── */

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /attachments - List attachments by entity
  app.get("/attachments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const query = req.query as any;
      const { page, limit, skip } = parsePaging(query);

      const where: any = { tenantId };

      // Filter by entity (must specify at least one)
      if (query.invoiceId) where.invoiceId = parseIntOrNull(query.invoiceId);
      if (query.paymentId) where.paymentId = parseIntOrNull(query.paymentId);
      if (query.expenseId) where.expenseId = parseIntOrNull(query.expenseId);

      const [data, total] = await Promise.all([
        prisma.attachment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.attachment.count({ where }),
      ]);

      return reply.code(200).send({
        items: data.map(attachmentDTO),
        total,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // POST /attachments - Create attachment record (assumes file already uploaded to storage)
  app.post("/attachments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const body = req.body as any;

      // Validate required fields
      if (!body.filename || !body.storageKey || !body.storageProvider) {
        return reply.code(400).send({ error: "missing_required_fields" });
      }

      // Must link to at least one entity
      const invoiceId = parseIntOrNull(body.invoiceId);
      const paymentId = parseIntOrNull(body.paymentId);
      const expenseId = parseIntOrNull(body.expenseId);

      if (!invoiceId && !paymentId && !expenseId) {
        return reply.code(400).send({ error: "must_link_to_entity" });
      }

      const attachment = await prisma.attachment.create({
        data: {
          tenantId,
          kind: body.kind || "generic",
          storageProvider: body.storageProvider,
          storageKey: body.storageKey,
          filename: body.filename,
          mime: body.mime || "application/octet-stream",
          bytes: Number(body.bytes) || 0,
          invoiceId,
          paymentId,
          expenseId,
          createdByUserId: (req as any).userId || null,
        },
      });

      return reply.code(201).send(attachmentDTO(attachment));
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // DELETE /attachments/:id - Delete attachment
  app.delete("/attachments/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const deleted = await prisma.attachment.deleteMany({
        where: { id, tenantId },
      });

      if (deleted.count === 0) return reply.code(404).send({ error: "not_found" });

      return reply.code(204).send();
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });
};

export default routes;
