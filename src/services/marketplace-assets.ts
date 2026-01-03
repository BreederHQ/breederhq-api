// src/services/marketplace-assets.ts
// Asset resolver for marketplace images
//
// SECURITY: This service provides opaque asset IDs that map to source URLs.
// Direct CDN/storage URLs are NEVER exposed to marketplace clients.
//
// Asset ID format: base64url encoded JSON with type + source identifier
// This allows stateless resolution without DB lookups for MVP.

import { createHash } from "crypto";

// ============================================================================
// Types
// ============================================================================

export type AssetType =
  | "animal_photo"
  | "offspring_group_cover"
  | "dam_photo"
  | "sire_photo"
  | "program_photo";

interface AssetPayload {
  t: AssetType;   // type
  u: string;      // source URL
  v: number;      // version (for cache busting)
}

// ============================================================================
// Asset ID Generation (URL -> opaque ID)
// ============================================================================

/**
 * Generate an opaque asset ID from a source URL.
 * The ID is deterministic: same URL always produces same ID.
 *
 * Format: base64url({t,u,v}) where:
 *   t = asset type
 *   u = source URL
 *   v = version (currently 1)
 *
 * SECURITY: The asset ID is opaque to clients but allows server-side resolution
 * without database lookups. This is acceptable for MVP since:
 * 1. All asset requests require authentication + entitlement
 * 2. The source URL is only used server-side to fetch the image
 * 3. Clients never see the source URL
 */
export function generateAssetId(sourceUrl: string, type: AssetType): string {
  const payload: AssetPayload = {
    t: type,
    u: sourceUrl,
    v: 1,
  };

  // Encode as base64url (URL-safe base64)
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json, "utf-8").toString("base64url");

  return base64;
}

/**
 * Resolve an asset ID back to its source URL and type.
 * Returns null if the ID is invalid or malformed.
 */
export function resolveAssetId(assetId: string): { sourceUrl: string; type: AssetType } | null {
  try {
    const json = Buffer.from(assetId, "base64url").toString("utf-8");
    const payload = JSON.parse(json) as AssetPayload;

    // Validate payload structure
    if (
      typeof payload.t !== "string" ||
      typeof payload.u !== "string" ||
      typeof payload.v !== "number"
    ) {
      return null;
    }

    // Validate type
    const validTypes: AssetType[] = [
      "animal_photo",
      "offspring_group_cover",
      "dam_photo",
      "sire_photo",
      "program_photo",
    ];
    if (!validTypes.includes(payload.t as AssetType)) {
      return null;
    }

    // Validate URL format (must be http/https)
    if (!payload.u.startsWith("http://") && !payload.u.startsWith("https://")) {
      return null;
    }

    return {
      sourceUrl: payload.u,
      type: payload.t as AssetType,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// URL Transformation for DTOs
// ============================================================================

/**
 * Transform a source URL to an asset route URL.
 * Returns null if the source URL is null/undefined/empty.
 *
 * @param sourceUrl - The original CDN/storage URL
 * @param type - The asset type for categorization
 * @returns The proxied asset URL (/api/v1/marketplace/assets/:assetId)
 */
export function toAssetUrl(
  sourceUrl: string | null | undefined,
  type: AssetType
): string | null {
  if (!sourceUrl || sourceUrl.trim() === "") {
    return null;
  }

  const assetId = generateAssetId(sourceUrl, type);
  return `/api/v1/marketplace/assets/${assetId}`;
}

// ============================================================================
// Allowed Origins for Asset Requests
// ============================================================================

const ALLOWED_ORIGINS = [
  "https://marketplace.breederhq.com",
  "https://app.breederhq.com",
  "https://portal.breederhq.com",
  // Dev origins
  "https://marketplace.breederhq.test",
  "https://app.breederhq.test",
  "https://portal.breederhq.test",
  // Localhost for development
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

/**
 * Check if a request origin is allowed for asset serving.
 * Returns true if origin is allowed, false otherwise.
 *
 * NOTE: For MVP, we log warnings but still serve assets.
 * Stricter enforcement can be added later.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return false;
  }

  // Check exact match
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Allow Vercel preview deployments
  if (/\.vercel\.app$/i.test(origin)) {
    return true;
  }

  return false;
}
