// src/routes/portal-profile.ts
// Portal profile endpoints for client self-service profile management
//
// GET   /api/v1/portal/profile                      - Get profile + pending changes
// PATCH /api/v1/portal/profile                      - Update self-service fields (address, phones)
// POST  /api/v1/portal/profile/request-name-change  - Request name field change (approval required)
// DELETE /api/v1/portal/profile/change-requests/:id - Cancel a pending name change request
// POST  /api/v1/portal/profile/request-email-change - Start email change verification flow
// POST  /api/v1/portal/profile/verify-email         - Complete email change with token

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { requireClientPartyScope } from "../middleware/actor-context.js";
import { sendEmail } from "../services/email-service.js";

// Base URL for verification links (from env or default)
const BASE_URL = process.env.PORTAL_BASE_URL || process.env.APP_BASE_URL || "https://portal.breederhq.com";

// Helper to log party activity (non-blocking)
async function logPartyActivity(
  tenantId: number,
  partyId: number,
  kind: string,
  title: string,
  detail?: string,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.partyActivity.create({
      data: {
        tenantId,
        partyId,
        kind: kind as any,
        title,
        detail,
        metadata: metadata as any,
      },
    });
  } catch (err) {
    console.error("Failed to log party activity:", err);
  }
}

// Valid name fields that require approval
const APPROVAL_FIELDS = ["firstName", "lastName", "nickname"] as const;
type ApprovalField = (typeof APPROVAL_FIELDS)[number];

function isApprovalField(field: string): field is ApprovalField {
  return APPROVAL_FIELDS.includes(field as ApprovalField);
}

const portalProfileRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/portal/profile
   * Returns the client's current profile info and any pending change requests
   */
  app.get("/portal/profile", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);

      // Get the contact record linked to this party
      const contact = await prisma.contact.findFirst({
        where: {
          tenantId,
          partyId,
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          nickname: true,
          email: true,
          phoneE164: true,
          whatsappE164: true,
          street: true,
          street2: true,
          city: true,
          state: true,
          zip: true,
          country: true,
        },
      });

      if (!contact) {
        return reply.code(404).send({ error: "profile_not_found" });
      }

      // Get pending change requests
      const pendingChanges = await prisma.contactChangeRequest.findMany({
        where: {
          contactId: contact.id,
          status: "PENDING",
        },
        select: {
          id: true,
          fieldName: true,
          newValue: true,
          requestedAt: true,
          status: true,
        },
        orderBy: { requestedAt: "desc" },
      });

      // Get pending email change request
      const pendingEmailChange = await prisma.emailChangeRequest.findFirst({
        where: {
          contactId: contact.id,
          status: "PENDING_VERIFICATION",
        },
        select: {
          newEmail: true,
          requestedAt: true,
          status: true,
        },
      });

      return reply.send({
        profile: {
          firstName: contact.first_name,
          lastName: contact.last_name,
          nickname: contact.nickname,
          email: contact.email,
          phoneMobile: contact.phoneE164,
          phoneLandline: null, // Not currently tracked separately
          whatsapp: contact.whatsappE164,
          street: contact.street,
          street2: contact.street2,
          city: contact.city,
          state: contact.state,
          postalCode: contact.zip,
          country: contact.country,
        },
        pendingChanges: pendingChanges.map((pc) => ({
          id: pc.id,
          fieldName: pc.fieldName,
          newValue: pc.newValue,
          requestedAt: pc.requestedAt.toISOString(),
          status: pc.status,
        })),
        pendingEmailChange: pendingEmailChange
          ? {
              newEmail: pendingEmailChange.newEmail,
              requestedAt: pendingEmailChange.requestedAt.toISOString(),
              status: pendingEmailChange.status,
            }
          : null,
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to load portal profile");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * PATCH /api/v1/portal/profile
   * Update self-service fields (address, phones). Creates audit entry.
   */
  app.patch<{
    Body: {
      phoneMobile?: string | null;
      whatsapp?: string | null;
      street?: string | null;
      street2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string | null;
    };
  }>("/portal/profile", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const body = req.body || {};

      // Get the contact record linked to this party
      const contact = await prisma.contact.findFirst({
        where: {
          tenantId,
          partyId,
        },
      });

      if (!contact) {
        return reply.code(404).send({ error: "profile_not_found" });
      }

      // Build update data - only include allowed self-service fields
      const updateData: Record<string, string | null> = {};
      const changedFields: string[] = [];

      if ("phoneMobile" in body) {
        updateData.phoneE164 = body.phoneMobile || null;
        changedFields.push("phoneMobile");
      }
      if ("whatsapp" in body) {
        updateData.whatsappE164 = body.whatsapp || null;
        changedFields.push("whatsapp");
      }
      if ("street" in body) {
        updateData.street = body.street || null;
        changedFields.push("street");
      }
      if ("street2" in body) {
        updateData.street2 = body.street2 || null;
        changedFields.push("street2");
      }
      if ("city" in body) {
        updateData.city = body.city || null;
        changedFields.push("city");
      }
      if ("state" in body) {
        updateData.state = body.state || null;
        changedFields.push("state");
      }
      if ("postalCode" in body) {
        updateData.zip = body.postalCode || null;
        changedFields.push("postalCode");
      }
      if ("country" in body) {
        updateData.country = body.country || null;
        changedFields.push("country");
      }

      if (changedFields.length === 0) {
        return reply.code(400).send({ error: "no_changes" });
      }

      // Update the contact
      const updatedContact = await prisma.contact.update({
        where: { id: contact.id },
        data: updateData,
        select: {
          id: true,
          first_name: true,
          last_name: true,
          nickname: true,
          email: true,
          phoneE164: true,
          whatsappE164: true,
          street: true,
          street2: true,
          city: true,
          state: true,
          zip: true,
          country: true,
        },
      });

      // Log activity
      await logPartyActivity(
        tenantId,
        partyId,
        "PROFILE_UPDATED_BY_CLIENT",
        "Profile updated by client",
        `Fields updated: ${changedFields.join(", ")}`,
        { changedFields, contactId: contact.id }
      );

      return reply.send({
        ok: true,
        profile: {
          firstName: updatedContact.first_name,
          lastName: updatedContact.last_name,
          nickname: updatedContact.nickname,
          email: updatedContact.email,
          phoneMobile: updatedContact.phoneE164,
          phoneLandline: null,
          whatsapp: updatedContact.whatsappE164,
          street: updatedContact.street,
          street2: updatedContact.street2,
          city: updatedContact.city,
          state: updatedContact.state,
          postalCode: updatedContact.zip,
          country: updatedContact.country,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to update portal profile");
      return reply.code(500).send({ error: "update_failed" });
    }
  });

  /**
   * POST /api/v1/portal/profile/request-name-change
   * Request a name field change (requires breeder approval)
   */
  app.post<{
    Body: {
      fieldName: string;
      newValue: string;
    };
  }>("/portal/profile/request-name-change", async (req, reply) => {
    try {
      const { tenantId, partyId, userId } = await requireClientPartyScope(req);
      const { fieldName, newValue } = req.body || {};

      req.log?.info?.({ tenantId, partyId, userId, fieldName, newValue }, "Processing name change request");

      // Validate field name
      if (!fieldName || !isApprovalField(fieldName)) {
        return reply.code(400).send({
          error: "invalid_field",
          message: `Field must be one of: ${APPROVAL_FIELDS.join(", ")}`,
        });
      }

      // Validate new value
      if (!newValue || typeof newValue !== "string" || newValue.trim().length === 0) {
        return reply.code(400).send({ error: "invalid_value" });
      }

      const trimmedValue = newValue.trim();

      // Get the contact record
      const contact = await prisma.contact.findFirst({
        where: {
          tenantId,
          partyId,
        },
      });

      if (!contact) {
        return reply.code(404).send({ error: "profile_not_found" });
      }

      // Check for existing pending request for same field
      const existingRequest = await prisma.contactChangeRequest.findFirst({
        where: {
          contactId: contact.id,
          fieldName,
          status: "PENDING",
        },
      });

      if (existingRequest) {
        return reply.code(409).send({
          error: "request_exists",
          message: `You already have a pending change request for ${fieldName}`,
          existingRequestId: existingRequest.id,
        });
      }

      // Get old value
      const fieldMap: Record<ApprovalField, string | null> = {
        firstName: contact.first_name,
        lastName: contact.last_name,
        nickname: contact.nickname,
      };
      const oldValue = fieldMap[fieldName];

      // Don't create request if value is the same
      if (oldValue === trimmedValue) {
        return reply.code(400).send({ error: "no_change" });
      }

      // Create the change request
      const changeRequest = await prisma.contactChangeRequest.create({
        data: {
          tenantId,
          contactId: contact.id,
          fieldName,
          oldValue,
          newValue: trimmedValue,
          status: "PENDING",
          requestedAt: new Date(),
          requestedBy: userId,
        },
      });

      // Log activity
      await logPartyActivity(
        tenantId,
        partyId,
        "NAME_CHANGE_REQUESTED",
        `Name change requested: ${fieldName}`,
        `Requested to change ${fieldName} from "${oldValue || "(empty)"}" to "${trimmedValue}"`,
        { fieldName, oldValue, newValue: trimmedValue, requestId: changeRequest.id }
      );

      return reply.send({
        ok: true,
        request: {
          id: changeRequest.id,
          fieldName: changeRequest.fieldName,
          newValue: changeRequest.newValue,
          status: changeRequest.status,
          requestedAt: changeRequest.requestedAt.toISOString(),
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err, stack: err.stack }, "Failed to create name change request");
      return reply.code(500).send({
        error: "request_failed",
        detail: process.env.NODE_ENV === "development" ? err.message : undefined
      });
    }
  });

  /**
   * DELETE /api/v1/portal/profile/change-requests/:id
   * Cancel a pending name change request
   */
  app.delete<{ Params: { id: string } }>(
    "/portal/profile/change-requests/:id",
    async (req, reply) => {
      try {
        const { tenantId, partyId } = await requireClientPartyScope(req);
        const requestId = parseInt(req.params.id, 10);

        if (isNaN(requestId)) {
          return reply.code(400).send({ error: "invalid_id" });
        }

        // Get the contact for this party
        const contact = await prisma.contact.findFirst({
          where: { tenantId, partyId },
        });

        if (!contact) {
          return reply.code(404).send({ error: "profile_not_found" });
        }

        // Find the change request
        const changeRequest = await prisma.contactChangeRequest.findFirst({
          where: {
            id: requestId,
            contactId: contact.id,
            status: "PENDING",
          },
        });

        if (!changeRequest) {
          return reply.code(404).send({ error: "request_not_found" });
        }

        // Update to cancelled
        await prisma.contactChangeRequest.update({
          where: { id: requestId },
          data: {
            status: "CANCELLED",
            resolvedAt: new Date(),
          },
        });

        return reply.send({ ok: true });
      } catch (err: any) {
        req.log?.error?.({ err }, "Failed to cancel change request");
        return reply.code(500).send({ error: "cancel_failed" });
      }
    }
  );

  /**
   * POST /api/v1/portal/profile/request-email-change
   * Start email change flow - sends verification to new email
   * NOTE: Re-authentication is handled by the frontend before calling this
   */
  app.post<{
    Body: {
      newEmail: string;
    };
  }>("/portal/profile/request-email-change", async (req, reply) => {
    try {
      const { tenantId, partyId, userId } = await requireClientPartyScope(req);
      const { newEmail } = req.body || {};

      // Validate email
      if (!newEmail || typeof newEmail !== "string") {
        return reply.code(400).send({ error: "invalid_email" });
      }

      const normalizedEmail = newEmail.toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return reply.code(400).send({ error: "invalid_email_format" });
      }

      // Get the contact
      const contact = await prisma.contact.findFirst({
        where: { tenantId, partyId },
      });

      if (!contact) {
        return reply.code(404).send({ error: "profile_not_found" });
      }

      // Check if email is same as current
      if (contact.email?.toLowerCase() === normalizedEmail) {
        return reply.code(400).send({ error: "same_email" });
      }

      // Check for existing pending email change
      const existingRequest = await prisma.emailChangeRequest.findFirst({
        where: {
          contactId: contact.id,
          status: "PENDING_VERIFICATION",
        },
      });

      if (existingRequest) {
        // Cancel existing and create new
        await prisma.emailChangeRequest.update({
          where: { id: existingRequest.id },
          data: { status: "CANCELLED" },
        });
      }

      // Create new email change request with 24-hour expiry
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const emailRequest = await prisma.emailChangeRequest.create({
        data: {
          tenantId,
          contactId: contact.id,
          oldEmail: contact.email,
          newEmail: normalizedEmail,
          status: "PENDING_VERIFICATION",
          requestedAt: new Date(),
          expiresAt,
        },
      });

      // Log activity
      await logPartyActivity(
        tenantId,
        partyId,
        "EMAIL_CHANGE_REQUESTED",
        "Email change requested",
        `Requested to change email to ${normalizedEmail}`,
        { newEmail: normalizedEmail, requestId: emailRequest.id }
      );

      // B-05 FIX: Send verification email to new email address
      const verifyUrl = `${BASE_URL}/verify-email?token=${emailRequest.verificationToken}`;

      try {
        await sendEmail({
          tenantId,
          to: normalizedEmail,
          subject: "Verify your new email address",
          html: `
            <h2>Verify your new email address</h2>
            <p>You requested to change your email address. Click the link below to verify this email:</p>
            <p><a href="${verifyUrl}">Verify Email Address</a></p>
            <p>Or copy this link: ${verifyUrl}</p>
            <p>This link expires in 24 hours.</p>
            <p>If you didn't request this change, you can safely ignore this email.</p>
          `,
          text: `Verify your new email address\n\nYou requested to change your email address. Click the link below to verify:\n\n${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't request this change, you can safely ignore this email.`,
          category: "transactional",
          metadata: { type: "email_change_verification", requestId: emailRequest.id },
        });
      } catch (emailErr: any) {
        req.log?.error?.({ err: emailErr }, "Failed to send verification email");
        // Roll back the request if we can't send the email
        await prisma.emailChangeRequest.update({
          where: { id: emailRequest.id },
          data: { status: "CANCELLED" },
        });
        return reply.code(500).send({
          error: "email_send_failed",
          message: "Unable to send verification email. Please try again.",
        });
      }

      return reply.send({
        ok: true,
        message: "Verification email sent to " + normalizedEmail,
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to request email change");
      return reply.code(500).send({ error: "request_failed" });
    }
  });

  /**
   * POST /api/v1/portal/profile/verify-email
   * Complete email change with verification token (from email link)
   */
  app.post<{
    Body: {
      token: string;
    };
  }>("/portal/profile/verify-email", async (req, reply) => {
    try {
      const { token } = req.body || {};

      if (!token || typeof token !== "string") {
        return reply.code(400).send({ error: "token_required" });
      }

      // Find the email change request by token
      const emailRequest = await prisma.emailChangeRequest.findUnique({
        where: { verificationToken: token },
        include: {
          contact: {
            select: {
              id: true,
              partyId: true,
              email: true,
            },
          },
        },
      });

      if (!emailRequest) {
        return reply.code(400).send({ error: "invalid_token" });
      }

      // Check status
      if (emailRequest.status !== "PENDING_VERIFICATION") {
        return reply.code(400).send({ error: "token_already_used" });
      }

      // Check expiry
      if (new Date() > emailRequest.expiresAt) {
        await prisma.emailChangeRequest.update({
          where: { id: emailRequest.id },
          data: { status: "EXPIRED" },
        });
        return reply.code(400).send({ error: "token_expired" });
      }

      // B-05 FIX: Update contact email, linked User email, and mark request as verified
      await prisma.$transaction(async (tx) => {
        // Update contact email
        await tx.contact.update({
          where: { id: emailRequest.contactId },
          data: { email: emailRequest.newEmail },
        });

        // Mark email request as verified
        await tx.emailChangeRequest.update({
          where: { id: emailRequest.id },
          data: {
            status: "VERIFIED",
            verifiedAt: new Date(),
          },
        });

        // B-05 FIX: Update User email if this contact's party is linked to a user
        // This is critical for login credentials - prevents credential drift
        if (emailRequest.contact.partyId) {
          const user = await tx.user.findFirst({
            where: { partyId: emailRequest.contact.partyId },
          });

          if (user) {
            // Update user's email for login credentials
            await tx.user.update({
              where: { id: user.id },
              data: { email: emailRequest.newEmail },
            });

            // Log security event
            req.log?.info?.(
              {
                userId: user.id,
                oldEmail: emailRequest.oldEmail,
                newEmail: emailRequest.newEmail,
              },
              "User email updated via portal email change"
            );

            // Invalidate existing sessions for security (except current)
            // This ensures the user re-authenticates with their new email
            await tx.session.deleteMany({
              where: {
                userId: user.id,
                // Keep current session if we can identify it
              },
            });
          }
        }
      });

      // Log activity
      if (emailRequest.contact.partyId) {
        await logPartyActivity(
          emailRequest.tenantId,
          emailRequest.contact.partyId,
          "EMAIL_CHANGE_VERIFIED",
          "Email change verified",
          `Email changed from "${emailRequest.oldEmail}" to "${emailRequest.newEmail}"`,
          {
            oldEmail: emailRequest.oldEmail,
            newEmail: emailRequest.newEmail,
            requestId: emailRequest.id,
          }
        );
      }

      return reply.send({
        ok: true,
        message: "Email updated successfully",
        newEmail: emailRequest.newEmail,
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to verify email change");
      return reply.code(500).send({ error: "verification_failed" });
    }
  });
};

export default portalProfileRoutes;
