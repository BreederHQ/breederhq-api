// src/routes/waitlist.ts
import type { FastifyPluginCallback } from "fastify";
import prisma from "../prisma.js";
import { WaitlistStatus } from "@prisma/client";
import { Species } from "@prisma/client";
import { requireClientPartyScope } from "../middleware/actor-context.js";
import { recordWaitlistOutcome } from "../services/marketplace-flag.js";

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

  return {
    id: w.id,
    tenantId: w.tenantId,

    status: w.status,
    priority: w.priority,

    depositRequiredCents: w.depositRequiredCents,
    depositPaidCents: w.depositPaidCents,
    balanceDueCents: w.balanceDueCents,
    depositPaidAt: w.depositPaidAt?.toISOString() ?? null,

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
    const validStatus = status && Object.values(WaitlistStatus).includes(status as WaitlistStatus) ? (status as WaitlistStatus) : undefined;
    const limit = Math.min(250, Math.max(1, Number((req.query as any)["limit"] ?? 25)));
    const cursorId = (req.query as any)["cursor"] ? Number((req.query as any)["cursor"]) : undefined;

    const where: any = {
      tenantId,
      litterId: null, // parking lot
      ...(validStatus ? { status } : null),
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
    const total = await prisma.waitlistEntry.count({
      where: { tenantId, litterId: null, ...(validStatus ? { status: validStatus } : null), ...(validSpecies ? { speciesPref: validSpecies } : null) },
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
   * GET /api/v1/waitlist/pending-count
   * Returns count of INQUIRY status entries for notification badge
   */
  app.get("/waitlist/pending-count", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;

    const count = await prisma.waitlistEntry.count({
      where: {
        tenantId,
        status: "INQUIRY",
        litterId: null, // parking lot only
      },
    });

    reply.send({ count });
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
   * Approve a pending (INQUIRY) waitlist entry
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
    if (entry.status !== "INQUIRY") {
      return reply.code(400).send({ error: "Entry is not in INQUIRY status" });
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

  done();
};

export default waitlistRoutes;
