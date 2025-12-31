// src/routes/portal-access.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import prisma from "../prisma.js";
import { sendEmail } from "../services/email-service.js";

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

async function getPartyWithAccess(tenantId: number, partyId: number) {
  return prisma.party.findFirst({
    where: { id: partyId, tenantId },
    include: {
      portalAccess: {
        include: {
          createdBy: { select: { id: true, email: true } },
          updatedBy: { select: { id: true, email: true } },
          invites: {
            orderBy: { sentAt: "desc" },
            take: 1,
            select: { sentAt: true, expiresAt: true },
          },
        },
      },
    },
  });
}

function toDTO(party: NonNullable<Awaited<ReturnType<typeof getPartyWithAccess>>>): PortalAccessDTO {
  const access = party.portalAccess;
  return {
    partyId: party.id,
    status: access?.status ?? "NO_ACCESS",
    email: party.email,
    invitedAt: access?.invitedAt?.toISOString() ?? null,
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
  const activationUrl = `${PORTAL_DOMAIN}/activate?token=${rawToken}`;

  const html = `
    <h2>You have been invited to the Client Portal</h2>
    <p>Hello ${partyName},</p>
    <p>You have been granted access to the client portal. Click the link below to set up your account:</p>
    <p><a href="${activationUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Activate Your Account</a></p>
    <p>This link will expire in ${INVITE_TTL_HOURS} hours.</p>
    <p>If you did not expect this invitation, you can safely ignore this email.</p>
  `;

  const text = `
You have been invited to the Client Portal

Hello ${partyName},

You have been granted access to the client portal. Visit the link below to set up your account:

${activationUrl}

This link will expire in ${INVITE_TTL_HOURS} hours.

If you did not expect this invitation, you can safely ignore this email.
  `.trim();

  return sendEmail({
    tenantId,
    to: toEmail,
    subject: "You have been invited to the Client Portal",
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

  const html = `
    <h2>Password Reset Required</h2>
    <p>Hello ${partyName},</p>
    <p>A password reset has been requested for your client portal account. Click the link below to set a new password:</p>
    <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Reset Your Password</a></p>
    <p>This link will expire in 1 hour.</p>
    <p>If you did not request this reset, please contact support immediately.</p>
  `;

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
  app.post("/portal-access/:partyId/enable", async (req, reply) => {
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
          prisma.portalInvite.create({
            data: {
              portalAccessId: party.portalAccess.id,
              tokenHash,
              expiresAt,
              sentByUserId: userId,
            },
          }),
        ]);

        await sendInviteEmail(tenantId, party.email, party.name, rawToken);

        const updated = await getPartyWithAccess(tenantId, partyId);
        return reply.send({ portalAccess: toDTO(updated!), inviteSent: true });
      }

      // Create new access record
      const rawToken = newRawToken();
      const tokenHash = sha256(rawToken);
      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

      await prisma.$transaction(async (tx) => {
        // Create PortalAccess record
        await tx.portalAccess.create({
          data: {
            partyId,
            status: "INVITED",
            invitedAt: new Date(),
            createdByUserId: userId,
            updatedByUserId: userId,
            invites: {
              create: {
                tokenHash,
                expiresAt,
                sentByUserId: userId,
              },
            },
          },
        });

        // If a user with this email already exists, create INVITED membership
        const existingUser = await tx.user.findFirst({
          where: { email: party.email!.toLowerCase().trim() },
          select: { id: true },
        });

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

      const updated = await getPartyWithAccess(tenantId, partyId);
      return reply.send({ portalAccess: toDTO(updated!), inviteSent: true });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to enable portal access");
      return reply.code(500).send({ error: "enable_failed" });
    }
  });

  // POST /api/v1/portal-access/:partyId/invite
  // Sends or resends an invite email
  app.post("/portal-access/:partyId/invite", async (req, reply) => {
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

      await prisma.$transaction([
        prisma.portalAccess.update({
          where: { id: party.portalAccess.id },
          data: {
            invitedAt: new Date(),
            updatedByUserId: userId,
          },
        }),
        prisma.portalInvite.create({
          data: {
            portalAccessId: party.portalAccess.id,
            tokenHash,
            expiresAt,
            sentByUserId: userId,
          },
        }),
      ]);

      await sendInviteEmail(tenantId, party.email, party.name, rawToken);

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

        // If there's a linked user, invalidate their sessions
        if (party.portalAccess!.userId) {
          await tx.session.deleteMany({
            where: { userId: party.portalAccess!.userId },
          });
        }
      });

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

      await prisma.portalAccess.update({
        where: { id: party.portalAccess.id },
        data: {
          status: newStatus,
          suspendedAt: null,
          updatedByUserId: userId,
        },
      });

      // If going back to INVITED, send a new invite
      if (newStatus === "INVITED" && party.email) {
        const rawToken = newRawToken();
        const tokenHash = sha256(rawToken);
        const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

        await prisma.$transaction([
          prisma.portalAccess.update({
            where: { id: party.portalAccess.id },
            data: { invitedAt: new Date() },
          }),
          prisma.portalInvite.create({
            data: {
              portalAccessId: party.portalAccess.id,
              tokenHash,
              expiresAt,
              sentByUserId: userId,
            },
          }),
        ]);

        await sendInviteEmail(tenantId, party.email, party.name, rawToken);
      }

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
