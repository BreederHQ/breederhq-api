// src/routes/marketplace-waitlist.ts
// Marketplace waitlist request endpoint - allows marketplace users to join breeder waitlists
//
// Endpoints:
//   POST /api/v1/marketplace/waitlist/:tenantSlug  - Request to join a breeder's waitlist
//   GET  /api/v1/marketplace/waitlist/my-requests  - Get user's waitlist requests with status
//
// Security:
// - Requires valid marketplace session (user must be logged in)
// - Creates waitlist entry in breeder's tenant with INQUIRY status
// - User info stored in notes field since they don't have a Party in the breeder's tenant

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { parseVerifiedSession } from "../utils/session.js";
import { isBlocked } from "../services/marketplace-block.js";
import { isUserSuspended } from "../services/marketplace-flag.js";
import { getStripe } from "../services/stripe-service.js";
import { sendWaitlistSignupNotificationEmail } from "../services/email-service.js";
import { sendWaitlistConfirmationToUser } from "../services/marketplace-email-service.js";

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
  // Origin tracking for conversion attribution
  origin?: {
    source?: string; // "direct" | "utm" | "referrer" | "embed" | "social"
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    pagePath?: string;
    programSlug?: string;
  };
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
  body: WaitlistRequestBody
): string {
  const lines: string[] = [
    `[Marketplace Waitlist Request]`,
    `Program: ${body.programName}`,
  ];

  if (body.message) {
    lines.push(``, `Message from applicant:`, body.message);
  }

  lines.push(``, `Submitted: ${new Date().toISOString()}`);

  return lines.join("\n");
}

/**
 * Find or create a Contact in the breeder's tenant for the marketplace user.
 * Returns the Party ID for the contact.
 */
async function findOrCreateContactParty(
  tenantId: number,
  userData: { name: string; email: string; phone?: string; userId: string }
): Promise<number> {
  // First, try to find existing contact by email
  const existingContact = await prisma.contact.findFirst({
    where: {
      tenantId,
      email: { equals: userData.email, mode: "insensitive" },
    },
    select: { id: true, partyId: true },
  });

  if (existingContact?.partyId) {
    return existingContact.partyId;
  }

  // Parse name into first/last
  const nameParts = userData.name.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Create new Party and Contact
  const party = await prisma.party.create({
    data: {
      tenantId,
      type: "CONTACT",
      name: userData.name.trim(),
      email: userData.email,
    },
    select: { id: true },
  });

  await prisma.contact.create({
    data: {
      tenantId,
      partyId: party.id,
      first_name: firstName,
      last_name: lastName,
      display_name: userData.name.trim(),
      email: userData.email,
      phoneE164: userData.phone || null,
      // Store marketplace user ID in external fields for reference
      externalProvider: "marketplace",
      externalId: userData.userId,
    },
  });

  return party.id;
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

    // 1b) Verify email is verified before allowing waitlist signup
    // Marketplace users have integer IDs stored in MarketplaceUser table
    const marketplaceUserId = parseInt(sess.userId, 10);
    if (!Number.isFinite(marketplaceUserId) || marketplaceUserId <= 0) {
      return reply.code(401).send({ error: "invalid_session" });
    }

    const user = await prisma.marketplaceUser.findUnique({
      where: { id: marketplaceUserId },
      select: { emailVerified: true },
    });

    if (!user) {
      return reply.code(401).send({
        error: "unauthorized",
        message: "User not found.",
      });
    }

    if (!user.emailVerified) {
      return reply.code(403).send({
        error: "email_verification_required",
        message: "Please verify your email address before joining waitlists.",
      });
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

    // 3b) Check if user is suspended platform-wide
    const suspended = await isUserSuspended(sess.userId);
    if (suspended) {
      return reply.code(403).send({
        error: "not_accepting",
        message: "This breeder is not accepting waitlist requests at this time.",
      });
    }

    // 3c) Check if user is blocked by this breeder (LIGHT level or higher)
    const blocked = await isBlocked(tenant.id, sess.userId, "LIGHT");
    if (blocked) {
      return reply.code(403).send({
        error: "not_accepting",
        message: "This breeder is not accepting waitlist requests at this time.",
      });
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

    const programFromProfile = listedPrograms.find(
      (p: any) =>
        p &&
        typeof p === "object" &&
        p.name === body.programName &&
        p.openWaitlist === true
    );

    if (!programFromProfile) {
      return reply.code(400).send({ error: "program_waitlist_not_open" });
    }

    // 5b) Look up the actual BreedingProgram to get its ID for buyer matching
    const breedingProgram = await prisma.mktListingBreedingProgram.findFirst({
      where: {
        tenantId: tenant.id,
        name: body.programName,
        status: "LIVE",
        openWaitlist: true,
      },
      select: { id: true },
    });

    // 6) Find or create a Contact in the breeder's tenant for this marketplace user
    const clientPartyId = await findOrCreateContactParty(tenant.id, {
      name: body.name,
      email: body.email,
      phone: body.phone,
      userId: sess.userId,
    });

    // 7) Create waitlist entry with INQUIRY status (shows in Pending tab)
    const notes = buildNotesFromMarketplaceRequest(body);

    const entry = await prisma.waitlistEntry.create({
      data: {
        tenantId: tenant.id,
        status: "INQUIRY",
        notes,
        clientPartyId,
        // Direct program link for buyer matching
        programId: breedingProgram?.id || null,
        // Origin tracking
        originSource: body.origin?.source || null,
        originReferrer: body.origin?.referrer || null,
        originUtmSource: body.origin?.utmSource || null,
        originUtmMedium: body.origin?.utmMedium || null,
        originUtmCampaign: body.origin?.utmCampaign || null,
        originPagePath: body.origin?.pagePath || null,
        originProgramSlug: body.origin?.programSlug || null,
      },
      select: { id: true },
    });

    // 8) If user included a message, create a message thread with the breeder
    if (body.message && body.message.trim()) {
      try {
        // Get the breeder's Organization party
        const org = await prisma.organization.findFirst({
          where: { tenantId: tenant.id },
          select: { partyId: true },
        });

        if (org?.partyId) {
          const now = new Date();

          // Create message thread
          const thread = await prisma.messageThread.create({
            data: {
              tenantId: tenant.id,
              subject: `Waitlist Request: ${body.programName}`,
              lastMessageAt: now,
              firstInboundAt: now,
              participants: {
                create: [
                  { partyId: clientPartyId, lastReadAt: now },
                  { partyId: org.partyId },
                ],
              },
              messages: {
                create: {
                  senderPartyId: clientPartyId,
                  body: body.message.trim(),
                },
              },
            },
          });

          // Update waitlist entry notes to include thread reference
          await prisma.waitlistEntry.update({
            where: { id: entry.id },
            data: {
              notes: `${notes}\n\nMessage Thread ID: ${thread.id}`,
            },
          });
        }
      } catch (e) {
        // Log but don't fail the waitlist request if messaging fails
        console.error("Failed to create message thread for waitlist request:", e);
      }
    }

    // 9) Send email notification to breeder about the new waitlist signup
    try {
      await sendWaitlistSignupNotificationEmail(tenant.id, {
        applicantName: body.name,
        applicantEmail: body.email,
        applicantPhone: body.phone,
        programName: body.programName,
        message: body.message?.trim() || undefined,
        waitlistEntryId: entry.id,
      });
    } catch (e) {
      // Log but don't fail the waitlist request if email fails
      console.error("Failed to send waitlist signup notification email:", e);
    }

    // 10) Send confirmation email to the user
    try {
      // Get breeder name for the email
      const breederOrg = await prisma.organization.findFirst({
        where: { tenantId: tenant.id },
        select: { name: true },
      });

      await sendWaitlistConfirmationToUser({
        userEmail: body.email,
        userName: body.name,
        breederName: breederOrg?.name || "the breeder",
        programName: body.programName,
        message: body.message?.trim() || undefined,
      });
    } catch (e) {
      // Log but don't fail the waitlist request if email fails
      console.error("Failed to send waitlist confirmation email to user:", e);
    }

    const response: WaitlistRequestResponse = {
      success: true,
      entryId: entry.id,
    };

    return reply.code(201).send(response);
  });

  // --------------------------------------------------------------------------
  // GET /waitlist/my-requests - Get all waitlist requests for current user
  // --------------------------------------------------------------------------
  app.get("/waitlist/my-requests", async (req, reply) => {
    // 1) Verify user is authenticated (marketplace session)
    const sess = parseVerifiedSession(req, "MARKETPLACE");
    if (!sess) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    try {
      // 2) Get user's email to find their parties across all tenants
      const mktUserId = parseInt(sess.userId, 10);
      const user = Number.isFinite(mktUserId) && mktUserId > 0
        ? await prisma.marketplaceUser.findUnique({
            where: { id: mktUserId },
            select: { email: true },
          })
        : null;

      if (!user?.email) {
        return reply.send({ requests: [] });
      }

      // 3) Find all Contact parties for this user (by email) across all tenants
      const userParties = await prisma.party.findMany({
        where: {
          email: { equals: user.email, mode: "insensitive" },
          type: "CONTACT",
        },
        select: { id: true, tenantId: true },
      });

      if (userParties.length === 0) {
        return reply.send({ requests: [] });
      }

      const partyIds = userParties.map((p) => p.id);
      const tenantIds = [...new Set(userParties.map((p) => p.tenantId))];

      // 4) Get all waitlist entries where user is the client
      const entries = await prisma.waitlistEntry.findMany({
        where: {
          clientPartyId: { in: partyIds },
        },
        select: {
          id: true,
          status: true,
          notes: true,
          createdAt: true,
          approvedAt: true,
          rejectedAt: true,
          rejectedReason: true,
          tenantId: true,
          depositInvoiceId: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // 5) Get tenant info (breeder names, slugs) for context
      // Query tenants and their organizations separately for cleaner typing
      const tenants = await prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: {
          id: true,
          slug: true,
        },
      });

      // Get organizations for these tenants
      const organizations = await prisma.organization.findMany({
        where: { tenantId: { in: tenantIds } },
        select: {
          tenantId: true,
          name: true,
        },
      });

      // Build lookup maps
      const tenantMap = new Map(tenants.map((t) => [t.id, t]));
      const orgMap = new Map(organizations.map((o) => [o.tenantId, o]));

      // Get deposit invoices for entries that have them
      const invoiceIds = entries
        .map((e) => e.depositInvoiceId)
        .filter((id): id is number => id != null);
      const invoices = invoiceIds.length > 0
        ? await prisma.invoice.findMany({
            where: { id: { in: invoiceIds } },
            select: {
              id: true,
              status: true,
              amountCents: true,
              balanceCents: true,
              dueAt: true,
            },
          })
        : [];
      const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));

      // 6) Extract program name from notes and build response
      const requests = entries.map((entry) => {
        const tenant = tenantMap.get(entry.tenantId);
        const org = orgMap.get(entry.tenantId);
        const depositInvoice = entry.depositInvoiceId ? invoiceMap.get(entry.depositInvoiceId) : null;

        // Extract program name from notes (format: "Program: XYZ")
        let programName: string | null = null;
        const programMatch = entry.notes?.match(/^Program:\s*(.+)$/m);
        if (programMatch) {
          programName = programMatch[1].trim();
        }

        // Map internal status to user-friendly status
        let displayStatus: "pending" | "approved" | "rejected";
        if (entry.status === "REJECTED") {
          displayStatus = "rejected";
        } else if (entry.status === "INQUIRY") {
          displayStatus = "pending";
        } else {
          // APPROVED, DEPOSIT_DUE, DEPOSIT_PAID, etc. are all "approved"
          displayStatus = "approved";
        }

        return {
          id: entry.id,
          status: displayStatus,
          statusDetail: entry.status, // Full status for more context
          breederName: org?.name || null,
          breederSlug: tenant?.slug || null,
          programName,
          submittedAt: entry.createdAt,
          approvedAt: entry.approvedAt,
          rejectedAt: entry.rejectedAt,
          rejectedReason: entry.rejectedReason,
          invoice: depositInvoice
            ? {
                id: depositInvoice.id,
                status: depositInvoice.status,
                totalCents: depositInvoice.amountCents,
                paidCents: depositInvoice.amountCents - depositInvoice.balanceCents,
                balanceCents: depositInvoice.balanceCents,
                dueAt: depositInvoice.dueAt,
              }
            : null,
        };
      });

      return reply.send({ requests });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /invoices/:id/checkout - Create Stripe checkout session for invoice
  // --------------------------------------------------------------------------
  app.post<{
    Params: { id: string };
  }>("/invoices/:id/checkout", async (req, reply) => {
    // 1) Verify user is authenticated (marketplace session)
    const sess = parseVerifiedSession(req, "MARKETPLACE");
    if (!sess) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const invoiceId = parseInt(req.params.id, 10);
    if (isNaN(invoiceId)) {
      return reply.code(400).send({ error: "invalid_invoice_id" });
    }

    try {
      // 2) Get user's email to verify they have access to this invoice
      const mktUserId = parseInt(sess.userId, 10);
      const user = Number.isFinite(mktUserId) && mktUserId > 0
        ? await prisma.marketplaceUser.findUnique({
            where: { id: mktUserId },
            select: { email: true },
          })
        : null;

      if (!user?.email) {
        return reply.code(403).send({ error: "no_email" });
      }

      // 3) Find the invoice and verify the user is the client
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          status: true,
          amountCents: true,
          balanceCents: true,
          tenantId: true,
          clientPartyId: true,
          waitlistEntryId: true,
          invoiceNumber: true,
          clientParty: {
            select: { email: true },
          },
          tenant: {
            select: {
              name: true,
              billing: {
                select: {
                  stripeCustomerId: true,
                },
              },
            },
          },
          LineItems: {
            select: {
              description: true,
              qty: true,
              unitCents: true,
            },
          },
        },
      });

      if (!invoice) {
        return reply.code(404).send({ error: "invoice_not_found" });
      }

      // Verify the user's email matches the invoice client
      if (invoice.clientParty?.email?.toLowerCase() !== user.email.toLowerCase()) {
        return reply.code(403).send({ error: "not_authorized" });
      }

      // 4) Check invoice is in a payable state
      if (invoice.status === "paid") {
        return reply.code(400).send({ error: "already_paid" });
      }

      if (invoice.status === "void" || invoice.status === "cancelled") {
        return reply.code(400).send({ error: "invoice_canceled" });
      }

      // 5) Calculate amount to charge (balance remaining)
      const amountCents = invoice.balanceCents > 0 ? invoice.balanceCents : invoice.amountCents;

      if (amountCents <= 0) {
        return reply.code(400).send({ error: "nothing_to_pay" });
      }

      // 6) Build line items for Stripe checkout
      const lineItems = invoice.LineItems.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.description || "Invoice item",
          },
          unit_amount: item.unitCents,
        },
        quantity: item.qty,
      }));

      // If there's a partial payment, adjust or add a credit line
      if (invoice.balanceCents !== invoice.amountCents && invoice.balanceCents > 0) {
        // Simplify: just show balance as single line item
        lineItems.length = 0;
        lineItems.push({
          price_data: {
            currency: "usd",
            product_data: {
              name: `Balance due on Invoice #${invoice.invoiceNumber}`,
            },
            unit_amount: Number(invoice.balanceCents),
          },
          quantity: 1,
        });
      }

      // 7) Determine success/cancel URLs
      const baseUrl = process.env.MARKETPLACE_URL || "https://marketplace.breederhq.com";
      const successUrl = `${baseUrl}/inquiries?tab=waitlist&payment=success`;
      const cancelUrl = `${baseUrl}/inquiries?tab=waitlist&payment=canceled`;

      // 8) Create Stripe checkout session
      // If breeder has Stripe Connect, use destination charges
      const checkoutConfig: any = {
        mode: "payment",
        line_items: lineItems,
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: user.email,
        metadata: {
          invoiceId: invoice.id.toString(),
          tenantId: invoice.tenantId.toString(),
          waitlistEntryId: invoice.waitlistEntryId?.toString() || "",
          type: "deposit_invoice",
        },
        payment_intent_data: {
          metadata: {
            invoiceId: invoice.id.toString(),
            tenantId: invoice.tenantId.toString(),
            waitlistEntryId: invoice.waitlistEntryId?.toString() || "",
          },
        },
      };

      const session = await getStripe().checkout.sessions.create(checkoutConfig);

      if (!session.url) {
        return reply.code(500).send({ error: "checkout_session_failed" });
      }

      return reply.send({ checkoutUrl: session.url });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to create invoice checkout session");
      return reply.code(500).send({ error: "checkout_failed", detail: err.message });
    }
  });
};

export default marketplaceWaitlistRoutes;
