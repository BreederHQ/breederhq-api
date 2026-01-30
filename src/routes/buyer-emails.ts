// src/routes/buyer-emails.ts
// Buyer CRM email routes (P5) - Templates and sending
//
// Email Templates
// GET    /api/v1/buyer-email-templates           - List templates
// POST   /api/v1/buyer-email-templates           - Create template
// GET    /api/v1/buyer-email-templates/:id       - Get template
// PATCH  /api/v1/buyer-email-templates/:id       - Update template
// DELETE /api/v1/buyer-email-templates/:id       - Delete template
//
// Sending Emails
// POST   /api/v1/buyers/:buyerId/emails          - Send email to buyer
// POST   /api/v1/buyers/:buyerId/emails/template - Send email using template
// GET    /api/v1/buyers/:buyerId/emails          - Get email history

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import type { BuyerEmailTemplateCategory } from "@prisma/client";
import {
  sendBuyerEmail,
  sendBuyerEmailWithTemplate,
  getBuyerEmailTemplates,
  createBuyerEmailTemplate,
  updateBuyerEmailTemplate,
  deleteBuyerEmailTemplate,
  getBuyerEmailHistory,
  renderTemplate,
  getBuyerWithParty,
} from "../services/buyer-email-service.js";

// ───────────────────────── Helpers ─────────────────────────

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function trimToNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function parsePaging(q: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(q?.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(q?.limit ?? "50"), 10) || 50));
  return { page, limit };
}

// Valid category values
const TEMPLATE_CATEGORIES: BuyerEmailTemplateCategory[] = [
  "GENERAL",
  "INITIAL_CONTACT",
  "FOLLOW_UP",
  "VIEWING",
  "NEGOTIATION",
  "CLOSING",
];

function isValidCategory(v: unknown): v is BuyerEmailTemplateCategory {
  return typeof v === "string" && TEMPLATE_CATEGORIES.includes(v as BuyerEmailTemplateCategory);
}

// ───────────────────────── Routes ─────────────────────────

const buyerEmailsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────
  // EMAIL TEMPLATES
  // ─────────────────────────────────────────────────────────

  // GET /buyer-email-templates - List templates
  app.get("/buyer-email-templates", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const query = req.query as Record<string, unknown>;
      const category = query.category as string | undefined;
      const activeOnly = query.activeOnly !== "false";

      const templates = await getBuyerEmailTemplates(tenantId, {
        category: category && isValidCategory(category) ? category : undefined,
        activeOnly,
      });

      return reply.send({ items: templates, total: templates.length });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to list email templates");
      return reply.code(500).send({ error: "list_templates_failed" });
    }
  });

  // POST /buyer-email-templates - Create template
  app.post("/buyer-email-templates", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const body = req.body as Record<string, unknown>;
      const name = trimToNull(body.name);
      const subject = trimToNull(body.subject);
      const bodyHtml = trimToNull(body.bodyHtml);
      const bodyText = trimToNull(body.bodyText);
      const category = body.category as string | undefined;

      if (!name) return reply.code(400).send({ error: "name_required" });
      if (!subject) return reply.code(400).send({ error: "subject_required" });
      if (!bodyHtml) return reply.code(400).send({ error: "body_html_required" });
      if (!bodyText) return reply.code(400).send({ error: "body_text_required" });

      const template = await createBuyerEmailTemplate({
        tenantId,
        name,
        subject,
        bodyHtml,
        bodyText,
        category: category && isValidCategory(category) ? category : undefined,
      });

      return reply.code(201).send({ template });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to create email template");
      return reply.code(500).send({ error: "create_template_failed" });
    }
  });

  // GET /buyer-email-templates/:id - Get template
  app.get("/buyer-email-templates/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const templateId = toNum((req.params as any).id);
      if (!templateId) return reply.code(400).send({ error: "invalid_template_id" });

      const template = await prisma.buyerEmailTemplate.findFirst({
        where: { id: templateId, tenantId },
      });

      if (!template) {
        return reply.code(404).send({ error: "template_not_found" });
      }

      return reply.send({ template });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get email template");
      return reply.code(500).send({ error: "get_template_failed" });
    }
  });

  // PATCH /buyer-email-templates/:id - Update template
  app.patch("/buyer-email-templates/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const templateId = toNum((req.params as any).id);
      if (!templateId) return reply.code(400).send({ error: "invalid_template_id" });

      const body = req.body as Record<string, unknown>;
      const updates: Parameters<typeof updateBuyerEmailTemplate>[2] = {};

      if ("name" in body) {
        const name = trimToNull(body.name);
        if (!name) return reply.code(400).send({ error: "name_cannot_be_empty" });
        updates.name = name;
      }

      if ("subject" in body) {
        const subject = trimToNull(body.subject);
        if (!subject) return reply.code(400).send({ error: "subject_cannot_be_empty" });
        updates.subject = subject;
      }

      if ("bodyHtml" in body) {
        const bodyHtml = trimToNull(body.bodyHtml);
        if (!bodyHtml) return reply.code(400).send({ error: "body_html_cannot_be_empty" });
        updates.bodyHtml = bodyHtml;
      }

      if ("bodyText" in body) {
        const bodyText = trimToNull(body.bodyText);
        if (!bodyText) return reply.code(400).send({ error: "body_text_cannot_be_empty" });
        updates.bodyText = bodyText;
      }

      if ("category" in body && isValidCategory(body.category)) {
        updates.category = body.category;
      }

      if ("isActive" in body) {
        updates.isActive = Boolean(body.isActive);
      }

      if ("sortOrder" in body) {
        updates.sortOrder = Number(body.sortOrder) || 0;
      }

      const template = await updateBuyerEmailTemplate(tenantId, templateId, updates);

      return reply.send({ template });
    } catch (err: any) {
      if (err.code === "P2025") {
        return reply.code(404).send({ error: "template_not_found" });
      }
      req.log?.error?.({ err }, "Failed to update email template");
      return reply.code(500).send({ error: "update_template_failed" });
    }
  });

  // DELETE /buyer-email-templates/:id - Delete template
  app.delete("/buyer-email-templates/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const templateId = toNum((req.params as any).id);
      if (!templateId) return reply.code(400).send({ error: "invalid_template_id" });

      await deleteBuyerEmailTemplate(tenantId, templateId);

      return reply.send({ ok: true });
    } catch (err: any) {
      if (err.code === "P2025") {
        return reply.code(404).send({ error: "template_not_found" });
      }
      req.log?.error?.({ err }, "Failed to delete email template");
      return reply.code(500).send({ error: "delete_template_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // PREVIEW TEMPLATE
  // ─────────────────────────────────────────────────────────

  // POST /buyer-email-templates/:id/preview - Preview template with variables
  app.post("/buyer-email-templates/:id/preview", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const templateId = toNum((req.params as any).id);
      if (!templateId) return reply.code(400).send({ error: "invalid_template_id" });

      const body = req.body as Record<string, unknown>;
      const buyerId = toNum(body.buyerId);
      const customVariables = (body.variables as Record<string, string>) || {};

      const template = await prisma.buyerEmailTemplate.findFirst({
        where: { id: templateId, tenantId },
      });

      if (!template) {
        return reply.code(404).send({ error: "template_not_found" });
      }

      // Build variables
      let variables: Record<string, string> = { ...customVariables };

      // If buyerId provided, get buyer info for variables
      if (buyerId) {
        const buyer = await getBuyerWithParty(tenantId, buyerId);
        if (buyer) {
          variables = {
            buyerName: buyer.party.name || "",
            buyerEmail: buyer.party.email || "",
            ...customVariables,
          };
        }
      }

      // Get org info
      const tenantOrg = await prisma.organization.findFirst({
        where: { tenantId },
        include: { party: { select: { name: true } } },
      });

      if (tenantOrg?.party?.name) {
        variables.orgName = tenantOrg.party.name;
        variables.breederName = tenantOrg.party.name;
      }

      // Render template
      const rendered = renderTemplate({
        template: {
          subject: template.subject,
          bodyHtml: template.bodyHtml,
          bodyText: template.bodyText,
        },
        variables,
      });

      return reply.send({
        preview: rendered,
        variables,
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to preview template");
      return reply.code(500).send({ error: "preview_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // SEND EMAILS TO BUYERS
  // ─────────────────────────────────────────────────────────

  // POST /buyers/:buyerId/emails - Send email to buyer (custom content)
  app.post("/buyers/:buyerId/emails", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const buyerId = toNum((req.params as any).buyerId);
      if (!buyerId) return reply.code(400).send({ error: "invalid_buyer_id" });

      const body = req.body as Record<string, unknown>;
      const subject = trimToNull(body.subject);
      const bodyText = trimToNull(body.bodyText);
      const bodyHtml = trimToNull(body.bodyHtml);

      if (!subject) return reply.code(400).send({ error: "subject_required" });
      if (!bodyText) return reply.code(400).send({ error: "body_text_required" });

      // Generate HTML from text if not provided
      const html = bodyHtml || `<p>${bodyText.replace(/\n/g, "<br>")}</p>`;

      // Parse follow-up task option
      let createFollowUpTask: Parameters<typeof sendBuyerEmail>[0]["createFollowUpTask"];
      if (body.createFollowUp) {
        const followUp = body.createFollowUp as Record<string, unknown>;
        createFollowUpTask = {
          daysFromNow: Number(followUp.daysFromNow || 3),
          taskType: followUp.taskType as any || "FOLLOW_UP",
          title: trimToNull(followUp.title) || undefined,
        };
      }

      const userId = (req as any).userId;

      const result = await sendBuyerEmail({
        tenantId,
        buyerId,
        subject,
        bodyHtml: html,
        bodyText,
        userId,
        createFollowUpTask,
      });

      if (!result.ok) {
        return reply.code(400).send({ error: result.error });
      }

      return reply.send({ ok: true, partyEmailId: result.partyEmailId });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to send buyer email");
      return reply.code(500).send({ error: "send_email_failed" });
    }
  });

  // POST /buyers/:buyerId/emails/template - Send email using template
  app.post("/buyers/:buyerId/emails/template", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const buyerId = toNum((req.params as any).buyerId);
      if (!buyerId) return reply.code(400).send({ error: "invalid_buyer_id" });

      const body = req.body as Record<string, unknown>;
      const templateId = toNum(body.templateId);
      if (!templateId) return reply.code(400).send({ error: "template_id_required" });

      const variables = (body.variables as Record<string, string>) || {};

      // Parse follow-up task option
      let createFollowUpTask: Parameters<typeof sendBuyerEmailWithTemplate>[0]["createFollowUpTask"];
      if (body.createFollowUp) {
        const followUp = body.createFollowUp as Record<string, unknown>;
        createFollowUpTask = {
          daysFromNow: Number(followUp.daysFromNow || 3),
          taskType: followUp.taskType as any || "FOLLOW_UP",
          title: trimToNull(followUp.title) || undefined,
        };
      }

      const userId = (req as any).userId;

      const result = await sendBuyerEmailWithTemplate({
        tenantId,
        buyerId,
        templateId,
        variables,
        userId,
        createFollowUpTask,
      });

      if (!result.ok) {
        return reply.code(400).send({ error: result.error });
      }

      return reply.send({ ok: true, partyEmailId: result.partyEmailId });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to send template email");
      return reply.code(500).send({ error: "send_template_email_failed" });
    }
  });

  // GET /buyers/:buyerId/emails - Get email history for buyer
  app.get("/buyers/:buyerId/emails", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const buyerId = toNum((req.params as any).buyerId);
      if (!buyerId) return reply.code(400).send({ error: "invalid_buyer_id" });

      const query = req.query as Record<string, unknown>;
      const { page, limit } = parsePaging(query);

      const result = await getBuyerEmailHistory(tenantId, buyerId, { page, limit });

      return reply.send({
        items: result.emails,
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get buyer email history");
      return reply.code(500).send({ error: "get_emails_failed" });
    }
  });
};

export default buyerEmailsRoutes;
