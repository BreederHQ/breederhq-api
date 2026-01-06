// src/routes/marketplace-waitlist.ts
// Marketplace waitlist request endpoint - allows marketplace users to join breeder waitlists
//
// Endpoints:
//   POST /api/v1/marketplace/waitlist/:tenantSlug  - Request to join a breeder's waitlist
//
// Security:
// - Requires valid marketplace session (user must be logged in)
// - Creates waitlist entry in breeder's tenant with INQUIRY status
// - User info stored in notes field since they don't have a Party in the breeder's tenant

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { parseVerifiedSession } from "../utils/session.js";

// ============================================================================
// Constants
// ============================================================================

const MARKETPLACE_PROFILE_NAMESPACE = "marketplace-profile";

// ============================================================================
// Types
// ============================================================================

interface WaitlistRequestBody {
  programName: string;
  message?: string;
  // User contact info (from their account)
  name: string;
  email: string;
  phone?: string;
}

interface WaitlistRequestResponse {
  success: boolean;
  entryId: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build notes field content from marketplace user info
 */
function buildNotesFromMarketplaceRequest(
  body: WaitlistRequestBody,
  userId: string
): string {
  const lines: string[] = [
    `[Marketplace Waitlist Request]`,
    `Program: ${body.programName}`,
    ``,
    `Contact Information:`,
    `Name: ${body.name}`,
    `Email: ${body.email}`,
  ];

  if (body.phone) {
    lines.push(`Phone: ${body.phone}`);
  }

  lines.push(``, `User ID: ${userId}`);

  if (body.message) {
    lines.push(``, `Message from applicant:`, body.message);
  }

  lines.push(``, `Submitted: ${new Date().toISOString()}`);

  return lines.join("\n");
}

// ============================================================================
// Routes
// ============================================================================

const marketplaceWaitlistRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // POST /waitlist/:tenantSlug - Request to join a breeder's waitlist
  // --------------------------------------------------------------------------
  app.post<{
    Params: { tenantSlug: string };
    Body: WaitlistRequestBody;
  }>("/waitlist/:tenantSlug", async (req, reply) => {
    const { tenantSlug } = req.params;
    const body = req.body ?? {};

    // 1) Verify user is authenticated (marketplace session)
    const sess = parseVerifiedSession(req, "MARKETPLACE");
    if (!sess) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    // 2) Validate required fields
    if (!body.programName || typeof body.programName !== "string") {
      return reply.code(400).send({ error: "programName_required" });
    }
    if (!body.name || typeof body.name !== "string") {
      return reply.code(400).send({ error: "name_required" });
    }
    if (!body.email || typeof body.email !== "string") {
      return reply.code(400).send({ error: "email_required" });
    }

    // 3) Validate slug format and lookup tenant
    if (!tenantSlug || typeof tenantSlug !== "string" || tenantSlug.trim() === "") {
      return reply.code(400).send({ error: "invalid_slug" });
    }

    const normalizedSlug = tenantSlug.trim().toLowerCase();

    const tenant = await prisma.tenant.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true, slug: true },
    });

    if (!tenant || !tenant.slug) {
      return reply.code(404).send({ error: "breeder_not_found" });
    }

    // 4) Verify breeder has a published marketplace profile
    const setting = await prisma.tenantSetting.findUnique({
      where: {
        tenantId_namespace: {
          tenantId: tenant.id,
          namespace: MARKETPLACE_PROFILE_NAMESPACE,
        },
      },
      select: { data: true },
    });

    const profileData = setting?.data as { published?: Record<string, unknown> } | null;
    if (!profileData?.published) {
      return reply.code(404).send({ error: "breeder_not_published" });
    }

    // 5) Verify the program exists and has openWaitlist enabled
    const published = profileData.published;
    const listedPrograms = Array.isArray(published.listedPrograms)
      ? published.listedPrograms
      : [];

    const program = listedPrograms.find(
      (p: any) =>
        p &&
        typeof p === "object" &&
        p.name === body.programName &&
        p.openWaitlist === true
    );

    if (!program) {
      return reply.code(400).send({ error: "program_waitlist_not_open" });
    }

    // 6) Create waitlist entry with INQUIRY status (shows in Pending tab)
    const notes = buildNotesFromMarketplaceRequest(body, sess.userId);

    const entry = await prisma.waitlistEntry.create({
      data: {
        tenantId: tenant.id,
        status: "INQUIRY",
        notes,
        // clientPartyId is null since marketplace user doesn't have a Party in this tenant
        // Breeder can later convert this to a proper client if they accept the inquiry
      },
      select: { id: true },
    });

    const response: WaitlistRequestResponse = {
      success: true,
      entryId: entry.id,
    };

    return reply.code(201).send(response);
  });
};

export default marketplaceWaitlistRoutes;
