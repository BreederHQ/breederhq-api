// src/services/buyer-email-service.ts
// Buyer CRM email service - wraps existing email infrastructure
// Does NOT duplicate email sending logic - uses sendEmail from email-service.ts

import prisma from "../prisma.js";
import { sendEmail, buildFromAddress } from "./email-service.js";
import type { BuyerEmailTemplateCategory, BuyerTaskType } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface SendBuyerEmailParams {
  tenantId: number;
  buyerId: number;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  /** Optional template ID - if provided, updates template usage stats */
  templateId?: number;
  /** User ID who is sending the email */
  userId?: string;
  /** Optional: create a follow-up task after sending */
  createFollowUpTask?: {
    daysFromNow: number;
    taskType?: BuyerTaskType;
    title?: string;
  };
}

export interface SendBuyerEmailResult {
  ok: boolean;
  partyEmailId?: number;
  error?: string;
}

export interface RenderTemplateParams {
  template: {
    subject: string;
    bodyHtml: string;
    bodyText: string;
  };
  variables: Record<string, string>;
}

// ────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Simple template variable replacement
 * Replaces {{variableName}} with the corresponding value
 */
export function renderTemplateVariables(
  text: string,
  variables: Record<string, string>
): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    result = result.replace(regex, value ?? "");
  }
  return result;
}

/**
 * Render a template with variables
 */
export function renderTemplate(params: RenderTemplateParams): {
  subject: string;
  bodyHtml: string;
  bodyText: string;
} {
  const { template, variables } = params;
  return {
    subject: renderTemplateVariables(template.subject, variables),
    bodyHtml: renderTemplateVariables(template.bodyHtml, variables),
    bodyText: renderTemplateVariables(template.bodyText, variables),
  };
}

/**
 * Log activity for a party (buyer's party)
 */
async function logPartyActivity(
  tenantId: number,
  partyId: number,
  kind: string,
  title: string,
  detail?: string | null,
  metadata?: Record<string, unknown>,
  actorId?: number | null
): Promise<void> {
  try {
    await prisma.partyActivity.create({
      data: {
        tenantId,
        partyId,
        kind: kind as any,
        title,
        detail,
        metadata: metadata as any,
        actorId,
      },
    });
  } catch (err) {
    console.error("Failed to log party activity:", err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Core Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get a buyer with their party information
 */
export async function getBuyerWithParty(tenantId: number, buyerId: number) {
  return prisma.buyer.findFirst({
    where: { id: buyerId, tenantId },
    include: {
      party: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Send an email to a buyer
 * Uses existing sendEmail infrastructure and records to PartyEmail
 */
export async function sendBuyerEmail(
  params: SendBuyerEmailParams
): Promise<SendBuyerEmailResult> {
  const {
    tenantId,
    buyerId,
    subject,
    bodyHtml,
    bodyText,
    templateId,
    userId,
    createFollowUpTask,
  } = params;

  // Get buyer with party info
  const buyer = await getBuyerWithParty(tenantId, buyerId);
  if (!buyer) {
    return { ok: false, error: "buyer_not_found" };
  }

  const partyId = buyer.partyId;
  const toEmail = buyer.party.email;
  if (!toEmail) {
    return { ok: false, error: "buyer_has_no_email" };
  }

  // Get tenant org for from address
  const tenantOrg = await prisma.organization.findFirst({
    where: { tenantId },
    include: { party: { select: { email: true, name: true } } },
  });

  if (!tenantOrg?.party?.email) {
    return { ok: false, error: "org_email_not_configured" };
  }

  const fromAddress = buildFromAddress(
    tenantOrg.party.name || "BreederHQ",
    "messages"
  );

  // Send email using existing infrastructure
  const result = await sendEmail({
    tenantId,
    to: toEmail,
    subject,
    html: bodyHtml,
    text: bodyText,
    from: fromAddress,
    replyTo: tenantOrg.party.email,
    category: "transactional",
    metadata: {
      type: "buyer_crm_email",
      buyerId,
      partyId,
      templateId,
    },
  });

  // Get user's numeric ID for createdBy field if we have userId
  let createdByUserId: number | null = null;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    // PartyEmail.createdBy expects Int, but User.id is String
    // We'll store it in metadata instead and use null for createdBy
  }

  // Record to PartyEmail (existing model)
  const partyEmail = await prisma.partyEmail.create({
    data: {
      tenantId,
      partyId,
      subject,
      body: bodyText,
      toEmail,
      status: result.ok ? "sent" : "failed",
      messageId: result.providerMessageId,
      createdBy: null, // PartyEmail.createdBy is Int, User.id is String
    },
  });

  if (!result.ok) {
    return { ok: false, error: result.error, partyEmailId: partyEmail.id };
  }

  // Log activity
  await logPartyActivity(
    tenantId,
    partyId,
    "EMAIL_SENT",
    `Email sent: ${subject}`,
    bodyText.substring(0, 200) + (bodyText.length > 200 ? "..." : ""),
    { partyEmailId: partyEmail.id, buyerId, templateId }
  );

  // Update template usage stats if a template was used
  if (templateId) {
    await prisma.buyerEmailTemplate.update({
      where: { id: templateId },
      data: {
        useCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    }).catch((err) => {
      console.error("Failed to update template usage stats:", err);
    });
  }

  // Create follow-up task if requested
  if (createFollowUpTask) {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + createFollowUpTask.daysFromNow);

    await prisma.buyerTask.create({
      data: {
        tenantId,
        buyerId,
        title: createFollowUpTask.title || `Follow up with ${buyer.party.name || "buyer"}`,
        taskType: createFollowUpTask.taskType || "FOLLOW_UP",
        priority: "MEDIUM",
        status: "PENDING",
        dueAt,
        isAutoGenerated: true,
        automationRule: "email_follow_up",
      },
    }).catch((err) => {
      console.error("Failed to create follow-up task:", err);
    });
  }

  return { ok: true, partyEmailId: partyEmail.id };
}

/**
 * Send email to buyer using a template
 */
export async function sendBuyerEmailWithTemplate(params: {
  tenantId: number;
  buyerId: number;
  templateId: number;
  variables?: Record<string, string>;
  userId?: string;
  createFollowUpTask?: SendBuyerEmailParams["createFollowUpTask"];
}): Promise<SendBuyerEmailResult> {
  const { tenantId, buyerId, templateId, variables = {}, userId, createFollowUpTask } = params;

  // Get the template
  const template = await prisma.buyerEmailTemplate.findFirst({
    where: { id: templateId, tenantId, isActive: true },
  });

  if (!template) {
    return { ok: false, error: "template_not_found" };
  }

  // Get buyer info for default variables
  const buyer = await getBuyerWithParty(tenantId, buyerId);
  if (!buyer) {
    return { ok: false, error: "buyer_not_found" };
  }

  // Build default variables
  // Note: Party only has 'name', not firstName/lastName. Those are on Contact.
  const defaultVariables: Record<string, string> = {
    buyerName: buyer.party.name || "",
    buyerEmail: buyer.party.email || "",
  };

  // Get tenant org for org variables
  const tenantOrg = await prisma.organization.findFirst({
    where: { tenantId },
    include: { party: { select: { name: true } } },
  });

  if (tenantOrg?.party?.name) {
    defaultVariables.orgName = tenantOrg.party.name;
    defaultVariables.breederName = tenantOrg.party.name;
  }

  // Merge default variables with provided variables (provided takes precedence)
  const mergedVariables = { ...defaultVariables, ...variables };

  // Render template
  const rendered = renderTemplate({
    template: {
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText,
    },
    variables: mergedVariables,
  });

  // Send email
  return sendBuyerEmail({
    tenantId,
    buyerId,
    subject: rendered.subject,
    bodyHtml: rendered.bodyHtml,
    bodyText: rendered.bodyText,
    templateId,
    userId,
    createFollowUpTask,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Template Management
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get all email templates for a tenant
 */
export async function getBuyerEmailTemplates(
  tenantId: number,
  options?: {
    category?: BuyerEmailTemplateCategory;
    activeOnly?: boolean;
  }
) {
  const where: any = { tenantId };

  if (options?.category) {
    where.category = options.category;
  }

  if (options?.activeOnly !== false) {
    where.isActive = true;
  }

  return prisma.buyerEmailTemplate.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/**
 * Create a new email template
 */
export async function createBuyerEmailTemplate(params: {
  tenantId: number;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  category?: BuyerEmailTemplateCategory;
}) {
  const { tenantId, name, subject, bodyHtml, bodyText, category } = params;

  return prisma.buyerEmailTemplate.create({
    data: {
      tenantId,
      name,
      subject,
      bodyHtml,
      bodyText,
      category: category || "GENERAL",
    },
  });
}

/**
 * Update an email template
 */
export async function updateBuyerEmailTemplate(
  tenantId: number,
  templateId: number,
  updates: {
    name?: string;
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
    category?: BuyerEmailTemplateCategory;
    isActive?: boolean;
    sortOrder?: number;
  }
) {
  return prisma.buyerEmailTemplate.update({
    where: { id: templateId, tenantId },
    data: updates,
  });
}

/**
 * Delete an email template
 */
export async function deleteBuyerEmailTemplate(
  tenantId: number,
  templateId: number
) {
  return prisma.buyerEmailTemplate.delete({
    where: { id: templateId, tenantId },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Email History
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get email history for a buyer (via their partyId)
 */
export async function getBuyerEmailHistory(
  tenantId: number,
  buyerId: number,
  options?: {
    page?: number;
    limit?: number;
  }
) {
  const buyer = await prisma.buyer.findFirst({
    where: { id: buyerId, tenantId },
    select: { partyId: true },
  });

  if (!buyer) {
    return { emails: [], total: 0 };
  }

  const page = options?.page ?? 1;
  const limit = Math.min(options?.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const [emails, total] = await Promise.all([
    prisma.partyEmail.findMany({
      where: { tenantId, partyId: buyer.partyId },
      orderBy: { sentAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.partyEmail.count({
      where: { tenantId, partyId: buyer.partyId },
    }),
  ]);

  return { emails, total, page, limit };
}
