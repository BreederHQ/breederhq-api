// src/routes/compatibility.ts
// Breeding Discovery: Compatibility checking between breeder profiles

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

interface CompatibilityResult {
  compatible: boolean;
  score: number; // 0-100
  issues: string[];
  warnings: string[];
  matches: string[];
}

/**
 * Check compatibility between two breeder profiles
 * Returns compatibility score and list of issues/matches
 */
function checkCompatibility(
  seeker: any,
  offering: any,
  listingData?: any
): CompatibilityResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const matches: string[] = [];
  let score = 100;

  // Check registry exclusions
  if (offering.excludedRegistries && offering.excludedRegistries.length > 0) {
    if (seeker.registryAffiliations) {
      const conflicts = seeker.registryAffiliations.filter((reg: string) =>
        offering.excludedRegistries.includes(reg)
      );
      if (conflicts.length > 0) {
        issues.push(`Offering breeder excludes registries: ${conflicts.join(", ")}`);
        score -= 30;
      }
    }
  }

  if (seeker.excludedRegistries && seeker.excludedRegistries.length > 0) {
    if (offering.registryAffiliations) {
      const conflicts = offering.registryAffiliations.filter((reg: string) =>
        seeker.excludedRegistries.includes(reg)
      );
      if (conflicts.length > 0) {
        issues.push(`You exclude registries: ${conflicts.join(", ")}`);
        score -= 30;
      }
    }
  }

  // Check line type exclusions
  if (offering.excludedLineTypes && offering.excludedLineTypes.length > 0) {
    if (seeker.breedingLineTypes) {
      const conflicts = seeker.breedingLineTypes.filter((line: string) =>
        offering.excludedLineTypes.includes(line)
      );
      if (conflicts.length > 0) {
        issues.push(`Offering breeder excludes line types: ${conflicts.join(", ")}`);
        score -= 20;
      }
    }
  }

  if (seeker.excludedLineTypes && seeker.excludedLineTypes.length > 0) {
    if (offering.breedingLineTypes) {
      const conflicts = offering.breedingLineTypes.filter((line: string) =>
        seeker.excludedLineTypes.includes(line)
      );
      if (conflicts.length > 0) {
        issues.push(`You exclude line types: ${conflicts.join(", ")}`);
        score -= 20;
      }
    }
  }

  // Check registry affiliations match
  if (seeker.registryAffiliations && offering.registryAffiliations) {
    const commonRegistries = seeker.registryAffiliations.filter((reg: string) =>
      offering.registryAffiliations.includes(reg)
    );
    if (commonRegistries.length > 0) {
      matches.push(`Common registries: ${commonRegistries.join(", ")}`);
      score += 5;
    }
  }

  // Check line types match
  if (seeker.breedingLineTypes && offering.breedingLineTypes) {
    const commonLineTypes = seeker.breedingLineTypes.filter((line: string) =>
      offering.breedingLineTypes.includes(line)
    );
    if (commonLineTypes.length > 0) {
      matches.push(`Common line types: ${commonLineTypes.join(", ")}`);
      score += 5;
    }
  }

  // Check health testing requirements
  if (offering.requiresHealthTesting || listingData?.requiresHealthTesting) {
    if (!seeker.requiresHealthTesting) {
      warnings.push("Offering breeder requires health testing, but you do not");
      score -= 10;
    } else {
      matches.push("Both parties require health testing");
      score += 10;
    }
  }

  // Check contract requirements
  if (offering.requiresContract || listingData?.requiresContract) {
    if (!seeker.requiresContract) {
      warnings.push("Offering breeder requires contracts, but you do not");
      score -= 5;
    } else {
      matches.push("Both parties use breeding contracts");
      score += 5;
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  const compatible = issues.length === 0 && score >= 50;

  return {
    compatible,
    score,
    issues,
    warnings,
    matches,
  };
}

const compatibilityRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /compatibility/check/:listingId - Check my compatibility with a listing
  app.get("/compatibility/check/:listingId", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const listingId = parseIntStrict((req.params as any).listingId);
      if (!listingId) return reply.code(400).send({ error: "bad_listing_id" });

      // Get my breeder profile
      const myProfile = await prisma.breederProfile.findUnique({
        where: { tenantId },
      });

      if (!myProfile) {
        return reply.code(404).send({
          error: "profile_not_found",
          message: "You must create a breeder profile first",
        });
      }

      // Get the listing and offering breeder's profile
      const listing = await prisma.breedingListing.findFirst({
        where: { id: listingId, publicEnabled: true, status: "PUBLISHED" },
        select: {
          id: true,
          tenantId: true,
          headline: true,
          requiresHealthTesting: true,
          requiredTests: true,
          requiresContract: true,
        },
      });

      if (!listing) return reply.code(404).send({ error: "listing_not_found" });

      const offeringProfile = await prisma.breederProfile.findUnique({
        where: { tenantId: listing.tenantId },
      });

      if (!offeringProfile) {
        return reply.code(404).send({
          error: "offering_profile_not_found",
          message: "Offering breeder has not created a profile",
        });
      }

      const result = checkCompatibility(myProfile, offeringProfile, listing);

      reply.send({
        listingId: listing.id,
        listingHeadline: listing.headline,
        ...result,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[compatibility]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // POST /compatibility/check - Check between two profiles (admin/testing)
  app.post("/compatibility/check", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const body = (req.body || {}) as any;
      const seekerTenantId = parseIntStrict(body.seekerTenantId);
      const offeringTenantId = parseIntStrict(body.offeringTenantId);

      if (!seekerTenantId || !offeringTenantId) {
        return reply.code(400).send({ error: "missing_tenant_ids" });
      }

      const [seekerProfile, offeringProfile] = await Promise.all([
        prisma.breederProfile.findUnique({ where: { tenantId: seekerTenantId } }),
        prisma.breederProfile.findUnique({ where: { tenantId: offeringTenantId } }),
      ]);

      if (!seekerProfile) {
        return reply.code(404).send({ error: "seeker_profile_not_found" });
      }

      if (!offeringProfile) {
        return reply.code(404).send({ error: "offering_profile_not_found" });
      }

      const result = checkCompatibility(seekerProfile, offeringProfile);

      reply.send({
        seekerTenantId,
        offeringTenantId,
        ...result,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[compatibility]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });
};

export default compatibilityRoutes;
