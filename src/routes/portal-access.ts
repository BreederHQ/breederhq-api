// src/routes/portal-access.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import prisma from "../prisma.js";
import { sendEmail } from "../services/email-service.js";
import {
  wrapEmailLayout,
  emailGreeting,
  emailParagraph,
  emailAccent,
  emailButton,
  emailFeatureList,
  emailInfoCard,
  emailFootnote,
} from "../services/email-layout.js";
import { auditSuccess } from "../services/audit.js";
import { checkQuota } from "../middleware/quota-enforcement.js";
import { updateUsageSnapshot } from "../services/subscription/usage-service.js";

/**
 * Portal Access Management Routes
 *
 * Mounted with: api.register(portalAccessRoutes); // /api/v1/portal-access/*
 *
 * Endpoints:
 *   GET    /portal-access/:partyId       - Get portal access status for a party
 *   POST   /portal-access/:partyId/enable - Enable portal access (creates invite if email exists)
 *   POST   /portal-access/:partyId/invite - Send/resend invite email
 *   POST   /portal-access/:partyId/suspend - Suspend portal access
 *   POST   /portal-access/:partyId/reenable - Re-enable portal access
 *   POST   /portal-access/:partyId/force-password-reset - Invalidate sessions and send reset email
 */

const PORTAL_DOMAIN = process.env.PORTAL_DOMAIN || "http://localhost:6170";
const INVITE_TTL_HOURS = 72; // 3 days

function idNum(v: any): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function newRawToken(): string {
  return b64url(randomBytes(32));
}

interface PortalAccessDTO {
  partyId: number;
  status: string;
  email: string | null;
  invitedAt: string | null;
  activatedAt: string | null;
  suspendedAt: string | null;
  lastLoginAt: string | null;
  createdBy: { id: string; email: string } | null;
  updatedBy: { id: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

async function getPartyWithAccess(tenantId: number, partyId: number) {
  const include = {
    portalAccess: {
      include: {
        createdBy: { select: { id: true, email: true } },
        updatedBy: { select: { id: true, email: true } },
      },
    },
    portalInvites: {
      orderBy: { sentAt: "desc" as const },
      take: 1,
      select: { sentAt: true, expiresAt: true },
    },
  };

  // Try to find party by ID first
  let party = await prisma.party.findFirst({
    where: { id: partyId, tenantId },
    include,
  });

  // If not found as party, check if it's a contact ID and get the party from there
  if (!party) {
    const contact = await (prisma as any).contact.findFirst({
      where: { id: partyId, tenantId },
      include: { party: { include } },
    });
    if (contact?.party) {
      party = contact.party;
    }
  }

  return party;
}

function toDTO(party: NonNullable<Awaited<ReturnType<typeof getPartyWithAccess>>>): PortalAccessDTO {
  const access = party.portalAccess;
  const latestInvite = party.portalInvites?.[0];
  return {
    partyId: party.id,
    status: access?.status ?? "NO_ACCESS",
    email: party.email,
    invitedAt: latestInvite?.sentAt?.toISOString() ?? access?.invitedAt?.toISOString() ?? null,
    activatedAt: access?.activatedAt?.toISOString() ?? null,
    suspendedAt: access?.suspendedAt?.toISOString() ?? null,
    lastLoginAt: access?.lastLoginAt?.toISOString() ?? null,
    createdBy: access?.createdBy ? { id: access.createdBy.id, email: access.createdBy.email } : null,
    updatedBy: access?.updatedBy ? { id: access.updatedBy.id, email: access.updatedBy.email } : null,
    createdAt: access?.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: access?.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

async function sendInviteEmail(
  tenantId: number,
  toEmail: string,
  partyName: string,
  rawToken: string
): Promise<{ ok: boolean; error?: string }> {
  // Fetch organization name for personalized email
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
    templateKey: "portal_invite",
    category: "transactional",
  });
}

async function sendPasswordResetEmail(
  tenantId: number,
  toEmail: string,
  partyName: string,
  rawToken: string
): Promise<{ ok: boolean; error?: string }> {
  const resetUrl = `${PORTAL_DOMAIN}/reset-password?token=${rawToken}`;

  const html = wrapEmailLayout({
    title: "Password Reset Required",
    body: [
      emailGreeting(partyName),
      emailParagraph("A password reset has been requested for your client portal account. Click the button below to set a new password:"),
      emailButton("Reset Your Password", resetUrl),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          ${emailAccent("&#9432; Expires in 1 hour")}<br>
          <span style="color: #a3a3a3;">If you did not request this reset, please contact support immediately.</span>
        </p>
      `, { borderColor: "orange" }),
    ].join("\n"),
  });

  const text = `
Password Reset Required

Hello ${partyName},

A password reset has been requested for your client portal account. Visit the link below to set a new password:

${resetUrl}

This link will expire in 1 hour.

If you did not request this reset, please contact support immediately.
  `.trim();

  return sendEmail({
    tenantId,
    to: toEmail,
    subject: "Password Reset Required - Client Portal",
    html,
    text,
    templateKey: "portal_password_reset",
    category: "transactional",
  });
}

const portalAccessRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/portal-access/:partyId
  // Returns portal access status for a party
  app.get("/portal-access/:partyId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = idNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "bad_id" });

      const party = await getPartyWithAccess(tenantId, partyId);
      if (!party) return reply.code(404).send({ error: "party_not_found" });

      return reply.send({ portalAccess: toDTO(party) });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get portal access");
      return reply.code(500).send({ error: "get_failed" });
    }
  });

  // POST /api/v1/portal-access/:partyId/enable
  // Enables portal access for a party (creates record if none exists, sends invite if email exists)
  // Body: { contextType?: "INQUIRY" | "WAITLIST" | "INVOICE", contextId?: number }
  app.post("/portal-access/:partyId/enable", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    // preHandler: [checkQuota("PORTAL_USER_COUNT")], // Temporarily disabled for testing
  }, async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const userId = (req as any).userId as string | undefined;
      if (!userId) return reply.code(401).send({ error: "unauthorized" });

      const partyId = idNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "bad_id" });

      const body = (req.body || {}) as any;
      const contextType = body.contextType || null;
      const contextId = body.contextId ? Number(body.contextId) : null;

      // Try to find party by ID first, then check if it's a contact ID
      let party = await prisma.party.findFirst({
        where: { id: partyId, tenantId },
        include: { portalAccess: true },
      });

      // If not found as party, check if it's a contact ID and get/create the party
      if (!party) {
        req.log.info({ partyId, tenantId }, "Party not found by ID, trying contact lookup");
        const contact = await (prisma as any).contact.findFirst({
          where: { id: partyId, tenantId },
          select: {
            id: true,
            partyId: true,
            email: true,
            first_name: true,
            last_name: true,
            display_name: true,
          },
        });
        req.log.info({ contact: contact ? { id: contact.id, partyId: contact.partyId } : null }, "Contact lookup result");

        if (contact) {
          if (contact.partyId) {
            // Contact has a party, fetch it
            req.log.info({ contactId: partyId, actualPartyId: contact.partyId }, "Found partyId via contact, fetching party");
            party = await prisma.party.findFirst({
              where: { id: contact.partyId, tenantId },
              include: { portalAccess: true },
            });
            req.log.info({ party: !!party }, "Party fetch result");
          } else {
            // Contact exists but has no party - create one on-the-fly
            req.log.info({ contactId: partyId }, "Contact has no party, creating party");
            const displayName = contact.display_name ||
              [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() ||
              contact.email ||
              `Contact ${contact.id}`;

            const newParty = await prisma.party.create({
              data: {
                tenantId,
                name: displayName,
                email: contact.email,
                type: "CONTACT",
              },
            });

            // Link the party back to the contact
            await (prisma as any).contact.update({
              where: { id: contact.id },
              data: { partyId: newParty.id },
            });

            // Fetch the party with portalAccess included to match the expected type
            party = await prisma.party.findFirst({
              where: { id: newParty.id, tenantId },
              include: { portalAccess: true },
            });
            req.log.info({ contactId: partyId, createdPartyId: newParty.id }, "Created party for contact");
          }
        }
      }

      if (!party) {
        req.log.warn({ partyId, tenantId }, "party_not_found after all lookups");
        return reply.code(404).send({ error: "party_not_found" });
      }

      // Use the actual party ID from here on (in case we looked up via contact ID)
      const actualPartyId = party.id;

      if (!party.email) {
        return reply.code(400).send({ error: "party_has_no_email" });
      }

      const emailNorm = normalizeEmail(party.email);

      // If already has access record
      if (party.portalAccess) {
        if (party.portalAccess.status === "ACTIVE") {
          return reply.code(400).send({ error: "already_active" });
        }
        if (party.portalAccess.status === "INVITED") {
          return reply.code(400).send({ error: "already_invited" });
        }
        // If SUSPENDED or NO_ACCESS, update to INVITED
        const rawToken = newRawToken();
        const tokenHash = sha256(rawToken);
        const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

        // Lookup User by emailNorm (may or may not exist)
        const existingUser = await prisma.user.findFirst({
          where: { email: emailNorm },
          select: { id: true },
        });

        await prisma.$transaction([
          prisma.portalAccess.update({
            where: { id: party.portalAccess.id },
            data: {
              status: "INVITED",
              invitedAt: new Date(),
              suspendedAt: null,
              updatedByUserId: userId,
            },
          }),
          // Create key-based PortalInvite
          prisma.portalInvite.create({
            data: {
              tenantId,
              partyId: actualPartyId,
              emailNorm,
              userId: existingUser?.id ?? null,
              tokenHash,
              expiresAt,
              sentByUserId: userId,
            },
          }),
        ]);

        await sendInviteEmail(tenantId, party.email, party.name, rawToken);

        // Audit invite resent (re-enabling from SUSPENDED/NO_ACCESS)
        await auditSuccess(req, "PORTAL_INVITE_RESENT", {
          userId,
          tenantId,
          surface: "PLATFORM",
          detail: { partyId, toEmail: party.email },
        });

        // Update usage snapshot after re-enabling portal access
        await updateUsageSnapshot(tenantId, "PORTAL_USER_COUNT");

        const updated = await getPartyWithAccess(tenantId, partyId);
        return reply.send({ portalAccess: toDTO(updated!), inviteSent: true });
      }

      // Create new access record
      const rawToken = newRawToken();
      const tokenHash = sha256(rawToken);
      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

      // Lookup User by emailNorm (may or may not exist)
      const existingUser = await prisma.user.findFirst({
        where: { email: emailNorm },
        select: { id: true },
      });

      await prisma.$transaction(async (tx) => {
        // Create PortalAccess record with tenantId
        await tx.portalAccess.create({
          data: {
            tenantId,
            partyId: actualPartyId,
            status: "INVITED",
            invitedAt: new Date(),
            createdByUserId: userId,
            updatedByUserId: userId,
          },
        });

        // Create key-based PortalInvite
        await tx.portalInvite.create({
          data: {
            tenantId,
            partyId: actualPartyId,
            emailNorm,
            userId: existingUser?.id ?? null,
            tokenHash,
            expiresAt,
            sentByUserId: userId,
          },
        });

        // If a user with this email already exists, create INVITED membership
        if (existingUser) {
          // Create TenantMembership with CLIENT role and INVITED status
          // Skip if membership already exists
          const existingMembership = await (tx as any).tenantMembership.findUnique({
            where: { userId_tenantId: { userId: existingUser.id, tenantId } },
          });

          if (!existingMembership) {
            await (tx as any).tenantMembership.create({
              data: {
                userId: existingUser.id,
                tenantId,
                role: "VIEWER", // Legacy field
                membershipRole: "CLIENT",
                membershipStatus: "INVITED",
                partyId,
              },
            });
          }
        }
      });

      await sendInviteEmail(tenantId, party.email, party.name, rawToken);

      // Audit new portal invite created
      await auditSuccess(req, "PORTAL_INVITE_CREATED", {
        userId,
        tenantId,
        surface: "PLATFORM",
        detail: { partyId, toEmail: party.email },
      });

      // Update usage snapshot after creating portal access
      await updateUsageSnapshot(tenantId, "PORTAL_USER_COUNT");

      const updated = await getPartyWithAccess(tenantId, partyId);
      return reply.send({ portalAccess: toDTO(updated!), inviteSent: true });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to enable portal access");
      return reply.code(500).send({ error: "enable_failed" });
    }
  });

  // POST /api/v1/portal-access/:partyId/invite
  // Sends or resends an invite email
  app.post("/portal-access/:partyId/invite", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const userId = (req as any).userId as string | undefined;
      if (!userId) return reply.code(401).send({ error: "unauthorized" });

      const partyId = idNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "bad_id" });

      const party = await prisma.party.findFirst({
        where: { id: partyId, tenantId },
        include: { portalAccess: true },
      });
      if (!party) return reply.code(404).send({ error: "party_not_found" });

      if (!party.email) {
        return reply.code(400).send({ error: "party_has_no_email" });
      }

      if (!party.portalAccess) {
        return reply.code(400).send({ error: "access_not_enabled" });
      }

      if (party.portalAccess.status === "ACTIVE") {
        return reply.code(400).send({ error: "already_active_use_force_reset" });
      }

      if (party.portalAccess.status === "SUSPENDED") {
        return reply.code(400).send({ error: "access_suspended" });
      }

      // Create new invite token
      const rawToken = newRawToken();
      const tokenHash = sha256(rawToken);
      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
      const emailNorm = normalizeEmail(party.email);

      // Lookup User by emailNorm (may or may not exist)
      const existingUser = await prisma.user.findFirst({
        where: { email: emailNorm },
        select: { id: true },
      });

      await prisma.$transaction([
        prisma.portalAccess.update({
          where: { id: party.portalAccess.id },
          data: {
            invitedAt: new Date(),
            updatedByUserId: userId,
          },
        }),
        // Create key-based PortalInvite
        prisma.portalInvite.create({
          data: {
            tenantId,
            partyId,
            emailNorm,
            userId: existingUser?.id ?? null,
            tokenHash,
            expiresAt,
            sentByUserId: userId,
          },
        }),
      ]);

      await sendInviteEmail(tenantId, party.email, party.name, rawToken);

      // Audit resent invite
      await auditSuccess(req, "PORTAL_INVITE_RESENT", {
        userId,
        tenantId,
        surface: "PLATFORM",
        detail: { partyId, toEmail: party.email },
      });

      const updated = await getPartyWithAccess(tenantId, partyId);
      return reply.send({ portalAccess: toDTO(updated!), inviteSent: true });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to send portal invite");
      return reply.code(500).send({ error: "invite_failed" });
    }
  });

  // POST /api/v1/portal-access/:partyId/suspend
  // Suspends portal access
  app.post("/portal-access/:partyId/suspend", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const userId = (req as any).userId as string | undefined;
      if (!userId) return reply.code(401).send({ error: "unauthorized" });

      const partyId = idNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "bad_id" });

      const party = await prisma.party.findFirst({
        where: { id: partyId, tenantId },
        include: { portalAccess: true },
      });
      if (!party) return reply.code(404).send({ error: "party_not_found" });

      if (!party.portalAccess) {
        return reply.code(400).send({ error: "access_not_enabled" });
      }

      if (party.portalAccess.status === "SUSPENDED") {
        return reply.code(400).send({ error: "already_suspended" });
      }

      if (party.portalAccess.status === "NO_ACCESS") {
        return reply.code(400).send({ error: "no_access_to_suspend" });
      }

      // Suspend access and invalidate any linked user sessions
      await prisma.$transaction(async (tx) => {
        await tx.portalAccess.update({
          where: { id: party.portalAccess!.id },
          data: {
            status: "SUSPENDED",
            suspendedAt: new Date(),
            updatedByUserId: userId,
          },
        });

        // Also update TenantMembership status so auth middleware rejects requests
        if (party.portalAccess!.userId) {
          await (tx as any).tenantMembership.updateMany({
            where: {
              userId: party.portalAccess!.userId,
              tenantId,
              membershipRole: "CLIENT",
            },
            data: {
              membershipStatus: "SUSPENDED",
            },
          });

          // Delete all sessions for this user to force immediate logout
          await tx.session.deleteMany({
            where: { userId: party.portalAccess!.userId },
          });
        }
      });

      // Update usage snapshot after suspending portal access
      await updateUsageSnapshot(tenantId, "PORTAL_USER_COUNT");

      const updated = await getPartyWithAccess(tenantId, partyId);
      return reply.send({ portalAccess: toDTO(updated!) });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to suspend portal access");
      return reply.code(500).send({ error: "suspend_failed" });
    }
  });

  // POST /api/v1/portal-access/:partyId/reenable
  // Re-enables suspended portal access
  app.post("/portal-access/:partyId/reenable", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const userId = (req as any).userId as string | undefined;
      if (!userId) return reply.code(401).send({ error: "unauthorized" });

      const partyId = idNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "bad_id" });

      const party = await prisma.party.findFirst({
        where: { id: partyId, tenantId },
        include: { portalAccess: true },
      });
      if (!party) return reply.code(404).send({ error: "party_not_found" });

      if (!party.portalAccess) {
        return reply.code(400).send({ error: "access_not_enabled" });
      }

      if (party.portalAccess.status !== "SUSPENDED") {
        return reply.code(400).send({ error: "not_suspended" });
      }

      // Re-enable: if they had activated before, restore to ACTIVE; otherwise INVITED
      const newStatus = party.portalAccess.activatedAt ? "ACTIVE" : "INVITED";

      await prisma.$transaction(async (tx) => {
        await tx.portalAccess.update({
          where: { id: party.portalAccess!.id },
          data: {
            status: newStatus,
            suspendedAt: null,
            updatedByUserId: userId,
          },
        });

        // Also restore TenantMembership status if going back to ACTIVE
        if (newStatus === "ACTIVE" && party.portalAccess!.userId) {
          await (tx as any).tenantMembership.updateMany({
            where: {
              userId: party.portalAccess!.userId,
              tenantId,
              membershipRole: "CLIENT",
            },
            data: {
              membershipStatus: "ACTIVE",
            },
          });
        }
      });

      // If going back to INVITED, send a new invite
      if (newStatus === "INVITED" && party.email) {
        const rawToken = newRawToken();
        const tokenHash = sha256(rawToken);
        const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
        const emailNorm = normalizeEmail(party.email);

        // Lookup User by emailNorm (may or may not exist)
        const existingUser = await prisma.user.findFirst({
          where: { email: emailNorm },
          select: { id: true },
        });

        await prisma.$transaction([
          prisma.portalAccess.update({
            where: { id: party.portalAccess.id },
            data: { invitedAt: new Date() },
          }),
          // Create key-based PortalInvite
          prisma.portalInvite.create({
            data: {
              tenantId,
              partyId,
              emailNorm,
              userId: existingUser?.id ?? null,
              tokenHash,
              expiresAt,
              sentByUserId: userId,
            },
          }),
        ]);

        await sendInviteEmail(tenantId, party.email, party.name, rawToken);

        // Audit invite resent on re-enable
        await auditSuccess(req, "PORTAL_INVITE_RESENT", {
          userId,
          tenantId,
          surface: "PLATFORM",
          detail: { partyId, toEmail: party.email, context: "reenable" },
        });
      }

      // Update usage snapshot after re-enabling portal access
      await updateUsageSnapshot(tenantId, "PORTAL_USER_COUNT");

      const updated = await getPartyWithAccess(tenantId, partyId);
      return reply.send({ portalAccess: toDTO(updated!) });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to re-enable portal access");
      return reply.code(500).send({ error: "reenable_failed" });
    }
  });

  // POST /api/v1/portal-access/:partyId/force-password-reset
  // Invalidates sessions and sends password reset email
  app.post("/portal-access/:partyId/force-password-reset", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const userId = (req as any).userId as string | undefined;
      if (!userId) return reply.code(401).send({ error: "unauthorized" });

      const partyId = idNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "bad_id" });

      const party = await prisma.party.findFirst({
        where: { id: partyId, tenantId },
        include: { portalAccess: true },
      });
      if (!party) return reply.code(404).send({ error: "party_not_found" });

      if (!party.email) {
        return reply.code(400).send({ error: "party_has_no_email" });
      }

      if (!party.portalAccess) {
        return reply.code(400).send({ error: "access_not_enabled" });
      }

      if (party.portalAccess.status !== "ACTIVE") {
        return reply.code(400).send({ error: "user_not_active" });
      }

      if (!party.portalAccess.userId) {
        return reply.code(400).send({ error: "no_linked_user" });
      }

      // Create password reset token using VerificationToken table
      const rawToken = newRawToken();
      const tokenHash = sha256(rawToken);
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.$transaction(async (tx) => {
        // Invalidate all sessions for the user
        await tx.session.deleteMany({
          where: { userId: party.portalAccess!.userId! },
        });

        // Mark user as must change password
        await tx.user.update({
          where: { id: party.portalAccess!.userId! },
          data: { mustChangePassword: true },
        });

        // Create verification token for password reset
        await tx.verificationToken.create({
          data: {
            identifier: party.email!.toLowerCase(),
            tokenHash,
            purpose: "RESET_PASSWORD",
            userId: party.portalAccess!.userId,
            expires,
          },
        });

        // Update portal access audit
        await tx.portalAccess.update({
          where: { id: party.portalAccess!.id },
          data: { updatedByUserId: userId },
        });
      });

      await sendPasswordResetEmail(tenantId, party.email, party.name, rawToken);

      const updated = await getPartyWithAccess(tenantId, partyId);
      return reply.send({ portalAccess: toDTO(updated!), resetEmailSent: true });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to force password reset");
      return reply.code(500).send({ error: "reset_failed" });
    }
  });
};

export default portalAccessRoutes;
