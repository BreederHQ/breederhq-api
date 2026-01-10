// src/routes/animal-linking.ts
// Cross-tenant animal linking API endpoints

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";
import * as linkingService from "../services/animal-linking-service.js";
import type { Sex, Species, ParentType } from "@prisma/client";

/* ─────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────────────────────── */

async function assertTenant(req: FastifyRequest, reply: FastifyReply): Promise<number | null> {
  const tenantId = Number((req as any).tenantId);
  if (!tenantId) {
    reply.code(400).send({ error: "missing_tenant" });
    return null;
  }
  return tenantId;
}

function getUserId(req: FastifyRequest): string | null {
  return (req as any).userId || (req as any).session?.userId || null;
}

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Routes
 * ───────────────────────────────────────────────────────────────────────────── */

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ═══════════════════════════════════════════════════════════════════════════
  // NETWORK DISCOVERY ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Search for an animal by GAID
   * GET /network/search/gaid/:gaid
   */
  app.get("/network/search/gaid/:gaid", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { gaid } = req.params as { gaid: string };

    if (!gaid || gaid.length < 10) {
      return reply.code(400).send({ error: "invalid_gaid" });
    }

    try {
      const result = await linkingService.searchByGaid(gaid.toUpperCase());
      if (!result) {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.send({ ok: true, animal: result });
    } catch (err: any) {
      console.error("[animal-linking] searchByGaid error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * Search for an animal by exchange code
   * GET /network/search/exchange-code/:code
   */
  app.get("/network/search/exchange-code/:code", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { code } = req.params as { code: string };

    if (!code || code.length < 6) {
      return reply.code(400).send({ error: "invalid_code" });
    }

    try {
      const result = await linkingService.searchByExchangeCode(code.toUpperCase());
      if (!result) {
        return reply.code(404).send({ error: "not_found_or_expired" });
      }
      return reply.send({ ok: true, animal: result });
    } catch (err: any) {
      console.error("[animal-linking] searchByExchangeCode error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * Search for an animal by registry number
   * GET /network/search/registry?registryId=&number=
   */
  app.get("/network/search/registry", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as { registryId?: string; number?: string };
    const registryId = parseIntStrict(query.registryId);
    const number = query.number?.trim();

    if (!registryId || !number) {
      return reply.code(400).send({ error: "missing_registry_id_or_number" });
    }

    try {
      const result = await linkingService.searchByRegistry(registryId, number);
      if (!result) {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.send({ ok: true, animal: result });
    } catch (err: any) {
      console.error("[animal-linking] searchByRegistry error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * Search for breeders by email or phone
   * GET /network/search/breeder?q=
   */
  app.get("/network/search/breeder", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as { q?: string };
    const searchQuery = query.q?.trim();

    if (!searchQuery || searchQuery.length < 3) {
      return reply.code(400).send({ error: "query_too_short" });
    }

    try {
      const results = await linkingService.searchBreederByEmailOrPhone(searchQuery);
      return reply.send({ ok: true, breeders: results });
    } catch (err: any) {
      console.error("[animal-linking] searchBreederByEmailOrPhone error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * Get shareable animals for a breeder
   * GET /network/breeders/:tenantId/animals?sex=&species=
   */
  app.get("/network/breeders/:tenantId/animals", async (req, reply) => {
    const myTenantId = await assertTenant(req, reply);
    if (!myTenantId) return;

    const { tenantId: targetTenantIdStr } = req.params as { tenantId: string };
    const targetTenantId = parseIntStrict(targetTenantIdStr);

    if (!targetTenantId) {
      return reply.code(400).send({ error: "invalid_tenant_id" });
    }

    const query = req.query as { sex?: Sex; species?: Species };

    try {
      const animals = await linkingService.getBreederShareableAnimals(targetTenantId, {
        sex: query.sex,
        species: query.species,
      });
      return reply.send({ ok: true, animals });
    } catch (err: any) {
      console.error("[animal-linking] getBreederShareableAnimals error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXCHANGE CODE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get current exchange code for an animal
   * GET /animals/:id/exchange-code
   */
  app.get("/animals/:id/exchange-code", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as any).id);
    if (!animalId) {
      return reply.code(400).send({ error: "invalid_animal_id" });
    }

    try {
      const result = await linkingService.getAnimalExchangeCode(animalId, tenantId);
      return reply.send({ ok: true, ...result });
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        return reply.code(404).send({ error: "not_found" });
      }
      console.error("[animal-linking] getAnimalExchangeCode error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * Generate a new exchange code for an animal
   * POST /animals/:id/exchange-code
   */
  app.post("/animals/:id/exchange-code", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as any).id);
    if (!animalId) {
      return reply.code(400).send({ error: "invalid_animal_id" });
    }

    try {
      const result = await linkingService.generateAnimalExchangeCode(animalId, tenantId);
      return reply.send({ ok: true, ...result });
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        return reply.code(404).send({ error: "not_found" });
      }
      console.error("[animal-linking] generateAnimalExchangeCode error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * Clear an animal's exchange code
   * DELETE /animals/:id/exchange-code
   */
  app.delete("/animals/:id/exchange-code", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as any).id);
    if (!animalId) {
      return reply.code(400).send({ error: "invalid_animal_id" });
    }

    try {
      await linkingService.clearAnimalExchangeCode(animalId, tenantId);
      return reply.send({ ok: true });
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        return reply.code(404).send({ error: "not_found" });
      }
      console.error("[animal-linking] clearAnimalExchangeCode error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GAID MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get or generate GAID for an animal
   * POST /animals/:id/gaid
   */
  app.post("/animals/:id/gaid", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as any).id);
    if (!animalId) {
      return reply.code(400).send({ error: "invalid_animal_id" });
    }

    try {
      const gaid = await linkingService.ensureAnimalHasGaid(animalId, tenantId);
      return reply.send({ ok: true, gaid });
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        return reply.code(404).send({ error: "not_found" });
      }
      console.error("[animal-linking] ensureAnimalHasGaid error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LINK REQUESTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a link request for an animal
   * POST /animals/:id/link-requests
   */
  app.post("/animals/:id/link-requests", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const userId = getUserId(req);
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const sourceAnimalId = parseIntStrict((req.params as any).id);
    if (!sourceAnimalId) {
      return reply.code(400).send({ error: "invalid_animal_id" });
    }

    const body = req.body as {
      relationshipType: ParentType;
      targetAnimalId?: number;
      targetGaid?: string;
      targetExchangeCode?: string;
      targetRegistryId?: number;
      targetRegistryNum?: string;
      targetTenantId?: number;
      message?: string;
    };

    if (!body.relationshipType || !["SIRE", "DAM"].includes(body.relationshipType)) {
      return reply.code(400).send({ error: "invalid_relationship_type" });
    }

    // At least one target identifier required
    if (
      !body.targetAnimalId &&
      !body.targetGaid &&
      !body.targetExchangeCode &&
      !(body.targetRegistryId && body.targetRegistryNum) &&
      !body.targetTenantId
    ) {
      return reply.code(400).send({ error: "missing_target_identifier" });
    }

    try {
      const result = await linkingService.createLinkRequest({
        requestingTenantId: tenantId,
        requestingUserId: userId,
        sourceAnimalId,
        relationshipType: body.relationshipType,
        targetAnimalId: body.targetAnimalId,
        targetGaid: body.targetGaid,
        targetExchangeCode: body.targetExchangeCode,
        targetRegistryId: body.targetRegistryId,
        targetRegistryNum: body.targetRegistryNum,
        targetTenantId: body.targetTenantId,
        message: body.message,
      });
      return reply.code(201).send({ ok: true, ...result });
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        return reply.code(404).send({ error: "source_animal_not_found" });
      }
      if (err.message?.includes("pending request")) {
        return reply.code(409).send({ error: "pending_request_exists" });
      }
      console.error("[animal-linking] createLinkRequest error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * Get incoming link requests for the current tenant
   * GET /link-requests/incoming
   */
  app.get("/link-requests/incoming", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    try {
      const requests = await linkingService.getPendingRequestsForTenant(tenantId);
      return reply.send({ ok: true, requests });
    } catch (err: any) {
      console.error("[animal-linking] getPendingRequestsForTenant error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * Get outgoing link requests for the current tenant
   * GET /link-requests/outgoing
   */
  app.get("/link-requests/outgoing", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    try {
      const requests = await linkingService.getOutgoingRequests(tenantId);
      return reply.send({ ok: true, requests });
    } catch (err: any) {
      console.error("[animal-linking] getOutgoingRequests error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * Approve a link request
   * POST /link-requests/:id/approve
   */
  app.post("/link-requests/:id/approve", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const requestId = parseIntStrict((req.params as any).id);
    if (!requestId) {
      return reply.code(400).send({ error: "invalid_request_id" });
    }

    const body = req.body as {
      targetAnimalId: number;
      responseMessage?: string;
    };

    if (!body.targetAnimalId) {
      return reply.code(400).send({ error: "missing_target_animal_id" });
    }

    try {
      const result = await linkingService.approveLinkRequest(
        requestId,
        tenantId,
        body.targetAnimalId,
        body.responseMessage
      );
      return reply.send({ ok: true, ...result });
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        return reply.code(404).send({ error: "not_found" });
      }
      if (err.message?.includes("not pending")) {
        return reply.code(409).send({ error: "not_pending" });
      }
      if (err.message?.includes("Species mismatch") || err.message?.includes("must be")) {
        return reply.code(400).send({ error: "validation_error", message: err.message });
      }
      console.error("[animal-linking] approveLinkRequest error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * Deny a link request
   * POST /link-requests/:id/deny
   */
  app.post("/link-requests/:id/deny", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const requestId = parseIntStrict((req.params as any).id);
    if (!requestId) {
      return reply.code(400).send({ error: "invalid_request_id" });
    }

    const body = req.body as {
      reason?: string;
      responseMessage?: string;
    };

    try {
      await linkingService.denyLinkRequest(
        requestId,
        tenantId,
        body.reason,
        body.responseMessage
      );
      return reply.send({ ok: true });
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        return reply.code(404).send({ error: "not_found" });
      }
      if (err.message?.includes("not pending")) {
        return reply.code(409).send({ error: "not_pending" });
      }
      if (err.message?.includes("Not authorized")) {
        return reply.code(403).send({ error: "forbidden" });
      }
      console.error("[animal-linking] denyLinkRequest error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVE LINKS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get active cross-tenant links for an animal
   * GET /animals/:id/cross-tenant-links
   */
  app.get("/animals/:id/cross-tenant-links", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as any).id);
    if (!animalId) {
      return reply.code(400).send({ error: "invalid_animal_id" });
    }

    try {
      const links = await linkingService.getActiveLinksForAnimal(animalId, tenantId);
      return reply.send({ ok: true, links });
    } catch (err: any) {
      console.error("[animal-linking] getActiveLinksForAnimal error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * Revoke a cross-tenant link
   * DELETE /cross-tenant-links/:id
   */
  app.delete("/cross-tenant-links/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const linkId = parseIntStrict((req.params as any).id);
    if (!linkId) {
      return reply.code(400).send({ error: "invalid_link_id" });
    }

    const body = req.body as { reason?: string } | undefined;

    try {
      await linkingService.revokeLink(linkId, tenantId, body?.reason);
      return reply.send({ ok: true });
    } catch (err: any) {
      if (err.message?.includes("not found")) {
        return reply.code(404).send({ error: "not_found" });
      }
      if (err.message?.includes("already revoked")) {
        return reply.code(409).send({ error: "already_revoked" });
      }
      if (err.message?.includes("Not authorized")) {
        return reply.code(403).send({ error: "forbidden" });
      }
      console.error("[animal-linking] revokeLink error:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });
};

export default routes;
