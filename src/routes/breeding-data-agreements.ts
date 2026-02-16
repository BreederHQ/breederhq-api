// src/routes/breeding-data-agreements.ts
// Breeding Data Agreement API endpoints
// See: docs/codebase/api/NETWORK-BREEDING-DISCOVERY-API.md

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { z } from "zod";
import {
  createAgreement,
  approveAgreement,
  rejectAgreement,
  getAgreements,
  getAgreementById,
} from "../services/breeding-data-agreements.js";

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

const CreateAgreementSchema = z.object({
  breedingPlanId: z.number().int().positive(),
  animalAccessId: z.number().int().positive(),
  animalRole: z.enum(["sire", "dam"]),
  message: z.string().max(2000).optional(),
});

const ApproveRejectSchema = z.object({
  message: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  direction: z.enum(["sent", "received", "both"]).default("both"),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED"]).optional(),
  breedingPlanId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/* ─────────────────────────────────────────────────────────────────────────────
 * Routes
 * ───────────────────────────────────────────────────────────────────────────── */

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * POST /breeding-agreements
   *
   * Request a breeding data agreement when adding a shadow animal to a breeding plan.
   * Notifies the animal owner for approval.
   */
  app.post("/breeding-agreements", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const parsed = CreateAgreementSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const agreement = await createAgreement({
        breedingPlanId: parsed.data.breedingPlanId,
        animalAccessId: parsed.data.animalAccessId,
        requestingTenantId: tenantId,
        animalRole: parsed.data.animalRole,
        message: parsed.data.message,
      });

      return reply.code(201).send(agreement);
    } catch (err: any) {
      const status = err.statusCode ?? 500;
      if (status < 500) {
        return reply.code(status).send({
          error: err.message,
          message: err.message,
        });
      }

      console.error("[breeding-agreements] POST error:", err.message);
      return reply.code(500).send({
        error: "internal_error",
        message: "Failed to create breeding agreement",
      });
    }
  });

  /**
   * GET /breeding-agreements
   *
   * List breeding agreements for the current tenant.
   * ?direction=sent|received|both  — filter by role
   * ?status=PENDING                — filter by status
   * ?breedingPlanId=123            — filter by plan
   */
  app.get("/breeding-agreements", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await getAgreements(tenantId, {
        direction: parsed.data.direction,
        status: parsed.data.status as any,
        breedingPlanId: parsed.data.breedingPlanId,
        page: parsed.data.page,
        limit: parsed.data.limit,
      });

      return reply.send(result);
    } catch (err: any) {
      console.error("[breeding-agreements] GET list error:", err.message);
      return reply.code(500).send({
        error: "internal_error",
        message: "Failed to fetch breeding agreements",
      });
    }
  });

  /**
   * GET /breeding-agreements/:id
   *
   * Get a single breeding agreement detail.
   * Must be the requester or approver.
   */
  app.get("/breeding-agreements/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const agreementId = (req.params as any).id as string;
    if (!agreementId) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "Invalid agreement ID",
      });
    }

    try {
      const agreement = await getAgreementById(agreementId, tenantId);
      return reply.send(agreement);
    } catch (err: any) {
      const status = err.statusCode ?? 500;
      if (status === 404) {
        return reply.code(404).send({
          error: "NOT_FOUND",
          message: "Breeding agreement not found",
        });
      }

      console.error("[breeding-agreements] GET :id error:", err.message);
      return reply.code(500).send({
        error: "internal_error",
        message: "Failed to fetch breeding agreement",
      });
    }
  });

  /**
   * PATCH /breeding-agreements/:id/approve
   *
   * Approve a pending breeding data agreement.
   * Only the approving tenant (animal owner) can approve.
   * On approval: AnimalAccess becomes permanent and source updates to BREEDING_AGREEMENT.
   */
  app.patch("/breeding-agreements/:id/approve", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const agreementId = (req.params as any).id as string;
    if (!agreementId) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "Invalid agreement ID",
      });
    }

    const parsed = ApproveRejectSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const updated = await approveAgreement(
        agreementId,
        tenantId,
        parsed.data.message
      );

      return reply.send({
        id: updated.id,
        status: updated.status,
        approvedAt: updated.approvedAt,
      });
    } catch (err: any) {
      const status = err.statusCode ?? 500;
      if (status === 404) {
        return reply.code(404).send({
          error: "NOT_FOUND",
          message: "Breeding agreement not found or not pending",
        });
      }

      console.error("[breeding-agreements] PATCH approve error:", err.message);
      return reply.code(500).send({
        error: "internal_error",
        message: "Failed to approve breeding agreement",
      });
    }
  });

  /**
   * PATCH /breeding-agreements/:id/reject
   *
   * Reject a pending breeding data agreement.
   * Only the approving tenant (animal owner) can reject.
   */
  app.patch("/breeding-agreements/:id/reject", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const agreementId = (req.params as any).id as string;
    if (!agreementId) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "Invalid agreement ID",
      });
    }

    const parsed = ApproveRejectSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const updated = await rejectAgreement(
        agreementId,
        tenantId,
        parsed.data.message
      );

      return reply.send({
        id: updated.id,
        status: updated.status,
        rejectedAt: updated.rejectedAt,
      });
    } catch (err: any) {
      const status = err.statusCode ?? 500;
      if (status === 404) {
        return reply.code(404).send({
          error: "NOT_FOUND",
          message: "Breeding agreement not found or not pending",
        });
      }

      console.error("[breeding-agreements] PATCH reject error:", err.message);
      return reply.code(500).send({
        error: "internal_error",
        message: "Failed to reject breeding agreement",
      });
    }
  });
};

export default routes;
