// src/routes/drafts.ts
// Draft message/email CRUD endpoints for Communications Hub

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import type { DraftChannel } from "@prisma/client";

interface DraftResponse {
  id: number;
  tenantId: number;
  partyId: number | null;
  partyName: string | null;
  channel: "email" | "dm";
  subject: string | null;
  toAddresses: string[];
  bodyText: string;
  bodyHtml: string | null;
  templateId: number | null;
  metadata: any;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDraftResponse(draft: any): DraftResponse {
  return {
    id: draft.id,
    tenantId: draft.tenantId,
    partyId: draft.partyId,
    partyName: draft.party?.name || null,
    channel: draft.channel,
    subject: draft.subject,
    toAddresses: draft.toAddresses || [],
    bodyText: draft.bodyText,
    bodyHtml: draft.bodyHtml,
    templateId: draft.templateId,
    metadata: draft.metadata,
    createdByUserId: draft.createdByUserId,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  };
}

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /drafts - List drafts
  app.get("/drafts", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { channel, partyId, limit = 50, offset = 0 } = req.query as {
      channel?: "email" | "dm";
      partyId?: string;
      limit?: number;
      offset?: number;
    };

    const where: any = { tenantId };

    if (channel) {
      where.channel = channel;
    }

    if (partyId) {
      where.partyId = Number(partyId);
    }

    const take = Math.min(Number(limit), 100);
    const skip = Number(offset);

    const [drafts, total] = await Promise.all([
      prisma.draft.findMany({
        where,
        include: { party: { select: { id: true, name: true } } },
        orderBy: { updatedAt: "desc" },
        take,
        skip,
      }),
      prisma.draft.count({ where }),
    ]);

    return reply.send({
      items: drafts.map(toDraftResponse),
      total,
    });
  });

  // GET /drafts/:id - Get single draft
  app.get("/drafts/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const draft = await prisma.draft.findFirst({
      where: { id, tenantId },
      include: { party: { select: { id: true, name: true } } },
    });

    if (!draft) {
      return reply.code(404).send({ error: "draft_not_found" });
    }

    return reply.send(toDraftResponse(draft));
  });

  // POST /drafts - Create draft
  app.post("/drafts", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    const userId = (req as any).userId as string | undefined;
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { channel, partyId, subject, toAddresses, bodyText, bodyHtml, templateId, metadata } =
      req.body as {
        channel: "email" | "dm";
        partyId?: number;
        subject?: string;
        toAddresses?: string[];
        bodyText: string;
        bodyHtml?: string;
        templateId?: number;
        metadata?: any;
      };

    if (!channel || !["email", "dm"].includes(channel)) {
      return reply.code(400).send({
        error: "invalid_channel",
        allowed: ["email", "dm"],
      });
    }

    if (!bodyText) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["channel", "bodyText"],
      });
    }

    const draft = await prisma.draft.create({
      data: {
        tenantId,
        channel: channel as DraftChannel,
        partyId: partyId || null,
        subject: subject || null,
        toAddresses: toAddresses || [],
        bodyText,
        bodyHtml: bodyHtml || null,
        templateId: templateId || null,
        metadata: metadata || null,
        createdByUserId: userId || null,
      },
      include: { party: { select: { id: true, name: true } } },
    });

    return reply.send(toDraftResponse(draft));
  });

  // PUT /drafts/:id - Update draft
  app.put("/drafts/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const existing = await prisma.draft.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "draft_not_found" });
    }

    const { partyId, subject, toAddresses, bodyText, bodyHtml, templateId, metadata } =
      req.body as {
        partyId?: number | null;
        subject?: string | null;
        toAddresses?: string[];
        bodyText?: string;
        bodyHtml?: string | null;
        templateId?: number | null;
        metadata?: any;
      };

    const updateData: any = {};

    if (partyId !== undefined) updateData.partyId = partyId;
    if (subject !== undefined) updateData.subject = subject;
    if (toAddresses !== undefined) updateData.toAddresses = toAddresses;
    if (bodyText !== undefined) updateData.bodyText = bodyText;
    if (bodyHtml !== undefined) updateData.bodyHtml = bodyHtml;
    if (templateId !== undefined) updateData.templateId = templateId;
    if (metadata !== undefined) updateData.metadata = metadata;

    const updated = await prisma.draft.update({
      where: { id },
      data: updateData,
      include: { party: { select: { id: true, name: true } } },
    });

    return reply.send(toDraftResponse(updated));
  });

  // DELETE /drafts/:id - Delete draft
  app.delete("/drafts/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const existing = await prisma.draft.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "draft_not_found" });
    }

    await prisma.draft.delete({ where: { id } });

    return reply.send({ success: true });
  });

  // POST /drafts/:id/send - Convert draft to sent message/email
  app.post("/drafts/:id/send", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const draft = await prisma.draft.findFirst({
      where: { id, tenantId },
      include: { party: { select: { id: true, name: true, email: true } } },
    });

    if (!draft) {
      return reply.code(404).send({ error: "draft_not_found" });
    }

    if (draft.channel === "dm") {
      // For DM drafts, we need a partyId to send to
      if (!draft.partyId) {
        return reply.code(400).send({
          error: "missing_recipient",
          message: "DM drafts require a partyId to send",
        });
      }

      // Get the org party to send from
      const tenantOrg = await prisma.organization.findFirst({
        where: { tenantId },
        select: { partyId: true },
      });

      if (!tenantOrg) {
        return reply.code(400).send({ error: "org_not_found" });
      }

      // Check if thread exists between org and party
      const existingThread = await prisma.messageThread.findFirst({
        where: {
          tenantId,
          participants: {
            every: {
              partyId: { in: [tenantOrg.partyId, draft.partyId] },
            },
          },
        },
        select: { id: true },
      });

      const now = new Date();

      if (existingThread) {
        // Add message to existing thread
        await prisma.message.create({
          data: {
            threadId: existingThread.id,
            senderPartyId: tenantOrg.partyId,
            body: draft.bodyText,
          },
        });

        await prisma.messageThread.update({
          where: { id: existingThread.id },
          data: { lastMessageAt: now, updatedAt: now },
        });

        // Delete the draft
        await prisma.draft.delete({ where: { id } });

        return reply.send({
          ok: true,
          channel: "dm",
          threadId: existingThread.id,
        });
      } else {
        // Create new thread
        const thread = await prisma.messageThread.create({
          data: {
            tenantId,
            subject: draft.subject,
            lastMessageAt: now,
            participants: {
              create: [
                { partyId: tenantOrg.partyId, lastReadAt: now },
                { partyId: draft.partyId },
              ],
            },
            messages: {
              create: {
                senderPartyId: tenantOrg.partyId,
                body: draft.bodyText,
              },
            },
          },
        });

        // Delete the draft
        await prisma.draft.delete({ where: { id } });

        return reply.send({
          ok: true,
          channel: "dm",
          threadId: thread.id,
        });
      }
    } else if (draft.channel === "email") {
      // For email drafts, require either partyId or toAddresses
      const toAddress = draft.party?.email || draft.toAddresses[0];

      if (!toAddress) {
        return reply.code(400).send({
          error: "missing_recipient",
          message: "Email drafts require a recipient email address",
        });
      }

      // Get the org for from address
      const tenantOrg = await prisma.organization.findFirst({
        where: { tenantId },
        include: { party: { select: { email: true, name: true } } },
      });

      if (!tenantOrg?.party?.email) {
        return reply.code(400).send({ error: "org_email_not_configured" });
      }

      // TODO: Integrate with email sending service
      // For now, create EmailSendLog entry
      const emailLog = await prisma.emailSendLog.create({
        data: {
          tenantId,
          to: toAddress,
          from: tenantOrg.party.email,
          subject: draft.subject || "(No subject)",
          partyId: draft.partyId,
          status: "queued",
          templateId: draft.templateId,
          metadata: draft.metadata ?? undefined,
        },
      });

      // Delete the draft
      await prisma.draft.delete({ where: { id } });

      return reply.send({
        ok: true,
        channel: "email",
        emailLogId: emailLog.id,
      });
    }

    return reply.code(400).send({ error: "invalid_channel" });
  });
};

export default routes;
