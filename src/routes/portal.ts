// src/routes/portal.ts
// Portal public routes (no auth required)
//
// POST /api/v1/portal/activate - Accept portal invite and create session

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { setSessionCookies } from "../utils/session.js";

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

const portalRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * POST /api/v1/portal/activate
   *
   * Accept a portal invite token and create a session.
   *
   * Body: { token: string, password?: string }
   *
   * Flow:
   * 1. Hash token -> match PortalInvite.tokenHash where usedAt is null and expiresAt in future
   * 2. Load PortalAccess -> Party -> tenantId
   * 3. Resolve or create User by Party.email (normalized)
   * 4. Enforce suppression: if user already has STAFF membership for that tenant, reject
   * 5. Upsert TenantMembership: userId, tenantId, partyId, role=CLIENT, status=ACTIVE
   * 6. Update PortalAccess: status=ACTIVE, userId set
   * 7. Mark PortalInvite.usedAt = now
   * 8. If password supplied: set user.passwordHash
   * 9. Issue signed session cookie (no tenantId - portal uses slug)
   *
   * Response: { ok: true, tenantSlug: string }
   */
  app.post<{ Body: { token?: string; password?: string } }>(
    "/portal/activate",
    async (req, reply) => {
      try {
        const { token, password } = req.body || {};

        if (!token || typeof token !== "string") {
          return reply.code(400).send({ error: "token_required" });
        }

        const tokenHash = sha256(token);
        const now = new Date();

        // Find the invite by tokenHash
        const invite = await prisma.portalInvite.findUnique({
          where: { tokenHash },
          include: {
            portalAccess: {
              include: {
                party: {
                  include: {
                    tenant: { select: { id: true, slug: true, name: true } },
                  },
                },
              },
            },
          },
        });

        if (!invite) {
          return reply.code(400).send({ error: "invalid_token" });
        }

        // Check if already used
        if (invite.usedAt) {
          // Idempotent: if the invite was already used, check if we can still return success
          // This happens when user refreshes the activation page after success
          const existingAccess = invite.portalAccess;
          if (existingAccess?.userId && existingAccess.status === "ACTIVE") {
            const tenant = existingAccess.party?.tenant;
            if (tenant?.slug) {
              // Set session and return success
              setSessionCookies(reply, { userId: existingAccess.userId });
              return reply.send({ ok: true, tenantSlug: tenant.slug });
            }
          }
          return reply.code(400).send({ error: "token_already_used" });
        }

        // Check expiration
        if (now >= invite.expiresAt) {
          return reply.code(400).send({ error: "token_expired" });
        }

        const portalAccess = invite.portalAccess;
        if (!portalAccess) {
          return reply.code(400).send({ error: "invalid_portal_access" });
        }

        const party = portalAccess.party;
        if (!party) {
          return reply.code(400).send({ error: "invalid_party" });
        }

        const tenant = party.tenant;
        if (!tenant) {
          return reply.code(400).send({ error: "invalid_tenant" });
        }

        if (!party.email) {
          return reply.code(400).send({ error: "party_has_no_email" });
        }

        const email = normalizeEmail(party.email);
        const tenantId = tenant.id;
        const tenantSlug = tenant.slug;

        if (!tenantSlug) {
          return reply.code(400).send({ error: "tenant_has_no_slug" });
        }

        // Transactional activation
        const result = await prisma.$transaction(async (tx) => {
          // 1. Resolve or create user by email
          let user = await tx.user.findFirst({
            where: { email },
            select: {
              id: true,
              email: true,
              tenantMemberships: {
                where: { tenantId },
                select: {
                  membershipRole: true,
                  membershipStatus: true,
                },
              },
            },
          });

          let userId: string;
          let isNewUser = false;

          if (user) {
            userId = user.id;

            // Check for STAFF suppression: if user has STAFF membership for this tenant, reject
            const existingMembership = user.tenantMemberships[0];
            if (existingMembership?.membershipRole === "STAFF") {
              throw new Error("STAFF_SUPPRESSION");
            }

            // Check for SUSPENDED: if membership exists and is suspended, reject
            if (existingMembership?.membershipStatus === "SUSPENDED") {
              throw new Error("MEMBERSHIP_SUSPENDED");
            }

            // If membership exists and is already ACTIVE, this is idempotent
            if (existingMembership?.membershipStatus === "ACTIVE") {
              // Already active - just mark token used and continue
            }
          } else {
            // Create new user
            isNewUser = true;
            const newUser = await tx.user.create({
              data: {
                email,
                name: party.name,
                emailVerifiedAt: now, // Email is verified since they have the invite token
              },
            });
            userId = newUser.id;
          }

          // 2. Hash password if provided
          let passwordHash: string | undefined;
          if (password && typeof password === "string" && password.length >= 8) {
            passwordHash = await bcrypt.hash(password, 12);
          }

          // 3. Update user with password if provided
          if (passwordHash) {
            await tx.user.update({
              where: { id: userId },
              data: {
                passwordHash,
                passwordUpdatedAt: now,
              } as any,
            });
          }

          // 4. Upsert TenantMembership with CLIENT role and ACTIVE status
          await (tx as any).tenantMembership.upsert({
            where: { userId_tenantId: { userId, tenantId } },
            create: {
              userId,
              tenantId,
              role: "VIEWER", // Legacy role field - least privilege
              membershipRole: "CLIENT",
              membershipStatus: "ACTIVE",
              partyId: party.id,
            },
            update: {
              membershipRole: "CLIENT",
              membershipStatus: "ACTIVE",
              partyId: party.id,
            },
          });

          // 5. Update PortalAccess
          await tx.portalAccess.update({
            where: { id: portalAccess.id },
            data: {
              status: "ACTIVE",
              userId,
              activatedAt: now,
            },
          });

          // 6. Mark invite as used
          await tx.portalInvite.update({
            where: { id: invite.id },
            data: { usedAt: now },
          });

          return { userId, isNewUser };
        });

        // Set session cookie (no tenantId - portal derives from URL slug)
        setSessionCookies(reply, { userId: result.userId });

        return reply.send({ ok: true, tenantSlug });
      } catch (err: any) {
        if (err.message === "STAFF_SUPPRESSION") {
          return reply.code(403).send({
            error: "staff_suppression",
            message: "Users with staff access cannot activate portal invites for the same tenant",
          });
        }
        if (err.message === "MEMBERSHIP_SUSPENDED") {
          return reply.code(403).send({
            error: "membership_suspended",
            message: "Your access to this portal has been suspended",
          });
        }

        req.log?.error?.({ err }, "Portal activation failed");
        return reply.code(500).send({ error: "activation_failed" });
      }
    }
  );
};

export default portalRoutes;
