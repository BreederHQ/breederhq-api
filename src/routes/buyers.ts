// src/routes/buyers.ts
// Buyer CRM routes (P4) - Manage prospective horse buyers
//
// All routes are prefixed with /api/v1/buyers
// GET    /api/v1/buyers              - List buyers with filters, search, pagination
// POST   /api/v1/buyers              - Create buyer (links to Party)
// GET    /api/v1/buyers/:id          - Get buyer with interests, deals, activities
// PATCH  /api/v1/buyers/:id          - Update buyer
// DELETE /api/v1/buyers/:id          - Archive buyer (soft delete)
//
// Buyer Interests
// POST   /api/v1/buyers/:id/interests           - Add interest in horse
// PATCH  /api/v1/buyers/:id/interests/:animalId - Update interest level
// DELETE /api/v1/buyers/:id/interests/:animalId - Remove interest
//
// Activities (via Party CRM - inherited through partyId)
// GET    /api/v1/buyers/:id/activities   - Get activity timeline (from party)
//
// Tags
// POST   /api/v1/buyers/:id/tags         - Add tag
// DELETE /api/v1/buyers/:id/tags/:tagId  - Remove tag

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import type { BuyerStatus, InterestLevel, Sex, Prisma } from "@prisma/client";

// ───────────────────────── Helpers ─────────────────────────

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function trimToNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function parsePaging(q: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(q?.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(q?.limit ?? "50"), 10) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// Valid buyer status values
const BUYER_STATUSES: BuyerStatus[] = [
  "LEAD",
  "ACTIVE",
  "QUALIFIED",
  "NEGOTIATING",
  "PURCHASED",
  "INACTIVE",
  "ARCHIVED",
];

// Valid interest levels
const INTEREST_LEVELS: InterestLevel[] = [
  "BROWSING",
  "INTERESTED",
  "SERIOUS",
  "OFFERED",
  "DECLINED",
];

// Valid sex values
const SEX_VALUES: Sex[] = ["FEMALE", "MALE", "UNKNOWN"];

function isValidStatus(v: unknown): v is BuyerStatus {
  return typeof v === "string" && BUYER_STATUSES.includes(v as BuyerStatus);
}

function isValidInterestLevel(v: unknown): v is InterestLevel {
  return typeof v === "string" && INTEREST_LEVELS.includes(v as InterestLevel);
}

function isValidSex(v: unknown): v is Sex {
  return typeof v === "string" && SEX_VALUES.includes(v as Sex);
}

function parseStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.filter((item) => typeof item === "string" && item.trim()).map((item) => String(item).trim());
  }
  if (typeof v === "string") {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

// ───────────────────────── Routes ─────────────────────────

const buyersRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────
  // LIST BUYERS
  // ─────────────────────────────────────────────────────────

  // GET /buyers
  app.get("/buyers", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const query = req.query as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(query);

      // Build where clause
      const where: Prisma.BuyerWhereInput = { tenantId };

      // Status filter
      if (query.status && isValidStatus(query.status)) {
        where.status = query.status;
      }

      // Include archived filter (default: exclude archived)
      if (query.includeArchived !== "true") {
        where.archivedAt = null;
      }

      // Search filter (searches party name, email)
      const search = trimToNull(query.search);
      if (search) {
        where.party = {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        };
      }

      // Source filter
      const source = trimToNull(query.source);
      if (source) {
        where.source = source;
      }

      // Preferred breed filter
      const preferredBreed = trimToNull(query.preferredBreed);
      if (preferredBreed) {
        where.preferredBreeds = { has: preferredBreed };
      }

      // Preferred use filter
      const preferredUse = trimToNull(query.preferredUse);
      if (preferredUse) {
        where.preferredUses = { has: preferredUse };
      }

      const [buyers, total] = await Promise.all([
        prisma.buyer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: "desc" },
          include: {
            party: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneE164: true,
                city: true,
                state: true,
                country: true,
              },
            },
            _count: {
              select: {
                interests: true,
                deals: true,
              },
            },
          },
        }),
        prisma.buyer.count({ where }),
      ]);

      return reply.send({
        items: buyers,
        total,
        page,
        limit,
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to list buyers");
      return reply.code(500).send({ error: "list_buyers_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // CREATE BUYER
  // ─────────────────────────────────────────────────────────

  // POST /buyers
  app.post("/buyers", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const body = req.body as Record<string, unknown>;

      // Require partyId - must link to existing Party
      const partyId = toNum(body.partyId);
      if (!partyId) {
        return reply.code(400).send({ error: "party_id_required" });
      }

      // Verify party exists and belongs to this tenant
      const party = await prisma.party.findFirst({
        where: { id: partyId, tenantId },
      });
      if (!party) {
        return reply.code(404).send({ error: "party_not_found" });
      }

      // Check if buyer already exists for this party
      const existingBuyer = await prisma.buyer.findUnique({
        where: { partyId },
      });
      if (existingBuyer) {
        return reply.code(409).send({ error: "buyer_already_exists", buyerId: existingBuyer.id });
      }

      // Parse optional fields
      const status = isValidStatus(body.status) ? body.status : "ACTIVE";
      const source = trimToNull(body.source);
      const notes = trimToNull(body.notes);
      const budget = body.budget != null ? parseFloat(String(body.budget)) : null;
      const budgetCurrency = trimToNull(body.budgetCurrency) || "USD";
      const preferredBreeds = parseStringArray(body.preferredBreeds);
      const preferredUses = parseStringArray(body.preferredUses);
      const preferredAgeMin = toNum(body.preferredAgeMin);
      const preferredAgeMax = toNum(body.preferredAgeMax);
      const preferredSex = isValidSex(body.preferredSex) ? body.preferredSex : null;

      const buyer = await prisma.buyer.create({
        data: {
          tenantId,
          partyId,
          status,
          source,
          notes,
          budget: budget != null && !isNaN(budget) ? budget : null,
          budgetCurrency,
          preferredBreeds,
          preferredUses,
          preferredAgeMin,
          preferredAgeMax,
          preferredSex,
        },
        include: {
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

      // Log activity on the party
      try {
        await prisma.partyActivity.create({
          data: {
            tenantId,
            partyId,
            kind: "STATUS_CHANGED",
            title: "Marked as buyer",
            detail: `Added to buyer pipeline with status: ${status}`,
          },
        });
      } catch {
        // Don't fail if activity logging fails
      }

      return reply.code(201).send({ ok: true, buyer });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to create buyer");
      return reply.code(500).send({ error: "create_buyer_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // GET BUYER DETAIL
  // ─────────────────────────────────────────────────────────

  // GET /buyers/:id
  app.get("/buyers/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = toNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_buyer_id" });

      const buyer = await prisma.buyer.findFirst({
        where: { id, tenantId },
        include: {
          party: {
            select: {
              id: true,
              type: true,
              name: true,
              email: true,
              phoneE164: true,
              whatsappE164: true,
              street: true,
              street2: true,
              city: true,
              state: true,
              postalCode: true,
              country: true,
            },
          },
          interests: {
            include: {
              animal: {
                select: {
                  id: true,
                  name: true,
                  species: true,
                  sex: true,
                  breed: true,
                  birthDate: true,
                  photoUrl: true,
                  forSale: true,
                  declaredValueCents: true,
                  declaredValueCurrency: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          deals: {
            include: {
              animal: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { updatedAt: "desc" },
            take: 10,
          },
          tagAssignments: {
            include: {
              tag: true,
            },
          },
        },
      });

      if (!buyer) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      return reply.send({ buyer });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get buyer");
      return reply.code(500).send({ error: "get_buyer_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // UPDATE BUYER
  // ─────────────────────────────────────────────────────────

  // PATCH /buyers/:id
  app.patch("/buyers/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = toNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_buyer_id" });

      // Verify buyer exists
      const existing = await prisma.buyer.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      const body = req.body as Record<string, unknown>;
      const updates: Prisma.BuyerUpdateInput = {};

      // Status
      if (body.status !== undefined) {
        if (isValidStatus(body.status)) {
          updates.status = body.status;
        } else {
          return reply.code(400).send({ error: "invalid_status" });
        }
      }

      // Source
      if (body.source !== undefined) {
        updates.source = trimToNull(body.source);
      }

      // Notes
      if (body.notes !== undefined) {
        updates.notes = trimToNull(body.notes);
      }

      // Budget
      if (body.budget !== undefined) {
        const budget = body.budget != null ? parseFloat(String(body.budget)) : null;
        updates.budget = budget != null && !isNaN(budget) ? budget : null;
      }

      // Budget currency
      if (body.budgetCurrency !== undefined) {
        updates.budgetCurrency = trimToNull(body.budgetCurrency) || "USD";
      }

      // Preferred breeds
      if (body.preferredBreeds !== undefined) {
        updates.preferredBreeds = parseStringArray(body.preferredBreeds);
      }

      // Preferred uses
      if (body.preferredUses !== undefined) {
        updates.preferredUses = parseStringArray(body.preferredUses);
      }

      // Preferred age range
      if (body.preferredAgeMin !== undefined) {
        updates.preferredAgeMin = toNum(body.preferredAgeMin);
      }
      if (body.preferredAgeMax !== undefined) {
        updates.preferredAgeMax = toNum(body.preferredAgeMax);
      }

      // Preferred sex
      if (body.preferredSex !== undefined) {
        if (body.preferredSex === null) {
          updates.preferredSex = null;
        } else if (isValidSex(body.preferredSex)) {
          updates.preferredSex = body.preferredSex;
        } else {
          return reply.code(400).send({ error: "invalid_sex" });
        }
      }

      const buyer = await prisma.buyer.update({
        where: { id },
        data: updates,
        include: {
          party: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Log status change if applicable
      if (updates.status && updates.status !== existing.status) {
        try {
          await prisma.partyActivity.create({
            data: {
              tenantId,
              partyId: existing.partyId,
              kind: "STATUS_CHANGED",
              title: "Buyer status changed",
              detail: `Status changed from ${existing.status} to ${updates.status}`,
            },
          });
        } catch {
          // Don't fail if activity logging fails
        }
      }

      return reply.send({ ok: true, buyer });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to update buyer");
      return reply.code(500).send({ error: "update_buyer_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // ARCHIVE BUYER (soft delete)
  // ─────────────────────────────────────────────────────────

  // DELETE /buyers/:id
  app.delete("/buyers/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = toNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_buyer_id" });

      const existing = await prisma.buyer.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      // Soft delete by setting archivedAt
      const buyer = await prisma.buyer.update({
        where: { id },
        data: {
          archivedAt: new Date(),
          status: "ARCHIVED",
        },
      });

      // Log activity
      try {
        await prisma.partyActivity.create({
          data: {
            tenantId,
            partyId: existing.partyId,
            kind: "STATUS_CHANGED",
            title: "Removed from buyers",
            detail: "Archived from buyer pipeline",
          },
        });
      } catch {
        // Don't fail if activity logging fails
      }

      return reply.send({ ok: true, buyer: { id: buyer.id, archivedAt: buyer.archivedAt } });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to archive buyer");
      return reply.code(500).send({ error: "archive_buyer_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // BUYER INTERESTS
  // ─────────────────────────────────────────────────────────

  // POST /buyers/:id/interests - Add interest in a horse
  app.post("/buyers/:id/interests", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const buyerId = toNum((req.params as any).id);
      if (!buyerId) return reply.code(400).send({ error: "invalid_buyer_id" });

      const body = req.body as Record<string, unknown>;
      const animalId = toNum(body.animalId);
      if (!animalId) return reply.code(400).send({ error: "animal_id_required" });

      // Verify buyer exists
      const buyer = await prisma.buyer.findFirst({
        where: { id: buyerId, tenantId },
      });
      if (!buyer) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      // Verify animal exists and belongs to tenant
      const animal = await prisma.animal.findFirst({
        where: { id: animalId, tenantId },
      });
      if (!animal) {
        return reply.code(404).send({ error: "animal_not_found" });
      }

      // Check if interest already exists
      const existingInterest = await prisma.buyerInterest.findUnique({
        where: { buyerId_animalId: { buyerId, animalId } },
      });
      if (existingInterest) {
        return reply.code(409).send({ error: "interest_already_exists", interestId: existingInterest.id });
      }

      const level = isValidInterestLevel(body.level) ? body.level : "INTERESTED";
      const notes = trimToNull(body.notes);

      const interest = await prisma.buyerInterest.create({
        data: {
          buyerId,
          animalId,
          level,
          notes,
        },
        include: {
          animal: {
            select: {
              id: true,
              name: true,
              species: true,
              sex: true,
              breed: true,
            },
          },
        },
      });

      // Log activity on the party
      try {
        await prisma.partyActivity.create({
          data: {
            tenantId,
            partyId: buyer.partyId,
            kind: "NOTE_ADDED",
            title: "Interest added",
            detail: `Interested in ${animal.name} (${level})`,
          },
        });
      } catch {
        // Don't fail if activity logging fails
      }

      return reply.code(201).send({ ok: true, interest });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to add buyer interest");
      return reply.code(500).send({ error: "add_interest_failed" });
    }
  });

  // PATCH /buyers/:id/interests/:animalId - Update interest level
  app.patch("/buyers/:id/interests/:animalId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const buyerId = toNum((req.params as any).id);
      const animalId = toNum((req.params as any).animalId);
      if (!buyerId || !animalId) return reply.code(400).send({ error: "invalid_ids" });

      // Verify buyer belongs to tenant
      const buyer = await prisma.buyer.findFirst({
        where: { id: buyerId, tenantId },
      });
      if (!buyer) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      // Find existing interest
      const existing = await prisma.buyerInterest.findUnique({
        where: { buyerId_animalId: { buyerId, animalId } },
      });
      if (!existing) {
        return reply.code(404).send({ error: "interest_not_found" });
      }

      const body = req.body as Record<string, unknown>;
      const updates: Prisma.BuyerInterestUpdateInput = {};

      if (body.level !== undefined) {
        if (isValidInterestLevel(body.level)) {
          updates.level = body.level;
        } else {
          return reply.code(400).send({ error: "invalid_level" });
        }
      }

      if (body.notes !== undefined) {
        updates.notes = trimToNull(body.notes);
      }

      const interest = await prisma.buyerInterest.update({
        where: { id: existing.id },
        data: updates,
        include: {
          animal: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return reply.send({ ok: true, interest });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to update buyer interest");
      return reply.code(500).send({ error: "update_interest_failed" });
    }
  });

  // DELETE /buyers/:id/interests/:animalId - Remove interest
  app.delete("/buyers/:id/interests/:animalId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const buyerId = toNum((req.params as any).id);
      const animalId = toNum((req.params as any).animalId);
      if (!buyerId || !animalId) return reply.code(400).send({ error: "invalid_ids" });

      // Verify buyer belongs to tenant
      const buyer = await prisma.buyer.findFirst({
        where: { id: buyerId, tenantId },
      });
      if (!buyer) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      // Find existing interest
      const existing = await prisma.buyerInterest.findUnique({
        where: { buyerId_animalId: { buyerId, animalId } },
        include: {
          animal: {
            select: { name: true },
          },
        },
      });
      if (!existing) {
        return reply.code(404).send({ error: "interest_not_found" });
      }

      await prisma.buyerInterest.delete({
        where: { id: existing.id },
      });

      // Log activity
      try {
        await prisma.partyActivity.create({
          data: {
            tenantId,
            partyId: buyer.partyId,
            kind: "NOTE_ADDED",
            title: "Interest removed",
            detail: `No longer interested in ${existing.animal.name}`,
          },
        });
      } catch {
        // Don't fail if activity logging fails
      }

      return reply.send({ ok: true });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to remove buyer interest");
      return reply.code(500).send({ error: "remove_interest_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // BUYER ACTIVITIES (delegated to Party)
  // ─────────────────────────────────────────────────────────

  // GET /buyers/:id/activities - Get activity timeline from party
  app.get("/buyers/:id/activities", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const buyerId = toNum((req.params as any).id);
      if (!buyerId) return reply.code(400).send({ error: "invalid_buyer_id" });

      const query = req.query as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(query);

      // Get buyer to find partyId
      const buyer = await prisma.buyer.findFirst({
        where: { id: buyerId, tenantId },
        select: { partyId: true },
      });
      if (!buyer) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      // Fetch activities from party
      const [activities, total] = await Promise.all([
        prisma.partyActivity.findMany({
          where: { tenantId, partyId: buyer.partyId },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.partyActivity.count({
          where: { tenantId, partyId: buyer.partyId },
        }),
      ]);

      return reply.send({
        items: activities,
        total,
        page,
        limit,
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get buyer activities");
      return reply.code(500).send({ error: "get_activities_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // BUYER TAGS
  // ─────────────────────────────────────────────────────────

  // POST /buyers/:id/tags - Add tag to buyer
  app.post("/buyers/:id/tags", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const buyerId = toNum((req.params as any).id);
      if (!buyerId) return reply.code(400).send({ error: "invalid_buyer_id" });

      const body = req.body as Record<string, unknown>;
      const tagId = toNum(body.tagId);
      if (!tagId) return reply.code(400).send({ error: "tag_id_required" });

      // Verify buyer exists
      const buyer = await prisma.buyer.findFirst({
        where: { id: buyerId, tenantId },
      });
      if (!buyer) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      // Verify tag exists and belongs to tenant with BUYER module
      const tag = await prisma.tag.findFirst({
        where: { id: tagId, tenantId, module: "BUYER" },
      });
      if (!tag) {
        return reply.code(404).send({ error: "tag_not_found" });
      }

      // Check if already assigned
      const existing = await prisma.tagAssignment.findUnique({
        where: { tagId_buyerId: { tagId, buyerId } },
      });
      if (existing) {
        return reply.code(409).send({ error: "tag_already_assigned" });
      }

      const assignment = await prisma.tagAssignment.create({
        data: {
          tagId,
          buyerId,
        },
        include: {
          tag: true,
        },
      });

      return reply.code(201).send({ ok: true, assignment });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to add tag to buyer");
      return reply.code(500).send({ error: "add_tag_failed" });
    }
  });

  // DELETE /buyers/:id/tags/:tagId - Remove tag from buyer
  app.delete("/buyers/:id/tags/:tagId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const buyerId = toNum((req.params as any).id);
      const tagId = toNum((req.params as any).tagId);
      if (!buyerId || !tagId) return reply.code(400).send({ error: "invalid_ids" });

      // Verify buyer belongs to tenant
      const buyer = await prisma.buyer.findFirst({
        where: { id: buyerId, tenantId },
      });
      if (!buyer) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      // Find and delete assignment
      const existing = await prisma.tagAssignment.findUnique({
        where: { tagId_buyerId: { tagId, buyerId } },
      });
      if (!existing) {
        return reply.code(404).send({ error: "tag_assignment_not_found" });
      }

      await prisma.tagAssignment.delete({
        where: { id: existing.id },
      });

      return reply.send({ ok: true });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to remove tag from buyer");
      return reply.code(500).send({ error: "remove_tag_failed" });
    }
  });
};

export default buyersRoutes;
