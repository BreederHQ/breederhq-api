// src/routes/portal.ts
// Portal public routes (no auth required)
//
// GET  /api/v1/portal/invites/:token       - Validate token and get display info
// POST /api/v1/portal/invites/:token/accept - Accept invite and create session
// POST /api/v1/portal/activate              - Legacy endpoint (redirects to new flow)

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { setSessionCookies, Surface } from "../utils/session.js";
import { auditSuccess, auditFailure } from "../services/audit.js";
import {
  validateTosAcceptancePayload,
  writeTosAcceptance,
} from "../services/tos-service.js";

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  const visibleChars = Math.min(3, Math.floor(local.length / 2));
  const masked = local.slice(0, visibleChars) + "***";
  return `${masked}@${domain}`;
}

const portalRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/portal/invites/:token
   *
   * Validate a portal invite token and return minimal display info.
   * No auth required - this is a public endpoint.
   *
   * Response on success:
   * {
   *   valid: true,
   *   orgName: string,
   *   maskedEmail: string,
   *   partyName: string,
   *   expiresAt: string
   * }
   *
   * Response on error:
   * { error: "invalid_token" | "token_expired" | "token_already_used" }
   */
  app.get<{ Params: { token: string } }>(
    "/portal/invites/:token",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      try {
        const { token } = req.params;

        if (!token || typeof token !== "string") {
          return reply.code(400).send({ error: "token_required" });
        }

        const tokenHash = sha256(token);
        const now = new Date();

        // Find invite by tokenHash using new key-based schema
        const invite = await prisma.portalInvite.findUnique({
          where: { tokenHash },
          include: {
            tenant: { select: { id: true, slug: true, name: true } },
            party: { select: { id: true, name: true } },
          },
        });

        if (!invite) {
          return reply.code(400).send({ error: "invalid_token" });
        }

        // Check if already used
        if (invite.usedAt) {
          return reply.code(400).send({ error: "token_already_used" });
        }

        // Check expiration
        if (now >= invite.expiresAt) {
          return reply.code(400).send({ error: "token_expired" });
        }

        // Return minimal display info
        return reply.send({
          valid: true,
          orgName: invite.tenant.name,
          maskedEmail: maskEmail(invite.emailNorm),
          partyName: invite.party.name,
          expiresAt: invite.expiresAt.toISOString(),
        });
      } catch (err) {
        req.log?.error?.({ err }, "Failed to validate portal invite");
        return reply.code(500).send({ error: "validation_failed" });
      }
    }
  );

  /**
   * POST /api/v1/portal/invites/:token/accept
   *
   * Accept a portal invite token and create a session.
   * No auth required - this is a public endpoint.
   *
   * Body: { password: string }
   *
   * Transactional behavior:
   * 1. Resolve PortalInvite by tokenHash, ensure not used and not expired.
   * 2. Determine User:
   *    - If PortalInvite.userId exists, load it.
   *    - Else lookup User by emailNorm.
   *    - If missing, create User and attach verified email at acceptance.
   * 3. Upsert TenantMembership(userId, tenantId):
   *    - role = CLIENT (from invite.roleToGrant)
   *    - status = ACTIVE (from invite.statusToGrant)
   *    - partyId = invite.partyId
   *    Conflict rules:
   *    - If membership exists and partyId is null, set it.
   *    - If membership exists and partyId differs from invite.partyId, return conflict error.
   * 4. Backfill PortalInvite:
   *    - set userId
   *    - set membershipUserId
   *    - set usedAt
   * 5. Update PortalAccess for (tenantId, partyId):
   *    - set userId
   *    - set membershipUserId
   *    - status = ACTIVE
   *    - activatedAt
   * 6. Create session for the User and return success.
   *
   * Response: { ok: true, tenantSlug: string }
   */
  app.post<{ Params: { token: string }; Body: { password?: string; tosAcceptance?: unknown } }>(
    "/portal/invites/:token/accept",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      try {
        const { token } = req.params;
        const { password, tosAcceptance } = req.body || {};

        if (!token || typeof token !== "string") {
          return reply.code(400).send({ error: "token_required" });
        }

        // Validate ToS acceptance payload
        let tosPayload;
        try {
          tosPayload = validateTosAcceptancePayload(tosAcceptance);
        } catch (tosErr: any) {
          await auditFailure(req, "PORTAL_ACTIVATE_FAILURE", { reason: tosErr.message }, { surface: "PORTAL" });
          return reply.code(400).send({ code: tosErr.message });
        }
        const tokenHash = sha256(token);
        const now = new Date();

        // Find invite by tokenHash using new key-based schema
        const invite = await prisma.portalInvite.findUnique({
          where: { tokenHash },
          include: {
            tenant: { select: { id: true, slug: true, name: true } },
            party: { select: { id: true, name: true, email: true } },
          },
        });

        if (!invite) {
          await auditFailure(req, "PORTAL_ACTIVATE_FAILURE", { reason: "invalid_token" }, { surface: "PORTAL" });
          return reply.code(400).send({ error: "invalid_token" });
        }

        // Check if already used - handle idempotency
        if (invite.usedAt) {
          // Check if we can return success for idempotent replay
          if (invite.membershipUserId) {
            // Invite was accepted - check if membership is still active
            const membership = await (prisma as any).tenantMembership.findUnique({
              where: { userId_tenantId: { userId: invite.membershipUserId, tenantId: invite.tenantId } },
              select: { membershipStatus: true },
            });
            if (membership?.membershipStatus === "ACTIVE" && invite.tenant.slug) {
              // Set session and return success (idempotent replay)
              setSessionCookies(reply, { userId: invite.membershipUserId }, "PORTAL");
              return reply.send({ ok: true, tenantSlug: invite.tenant.slug });
            }
          }
          await auditFailure(req, "PORTAL_ACTIVATE_FAILURE", { reason: "token_already_used", inviteId: invite.id }, { surface: "PORTAL" });
          return reply.code(400).send({ error: "token_already_used" });
        }

        // Check expiration
        if (now >= invite.expiresAt) {
          await auditFailure(req, "PORTAL_ACTIVATE_FAILURE", { reason: "token_expired", inviteId: invite.id }, { surface: "PORTAL" });
          return reply.code(400).send({ error: "token_expired" });
        }

        const tenantId = invite.tenantId;
        const partyId = invite.partyId;
        const tenantSlug = invite.tenant.slug;

        if (!tenantSlug) {
          return reply.code(400).send({ error: "tenant_has_no_slug" });
        }

        // Transactional activation
        const result = await prisma.$transaction(async (tx) => {
          // 1. Determine user
          let userId: string;
          let isNewUser = false;

          if (invite.userId) {
            // User was linked at invite time
            userId = invite.userId;
          } else {
            // Lookup user by emailNorm
            const existingUser = await tx.user.findFirst({
              where: { email: invite.emailNorm },
              select: { id: true },
            });

            if (existingUser) {
              userId = existingUser.id;
            } else {
              // Create new user
              isNewUser = true;
              const nameParts = invite.party.name?.split(' ') || [];
              const firstName = nameParts[0] || 'Portal';
              const lastName = nameParts.slice(1).join(' ') || 'User';
              const newUser = await tx.user.create({
                data: {
                  email: invite.emailNorm,
                  name: invite.party.name,
                  firstName,
                  lastName,
                  emailVerifiedAt: now, // Email is verified since they have the invite token
                },
              });
              userId = newUser.id;
            }
          }

          // 2. Check for existing membership conflicts
          const existingMembership = await (tx as any).tenantMembership.findUnique({
            where: { userId_tenantId: { userId, tenantId } },
            select: { membershipRole: true, membershipStatus: true, partyId: true },
          });

          if (existingMembership) {
            // Check for STAFF suppression
            if (existingMembership.membershipRole === "STAFF") {
              throw new Error("STAFF_SUPPRESSION");
            }

            // Check for SUSPENDED
            if (existingMembership.membershipStatus === "SUSPENDED") {
              throw new Error("MEMBERSHIP_SUSPENDED");
            }

            // Check for partyId conflict
            if (existingMembership.partyId && existingMembership.partyId !== partyId) {
              throw new Error("PARTY_CONFLICT");
            }
          }

          // 3. Hash password if provided
          let passwordHash: string | undefined;
          if (password && typeof password === "string" && password.length >= 8) {
            passwordHash = await bcrypt.hash(password, 12);
          }

          // 4. Update user with password if provided
          if (passwordHash) {
            await tx.user.update({
              where: { id: userId },
              data: {
                passwordHash,
                passwordUpdatedAt: now,
              } as any,
            });
          }

          // 5. Upsert TenantMembership with role/status from invite
          await (tx as any).tenantMembership.upsert({
            where: { userId_tenantId: { userId, tenantId } },
            create: {
              userId,
              tenantId,
              role: "VIEWER", // Legacy role field - least privilege
              membershipRole: invite.roleToGrant,
              membershipStatus: invite.statusToGrant,
              partyId,
            },
            update: {
              membershipRole: invite.roleToGrant,
              membershipStatus: invite.statusToGrant,
              partyId,
            },
          });

          // 6. Update PortalAccess for (tenantId, partyId)
          const portalAccess = await tx.portalAccess.findUnique({
            where: { tenantId_partyId: { tenantId, partyId } },
          });

          if (portalAccess) {
            await tx.portalAccess.update({
              where: { id: portalAccess.id },
              data: {
                status: "ACTIVE",
                userId,
                membershipUserId: userId,
                activatedAt: now,
              },
            });
          }

          // 7. Backfill PortalInvite
          await tx.portalInvite.update({
            where: { id: invite.id },
            data: {
              userId,
              membershipUserId: userId,
              usedAt: now,
            },
          });

          return { userId, isNewUser };
        });

        // Record ToS acceptance (server-side timestamp)
        await writeTosAcceptance(result.userId, tosPayload, req);

        // Set session cookie (no tenantId - portal derives from URL slug)
        setSessionCookies(reply, { userId: result.userId }, "PORTAL");

        // Audit successful activation
        await auditSuccess(req, "PORTAL_ACTIVATE_SUCCESS", {
          userId: result.userId,
          tenantId,
          surface: "PORTAL",
          detail: { tenantSlug, isNewUser: result.isNewUser, inviteId: invite.id, partyId },
        });

        return reply.send({ ok: true, tenantSlug });
      } catch (err: any) {
        if (err.message === "STAFF_SUPPRESSION") {
          await auditFailure(req, "PORTAL_ACTIVATE_FAILURE", { reason: "staff_suppression" }, { surface: "PORTAL" });
          return reply.code(403).send({
            error: "staff_suppression",
            message: "Users with staff access cannot activate portal invites for the same tenant",
          });
        }
        if (err.message === "MEMBERSHIP_SUSPENDED") {
          await auditFailure(req, "PORTAL_ACTIVATE_FAILURE", { reason: "membership_suspended" }, { surface: "PORTAL" });
          return reply.code(403).send({
            error: "membership_suspended",
            message: "Your access to this portal has been suspended",
          });
        }
        if (err.message === "PARTY_CONFLICT") {
          await auditFailure(req, "PORTAL_ACTIVATE_FAILURE", { reason: "party_conflict" }, { surface: "PORTAL" });
          return reply.code(409).send({
            error: "party_conflict",
            message: "This user is already linked to a different party in this organization",
          });
        }

        req.log?.error?.({ err }, "Portal activation failed");
        return reply.code(500).send({ error: "activation_failed" });
      }
    }
  );

  /**
   * POST /api/v1/portal/activate (LEGACY)
   *
   * Legacy endpoint that accepts { token, password } in body.
   * Redirects to the new /portal/invites/:token/accept flow.
   */
  app.post<{ Body: { token?: string; password?: string; tosAcceptance?: unknown } }>(
    "/portal/activate",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { token, password, tosAcceptance } = req.body || {};

      if (!token || typeof token !== "string") {
        return reply.code(400).send({ error: "token_required" });
      }

      // Validate ToS acceptance payload
      let tosPayload;
      try {
        tosPayload = validateTosAcceptancePayload(tosAcceptance);
      } catch (tosErr: any) {
        await auditFailure(req, "PORTAL_ACTIVATE_FAILURE", { reason: tosErr.message }, { surface: "PORTAL" });
        return reply.code(400).send({ code: tosErr.message });
      }
      // Inject into the new endpoint
      (req.params as any).token = token;
      (req.body as any).password = password;

      // Forward to the new handler by calling it directly
      // This is a temporary bridge - the frontend should migrate to the new endpoint
      const tokenHash = sha256(token);
      const now = new Date();

      try {
        // Find invite by tokenHash using new key-based schema
        const invite = await prisma.portalInvite.findUnique({
          where: { tokenHash },
          include: {
            tenant: { select: { id: true, slug: true, name: true } },
            party: { select: { id: true, name: true, email: true } },
          },
        });

        if (!invite) {
          await auditFailure(req, "PORTAL_ACTIVATE_FAILURE", { reason: "invalid_token" }, { surface: "PORTAL" });
          return reply.code(400).send({ error: "invalid_token" });
        }

        // Check if already used - handle idempotency
        if (invite.usedAt) {
          if (invite.membershipUserId) {
            const membership = await (prisma as any).tenantMembership.findUnique({
              where: { userId_tenantId: { userId: invite.membershipUserId, tenantId: invite.tenantId } },
              select: { membershipStatus: true },
            });
            if (membership?.membershipStatus === "ACTIVE" && invite.tenant.slug) {
              setSessionCookies(reply, { userId: invite.membershipUserId }, "PORTAL");
              return reply.send({ ok: true, tenantSlug: invite.tenant.slug });
            }
          }
          await auditFailure(req, "PORTAL_ACTIVATE_FAILURE", { reason: "token_already_used", inviteId: invite.id }, { surface: "PORTAL" });
          return reply.code(400).send({ error: "token_already_used" });
        }

        if (now >= invite.expiresAt) {
          await auditFailure(req, "PORTAL_ACTIVATE_FAILURE", { reason: "token_expired", inviteId: invite.id }, { surface: "PORTAL" });
          return reply.code(400).send({ error: "token_expired" });
        }

        const tenantId = invite.tenantId;
        const partyId = invite.partyId;
        const tenantSlug = invite.tenant.slug;

        if (!tenantSlug) {
          return reply.code(400).send({ error: "tenant_has_no_slug" });
        }

        const result = await prisma.$transaction(async (tx) => {
          let userId: string;
          let isNewUser = false;

          if (invite.userId) {
            userId = invite.userId;
          } else {
            const existingUser = await tx.user.findFirst({
              where: { email: invite.emailNorm },
              select: { id: true },
            });

            if (existingUser) {
              userId = existingUser.id;
            } else {
              isNewUser = true;
              const nameParts = invite.party.name?.split(' ') || [];
              const firstName = nameParts[0] || 'Portal';
              const lastName = nameParts.slice(1).join(' ') || 'User';
              const newUser = await tx.user.create({
                data: {
                  email: invite.emailNorm,
                  name: invite.party.name,
                  firstName,
                  lastName,
                  emailVerifiedAt: now,
                },
              });
              userId = newUser.id;
            }
          }

          const existingMembership = await (tx as any).tenantMembership.findUnique({
            where: { userId_tenantId: { userId, tenantId } },
            select: { membershipRole: true, membershipStatus: true, partyId: true },
          });

          if (existingMembership) {
            if (existingMembership.membershipRole === "STAFF") {
              throw new Error("STAFF_SUPPRESSION");
            }
            if (existingMembership.membershipStatus === "SUSPENDED") {
              throw new Error("MEMBERSHIP_SUSPENDED");
            }
            if (existingMembership.partyId && existingMembership.partyId !== partyId) {
              throw new Error("PARTY_CONFLICT");
            }
          }

          let passwordHash: string | undefined;
          if (password && typeof password === "string" && password.length >= 8) {
            passwordHash = await bcrypt.hash(password, 12);
          }

          if (passwordHash) {
            await tx.user.update({
              where: { id: userId },
              data: { passwordHash, passwordUpdatedAt: now } as any,
            });
          }

          await (tx as any).tenantMembership.upsert({
            where: { userId_tenantId: { userId, tenantId } },
            create: {
              userId,
              tenantId,
              role: "VIEWER",
              membershipRole: invite.roleToGrant,
              membershipStatus: invite.statusToGrant,
              partyId,
            },
            update: {
              membershipRole: invite.roleToGrant,
              membershipStatus: invite.statusToGrant,
              partyId,
            },
          });

          const portalAccess = await tx.portalAccess.findUnique({
            where: { tenantId_partyId: { tenantId, partyId } },
          });

          if (portalAccess) {
            await tx.portalAccess.update({
              where: { id: portalAccess.id },
              data: {
                status: "ACTIVE",
                userId,
                membershipUserId: userId,
                activatedAt: now,
              },
            });
          }

          await tx.portalInvite.update({
            where: { id: invite.id },
            data: { userId, membershipUserId: userId, usedAt: now },
          });

          return { userId, isNewUser };
        });

        // Record ToS acceptance (server-side timestamp)
        await writeTosAcceptance(result.userId, tosPayload, req);

        setSessionCookies(reply, { userId: result.userId }, "PORTAL");

        await auditSuccess(req, "PORTAL_ACTIVATE_SUCCESS", {
          userId: result.userId,
          tenantId,
          surface: "PORTAL",
          detail: { tenantSlug, isNewUser: result.isNewUser, inviteId: invite.id },
        });

        return reply.send({ ok: true, tenantSlug });
      } catch (err: any) {
        if (err.message === "STAFF_SUPPRESSION") {
          await auditFailure(req, "PORTAL_ACTIVATE_FAILURE", { reason: "staff_suppression" }, { surface: "PORTAL" });
          return reply.code(403).send({
            error: "staff_suppression",
            message: "Users with staff access cannot activate portal invites for the same tenant",
          });
        }
        if (err.message === "MEMBERSHIP_SUSPENDED") {
          await auditFailure(req, "PORTAL_ACTIVATE_FAILURE", { reason: "membership_suspended" }, { surface: "PORTAL" });
          return reply.code(403).send({
            error: "membership_suspended",
            message: "Your access to this portal has been suspended",
          });
        }
        if (err.message === "PARTY_CONFLICT") {
          await auditFailure(req, "PORTAL_ACTIVATE_FAILURE", { reason: "party_conflict" }, { surface: "PORTAL" });
          return reply.code(409).send({
            error: "party_conflict",
            message: "This user is already linked to a different party in this organization",
          });
        }

        req.log?.error?.({ err }, "Portal activation failed");
        return reply.code(500).send({ error: "activation_failed" });
      }
    }
  );
};

export default portalRoutes;
