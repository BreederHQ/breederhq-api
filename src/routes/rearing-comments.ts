// src/routes/rearing-comments.ts
// Rearing Protocols API - Community comments and Q&A
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/* ───────────────────────── helpers ───────────────────────── */

function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q?.page ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q?.limit ?? "20", 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function idNum(v: any) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function trimToNull(v: any) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function errorReply(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[rearing-comments]", msg);
  return { status: 500, payload: { error: "internal_error", message: msg } };
}

/* ───────────────────────── routes ───────────────────────── */

const rearingCommentsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // GET /rearing-protocols/:protocolId/comments - List comments for a protocol
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/rearing-protocols/:protocolId/comments", async (req, reply) => {
    try {
      const protocolId = idNum((req.params as any).protocolId);
      const q = (req.query as any) ?? {};
      const { page, limit, skip } = parsePaging(q);

      if (!protocolId) {
        return reply.code(400).send({ error: "invalid_protocol_id" });
      }

      // Verify protocol exists and is public
      const protocol = await prisma.rearingProtocol.findFirst({
        where: {
          id: protocolId,
          isPublic: true,
          isActive: true,
          deletedAt: null,
        },
      });

      if (!protocol) {
        return reply.code(404).send({ error: "protocol_not_found" });
      }

      // Get top-level comments with replies
      const [total, comments] = await Promise.all([
        prisma.protocolComment.count({
          where: {
            protocolId,
            parentId: null,
            isHidden: false,
          },
        }),
        prisma.protocolComment.findMany({
          where: {
            protocolId,
            parentId: null,
            isHidden: false,
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            replies: {
              where: { isHidden: false },
              orderBy: { createdAt: "asc" },
            },
          },
        }),
      ]);

      return reply.send({ comments, total, page, limit });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /rearing-protocols/:protocolId/comments - Add a comment
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-protocols/:protocolId/comments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const protocolId = idNum((req.params as any).protocolId);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!protocolId) {
        return reply.code(400).send({ error: "invalid_protocol_id" });
      }

      const body = req.body as any;
      const content = trimToNull(body.content);
      const parentId = idNum(body.parentId);

      if (!content) {
        return reply.code(400).send({ error: "content_required" });
      }

      if (content.length > 2000) {
        return reply.code(400).send({ error: "content_too_long", max: 2000 });
      }

      // Verify protocol exists and is public
      const protocol = await prisma.rearingProtocol.findFirst({
        where: {
          id: protocolId,
          isPublic: true,
          isActive: true,
          deletedAt: null,
        },
      });

      if (!protocol) {
        return reply.code(404).send({ error: "protocol_not_found" });
      }

      // If replying, verify parent comment exists
      if (parentId) {
        const parentComment = await prisma.protocolComment.findFirst({
          where: {
            id: parentId,
            protocolId,
            isHidden: false,
          },
        });

        if (!parentComment) {
          return reply.code(404).send({ error: "parent_comment_not_found" });
        }

        // Prevent deep nesting - replies can only be to top-level comments
        if (parentComment.parentId !== null) {
          return reply.code(400).send({ error: "cannot_reply_to_reply" });
        }
      }

      // Get tenant name for author
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });

      const comment = await prisma.protocolComment.create({
        data: {
          protocolId,
          tenantId,
          content,
          parentId,
          authorName: tenant?.name ?? "Unknown Breeder",
        },
        include: {
          replies: {
            where: { isHidden: false },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      return reply.code(201).send(comment);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PUT /rearing-protocols/comments/:commentId - Edit own comment
  // ─────────────────────────────────────────────────────────────────────────────
  app.put("/rearing-protocols/comments/:commentId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const commentId = idNum((req.params as any).commentId);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!commentId) {
        return reply.code(400).send({ error: "invalid_comment_id" });
      }

      const body = req.body as any;
      const content = trimToNull(body.content);

      if (!content) {
        return reply.code(400).send({ error: "content_required" });
      }

      if (content.length > 2000) {
        return reply.code(400).send({ error: "content_too_long", max: 2000 });
      }

      // Verify ownership
      const existing = await prisma.protocolComment.findFirst({
        where: {
          id: commentId,
          tenantId,
          isHidden: false,
        },
      });

      if (!existing) {
        return reply.code(404).send({ error: "comment_not_found" });
      }

      const updated = await prisma.protocolComment.update({
        where: { id: commentId },
        data: { content },
        include: {
          replies: {
            where: { isHidden: false },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      return reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /rearing-protocols/comments/:commentId - Delete own comment
  // ─────────────────────────────────────────────────────────────────────────────
  app.delete("/rearing-protocols/comments/:commentId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const commentId = idNum((req.params as any).commentId);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!commentId) {
        return reply.code(400).send({ error: "invalid_comment_id" });
      }

      // Verify ownership
      const existing = await prisma.protocolComment.findFirst({
        where: {
          id: commentId,
          tenantId,
        },
      });

      if (!existing) {
        return reply.code(404).send({ error: "comment_not_found" });
      }

      // Soft delete by hiding
      await prisma.protocolComment.update({
        where: { id: commentId },
        data: {
          isHidden: true,
          hiddenAt: new Date(),
        },
      });

      return reply.send({ success: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });
};

export default rearingCommentsRoutes;
