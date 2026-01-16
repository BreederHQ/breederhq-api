// src/routes/sitemap.ts
// Public sitemap data endpoint for build-time sitemap generation
//
// Endpoints:
//   GET /api/sitemap/entities - Returns all public entity URLs for sitemap generation
//
// Security:
// - Public endpoint (no auth required)
// - Returns ONLY publicly visible entities (published, listed, LIVE status)
// - No sensitive data - only IDs/slugs and timestamps

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

// ============================================================================
// Types
// ============================================================================

interface SitemapEntity {
  loc: string; // Relative URL path
  lastmod: string; // ISO 8601 date
}

interface SitemapEntitiesResponse {
  breeders: SitemapEntity[];
  animals: SitemapEntity[];
  services: SitemapEntity[];
  animalPrograms: SitemapEntity[];
  breedingPrograms: SitemapEntity[];
  generatedAt: string;
}

// ============================================================================
// Routes
// ============================================================================

const sitemapRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // GET /sitemap/entities - Get all public entities for sitemap (PUBLIC)
  // --------------------------------------------------------------------------
  app.get("/sitemap/entities", async (req, reply) => {
    const now = new Date();

    // Fetch all data in parallel for performance
    // Note: We only fetch entities that have their own detail pages in the frontend
    const [
      breeders,
      animalPrograms,
      breedingPrograms,
    ] = await Promise.all([
      // 1. Published breeders (via TenantSetting with marketplace-profile namespace)
      // URL pattern: /breeders/:tenantSlug
      prisma.tenantSetting.findMany({
        where: {
          namespace: "marketplace-profile",
          tenant: {
            slug: { not: null },
          },
        },
        select: {
          updatedAt: true,
          data: true,
          tenant: {
            select: {
              slug: true,
            },
          },
        },
      }),

      // 2. Published and listed animal programs
      // URL pattern: /animal-programs/:slug
      prisma.animalProgram.findMany({
        where: {
          published: true,
          listed: true,
          slug: { not: null },
        },
        select: {
          slug: true,
          updatedAt: true,
        },
      }),

      // 3. Listed breeding programs
      // URL pattern: /breeding-programs/:slug
      prisma.breedingProgram.findMany({
        where: {
          listed: true,
          slug: { not: null },
        },
        select: {
          slug: true,
          updatedAt: true,
        },
      }),
    ]);

    // Transform breeders - filter to only those with published data
    // URL pattern: /breeders/:tenantSlug (matches MarketplaceRoutes.tsx)
    const breederEntities: SitemapEntity[] = breeders
      .filter((s) => {
        const data = s.data as { published?: { businessName?: string } } | null;
        return s.tenant.slug && data?.published?.businessName;
      })
      .map((s) => ({
        loc: `/breeders/${s.tenant.slug}`,
        lastmod: s.updatedAt.toISOString(),
      }));

    // Note: Individual animal listing pages are nested under breeder profiles
    // The frontend route is /breeders/:tenantSlug which shows animal listings
    // There's no separate /animals/:id route currently, so we don't generate those
    // Instead, animal data enriches breeder pages via API calls
    const animalEntities: SitemapEntity[] = [];

    // Services - currently only browse page exists, no individual detail pages
    // The /services page allows filtering, so we don't generate individual service URLs
    const serviceEntities: SitemapEntity[] = [];

    // Transform animal programs
    // URL pattern: /animal-programs/:slug (matches MarketplaceRoutes.tsx)
    const animalProgramEntities: SitemapEntity[] = animalPrograms
      .filter((p) => p.slug)
      .map((p) => ({
        loc: `/animal-programs/${p.slug}`,
        lastmod: p.updatedAt.toISOString(),
      }));

    // Transform breeding programs
    // URL pattern: /breeding-programs/:slug (matches MarketplaceRoutes.tsx)
    const breedingProgramEntities: SitemapEntity[] = breedingPrograms
      .filter((p) => p.slug)
      .map((p) => ({
        loc: `/breeding-programs/${p.slug}`,
        lastmod: p.updatedAt.toISOString(),
      }));

    const response: SitemapEntitiesResponse = {
      breeders: breederEntities,
      animals: animalEntities,
      services: serviceEntities,
      animalPrograms: animalProgramEntities,
      breedingPrograms: breedingProgramEntities,
      generatedAt: now.toISOString(),
    };

    // Cache for 1 hour (sitemap doesn't need to be real-time)
    reply.header("Cache-Control", "public, max-age=3600");

    return reply.send(response);
  });
};

export default sitemapRoutes;
