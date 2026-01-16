// src/routes/contract-templates.ts
/**
 * Contract Templates API
 *
 * Endpoints for managing contract templates:
 * - List system + custom templates
 * - Create/update custom templates (Pro tier only)
 * - Preview templates with sample data
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { checkEntitlement } from "../services/subscription/entitlement-service.js";
import {
  validateContractTemplate,
  previewContractTemplate,
  CONTRACT_MERGE_FIELDS,
} from "../services/contracts/index.js";

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /contract-templates
   * List all available contract templates (system + custom for this tenant)
   */
  app.get("/contract-templates", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { category, type, isActive } = req.query as any;

    const where: any = {
      OR: [
        { tenantId: null, type: "SYSTEM" }, // System templates (available to all)
        { tenantId, isActive: true }, // Tenant's custom templates
      ],
    };

    // Filter by category
    if (category) {
      where.category = category;
    }

    // Filter by type (SYSTEM or CUSTOM)
    if (type) {
      where.type = type;
      // If filtering by type, adjust the OR clause
      if (type === "SYSTEM") {
        delete where.OR;
        where.tenantId = null;
        where.type = "SYSTEM";
      } else if (type === "CUSTOM") {
        delete where.OR;
        where.tenantId = tenantId;
        where.type = "CUSTOM";
      }
    }

    // Filter by active status
    if (isActive !== undefined) {
      const isActiveVal = isActive === true || isActive === "true";
      if (type !== "SYSTEM") {
        // System templates are always active
        where.isActive = isActiveVal;
      }
    }

    const templates = await prisma.contractTemplate.findMany({
      where,
      select: {
        id: true,
        tenantId: true,
        name: true,
        slug: true,
        type: true,
        category: true,
        description: true,
        version: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ type: "asc" }, { category: "asc" }, { name: "asc" }],
    });

    return reply.send({ items: templates });
  });

  /**
   * GET /contract-templates/merge-fields
   * Get all available merge field definitions
   */
  app.get("/contract-templates/merge-fields", async (req, reply) => {
    // Group merge fields by namespace
    const grouped: Record<string, typeof CONTRACT_MERGE_FIELDS> = {};

    for (const field of CONTRACT_MERGE_FIELDS) {
      if (!grouped[field.namespace]) {
        grouped[field.namespace] = [];
      }
      grouped[field.namespace].push(field);
    }

    return reply.send({
      fields: CONTRACT_MERGE_FIELDS,
      grouped,
    });
  });

  /**
   * GET /contract-templates/:id
   * Get single template with full content
   */
  app.get<{ Params: { id: string } }>("/contract-templates/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const templateId = parseInt(req.params.id, 10);
    if (isNaN(templateId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const template = await prisma.contractTemplate.findFirst({
      where: {
        id: templateId,
        OR: [
          { tenantId: null, type: "SYSTEM" },
          { tenantId },
        ],
      },
    });

    if (!template) {
      return reply.code(404).send({ error: "not_found" });
    }

    return reply.send(template);
  });

  /**
   * POST /contract-templates
   * Create a custom contract template (Pro tier only)
   */
  app.post("/contract-templates", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    const userId = (req as any).userId as string;
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    // Check Pro entitlement
    const entitlement = await checkEntitlement(tenantId, "E_SIGNATURES");
    if (!entitlement.hasAccess) {
      return reply.code(403).send({
        error: "upgrade_required",
        message: "E-Signatures require a paid subscription",
      });
    }

    // Check if Pro tier (can create custom templates)
    // limitValue >= 2 or null = Pro tier
    const isPro =
      entitlement.limitValue === null ||
      entitlement.limitValue === undefined ||
      entitlement.limitValue >= 2;

    if (!isPro) {
      return reply.code(403).send({
        error: "upgrade_required",
        message: "Custom contract templates require a Pro subscription",
      });
    }

    const { name, category, description, bodyHtml, bodyJson, mergeFields } = req.body as any;

    if (!name || !bodyHtml) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Name and bodyHtml are required",
      });
    }

    // Validate template content
    const validation = validateContractTemplate(bodyHtml);
    if (!validation.valid) {
      return reply.code(400).send({
        error: "invalid_template",
        details: validation.errors,
        warnings: validation.warnings,
      });
    }

    const template = await prisma.contractTemplate.create({
      data: {
        tenantId,
        name,
        type: "CUSTOM",
        category: category || "CUSTOM",
        description,
        bodyHtml,
        bodyJson,
        mergeFields: mergeFields || validation.foundFields.map((key) => ({ key })),
        createdByUserId: userId,
        version: 1,
        isActive: true,
      },
    });

    return reply.code(201).send(template);
  });

  /**
   * PATCH /contract-templates/:id
   * Update a custom contract template (Pro tier only, custom templates only)
   */
  app.patch<{ Params: { id: string } }>("/contract-templates/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const templateId = parseInt(req.params.id, 10);
    if (isNaN(templateId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    // Check Pro entitlement
    const entitlement = await checkEntitlement(tenantId, "E_SIGNATURES");
    const isPro =
      entitlement.hasAccess &&
      (entitlement.limitValue === null ||
        entitlement.limitValue === undefined ||
        entitlement.limitValue >= 2);

    if (!isPro) {
      return reply.code(403).send({
        error: "upgrade_required",
        message: "Custom contract templates require a Pro subscription",
      });
    }

    // Find the template
    const existing = await prisma.contractTemplate.findFirst({
      where: {
        id: templateId,
        tenantId, // Must be owned by this tenant
        type: "CUSTOM", // Can only edit custom templates
      },
    });

    if (!existing) {
      return reply.code(404).send({
        error: "not_found",
        message: "Template not found or cannot be edited",
      });
    }

    const { name, category, description, bodyHtml, bodyJson, mergeFields, isActive } =
      req.body as any;

    // Validate template content if bodyHtml is being updated
    if (bodyHtml) {
      const validation = validateContractTemplate(bodyHtml);
      if (!validation.valid) {
        return reply.code(400).send({
          error: "invalid_template",
          details: validation.errors,
          warnings: validation.warnings,
        });
      }
    }

    const template = await prisma.contractTemplate.update({
      where: { id: templateId },
      data: {
        name: name ?? existing.name,
        category: category ?? existing.category,
        description: description !== undefined ? description : existing.description,
        bodyHtml: bodyHtml ?? existing.bodyHtml,
        bodyJson: bodyJson !== undefined ? bodyJson : existing.bodyJson,
        mergeFields: mergeFields !== undefined ? mergeFields : existing.mergeFields,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        version: bodyHtml ? existing.version + 1 : existing.version, // Increment version on content change
      },
    });

    return reply.send(template);
  });

  /**
   * DELETE /contract-templates/:id
   * Soft delete a custom contract template (sets isActive = false)
   */
  app.delete<{ Params: { id: string } }>("/contract-templates/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const templateId = parseInt(req.params.id, 10);
    if (isNaN(templateId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    // Find the template
    const existing = await prisma.contractTemplate.findFirst({
      where: {
        id: templateId,
        tenantId,
        type: "CUSTOM", // Can only delete custom templates
      },
    });

    if (!existing) {
      return reply.code(404).send({
        error: "not_found",
        message: "Template not found or cannot be deleted",
      });
    }

    // Soft delete
    await prisma.contractTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    });

    return reply.code(204).send();
  });

  /**
   * POST /contract-templates/:id/preview
   * Preview a template with sample data
   */
  app.post<{ Params: { id: string } }>("/contract-templates/:id/preview", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const templateId = parseInt(req.params.id, 10);
    if (isNaN(templateId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const template = await prisma.contractTemplate.findFirst({
      where: {
        id: templateId,
        OR: [{ tenantId: null, type: "SYSTEM" }, { tenantId }],
      },
    });

    if (!template) {
      return reply.code(404).send({ error: "not_found" });
    }

    if (!template.bodyHtml) {
      return reply.code(400).send({
        error: "no_content",
        message: "Template has no content to preview",
      });
    }

    const preview = previewContractTemplate(template.bodyHtml);

    return reply.send({
      templateId,
      templateName: template.name,
      ...preview,
    });
  });

  /**
   * POST /contract-templates/preview
   * Preview arbitrary template content (for live editor preview)
   */
  app.post("/contract-templates/preview", async (req, reply) => {
    const { bodyHtml } = req.body as any;

    if (!bodyHtml) {
      return reply.code(400).send({
        error: "validation_error",
        message: "bodyHtml is required",
      });
    }

    const preview = previewContractTemplate(bodyHtml);

    return reply.send(preview);
  });
};

export default routes;
