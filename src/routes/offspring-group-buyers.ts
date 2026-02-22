/**
 * Offspring Group Buyers API Routes
 *
 * Manages buyer assignments at the offspring group level (post-birth fulfillment).
 * This is the "Selection Board" backend: stage tracking, credit application,
 * scheduling status, and waitlist preference surfacing.
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/* ───────────────────────── helpers ───────────────────────── */

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function getTenantId(req: any): number | null {
  const raw = req.tenantId ?? req.headers?.["x-tenant-id"];
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

function errorReply(err: unknown): {
  status: number;
  payload: { error: string; message?: string };
} {
  console.error("[offspring-group-buyers] Error:", err);
  if (err instanceof Error) {
    return {
      status: 500,
      payload: { error: "internal_error", message: err.message },
    };
  }
  return { status: 500, payload: { error: "internal_error" } };
}

/* ── Breed matching helpers (for waitlist-candidates scoring) ── */

/**
 * Derive breed text from an offspring group (via linked plan or dam).
 */
function deriveBreedFromGroup(group: {
  plan?: { breedText?: string | null } | null;
  dam?: { breed?: string | null; canonicalBreed?: { name?: string | null } | null } | null;
}): string | null {
  const planBreed = group.plan?.breedText;
  if (typeof planBreed === "string" && planBreed.trim().length > 0) {
    return planBreed.trim().toLowerCase();
  }
  const damCanonical = group.dam?.canonicalBreed?.name;
  if (typeof damCanonical === "string" && damCanonical.trim().length > 0) {
    return damCanonical.trim().toLowerCase();
  }
  const damBreed = group.dam?.breed;
  if (typeof damBreed === "string" && damBreed.trim().length > 0) {
    return damBreed.trim().toLowerCase();
  }
  return null;
}

/**
 * Check if a waitlist entry's breed preferences match the given breed text.
 * breedPrefs is JSON — could be string[], object with breeds, or null.
 */
function breedPrefsMatch(breedPrefs: unknown, targetBreed: string | null): boolean {
  if (!targetBreed) return false;
  const target = targetBreed.toLowerCase();

  if (Array.isArray(breedPrefs)) {
    return breedPrefs.some(
      (b) => typeof b === "string" && b.toLowerCase().includes(target),
    );
  }
  if (typeof breedPrefs === "string") {
    return breedPrefs.toLowerCase().includes(target);
  }
  if (breedPrefs && typeof breedPrefs === "object" && !Array.isArray(breedPrefs)) {
    const obj = breedPrefs as Record<string, unknown>;
    if (Array.isArray(obj.breeds)) {
      return obj.breeds.some(
        (b: unknown) => typeof b === "string" && b.toLowerCase().includes(target),
      );
    }
    if (typeof obj.breed === "string") {
      return obj.breed.toLowerCase().includes(target);
    }
  }
  return false;
}

/* ── Valid stage values and allowed transitions ── */

const VALID_STAGES = [
  "PENDING",
  "DEPOSIT_NEEDED",
  "DEPOSIT_PAID",
  "AWAITING_PICK",
  "MATCH_PROPOSED",
  "MATCHED",
  "VISIT_SCHEDULED",
  "PICKUP_SCHEDULED",
  "COMPLETED",
  "OPTED_OUT",
  "WINDOW_EXPIRED",
] as const;

type BuyerStage = (typeof VALID_STAGES)[number];

/**
 * Allowed forward transitions. Any stage can always move to OPTED_OUT.
 * Breeder can also force any transition (no hard block), but we warn
 * on non-standard paths.
 */
const STAGE_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["DEPOSIT_NEEDED", "DEPOSIT_PAID", "AWAITING_PICK", "OPTED_OUT"],
  DEPOSIT_NEEDED: ["DEPOSIT_PAID", "AWAITING_PICK", "OPTED_OUT"],
  DEPOSIT_PAID: ["AWAITING_PICK", "MATCH_PROPOSED", "MATCHED", "OPTED_OUT"],
  AWAITING_PICK: [
    "MATCH_PROPOSED",
    "MATCHED",
    "WINDOW_EXPIRED",
    "OPTED_OUT",
  ],
  MATCH_PROPOSED: ["MATCHED", "AWAITING_PICK", "OPTED_OUT"],
  MATCHED: [
    "VISIT_SCHEDULED",
    "PICKUP_SCHEDULED",
    "COMPLETED",
    "AWAITING_PICK",
    "OPTED_OUT",
  ],
  VISIT_SCHEDULED: ["PICKUP_SCHEDULED", "COMPLETED", "OPTED_OUT"],
  PICKUP_SCHEDULED: ["COMPLETED", "OPTED_OUT"],
  COMPLETED: [],
  OPTED_OUT: ["PENDING"], // can be re-activated
  WINDOW_EXPIRED: ["AWAITING_PICK", "OPTED_OUT"],
};

function isValidStageTransition(from: string, to: string): boolean {
  const allowed = STAGE_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/* ── Shared include objects ── */

const buyerIncludes = {
  buyerParty: {
    select: { id: true, type: true, name: true, email: true, phoneE164: true },
  },
  waitlistEntry: {
    include: {
      clientParty: {
        select: { name: true, email: true, phoneE164: true },
      },
      sirePref: { select: { id: true, name: true } },
      damPref: { select: { id: true, name: true } },
    },
  },
  Invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      balanceCents: true,
      amountCents: true,
      category: true,
    },
  },
};

/* ── DTO serializer ── */

interface OffspringGroupBuyerDTO {
  id: number;
  groupId: number;
  buyerPartyId: number | null;
  buyerName: string;
  buyerEmail: string | null;
  buyerPhone: string | null;
  buyerPartyType: string | null;
  waitlistEntryId: number | null;
  stage: string;
  placementRank: number | null;
  notes: string | null;
  optedOutAt: string | null;
  optedOutReason: string | null;
  optedOutBy: string | null;
  depositDisposition: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined invoice data
  invoice: {
    id: number;
    invoiceNumber: string;
    status: string;
    balanceCents: number;
    totalCents: number;
    category: string;
  } | null;
  // Waitlist preferences (when entry exists)
  waitlistPreferences: {
    speciesPref: string | null;
    breedPrefText: string | null;
    damPrefId: number | null;
    damPrefName: string | null;
    sirePrefId: number | null;
    sirePrefName: string | null;
  } | null;
  // Scheduling (populated when ?include=scheduling)
  scheduling?: {
    bookingStatus: string;
    bookedSlotStartsAt: string | null;
  } | null;
}

function toBuyerDTO(record: any): OffspringGroupBuyerDTO {
  const party = record.buyerParty;
  const wl = record.waitlistEntry;
  const inv = record.Invoice;

  let buyerName = "Unknown";
  let buyerEmail: string | null = null;
  let buyerPhone: string | null = null;

  if (wl?.clientParty) {
    buyerName = wl.clientParty.name || "Unknown";
    buyerEmail = wl.clientParty.email || null;
    buyerPhone = wl.clientParty.phoneE164 || null;
  } else if (party) {
    buyerName = party.name || "Unknown";
    buyerEmail = party.email || null;
    buyerPhone = party.phoneE164 || null;
  }

  return {
    id: record.id,
    groupId: record.groupId,
    buyerPartyId: record.buyerPartyId,
    buyerName,
    buyerEmail,
    buyerPhone,
    buyerPartyType: party?.type ?? null,
    waitlistEntryId: record.waitlistEntryId,
    stage: record.stage,
    placementRank: record.placementRank,
    notes: record.notes,
    optedOutAt: record.optedOutAt?.toISOString() ?? null,
    optedOutReason: record.optedOutReason,
    optedOutBy: record.optedOutBy,
    depositDisposition: record.depositDisposition,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    invoice: inv
      ? {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          balanceCents: Number(inv.balanceCents),
          totalCents: Number(inv.amountCents),
          category: inv.category,
        }
      : null,
    waitlistPreferences: wl
      ? {
          speciesPref: wl.speciesPref ?? null,
          breedPrefText:
            Array.isArray(wl.breedPrefs) ? (wl.breedPrefs as string[]).join(", ") : null,
          damPrefId: wl.damPrefId ?? null,
          damPrefName: wl.damPref?.name ?? null,
          sirePrefId: wl.sirePrefId ?? null,
          sirePrefName: wl.sirePref?.name ?? null,
        }
      : null,
  };
}

/* ───────────────────────── routes ───────────────────────── */

const offspringGroupBuyersRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
) => {
  // Enforce tenant context on all routes in this plugin
  app.addHook("preHandler", async (req, reply) => {
    let tenantId = getTenantId(req);
    if (!tenantId) {
      const h = req.headers["x-tenant-id"];
      if (h) {
        tenantId = toNum(h);
        if (tenantId) (req as any).tenantId = tenantId;
      }
    }
    if (!tenantId) {
      return reply.code(401).send({ error: "missing_tenant" });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 1. GET /offspring/groups/:id/buyers
  //    List all buyers for a group with rich joined data.
  //    ?include=scheduling to also include booking status.
  // ──────────────────────────────────────────────────────────
  app.get<{
    Params: { id: string };
    Querystring: { include?: string };
  }>("/offspring/groups/:id/buyers", async (req, reply) => {
    try {
      const tenantId = getTenantId(req)!;
      const groupId = toNum(req.params.id);
      if (!groupId) return reply.code(400).send({ error: "invalid_group_id" });

      // Verify group exists for this tenant
      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId },
        select: { id: true },
      });
      if (!group) return reply.code(404).send({ error: "group_not_found" });

      // Fetch buyers with all joined data
      const buyers = await prisma.offspringGroupBuyer.findMany({
        where: { groupId, tenantId },
        include: buyerIncludes,
        orderBy: { placementRank: { sort: "asc", nulls: "last" } },
      });

      const dtos = buyers.map(toBuyerDTO);

      // Optionally include scheduling booking status
      const includeParam = (req.query.include ?? "").split(",").map((s) => s.trim());
      if (includeParam.includes("scheduling")) {
        // Collect all buyer party IDs to batch-query bookings
        const partyIds = buyers
          .map((b) => b.buyerPartyId)
          .filter((id): id is number => id != null);

        if (partyIds.length > 0) {
          // Find the latest booking for each party in this group's scheduling blocks
          const bookings = await prisma.schedulingBooking.findMany({
            where: {
              tenantId,
              partyId: { in: partyIds },
              slot: {
                block: {
                  offspringGroupId: groupId,
                },
              },
            },
            include: {
              slot: {
                select: { startsAt: true },
              },
            },
            orderBy: { bookedAt: "desc" },
          });

          // Build a map: partyId → latest booking
          const bookingMap = new Map<
            number,
            { status: string; startsAt: Date | null }
          >();
          for (const booking of bookings) {
            if (!bookingMap.has(booking.partyId)) {
              bookingMap.set(booking.partyId, {
                status: booking.status,
                startsAt: booking.slot?.startsAt ?? null,
              });
            }
          }

          // Attach scheduling data to DTOs
          for (const dto of dtos) {
            if (dto.buyerPartyId && bookingMap.has(dto.buyerPartyId)) {
              const b = bookingMap.get(dto.buyerPartyId)!;
              dto.scheduling = {
                bookingStatus: b.status,
                bookedSlotStartsAt: b.startsAt?.toISOString() ?? null,
              };
            } else {
              dto.scheduling = null;
            }
          }
        } else {
          for (const dto of dtos) {
            dto.scheduling = null;
          }
        }
      }

      reply.send({ buyers: dtos });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // ──────────────────────────────────────────────────────────
  // 2. POST /offspring/groups/:id/buyers
  //    Add a buyer to the group. After creation, check for
  //    unapplied deposit credits.
  // ──────────────────────────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: {
      waitlistEntryId?: number | null;
      buyerPartyId?: number | null;
    };
  }>("/offspring/groups/:id/buyers", async (req, reply) => {
    try {
      const tenantId = getTenantId(req)!;
      const groupId = toNum(req.params.id);
      if (!groupId) return reply.code(400).send({ error: "invalid_group_id" });

      const { buyerPartyId, waitlistEntryId } = req.body ?? {};

      if (!buyerPartyId && !waitlistEntryId) {
        return reply
          .code(400)
          .send({ error: "buyerPartyId or waitlistEntryId required" });
      }

      // Verify group exists
      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId },
        select: { id: true },
      });
      if (!group) return reply.code(404).send({ error: "group_not_found" });

      // Resolve the party ID (from waitlist entry if needed)
      let resolvedPartyId = buyerPartyId ?? null;
      if (!resolvedPartyId && waitlistEntryId) {
        const entry = await prisma.waitlistEntry.findFirst({
          where: { id: waitlistEntryId, tenantId },
          select: { clientPartyId: true },
        });
        if (!entry) {
          return reply.code(404).send({ error: "waitlist_entry_not_found" });
        }
        resolvedPartyId = entry.clientPartyId;
      }

      // Compute next placement rank
      const maxRankResult = await prisma.offspringGroupBuyer.aggregate({
        where: { groupId, tenantId },
        _max: { placementRank: true },
      });
      const nextRank = (maxRankResult._max.placementRank ?? 0) + 1;

      // Create the buyer record
      let buyer: any;
      try {
        buyer = await prisma.offspringGroupBuyer.create({
          data: {
            tenantId,
            groupId,
            buyerPartyId: resolvedPartyId,
            waitlistEntryId: waitlistEntryId ?? null,
            stage: "PENDING",
            placementRank: nextRank,
          },
          include: buyerIncludes,
        });
      } catch (err: any) {
        if (err?.code === "P2002") {
          return reply
            .code(409)
            .send({ error: "buyer_already_exists_in_group" });
        }
        throw err;
      }

      // Check for unapplied deposit credits
      let unappliedCredit: {
        invoiceId: number;
        invoiceNumber: string;
        amountCents: number;
      } | null = null;

      if (resolvedPartyId) {
        const creditInvoice = await prisma.invoice.findFirst({
          where: {
            tenantId,
            clientPartyId: resolvedPartyId,
            breedingPlanBuyerId: null,
            offspringGroupBuyerId: null,
            status: { in: ["paid", "partially_paid"] },
            LineItems: { some: { kind: "DEPOSIT" } },
          },
          select: { id: true, invoiceNumber: true, amountCents: true },
        });

        if (creditInvoice) {
          unappliedCredit = {
            invoiceId: creditInvoice.id,
            invoiceNumber: creditInvoice.invoiceNumber,
            amountCents: Number(creditInvoice.amountCents),
          };
        }
      }

      reply.status(201).send({
        buyer: toBuyerDTO(buyer),
        unappliedCredit,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // ──────────────────────────────────────────────────────────
  // 3. PATCH /offspring/groups/:id/buyers/:buyerId
  //    Update buyer: stage, notes, depositDisposition.
  //    Validates stage transitions.
  // ──────────────────────────────────────────────────────────
  app.patch<{
    Params: { id: string; buyerId: string };
    Body: {
      stage?: string;
      notes?: string | null;
      depositDisposition?: string | null;
    };
  }>("/offspring/groups/:id/buyers/:buyerId", async (req, reply) => {
    try {
      const tenantId = getTenantId(req)!;
      const groupId = toNum(req.params.id);
      const buyerId = toNum(req.params.buyerId);
      if (!groupId || !buyerId) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Verify buyer exists in this group
      const existing = await prisma.offspringGroupBuyer.findFirst({
        where: { id: buyerId, groupId, tenantId },
      });
      if (!existing) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      const { stage, notes, depositDisposition } = req.body ?? {};

      // Validate stage transition if stage is being updated
      if (stage !== undefined) {
        if (!VALID_STAGES.includes(stage as BuyerStage)) {
          return reply.code(400).send({
            error: "invalid_stage",
            validStages: VALID_STAGES,
          });
        }
        if (
          stage !== existing.stage &&
          !isValidStageTransition(existing.stage, stage)
        ) {
          return reply.code(400).send({
            error: "invalid_stage_transition",
            from: existing.stage,
            to: stage,
            allowedTransitions: STAGE_TRANSITIONS[existing.stage] ?? [],
          });
        }
      }

      // Validate depositDisposition
      const validDispositions = [
        "REFUND",
        "FORFEIT",
        "HOLD_AS_CREDIT",
        "PENDING",
      ];
      if (
        depositDisposition !== undefined &&
        depositDisposition !== null &&
        !validDispositions.includes(depositDisposition)
      ) {
        return reply.code(400).send({
          error: "invalid_deposit_disposition",
          validValues: validDispositions,
        });
      }

      // Build update data
      const updateData: any = {};
      if (stage !== undefined) updateData.stage = stage;
      if (notes !== undefined) updateData.notes = notes;
      if (depositDisposition !== undefined)
        updateData.depositDisposition = depositDisposition;

      if (Object.keys(updateData).length === 0) {
        return reply.code(400).send({ error: "no_fields_to_update" });
      }

      const updated = await prisma.offspringGroupBuyer.update({
        where: { id: buyerId },
        data: updateData,
        include: buyerIncludes,
      });

      reply.send({ buyer: toBuyerDTO(updated) });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // ──────────────────────────────────────────────────────────
  // 4. DELETE /offspring/groups/:id/buyers/:buyerId
  //    Remove buyer. If matched to offspring (buyerPartyId set
  //    on an offspring), clear the offspring's buyer fields.
  // ──────────────────────────────────────────────────────────
  app.delete<{
    Params: { id: string; buyerId: string };
  }>("/offspring/groups/:id/buyers/:buyerId", async (req, reply) => {
    try {
      const tenantId = getTenantId(req)!;
      const groupId = toNum(req.params.id);
      const buyerId = toNum(req.params.buyerId);
      if (!groupId || !buyerId) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Verify buyer exists
      const buyer = await prisma.offspringGroupBuyer.findFirst({
        where: { id: buyerId, groupId, tenantId },
      });
      if (!buyer) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      // If this buyer's party is assigned to any offspring in the group,
      // clear the offspring's buyer assignment fields
      if (buyer.buyerPartyId) {
        await prisma.offspring.updateMany({
          where: {
            groupId,
            tenantId,
            buyerPartyId: buyer.buyerPartyId,
          },
          data: {
            buyerPartyId: null,
            placementState: "UNASSIGNED",
          },
        });
      }

      // Delete the buyer record
      await prisma.offspringGroupBuyer.delete({
        where: { id: buyerId },
      });

      reply.send({ ok: true, deleted: buyerId });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // ──────────────────────────────────────────────────────────
  // 5. POST /offspring/groups/:id/buyers/:buyerId/apply-credit
  //    Link an existing paid deposit invoice to this group buyer.
  //    Mirrors breeding-plan-buyers apply-credit endpoint.
  // ──────────────────────────────────────────────────────────
  app.post<{
    Params: { id: string; buyerId: string };
    Body: { invoiceId: number };
  }>("/offspring/groups/:id/buyers/:buyerId/apply-credit", async (req, reply) => {
    try {
      const tenantId = getTenantId(req)!;
      const groupId = toNum(req.params.id);
      const buyerId = toNum(req.params.buyerId);
      if (!groupId || !buyerId) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const { invoiceId } = req.body ?? {};
      if (!invoiceId) {
        return reply.code(400).send({ error: "invoiceId_required" });
      }

      // Verify buyer exists and belongs to this group/tenant
      const buyer = await prisma.offspringGroupBuyer.findFirst({
        where: { id: buyerId, groupId, tenantId },
      });
      if (!buyer) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      // Verify invoice belongs to tenant and is not already linked to
      // either a plan buyer or group buyer
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          tenantId,
          breedingPlanBuyerId: null,
          offspringGroupBuyerId: null,
        },
      });
      if (!invoice) {
        return reply
          .code(404)
          .send({ error: "invoice_not_found_or_already_linked" });
      }

      // Link the invoice to this group buyer
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { offspringGroupBuyerId: buyerId },
      });

      // Return the updated buyer DTO with invoice fields populated
      const updated = await prisma.offspringGroupBuyer.findFirst({
        where: { id: buyerId },
        include: buyerIncludes,
      });

      reply.send({ buyer: toBuyerDTO(updated!) });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // ================================================================
  //  SPECIALIZED SELECTION BOARD ENDPOINTS (Sprint 2, Prompt 2.2)
  // ================================================================

  // ──────────────────────────────────────────────────────────
  // 6. POST /offspring/groups/:id/buyers/reorder
  //    Bulk update placementRank for all buyers in the group.
  //    Body: { orderedIds: number[] }
  //    orderedIds[0] → rank 1, orderedIds[1] → rank 2, etc.
  // ──────────────────────────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: { orderedIds: number[] };
  }>("/offspring/groups/:id/buyers/reorder", async (req, reply) => {
    try {
      const tenantId = getTenantId(req)!;
      const groupId = toNum(req.params.id);
      if (!groupId) return reply.code(400).send({ error: "invalid_group_id" });

      const { orderedIds } = req.body ?? {};
      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return reply
          .code(400)
          .send({ error: "orderedIds must be a non-empty array of buyer IDs" });
      }

      // Validate all IDs are finite numbers
      if (orderedIds.some((id) => typeof id !== "number" || !Number.isFinite(id))) {
        return reply
          .code(400)
          .send({ error: "all orderedIds must be valid numbers" });
      }

      // Verify group exists for this tenant
      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId },
        select: { id: true },
      });
      if (!group) return reply.code(404).send({ error: "group_not_found" });

      // Verify all buyer IDs belong to this group
      const existingBuyers = await prisma.offspringGroupBuyer.findMany({
        where: { groupId, tenantId },
        select: { id: true },
      });
      const existingIds = new Set(existingBuyers.map((b) => b.id));
      const invalidIds = orderedIds.filter((id) => !existingIds.has(id));
      if (invalidIds.length > 0) {
        return reply.code(400).send({
          error: "invalid_buyer_ids",
          message: `Buyer IDs not in this group: ${invalidIds.join(", ")}`,
        });
      }

      // Bulk update in a transaction: orderedIds[0] → rank 1, etc.
      await prisma.$transaction(
        orderedIds.map((buyerId, index) =>
          prisma.offspringGroupBuyer.update({
            where: { id: buyerId },
            data: { placementRank: index + 1 },
          }),
        ),
      );

      // Return updated buyer list sorted by new rank
      const updatedBuyers = await prisma.offspringGroupBuyer.findMany({
        where: { groupId, tenantId },
        include: buyerIncludes,
        orderBy: { placementRank: { sort: "asc", nulls: "last" } },
      });

      reply.send({ ok: true, buyers: updatedBuyers.map(toBuyerDTO) });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // ──────────────────────────────────────────────────────────
  // 7. POST /offspring/groups/:id/buyers/auto-sort
  //    Server-side FIFO + deposit-first sort.
  //    ORDER BY (deposit_paid_at IS NULL) ASC,
  //             COALESCE(deposit_paid_at, created_at) ASC
  //    deposit_paid_at is derived from the buyer's linked
  //    waitlist entry.
  // ──────────────────────────────────────────────────────────
  app.post<{ Params: { id: string } }>(
    "/offspring/groups/:id/buyers/auto-sort",
    async (req, reply) => {
      try {
        const tenantId = getTenantId(req)!;
        const groupId = toNum(req.params.id);
        if (!groupId)
          return reply.code(400).send({ error: "invalid_group_id" });

        // Verify group exists
        const group = await prisma.offspringGroup.findFirst({
          where: { id: groupId, tenantId },
          select: { id: true },
        });
        if (!group) return reply.code(404).send({ error: "group_not_found" });

        // Fetch all non-opted-out buyers with their waitlist entry deposit info
        const buyers = await prisma.offspringGroupBuyer.findMany({
          where: {
            groupId,
            tenantId,
            stage: { not: "OPTED_OUT" },
          },
          include: {
            waitlistEntry: {
              select: {
                id: true,
                depositPaidAt: true,
                createdAt: true,
              },
            },
          },
        });

        // Sort: deposit paid first, then FIFO
        // deposit_paid_at comes from the linked waitlist entry
        const sorted = [...buyers].sort((a, b) => {
          const aDepositPaidAt = a.waitlistEntry?.depositPaidAt ?? null;
          const bDepositPaidAt = b.waitlistEntry?.depositPaidAt ?? null;

          // Deposit paid buyers come first (IS NULL ASC → paid first)
          const aHasDeposit = aDepositPaidAt != null ? 0 : 1;
          const bHasDeposit = bDepositPaidAt != null ? 0 : 1;
          if (aHasDeposit !== bHasDeposit) return aHasDeposit - bHasDeposit;

          // Then FIFO by COALESCE(deposit_paid_at, created_at)
          const aDate = aDepositPaidAt ?? a.createdAt;
          const bDate = bDepositPaidAt ?? b.createdAt;
          return new Date(aDate).getTime() - new Date(bDate).getTime();
        });

        // Update placementRank in a transaction
        await prisma.$transaction(
          sorted.map((buyer, index) =>
            prisma.offspringGroupBuyer.update({
              where: { id: buyer.id },
              data: { placementRank: index + 1 },
            }),
          ),
        );

        // Re-fetch full list with all includes (including opted-out)
        const allBuyers = await prisma.offspringGroupBuyer.findMany({
          where: { groupId, tenantId },
          include: buyerIncludes,
          orderBy: { placementRank: { sort: "asc", nulls: "last" } },
        });

        reply.send({ ok: true, buyers: allBuyers.map(toBuyerDTO) });
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    },
  );

  // ──────────────────────────────────────────────────────────
  // 8. GET /offspring/groups/:id/buyers/waitlist-candidates
  //    Return scored waitlist candidates for this group.
  //    Scoring: breed match = 60pts, dam pref = 30pts,
  //             sire pref = 30pts (max 120).
  //    Excludes entries with status = 'ALLOCATED'.
  //    Excludes entries already linked to this group.
  //    Sorted by score DESC, then depositPaidAt ASC.
  // ──────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    "/offspring/groups/:id/buyers/waitlist-candidates",
    async (req, reply) => {
      try {
        const tenantId = getTenantId(req)!;
        const groupId = toNum(req.params.id);
        if (!groupId)
          return reply.code(400).send({ error: "invalid_group_id" });

        // Fetch group with plan and dam/sire details for scoring
        const group = await prisma.offspringGroup.findFirst({
          where: { id: groupId, tenantId },
          include: {
            plan: {
              select: {
                id: true,
                breedText: true,
                damId: true,
                sireId: true,
                species: true,
              },
            },
            dam: {
              select: {
                id: true,
                breed: true,
                canonicalBreed: { select: { name: true } },
              },
            },
            sire: { select: { id: true } },
          },
        });

        if (!group)
          return reply.code(404).send({ error: "group_not_found" });

        // Derive group's breed/dam/sire for matching
        const groupBreed = deriveBreedFromGroup(group);
        const groupDamId = group.damId ?? group.plan?.damId ?? null;
        const groupSireId = group.sireId ?? group.plan?.sireId ?? null;

        // Get waitlist entry IDs already linked to this group
        const linkedEntries = await prisma.offspringGroupBuyer.findMany({
          where: { groupId, tenantId },
          select: { waitlistEntryId: true },
        });
        const linkedWaitlistIds = linkedEntries
          .map((b) => b.waitlistEntryId)
          .filter((id): id is number => id != null);

        // Fetch eligible waitlist entries for this tenant
        const candidates = await prisma.waitlistEntry.findMany({
          where: {
            tenantId,
            status: { not: "ALLOCATED" },
            ...(linkedWaitlistIds.length > 0
              ? { id: { notIn: linkedWaitlistIds } }
              : {}),
            // Match species if the group has one
            ...(group.species ? { speciesPref: group.species } : {}),
          },
          include: {
            clientParty: {
              select: { id: true, type: true, name: true },
            },
            depositInvoice: {
              select: {
                id: true,
                invoiceNumber: true,
                status: true,
                amountCents: true,
                balanceCents: true,
              },
            },
          },
        });

        // Score each candidate
        const scored = candidates.map((entry) => {
          let matchScore = 0;
          const matchTags: string[] = [];

          // Breed match: 60 pts
          if (groupBreed && breedPrefsMatch(entry.breedPrefs, groupBreed)) {
            matchScore += 60;
            matchTags.push("BREED_MATCH");
          }

          // Dam preference match: 30 pts
          if (groupDamId && entry.damPrefId === groupDamId) {
            matchScore += 30;
            matchTags.push("DAM_PREFERENCE");
          }

          // Sire preference match: 30 pts
          if (groupSireId && entry.sirePrefId === groupSireId) {
            matchScore += 30;
            matchTags.push("SIRE_PREFERENCE");
          }

          return {
            id: entry.id,
            clientPartyId: entry.clientPartyId,
            clientPartyName: entry.clientParty?.name ?? null,
            clientPartyType: entry.clientParty?.type ?? null,
            speciesPref: entry.speciesPref,
            breedPrefs: entry.breedPrefs,
            damPrefId: entry.damPrefId,
            sirePrefId: entry.sirePrefId,
            status: entry.status,
            depositPaidAt: entry.depositPaidAt?.toISOString() ?? null,
            depositPaidCents: entry.depositPaidCents,
            depositRequiredCents: entry.depositRequiredCents,
            depositInvoice: entry.depositInvoice
              ? {
                  id: entry.depositInvoice.id,
                  invoiceNumber: entry.depositInvoice.invoiceNumber,
                  status: entry.depositInvoice.status,
                  amountCents: Number(entry.depositInvoice.amountCents),
                  balanceCents: Number(entry.depositInvoice.balanceCents),
                }
              : null,
            matchScore,
            matchTags,
            createdAt: entry.createdAt.toISOString(),
            notes: entry.notes,
          };
        });

        // Sort: score DESC, then depositPaidAt ASC (paid first)
        scored.sort((a, b) => {
          // Higher score first
          if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore;

          // Deposit paid comes first (non-null before null)
          const aHasDeposit = a.depositPaidAt != null ? 0 : 1;
          const bHasDeposit = b.depositPaidAt != null ? 0 : 1;
          if (aHasDeposit !== bHasDeposit) return aHasDeposit - bHasDeposit;

          // Then by deposit date (earlier = higher priority)
          if (a.depositPaidAt && b.depositPaidAt) {
            return (
              new Date(a.depositPaidAt).getTime() -
              new Date(b.depositPaidAt).getTime()
            );
          }

          // Finally FIFO by entry created date
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });

        // Only return candidates with at least 1 match point
        const relevant = scored.filter((c) => c.matchScore > 0);

        reply.send({
          ok: true,
          groupId,
          groupBreed,
          groupDamId,
          groupSireId,
          candidates: relevant,
          totalCandidates: relevant.length,
        });
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    },
  );

  // ──────────────────────────────────────────────────────────
  // 9. POST /offspring/groups/:id/buyers/:buyerId/opt-out
  //    Full opt-out workflow with deposit disposition.
  //    Sets stage=OPTED_OUT, clears offspring assignment if
  //    matched, optionally returns buyer to waitlist.
  // ──────────────────────────────────────────────────────────
  app.post<{
    Params: { id: string; buyerId: string };
    Body: {
      reason?: string;
      optedOutBy: "BUYER" | "BREEDER";
      depositDisposition: "REFUND" | "FORFEIT" | "HOLD_AS_CREDIT" | "PENDING";
      returnToWaitlist?: boolean;
    };
  }>(
    "/offspring/groups/:id/buyers/:buyerId/opt-out",
    async (req, reply) => {
      try {
        const tenantId = getTenantId(req)!;
        const groupId = toNum(req.params.id);
        const buyerId = toNum(req.params.buyerId);
        if (!groupId || !buyerId) {
          return reply.code(400).send({ error: "invalid_id" });
        }

        const {
          reason,
          optedOutBy,
          depositDisposition,
          returnToWaitlist,
        } = req.body ?? {};

        // Validate optedOutBy
        if (!optedOutBy || !["BUYER", "BREEDER"].includes(optedOutBy)) {
          return reply.code(400).send({
            error: "optedOutBy must be 'BUYER' or 'BREEDER'",
          });
        }

        // Validate depositDisposition
        const validDispositions = [
          "REFUND",
          "FORFEIT",
          "HOLD_AS_CREDIT",
          "PENDING",
        ];
        if (!depositDisposition || !validDispositions.includes(depositDisposition)) {
          return reply.code(400).send({
            error: `depositDisposition must be one of: ${validDispositions.join(", ")}`,
          });
        }

        // Verify group exists
        const group = await prisma.offspringGroup.findFirst({
          where: { id: groupId, tenantId },
          select: { id: true },
        });
        if (!group)
          return reply.code(404).send({ error: "group_not_found" });

        // Fetch the buyer record with related data
        const buyer = await prisma.offspringGroupBuyer.findFirst({
          where: { id: buyerId, groupId, tenantId },
          include: {
            buyerParty: { select: { id: true, name: true } },
            waitlistEntry: { select: { id: true, status: true } },
          },
        });
        if (!buyer)
          return reply.code(404).send({ error: "buyer_not_found" });

        // Already opted out?
        if (buyer.stage === "OPTED_OUT") {
          return reply
            .code(409)
            .send({ error: "buyer_already_opted_out" });
        }

        // Check if buyer was matched to an offspring via buyerPartyId
        let unassignedOffspringId: number | null = null;
        if (buyer.buyerPartyId) {
          const matchedOffspring = await prisma.offspring.findFirst({
            where: {
              groupId,
              tenantId,
              buyerPartyId: buyer.buyerPartyId,
            },
            select: { id: true },
          });

          if (matchedOffspring) {
            unassignedOffspringId = matchedOffspring.id;
            // Clear the offspring's buyer assignment
            await prisma.offspring.update({
              where: { id: matchedOffspring.id },
              data: {
                buyerPartyId: null,
                placementState: "UNASSIGNED",
              },
            });
          }
        }

        // Update the buyer record to OPTED_OUT
        const updatedBuyer = await prisma.offspringGroupBuyer.update({
          where: { id: buyerId },
          data: {
            stage: "OPTED_OUT",
            optedOutAt: new Date(),
            optedOutReason: reason ?? null,
            optedOutBy,
            depositDisposition,
          },
          include: buyerIncludes,
        });

        // If returnToWaitlist and buyer has a waitlist entry, restore to APPROVED
        let waitlistRestored = false;
        if (returnToWaitlist && buyer.waitlistEntryId) {
          await prisma.waitlistEntry.update({
            where: { id: buyer.waitlistEntryId },
            data: { status: "APPROVED" },
          });
          waitlistRestored = true;
        }

        reply.send({
          ok: true,
          buyer: toBuyerDTO(updatedBuyer),
          unassignedOffspringId,
          waitlistRestored,
        });
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    },
  );

  // ──────────────────────────────────────────────────────────
  // 10. POST /offspring/groups/:id/buyers/:buyerId/slots
  //     Creates a new OffspringGroupBuyer record for the same
  //     party (multi-offspring buyer).
  //     Assigns placementRank = current max + 1.
  //     Returns all slots for this party.
  //
  //     NOTE: @@unique([groupId, buyerPartyId]) constraint
  //     currently prevents multiple records for the same party.
  //     A migration to relax this constraint is needed for
  //     full multi-slot support.
  // ──────────────────────────────────────────────────────────
  app.post<{ Params: { id: string; buyerId: string } }>(
    "/offspring/groups/:id/buyers/:buyerId/slots",
    async (req, reply) => {
      try {
        const tenantId = getTenantId(req)!;
        const groupId = toNum(req.params.id);
        const buyerId = toNum(req.params.buyerId);
        if (!groupId || !buyerId) {
          return reply.code(400).send({ error: "invalid_id" });
        }

        // Verify group exists
        const group = await prisma.offspringGroup.findFirst({
          where: { id: groupId, tenantId },
          select: { id: true },
        });
        if (!group)
          return reply.code(404).send({ error: "group_not_found" });

        // Fetch the original buyer record
        const originalBuyer = await prisma.offspringGroupBuyer.findFirst({
          where: { id: buyerId, groupId, tenantId },
          include: {
            buyerParty: { select: { id: true, type: true, name: true } },
          },
        });
        if (!originalBuyer)
          return reply.code(404).send({ error: "buyer_not_found" });

        // Calculate next placementRank (max + 1)
        const maxRankResult = await prisma.offspringGroupBuyer.aggregate({
          where: { groupId, tenantId },
          _max: { placementRank: true },
        });
        const nextRank = (maxRankResult._max.placementRank ?? 0) + 1;

        // Create a new OffspringGroupBuyer for the same party
        let newSlot: any;
        try {
          newSlot = await prisma.offspringGroupBuyer.create({
            data: {
              tenantId,
              groupId,
              buyerPartyId: originalBuyer.buyerPartyId,
              waitlistEntryId: null, // Additional slots don't link to waitlist
              buyerId: originalBuyer.buyerId,
              placementRank: nextRank,
              stage: "PENDING",
            },
            include: buyerIncludes,
          });
        } catch (err: any) {
          if (err?.code === "P2002") {
            // Unique constraint violation — @@unique([groupId, buyerPartyId])
            return reply.code(409).send({
              error: "multi_slot_constraint",
              message:
                "Multi-slot support requires a migration to relax the " +
                "unique constraint on OffspringGroupBuyer(groupId, buyerPartyId). " +
                "This buyer already has a record in this group.",
            });
          }
          throw err;
        }

        // Return all slots for this party in this group
        const partyFilter = originalBuyer.buyerPartyId
          ? { buyerPartyId: originalBuyer.buyerPartyId }
          : { buyerId: originalBuyer.buyerId };

        const allSlots = await prisma.offspringGroupBuyer.findMany({
          where: {
            groupId,
            tenantId,
            ...partyFilter,
          },
          include: buyerIncludes,
          orderBy: [{ placementRank: "asc" }, { id: "asc" }],
        });

        reply.status(201).send({
          ok: true,
          newSlot: toBuyerDTO(newSlot),
          allSlots: allSlots.map(toBuyerDTO),
        });
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    },
  );

  // ──────────────────────────────────────────────────────────
  // 11. GET /offspring/groups/:id/buyers/deposit-audit
  //     Returns deposit/credit status for all active buyers in
  //     a group, classified into actionable buckets.
  //     Used by the frontend's DepositToggleFlow when a breeder
  //     toggles "Require Deposit" ON for a group with existing buyers.
  // ──────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    "/offspring/groups/:id/buyers/deposit-audit",
    async (req, reply) => {
      try {
        const tenantId = getTenantId(req)!;
        const groupId = toNum(req.params.id);
        if (!groupId)
          return reply.code(400).send({ error: "invalid_group_id" });

        // Verify group exists
        const group = await prisma.offspringGroup.findFirst({
          where: { id: groupId, tenantId },
          select: { id: true },
        });
        if (!group)
          return reply.code(404).send({ error: "group_not_found" });

        // Fetch all active (non-opted-out) buyers in the group
        const buyers = await prisma.offspringGroupBuyer.findMany({
          where: {
            groupId,
            tenantId,
            stage: { not: "OPTED_OUT" },
          },
          include: {
            ...buyerIncludes,
            buyerParty: {
              select: { id: true, type: true, name: true, email: true, phoneE164: true },
            },
          },
          orderBy: [{ placementRank: "asc" }, { id: "asc" }],
        });

        const buyersWithUnappliedCredit: Array<{
          buyerId: number;
          buyerName: string;
          buyerEmail: string | null;
          waitlistEntryId: number | null;
          unappliedCredit: {
            invoiceId: number;
            invoiceNumber: string;
            amountCents: number;
          };
        }> = [];

        const buyersNeedingInvoice: Array<{
          buyerId: number;
          buyerName: string;
          buyerEmail: string | null;
          waitlistEntryId: number | null;
        }> = [];

        const buyersAlreadyHandled: Array<{
          buyerId: number;
          buyerName: string;
          invoiceId: number;
          invoiceNumber: string;
          invoiceStatus: string;
          amountCents: number;
        }> = [];

        for (const buyer of buyers) {
          const dto = toBuyerDTO(buyer);

          // If buyer already has a linked invoice, they're handled
          if (buyer.Invoice) {
            buyersAlreadyHandled.push({
              buyerId: buyer.id,
              buyerName: dto.buyerName,
              invoiceId: buyer.Invoice.id,
              invoiceNumber: buyer.Invoice.invoiceNumber,
              invoiceStatus: buyer.Invoice.status,
              amountCents: Number(buyer.Invoice.amountCents),
            });
            continue;
          }

          // Resolve the party ID for credit discovery
          const partyId =
            buyer.buyerPartyId ??
            buyer.waitlistEntry?.clientPartyId ??
            null;

          // Check for unapplied deposit credits (same logic as POST assign)
          if (partyId) {
            const creditInvoice = await prisma.invoice.findFirst({
              where: {
                tenantId,
                clientPartyId: partyId,
                breedingPlanBuyerId: null,
                offspringGroupBuyerId: null,
                status: { in: ["paid", "partially_paid"] },
                LineItems: { some: { kind: "DEPOSIT" } },
              },
              select: { id: true, invoiceNumber: true, amountCents: true },
            });

            if (creditInvoice) {
              buyersWithUnappliedCredit.push({
                buyerId: buyer.id,
                buyerName: dto.buyerName,
                buyerEmail: dto.buyerEmail,
                waitlistEntryId: buyer.waitlistEntryId,
                unappliedCredit: {
                  invoiceId: creditInvoice.id,
                  invoiceNumber: creditInvoice.invoiceNumber,
                  amountCents: Number(creditInvoice.amountCents),
                },
              });
              continue;
            }
          }

          // No linked invoice and no unapplied credit → needs a new invoice
          buyersNeedingInvoice.push({
            buyerId: buyer.id,
            buyerName: dto.buyerName,
            buyerEmail: dto.buyerEmail,
            waitlistEntryId: buyer.waitlistEntryId,
          });
        }

        reply.send({
          groupId,
          totalBuyers: buyers.length,
          buyersWithUnappliedCredit,
          buyersNeedingInvoice,
          buyersAlreadyHandled,
        });
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    },
  );
};

export default offspringGroupBuyersRoutes;
