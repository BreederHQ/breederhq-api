// src/routes/deals.ts
// Deal routes (P4) - Sales pipeline management
//
// All routes are prefixed with /api/v1/deals
// POST   /api/v1/deals               - Create deal
// GET    /api/v1/deals               - List deals (supports stage filter for pipeline view)
// GET    /api/v1/deals/:id           - Get deal with buyer, animal, activities
// PATCH  /api/v1/deals/:id           - Update deal (including stage transitions)
// POST   /api/v1/deals/:id/close     - Close deal (won/lost with outcome)
//
// Deal Activities
// POST   /api/v1/deals/:id/activities   - Log activity on deal
// GET    /api/v1/deals/:id/activities   - Get activity timeline for deal
//
// Tags
// POST   /api/v1/deals/:id/tags         - Add tag
// DELETE /api/v1/deals/:id/tags/:tagId  - Remove tag

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import type { DealStage, DealOutcome, DealActivityType, Prisma } from "@prisma/client";

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

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

// Valid deal stage values
const DEAL_STAGES: DealStage[] = [
  "INQUIRY",
  "VIEWING",
  "NEGOTIATION",
  "VET_CHECK",
  "CONTRACT",
  "CLOSED_WON",
  "CLOSED_LOST",
];

// Valid deal outcome values
const DEAL_OUTCOMES: DealOutcome[] = ["WON", "LOST", "CANCELLED"];

// Valid activity types
const ACTIVITY_TYPES: DealActivityType[] = [
  "CALL",
  "EMAIL",
  "MEETING",
  "VIEWING",
  "NOTE",
  "STATUS_CHANGE",
  "OFFER_MADE",
  "OFFER_RECEIVED",
  "CONTRACT_SENT",
  "CONTRACT_SIGNED",
];

function isValidStage(v: unknown): v is DealStage {
  return typeof v === "string" && DEAL_STAGES.includes(v as DealStage);
}

function isValidOutcome(v: unknown): v is DealOutcome {
  return typeof v === "string" && DEAL_OUTCOMES.includes(v as DealOutcome);
}

function isValidActivityType(v: unknown): v is DealActivityType {
  return typeof v === "string" && ACTIVITY_TYPES.includes(v as DealActivityType);
}

// Check if stage is a closed stage
function isClosedStage(stage: DealStage): boolean {
  return stage === "CLOSED_WON" || stage === "CLOSED_LOST";
}

// ───────────────────────── Routes ─────────────────────────

const dealsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────
  // LIST DEALS
  // ─────────────────────────────────────────────────────────

  // GET /deals
  app.get("/deals", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const query = req.query as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(query);

      // Build where clause
      const where: Prisma.DealWhereInput = { tenantId };

      // Stage filter (can be comma-separated for pipeline view)
      const stageParam = trimToNull(query.stage);
      if (stageParam) {
        const stages = stageParam.split(",").filter(isValidStage);
        if (stages.length === 1) {
          where.stage = stages[0];
        } else if (stages.length > 1) {
          where.stage = { in: stages };
        }
      }

      // Buyer filter
      const buyerId = toNum(query.buyerId);
      if (buyerId) {
        where.buyerId = buyerId;
      }

      // Animal filter
      const animalId = toNum(query.animalId);
      if (animalId) {
        where.animalId = animalId;
      }

      // Outcome filter
      if (query.outcome !== undefined) {
        if (query.outcome === "null" || query.outcome === "") {
          where.outcome = null;
        } else if (isValidOutcome(query.outcome)) {
          where.outcome = query.outcome;
        }
      }

      // Search filter (searches deal name)
      const search = trimToNull(query.search);
      if (search) {
        where.name = { contains: search, mode: "insensitive" };
      }

      // Date range filter for expected close
      const expectedCloseFrom = parseDate(query.expectedCloseFrom);
      const expectedCloseTo = parseDate(query.expectedCloseTo);
      if (expectedCloseFrom || expectedCloseTo) {
        where.expectedCloseDate = {};
        if (expectedCloseFrom) where.expectedCloseDate.gte = expectedCloseFrom;
        if (expectedCloseTo) where.expectedCloseDate.lte = expectedCloseTo;
      }

      const [deals, total] = await Promise.all([
        prisma.deal.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: "desc" },
          include: {
            buyer: {
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
            },
            animal: {
              select: {
                id: true,
                name: true,
                species: true,
                photoUrl: true,
              },
            },
            _count: {
              select: {
                activities: true,
              },
            },
          },
        }),
        prisma.deal.count({ where }),
      ]);

      return reply.send({
        items: deals,
        total,
        page,
        limit,
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to list deals");
      return reply.code(500).send({ error: "list_deals_failed" });
    }
  });

  // GET /deals/pipeline - Get deals grouped by stage for Kanban view
  app.get("/deals/pipeline", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      // Get counts and deals for each stage
      const stages = DEAL_STAGES.filter((s) => !isClosedStage(s));

      const pipeline = await Promise.all(
        stages.map(async (stage) => {
          const [deals, count] = await Promise.all([
            prisma.deal.findMany({
              where: { tenantId, stage },
              orderBy: { updatedAt: "desc" },
              take: 50, // Limit per stage for performance
              include: {
                buyer: {
                  include: {
                    party: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
                animal: {
                  select: {
                    id: true,
                    name: true,
                    photoUrl: true,
                  },
                },
              },
            }),
            prisma.deal.count({ where: { tenantId, stage } }),
          ]);
          return { stage, deals, count };
        })
      );

      // Also get recently closed deals
      const recentlyClosed = await prisma.deal.findMany({
        where: {
          tenantId,
          stage: { in: ["CLOSED_WON", "CLOSED_LOST"] },
          closedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
        },
        orderBy: { closedAt: "desc" },
        take: 20,
        include: {
          buyer: {
            include: {
              party: {
                select: { name: true },
              },
            },
          },
          animal: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return reply.send({
        pipeline,
        recentlyClosed,
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get deals pipeline");
      return reply.code(500).send({ error: "get_pipeline_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // CREATE DEAL
  // ─────────────────────────────────────────────────────────

  // POST /deals
  app.post("/deals", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const body = req.body as Record<string, unknown>;

      // Require buyerId
      const buyerId = toNum(body.buyerId);
      if (!buyerId) {
        return reply.code(400).send({ error: "buyer_id_required" });
      }

      // Verify buyer exists and belongs to tenant
      const buyer = await prisma.buyer.findFirst({
        where: { id: buyerId, tenantId },
        include: {
          party: {
            select: { name: true },
          },
        },
      });
      if (!buyer) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      // Optional animalId
      const animalId = toNum(body.animalId);
      let animal = null;
      if (animalId) {
        animal = await prisma.animal.findFirst({
          where: { id: animalId, tenantId },
        });
        if (!animal) {
          return reply.code(404).send({ error: "animal_not_found" });
        }
      }

      // Deal name (auto-generate if not provided)
      let name = trimToNull(body.name);
      if (!name) {
        name = animal
          ? `${buyer.party.name} - ${animal.name}`
          : `${buyer.party.name} - General Inquiry`;
      }

      // Parse optional fields
      const stage = isValidStage(body.stage) ? body.stage : "INQUIRY";
      const askingPrice = body.askingPrice != null ? parseFloat(String(body.askingPrice)) : null;
      const offerPrice = body.offerPrice != null ? parseFloat(String(body.offerPrice)) : null;
      const currency = trimToNull(body.currency) || "USD";
      const expectedCloseDate = parseDate(body.expectedCloseDate);
      const notes = trimToNull(body.notes);

      const deal = await prisma.deal.create({
        data: {
          tenantId,
          buyerId,
          animalId,
          name,
          stage,
          askingPrice: askingPrice != null && !isNaN(askingPrice) ? askingPrice : null,
          offerPrice: offerPrice != null && !isNaN(offerPrice) ? offerPrice : null,
          currency,
          expectedCloseDate,
          notes,
        },
        include: {
          buyer: {
            include: {
              party: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          animal: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Log initial activity
      const userId = (req as any).userId;
      try {
        await prisma.dealActivity.create({
          data: {
            tenantId,
            dealId: deal.id,
            type: "STATUS_CHANGE",
            title: "Deal created",
            description: `New deal created with stage: ${stage}`,
            userId,
          },
        });

        // Also log on the party
        await prisma.partyActivity.create({
          data: {
            tenantId,
            partyId: buyer.partyId,
            kind: "NOTE_ADDED",
            title: "Deal started",
            detail: `New deal: ${name}`,
          },
        });
      } catch {
        // Don't fail if activity logging fails
      }

      return reply.code(201).send({ ok: true, deal });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to create deal");
      return reply.code(500).send({ error: "create_deal_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // GET DEAL DETAIL
  // ─────────────────────────────────────────────────────────

  // GET /deals/:id
  app.get("/deals/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = toNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_deal_id" });

      const deal = await prisma.deal.findFirst({
        where: { id, tenantId },
        include: {
          buyer: {
            include: {
              party: {
                select: {
                  id: true,
                  type: true,
                  name: true,
                  email: true,
                  phoneE164: true,
                  whatsappE164: true,
                  city: true,
                  state: true,
                  country: true,
                },
              },
            },
          },
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
          activities: {
            orderBy: { createdAt: "desc" },
            take: 20,
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          tagAssignments: {
            include: {
              tag: true,
            },
          },
        },
      });

      if (!deal) {
        return reply.code(404).send({ error: "deal_not_found" });
      }

      return reply.send({ deal });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get deal");
      return reply.code(500).send({ error: "get_deal_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // UPDATE DEAL
  // ─────────────────────────────────────────────────────────

  // PATCH /deals/:id
  app.patch("/deals/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = toNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_deal_id" });

      // Verify deal exists
      const existing = await prisma.deal.findFirst({
        where: { id, tenantId },
        include: {
          buyer: {
            select: { partyId: true },
          },
        },
      });
      if (!existing) {
        return reply.code(404).send({ error: "deal_not_found" });
      }

      // Can't update closed deals (use /close endpoint)
      if (isClosedStage(existing.stage)) {
        return reply.code(400).send({ error: "cannot_update_closed_deal" });
      }

      const body = req.body as Record<string, unknown>;
      const updates: Prisma.DealUpdateInput = {};
      const userId = (req as any).userId;

      // Stage (can't set to closed stages via PATCH)
      if (body.stage !== undefined) {
        if (isValidStage(body.stage)) {
          if (isClosedStage(body.stage)) {
            return reply.code(400).send({ error: "use_close_endpoint" });
          }
          updates.stage = body.stage;
        } else {
          return reply.code(400).send({ error: "invalid_stage" });
        }
      }

      // Name
      if (body.name !== undefined) {
        const name = trimToNull(body.name);
        if (!name) return reply.code(400).send({ error: "name_required" });
        updates.name = name;
      }

      // Animal (can change which animal the deal is about)
      if (body.animalId !== undefined) {
        if (body.animalId === null) {
          updates.animal = { disconnect: true };
        } else {
          const animalId = toNum(body.animalId);
          if (animalId) {
            const animal = await prisma.animal.findFirst({
              where: { id: animalId, tenantId },
            });
            if (!animal) {
              return reply.code(404).send({ error: "animal_not_found" });
            }
            updates.animal = { connect: { id: animalId } };
          }
        }
      }

      // Financials
      if (body.askingPrice !== undefined) {
        const askingPrice = body.askingPrice != null ? parseFloat(String(body.askingPrice)) : null;
        updates.askingPrice = askingPrice != null && !isNaN(askingPrice) ? askingPrice : null;
      }
      if (body.offerPrice !== undefined) {
        const offerPrice = body.offerPrice != null ? parseFloat(String(body.offerPrice)) : null;
        updates.offerPrice = offerPrice != null && !isNaN(offerPrice) ? offerPrice : null;
      }
      if (body.currency !== undefined) {
        updates.currency = trimToNull(body.currency) || "USD";
      }

      // Dates
      if (body.expectedCloseDate !== undefined) {
        updates.expectedCloseDate = parseDate(body.expectedCloseDate);
      }

      // Notes
      if (body.notes !== undefined) {
        updates.notes = trimToNull(body.notes);
      }

      const deal = await prisma.deal.update({
        where: { id },
        data: updates,
        include: {
          buyer: {
            include: {
              party: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          animal: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Log stage change activity
      if (updates.stage && updates.stage !== existing.stage) {
        try {
          await prisma.dealActivity.create({
            data: {
              tenantId,
              dealId: id,
              type: "STATUS_CHANGE",
              title: "Stage changed",
              description: `Stage changed from ${existing.stage} to ${updates.stage}`,
              userId,
            },
          });
        } catch {
          // Don't fail if activity logging fails
        }
      }

      return reply.send({ ok: true, deal });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to update deal");
      return reply.code(500).send({ error: "update_deal_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // CLOSE DEAL
  // ─────────────────────────────────────────────────────────

  // POST /deals/:id/close
  app.post("/deals/:id/close", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = toNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_deal_id" });

      // Verify deal exists
      const existing = await prisma.deal.findFirst({
        where: { id, tenantId },
        include: {
          buyer: {
            select: { id: true, partyId: true },
          },
          animal: {
            select: { name: true },
          },
        },
      });
      if (!existing) {
        return reply.code(404).send({ error: "deal_not_found" });
      }

      // Can't close already closed deals
      if (isClosedStage(existing.stage)) {
        return reply.code(400).send({ error: "deal_already_closed" });
      }

      const body = req.body as Record<string, unknown>;

      // Require outcome
      if (!isValidOutcome(body.outcome)) {
        return reply.code(400).send({ error: "valid_outcome_required" });
      }
      const outcome = body.outcome;

      // Determine stage based on outcome
      const stage: DealStage = outcome === "WON" ? "CLOSED_WON" : "CLOSED_LOST";

      // Final price (only for WON deals)
      let finalPrice = null;
      if (outcome === "WON" && body.finalPrice != null) {
        finalPrice = parseFloat(String(body.finalPrice));
        if (isNaN(finalPrice)) finalPrice = null;
      }

      // Lost reason (only for LOST deals)
      const lostReason = outcome === "LOST" ? trimToNull(body.lostReason) : null;

      const userId = (req as any).userId;

      const deal = await prisma.deal.update({
        where: { id },
        data: {
          stage,
          outcome,
          finalPrice,
          lostReason,
          closedAt: new Date(),
        },
        include: {
          buyer: {
            include: {
              party: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          animal: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Update buyer status if won
      if (outcome === "WON") {
        try {
          await prisma.buyer.update({
            where: { id: existing.buyer.id },
            data: { status: "PURCHASED" },
          });
        } catch {
          // Don't fail if buyer update fails
        }
      }

      // Log activity
      try {
        await prisma.dealActivity.create({
          data: {
            tenantId,
            dealId: id,
            type: "STATUS_CHANGE",
            title: `Deal ${outcome.toLowerCase()}`,
            description:
              outcome === "WON"
                ? `Deal closed won${finalPrice ? ` for ${deal.currency} ${finalPrice}` : ""}`
                : `Deal closed lost${lostReason ? `: ${lostReason}` : ""}`,
            userId,
          },
        });

        // Log on party
        await prisma.partyActivity.create({
          data: {
            tenantId,
            partyId: existing.buyer.partyId,
            kind: "STATUS_CHANGED",
            title: `Deal ${outcome.toLowerCase()}`,
            detail: `${existing.animal?.name || "General inquiry"} - ${outcome}`,
          },
        });
      } catch {
        // Don't fail if activity logging fails
      }

      return reply.send({ ok: true, deal });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to close deal");
      return reply.code(500).send({ error: "close_deal_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // DEAL ACTIVITIES
  // ─────────────────────────────────────────────────────────

  // GET /deals/:id/activities
  app.get("/deals/:id/activities", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const dealId = toNum((req.params as any).id);
      if (!dealId) return reply.code(400).send({ error: "invalid_deal_id" });

      const query = req.query as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(query);

      // Verify deal exists
      const deal = await prisma.deal.findFirst({
        where: { id: dealId, tenantId },
      });
      if (!deal) {
        return reply.code(404).send({ error: "deal_not_found" });
      }

      const [activities, total] = await Promise.all([
        prisma.dealActivity.findMany({
          where: { dealId },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
        prisma.dealActivity.count({ where: { dealId } }),
      ]);

      return reply.send({
        items: activities,
        total,
        page,
        limit,
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get deal activities");
      return reply.code(500).send({ error: "get_activities_failed" });
    }
  });

  // POST /deals/:id/activities
  app.post("/deals/:id/activities", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const dealId = toNum((req.params as any).id);
      if (!dealId) return reply.code(400).send({ error: "invalid_deal_id" });

      const body = req.body as Record<string, unknown>;

      // Require type
      if (!isValidActivityType(body.type)) {
        return reply.code(400).send({ error: "valid_type_required" });
      }

      // Require title
      const title = trimToNull(body.title);
      if (!title) {
        return reply.code(400).send({ error: "title_required" });
      }

      // Verify deal exists
      const deal = await prisma.deal.findFirst({
        where: { id: dealId, tenantId },
      });
      if (!deal) {
        return reply.code(404).send({ error: "deal_not_found" });
      }

      const userId = (req as any).userId;
      const description = trimToNull(body.description);
      const scheduledAt = parseDate(body.scheduledAt);
      const completedAt = parseDate(body.completedAt);

      const activity = await prisma.dealActivity.create({
        data: {
          tenantId,
          dealId,
          type: body.type,
          title,
          description,
          scheduledAt,
          completedAt,
          userId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return reply.code(201).send({ ok: true, activity });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to create deal activity");
      return reply.code(500).send({ error: "create_activity_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // DEAL TAGS
  // ─────────────────────────────────────────────────────────

  // POST /deals/:id/tags
  app.post("/deals/:id/tags", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const dealId = toNum((req.params as any).id);
      if (!dealId) return reply.code(400).send({ error: "invalid_deal_id" });

      const body = req.body as Record<string, unknown>;
      const tagId = toNum(body.tagId);
      if (!tagId) return reply.code(400).send({ error: "tag_id_required" });

      // Verify deal exists
      const deal = await prisma.deal.findFirst({
        where: { id: dealId, tenantId },
      });
      if (!deal) {
        return reply.code(404).send({ error: "deal_not_found" });
      }

      // Verify tag exists and belongs to tenant with DEAL module
      const tag = await prisma.tag.findFirst({
        where: { id: tagId, tenantId, module: "DEAL" },
      });
      if (!tag) {
        return reply.code(404).send({ error: "tag_not_found" });
      }

      // Check if already assigned
      const existing = await prisma.tagAssignment.findUnique({
        where: { tagId_dealId: { tagId, dealId } },
      });
      if (existing) {
        return reply.code(409).send({ error: "tag_already_assigned" });
      }

      const assignment = await prisma.tagAssignment.create({
        data: {
          tagId,
          dealId,
        },
        include: {
          tag: true,
        },
      });

      return reply.code(201).send({ ok: true, assignment });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to add tag to deal");
      return reply.code(500).send({ error: "add_tag_failed" });
    }
  });

  // DELETE /deals/:id/tags/:tagId
  app.delete("/deals/:id/tags/:tagId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const dealId = toNum((req.params as any).id);
      const tagId = toNum((req.params as any).tagId);
      if (!dealId || !tagId) return reply.code(400).send({ error: "invalid_ids" });

      // Verify deal belongs to tenant
      const deal = await prisma.deal.findFirst({
        where: { id: dealId, tenantId },
      });
      if (!deal) {
        return reply.code(404).send({ error: "deal_not_found" });
      }

      // Find and delete assignment
      const existing = await prisma.tagAssignment.findUnique({
        where: { tagId_dealId: { tagId, dealId } },
      });
      if (!existing) {
        return reply.code(404).send({ error: "tag_assignment_not_found" });
      }

      await prisma.tagAssignment.delete({
        where: { id: existing.id },
      });

      return reply.send({ ok: true });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to remove tag from deal");
      return reply.code(500).send({ error: "remove_tag_failed" });
    }
  });
};

export default dealsRoutes;
