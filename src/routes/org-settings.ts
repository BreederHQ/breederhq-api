import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

function requireOrgId(h: any): number {
  const v = (h["x-org-id"] ?? h["X-Org-Id"] ?? "").toString().trim();
  if (!v) throw new Error("X-Org-Id required");
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("X-Org-Id must be numeric");
  return n;
}

const PutBody = z.object({
  registryCodesEnabled: z.array(z.string().min(1)).default([]),
});

export default async function orgSettingsRoutes(app: FastifyInstance) {
  // GET returns enabled registry codes (empty if no row yet)
  app.get("/api/v1/org/settings", async (req, reply) => {
    const orgId = requireOrgId(req.headers);
    const row = await prisma.$queryRaw<Array<{ preferences: any }>>`
      SELECT preferences FROM "OrgSetting" WHERE "organizationId" = ${orgId} LIMIT 1`;
    const prefs = row?.[0]?.preferences ?? {};
    const codes = Array.isArray(prefs.registryCodesEnabled) ? prefs.registryCodesEnabled : [];
    return reply.send({ registryCodesEnabled: codes });
  });

  // PUT upserts preferences JSON for this org
  app.put("/api/v1/org/settings", async (req, reply) => {
    const orgId = requireOrgId(req.headers);
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
}
