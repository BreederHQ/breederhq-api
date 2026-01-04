// src/routes/marketplace-breeders.ts
// Public breeder profile endpoint - no auth required
//
// Endpoint:
//   GET /api/v1/marketplace/breeders/:tenantSlug - Read published breeder profile
//
// Security:
// - No authentication required (public endpoint)
// - Returns ONLY published data, never draft
// - Street-level address fields are never returned

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

// ============================================================================
// Constants
// ============================================================================

const NAMESPACE = "marketplace-profile";

// Fields that must NEVER be returned even if stored
const FORBIDDEN_ADDRESS_FIELDS = [
  "streetAddress",
  "streetAddress2",
  "addressLine1",
  "addressLine2",
  "street",
  "street2",
];

// ============================================================================
// Types
// ============================================================================

interface MarketplaceProfileData {
  draft?: Record<string, unknown>;
  draftUpdatedAt?: string;
  published?: Record<string, unknown>;
  publishedAt?: string;
}

interface PublishedBreederResponse {
  tenantSlug: string;
  businessName: string;
  bio: string | null;
  logoAssetId: string | null;
  publicLocationMode: string | null;
  location: {
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
  } | null;
  website: string | null;
  socialLinks: {
    instagram: string | null;
    facebook: string | null;
  };
  breeds: Array<{ name: string }>;
  programs: Array<{
    name: string;
    description: string | null;
    availability: string | null;
  }>;
  publishedAt: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Safely extract string from unknown value
 */
function safeString(val: unknown): string | null {
  if (typeof val === "string" && val.trim()) return val.trim();
  return null;
}

/**
 * Safely extract boolean from unknown value
 */
function safeBool(val: unknown): boolean {
  return val === true;
}

/**
 * Strip any forbidden address fields from location object
 */
function sanitizeLocation(
  address: unknown
): { city: string | null; state: string | null; zip: string | null; country: string | null } | null {
  if (!address || typeof address !== "object") return null;

  const addr = address as Record<string, unknown>;

  // Check if any location data exists
  const city = safeString(addr.city);
  const state = safeString(addr.state);
  const zip = safeString(addr.zip);
  const country = safeString(addr.country);

  if (!city && !state && !zip && !country) return null;

  return { city, state, zip, country };
}

/**
 * Extract breeds array from various possible shapes
 */
function extractBreeds(published: Record<string, unknown>): Array<{ name: string }> {
  // Try breeds array first (from publish payload)
  if (Array.isArray(published.breeds)) {
    return published.breeds
      .map((b: unknown) => {
        if (typeof b === "string" && b.trim()) return { name: b.trim() };
        if (b && typeof b === "object" && "name" in b) {
          const name = safeString((b as any).name);
          if (name) return { name };
        }
        return null;
      })
      .filter((b): b is { name: string } => b !== null);
  }

  // Fall back to listedBreeds (string array)
  if (Array.isArray(published.listedBreeds)) {
    return published.listedBreeds
      .filter((b): b is string => typeof b === "string" && b.trim() !== "")
      .map((name) => ({ name: name.trim() }));
  }

  return [];
}

/**
 * Extract listed programs from published data
 */
function extractPrograms(
  published: Record<string, unknown>
): Array<{ name: string; description: string | null; availability: string | null }> {
  if (!Array.isArray(published.listedPrograms)) return [];

  return published.listedPrograms
    .map((p: unknown) => {
      if (!p || typeof p !== "object") return null;
      const prog = p as Record<string, unknown>;
      const name = safeString(prog.name);
      if (!name) return null;
      return {
        name,
        description: safeString(prog.description),
        availability: safeString(prog.availability),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
}

// ============================================================================
// Routes
// ============================================================================

const marketplaceBreedersRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // GET /breeders/:tenantSlug - Read published breeder profile (PUBLIC)
  // --------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string } }>("/breeders/:tenantSlug", async (req, reply) => {
    const { tenantSlug } = req.params;

    // Validate slug format
    if (!tenantSlug || typeof tenantSlug !== "string" || tenantSlug.trim() === "") {
      return reply.code(400).send({ error: "invalid_slug" });
    }

    const normalizedSlug = tenantSlug.trim().toLowerCase();

    // Look up tenant by slug
    const tenant = await prisma.tenant.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true, slug: true },
    });

    if (!tenant || !tenant.slug) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Read profile setting
    const setting = await prisma.tenantSetting.findUnique({
      where: { tenantId_namespace: { tenantId: tenant.id, namespace: NAMESPACE } },
      select: { data: true },
    });

    const profileData = (setting?.data as MarketplaceProfileData) ?? {};

    // Check if published data exists
    if (!profileData.published) {
      return reply.code(404).send({ error: "not_published" });
    }

    const published = profileData.published;

    // Extract and validate required fields
    const businessName = safeString(published.businessName);
    if (!businessName) {
      // Published but missing required field - treat as not published
      return reply.code(404).send({ error: "not_published" });
    }

    // Build response with only public-safe fields
    const response: PublishedBreederResponse = {
      tenantSlug: tenant.slug,
      businessName,
      bio: safeString(published.bio),
      logoAssetId: safeString(published.logoAssetId),
      publicLocationMode: safeString(published.publicLocationMode),
      location: sanitizeLocation(published.address),
      // Only include website/socials if show toggles are true
      website: safeBool(published.showWebsite) ? safeString(published.websiteUrl) : null,
      socialLinks: {
        instagram: safeBool(published.showInstagram) ? safeString(published.instagram) : null,
        facebook: safeBool(published.showFacebook) ? safeString(published.facebook) : null,
      },
      breeds: extractBreeds(published),
      programs: extractPrograms(published),
      publishedAt: profileData.publishedAt ?? null,
    };

    return reply.send(response);
  });
};

export default marketplaceBreedersRoutes;
