import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  generateShareCode,
  validateShareCode,
  redeemShareCode,
  revokeShareCode,
  getShareCodesForTenant,
  getShareCodeById,
} from "../services/share-codes.js";
import { AnimalAccessTier } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Share Code Routes
// POST   /api/v1/share-codes          - Create share code
// POST   /api/v1/share-codes/:code/redeem - Redeem a share code
// GET    /api/v1/share-codes          - List tenant's share codes
// GET    /api/v1/share-codes/:id      - Get share code detail
// DELETE /api/v1/share-codes/:id      - Revoke a share code
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TIERS = Object.values(AnimalAccessTier);

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function assertTenant(req: any, reply: any): Promise<number | null> {
  const tenantId = Number((req as any).tenantId);
  if (!tenantId) {
    reply.code(400).send({ error: "missing_tenant" });
    return null;
  }
  return tenantId;
}

const shareCodesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─── POST /share-codes ─── Create a new share code
  app.post("/share-codes", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
      animalIds?: number[];
      accessTier?: string;
      perAnimalTiers?: Record<string, string>;
      expiresAt?: string;
      maxUses?: number;
    };

    if (!body.animalIds || !Array.isArray(body.animalIds) || body.animalIds.length === 0) {
      return reply.code(400).send({ error: "animalIds_required" });
    }

    const defaultAccessTier = (body.accessTier as AnimalAccessTier) || "BASIC";
    if (!VALID_TIERS.includes(defaultAccessTier)) {
      return reply.code(400).send({ error: "invalid_access_tier" });
    }

    if (body.maxUses !== undefined && body.maxUses !== null) {
      if (!Number.isInteger(body.maxUses) || body.maxUses < 1) {
        return reply.code(400).send({ error: "maxUses_must_be_positive_integer" });
      }
    }

    // Validate perAnimalTiers if provided
    if (body.perAnimalTiers) {
      for (const tier of Object.values(body.perAnimalTiers)) {
        if (!VALID_TIERS.includes(tier as AnimalAccessTier)) {
          return reply.code(400).send({ error: "invalid_per_animal_tier" });
        }
      }
    }

    const shareCode = await generateShareCode({
      tenantId,
      animalIds: body.animalIds,
      defaultAccessTier,
      perAnimalTiers: body.perAnimalTiers as Record<string, AnimalAccessTier> | undefined,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      maxUses: body.maxUses ?? null,
    });

    return reply.code(201).send({ code: shareCode.code, shareCode });
  });

  // ─── POST /share-codes/:code/redeem ─── Redeem a share code
  app.post("/share-codes/:code/redeem", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { code } = req.params as { code: string };
    if (!code) {
      return reply.code(400).send({ error: "code_required" });
    }

    const animalsAdded = await redeemShareCode(code.toUpperCase(), tenantId);

    return reply.send({ success: true, animalsAdded });
  });

  // ─── GET /share-codes ─── List share codes for tenant
  app.get("/share-codes", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as { status?: string };
    const codes = await getShareCodesForTenant(tenantId, query.status);

    return reply.send(codes);
  });

  // ─── GET /share-codes/:id ─── Get share code detail
  app.get("/share-codes/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const shareCode = await getShareCodeById(id, tenantId);
    if (!shareCode) {
      return reply.code(404).send({ error: "share_code_not_found" });
    }

    return reply.send(shareCode);
  });

  // ─── DELETE /share-codes/:id ─── Revoke a share code
  app.delete("/share-codes/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    await revokeShareCode(id, tenantId);

    return reply.send({ success: true });
  });
};

export default shareCodesRoutes;
