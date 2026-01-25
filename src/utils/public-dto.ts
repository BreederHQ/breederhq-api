// src/utils/public-dto.ts
// DTO projection functions for public marketplace endpoints
// These functions strip PII and expose only safe fields
//
// SECURITY: All image URLs are transformed to auth-gated proxy URLs.
// Direct CDN/storage URLs are NEVER exposed to marketplace clients.

import type {
  Organization,
  OffspringGroup,
  Offspring,
  Animal,
  MktListingIndividualAnimal,
  Breed,
  AnimalRegistryIdentifier,
  Registry,
  AnimalTraitValue,
  TraitDefinition,
} from "@prisma/client";
import { toAssetUrl } from "../services/marketplace-assets.js";

// ============================================================================
// Public Program DTO
// ============================================================================

export interface PublicProgramDTO {
  slug: string;
  name: string;
  bio: string | null;
  publicContactEmail: string | null;
  website: string | null;
}

type OrganizationWithFields = Pick<
  Organization,
  "programSlug" | "name" | "programBio" | "publicContactEmail" | "website"
>;

export function toPublicProgramDTO(org: OrganizationWithFields): PublicProgramDTO {
  return {
    slug: org.programSlug || "",
    name: org.name,
    bio: org.programBio || null,
    publicContactEmail: org.publicContactEmail || null,
    website: org.website || null,
  };
}

// ============================================================================
// Public Program Summary DTO (for index/search)
// ============================================================================

export interface PublicProgramSummaryDTO {
  slug: string;
  name: string;
  location: string | null;
  species: string[];
  breed: string | null;
  photoUrl: string | null;
}

type OrganizationSummaryFields = Pick<
  Organization,
  "programSlug" | "name" | "city" | "state" | "country"
>;

export function toPublicProgramSummaryDTO(
  org: OrganizationSummaryFields
): PublicProgramSummaryDTO {
  // Compose location from city, state, country
  const locationParts: string[] = [];
  if (org.city) locationParts.push(org.city);
  if (org.state) locationParts.push(org.state);
  if (org.country) locationParts.push(org.country);
  const location = locationParts.length > 0 ? locationParts.join(", ") : null;

  return {
    slug: org.programSlug || "",
    name: org.name,
    location,
    species: [], // Not available yet - would require aggregating from animals
    breed: null, // Not available yet - would require aggregating from animals
    photoUrl: null, // Not available yet - organization cover photo not in schema
  };
}

// ============================================================================
// Public Offspring Group Listing DTO
// ============================================================================

export interface PublicOffspringGroupListingDTO {
  slug: string;
  title: string | null;
  description: string | null;
  species: string;
  breed: string | null;
  expectedBirthOn: string | null;
  actualBirthOn: string | null;
  countAvailable: number;
  dam: {
    name: string;
    photoUrl: string | null;
    breed: string | null;
  } | null;
  sire: {
    name: string;
    photoUrl: string | null;
    breed: string | null;
  } | null;
  coverImageUrl: string | null;
  priceRange: { min: number; max: number } | null;
  programSlug: string;
  programName: string;
}

type OffspringGroupWithRelations = Pick<
  OffspringGroup,
  | "listingSlug"
  | "listingTitle"
  | "listingDescription"
  | "species"
  | "expectedBirthOn"
  | "actualBirthOn"
  | "coverImageUrl"
  | "marketplaceDefaultPriceCents"
> & {
  dam?: Pick<Animal, "name" | "photoUrl" | "breed"> | null;
  sire?: Pick<Animal, "name" | "photoUrl" | "breed"> | null;
  Offspring?: Array<Pick<Offspring, "priceCents" | "keeperIntent" | "placementState" | "marketplaceListed" | "marketplacePriceCents">>;
  tenant?: { organizations?: Array<Pick<Organization, "programSlug" | "name">> };
};

export function toPublicOffspringGroupListingDTO(
  group: OffspringGroupWithRelations,
  programSlug: string,
  programName: string
): PublicOffspringGroupListingDTO {
  // Filter to only listed offspring
  const listedOffspring = (group.Offspring || []).filter((o) => o.marketplaceListed === true);

  // Count available offspring (listed + available + unassigned)
  const available = listedOffspring.filter(
    (o) => o.keeperIntent === "AVAILABLE" && o.placementState === "UNASSIGNED"
  );
  const countAvailable = available.length;

  // Calculate price range from available offspring with derived prices
  const prices = available
    .map((o) => o.marketplacePriceCents ?? group.marketplaceDefaultPriceCents ?? o.priceCents)
    .filter((p): p is number => p != null && p > 0);
  const priceRange =
    prices.length > 0
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null;

  // Derive breed from dam
  const breed = group.dam?.breed || null;

  return {
    slug: group.listingSlug || "",
    title: group.listingTitle || null,
    description: group.listingDescription || null,
    species: group.species,
    breed,
    expectedBirthOn: group.expectedBirthOn?.toISOString().slice(0, 10) || null,
    actualBirthOn: group.actualBirthOn?.toISOString().slice(0, 10) || null,
    countAvailable,
    dam: group.dam
      ? {
          name: group.dam.name,
          // SECURITY: Transform to auth-gated asset URL
          photoUrl: toAssetUrl(group.dam.photoUrl, "dam_photo"),
          breed: group.dam.breed || null,
        }
      : null,
    sire: group.sire
      ? {
          name: group.sire.name,
          // SECURITY: Transform to auth-gated asset URL
          photoUrl: toAssetUrl(group.sire.photoUrl, "sire_photo"),
          breed: group.sire.breed || null,
        }
      : null,
    // SECURITY: Transform to auth-gated asset URL
    coverImageUrl: toAssetUrl(group.coverImageUrl, "offspring_group_cover"),
    priceRange,
    programSlug,
    programName,
  };
}

// ============================================================================
// Public Offspring DTO
// ============================================================================

export interface PublicOffspringDTO {
  id: number;
  name: string | null;
  sex: string | null;
  collarColorName: string | null;
  collarColorHex: string | null;
  priceCents: number | null;
  status: "available" | "reserved" | "placed";
}

type OffspringWithFields = Pick<
  Offspring,
  | "id"
  | "name"
  | "sex"
  | "collarColorName"
  | "collarColorHex"
  | "priceCents"
  | "keeperIntent"
  | "placementState"
  | "marketplacePriceCents"
>;

export function toPublicOffspringDTO(
  offspring: OffspringWithFields,
  groupDefaultPriceCents?: number | null
): PublicOffspringDTO {
  // Derive status from state fields
  let status: "available" | "reserved" | "placed";
  if (offspring.placementState === "PLACED") {
    status = "placed";
  } else if (offspring.placementState === "RESERVED") {
    status = "reserved";
  } else if (offspring.keeperIntent === "AVAILABLE" && offspring.placementState === "UNASSIGNED") {
    status = "available";
  } else {
    // Default to available for other states (e.g., KEEPER intent but not placed)
    status = "available";
  }

  // Derive price: offspring override > group default > offspring base price
  const derivedPrice = offspring.marketplacePriceCents ?? groupDefaultPriceCents ?? offspring.priceCents ?? null;

  return {
    id: offspring.id,
    name: offspring.name || null,
    sex: offspring.sex || null,
    collarColorName: offspring.collarColorName || null,
    collarColorHex: offspring.collarColorHex || null,
    priceCents: derivedPrice,
    status,
  };
}

// ============================================================================
// Public Animal Listing DTO
// ============================================================================

export interface PublicAnimalListingDTO {
  slug: string;
  intent: string | null;
  status: string;
  headline: string | null;
  title: string | null;
  summary: string | null;
  description: string | null;
  // Pricing
  priceDisplay: string | null;  // Derived display string
  priceCents: number | null;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  priceText: string | null;
  // Location
  location: string | null;
  // Animal details
  animal: {
    name: string;
    species: string;
    sex: string;
    breed: string | null;
    birthDate: string | null;
    photoUrl: string | null;
    priceCents: number | null;
    registrations: Array<{
      registryName: string;
      identifier: string;
    }>;
    traits: Array<{
      key: string;
      displayName: string;
      category: string;
      status: string;
      verified: boolean;
    }>;
  };
  programSlug: string;
  programName: string;
}

type AnimalWithRelations = Pick<
  Animal,
  "name" | "species" | "sex" | "breed" | "birthDate" | "photoUrl" | "priceCents"
> & {
  registryIds?: Array<
    Pick<AnimalRegistryIdentifier, "identifier"> & {
      registry: Pick<Registry, "name">;
    }
  >;
  AnimalTraitValue?: Array<
    Pick<AnimalTraitValue, "marketplaceVisible" | "status" | "verified"> & {
      traitDefinition: Pick<TraitDefinition, "key" | "displayName" | "category">;
    }
  >;
};

type ListingWithAnimal = Pick<
  MktListingIndividualAnimal,
  | "slug"
  | "title"
  | "description"
  | "templateType"
  | "status"
  | "headline"
  | "summary"
  | "priceCents"
  | "priceMinCents"
  | "priceMaxCents"
  | "priceModel"
  | "locationCity"
  | "locationRegion"
  | "locationCountry"
> & {
  animal: AnimalWithRelations;
};

/**
 * Derive a display string for price based on priceModel and values
 */
function derivePriceDisplay(listing: Pick<
  MktListingIndividualAnimal,
  "priceModel" | "priceCents" | "priceMinCents" | "priceMaxCents"
> & { animal: Pick<Animal, "priceCents"> }): string | null {
  const model = listing.priceModel;

  if (model === "inquire" || model === "negotiable") {
    return model === "inquire" ? "Inquire" : "Negotiable";
  }

  if (model === "range" && listing.priceMinCents != null && listing.priceMaxCents != null) {
    const min = (listing.priceMinCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
    const max = (listing.priceMaxCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
    return `${min} - ${max}`;
  }

  // Fixed price: use listing price, fallback to animal price
  const price = listing.priceCents ?? listing.animal.priceCents;
  if (price != null) {
    return (price / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  }

  return null;
}

/**
 * Derive location string from listing fields
 */
function deriveLocation(listing: Pick<
  MktListingIndividualAnimal,
  "locationCity" | "locationRegion" | "locationCountry"
>): string | null {
  const parts: string[] = [];
  if (listing.locationCity) parts.push(listing.locationCity);
  if (listing.locationRegion) parts.push(listing.locationRegion);
  if (listing.locationCountry) parts.push(listing.locationCountry);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function toPublicAnimalListingDTO(
  listing: ListingWithAnimal,
  programSlug: string,
  programName: string
): PublicAnimalListingDTO {
  const animal = listing.animal;

  // Filter to only marketplace-visible traits
  const visibleTraits = (animal.AnimalTraitValue || [])
    .filter((tv) => tv.marketplaceVisible === true)
    .map((tv) => ({
      key: tv.traitDefinition.key,
      displayName: tv.traitDefinition.displayName,
      category: tv.traitDefinition.category,
      status: tv.status || "NOT_PROVIDED",
      verified: tv.verified || false,
    }));

  // Map registrations
  const registrations = (animal.registryIds || []).map((r) => ({
    registryName: r.registry.name,
    identifier: r.identifier,
  }));

  return {
    slug: listing.slug || "",
    intent: listing.templateType || null,
    status: listing.status,
    headline: listing.headline || null,
    title: listing.title || null,
    summary: listing.summary || null,
    description: listing.description || null,
    // Pricing
    priceDisplay: derivePriceDisplay(listing),
    priceCents: listing.priceCents || null,
    priceMinCents: listing.priceMinCents || null,
    priceMaxCents: listing.priceMaxCents || null,
    priceText: null, // No longer supported in new model
    // Location
    location: deriveLocation(listing),
    // Animal
    animal: {
      name: animal.name,
      species: animal.species,
      sex: animal.sex,
      breed: animal.breed || null,
      birthDate: animal.birthDate?.toISOString().slice(0, 10) || null,
      // SECURITY: Transform to auth-gated asset URL
      photoUrl: toAssetUrl(animal.photoUrl, "animal_photo"),
      priceCents: animal.priceCents || null,
      registrations,
      traits: visibleTraits,
    },
    programSlug,
    programName,
  };
}

// ============================================================================
// Listing Summary DTO (for list endpoints)
// ============================================================================

export interface PublicListingSummaryDTO {
  type: "offspring_group" | "animal";
  slug: string;
  intent: string | null;  // For animal listings
  headline: string | null;  // For animal listings
  title: string | null;
  species: string;
  breed: string | null;
  photoUrl: string | null;
  priceRange: { min: number; max: number } | null;
  priceDisplay: string | null;  // Derived display string for animal listings
}

export function toOffspringGroupSummaryDTO(
  group: OffspringGroupWithRelations
): PublicListingSummaryDTO {
  // Filter to only listed offspring
  const listedOffspring = (group.Offspring || []).filter((o) => o.marketplaceListed === true);
  const available = listedOffspring.filter(
    (o) => o.keeperIntent === "AVAILABLE" && o.placementState === "UNASSIGNED"
  );
  const prices = available
    .map((o) => o.marketplacePriceCents ?? group.marketplaceDefaultPriceCents ?? o.priceCents)
    .filter((p): p is number => p != null && p > 0);
  const priceRange =
    prices.length > 0
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null;

  // Derive price display for offspring groups
  let priceDisplay: string | null = null;
  if (priceRange) {
    if (priceRange.min === priceRange.max) {
      priceDisplay = (priceRange.min / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
    } else {
      const min = (priceRange.min / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
      const max = (priceRange.max / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
      priceDisplay = `${min} - ${max}`;
    }
  }

  return {
    type: "offspring_group",
    slug: group.listingSlug || "",
    intent: null,  // Not applicable to offspring groups
    headline: null,  // Not applicable to offspring groups
    title: group.listingTitle || null,
    species: group.species,
    breed: group.dam?.breed || null,
    // SECURITY: Transform to auth-gated asset URL
    photoUrl: toAssetUrl(group.coverImageUrl, "offspring_group_cover"),
    priceRange,
    priceDisplay,
  };
}

export function toAnimalListingSummaryDTO(
  listing: Pick<
    MktListingIndividualAnimal,
    | "slug"
    | "title"
    | "templateType"
    | "headline"
    | "priceCents"
    | "priceMinCents"
    | "priceMaxCents"
    | "priceModel"
  > & {
    animal: Pick<Animal, "species" | "breed" | "photoUrl" | "priceCents">;
  }
): PublicListingSummaryDTO {
  // Derive price display
  const priceDisplay = derivePriceDisplay(listing);

  // Derive price range for consistency with offspring group format
  let priceRange: { min: number; max: number } | null = null;
  if (listing.priceModel === "range" && listing.priceMinCents != null && listing.priceMaxCents != null) {
    priceRange = { min: listing.priceMinCents, max: listing.priceMaxCents };
  } else {
    const price = listing.priceCents ?? listing.animal.priceCents;
    if (price != null) {
      priceRange = { min: price, max: price };
    }
  }

  return {
    type: "animal",
    slug: listing.slug || "",
    intent: listing.templateType || null,
    headline: listing.headline || null,
    title: listing.title || null,
    species: listing.animal.species,
    breed: listing.animal.breed || null,
    // SECURITY: Transform to auth-gated asset URL
    photoUrl: toAssetUrl(listing.animal.photoUrl, "animal_photo"),
    priceRange,
    priceDisplay,
  };
}
