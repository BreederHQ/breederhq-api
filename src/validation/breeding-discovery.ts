import { z } from "zod";

// ── BreederProfile ──────────────────────────────────────────────────────────

export const breederProfileUpdateSchema = z.object({
  registryAffiliations: z.array(z.string()).optional(),
  primaryRegistry: z.string().optional().nullable(),
  breedingLineTypes: z.array(z.string()).optional(),
  breedingPhilosophy: z.string().max(5000).optional().nullable(),
  requiresHealthTesting: z.boolean().optional(),
  requiresContract: z.boolean().optional(),
  requiredTests: z.array(z.string()).optional(),
  excludedRegistries: z.array(z.string()).optional(),
  excludedLineTypes: z.array(z.string()).optional(),
  excludedAttributes: z.array(z.string()).optional(),
  exclusionNotes: z.string().max(2000).optional().nullable(),
  showRegistryAffiliations: z.boolean().optional(),
  showBreedingLineTypes: z.boolean().optional(),
  showRequirements: z.boolean().optional(),
  publicBio: z.string().max(5000).optional().nullable(),
  websiteUrl: z.string().url().optional().nullable(),
  socialLinks: z.record(z.string(), z.string()).optional().nullable(),
});

// ── BreedingDiscoveryProgram ────────────────────────────────────────────────

export const breedingDiscoveryProgramCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  species: z.enum(["DOG", "CAT", "HORSE", "GOAT", "RABBIT", "SHEEP"]),
  programType: z.string().min(1).max(100),
  defaultBreedingMethods: z.array(z.string()).optional(),
  defaultGuaranteeType: z.string().optional(),
  defaultGuaranteeTerms: z.string().max(5000).optional(),
  defaultRequiresHealthTesting: z.boolean().optional(),
  defaultRequiredTests: z.array(z.string()).optional(),
  defaultRequiresContract: z.boolean().optional(),
  publicEnabled: z.boolean().optional(),
  publicHeadline: z.string().max(200).optional(),
  publicDescription: z.string().max(5000).optional(),
  media: z.array(z.string().url()).max(20).optional(),
  locationCity: z.string().optional(),
  locationState: z.string().optional(),
  locationCountry: z.string().optional(),
});

export const breedingDiscoveryProgramUpdateSchema = breedingDiscoveryProgramCreateSchema.partial();

// ── BreedingListing ─────────────────────────────────────────────────────────

export const breedingListingCreateSchema = z.object({
  animalId: z.number().int().positive(),
  programId: z.number().int().positive().optional(),
  intent: z.enum(["OFFERING", "SEEKING", "LEASE", "ARRANGEMENT"]),
  headline: z.string().min(10).max(100),
  description: z.string().max(5000).optional(),
  media: z.array(z.string().url()).max(20).optional(),
  feeCents: z.number().int().nonnegative().optional(),
  feeDirection: z.enum(["I_RECEIVE", "I_PAY", "SPLIT", "NEGOTIABLE"]).optional(),
  feeNotes: z.string().max(2000).optional(),
  availableFrom: z.string().datetime().optional(),
  availableTo: z.string().datetime().optional(),
  seasonName: z.string().max(100).optional(),
  breedingMethods: z.array(z.string()).optional(),
  maxBookings: z.number().int().positive().optional(),
  guaranteeType: z.string().optional(),
  guaranteeTerms: z.string().max(5000).optional(),
  requiresHealthTesting: z.boolean().optional(),
  requiredTests: z.array(z.string()).optional(),
  requiresContract: z.boolean().optional(),
  additionalRequirements: z.string().max(5000).optional(),
  publicShowPedigree: z.boolean().optional(),
  publicPedigreeDepth: z.number().int().min(1).max(6).optional(),
  publicShowTitles: z.boolean().optional(),
  publicShowHealthTesting: z.boolean().optional(),
  publicShowLineType: z.boolean().optional(),
  publicShowProducingStats: z.boolean().optional(),
  publicShowBreederName: z.boolean().optional(),
  publicShowBreederLocation: z.boolean().optional(),
  publicShowFee: z.boolean().optional(),
  metaTitle: z.string().max(100).optional(),
  metaDescription: z.string().max(300).optional(),
  acceptInquiries: z.boolean().optional(),
  inquiryEmail: z.string().email().optional(),
  inquiryPhone: z.string().optional(),
  inquiryInstructions: z.string().max(2000).optional(),
  locationCity: z.string().optional(),
  locationState: z.string().optional(),
  locationCountry: z.string().optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
});

export const breedingListingUpdateSchema = breedingListingCreateSchema.partial();

// ── BreedingBooking ─────────────────────────────────────────────────────────

export const breedingBookingCreateSchema = z.object({
  sourceListingId: z.number().int().positive().optional(),
  sourceInquiryId: z.number().int().positive().optional(),
  offeringAnimalId: z.number().int().positive(),
  seekingPartyId: z.number().int().positive(),
  seekingTenantId: z.number().int().positive().optional(),
  seekingAnimalId: z.number().int().positive().optional(),
  externalAnimalName: z.string().optional(),
  externalAnimalReg: z.string().optional(),
  externalAnimalBreed: z.string().optional(),
  externalAnimalSex: z.string().optional(),
  species: z.enum(["DOG", "CAT", "HORSE", "GOAT", "RABBIT", "SHEEP"]),
  bookingType: z.enum(["STUD_SERVICE", "LEASE_BREEDING", "CO_OWN", "AI_SHIPPED", "NATURAL_COVER"]),
  preferredMethod: z.string().optional(),
  preferredDateStart: z.string().datetime().optional(),
  preferredDateEnd: z.string().datetime().optional(),
  agreedFeeCents: z.number().int().nonnegative(),
  depositCents: z.number().int().nonnegative().optional(),
  feeDirection: z.enum(["I_RECEIVE", "I_PAY", "SPLIT", "NEGOTIABLE"]),
  shippingRequired: z.boolean().optional(),
  shippingAddress: z.string().optional(),
  guaranteeType: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

export const breedingBookingUpdateSchema = z.object({
  preferredMethod: z.string().optional(),
  preferredDateStart: z.string().datetime().optional().nullable(),
  preferredDateEnd: z.string().datetime().optional().nullable(),
  scheduledDate: z.string().datetime().optional().nullable(),
  shippingRequired: z.boolean().optional(),
  shippingAddress: z.string().optional().nullable(),
  agreedFeeCents: z.number().int().nonnegative().optional(),
  depositCents: z.number().int().nonnegative().optional(),
  guaranteeType: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  internalNotes: z.string().max(5000).optional().nullable(),
});

export const breedingBookingStatusSchema = z.object({
  status: z.enum([
    "INQUIRY", "PENDING_REQUIREMENTS", "APPROVED", "DEPOSIT_PAID",
    "CONFIRMED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED",
  ]),
  notes: z.string().max(5000).optional(),
  scheduledDate: z.string().datetime().optional(),
  breedingPlanId: z.number().int().positive().optional(),
  cancellationReason: z.string().max(2000).optional(),
});

export const breedingBookingRequirementsSchema = z.object({
  requirements: z.record(z.string(), z.unknown()),
});

// ── Public Inquiry ──────────────────────────────────────────────────────────

export const publicBreedingInquirySchema = z.object({
  inquirerName: z.string().min(1).max(200),
  inquirerEmail: z.string().email(),
  inquirerPhone: z.string().optional(),
  inquirerType: z.string().min(1).max(50),
  isBreeder: z.boolean().optional(),
  message: z.string().min(10).max(5000),
  interestedInMethod: z.string().optional(),
  referrerUrl: z.string().url().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

// ── Compatibility Check ─────────────────────────────────────────────────────

export const compatibilityCheckSchema = z.object({
  listingId: z.number().int().positive().optional(),
  breederProfileId: z.number().int().positive().optional(),
  seekerProfileId: z.number().int().positive().optional(),
});

// ── Intent + Fee Direction validation ───────────────────────────────────────

export function validateIntentFeeDirection(intent: string, feeDirection?: string | null): string | null {
  if (intent === "OFFERING" && feeDirection === "I_PAY") {
    return 'Offering listings cannot have feeDirection "I_PAY"';
  }
  if (intent === "SEEKING" && feeDirection === "I_RECEIVE") {
    return 'Seeking listings cannot have feeDirection "I_RECEIVE"';
  }
  return null;
}
