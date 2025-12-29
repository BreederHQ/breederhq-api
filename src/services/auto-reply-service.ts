// src/services/auto-reply-service.ts
// Auto-reply evaluation and execution for DM

import type { PrismaClient } from "@prisma/client";
import { renderTemplate } from "./template-renderer.js";

interface EvaluateAutoReplyParams {
  prisma: PrismaClient;
  tenantId: number;
  threadId: number;
  inboundSenderPartyId: number;
}

/**
 * Check if auto-reply cooldown is active for this party
 */
async function isCooldownActive(params: {
  prisma: PrismaClient;
  tenantId: number;
  partyId: number;
  ruleId: number;
  cooldownMinutes: number;
}): Promise<boolean> {
  const { prisma, tenantId, partyId, ruleId, cooldownMinutes } = params;

  const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);

  const recentLog = await prisma.autoReplyLog.findFirst({
    where: {
      tenantId,
      partyId,
      ruleId,
      status: "sent",
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "desc" },
  });

  return !!recentLog;
}

/**
 * Check if a human from tenant has replied in thread
 */
async function hasHumanReplied(params: {
  prisma: PrismaClient;
  threadId: number;
  tenantPartyId: number;
}): Promise<boolean> {
  const { prisma, threadId, tenantPartyId } = params;

  const tenantParty = await prisma.party.findFirst({
    where: { id: tenantPartyId, type: "ORGANIZATION" },
  });

  if (!tenantParty) return false;

  const humanMessage = await prisma.message.findFirst({
    where: {
      threadId,
      senderPartyId: tenantPartyId,
      isAutomated: false,
    },
  });

  return !!humanMessage;
}

/**
 * Check if business hours condition is met
 */
function isWithinBusinessHours(businessHoursJson?: any): boolean {
  if (!businessHoursJson) return true;

  // Placeholder: implement business hours logic if needed
  // For now, always return true
  return true;
}

/**
 * Evaluate and send auto-reply if conditions are met
 */
export async function evaluateAndSendAutoReply(
  params: EvaluateAutoReplyParams
): Promise<void> {
  const { prisma, tenantId, threadId, inboundSenderPartyId } = params;

  const thread = await prisma.messageThread.findFirst({
    where: { id: threadId, tenantId },
    include: {
      participants: true,
      messages: { orderBy: { createdAt: "asc" }, take: 5 },
    },
  });

  if (!thread) return;

  const tenantParticipant = thread.participants.find(
    (p) => p.partyId !== inboundSenderPartyId
  );
  if (!tenantParticipant) return;

  const tenantPartyId = tenantParticipant.partyId;

  // Check if human already replied
  const humanReplied = await hasHumanReplied({ prisma, threadId, tenantPartyId });
  if (humanReplied) {
    await prisma.autoReplyLog.create({
      data: {
        tenantId,
        channel: "dm",
        partyId: inboundSenderPartyId,
        threadId,
        status: "skipped",
        reason: "human_already_replied",
      },
    });
    return;
  }

  // Get active auto-reply rules for DM
  const rules = await prisma.autoReplyRule.findMany({
    where: {
      tenantId,
      channel: "dm",
      enabled: true,
    },
    include: {
      template: { include: { content: true } },
    },
  });

  if (rules.length === 0) return;

  // Match first applicable rule
  for (const rule of rules) {
    let matches = false;

    if (rule.triggerType === "dm_first_message_from_party") {
      const messageCount = await prisma.message.count({
        where: { threadId, senderPartyId: inboundSenderPartyId },
      });
      matches = messageCount === 1;
    } else if (rule.triggerType === "dm_after_hours") {
      matches = !isWithinBusinessHours(rule.businessHoursJson);
    }

    if (!matches) continue;

    // Check cooldown
    const cooldownActive = await isCooldownActive({
      prisma,
      tenantId,
      partyId: inboundSenderPartyId,
      ruleId: rule.id,
      cooldownMinutes: rule.cooldownMinutes,
    });

    if (cooldownActive) {
      await prisma.autoReplyLog.create({
        data: {
          tenantId,
          channel: "dm",
          partyId: inboundSenderPartyId,
          threadId,
          ruleId: rule.id,
          templateId: rule.templateId,
          status: "skipped",
          reason: "cooldown_active",
        },
      });
      return;
    }

    // Render template
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const client = await prisma.party.findUnique({ where: { id: inboundSenderPartyId } });

    const rendered = await renderTemplate({
      prisma,
      templateId: rule.templateId,
      context: {
        tenant: { name: tenant?.name || "" },
        client: { name: client?.name || "" },
      },
    });

    // Send automated message
    try {
      await prisma.message.create({
        data: {
          threadId,
          senderPartyId: tenantPartyId,
          body: rendered.bodyText,
          isAutomated: true,
          automationRuleId: rule.id,
        },
      });

      await prisma.messageThread.update({
        where: { id: threadId },
        data: { lastMessageAt: new Date() },
      });

      await prisma.autoReplyLog.create({
        data: {
          tenantId,
          channel: "dm",
          partyId: inboundSenderPartyId,
          threadId,
          ruleId: rule.id,
          templateId: rule.templateId,
          status: "sent",
        },
      });

      return;
    } catch (err: any) {
      await prisma.autoReplyLog.create({
        data: {
          tenantId,
          channel: "dm",
          partyId: inboundSenderPartyId,
          threadId,
          ruleId: rule.id,
          templateId: rule.templateId,
          status: "failed",
          reason: err.message,
        },
      });
      return;
    }
  }
}
