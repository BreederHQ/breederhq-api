// src/routes/staff.ts
// Staff Management API — lets Owners/Admins invite users, assign roles,
// and manage team membership within a tenant.

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { TenantRole } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";
import { requirePermission } from "../middleware/require-permission.js";
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APP_URL = process.env.APP_URL || "https://app.breederhq.com";
const INVITE_TTL_HOURS = 72; // 3 days

/** Roles that can be assigned to invited staff (never OWNER/ADMIN from invite) */
const ASSIGNABLE_ROLES = [
  "MANAGER",
  "BREEDING_STAFF",
  "BARN_STAFF",
  "FINANCE",
  "VIEWER",
] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** All valid TenantRole values (for role changes by OWNER/ADMIN) */
const ALL_STAFF_ROLES = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "BREEDING_STAFF",
  "BARN_STAFF",
  "FINANCE",
  "VIEWER",
  "MEMBER",
  "BILLING",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function newRawToken(): string {
  return b64url(randomBytes(32));
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

async function sendStaffInviteEmail(
  tenantId: number,
  toEmail: string,
  recipientName: string,
  roleName: string,
  personalMessage: string | null,
  rawToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  const orgName = tenant?.name || "Your Organization";

  const activationUrl = `${APP_URL}/invite?token=${rawToken}`;
  const expiryDays = Math.floor(INVITE_TTL_HOURS / 24);

  const bodyParts: string[] = [
    emailGreeting(recipientName),
    emailParagraph(
      `${emailAccent(orgName)} has invited you to join their team as <strong>${roleName}</strong>.`,
    ),
  ];

  if (personalMessage) {
    bodyParts.push(
      emailInfoCard(
        `<p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5; font-style: italic;">"${personalMessage}"</p>`,
        { borderColor: "orange" },
      ),
    );
  }

  bodyParts.push(
    emailFeatureList([
      "Manage animals and breeding records",
      "Track health and reproductive data",
      "Collaborate with your team in real time",
    ]),
    emailButton("Accept Invitation", activationUrl),
    emailInfoCard(
      `<p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
        ${emailAccent(`&#9432; Expires in ${expiryDays} days`)}<br>
        <span style="color: #a3a3a3;">If your link expires, ask ${orgName} to resend the invitation.</span>
      </p>`,
      { borderColor: "orange" },
    ),
    emailFootnote("Didn't expect this? You can safely ignore this email."),
  );

  const html = wrapEmailLayout({
    title: `You're Invited to Join ${orgName}`,
    footerOrgName: orgName,
    body: bodyParts.join("\n"),
  });

  const text = `
You're Invited to Join ${orgName}

Hello ${recipientName},

${orgName} has invited you to join their team as ${roleName}.
${personalMessage ? `\nPersonal message: "${personalMessage}"\n` : ""}
Through the platform, you'll be able to:
- Manage animals and breeding records
- Track health and reproductive data
- Collaborate with your team in real time

Accept your invitation by visiting:
${activationUrl}

This link will expire in ${expiryDays} days. If the link expires, please ask ${orgName} to resend the invitation.

If you weren't expecting this invitation, you can safely ignore this email.

---
This invitation was sent by ${orgName} via BreederHQ
  `.trim();

  return sendEmail({
    tenantId,
    to: toEmail,
    subject: `You're Invited to Join ${orgName} on BreederHQ`,
    html,
    text,
    templateKey: "staff_invite",
    category: "transactional",
  });
}

/** Human-readable role label for emails */
function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    MANAGER: "Manager",
    BREEDING_STAFF: "Breeding Staff",
    BARN_STAFF: "Barn Staff",
    FINANCE: "Finance",
    VIEWER: "Viewer",
    MEMBER: "Member",
    BILLING: "Billing",
  };
  return labels[role] || role;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const staffRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // -----------------------------------------------------------------------
  // GET /api/v1/staff
  // List all staff members in the current tenant
  // -----------------------------------------------------------------------
  app.get(
    "/staff",
    { preHandler: requirePermission("staff.view") },
    async (req, reply) => {
      try {
        const tenantId = req.tenantId as number;

        const memberships = await prisma.tenantMembership.findMany({
          where: {
            tenantId,
            membershipRole: "STAFF",
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                image: true,
                lastLoginAt: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        });

        const items = memberships.map((m) => ({
          userId: m.userId,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          email: m.user.email,
          image: m.user.image,
          role: m.role,
          membershipStatus: m.membershipStatus,
          createdAt: m.createdAt.toISOString(),
          lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
        }));

        return reply.send({ items, total: items.length });
      } catch (err) {
        req.log?.error?.({ err }, "Failed to list staff");
        return reply.code(500).send({ error: "list_failed" });
      }
    },
  );

  // -----------------------------------------------------------------------
  // POST /api/v1/staff/invite
  // Invite a new staff member
  // -----------------------------------------------------------------------
  app.post(
    "/staff/invite",
    {
      preHandler: requirePermission("staff.*"),
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      try {
        const tenantId = req.tenantId as number;
        const actorId = getActorId(req);
        if (!actorId) return reply.code(401).send({ error: "unauthorized" });

        const body = (req.body || {}) as {
          email?: string;
          firstName?: string;
          lastName?: string;
          role?: string;
          message?: string;
        };

        // Validate required fields
        const email = body.email?.trim();
        const firstName = body.firstName?.trim();
        const lastName = body.lastName?.trim();
        const role = body.role as AssignableRole | undefined;
        const personalMessage = body.message?.trim() || null;

        if (!email) return reply.code(400).send({ error: "email_required" });
        if (!firstName)
          return reply.code(400).send({ error: "first_name_required" });
        if (!lastName)
          return reply.code(400).send({ error: "last_name_required" });
        if (!role || !ASSIGNABLE_ROLES.includes(role))
          return reply.code(400).send({
            error: "invalid_role",
            message: `Role must be one of: ${ASSIGNABLE_ROLES.join(", ")}`,
          });

        const emailNorm = normalizeEmail(email);

        // Check for existing membership in this tenant
        const existingUser = await prisma.user.findFirst({
          where: { email: emailNorm },
          select: { id: true, firstName: true, lastName: true, email: true },
        });

        if (existingUser) {
          // Check if already a member of this tenant
          const existingMembership =
            await prisma.tenantMembership.findUnique({
              where: {
                userId_tenantId: {
                  userId: existingUser.id,
                  tenantId,
                },
              },
            });

          if (existingMembership) {
            if (
              existingMembership.membershipRole === "STAFF" &&
              existingMembership.membershipStatus === "ACTIVE"
            ) {
              return reply
                .code(409)
                .send({ error: "already_staff_member" });
            }
            if (existingMembership.membershipStatus === "INVITED") {
              return reply
                .code(409)
                .send({ error: "already_invited" });
            }
            // If SUSPENDED or CLIENT, update to STAFF + INVITED
            await prisma.tenantMembership.update({
              where: {
                userId_tenantId: {
                  userId: existingUser.id,
                  tenantId,
                },
              },
              data: {
                role,
                membershipRole: "STAFF",
                membershipStatus: "INVITED",
              },
            });
          } else {
            // Create new membership
            await prisma.tenantMembership.create({
              data: {
                userId: existingUser.id,
                tenantId,
                role,
                membershipRole: "STAFF",
                membershipStatus: "INVITED",
              },
            });
          }

          // Create invite token so user can accept
          const rawToken = newRawToken();
          const tokenHash = sha256(rawToken);
          const expiresAt = new Date(
            Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000,
          );

          await prisma.verificationToken.create({
            data: {
              identifier: emailNorm,
              tokenHash,
              purpose: "INVITE",
              userId: existingUser.id,
              expires: expiresAt,
            },
          });

          await sendStaffInviteEmail(
            tenantId,
            email,
            `${existingUser.firstName || firstName} ${existingUser.lastName || lastName}`,
            roleLabel(role),
            personalMessage,
            rawToken,
          );

          await auditSuccess(req, "STAFF_INVITE_CREATED", {
            userId: actorId,
            tenantId,
            surface: "PLATFORM",
            detail: {
              invitedEmail: emailNorm,
              invitedUserId: existingUser.id,
              role,
            },
          });

          return reply.code(201).send({
            invited: true,
            userId: existingUser.id,
            email: emailNorm,
            role,
            membershipStatus: "INVITED",
          });
        }

        // User does not exist — create a new User record (no password)
        const newUser = await prisma.user.create({
          data: {
            email: emailNorm,
            firstName,
            lastName,
            // No password hash — user will set password via invite link
          },
        });

        // Create TenantMembership
        await prisma.tenantMembership.create({
          data: {
            userId: newUser.id,
            tenantId,
            role,
            membershipRole: "STAFF",
            membershipStatus: "INVITED",
          },
        });

        // Create invite/verification token so user can set password and accept
        const rawToken = newRawToken();
        const tokenHash = sha256(rawToken);
        const expiresAt = new Date(
          Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000,
        );

        await prisma.verificationToken.create({
          data: {
            identifier: emailNorm,
            tokenHash,
            purpose: "INVITE",
            userId: newUser.id,
            expires: expiresAt,
          },
        });

        await sendStaffInviteEmail(
          tenantId,
          email,
          `${firstName} ${lastName}`,
          roleLabel(role),
          personalMessage,
          rawToken,
        );

        await auditSuccess(req, "STAFF_INVITE_CREATED", {
          userId: actorId,
          tenantId,
          surface: "PLATFORM",
          detail: {
            invitedEmail: emailNorm,
            invitedUserId: newUser.id,
            role,
            newUserCreated: true,
          },
        });

        return reply.code(201).send({
          invited: true,
          userId: newUser.id,
          email: emailNorm,
          role,
          membershipStatus: "INVITED",
        });
      } catch (err) {
        req.log?.error?.({ err }, "Failed to invite staff");
        return reply.code(500).send({ error: "invite_failed" });
      }
    },
  );

  // -----------------------------------------------------------------------
  // PATCH /api/v1/staff/:userId/role
  // Update a staff member's role
  // -----------------------------------------------------------------------
  app.patch(
    "/staff/:userId/role",
    { preHandler: requirePermission("staff.*") },
    async (req, reply) => {
      try {
        const tenantId = req.tenantId as number;
        const actorId = getActorId(req);
        if (!actorId) return reply.code(401).send({ error: "unauthorized" });

        const targetUserId = (req.params as { userId: string }).userId;
        const body = (req.body || {}) as { role?: string };
        const newRole = body.role;

        if (!newRole || !ALL_STAFF_ROLES.includes(newRole as any)) {
          return reply.code(400).send({
            error: "invalid_role",
            message: `Role must be one of: ${ALL_STAFF_ROLES.join(", ")}`,
          });
        }

        // Find existing membership
        const membership = await prisma.tenantMembership.findUnique({
          where: {
            userId_tenantId: { userId: targetUserId, tenantId },
          },
        });

        if (!membership || membership.membershipRole !== "STAFF") {
          return reply
            .code(404)
            .send({ error: "staff_member_not_found" });
        }

        // Cannot demote/change the last OWNER
        if (membership.role === "OWNER" && newRole !== "OWNER") {
          const ownerCount = await prisma.tenantMembership.count({
            where: {
              tenantId,
              role: "OWNER",
              membershipRole: "STAFF",
              membershipStatus: { not: "SUSPENDED" },
            },
          });

          if (ownerCount <= 1) {
            return reply.code(400).send({
              error: "last_owner",
              message:
                "Cannot change the role of the last active owner. Promote another user to Owner first.",
            });
          }
        }

        const previousRole = membership.role;

        await prisma.tenantMembership.update({
          where: {
            userId_tenantId: { userId: targetUserId, tenantId },
          },
          data: { role: newRole as TenantRole },
        });

        await auditSuccess(req, "STAFF_ROLE_CHANGED", {
          userId: actorId,
          tenantId,
          surface: "PLATFORM",
          detail: {
            targetUserId,
            previousRole,
            newRole,
          },
        });

        return reply.send({
          userId: targetUserId,
          role: newRole,
          previousRole,
        });
      } catch (err) {
        req.log?.error?.({ err }, "Failed to update staff role");
        return reply.code(500).send({ error: "role_update_failed" });
      }
    },
  );

  // -----------------------------------------------------------------------
  // PATCH /api/v1/staff/:userId/status
  // Suspend or reactivate a staff member
  // -----------------------------------------------------------------------
  app.patch(
    "/staff/:userId/status",
    { preHandler: requirePermission("staff.*") },
    async (req, reply) => {
      try {
        const tenantId = req.tenantId as number;
        const actorId = getActorId(req);
        if (!actorId) return reply.code(401).send({ error: "unauthorized" });

        const targetUserId = (req.params as { userId: string }).userId;
        const body = (req.body || {}) as { status?: string };
        const newStatus = body.status;

        if (!newStatus || !["ACTIVE", "SUSPENDED"].includes(newStatus)) {
          return reply.code(400).send({
            error: "invalid_status",
            message: "Status must be ACTIVE or SUSPENDED",
          });
        }

        // Find existing membership
        const membership = await prisma.tenantMembership.findUnique({
          where: {
            userId_tenantId: { userId: targetUserId, tenantId },
          },
        });

        if (!membership || membership.membershipRole !== "STAFF") {
          return reply
            .code(404)
            .send({ error: "staff_member_not_found" });
        }

        // Cannot suspend yourself
        if (targetUserId === actorId && newStatus === "SUSPENDED") {
          return reply
            .code(400)
            .send({ error: "cannot_suspend_self" });
        }

        // Cannot suspend the last OWNER
        if (
          membership.role === "OWNER" &&
          newStatus === "SUSPENDED"
        ) {
          const ownerCount = await prisma.tenantMembership.count({
            where: {
              tenantId,
              role: "OWNER",
              membershipRole: "STAFF",
              membershipStatus: { not: "SUSPENDED" },
            },
          });

          if (ownerCount <= 1) {
            return reply.code(400).send({
              error: "last_owner",
              message:
                "Cannot suspend the last active owner. Promote another user to Owner first.",
            });
          }
        }

        const previousStatus = membership.membershipStatus;

        await prisma.tenantMembership.update({
          where: {
            userId_tenantId: { userId: targetUserId, tenantId },
          },
          data: { membershipStatus: newStatus as any },
        });

        // If suspending, also invalidate all their sessions
        if (newStatus === "SUSPENDED") {
          await prisma.session.deleteMany({
            where: { userId: targetUserId },
          });
        }

        await auditSuccess(req, "STAFF_STATUS_CHANGED", {
          userId: actorId,
          tenantId,
          surface: "PLATFORM",
          detail: {
            targetUserId,
            previousStatus,
            newStatus,
          },
        });

        return reply.send({
          userId: targetUserId,
          membershipStatus: newStatus,
          previousStatus,
        });
      } catch (err) {
        req.log?.error?.({ err }, "Failed to update staff status");
        return reply.code(500).send({ error: "status_update_failed" });
      }
    },
  );
};

export default staffRoutes;
