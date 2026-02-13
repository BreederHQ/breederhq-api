// src/routes/network.ts
// Network Breeding Discovery API endpoints
// See: docs/codebase/api/NETWORK-BREEDING-DISCOVERY-API.md

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { z } from "zod";
import {
  searchNetwork,
  type NetworkSearchCriteria,
} from "../services/network-search-index.js";
import {
  sendInquiry,
  getInquiriesReceived,
  getInquiriesSent,
  getInquiryById,
  respondToInquiry,
} from "../services/breeding-inquiries.js";

/* ─────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────────────────────── */

async function assertTenant(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<number | null> {
  const tenantId = Number((req as any).tenantId);
  if (!tenantId) {
    reply.code(400).send({ error: "missing_tenant" });
    return null;
  }
  return tenantId;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Zod Schemas
 * ───────────────────────────────────────────────────────────────────────────── */

const SpeciesEnum = z.enum([
  "DOG",
  "CAT",
  "HORSE",
  "GOAT",
  "RABBIT",
  "SHEEP",
  "CATTLE",
  "PIG",
  "ALPACA",
  "LLAMA",
]);

const SexEnum = z.enum(["MALE", "FEMALE"]);

const GeneticCriterionSchema = z.object({
  locus: z.string().min(1),
  acceptableGenotypes: z.array(z.string().min(1)).min(1),
});

const HealthCriterionSchema = z.object({
  test: z.string().min(1),
  acceptableStatuses: z.array(z.string().min(1)).min(1),
});

const PhysicalCriteriaSchema = z.object({
  minHeight: z.number().positive().optional(),
  maxHeight: z.number().positive().optional(),
  registries: z.array(z.string().min(1)).optional(),
});

const SendInquirySchema = z.object({
  recipientTenantId: z.number().int().positive(),
  searchCriteria: z.object({
    species: SpeciesEnum,
    sex: SexEnum,
    genetics: z.array(GeneticCriterionSchema).optional(),
    health: z.array(HealthCriterionSchema).optional(),
    physical: PhysicalCriteriaSchema.optional(),
  }),
  message: z.string().max(2000).optional(),
});

const UpdateInquirySchema = z.object({
  action: z.enum(["respond", "decline"]),
});

const InquiriesQuerySchema = z.object({
  type: z.enum(["received", "sent"]).default("received"),
  status: z.enum(["PENDING", "RESPONDED", "DECLINED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const NetworkSearchRequestSchema = z
  .object({
    species: SpeciesEnum,
    sex: SexEnum,
    genetics: z.array(GeneticCriterionSchema).optional(),
    health: z.array(HealthCriterionSchema).optional(),
    physical: PhysicalCriteriaSchema.optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .refine(
    (data) =>
      (data.genetics && data.genetics.length > 0) ||
      (data.health && data.health.length > 0) ||
      data.physical != null,
    { message: "At least one search criterion (genetics, health, or physical) is required" }
  );

/* ─────────────────────────────────────────────────────────────────────────────
 * Routes
 * ───────────────────────────────────────────────────────────────────────────── */

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * POST /network/search
   *
   * Search the BreederHQ network for breeders with animals matching criteria.
   * Returns breeder-level matches only — NEVER animal IDs or specific genotypes.
   *
   * Privacy rules:
   * - VISIBLE tenants: show name and location
   * - ANONYMOUS tenants: show "A breeder", no location
   * - HIDDEN tenants: excluded entirely
   */
  app.post("/network/search", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    // Validate request body
    const parsed = NetworkSearchRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { species, sex, genetics, health, physical, page, limit } =
      parsed.data;

    try {
      // Build service criteria
      const criteria: NetworkSearchCriteria = {
        species,
        sex,
        genetics,
        health,
        physical,
      };

      // Call the search service
      const searchResponse = await searchNetwork(criteria);

      // Exclude the requesting tenant from results (don't show yourself)
      const filtered = searchResponse.results.filter(
        (r) => r.tenantId !== tenantId
      );

      // Apply pagination
      const totalBreeders = filtered.length;
      const start = (page - 1) * limit;
      const paginated = filtered.slice(start, start + limit);

      return reply.send({
        data: paginated.map((r) => ({
          breederId: r.tenantId,
          breederName: r.breederName,
          breederLocation: r.breederLocation,
          matchCount: r.matchCount,
          matchedTraits: r.matchedCategories,
        })),
        total: totalBreeders,
        page,
        limit,
      });
    } catch (err: any) {
      console.error("[network/search] Error:", err.message);
      return reply.code(500).send({
        error: "internal_error",
        message: "Network search failed",
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Breeding Inquiries
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /network/inquiries
   *
   * Send a breeding inquiry to another breeder based on a network search match.
   * Rate limited to 20/day per tenant.
   */
  app.post("/network/inquiries", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const parsed = SendInquirySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await sendInquiry({
        senderTenantId: tenantId,
        recipientTenantId: parsed.data.recipientTenantId,
        searchCriteria: parsed.data.searchCriteria,
        message: parsed.data.message,
      });

      return reply.code(201).send({
        inquiryId: result.inquiry.id,
        conversationId: result.messageThread.id,
        createdAt: result.inquiry.createdAt,
      });
    } catch (err: any) {
      const status = err.statusCode ?? 500;

      if (status === 429) {
        return reply.code(429).send({
          error: "RATE_LIMIT_EXCEEDED",
          message: "Daily inquiry limit reached",
          retryAfter: err.retryAfter ?? 86400,
        });
      }

      if (status < 500) {
        return reply.code(status).send({
          error: err.message,
          message: err.message,
        });
      }

      console.error("[network/inquiries] Error:", err.message);
      return reply.code(500).send({
        error: "internal_error",
        message: "Failed to send inquiry",
      });
    }
  });

  /**
   * GET /network/inquiries
   *
   * List breeding inquiries.
   * ?type=received (default) — shows inquiries others sent to you (includes matching animals)
   * ?type=sent — shows inquiries you sent (excludes matching animal IDs for privacy)
   */
  app.get("/network/inquiries", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const parsed = InquiriesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { type, status, page, limit } = parsed.data;

    try {
      const result =
        type === "sent"
          ? await getInquiriesSent(tenantId, { status: status as any, page, limit })
          : await getInquiriesReceived(tenantId, { status: status as any, page, limit });

      return reply.send(result);
    } catch (err: any) {
      console.error("[network/inquiries] Error:", err.message);
      return reply.code(500).send({
        error: "internal_error",
        message: "Failed to fetch inquiries",
      });
    }
  });

  /**
   * GET /network/inquiries/:id
   *
   * Get a single inquiry detail.
   * Recipient sees matching animals; sender does not.
   */
  app.get("/network/inquiries/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const inquiryId = Number((req.params as any).id);
    if (!inquiryId || isNaN(inquiryId)) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "Invalid inquiry ID",
      });
    }

    try {
      const result = await getInquiryById(inquiryId, tenantId);
      return reply.send(result);
    } catch (err: any) {
      const status = err.statusCode ?? 500;
      if (status === 404) {
        return reply.code(404).send({
          error: "NOT_FOUND",
          message: "Inquiry not found",
        });
      }

      console.error("[network/inquiries/:id] Error:", err.message);
      return reply.code(500).send({
        error: "internal_error",
        message: "Failed to fetch inquiry",
      });
    }
  });

  /**
   * PATCH /network/inquiries/:id
   *
   * Update inquiry status (respond or decline).
   * Only the recipient can update.
   */
  app.patch("/network/inquiries/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const inquiryId = Number((req.params as any).id);
    if (!inquiryId || isNaN(inquiryId)) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "Invalid inquiry ID",
      });
    }

    const parsed = UpdateInquirySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const updated = await respondToInquiry(
        inquiryId,
        tenantId,
        parsed.data.action
      );

      return reply.send({
        id: updated.id,
        status: updated.status,
        respondedAt: updated.respondedAt,
      });
    } catch (err: any) {
      const status = err.statusCode ?? 500;
      if (status === 404) {
        return reply.code(404).send({
          error: "NOT_FOUND",
          message: "Inquiry not found or already responded",
        });
      }

      console.error("[network/inquiries/:id] Error:", err.message);
      return reply.code(500).send({
        error: "internal_error",
        message: "Failed to update inquiry",
      });
    }
  });
};

export default routes;
