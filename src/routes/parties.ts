import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PartyService } from "../services/party-service.js";
import type { PartySortDir, PartySortKey } from "../services/party-service.js";
import type { PartyStatus, PartyType } from "../types/party.js";

function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q?.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q?.limit ?? "25", 10) || 25));
  return { page, limit };
}

function parseDir(q: any): PartySortDir | null {
  const dir = String(q?.dir ?? "asc").toLowerCase();
  if (dir === "asc" || dir === "desc") return dir as PartySortDir;
  return null;
}

function parseSort(q: any): PartySortKey {
  const sort = String(q?.sort ?? "displayName").trim();
  if (sort === "createdAt" || sort === "updatedAt" || sort === "displayName") {
    return sort as PartySortKey;
  }
  return "displayName";
}

function parseType(q: any): PartyType | undefined | null {
  if (q?.type == null || String(q.type).trim() === "") return undefined;
  const type = String(q.type).toUpperCase();
  if (type === "PERSON" || type === "ORGANIZATION") return type as PartyType;
  return null;
}

function parseStatus(q: any): PartyStatus | undefined | null {
  if (q?.status == null || String(q.status).trim() === "") return undefined;
  const status = String(q.status).toUpperCase();
  if (status === "ACTIVE" || status === "INACTIVE" || status === "ARCHIVED") return status as PartyStatus;
  return null;
}

function idNum(v: any) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const partiesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Manual smoke (dev):
  // curl -H "x-tenant-id: 1" "http://localhost:6170/api/v1/parties?page=1&limit=25"
  // curl -H "x-tenant-id: 1" "http://localhost:6170/api/v1/parties?q=smith"
  // curl -H "x-tenant-id: 1" "http://localhost:6170/api/v1/parties?type=PERSON"
  // curl -H "x-tenant-id: 1" "http://localhost:6170/api/v1/parties/123"
  app.get("/parties", async (req, reply) => {
    let tenantId: number | null = null;
    try {
      tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const q = (req.query as any) ?? {};
      const { page, limit } = parsePaging(q);
      const dir = parseDir(q);
      if (!dir) return reply.code(400).send({ error: "bad_dir" });

      const sort = parseSort(q);
      const type = parseType(q);
      if (type === null) return reply.code(400).send({ error: "bad_type" });

      const status = parseStatus(q);
      if (status === null) return reply.code(400).send({ error: "bad_status" });

      const result = await PartyService.list({
        tenantId,
        q: q.q,
        page,
        limit,
        sort,
        dir,
        type: type ?? undefined,
        status: status ?? undefined,
        logger: req.log,
      });

      return reply.send(result);
    } catch (err) {
      req.log.error({ err, tenantId, query: req.query, params: req.params }, "Parties endpoint failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  app.get("/parties/:partyId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = idNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "bad_id" });

      const party = await PartyService.getById(tenantId, partyId, req.log);
      if (!party) return reply.code(404).send({ error: "not_found" });

      return reply.send({ party });
    } catch (err) {
      req.log?.error?.(err as any);
      return reply.code(500).send({ error: "get_failed" });
    }
  });
};

export default partiesRoutes;
