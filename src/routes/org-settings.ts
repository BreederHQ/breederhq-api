import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";
import { z } from "zod";

/**
 * Resolve and verify orgId from request header, ensuring the org belongs to
 * the authenticated user's tenant.
 */
async function resolveVerifiedOrgId(
  req: any,
  reply: any,
): Promise<number | null> {
  const actorId = getActorId(req);
  if (!actorId) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }

  const tenantId = Number((req as any).tenantId);
  if (!tenantId) {
    reply.code(400).send({ error: "missing_tenant" });
    return null;
  }

  const v = (req.headers["x-org-id"] ?? req.headers["X-Org-Id"] ?? "")
    .toString()
    .trim();
  if (!v) {
    reply.code(400).send({ error: "bad_request", message: "X-Org-Id header required" });
    return null;
  }

  const orgId = Number(v);
  if (!Number.isFinite(orgId)) {
    reply.code(400).send({ error: "bad_request", message: "X-Org-Id must be numeric" });
    return null;
  }

  // Verify the org belongs to this tenant
  const org = await prisma.organization.findFirst({
    where: { id: orgId, tenantId },
    select: { id: true },
  });

  if (!org) {
    reply.code(403).send({ error: "forbidden", message: "Organization does not belong to this tenant" });
    return null;
  }

  return orgId;
}

const PutBody = z.object({
  registryCodesEnabled: z.array(z.string().min(1)).default([]),
});

const orgSettingsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET returns enabled registry codes (empty if no row yet)
  app.get("/org/settings", async (req, reply) => {
    const orgId = await resolveVerifiedOrgId(req, reply);
    if (!orgId) return;

    const row = await prisma.$queryRaw<Array<{ preferences: any }>>`
      SELECT preferences FROM "OrgSetting" WHERE "organizationId" = ${orgId} LIMIT 1`;
    const prefs = row?.[0]?.preferences ?? {};
    const codes = Array.isArray(prefs.registryCodesEnabled)
      ? prefs.registryCodesEnabled
      : [];
    return reply.send({ registryCodesEnabled: codes });
  });

  // PUT upserts preferences JSON for this org
  app.put("/org/settings", async (req, reply) => {
    const orgId = await resolveVerifiedOrgId(req, reply);
    if (!orgId) return;

    const body = PutBody.parse(req.body);
    const nextPrefs = { registryCodesEnabled: body.registryCodesEnabled };

    await prisma.$executeRawUnsafe(
      `INSERT INTO "OrgSetting" ("organizationId", "preferences")
       VALUES ($1, $2::jsonb)
       ON CONFLICT ("organizationId")
       DO UPDATE SET "preferences" = $2::jsonb`,
      orgId,
      JSON.stringify(nextPrefs),
    );

    return reply.send({ ok: true });
  });
};

export default orgSettingsRoutes;
