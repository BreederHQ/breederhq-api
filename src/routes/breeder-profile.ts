// src/routes/breeder-profile.ts
// Breeding Discovery: Breeder Profile CRUD

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { breederProfileUpdateSchema } from "../validation/breeding-discovery.js";

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const breederProfileRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /breeder-profile - Get own profile (upserts default if missing)
  app.get("/breeder-profile", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      let profile = await prisma.breederProfile.findUnique({
        where: { tenantId },
      });

      if (!profile) {
        profile = await prisma.breederProfile.create({
          data: { tenantId },
        });
      }

      reply.send(profile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeder-profile]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // PUT /breeder-profile - Update own profile
  app.put("/breeder-profile", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const parsed = breederProfileUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }

      const profile = await prisma.breederProfile.upsert({
        where: { tenantId },
        create: { tenantId, ...parsed.data } as any,
        update: parsed.data as any,
      });

      reply.send(profile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeder-profile]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // GET /breeder-profile/:tenantId - Get public profile (filtered by visibility)
  app.get("/breeder-profile/:tenantId", async (req, reply) => {
    try {
      const targetTenantId = parseIntStrict((req.params as any).tenantId);
      if (!targetTenantId) return reply.code(400).send({ error: "bad_tenant_id" });

      const profile = await prisma.breederProfile.findUnique({
        where: { tenantId: targetTenantId },
      });

      if (!profile) return reply.code(404).send({ error: "not_found" });

      // Filter by visibility toggles for public view
      const publicProfile: Record<string, unknown> = {
        tenantId: profile.tenantId,
        publicBio: profile.publicBio,
        websiteUrl: profile.websiteUrl,
        socialLinks: profile.socialLinks,
      };

      if (profile.showRegistryAffiliations) {
        publicProfile.registryAffiliations = profile.registryAffiliations;
        publicProfile.primaryRegistry = profile.primaryRegistry;
      }

      if (profile.showBreedingLineTypes) {
        publicProfile.breedingLineTypes = profile.breedingLineTypes;
      }

      if (profile.showRequirements) {
        publicProfile.requiresHealthTesting = profile.requiresHealthTesting;
        publicProfile.requiresContract = profile.requiresContract;
        publicProfile.requiredTests = profile.requiredTests;
      }

      reply.send(publicProfile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeder-profile]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });
};

export default breederProfileRoutes;
