import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  getAccessForTenant,
  getAccessById,
  getSharedByTenant,
  removeAccess,
  revokeAccessByOwner,
  upgradeAccessTier,
  getGeneticsEligibleAccess,
} from "../services/animal-access.js";
import {
  getOrCreateConversation,
  getConversation,
  sendMessage,
} from "../services/animal-access-conversation.js";
import { AnimalAccessTier, AnimalAccessStatus, Species, Sex } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Animal Access (Shadow Animal) Routes
// GET    /api/v1/animal-access                       - My shadow animals (accessor)
// GET    /api/v1/animal-access/shared                - What I've shared (owner)
// GET    /api/v1/animal-access/genetics-eligible     - Shadow animals with GENETICS+ tier for pairing
// GET    /api/v1/animal-access/:id                   - Single shadow animal detail
// DELETE /api/v1/animal-access/:id                   - Remove shadow from my list
// PATCH  /api/v1/animal-access/:id/tier              - Upgrade access tier (owner)
// POST   /api/v1/animal-access/:id/revoke            - Revoke access (owner)
// POST   /api/v1/animal-access/:id/conversation      - Get or create conversation
// GET    /api/v1/animal-access/:id/conversation      - Get conversation with messages
// POST   /api/v1/animal-access/:id/conversation/messages - Send a message
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TIERS = Object.values(AnimalAccessTier);
const VALID_STATUSES = Object.values(AnimalAccessStatus);
const VALID_SPECIES = Object.values(Species);
const VALID_SEX = Object.values(Sex);

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

function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q?.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q?.limit ?? "25", 10) || 25));
  return { page, limit };
}

const animalAccessRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─── GET /animal-access/shared ─── What I've shared (MUST be before /:id)
  app.get("/animal-access/shared", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      animalId?: string;
      status?: string;
      page?: string;
      limit?: string;
    };

    const { page, limit } = parsePaging(query);

    const result = await getSharedByTenant(tenantId, {
      animalId: query.animalId ? parseIntStrict(query.animalId) ?? undefined : undefined,
      status: query.status && VALID_STATUSES.includes(query.status as AnimalAccessStatus)
        ? (query.status as AnimalAccessStatus)
        : undefined,
      page,
      limit,
    });

    return reply.send(result);
  });

  // ─── GET /animal-access/genetics-eligible ─── Shadow animals with GENETICS+ tier for pairing
  app.get("/animal-access/genetics-eligible", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      species?: string;
      sex?: string;
    };

    try {
      const result = await getGeneticsEligibleAccess(tenantId, {
        species: query.species && VALID_SPECIES.includes(query.species as Species)
          ? (query.species as Species)
          : undefined,
        sex: query.sex && VALID_SEX.includes(query.sex as Sex)
          ? (query.sex as Sex)
          : undefined,
      });

      return reply.send({ data: result });
    } catch (err: any) {
      console.error("[animal-access] genetics-eligible error:", err.message);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // ─── GET /animal-access ─── My shadow animals
  app.get("/animal-access", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      status?: string;
      species?: string;
      sex?: string;
      page?: string;
      limit?: string;
    };

    const { page, limit } = parsePaging(query);

    const result = await getAccessForTenant(tenantId, {
      status: query.status && VALID_STATUSES.includes(query.status as AnimalAccessStatus)
        ? (query.status as AnimalAccessStatus)
        : undefined,
      species: query.species && VALID_SPECIES.includes(query.species as Species)
        ? (query.species as Species)
        : undefined,
      sex: query.sex && VALID_SEX.includes(query.sex as Sex)
        ? (query.sex as Sex)
        : undefined,
      page,
      limit,
    });

    return reply.send(result);
  });

  // ─── GET /animal-access/:id ─── Single shadow animal detail
  app.get("/animal-access/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const access = await getAccessById(id, tenantId);
    return reply.send(access);
  });

  // ─── DELETE /animal-access/:id ─── Remove shadow from my list (accessor)
  app.delete("/animal-access/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    await removeAccess(id, tenantId);
    return reply.send({ success: true });
  });

  // ─── PATCH /animal-access/:id/tier ─── Owner upgrades access tier
  app.patch("/animal-access/:id/tier", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const body = req.body as { accessTier?: string };
    if (!body.accessTier || !VALID_TIERS.includes(body.accessTier as AnimalAccessTier)) {
      return reply.code(400).send({ error: "invalid_access_tier" });
    }

    const updated = await upgradeAccessTier(
      id,
      tenantId,
      body.accessTier as AnimalAccessTier
    );

    return reply.send(updated);
  });

  // ─── POST /animal-access/:id/revoke ─── Owner revokes access
  app.post("/animal-access/:id/revoke", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    await revokeAccessByOwner(id, tenantId);
    return reply.send({ success: true });
  });

  // ─── POST /animal-access/:id/conversation ─── Get or create conversation
  app.post("/animal-access/:id/conversation", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    try {
      const result = await getOrCreateConversation(id, tenantId);
      return reply.code(result.isNew ? 201 : 200).send(result);
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.code(status).send({ error: err.message });
    }
  });

  // ─── GET /animal-access/:id/conversation ─── Get conversation with messages
  app.get("/animal-access/:id/conversation", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const query = req.query as { page?: string; limit?: string };
    const { page, limit } = parsePaging(query);

    try {
      const result = await getConversation(id, tenantId, { page, limit });

      if (!result) {
        return reply.send({ conversation: null, messages: [] });
      }

      return reply.send(result);
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.code(status).send({ error: err.message });
    }
  });

  // ─── POST /animal-access/:id/conversation/messages ─── Send a message
  app.post("/animal-access/:id/conversation/messages", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const body = req.body as { body?: string };
    if (!body.body || !body.body.trim()) {
      return reply.code(400).send({ error: "message_body_required" });
    }

    try {
      const result = await sendMessage(id, tenantId, body.body);
      return reply.code(201).send(result);
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.code(status).send({ error: err.message });
    }
  });
};

export default animalAccessRoutes;
