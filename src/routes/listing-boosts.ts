// src/routes/listing-boosts.ts
// Listing boost endpoints for marketplace visibility promotion
//
// POST  /api/v1/listing-boosts/checkout        - Create boost checkout session
// GET   /api/v1/listing-boosts                 - List my boosts
// GET   /api/v1/listing-boosts/featured        - Get featured listings (carousel)
// GET   /api/v1/listing-boosts/:id             - Get single boost
// PATCH /api/v1/listing-boosts/:id/cancel      - Cancel boost (no refund)
// PATCH /api/v1/listing-boosts/:id/auto-renew  - Toggle auto-renewal

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  createBoostCheckout,
  cancelBoost,
  toggleAutoRenew,
  getBoostsForOwner,
  getBoostById,
  getFeaturedListings,
} from "../services/listing-boost-service.js";
import type { ListingBoostTarget, BoostTier } from "@prisma/client";

const listingBoostRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
) => {
  /**
   * POST /api/v1/listing-boosts/checkout
   *
   * Creates a Stripe Checkout session for boosting a listing.
   * Returns { checkoutUrl } for redirect.
   *
   * Body:
   * {
   *   listingType: ListingBoostTarget,
   *   listingId: number,
   *   tier: "BOOST" | "FEATURED",
   *   autoRenew?: boolean,
   *   successUrl: string,
   *   cancelUrl: string
   * }
   */
  app.post<{
    Body: {
      listingType: ListingBoostTarget;
      listingId: number;
      tier: BoostTier;
      autoRenew?: boolean;
      successUrl: string;
      cancelUrl: string;
    };
  }>("/listing-boosts/checkout", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId) || undefined;
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const { listingType, listingId, tier, autoRenew, successUrl, cancelUrl } =
        req.body;

      if (!listingType || !listingId || !tier || !successUrl || !cancelUrl) {
        return reply.code(400).send({ error: "missing_required_fields" });
      }

      if (!["BOOST", "FEATURED"].includes(tier)) {
        return reply.code(400).send({ error: "invalid_tier" });
      }

      const checkoutUrl = await createBoostCheckout({
        tenantId,
        listingType,
        listingId,
        tier,
        autoRenew,
        successUrl,
        cancelUrl,
      });

      return reply.send({ checkoutUrl });
    } catch (err: any) {
      if (err.message === "This listing already has an active boost") {
        return reply
          .code(409)
          .send({ error: "active_boost_exists", message: err.message });
      }
      req.log?.error?.({ err }, "Failed to create boost checkout");
      return reply
        .code(500)
        .send({ error: "checkout_failed", detail: err.message });
    }
  });

  /**
   * GET /api/v1/listing-boosts
   *
   * List boosts for the current tenant (paginated).
   *
   * Query: { page?: string, limit?: string }
   */
  app.get<{
    Querystring: { page?: string; limit?: string };
  }>("/listing-boosts", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId) || undefined;
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const page = Math.max(1, parseInt(req.query.page ?? "1", 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit ?? "25", 10) || 25)
      );

      const result = await getBoostsForOwner({ tenantId }, page, limit);
      return reply.send(result);
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list boosts");
      return reply.code(500).send({ error: "list_boosts_failed" });
    }
  });

  /**
   * GET /api/v1/listing-boosts/featured
   *
   * Get featured listings for carousel display.
   * Order is randomized on each call for fair exposure.
   *
   * Query: { page?: "all" | "animals" | "breeders" | "services" }
   */
  app.get<{
    Querystring: { page?: string };
  }>("/listing-boosts/featured", async (req, reply) => {
    try {
      const page = req.query.page || "all";
      if (!["all", "animals", "breeders", "services"].includes(page)) {
        return reply.code(400).send({
          error: "invalid_page",
          message: "page must be: all, animals, breeders, or services",
        });
      }

      const featured = await getFeaturedListings(page);
      return reply.send({ items: featured });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to get featured listings");
      return reply.code(500).send({ error: "featured_failed" });
    }
  });

  /**
   * GET /api/v1/listing-boosts/:id
   *
   * Get single boost detail (ownership verified).
   */
  app.get<{
    Params: { id: string };
  }>("/listing-boosts/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId) || undefined;
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const boostId = parseInt(req.params.id, 10);
      if (isNaN(boostId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const boost = await getBoostById(boostId);
      if (!boost) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Ownership check
      if (boost.tenantId !== tenantId) {
        return reply.code(403).send({ error: "forbidden" });
      }

      return reply.send({ boost });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to get boost");
      return reply.code(500).send({ error: "get_boost_failed" });
    }
  });

  /**
   * PATCH /api/v1/listing-boosts/:id/cancel
   *
   * Cancel a boost immediately (no refund). FR-28.
   */
  app.patch<{
    Params: { id: string };
  }>("/listing-boosts/:id/cancel", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId) || undefined;
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const boostId = parseInt(req.params.id, 10);
      if (isNaN(boostId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      await cancelBoost(boostId, { tenantId });
      return reply.send({ success: true });
    } catch (err: any) {
      if (err.message === "Boost not found") {
        return reply.code(404).send({ error: "not_found" });
      }
      if (err.message.includes("Not authorized")) {
        return reply.code(403).send({ error: "forbidden" });
      }
      req.log?.error?.({ err }, "Failed to cancel boost");
      return reply
        .code(500)
        .send({ error: "cancel_failed", detail: err.message });
    }
  });

  /**
   * PATCH /api/v1/listing-boosts/:id/auto-renew
   *
   * Toggle auto-renewal on/off.
   *
   * Body: { enabled: boolean }
   */
  app.patch<{
    Params: { id: string };
    Body: { enabled: boolean };
  }>("/listing-boosts/:id/auto-renew", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId) || undefined;
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const boostId = parseInt(req.params.id, 10);
      if (isNaN(boostId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return reply.code(400).send({
          error: "invalid_body",
          message: "enabled must be a boolean",
        });
      }

      await toggleAutoRenew(boostId, enabled, { tenantId });
      return reply.send({ success: true });
    } catch (err: any) {
      if (err.message === "Boost not found") {
        return reply.code(404).send({ error: "not_found" });
      }
      if (err.message.includes("Not authorized")) {
        return reply.code(403).send({ error: "forbidden" });
      }
      req.log?.error?.({ err }, "Failed to toggle auto-renew");
      return reply.code(500).send({ error: "auto_renew_failed" });
    }
  });
};

export default listingBoostRoutes;
