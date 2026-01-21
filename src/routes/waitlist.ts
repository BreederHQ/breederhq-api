// src/routes/waitlist.ts
import type { FastifyPluginCallback } from "fastify";
import prisma from "../prisma.js";
import { WaitlistStatus } from "@prisma/client";
import { Species } from "@prisma/client";
import { requireClientPartyScope } from "../middleware/actor-context.js";
import { recordWaitlistOutcome } from "../services/marketplace-flag.js";
import { generateInvoiceNumber } from "../services/finance/invoice-numbering.js";
import { sendEmail } from "../services/email-service.js";
import { renderInvoiceEmail } from "../services/email-templates.js";
import {
  sendWaitlistApprovalToUser,
  sendWaitlistRejectionToUser,
} from "../services/marketplace-email-service.js";
import { refreshMatchingPlansForEntry } from "../services/plan-buyer-matching.js";

/* ───────── helpers ───────── */

/**
 * Get marketplace userId from a party if it was created from marketplace.
 * Returns null if the party wasn't created from marketplace.
 */
async function getMarketplaceUserIdFromParty(partyId: number | null): Promise<string | null> {
  if (!partyId) return null;

  const contact = await prisma.contact.findFirst({
    where: {
      partyId,
      externalProvider: "marketplace",
      externalId: { not: null },
    },
    select: { externalId: true },
  });

  return contact?.externalId ?? null;
}

function getTenantId(req: any) {
  const raw = req.headers["x-tenant-id"] ?? req.query.tenantId;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

function parseISO(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ───────── serializers ───────── */

/**
 * Serialize WaitlistEntry with Party-native fields.
 */
function serializeEntry(w: any) {
  // Extract contact info from clientParty -> contact relation
  const clientParty = w.clientParty;
  const contact = clientParty?.contact;

  // Serialize deposit invoice if included
  const depositInvoice = w.depositInvoice;
  let invoiceSummary = null;
  if (depositInvoice) {
    const paidCents = depositInvoice.amountCents - depositInvoice.balanceCents;
    invoiceSummary = {
      id: depositInvoice.id,
      invoiceNumber: depositInvoice.invoiceNumber ?? null,
      status: depositInvoice.status?.toUpperCase() ?? "DRAFT",
      totalCents: depositInvoice.amountCents,
      paidCents,
      balanceCents: depositInvoice.balanceCents,
      dueAt: depositInvoice.dueAt?.toISOString() ?? null,
      issuedAt: depositInvoice.issuedAt?.toISOString() ?? null,
    };
  }

  return {
    id: w.id,
    tenantId: w.tenantId,

    status: w.status,
    priority: w.priority,

    depositRequiredCents: w.depositRequiredCents,
    depositPaidCents: w.depositPaidCents,
    balanceDueCents: w.balanceDueCents,
    depositPaidAt: w.depositPaidAt?.toISOString() ?? null,

    // Invoice link
    invoiceId: w.depositInvoiceId ?? null,
    invoice: invoiceSummary,

    clientPartyId: w.clientPartyId,
    litterId: w.litterId,
    planId: w.planId,

    speciesPref: w.speciesPref,
    breedPrefs: w.breedPrefs ?? null,
    sirePrefId: w.sirePrefId,
    damPrefId: w.damPrefId,

    sirePref: w.sirePref ? { id: w.sirePref.id, name: w.sirePref.name } : null,
    damPref: w.damPref ? { id: w.damPref.id, name: w.damPref.name } : null,

    // Include contact info for display
    contact: contact
      ? {
          id: contact.id,
          display_name: contact.display_name,
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email,
          phoneE164: contact.phoneE164,
        }
      : null,

    // Include party info
    clientParty: clientParty
      ? {
          id: clientParty.id,
          type: clientParty.type,
          name: clientParty.name,
          email: clientParty.email,
        }
      : null,

    TagAssignment: (w.TagAssignment ?? []).map((t: any) => ({
      id: t.id,
      tagId: t.tagId,
      tag: t.tag ? { id: t.tag.id, name: t.tag.name, color: t.tag.color ?? null } : null,
    })),

    skipCount: w.skipCount ?? null,
    lastSkipAt: w.lastSkipAt?.toISOString() ?? null,
    notes: w.notes ?? null,
    createdAt: w.createdAt?.toISOString() ?? null,
    updatedAt: w.updatedAt?.toISOString() ?? null,

    // Approval/rejection tracking
    approvedAt: w.approvedAt?.toISOString() ?? null,
    rejectedAt: w.rejectedAt?.toISOString() ?? null,
    rejectedReason: w.rejectedReason ?? null,
  };
}

/* ───────── router ───────── */

const waitlistRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // tenant scope; no admin requirements anywhere in this file
  app.addHook("preHandler", async (req, reply) => {
    const tid = getTenantId(req);
    if (!tid) return reply.code(400).send({ error: "missing x-tenant-id" });
    (req as any).tenantId = tid;
  });

  /**
   * GET /api/v1/waitlist
   * Filters: q, status, species, limit, cursor
   * Returns: { items, total }
   * (Global parking-lot by default; you can pass other filters, but FE uses parking lot.)
   */
  app.get("/waitlist", async (req, reply) => {
    const actorContext = (req as any).actorContext;
    const tenantId = (req as any).tenantId as number;
    const q = String((req.query as any)["q"] ?? "").trim();
    const status = String((req.query as any)["status"] ?? "").trim();
    const species = String((req.query as any)["species"] ?? "").trim();
    const clientPartyIdParam = (req.query as any)["clientPartyId"] ? Number((req.query as any)["clientPartyId"]) : undefined;
    const validSpecies = species && Object.values(Species).includes(species as Species) ? (species as Species) : undefined;
    // Support comma-separated status values (e.g., "INQUIRY,DEPOSIT_PAID")
    const statusValues = status.split(",").map(s => s.trim()).filter(s => Object.values(WaitlistStatus).includes(s as WaitlistStatus)) as WaitlistStatus[];
    const limit = Math.min(250, Math.max(1, Number((req.query as any)["limit"] ?? 25)));
    const cursorId = (req.query as any)["cursor"] ? Number((req.query as any)["cursor"]) : undefined;

    const where: any = {
      tenantId,
      litterId: null, // parking lot
      ...(statusValues.length === 1 ? { status: statusValues[0] } : statusValues.length > 1 ? { status: { in: statusValues } } : null),
      ...(species ? { speciesPref: species } : null),
      ...(cursorId ? { id: { lt: cursorId } } : null),
      ...(q
        ? {
            OR: [
              { notes: { contains: q, mode: "insensitive" } },
            ],
          }
        : null),
    };

    // PORTAL CLIENT: Enforce party scope - only show their waitlist entries
    if (actorContext === "CLIENT") {
      const { partyId } = await requireClientPartyScope(req);
      where.clientPartyId = partyId;
    } else if (clientPartyIdParam) {
      // STAFF can filter by clientPartyId query param
      where.clientPartyId = clientPartyIdParam;
    }

    const rows = await prisma.waitlistEntry.findMany({
      where,
      orderBy: [{ depositPaidAt: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      take: limit,
      include: {
        sirePref: { select: { id: true, name: true } },
        damPref: { select: { id: true, name: true } },
        TagAssignment: { include: { tag: true } },
        depositInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            amountCents: true,
            balanceCents: true,
            dueAt: true,
            issuedAt: true,
          },
        },
        clientParty: {
          include: {
            contact: {
              select: {
                id: true,
                display_name: true,
                first_name: true,
                last_name: true,
                email: true,
                phoneE164: true,
              },
            },
          },
        },
      },
    });

    // Count without cursor to give a stable aggregate for UI; still scoped to parking-lot, status/species
    const statusFilter = statusValues.length === 1 ? { status: statusValues[0] } : statusValues.length > 1 ? { status: { in: statusValues } } : null;
    const total = await prisma.waitlistEntry.count({
      where: { tenantId, litterId: null, ...statusFilter, ...(validSpecies ? { speciesPref: validSpecies } : null) },
    });

    reply.send({ items: rows.map(serializeEntry), total });
  });

  /**
   * GET /api/v1/waitlist/:id
   */
  app.get("/waitlist/:id", async (req, reply) => {
    const actorContext = (req as any).actorContext;
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    const where: any = { id, tenantId };

    // PORTAL CLIENT: Enforce party scope - only show their waitlist entry
    if (actorContext === "CLIENT") {
      const { partyId } = await requireClientPartyScope(req);
      where.clientPartyId = partyId;
    }

    const w = await prisma.waitlistEntry.findFirst({
      where,
      include: {
        sirePref: { select: { id: true, name: true } },
        damPref: { select: { id: true, name: true } },
        TagAssignment: { include: { tag: true } },
        depositInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            amountCents: true,
            balanceCents: true,
            dueAt: true,
            issuedAt: true,
          },
        },
        clientParty: {
          include: {
            contact: {
              select: {
                id: true,
                display_name: true,
                first_name: true,
                last_name: true,
                email: true,
                phoneE164: true,
              },
            },
          },
        },
      },
    });

    if (!w) return reply.code(404).send({ error: "not found" });
    reply.send(serializeEntry(w));
  });

  /**
   * POST /api/v1/waitlist
   * Create a global (parking lot) waitlist entry (no admin required)
   */
  app.post("/waitlist", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const b = (req.body as any) ?? {};

    // Require clientPartyId
    if (!b.clientPartyId) {
      return reply.code(400).send({ error: "clientPartyId required" });
    }

    const created = await prisma.waitlistEntry.create({
      data: {
        tenantId,
        planId: b.planId ?? null,
        litterId: null, // parking-lot by design

        clientPartyId: Number(b.clientPartyId),

        speciesPref: b.speciesPref ?? null,
        breedPrefs: b.breedPrefs ?? null,
        sirePrefId: b.sirePrefId ? Number(b.sirePrefId) : null,
        damPrefId: b.damPrefId ? Number(b.damPrefId) : null,

        status: b.status ?? "INQUIRY",
        priority: b.priority ?? null,

        depositInvoiceId: b.depositInvoiceId ?? null,
        balanceInvoiceId: b.balanceInvoiceId ?? null,
        depositPaidAt: parseISO(b.depositPaidAt),
        depositRequiredCents: b.depositRequiredCents ?? null,
        depositPaidCents: b.depositPaidCents ?? null,
        balanceDueCents: b.balanceDueCents ?? null,

        animalId: b.animalId ? Number(b.animalId) : null,

        skipCount: b.skipCount ?? null,
        lastSkipAt: parseISO(b.lastSkipAt),

        notes: b.notes ?? null,
      },
      include: {
        sirePref: { select: { id: true, name: true } },
        damPref: { select: { id: true, name: true } },
        TagAssignment: { include: { tag: true } },
        depositInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            amountCents: true,
            balanceCents: true,
            dueAt: true,
            issuedAt: true,
          },
        },
        clientParty: {
          include: {
            contact: {
              select: {
                id: true,
                display_name: true,
                first_name: true,
                last_name: true,
                email: true,
                phoneE164: true,
              },
            },
          },
        },
      },
    });

    reply.code(201).send(serializeEntry(created));
  });

  /**
   * PATCH /api/v1/waitlist/:id
   * Update an entry (no admin required)
   */
  app.patch("/waitlist/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const b = (req.body as any) ?? {};

    const existing = await prisma.waitlistEntry.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });

    const data: any = {};

    // Accept clientPartyId
    if ("clientPartyId" in b) {
      if (!b.clientPartyId) {
        return reply.code(400).send({ error: "clientPartyId required" });
      }
      data.clientPartyId = Number(b.clientPartyId);
    }

    // relations
    if ("planId" in b) data.planId = b.planId ?? null;
    if ("litterId" in b) data.litterId = b.litterId ?? null; // allows moving out of parking lot if ever needed
    if ("animalId" in b) data.animalId = b.animalId ? Number(b.animalId) : null;

    // prefs
    if ("speciesPref" in b) data.speciesPref = b.speciesPref ?? null;
    if ("breedPrefs" in b) data.breedPrefs = b.breedPrefs ?? null;
    if ("sirePrefId" in b) data.sirePrefId = b.sirePrefId ? Number(b.sirePrefId) : null;
    if ("damPrefId" in b) data.damPrefId = b.damPrefId ? Number(b.damPrefId) : null;

    // status/priority
    if ("status" in b) data.status = b.status;
    if ("priority" in b) data.priority = b.priority ?? null;

    // money
    if ("depositInvoiceId" in b) data.depositInvoiceId = b.depositInvoiceId ?? null;
    if ("balanceInvoiceId" in b) data.balanceInvoiceId = b.balanceInvoiceId ?? null;
    if ("depositPaidAt" in b) data.depositPaidAt = parseISO(b.depositPaidAt);
    if ("depositRequiredCents" in b) data.depositRequiredCents = b.depositRequiredCents ?? null;
    if ("depositPaidCents" in b) data.depositPaidCents = b.depositPaidCents ?? null;
    if ("balanceDueCents" in b) data.balanceDueCents = b.balanceDueCents ?? null;

    // skip meta
    if ("skipCount" in b) data.skipCount = b.skipCount ?? null;
    if ("lastSkipAt" in b) data.lastSkipAt = parseISO(b.lastSkipAt);

    // notes
    if ("notes" in b) data.notes = b.notes ?? null;

    const updated = await prisma.waitlistEntry.update({
      where: { id },
      data,
      include: {
        sirePref: { select: { id: true, name: true } },
        damPref: { select: { id: true, name: true } },
        TagAssignment: { include: { tag: true } },
        depositInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            amountCents: true,
            balanceCents: true,
            dueAt: true,
            issuedAt: true,
          },
        },
        clientParty: {
          include: {
            contact: {
              select: {
                id: true,
                display_name: true,
                first_name: true,
                last_name: true,
                email: true,
                phoneE164: true,
              },
            },
          },
        },
      },
    });

    reply.send(serializeEntry(updated));
  });

  /**
   * DELETE /api/v1/waitlist/:id
   * No admin required
   */
  app.delete("/waitlist/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    const existing = await prisma.waitlistEntry.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });

    await prisma.waitlistEntry.delete({ where: { id } });
    reply.send({ ok: true });
  });

  /**
   * POST /api/v1/waitlist/:id/skip
   * Increments skipCount and sets lastSkipAt to now (no admin required)
   */
  app.post("/waitlist/:id/skip", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    const existing = await prisma.waitlistEntry.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });

    const updated = await prisma.waitlistEntry.update({
      where: { id },
      data: {
        skipCount: (existing.skipCount ?? 0) + 1,
        lastSkipAt: new Date(),
      },
      select: { skipCount: true },
    });

    reply.send({ skipCount: updated.skipCount ?? 0 });
  });

  /**
   * GET /api/v1/waitlist/check-duplicate
   * Check if a duplicate waitlist entry exists for a contact with the same species/breed/sire/dam combination.
   * Query params: clientPartyId, contactId, organizationId, speciesPref, breedPrefs, sirePrefId, damPrefId
   * Returns: { isDuplicate: boolean, existingEntry?: {...} }
   */
  app.get("/waitlist/check-duplicate", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const query = req.query as any;

    const clientPartyId = query.clientPartyId ? Number(query.clientPartyId) : null;
    const contactId = query.contactId ? Number(query.contactId) : null;
    const organizationId = query.organizationId ? Number(query.organizationId) : null;
    const speciesPref = query.speciesPref ? String(query.speciesPref).trim() : null;
    const breedPrefsRaw = query.breedPrefs ? String(query.breedPrefs).trim() : null;
    const breedPrefs = breedPrefsRaw ? breedPrefsRaw.split(",").map((b: string) => b.trim()).filter(Boolean) : null;
    const sirePrefId = query.sirePrefId ? Number(query.sirePrefId) : null;
    const damPrefId = query.damPrefId ? Number(query.damPrefId) : null;

    // Need at least a party/contact/org identifier to check
    if (!clientPartyId && !contactId && !organizationId) {
      return reply.send({ isDuplicate: false });
    }

    // Need species to check for duplicates
    if (!speciesPref) {
      return reply.send({ isDuplicate: false });
    }

    // Build the where clause for finding duplicates
    const where: any = {
      tenantId,
      speciesPref,
    };

    // Match by party ID
    if (clientPartyId) {
      where.clientPartyId = clientPartyId;
    } else if (contactId) {
      // Find party ID from contact
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, tenantId },
        select: { partyId: true },
      });
      if (contact?.partyId) {
        where.clientPartyId = contact.partyId;
      } else {
        return reply.send({ isDuplicate: false });
      }
    } else if (organizationId) {
      // Find party ID from organization
      const org = await prisma.organization.findFirst({
        where: { id: organizationId, tenantId },
        select: { partyId: true },
      });
      if (org?.partyId) {
        where.clientPartyId = org.partyId;
      } else {
        return reply.send({ isDuplicate: false });
      }
    }

    // Match sire/dam exactly (null matches null)
    if (sirePrefId !== null) {
      where.sirePrefId = sirePrefId;
    } else {
      where.sirePrefId = null;
    }

    if (damPrefId !== null) {
      where.damPrefId = damPrefId;
    } else {
      where.damPrefId = null;
    }

    // Find existing entries with the same combination
    const existingEntries = await prisma.waitlistEntry.findMany({
      where,
      include: {
        sirePref: { select: { id: true, name: true } },
        damPref: { select: { id: true, name: true } },
        clientParty: {
          include: {
            contact: {
              select: {
                id: true,
                display_name: true,
                first_name: true,
                last_name: true,
                email: true,
              },
            },
          },
        },
      },
      take: 10, // Limit results
    });

    // Check for breed match - breedPrefs is stored as JSON array
    // We need to check if any existing entry has the same breed preferences
    for (const entry of existingEntries) {
      const entryBreeds = Array.isArray(entry.breedPrefs)
        ? (entry.breedPrefs as string[]).map((b) => b.toLowerCase().trim())
        : [];
      const requestBreeds = breedPrefs
        ? breedPrefs.map((b) => b.toLowerCase().trim())
        : [];

      // Consider it a duplicate if:
      // 1. Both have no breeds specified, OR
      // 2. They have the same breeds (order doesn't matter)
      const breedsMatch =
        (entryBreeds.length === 0 && requestBreeds.length === 0) ||
        (entryBreeds.length === requestBreeds.length &&
          entryBreeds.every((b) => requestBreeds.includes(b)) &&
          requestBreeds.every((b) => entryBreeds.includes(b)));

      if (breedsMatch) {
        return reply.send({
          isDuplicate: true,
          existingEntry: serializeEntry(entry),
        });
      }
    }

    return reply.send({ isDuplicate: false });
  });

  /**
   * GET /api/v1/waitlist/pending-count
   * Returns count of INQUIRY status entries for notification badge
   */
  app.get("/waitlist/pending-count", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId as number;

      if (!tenantId) {
        console.error("[waitlist/pending-count] Missing tenantId");
        return reply.code(400).send({ error: "missing_tenant_id", count: 0 });
      }

      const count = await prisma.waitlistEntry.count({
        where: {
          tenantId,
          status: "INQUIRY",
          litterId: null, // parking lot only
        },
      });

      reply.send({ count });
    } catch (error) {
      console.error("[waitlist/pending-count] Error:", error);
      // Return 0 count instead of 500 to prevent UI errors
      reply.send({ count: 0 });
    }
  });

  /**
   * GET /api/v1/waitlist/:id/check-duplicate
   * Check for existing contacts with matching email or phone
   * Returns: { hasDuplicate: boolean, existingContact?: {...} }
   */
  app.get("/waitlist/:id/check-duplicate", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    const entry = await prisma.waitlistEntry.findFirst({
      where: { id, tenantId },
      include: {
        clientParty: {
          include: {
            contact: {
              select: {
                id: true,
                email: true,
                phoneE164: true,
                display_name: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });

    if (!entry) return reply.code(404).send({ error: "not found" });

    const clientParty = entry.clientParty;
    const email = clientParty?.email?.toLowerCase()?.trim() || null;
    const phone = clientParty?.phoneE164?.trim() || null;

    if (!email && !phone) {
      return reply.send({ hasDuplicate: false });
    }

    // Search for existing contacts with matching email or phone
    const conditions: any[] = [];
    if (email) {
      conditions.push({ email: { equals: email, mode: "insensitive" } });
      conditions.push({ party: { email: { equals: email, mode: "insensitive" } } });
    }
    if (phone) {
      conditions.push({ phoneE164: phone });
      conditions.push({ party: { phoneE164: phone } });
    }

    const existingContact = await prisma.contact.findFirst({
      where: {
        tenantId,
        archived: false,
        // Exclude contacts that are already linked to this waitlist entry's party
        partyId: { not: entry.clientPartyId },
        OR: conditions,
      },
      select: {
        id: true,
        display_name: true,
        first_name: true,
        last_name: true,
        email: true,
        phoneE164: true,
        partyId: true,
        party: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneE164: true,
          },
        },
      },
    });

    if (existingContact) {
      return reply.send({
        hasDuplicate: true,
        existingContact: {
          id: existingContact.id,
          partyId: existingContact.partyId,
          display_name: existingContact.party?.name || existingContact.display_name,
          email: existingContact.party?.email || existingContact.email,
          phoneE164: existingContact.party?.phoneE164 || existingContact.phoneE164,
        },
      });
    }

    return reply.send({ hasDuplicate: false });
  });

  /**
   * POST /api/v1/waitlist/:id/approve
   * Approve a pending (INQUIRY or DEPOSIT_PAID) waitlist entry
   * Body: { linkToExistingContactId?: number }
   * Returns: updated entry with linkedToExisting flag
   */
  app.post("/waitlist/:id/approve", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const b = (req.body as any) ?? {};
    const linkToExistingContactId = b.linkToExistingContactId ? Number(b.linkToExistingContactId) : null;

    const entry = await prisma.waitlistEntry.findFirst({
      where: { id, tenantId },
      include: {
        clientParty: {
          include: {
            contact: true,
          },
        },
      },
    });

    if (!entry) return reply.code(404).send({ error: "not found" });
    // Allow approval of both INQUIRY (new) and DEPOSIT_PAID (paid deposit awaiting finalization)
    if (entry.status !== "INQUIRY" && entry.status !== "DEPOSIT_PAID") {
      return reply.code(400).send({ error: "Entry must be in INQUIRY or DEPOSIT_PAID status to approve" });
    }

    let linkedToExisting = false;
    let linkedContactId: number | null = null;

    // If linking to existing contact, update the waitlist entry's clientPartyId
    if (linkToExistingContactId) {
      const existingContact = await prisma.contact.findFirst({
        where: { id: linkToExistingContactId, tenantId, archived: false },
        select: { id: true, partyId: true },
      });

      if (!existingContact) {
        return reply.code(400).send({ error: "Existing contact not found" });
      }

      if (!existingContact.partyId) {
        return reply.code(400).send({ error: "Existing contact has no party" });
      }

      // Update the waitlist entry to point to the existing contact's party
      await prisma.waitlistEntry.update({
        where: { id },
        data: {
          clientPartyId: existingContact.partyId,
          status: "APPROVED",
          approvedAt: new Date(),
        },
      });

      linkedToExisting = true;
      linkedContactId = existingContact.id;
    } else {
      // No linking - just approve the entry as-is
      // The clientParty was already created during marketplace submission
      await prisma.waitlistEntry.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
        },
      });
    }

    // Fetch the updated entry with all relations
    const updated = await prisma.waitlistEntry.findFirst({
      where: { id, tenantId },
      include: {
        sirePref: { select: { id: true, name: true } },
        damPref: { select: { id: true, name: true } },
        TagAssignment: { include: { tag: true } },
        depositInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            amountCents: true,
            balanceCents: true,
            dueAt: true,
            issuedAt: true,
          },
        },
        clientParty: {
          include: {
            contact: {
              select: {
                id: true,
                display_name: true,
                first_name: true,
                last_name: true,
                email: true,
                phoneE164: true,
              },
            },
          },
        },
      },
    });

    // Track approval for marketplace users (for abuse system)
    try {
      const marketplaceUserId = await getMarketplaceUserIdFromParty(entry.clientPartyId);
      if (marketplaceUserId) {
        await recordWaitlistOutcome(marketplaceUserId, true);
      }
    } catch (err) {
      // Don't fail the approval if tracking fails
      console.error("[waitlist/approve] Failed to record outcome:", err);
    }

    // Send approval email to user
    try {
      const clientEmail = updated?.clientParty?.email || updated?.clientParty?.contact?.email;
      const clientName = updated?.clientParty?.contact?.display_name ||
        updated?.clientParty?.contact?.first_name ||
        updated?.clientParty?.name ||
        "there";

      // Get breeder info
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true },
      });
      const breederOrg = await prisma.organization.findFirst({
        where: { tenantId },
        select: { name: true },
      });

      // Extract program name from notes if available
      const programMatch = entry.notes?.match(/^Program:\s*(.+)$/m);
      const programName = programMatch ? programMatch[1].trim() : undefined;

      if (clientEmail) {
        await sendWaitlistApprovalToUser({
          userEmail: clientEmail,
          userName: clientName,
          breederName: breederOrg?.name || "the breeder",
          programName,
          tenantSlug: tenant?.slug || undefined,
        });
      }
    } catch (err) {
      // Don't fail the approval if email fails
      console.error("[waitlist/approve] Failed to send approval email:", err);
    }

    // Refresh matches for breeding plans under the same program
    // This allows the approved entry to appear as a possible match
    try {
      await refreshMatchingPlansForEntry(prisma, id, tenantId);
    } catch (err) {
      // Don't fail the approval if matching fails
      console.error("[waitlist/approve] Failed to refresh matches:", err);
    }

    reply.send({
      ...serializeEntry(updated),
      linkedToExisting,
      linkedContactId,
    });
  });

  /**
   * POST /api/v1/waitlist/:id/reject
   * Reject a pending (INQUIRY) waitlist entry
   * Body: { reason?: string }
   */
  app.post("/waitlist/:id/reject", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const b = (req.body as any) ?? {};
    const reason = typeof b.reason === "string" ? b.reason.trim() : null;

    const entry = await prisma.waitlistEntry.findFirst({
      where: { id, tenantId },
      include: {
        clientParty: true,
      },
    });

    if (!entry) return reply.code(404).send({ error: "not found" });
    if (entry.status !== "INQUIRY") {
      return reply.code(400).send({ error: "Entry is not in INQUIRY status" });
    }

    // Update the entry to REJECTED status
    const updated = await prisma.waitlistEntry.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectedReason: reason || null,
      },
      include: {
        sirePref: { select: { id: true, name: true } },
        damPref: { select: { id: true, name: true } },
        TagAssignment: { include: { tag: true } },
        depositInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            amountCents: true,
            balanceCents: true,
            dueAt: true,
            issuedAt: true,
          },
        },
        clientParty: {
          include: {
            contact: {
              select: {
                id: true,
                display_name: true,
                first_name: true,
                last_name: true,
                email: true,
                phoneE164: true,
              },
            },
          },
        },
      },
    });

    // If there's a message thread associated with this entry, add a system message
    // Parse notes field for "Message Thread ID: X" pattern
    const threadIdMatch = entry.notes?.match(/Message Thread ID:\s*(\d+)/i);
    if (threadIdMatch) {
      const threadId = Number(threadIdMatch[1]);
      const thread = await prisma.messageThread.findFirst({
        where: { id: threadId, tenantId },
        select: { id: true },
      });

      if (thread) {
        // Get the org party to send the rejection message
        const org = await prisma.organization.findFirst({
          where: { tenantId },
          select: { partyId: true },
        });

        if (org?.partyId) {
          const rejectionMessage = reason
            ? `Your waitlist request has been declined. Reason: ${reason}`
            : "Your waitlist request has been declined.";

          await prisma.message.create({
            data: {
              threadId: thread.id,
              senderPartyId: org.partyId,
              body: rejectionMessage,
            },
          });

          // Update thread's lastMessageAt
          await prisma.messageThread.update({
            where: { id: thread.id },
            data: { lastMessageAt: new Date() },
          });
        }
      }
    }

    // Track rejection for marketplace users (for abuse system)
    try {
      const marketplaceUserId = await getMarketplaceUserIdFromParty(entry.clientPartyId);
      if (marketplaceUserId) {
        await recordWaitlistOutcome(marketplaceUserId, false);
      }
    } catch (err) {
      // Don't fail the rejection if tracking fails
      console.error("[waitlist/reject] Failed to record outcome:", err);
    }

    // Send rejection email to user
    try {
      const clientEmail = entry.clientParty?.email || updated?.clientParty?.contact?.email;
      const clientName = updated?.clientParty?.contact?.display_name ||
        updated?.clientParty?.contact?.first_name ||
        entry.clientParty?.name ||
        "there";

      // Get breeder info
      const breederOrg = await prisma.organization.findFirst({
        where: { tenantId },
        select: { name: true },
      });

      // Extract program name from notes if available
      const programMatch = entry.notes?.match(/^Program:\s*(.+)$/m);
      const programName = programMatch ? programMatch[1].trim() : undefined;

      if (clientEmail) {
        await sendWaitlistRejectionToUser({
          userEmail: clientEmail,
          userName: clientName,
          breederName: breederOrg?.name || "the breeder",
          programName,
          reason: reason || undefined,
        });
      }
    } catch (err) {
      // Don't fail the rejection if email fails
      console.error("[waitlist/reject] Failed to send rejection email:", err);
    }

    reply.send(serializeEntry(updated));
  });

  /**
   * POST /api/v1/waitlist/:id/message
   * Send a message to the waitlist entry's client party
   * Body: { message: string, subject?: string }
   * Returns: { ok: true, threadId: number }
   */
  app.post("/waitlist/:id/message", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const b = (req.body as any) ?? {};
    const messageBody = typeof b.message === "string" ? b.message.trim() : "";
    const subject = typeof b.subject === "string" ? b.subject.trim() : null;

    if (!messageBody) {
      return reply.code(400).send({ error: "message is required" });
    }

    const entry = await prisma.waitlistEntry.findFirst({
      where: { id, tenantId },
      include: {
        clientParty: true,
      },
    });

    if (!entry) return reply.code(404).send({ error: "not found" });
    if (!entry.clientPartyId) {
      return reply.code(400).send({ error: "Entry has no client party" });
    }

    // Get the org party (sender)
    const org = await prisma.organization.findFirst({
      where: { tenantId },
      select: { partyId: true, name: true },
    });

    if (!org?.partyId) {
      return reply.code(500).send({ error: "Organization party not found" });
    }

    const now = new Date();

    // Check if there's an existing thread mentioned in notes
    let threadId: number | null = null;
    const threadIdMatch = entry.notes?.match(/Message Thread ID:\s*(\d+)/i);
    if (threadIdMatch) {
      const existingThreadId = Number(threadIdMatch[1]);
      const existingThread = await prisma.messageThread.findFirst({
        where: { id: existingThreadId, tenantId },
        select: { id: true },
      });
      if (existingThread) {
        threadId = existingThread.id;
      }
    }

    if (threadId) {
      // Add message to existing thread
      await prisma.message.create({
        data: {
          threadId,
          senderPartyId: org.partyId,
          body: messageBody,
        },
      });

      // Update thread timestamps and firstOrgReplyAt if not set
      const thread = await prisma.messageThread.findUnique({
        where: { id: threadId },
        select: { firstOrgReplyAt: true, firstInboundAt: true },
      });

      const threadUpdate: any = { lastMessageAt: now, updatedAt: now };
      if (thread?.firstInboundAt && !thread.firstOrgReplyAt) {
        threadUpdate.firstOrgReplyAt = now;
        const responseTimeMs = now.getTime() - new Date(thread.firstInboundAt).getTime();
        threadUpdate.responseTimeSeconds = Math.floor(responseTimeMs / 1000);
      }

      await prisma.messageThread.update({
        where: { id: threadId },
        data: threadUpdate,
      });

      // Update sender's lastReadAt
      await prisma.messageParticipant.updateMany({
        where: { threadId, partyId: org.partyId },
        data: { lastReadAt: now },
      });
    } else {
      // Create new thread
      const clientPartyName = entry.clientParty?.name || "Waitlist Applicant";
      const thread = await prisma.messageThread.create({
        data: {
          tenantId,
          subject: subject || `Waitlist Inquiry from ${clientPartyName}`,
          lastMessageAt: now,
          firstOrgReplyAt: now, // Org is initiating
          participants: {
            create: [
              { partyId: org.partyId, lastReadAt: now },
              { partyId: entry.clientPartyId },
            ],
          },
          messages: {
            create: {
              senderPartyId: org.partyId,
              body: messageBody,
            },
          },
        },
      });

      threadId = thread.id;

      // Update the waitlist entry notes to include the thread ID
      const existingNotes = entry.notes || "";
      const newNotes = existingNotes
        ? `${existingNotes}\n\nMessage Thread ID: ${threadId}`
        : `Message Thread ID: ${threadId}`;

      await prisma.waitlistEntry.update({
        where: { id },
        data: { notes: newNotes },
      });
    }

    reply.send({ ok: true, threadId });
  });

  /**
   * POST /api/v1/waitlist/:id/generate-deposit-invoice
   * Generate a deposit invoice for a waitlist entry
   * Body: { amountCents?: number, dueAt?: string, sendEmail?: boolean }
   * Returns: { invoice: InvoiceSummary, emailSent: boolean }
   */
  app.post("/waitlist/:id/generate-deposit-invoice", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const b = (req.body as any) ?? {};

    // Fetch the entry with client party
    const entry = await prisma.waitlistEntry.findFirst({
      where: { id, tenantId },
      include: {
        clientParty: {
          select: { id: true, name: true, email: true },
        },
        depositInvoice: { select: { id: true } },
      },
    });

    if (!entry) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Check if already has an invoice
    if (entry.depositInvoiceId || entry.depositInvoice) {
      return reply.code(400).send({ error: "invoice_already_exists" });
    }

    // Get tenant name for email
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    // Determine amount - use provided value, or look for default in tenant settings
    let amountCents = b.amountCents ? Number(b.amountCents) : null;

    // If no amount provided, try to get from tenant's program settings
    if (!amountCents) {
      const programSetting = await prisma.tenantSetting.findUnique({
        where: {
          tenantId_namespace: {
            tenantId,
            namespace: "breedingProgramProfile",
          },
        },
        select: { data: true },
      });
      const settings = programSetting?.data as any;
      const depositAmount = settings?.placement?.depositAmountUSD;
      if (depositAmount) {
        amountCents = Math.round(depositAmount * 100);
      }
    }

    if (!amountCents || amountCents <= 0) {
      return reply.code(400).send({ error: "amountCents_required" });
    }

    // Calculate due date (default 14 days from now)
    const dueAt = b.dueAt ? new Date(b.dueAt) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const shouldSendEmail = b.sendEmail !== false; // Default true

    // Create the invoice in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const invoiceNumber = await generateInvoiceNumber(tx, tenantId);

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          invoiceNumber,
          scope: "waitlist",
          clientPartyId: entry.clientPartyId,
          amountCents,
          balanceCents: amountCents,
          currency: "USD",
          status: "issued",
          category: "DEPOSIT",
          issuedAt: new Date(),
          dueAt,
          notes: `Deposit for waitlist entry #${id}`,
          waitlistEntryId: id,
        },
      });

      // Create line item
      await tx.invoiceLineItem.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          kind: "DEPOSIT",
          description: "Waitlist Deposit",
          qty: 1,
          unitCents: amountCents,
          totalCents: amountCents,
        },
      });

      // Link invoice to waitlist entry
      await tx.waitlistEntry.update({
        where: { id },
        data: {
          depositInvoiceId: invoice.id,
          depositRequiredCents: amountCents,
        },
      });

      return invoice;
    });

    // Build invoice summary for response
    const invoiceSummary = {
      id: result.id,
      invoiceNumber: result.invoiceNumber,
      status: result.status?.toUpperCase() ?? "ISSUED",
      totalCents: result.amountCents,
      paidCents: 0,
      balanceCents: result.balanceCents,
      dueAt: result.dueAt?.toISOString() ?? null,
      issuedAt: result.issuedAt?.toISOString() ?? null,
    };

    // Send email if requested and client has email
    let emailSent = false;
    const clientEmail = entry.clientParty?.email;
    if (shouldSendEmail && clientEmail) {
      try {
        const emailContent = renderInvoiceEmail({
          invoiceNumber: result.invoiceNumber,
          amountCents: result.amountCents,
          currency: "USD",
          dueAt: result.dueAt,
          clientName: entry.clientParty?.name || "Valued Customer",
          tenantName: tenant?.name || "BreederHQ",
        });

        await sendEmail({
          tenantId,
          to: clientEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          templateKey: "invoice_issued",
          relatedInvoiceId: result.id,
          category: "transactional",
          metadata: { invoiceId: result.id, invoiceNumber: result.invoiceNumber, waitlistEntryId: id },
        });

        emailSent = true;
      } catch (err) {
        // Log but don't fail the request
        console.error("[waitlist/generate-deposit-invoice] Failed to send email:", err);
      }
    }

    reply.send({ invoice: invoiceSummary, emailSent });
  });

  /**
   * POST /api/v1/waitlist/:id/resend-invoice-email
   * Resend the deposit invoice email for a waitlist entry
   * Returns: { success: boolean }
   */
  app.post("/waitlist/:id/resend-invoice-email", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    // Fetch the entry with invoice and client party
    const entry = await prisma.waitlistEntry.findFirst({
      where: { id, tenantId },
      include: {
        clientParty: {
          select: { id: true, name: true, email: true },
        },
        depositInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            amountCents: true,
            dueAt: true,
          },
        },
      },
    });

    if (!entry) {
      return reply.code(404).send({ error: "not_found" });
    }

    if (!entry.depositInvoice) {
      return reply.code(400).send({ error: "no_invoice" });
    }

    const clientEmail = entry.clientParty?.email;
    if (!clientEmail) {
      return reply.code(400).send({ error: "no_email" });
    }

    // Get tenant name for email
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const invoice = entry.depositInvoice;

    try {
      const emailContent = renderInvoiceEmail({
        invoiceNumber: invoice.invoiceNumber,
        amountCents: Number(invoice.amountCents),
        currency: "USD",
        dueAt: invoice.dueAt,
        clientName: entry.clientParty?.name || "Valued Customer",
        tenantName: tenant?.name || "BreederHQ",
      });

      await sendEmail({
        tenantId,
        to: clientEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        templateKey: "invoice_resend",
        relatedInvoiceId: invoice.id,
        category: "transactional",
        metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, waitlistEntryId: id, resend: true },
      });

      reply.send({ success: true });
    } catch (err: any) {
      console.error("[waitlist/resend-invoice-email] Failed to send email:", err);
      return reply.code(500).send({ error: "email_send_failed", detail: err?.message });
    }
  });

  done();
};

export default waitlistRoutes;
