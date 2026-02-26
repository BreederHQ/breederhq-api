// src/routes/auto-replies.ts
// Auto-reply rule CRUD endpoints matching frontend SDK expectations

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { Prisma, TemplateChannel, AutoReplyTriggerType, AutoReplyRuleStatus } from "@prisma/client";
import { validateTemplate } from "../services/template-renderer.js";

/**
 * Frontend channel type
 */
type FrontendChannel = "email" | "dm";

/**
 * Frontend trigger type
 */
type FrontendTrigger = "email_received" | "time_based" | "keyword_match" | "business_hours";

/**
 * Frontend status type
 */
type FrontendStatus = "active" | "paused" | "archived";

/**
 * Map frontend channel to backend TemplateChannel
 */
function mapChannelToBackend(channel: FrontendChannel): TemplateChannel {
  return channel as TemplateChannel; // Same values for now
}

/**
 * Map frontend trigger to backend AutoReplyTriggerType
 */
function mapTriggerToBackend(trigger: FrontendTrigger): AutoReplyTriggerType {
  return trigger as AutoReplyTriggerType;
}

/**
 * Map frontend status to backend AutoReplyRuleStatus
 */
function mapStatusToBackend(status: FrontendStatus): AutoReplyRuleStatus {
  return status as AutoReplyRuleStatus;
}

/**
 * Transform backend AutoReplyRule to frontend shape
 */
function toFrontendRule(rule: any): any {
  return {
    id: rule.id,
    tenantId: rule.tenantId,
    name: rule.name,
    description: rule.description || undefined,
    channel: rule.channel as FrontendChannel,
    trigger: rule.triggerType as FrontendTrigger,
    status: rule.status as FrontendStatus,
    templateId: rule.templateId,
    templateName: rule.template?.name || undefined,
    keywordConfig: rule.keywordConfigJson || undefined,
    timeBasedConfig: rule.timeBasedConfigJson || undefined,
    businessHoursConfig: rule.businessHoursJson || undefined,
    executionCount: rule.executionCount || 0,
    lastExecutedAt: rule.lastExecutedAt?.toISOString() || undefined,
    createdAt: rule.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: rule.updatedAt?.toISOString() || new Date().toISOString(),
    createdByUserId: rule.createdByPartyId || undefined,
  };
}

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /auto-replies - List rules with filtering
  app.get("/auto-replies", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { channel, trigger, status, q, limit, offset } = req.query as any;

    const where: any = { tenantId };

    // Filter by channel
    if (channel && channel !== "all") {
      where.channel = mapChannelToBackend(channel);
    }

    // Filter by trigger type
    if (trigger && trigger !== "all") {
      where.triggerType = mapTriggerToBackend(trigger);
    }

    // Filter by status
    if (status && status !== "all") {
      where.status = mapStatusToBackend(status);
    } else {
      // By default, exclude archived rules
      where.status = { in: ["active", "paused"] };
    }

    // Search by name, description, or template name
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { template: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const take = limit ? Number(limit) : 100;
    const skip = offset ? Number(offset) : 0;

    try {
      const [rules, total] = await Promise.all([
        prisma.autoReplyRule.findMany({
          where,
          include: { template: true },
          orderBy: { updatedAt: "desc" },
          take,
          skip,
        }),
        prisma.autoReplyRule.count({ where }),
      ]);

      return reply.send({
        items: rules.map(toFrontendRule),
        total,
      });
    } catch (err) {
      console.error("Error listing auto-reply rules:", err);
      return reply.code(500).send({ error: "failed_to_list_rules" });
    }
  });

  // GET /auto-replies/:id - Get single rule
  app.get("/auto-replies/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    try {
      const rule = await prisma.autoReplyRule.findFirst({
        where: { id, tenantId },
        include: { template: true },
      });

      if (!rule) {
        return reply.code(404).send({ error: "rule_not_found" });
      }

      return reply.send(toFrontendRule(rule));
    } catch (err) {
      console.error("Error fetching auto-reply rule:", err);
      return reply.code(500).send({ error: "failed_to_fetch_rule" });
    }
  });

  // POST /auto-replies - Create rule
  app.post("/auto-replies", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const {
      name,
      description,
      channel,
      trigger,
      status,
      templateId,
      keywordConfig,
      timeBasedConfig,
      businessHoursConfig,
    } = req.body as any;

    // Validate required fields
    if (!name || !channel || !trigger || !templateId) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["name", "channel", "trigger", "templateId"],
      });
    }

    // Validate channel
    if (!["email", "dm"].includes(channel)) {
      return reply.code(400).send({
        error: "invalid_channel",
        allowed: ["email", "dm"],
      });
    }

    // Validate trigger
    if (!["email_received", "time_based", "keyword_match", "business_hours"].includes(trigger)) {
      return reply.code(400).send({
        error: "invalid_trigger",
        allowed: ["email_received", "time_based", "keyword_match", "business_hours"],
      });
    }

    // Validate template exists
    const template = await prisma.template.findFirst({
      where: { id: Number(templateId), tenantId },
    });

    if (!template) {
      return reply.code(404).send({ error: "template_not_found" });
    }

    // Validate trigger-specific config
    if (trigger === "keyword_match" && !keywordConfig) {
      return reply.code(400).send({
        error: "missing_keyword_config",
        detail: "keyword_match trigger requires keywordConfig",
      });
    }

    if (trigger === "time_based" && !timeBasedConfig) {
      return reply.code(400).send({
        error: "missing_time_config",
        detail: "time_based trigger requires timeBasedConfig",
      });
    }

    if (trigger === "business_hours" && !businessHoursConfig) {
      return reply.code(400).send({
        error: "missing_business_hours_config",
        detail: "business_hours trigger requires businessHoursConfig",
      });
    }

    try {
      const rule = await prisma.autoReplyRule.create({
        data: {
          tenantId,
          name,
          description: description || null,
          channel: mapChannelToBackend(channel),
          triggerType: mapTriggerToBackend(trigger),
          status: status ? mapStatusToBackend(status) : "active",
          templateId: Number(templateId),
          keywordConfigJson: keywordConfig || null,
          timeBasedConfigJson: timeBasedConfig || null,
          businessHoursJson: businessHoursConfig || null,
          executionCount: 0,
          enabled: true, // Legacy field
        },
        include: { template: true },
      });

      return reply.send(toFrontendRule(rule));
    } catch (err) {
      console.error("Error creating auto-reply rule:", err);
      return reply.code(500).send({ error: "failed_to_create_rule" });
    }
  });

  // PATCH /auto-replies/:id - Update rule
  app.patch("/auto-replies/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const existing = await prisma.autoReplyRule.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "rule_not_found" });
    }

    const {
      name,
      description,
      channel,
      status,
      templateId,
      keywordConfig,
      timeBasedConfig,
      businessHoursConfig,
    } = req.body as any;

    // Validate template if provided
    if (templateId) {
      const template = await prisma.template.findFirst({
        where: { id: Number(templateId), tenantId },
      });

      if (!template) {
        return reply.code(404).send({ error: "template_not_found" });
      }
    }

    try {
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description || null;
      if (channel !== undefined) updateData.channel = mapChannelToBackend(channel);
      if (status !== undefined) {
        updateData.status = mapStatusToBackend(status);
        updateData.enabled = status === "active"; // Keep legacy field in sync
      }
      if (templateId !== undefined) updateData.templateId = Number(templateId);
      if (keywordConfig !== undefined) updateData.keywordConfigJson = keywordConfig;
      if (timeBasedConfig !== undefined) updateData.timeBasedConfigJson = timeBasedConfig;
      if (businessHoursConfig !== undefined) updateData.businessHoursJson = businessHoursConfig;

      // tenant-verified above via findFirst({ where: { id, tenantId } })
      const updated = await prisma.autoReplyRule.update({
        where: { id },
        data: updateData,
        include: { template: true },
      });

      return reply.send(toFrontendRule(updated));
    } catch (err) {
      console.error("Error updating auto-reply rule:", err);
      return reply.code(500).send({ error: "failed_to_update_rule" });
    }
  });

  // DELETE /auto-replies/:id - Soft delete (archive)
  app.delete("/auto-replies/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const existing = await prisma.autoReplyRule.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "rule_not_found" });
    }

    try {
      // Soft delete by setting status to archived
      await prisma.autoReplyRule.updateMany({
        where: { id, tenantId },
        data: {
          status: "archived",
          enabled: false, // Keep legacy field in sync
        },
      });

      return reply.send({ success: true });
    } catch (err) {
      console.error("Error deleting auto-reply rule:", err);
      return reply.code(500).send({ error: "failed_to_delete_rule" });
    }
  });

  // POST /auto-replies/:id/pause - Quick pause
  app.post("/auto-replies/:id/pause", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const existing = await prisma.autoReplyRule.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "rule_not_found" });
    }

    try {
      // tenant-verified above via findFirst({ where: { id, tenantId } })
      const updated = await prisma.autoReplyRule.update({
        where: { id },
        data: {
          status: "paused",
          enabled: false, // Keep legacy field in sync
        },
        include: { template: true },
      });

      return reply.send(toFrontendRule(updated));
    } catch (err) {
      console.error("Error pausing auto-reply rule:", err);
      return reply.code(500).send({ error: "failed_to_pause_rule" });
    }
  });

  // POST /auto-replies/:id/activate - Quick activate
  app.post("/auto-replies/:id/activate", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const existing = await prisma.autoReplyRule.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "rule_not_found" });
    }

    try {
      // tenant-verified above via findFirst({ where: { id, tenantId } })
      const updated = await prisma.autoReplyRule.update({
        where: { id },
        data: {
          status: "active",
          enabled: true, // Keep legacy field in sync
        },
        include: { template: true },
      });

      return reply.send(toFrontendRule(updated));
    } catch (err) {
      console.error("Error activating auto-reply rule:", err);
      return reply.code(500).send({ error: "failed_to_activate_rule" });
    }
  });

  // POST /auto-replies/:id/test - Test rule
  app.post("/auto-replies/:id/test", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);
    const { testContent } = req.body as any;

    const rule = await prisma.autoReplyRule.findFirst({
      where: { id, tenantId },
      include: { template: { include: { content: true } } },
    });

    if (!rule) {
      return reply.code(404).send({ error: "rule_not_found" });
    }

    try {
      let wouldTrigger = false;
      let reason = "";
      let previewResponse = "";

      // Evaluate trigger conditions
      switch (rule.triggerType) {
        case "email_received":
          wouldTrigger = true;
          reason = "Rule triggers on every message received";
          break;

        case "keyword_match":
          if (testContent && rule.keywordConfigJson) {
            const config = rule.keywordConfigJson as any;
            const keywords = config.keywords || [];
            const matchType = config.matchType || "any";
            const caseSensitive = config.caseSensitive || false;

            const testText = caseSensitive ? testContent : testContent.toLowerCase();
            const matches = keywords.filter((keyword: string) => {
              const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();
              return testText.includes(searchKeyword);
            });

            if (matchType === "any") {
              wouldTrigger = matches.length > 0;
              reason = wouldTrigger
                ? `Matched keyword(s): ${matches.join(", ")}`
                : "No keywords matched in test content";
            } else {
              // matchType === "all"
              wouldTrigger = matches.length === keywords.length;
              reason = wouldTrigger
                ? "All keywords matched"
                : `Only ${matches.length} of ${keywords.length} keywords matched`;
            }
          } else {
            wouldTrigger = false;
            reason = "No test content provided for keyword matching";
          }
          break;

        case "time_based":
          if (rule.timeBasedConfigJson) {
            const config = rule.timeBasedConfigJson as any;
            const now = new Date();
            const start = new Date(config.startDate);
            const end = new Date(config.endDate);

            wouldTrigger = now >= start && now <= end;
            reason = wouldTrigger
              ? `Current date is within range (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`
              : `Current date is outside range (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`;
          } else {
            wouldTrigger = false;
            reason = "No time-based configuration found";
          }
          break;

        case "business_hours":
          if (rule.businessHoursJson) {
            const config = rule.businessHoursJson as any;
            const now = new Date();
            const dayOfWeek = now.getDay();
            const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

            const isWorkingDay = (config.workingDays || []).includes(dayOfWeek);
            const workingStart = config.workingHours?.start || "09:00";
            const workingEnd = config.workingHours?.end || "17:00";

            const isDuringWorkingHours =
              currentTime >= workingStart && currentTime < workingEnd;

            // Triggers when OUTSIDE business hours
            wouldTrigger = !isWorkingDay || !isDuringWorkingHours;
            reason = wouldTrigger
              ? "Current time is outside business hours"
              : "Current time is during business hours";
          } else {
            wouldTrigger = false;
            reason = "No business hours configuration found";
          }
          break;

        default:
          wouldTrigger = false;
          reason = `Unknown trigger type: ${rule.triggerType}`;
      }

      // Generate preview response if would trigger
      if (wouldTrigger && rule.template?.content?.[0]) {
        const content = rule.template.content[0];
        previewResponse = content.bodyText || "";

        // Simple variable substitution ({{variable}} -> [variable])
        previewResponse = previewResponse.replace(/\{\{(\w+)\}\}/g, "[$1]");
      }

      return reply.send({
        wouldTrigger,
        reason,
        previewResponse: previewResponse || undefined,
      });
    } catch (err) {
      console.error("Error testing auto-reply rule:", err);
      return reply.code(500).send({ error: "failed_to_test_rule" });
    }
  });
};

export default routes;
