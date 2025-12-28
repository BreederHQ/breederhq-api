// src/routes/marketing.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { sendEmail } from "../services/email-service.js";
import { validateTemplate } from "../services/template-renderer.js";
import prisma from "../prisma.js";

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /marketing/templates - List templates
  app.get("/marketing/templates", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { channel, status, category } = req.query as any;

    const where: any = { tenantId };
    if (channel) where.channel = channel;
    if (status) where.status = status;
    if (category) where.category = category;

    const templates = await prisma.template.findMany({
      where,
      include: { content: true },
      orderBy: { updatedAt: "desc" },
    });

    return reply.send({ templates });
  });

  // POST /marketing/templates - Create template
  app.post("/marketing/templates", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const {
      name,
      key,
      channel,
      category,
      status,
      description,
      subject,
      bodyText,
      bodyHtml,
      metadataJson,
      createdByPartyId,
    } = req.body as any;

    if (!name || !channel || !category || !bodyText) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["name", "channel", "category", "bodyText"],
      });
    }

    const validation = await validateTemplate({ subject, bodyText, bodyHtml });
    if (!validation.valid) {
      return reply.code(400).send({ error: "invalid_template", details: validation.errors });
    }

    if (key) {
      const existing = await prisma.template.findUnique({
        where: { tenantId_key: { tenantId, key } },
      });
      if (existing) {
        return reply.code(409).send({ error: "template_key_exists" });
      }
    }

    const template = await prisma.template.create({
      data: {
        tenantId,
        name,
        key,
        channel,
        category,
        status: status || "draft",
        description,
        createdByPartyId,
        content: {
          create: {
            subject,
            bodyText,
            bodyHtml,
            metadataJson,
          },
        },
      },
      include: { content: true },
    });

    return reply.send({ template });
  });

  // PUT /marketing/templates/:id - Update template
  app.put("/marketing/templates/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const existing = await prisma.template.findFirst({
      where: { id, tenantId },
      include: { content: true },
    });

    if (!existing) {
      return reply.code(404).send({ error: "template_not_found" });
    }

    const { name, status, description, subject, bodyText, bodyHtml, metadataJson } = req.body as any;

    if (bodyText !== undefined || bodyHtml !== undefined || subject !== undefined) {
      const validation = await validateTemplate({
        subject: subject !== undefined ? subject : existing.content[0]?.subject,
        bodyText: bodyText !== undefined ? bodyText : existing.content[0]?.bodyText,
        bodyHtml: bodyHtml !== undefined ? bodyHtml : existing.content[0]?.bodyHtml,
      });
      if (!validation.valid) {
        return reply.code(400).send({ error: "invalid_template", details: validation.errors });
      }
    }

    const template = await prisma.template.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(status && { status }),
        ...(description !== undefined && { description }),
      },
      include: { content: true },
    });

    if (
      subject !== undefined ||
      bodyText !== undefined ||
      bodyHtml !== undefined ||
      metadataJson !== undefined
    ) {
      if (existing.content[0]) {
        await prisma.templateContent.update({
          where: { id: existing.content[0].id },
          data: {
            ...(subject !== undefined && { subject }),
            ...(bodyText !== undefined && { bodyText }),
            ...(bodyHtml !== undefined && { bodyHtml }),
            ...(metadataJson !== undefined && { metadataJson }),
          },
        });
      }
    }

    const updated = await prisma.template.findUnique({
      where: { id },
      include: { content: true },
    });

    return reply.send({ template: updated });
  });

  // DELETE /marketing/templates/:id - Soft delete (archive)
  app.delete("/marketing/templates/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const existing = await prisma.template.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "template_not_found" });
    }

    await prisma.template.update({
      where: { id },
      data: { status: "archived" },
    });

    return reply.send({ ok: true });
  });

  // GET /marketing/auto-reply-rules - List auto-reply rules
  app.get("/marketing/auto-reply-rules", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { channel, enabled } = req.query as any;

    const where: any = { tenantId };
    if (channel) where.channel = channel;
    if (enabled !== undefined) where.enabled = enabled === "true";

    const rules = await prisma.autoReplyRule.findMany({
      where,
      include: { template: { include: { content: true } } },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ rules });
  });

  // POST /marketing/auto-reply-rules - Create auto-reply rule
  app.post("/marketing/auto-reply-rules", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { channel, templateId, triggerType, cooldownMinutes, businessHoursJson, enabled } =
      req.body as any;

    if (!channel || !templateId || !triggerType) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["channel", "templateId", "triggerType"],
      });
    }

    const template = await prisma.template.findFirst({
      where: { id: templateId, tenantId, status: "active" },
    });

    if (!template) {
      return reply.code(400).send({ error: "invalid_template", detail: "Template must be active" });
    }

    if (template.channel !== channel) {
      return reply.code(400).send({
        error: "channel_mismatch",
        detail: "Template channel must match rule channel",
      });
    }

    const rule = await prisma.autoReplyRule.create({
      data: {
        tenantId,
        channel,
        templateId,
        triggerType,
        cooldownMinutes: cooldownMinutes || 60,
        businessHoursJson,
        enabled: enabled !== undefined ? enabled : true,
      },
      include: { template: { include: { content: true } } },
    });

    return reply.send({ rule });
  });

  // PUT /marketing/auto-reply-rules/:id - Update auto-reply rule
  app.put("/marketing/auto-reply-rules/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const existing = await prisma.autoReplyRule.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "rule_not_found" });
    }

    const { enabled, cooldownMinutes, businessHoursJson } = req.body as any;

    const rule = await prisma.autoReplyRule.update({
      where: { id },
      data: {
        ...(enabled !== undefined && { enabled }),
        ...(cooldownMinutes !== undefined && { cooldownMinutes }),
        ...(businessHoursJson !== undefined && { businessHoursJson }),
      },
      include: { template: { include: { content: true } } },
    });

    return reply.send({ rule });
  });

  // DELETE /marketing/auto-reply-rules/:id - Delete rule
  app.delete("/marketing/auto-reply-rules/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const existing = await prisma.autoReplyRule.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "rule_not_found" });
    }

    await prisma.autoReplyRule.delete({ where: { id } });

    return reply.send({ ok: true });
  });

  // POST /marketing/email/send - Send outbound email via Resend
  app.post("/marketing/email/send", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { to, subject, html, text, templateKey, metadata, category } = req.body as any;

    if (!to || !subject) {
      return reply.code(400).send({ error: "missing_required_fields", required: ["to", "subject"] });
    }

    if (!html && !text) {
      return reply.code(400).send({ error: "missing_email_body", required: "html or text" });
    }

    if (!category || (category !== "transactional" && category !== "marketing")) {
      return reply.code(400).send({ error: "invalid_category", allowed: ["transactional", "marketing"] });
    }

    try {
      const result = await sendEmail({
        tenantId,
        to,
        subject,
        html,
        text,
        templateKey,
        metadata,
        category,
      });

      if (!result.ok) {
        return reply.code(400).send({ error: result.error });
      }

      return reply.send({
        ok: true,
        messageId: result.providerMessageId,
        skipped: result.skipped,
      });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });
};

export default routes;
