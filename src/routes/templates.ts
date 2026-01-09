// src/routes/templates.ts
// Template CRUD endpoints matching frontend SDK expectations
// Maps to existing Template/TemplateContent models but with simplified API

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { validateTemplate } from "../services/template-renderer.js";
import prisma from "../prisma.js";

/**
 * Maps frontend category (email/dm/social) to backend channel enum
 */
type FrontendCategory = "email" | "dm" | "social";

/**
 * Transform backend Template + TemplateContent to frontend EmailTemplate shape
 */
function toFrontendTemplate(template: any): any {
  const content = template.content?.[0];
  return {
    id: template.id,
    tenantId: template.tenantId,
    name: template.name,
    category: template.channel as FrontendCategory, // Frontend uses "category" for channel
    subject: content?.subject || null,
    bodyText: content?.bodyText || "",
    bodyHtml: content?.bodyHtml || null,
    variables: extractVariables(content?.bodyText || "", content?.subject || ""),
    isActive: template.status === "active",
    createdAt: template.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: template.updatedAt?.toISOString() || new Date().toISOString(),
    createdByUserId: template.createdByPartyId || null,
  };
}

/**
 * Extract {{variable}} placeholders from template text
 */
function extractVariables(bodyText: string, subject: string): string[] {
  const combined = `${subject} ${bodyText}`;
  const matches = combined.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  const variables = matches.map((m) => m.replace(/\{\{|\}\}/g, ""));
  return [...new Set(variables)]; // Dedupe
}

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /templates - List templates with filtering
  app.get("/templates", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { category, q, is_active, isActive, limit, offset } = req.query as any;

    const where: any = { tenantId };

    // Map frontend "category" to backend "channel"
    if (category) {
      where.channel = category;
    }

    // Filter by active status (frontend sends isActive or is_active)
    const activeFilter = isActive ?? is_active;
    if (activeFilter !== undefined) {
      const isActiveVal = activeFilter === true || activeFilter === "true";
      where.status = isActiveVal ? "active" : { in: ["draft", "archived"] };
    } else {
      // By default, exclude archived templates
      where.status = { in: ["draft", "active"] };
    }

    // Search by name or content
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { content: { some: { subject: { contains: q, mode: "insensitive" } } } },
        { content: { some: { bodyText: { contains: q, mode: "insensitive" } } } },
      ];
    }

    const take = limit ? Number(limit) : 100;
    const skip = offset ? Number(offset) : 0;

    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        include: { content: true },
        orderBy: { updatedAt: "desc" },
        take,
        skip,
      }),
      prisma.template.count({ where }),
    ]);

    return reply.send({
      items: templates.map(toFrontendTemplate),
      total,
    });
  });

  // GET /templates/:id - Get single template
  app.get("/templates/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const template = await prisma.template.findFirst({
      where: { id, tenantId },
      include: { content: true },
    });

    if (!template) {
      return reply.code(404).send({ error: "template_not_found" });
    }

    return reply.send(toFrontendTemplate(template));
  });

  // POST /templates - Create template
  app.post("/templates", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { name, category, subject, bodyText, bodyHtml, variables } = req.body as any;

    if (!name || !category || !bodyText) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["name", "category", "bodyText"],
      });
    }

    // Validate category is valid channel
    if (!["email", "dm", "social"].includes(category)) {
      return reply.code(400).send({
        error: "invalid_category",
        allowed: ["email", "dm", "social"],
      });
    }

    // Validate template content
    const validation = await validateTemplate({ subject, bodyText, bodyHtml });
    if (!validation.valid) {
      return reply.code(400).send({ error: "invalid_template", details: validation.errors });
    }

    const template = await prisma.template.create({
      data: {
        tenantId,
        name,
        channel: category, // Map category to channel
        category: "custom", // Default backend category
        status: "active", // New templates are active by default
        content: {
          create: {
            subject: category === "email" ? subject : null,
            bodyText,
            bodyHtml: category === "email" ? bodyHtml : null,
          },
        },
      },
      include: { content: true },
    });

    return reply.send(toFrontendTemplate(template));
  });

  // PATCH /templates/:id - Update template
  app.patch("/templates/:id", async (req, reply) => {
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

    const { name, subject, bodyText, bodyHtml, isActive } = req.body as any;

    // Validate content if provided
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

    // Update template metadata
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.status = isActive ? "active" : "draft";

    await prisma.template.update({
      where: { id },
      data: updateData,
    });

    // Update content if provided
    if (
      subject !== undefined ||
      bodyText !== undefined ||
      bodyHtml !== undefined
    ) {
      if (existing.content[0]) {
        const contentUpdate: any = {};
        if (subject !== undefined) contentUpdate.subject = subject;
        if (bodyText !== undefined) contentUpdate.bodyText = bodyText;
        if (bodyHtml !== undefined) contentUpdate.bodyHtml = bodyHtml;

        await prisma.templateContent.update({
          where: { id: existing.content[0].id },
          data: contentUpdate,
        });
      }
    }

    const updated = await prisma.template.findUnique({
      where: { id },
      include: { content: true },
    });

    return reply.send(toFrontendTemplate(updated));
  });

  // DELETE /templates/:id - Soft delete (archive)
  app.delete("/templates/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const existing = await prisma.template.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "template_not_found" });
    }

    // Soft delete by setting status to archived
    await prisma.template.update({
      where: { id },
      data: { status: "archived" },
    });

    return reply.send({ success: true });
  });
};

export default routes;
