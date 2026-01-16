// src/routes/marketplace-breeders.ts
// Public breeder profile endpoints - no auth required
//
// Endpoints:
//   GET /api/v1/marketplace/breeders              - List published breeders (paginated)
//   GET /api/v1/marketplace/breeders/:tenantSlug  - Read published breeder profile
//
// Security:
// - No authentication required (public endpoints)
// - Returns ONLY published data, never draft
// - Street-level address fields are never returned

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { isBlocked } from "../services/marketplace-block.js";
import { isUserSuspended } from "../services/marketplace-flag.js";

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

interface StandardsAndCredentials {
  registrations: string[];
  healthPractices: string[];
  breedingPractices: string[];
  carePractices: string[];
  registrationsNote: string | null;
  healthNote: string | null;
  breedingNote: string | null;
  careNote: string | null;
}

interface PlacementPolicies {
  requireApplication: boolean;
  requireInterview: boolean;
  requireContract: boolean;
  requireDeposit: boolean;
  requireReservationFee: boolean;
  depositRefundable: boolean;
  requireHomeVisit: boolean;
  requireVetReference: boolean;
  requireSpayNeuter: boolean;
  hasReturnPolicy: boolean;
  lifetimeTakeBack: boolean;
  offersSupport: boolean;
  note: string | null;
}

interface DaySchedule {
  enabled: boolean;
  open: string;
  close: string;
}

interface BusinessHoursSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
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
  breeds: Array<{ name: string; species: string | null }>;
  programs: Array<{
    name: string;
    description: string | null;
    acceptInquiries: boolean;
    openWaitlist: boolean;
    comingSoon: boolean;
    /** Asset IDs for photos/media attached to this program */
    mediaAssetIds: string[];
  }>;
  standardsAndCredentials: StandardsAndCredentials | null;
  placementPolicies: PlacementPolicies | null;
  publishedAt: string | null;
  // Business hours and badge info
  businessHours: BusinessHoursSchedule | null;
  timeZone: string | null;
  quickResponderBadge: boolean;
}

/**
 * Availability status for a breeder - helps buyers understand
 * if this breeder is currently accepting inquiries or has animals available.
 */
interface AvailabilityStatus {
  acceptingInquiries: boolean;
  waitlistOpen: boolean;
  availableNowCount: number;
  upcomingLittersCount: number;
}

/**
 * Trust badges earned by the breeder based on their activity and practices.
 */
interface TrustBadges {
  quickResponder: boolean;
  healthTesting: boolean;
  experiencedBreeder: boolean;
}

/**
 * Review summary for a breeder (if reviews exist).
 */
interface ReviewSummary {
  hasReviews: boolean;
  averageRating: number | null;
  reviewCount: number;
}

/**
 * Summary item for breeder list response.
 * Lighter weight than full profile - designed for directory cards.
 * Includes both formatted location and raw fields for filtering/display flexibility.
 */
interface BreederSummary {
  tenantSlug: string;
  businessName: string;
  // Formatted location string based on publicLocationMode
  location: string | null;
  // Raw location fields for filtering and custom formatting
  publicLocationMode: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  breeds: Array<{ name: string; species: string | null }>;
  logoAssetId: string | null;

  // === ENHANCED FIELDS ===

  // Experience & Trust
  yearsInBusiness: number | null;
  placementCount: number;

  // Availability Status
  availabilityStatus: AvailabilityStatus;

  // Trust Badges
  badges: TrustBadges;

  // Response Metrics
  averageResponseTimeHours: number | null;

  // Review Summary
  reviewSummary: ReviewSummary | null;

  // Primary Species (for quick scanning)
  primarySpecies: string | null;
}

interface BreedersListResponse {
  items: BreederSummary[];
  total: number;
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
 * Extract breeds array from various possible shapes (now includes species)
 */
function extractBreeds(published: Record<string, unknown>): Array<{ name: string; species: string | null }> {
  // Try breeds array first (from publish payload)
  if (Array.isArray(published.breeds)) {
    return published.breeds
      .map((b: unknown) => {
        if (typeof b === "string" && b.trim()) return { name: b.trim(), species: null };
        if (b && typeof b === "object" && "name" in b) {
          // Respect isPublic visibility flag - default to true for backward compatibility
          const isPublic = (b as any).isPublic !== false;
          if (!isPublic) return null;

          const name = safeString((b as any).name);
          const species = safeString((b as any).species);
          if (name) return { name, species };
        }
        return null;
      })
      .filter((b): b is { name: string; species: string | null } => b !== null);
  }

  // Fall back to listedBreeds (string array)
  if (Array.isArray(published.listedBreeds)) {
    return published.listedBreeds
      .filter((b): b is string => typeof b === "string" && b.trim() !== "")
      .map((name) => ({ name: name.trim(), species: null }));
  }

  return [];
}

/**
 * Extract listed programs from published data
 */
function extractPrograms(
  published: Record<string, unknown>
): Array<{
  name: string;
  description: string | null;
  acceptInquiries: boolean;
  openWaitlist: boolean;
  comingSoon: boolean;
  mediaAssetIds: string[];
}> {
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
        acceptInquiries: safeBool(prog.acceptInquiries),
        openWaitlist: safeBool(prog.openWaitlist),
        comingSoon: safeBool(prog.comingSoon),
        mediaAssetIds: safeStringArray(prog.mediaAssetIds),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
}

/**
 * Safely extract string array from unknown value
 */
function safeStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map((v) => v.trim());
}

/**
 * Normalize note value - return null if empty/whitespace
 */
function normalizeNote(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  return trimmed || null;
}

/**
 * Check if credentials object is empty (no items in any array, no notes)
 */
function isEmptyCredentials(creds: StandardsAndCredentials): boolean {
  return (
    creds.registrations.length === 0 &&
    creds.healthPractices.length === 0 &&
    creds.breedingPractices.length === 0 &&
    creds.carePractices.length === 0 &&
    !creds.registrationsNote &&
    !creds.healthNote &&
    !creds.breedingNote &&
    !creds.careNote
  );
}

/**
 * Check if policies object is empty (all flags false, no note)
 */
function isEmptyPolicies(p: PlacementPolicies): boolean {
  return (
    !p.requireApplication &&
    !p.requireInterview &&
    !p.requireContract &&
    !p.requireDeposit &&
    !p.requireReservationFee &&
    !p.requireHomeVisit &&
    !p.requireVetReference &&
    !p.requireSpayNeuter &&
    !p.hasReturnPolicy &&
    !p.lifetimeTakeBack &&
    !p.offersSupport &&
    !p.note
  );
}

/**
 * Extract standards and credentials from published data.
 * Respects showXxx visibility flags - only includes sections marked as public.
 * Returns null if all visible fields are empty.
 */
function extractStandardsAndCredentials(
  published: Record<string, unknown>
): StandardsAndCredentials | null {
  const raw = published.standardsAndCredentials;
  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, unknown>;

  // Check visibility flags - default to true for backward compatibility
  const showRegistrations = data.showRegistrations !== false;
  const showHealthPractices = data.showHealthPractices !== false;
  const showBreedingPractices = data.showBreedingPractices !== false;
  const showCarePractices = data.showCarePractices !== false;

  const creds: StandardsAndCredentials = {
    registrations: showRegistrations ? safeStringArray(data.registrations) : [],
    healthPractices: showHealthPractices ? safeStringArray(data.healthPractices) : [],
    breedingPractices: showBreedingPractices ? safeStringArray(data.breedingPractices) : [],
    carePractices: showCarePractices ? safeStringArray(data.carePractices) : [],
    registrationsNote: showRegistrations ? normalizeNote(data.registrationsNote) : null,
    healthNote: showHealthPractices ? normalizeNote(data.healthNote) : null,
    breedingNote: showBreedingPractices ? normalizeNote(data.breedingNote) : null,
    careNote: showCarePractices ? normalizeNote(data.careNote) : null,
  };

  return isEmptyCredentials(creds) ? null : creds;
}

/**
 * Extract placement policies from published data.
 * Respects showPolicies visibility flag.
 * Returns null if hidden or all flags false and note empty.
 */
function extractPlacementPolicies(
  published: Record<string, unknown>
): PlacementPolicies | null {
  const raw = published.placementPolicies;
  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, unknown>;

  // Check visibility flag - default to true for backward compatibility
  const showPolicies = data.showPolicies !== false;
  if (!showPolicies) return null;

  const policies: PlacementPolicies = {
    requireApplication: safeBool(data.requireApplication),
    requireInterview: safeBool(data.requireInterview),
    requireContract: safeBool(data.requireContract),
    requireDeposit: safeBool(data.requireDeposit),
    requireReservationFee: safeBool(data.requireReservationFee),
    depositRefundable: safeBool(data.depositRefundable),
    requireHomeVisit: safeBool(data.requireHomeVisit),
    requireVetReference: safeBool(data.requireVetReference),
    requireSpayNeuter: safeBool(data.requireSpayNeuter),
    hasReturnPolicy: safeBool(data.hasReturnPolicy),
    lifetimeTakeBack: safeBool(data.lifetimeTakeBack),
    offersSupport: safeBool(data.offersSupport),
    note: normalizeNote(data.note),
  };

  return isEmptyPolicies(policies) ? null : policies;
}

/**
 * Build a display string for location based on mode.
 * Returns null if mode is hidden or no location data.
 */
function buildLocationDisplay(
  address: unknown,
  mode: string | null
): string | null {
  if (!mode || mode === "hidden") return null;
  if (!address || typeof address !== "object") return null;

  const addr = address as Record<string, unknown>;
  const city = safeString(addr.city);
  const state = safeString(addr.state);
  const zip = safeString(addr.zip);

  switch (mode) {
    case "city_state":
      if (city && state) return `${city}, ${state}`;
      return city || state || null;
    case "zip_only":
      return zip;
    case "full":
      if (city && state && zip) return `${city}, ${state} ${zip}`;
      if (city && state) return `${city}, ${state}`;
      return zip || city || state || null;
    default:
      return null;
  }
}

// ============================================================================
// Routes
// ============================================================================

const marketplaceBreedersRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // GET /breeders - List published breeders (PUBLIC)
  // --------------------------------------------------------------------------
  app.get<{ Querystring: { limit?: string; offset?: string } }>("/breeders", async (req, reply) => {
    // Parse and validate pagination params
    const limitParam = parseInt(req.query.limit || "24", 10);
    const offsetParam = parseInt(req.query.offset || "0", 10);

    const limit = Math.min(Math.max(1, isNaN(limitParam) ? 24 : limitParam), 50);
    const offset = Math.max(0, isNaN(offsetParam) ? 0 : offsetParam);

    // Query all TenantSettings with marketplace-profile namespace
    // Join to Tenant to get slug and additional fields for enhanced data
    const settings = await prisma.tenantSetting.findMany({
      where: {
        namespace: NAMESPACE,
        tenant: {
          slug: { not: null },
        },
      },
      select: {
        data: true,
        updatedAt: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            slug: true,
            quickResponderBadge: true,
          },
        },
      },
    });

    // Collect all tenant IDs to batch-fetch stats
    const tenantIds = settings
      .filter((s) => s.tenant.slug)
      .map((s) => s.tenantId);

    // Batch fetch placement counts from Animal table (animals with placedAt timestamp set)
    const animalPlacementCounts = await prisma.animal.groupBy({
      by: ["tenantId"],
      where: {
        tenantId: { in: tenantIds },
        placedAt: { not: null },
      },
      _count: { id: true },
    });

    // Batch fetch placement counts from Offspring table (offspring with placementState = PLACED)
    const offspringPlacementCounts = await prisma.offspring.groupBy({
      by: ["tenantId"],
      where: {
        tenantId: { in: tenantIds },
        placementState: "PLACED",
      },
      _count: { id: true },
    });

    // Combine placement counts from both sources
    const placementCountMap = new Map<number, number>();
    for (const p of animalPlacementCounts) {
      const count = (p._count as { id: number }).id;
      placementCountMap.set(p.tenantId, (placementCountMap.get(p.tenantId) ?? 0) + count);
    }
    for (const p of offspringPlacementCounts) {
      const count = (p._count as { id: number }).id;
      placementCountMap.set(p.tenantId, (placementCountMap.get(p.tenantId) ?? 0) + count);
    }

    // Batch fetch available offspring count (marketplaceListed = true, placementState != PLACED)
    const availableOffspringCounts = await prisma.offspring.groupBy({
      by: ["tenantId"],
      where: {
        tenantId: { in: tenantIds },
        marketplaceListed: true,
        placementState: { not: "PLACED" },
        lifeState: "ALIVE",
      },
      _count: { id: true },
    });
    const availableCountMap = new Map(
      availableOffspringCounts.map((a) => [a.tenantId, (a._count as { id: number }).id])
    );

    // Batch fetch upcoming litters (OffspringGroup with expectedBirthOn within 90 days)
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    const upcomingLitters = await prisma.offspringGroup.groupBy({
      by: ["tenantId"],
      where: {
        tenantId: { in: tenantIds },
        expectedBirthOn: {
          gte: new Date(),
          lte: ninetyDaysFromNow,
        },
        archivedAt: null,
      },
      _count: { id: true },
    });
    const upcomingLittersMap = new Map(
      upcomingLitters.map((l) => [l.tenantId, (l._count as { id: number }).id])
    );

    // Filter to only published profiles with valid businessName
    // and transform to summary items
    const publishedBreeders: Array<{
      summary: BreederSummary;
      publishedAt: string | null;
      updatedAt: Date;
    }> = [];

    for (const setting of settings) {
      const profileData = setting.data as MarketplaceProfileData | null;
      if (!profileData?.published) continue;

      const published = profileData.published;
      const businessName = safeString(published.businessName);
      if (!businessName) continue;

      const tenantSlug = setting.tenant.slug;
      if (!tenantSlug) continue;

      const tenantId = setting.tenantId;

      // Extract location mode and raw address fields
      const publicLocationMode = safeString(published.publicLocationMode);
      const address = published.address as Record<string, unknown> | null | undefined;

      // Only include raw location fields if mode allows them (not hidden)
      const includeLocation = publicLocationMode && publicLocationMode !== "hidden";
      const city = includeLocation && address ? safeString(address.city) : null;
      const state = includeLocation && address ? safeString(address.state) : null;
      const zip = includeLocation && address ? safeString(address.zip) : null;

      // Check if business identity (logo) should be shown
      const showBusinessIdentity = safeBool(published.showBusinessIdentity);

      // Extract breeds for this breeder
      const breeds = extractBreeds(published);

      // Compute yearsInBusiness from yearEstablished
      const yearEstablished = typeof published.yearEstablished === "number"
        ? published.yearEstablished
        : null;
      const currentYear = new Date().getFullYear();
      const yearsInBusiness = yearEstablished
        ? Math.max(0, currentYear - yearEstablished)
        : null;

      // Get placement count from pre-fetched map
      const placementCount = placementCountMap.get(tenantId) ?? 0;

      // Get available animals count
      const availableNowCount = availableCountMap.get(tenantId) ?? 0;

      // Get upcoming litters count
      const upcomingLittersCount = upcomingLittersMap.get(tenantId) ?? 0;

      // Extract availability settings from published programs
      const programs = Array.isArray(published.listedPrograms) ? published.listedPrograms : [];
      const acceptingInquiries = programs.some(
        (p: any) => p && typeof p === "object" && safeBool(p.acceptInquiries)
      );
      const waitlistOpen = programs.some(
        (p: any) => p && typeof p === "object" && safeBool(p.openWaitlist)
      );

      // Build availability status
      const availabilityStatus: AvailabilityStatus = {
        acceptingInquiries,
        waitlistOpen,
        availableNowCount,
        upcomingLittersCount,
      };

      // Check for health testing practices in credentials
      const credentials = published.standardsAndCredentials as Record<string, unknown> | null;
      const healthPractices = credentials ? safeStringArray(credentials.healthPractices) : [];
      const hasHealthTesting = healthPractices.length > 0;

      // Build trust badges
      const badges: TrustBadges = {
        quickResponder: setting.tenant.quickResponderBadge ?? false,
        healthTesting: hasHealthTesting,
        experiencedBreeder: placementCount >= 5,
      };

      // Compute primary species from breeds
      const speciesCounts = new Map<string, number>();
      for (const breed of breeds) {
        if (breed.species) {
          const species = breed.species.toLowerCase();
          speciesCounts.set(species, (speciesCounts.get(species) ?? 0) + 1);
        }
      }
      let primarySpecies: string | null = null;
      let maxCount = 0;
      for (const [species, count] of speciesCounts) {
        if (count > maxCount) {
          maxCount = count;
          primarySpecies = species;
        }
      }

      const summary: BreederSummary = {
        tenantSlug,
        businessName,
        location: buildLocationDisplay(published.address, publicLocationMode),
        publicLocationMode,
        city,
        state,
        zip,
        breeds,
        logoAssetId: showBusinessIdentity ? safeString(published.logoAssetId) : null,
        // Enhanced fields
        yearsInBusiness,
        placementCount,
        availabilityStatus,
        badges,
        averageResponseTimeHours: null, // TODO: Compute from inquiry response times
        reviewSummary: null, // TODO: Compute from reviews table when available
        primarySpecies,
      };

      publishedBreeders.push({
        summary,
        publishedAt: profileData.publishedAt ?? null,
        updatedAt: setting.updatedAt,
      });
    }

    // Sort by publishedAt desc, fall back to updatedAt desc
    publishedBreeders.sort((a, b) => {
      // Compare publishedAt first (most recently published first)
      if (a.publishedAt && b.publishedAt) {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }
      // Items with publishedAt come before those without
      if (a.publishedAt && !b.publishedAt) return -1;
      if (!a.publishedAt && b.publishedAt) return 1;
      // Fall back to updatedAt
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    const total = publishedBreeders.length;

    // Apply pagination
    const paginatedItems = publishedBreeders
      .slice(offset, offset + limit)
      .map((item) => item.summary);

    const response: BreedersListResponse = {
      items: paginatedItems,
      total,
    };

    return reply.send(response);
  });

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

    // Look up tenant by slug with business hours and badge info
    const tenant = await prisma.tenant.findUnique({
      where: { slug: normalizedSlug },
      select: {
        id: true,
        slug: true,
        businessHours: true,
        timeZone: true,
        quickResponderBadge: true,
      },
    });

    if (!tenant || !tenant.slug) {
      return reply.code(404).send({ error: "not_found" });
    }

    // If user is logged in, check for HEAVY block (profile hidden from this user)
    const userId = (req as any).userId;
    if (userId) {
      const suspended = await isUserSuspended(userId);
      const blocked = await isBlocked(tenant.id, userId, "HEAVY");
      if (suspended || blocked) {
        // Return 404 as if breeder doesn't exist (don't reveal user is blocked)
        return reply.code(404).send({ error: "not_found" });
      }
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

    // Check visibility toggles
    const showBusinessIdentity = safeBool(published.showBusinessIdentity);

    // Build response with only public-safe fields
    const response: PublishedBreederResponse = {
      tenantSlug: tenant.slug,
      businessName, // Always shown (required for discovery)
      // Only include bio/logo if showBusinessIdentity is true
      bio: showBusinessIdentity ? safeString(published.bio) : null,
      logoAssetId: showBusinessIdentity ? safeString(published.logoAssetId) : null,
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
      standardsAndCredentials: extractStandardsAndCredentials(published),
      placementPolicies: extractPlacementPolicies(published),
      publishedAt: profileData.publishedAt ?? null,
      // Business hours and badge info
      businessHours: (tenant.businessHours as unknown as BusinessHoursSchedule) ?? null,
      timeZone: tenant.timeZone ?? null,
      quickResponderBadge: tenant.quickResponderBadge,
    };

    return reply.send(response);
  });

  // --------------------------------------------------------------------------
  // GET /breeders/:tenantSlug/messaging - Get messaging info for breeder (auth required)
  // Returns the breeder's ORGANIZATION party ID for messaging
  // --------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string } }>("/breeders/:tenantSlug/messaging", async (req, reply) => {
    const { tenantSlug } = req.params;

    // Require authentication (PUBLIC context with valid session)
    const userId = (req as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized", detail: "authentication_required" });
    }

    // Validate slug format
    if (!tenantSlug || typeof tenantSlug !== "string" || tenantSlug.trim() === "") {
      return reply.code(400).send({ error: "invalid_slug" });
    }

    const normalizedSlug = tenantSlug.trim().toLowerCase();

    // Look up tenant by slug
    const tenant = await prisma.tenant.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true, slug: true, name: true },
    });

    if (!tenant || !tenant.slug) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Check if user is suspended platform-wide or blocked at MEDIUM level
    const suspended = await isUserSuspended(userId);
    const blocked = await isBlocked(tenant.id, userId, "MEDIUM");
    if (suspended || blocked) {
      // Return as if messaging is not enabled (don't reveal user is blocked)
      return reply.send({
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        businessName: tenant.name,
        enabled: false,
        reason: "not_available",
      });
    }

    // Get the tenant's ORGANIZATION party via the Organization table (which has a unique partyId)
    // This is more reliable than finding Party by type, as there could be multiple ORGANIZATION parties
    const org = await prisma.organization.findFirst({
      where: { tenantId: tenant.id },
      select: { partyId: true, name: true },
    });

    if (!org) {
      return reply.code(404).send({ error: "no_messaging_party", detail: "Breeder has not set up messaging" });
    }

    return reply.send({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      businessName: tenant.name,
      partyId: org.partyId,
      partyName: org.name,
    });
  });
};

export default marketplaceBreedersRoutes;
