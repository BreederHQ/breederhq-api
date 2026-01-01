// src/utils/public-dto.ts
// DTO projection functions for public marketplace endpoints
// These functions strip PII and expose only safe fields

import type {
  Organization,
  OffspringGroup,
  Offspring,
  Animal,
  AnimalPublicListing,
  Breed,
  AnimalRegistryIdentifier,
  Registry,
  AnimalTraitValue,
  TraitDefinition,
} from "@prisma/client";

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
> & {
  dam?: Pick<Animal, "name" | "photoUrl" | "breed"> | null;
  sire?: Pick<Animal, "name" | "photoUrl" | "breed"> | null;
  Offspring?: Array<Pick<Offspring, "priceCents" | "keeperIntent" | "placementState">>;
  tenant?: { organizations?: Array<Pick<Organization, "programSlug" | "name">> };
};

export function toPublicOffspringGroupListingDTO(
  group: OffspringGroupWithRelations,
  programSlug: string,
  programName: string
): PublicOffspringGroupListingDTO {
  // Count available offspring
  const available = (group.Offspring || []).filter(
    (o) => o.keeperIntent === "AVAILABLE" && o.placementState === "UNASSIGNED"
  );
  const countAvailable = available.length;

  // Calculate price range from available offspring
  const prices = available
    .map((o) => o.priceCents)
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
          photoUrl: group.dam.photoUrl || null,
          breed: group.dam.breed || null,
        }
      : null,
    sire: group.sire
      ? {
          name: group.sire.name,
          photoUrl: group.sire.photoUrl || null,
          breed: group.sire.breed || null,
        }
      : null,
    coverImageUrl: group.coverImageUrl || null,
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
>;

export function toPublicOffspringDTO(offspring: OffspringWithFields): PublicOffspringDTO {
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

  return {
    id: offspring.id,
    name: offspring.name || null,
    sex: offspring.sex || null,
    collarColorName: offspring.collarColorName || null,
    collarColorHex: offspring.collarColorHex || null,
    priceCents: offspring.priceCents || null,
    status,
  };
}

// ============================================================================
// Public Animal Listing DTO
// ============================================================================

export interface PublicAnimalListingDTO {
  slug: string;
  title: string | null;
  description: string | null;
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

type ListingWithAnimal = Pick<AnimalPublicListing, "urlSlug" | "title" | "description"> & {
  animal: AnimalWithRelations;
};

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
    slug: listing.urlSlug || "",
    title: listing.title || null,
    description: listing.description || null,
    animal: {
      name: animal.name,
      species: animal.species,
      sex: animal.sex,
      breed: animal.breed || null,
      birthDate: animal.birthDate?.toISOString().slice(0, 10) || null,
      photoUrl: animal.photoUrl || null,
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
  title: string | null;
  species: string;
  breed: string | null;
  photoUrl: string | null;
  priceRange: { min: number; max: number } | null;
}

export function toOffspringGroupSummaryDTO(
  group: OffspringGroupWithRelations
): PublicListingSummaryDTO {
  const available = (group.Offspring || []).filter(
    (o) => o.keeperIntent === "AVAILABLE" && o.placementState === "UNASSIGNED"
  );
  const prices = available
    .map((o) => o.priceCents)
    .filter((p): p is number => p != null && p > 0);
  const priceRange =
    prices.length > 0
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null;

  return {
    type: "offspring_group",
    slug: group.listingSlug || "",
    title: group.listingTitle || null,
    species: group.species,
    breed: group.dam?.breed || null,
    photoUrl: group.coverImageUrl || null,
    priceRange,
  };
}

export function toAnimalListingSummaryDTO(
  listing: Pick<AnimalPublicListing, "urlSlug" | "title"> & {
    animal: Pick<Animal, "species" | "breed" | "photoUrl" | "priceCents">;
  }
): PublicListingSummaryDTO {
  return {
    type: "animal",
    slug: listing.urlSlug || "",
    title: listing.title || null,
    species: listing.animal.species,
    breed: listing.animal.breed || null,
    photoUrl: listing.animal.photoUrl || null,
    priceRange: listing.animal.priceCents
      ? { min: listing.animal.priceCents, max: listing.animal.priceCents }
      : null,
  };
}
