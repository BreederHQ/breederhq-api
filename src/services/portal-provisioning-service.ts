// src/services/portal-provisioning-service.ts
// Service for auto-provisioning portal access when breeder sends DM to contact without access

import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "../prisma.js";
import { sendEmail, buildFromAddress } from "./email-service.js";
import {
  wrapEmailLayout,
  emailGreeting,
  emailParagraph,
  emailAccent,
  emailFeatureList,
  emailButton,
  emailInfoCard,
  emailFootnote,
} from "./email-layout.js";
import { generateReplyToAddress } from "./inbound-email-service.js";

const PORTAL_DOMAIN = process.env.PORTAL_DOMAIN || "http://localhost:6170";
const INVITE_TTL_HOURS = 72; // 3 days

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function newRawToken(): string {
  return b64url(randomBytes(32));
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

interface AutoProvisionResult {
  provisioned: boolean;
  reason: string;
  inviteSent?: boolean;
  partyId?: number;
}

/**
 * Auto-provision portal access for a party when they receive a DM
 * but don't have portal access yet.
 *
 * This enables the "send DM → auto-invite to portal" flow.
 *
 * @param tenantId - The tenant ID
 * @param partyId - The recipient party's ID
 * @param triggeredBy - Who triggered this (for audit trail)
 */
export async function autoProvisionPortalAccessForDM(
  tenantId: number,
  partyId: number,
  triggeredBy: { userId?: string; senderPartyId?: number }
): Promise<AutoProvisionResult> {
  try {
    // 1. Get the party and check current portal access status
    const party = await prisma.party.findFirst({
      where: { id: partyId, tenantId },
      include: { portalAccess: true },
    });

    if (!party) {
      return { provisioned: false, reason: "party_not_found" };
    }

    // 2. Skip if party is the organization (they don't need portal access)
    if (party.type === "ORGANIZATION") {
      return { provisioned: false, reason: "is_organization" };
    }

    // 3. Check if they already have active or invited access
    if (party.portalAccess) {
      const status = party.portalAccess.status;
      if (status === "ACTIVE") {
        return { provisioned: false, reason: "already_active" };
      }
      if (status === "INVITED") {
        return { provisioned: false, reason: "already_invited" };
      }
      // SUSPENDED or NO_ACCESS can be re-enabled
    }

    // 4. Party must have an email to receive the invite
    if (!party.email) {
      return { provisioned: false, reason: "no_email", partyId };
    }

    const emailNorm = normalizeEmail(party.email);

    // 5. Generate invite token
    const rawToken = newRawToken();
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

    // 6. Check if a User with this email already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: emailNorm },
      select: { id: true },
    });

    // 7. Create or update portal access
    if (party.portalAccess) {
      // Re-enable from SUSPENDED or NO_ACCESS
      await prisma.$transaction([
        prisma.portalAccess.update({
          where: { id: party.portalAccess.id },
          data: {
            status: "INVITED",
            invitedAt: new Date(),
            suspendedAt: null,
            updatedByUserId: triggeredBy.userId ?? null,
          },
        }),
        prisma.portalInvite.create({
          data: {
            tenantId,
            partyId,
            emailNorm,
            userId: existingUser?.id ?? null,
            tokenHash,
            expiresAt,
            sentByUserId: triggeredBy.userId ?? null,
          },
        }),
      ]);
    } else {
      // Create new portal access record
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.portalAccess.create({
          data: {
            tenantId,
            partyId,
            status: "INVITED",
            invitedAt: new Date(),
            createdByUserId: triggeredBy.userId ?? null,
            updatedByUserId: triggeredBy.userId ?? null,
          },
        });

        await tx.portalInvite.create({
          data: {
            tenantId,
            partyId,
            emailNorm,
            userId: existingUser?.id ?? null,
            tokenHash,
            expiresAt,
            sentByUserId: triggeredBy.userId ?? null,
          },
        });

        // If user with this email exists, create INVITED membership
        if (existingUser) {
          const existingMembership = await tx.tenantMembership.findUnique({
            where: { userId_tenantId: { userId: existingUser.id, tenantId } },
          });

          if (!existingMembership) {
            await tx.tenantMembership.create({
              data: {
                userId: existingUser.id,
                tenantId,
                role: "VIEWER",
                membershipRole: "CLIENT",
                membershipStatus: "INVITED",
                partyId,
              },
            });
          }
        }
      });
    }

    // 8. Send the portal invite email
    await sendPortalInviteEmail(tenantId, party.email, party.name, rawToken);

    // 9. Log activity
    await prisma.partyActivity.create({
      data: {
        tenantId,
        partyId,
        kind: "PORTAL_INVITE_AUTO_SENT",
        title: "Portal access automatically enabled",
        detail: "Portal invite sent automatically when breeder initiated a message",
        // Note: actorId expects an integer User ID, but triggeredBy.userId is a string
        // If we need to link to a User, a separate lookup would be required
      },
    }).catch(() => {
      // Don't fail if activity logging fails
    });

    return { provisioned: true, reason: "success", inviteSent: true, partyId };

  } catch (err: any) {
    console.error("Auto-provision portal access failed:", err);
    return { provisioned: false, reason: `error: ${err.message}` };
  }
}

/**
 * Send portal invite email to a party
 */
async function sendPortalInviteEmail(
  tenantId: number,
  toEmail: string,
  partyName: string,
  rawToken: string
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  const orgName = tenant?.name || "Your Breeder";

  const activationUrl = `${PORTAL_DOMAIN}/activate?token=${rawToken}`;
  const expiryDays = Math.floor(INVITE_TTL_HOURS / 24);

  const html = wrapEmailLayout({
    title: "You're Invited to Your Client Portal",
    footerOrgName: orgName,
    body: [
      emailGreeting(partyName),
      emailParagraph(`${emailAccent(orgName)} has invited you to their client portal. Here's what you can do:`),
      emailFeatureList([
        "View and sign agreements & contracts",
        "Track your waitlist & reservations",
        "Make secure payments online",
        "Send messages & stay in touch",
      ]),
      emailButton("Activate Your Account", activationUrl),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          ${emailAccent(`&#9432; Expires in ${expiryDays} days`)}<br>
          <span style="color: #a3a3a3;">If your link expires, contact ${orgName} for a new invitation.</span>
        </p>
      `, { borderColor: "orange" }),
      emailFootnote("Didn't expect this? You can safely ignore this email."),
    ].join("\n"),
  });

  const text = `
Welcome to Your Client Portal

Hello ${partyName},

${orgName} has invited you to access their client portal.

Through the portal, you'll be able to:
- View and sign agreements & contracts
- Track your waitlist & reservations
- Make secure payments online
- Send messages & stay in touch

Activate your account by visiting:
${activationUrl}

This link will expire in ${expiryDays} days. If the link expires, please contact ${orgName} to request a new invitation.

If you weren't expecting this invitation, you can safely ignore this email.

---
This invitation was sent by ${orgName} via BreederHQ
  `.trim();

  return sendEmail({
    tenantId,
    to: toEmail,
    subject: `Your ${orgName} Client Portal is Ready`,
    html,
    text,
    templateKey: "portal_invite_auto",
    category: "transactional",
  });
}

/**
 * Send a notification email about a new message (after portal access is set up)
 *
 * @param tenantId - The tenant ID
 * @param toEmail - Recipient email address
 * @param partyName - Recipient's name
 * @param senderName - Sender's name (shown in email)
 * @param messagePreview - Preview of the message body
 * @param threadId - Optional thread ID for generating reply-to address
 */
export async function sendNewMessageNotification(
  tenantId: number,
  toEmail: string,
  partyName: string,
  senderName: string,
  messagePreview: string,
  threadId?: number
): Promise<{ ok: boolean; error?: string }> {
  const portalUrl = `${PORTAL_DOMAIN}/messages`;

  // Generate reply-to address if thread ID provided
  const replyTo = threadId ? generateReplyToAddress(threadId) : undefined;

  // Build custom from address with sender name
  const from = buildFromAddress(`${senderName} via BreederHQ`, "notifications");

  const html = `
    <h2>You have a new message</h2>
    <p>Hello ${partyName},</p>
    <p><strong>${senderName}</strong> sent you a message:</p>
    <blockquote style="margin:16px 0;padding:12px 16px;background:#f5f5f5;border-left:4px solid #2563eb;border-radius:4px;">
      ${messagePreview.substring(0, 200)}${messagePreview.length > 200 ? '...' : ''}
    </blockquote>
    <p><strong>Reply directly to this email</strong> or <a href="${portalUrl}" style="color:#2563eb;">view in your portal</a>.</p>
    <p><a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">View Message</a></p>
  `;

  const text = `
You have a new message

Hello ${partyName},

${senderName} sent you a message:

"${messagePreview.substring(0, 200)}${messagePreview.length > 200 ? '...' : ''}"

Reply directly to this email, or log in to the client portal:
${portalUrl}
  `.trim();

  return sendEmail({
    tenantId,
    to: toEmail,
    subject: `New message from ${senderName}`,
    html,
    text,
    templateKey: "new_message_notification",
    category: "transactional",
    from,
    replyTo,
  });
}
