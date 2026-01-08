/**
 * Identity Matching Service
 *
 * Matches animals across tenants using multiple identifiers to build
 * a global pedigree graph. Uses fuzzy matching with confidence scoring.
 */

import { PrismaClient, IdentifierType, Species, Sex } from "@prisma/client";

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type MatchCandidate = {
  globalIdentityId: number;
  confidence: number;
  matchedIdentifiers: IdentifierType[];
  matchedFields: string[];
};

type AnimalIdentifiers = {
  microchip?: string | null;
  registrations?: Array<{ type: IdentifierType; value: string }>;
  dnaProfileId?: string | null;
  tattoo?: string | null;
  earTag?: string | null;
};

type AnimalForMatching = {
  id: number;
  tenantId: number;
  name: string;
  species: Species;
  sex: Sex;
  birthDate?: Date | null;
  breed?: string | null;
  damId?: number | null;
  sireId?: number | null;
  microchip?: string | null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIDENCE WEIGHTS
// ═══════════════════════════════════════════════════════════════════════════════

const IDENTIFIER_CONFIDENCE: Record<IdentifierType, number> = {
  // Unique identifiers - very high confidence
  MICROCHIP: 0.95,
  DNA_PROFILE: 0.99,

  // Registry numbers - high confidence (unique per registry)
  AKC: 0.95,
  UKC: 0.95,
  CKC: 0.95,
  KC: 0.95,
  FCI: 0.95,
  AQHA: 0.95,
  JOCKEY_CLUB: 0.95,
  USEF: 0.95,
  ADGA: 0.95,
  AGS: 0.95,
  ARBA: 0.95,
  TICA: 0.95,
  CFA: 0.95,

  // DNA test provider IDs
  EMBARK: 0.90,
  WISDOM_PANEL: 0.90,

  // Physical identifiers
  TATTOO: 0.85,
  EAR_TAG: 0.80,
  USDA_SCRAPIE: 0.90,

  // Generic
  OTHER: 0.50,
};

// Fuzzy match bonuses
const NAME_MATCH_BONUS = 0.15;
const DOB_MATCH_BONUS = 0.20;
const BREED_MATCH_BONUS = 0.10;
const PARENT_NAME_MATCH_BONUS = 0.25;

// Minimum confidence to auto-link
const AUTO_LINK_THRESHOLD = 0.90;
// Minimum confidence to suggest (requires manual confirmation)
const SUGGEST_THRESHOLD = 0.60;

// ═══════════════════════════════════════════════════════════════════════════════
// NORMALIZATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize an identifier value for comparison
 * Removes spaces, uppercases, strips common prefixes
 */
function normalizeIdentifier(type: IdentifierType, value: string): string {
  let normalized = value.trim().toUpperCase();

  // Remove common prefixes/suffixes
  normalized = normalized.replace(/^(REG|NO|NUM|#|:)\s*/i, "");

  // Microchips: remove spaces and dashes
  if (type === "MICROCHIP") {
    normalized = normalized.replace(/[\s-]/g, "");
  }

  // Registry numbers: normalize format
  if (["AKC", "UKC", "CKC", "KC"].includes(type)) {
    normalized = normalized.replace(/[\s-]/g, "");
  }

  return normalized;
}

/**
 * Normalize a name for fuzzy comparison
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['"`]/g, "") // Remove quotes
    .replace(/\s+/g, " ") // Normalize spaces
    .replace(/\b(ch|gch|gr ch|champion|grand champion)\b/gi, "") // Remove titles
    .replace(/\b(cgc|cd|cdx|ud|ra|re|rm|mx|mxj|mxb)\b/gi, "") // Remove titles
    .trim();
}

/**
 * Check if two names are similar (fuzzy match)
 */
function namesMatch(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  // Exact match after normalization
  if (n1 === n2) return true;

  // One contains the other (handles "Duke" vs "Champion Duke of Windsor")
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Levenshtein distance for typos (only for short names)
  if (n1.length < 20 && n2.length < 20) {
    const distance = levenshteinDistance(n1, n2);
    const maxLen = Math.max(n1.length, n2.length);
    if (distance / maxLen < 0.2) return true; // Allow 20% difference
  }

  return false;
}

/**
 * Simple Levenshtein distance implementation
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Check if two dates are the same (allowing for timezone differences)
 */
function datesMatch(d1: Date | null | undefined, d2: Date | null | undefined): boolean {
  if (!d1 || !d2) return false;

  // Compare year, month, day only
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE MATCHING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Find potential matches for an animal in the global identity registry
 */
export async function findGlobalMatches(
  animal: AnimalForMatching,
  identifiers: AnimalIdentifiers
): Promise<MatchCandidate[]> {
  const candidates: Map<number, MatchCandidate> = new Map();

  // 1. Search by high-confidence identifiers first
  const identifiersToSearch: Array<{ type: IdentifierType; value: string }> = [];

  if (identifiers.microchip) {
    identifiersToSearch.push({
      type: "MICROCHIP",
      value: normalizeIdentifier("MICROCHIP", identifiers.microchip),
    });
  }

  if (identifiers.dnaProfileId) {
    identifiersToSearch.push({
      type: "DNA_PROFILE",
      value: normalizeIdentifier("DNA_PROFILE", identifiers.dnaProfileId),
    });
  }

  if (identifiers.registrations) {
    for (const reg of identifiers.registrations) {
      identifiersToSearch.push({
        type: reg.type,
        value: normalizeIdentifier(reg.type, reg.value),
      });
    }
  }

  // Search for matches
  for (const { type, value } of identifiersToSearch) {
    const matches = await prisma.globalAnimalIdentifier.findMany({
      where: {
        type,
        value,
      },
      include: {
        identity: true,
      },
    });

    for (const match of matches) {
      // Verify species match
      if (match.identity.species !== animal.species) continue;

      const existing = candidates.get(match.identityId);
      const confidence = IDENTIFIER_CONFIDENCE[type];

      if (existing) {
        // Combine confidences (diminishing returns)
        existing.confidence = Math.min(0.99, existing.confidence + (1 - existing.confidence) * confidence);
        existing.matchedIdentifiers.push(type);
      } else {
        candidates.set(match.identityId, {
          globalIdentityId: match.identityId,
          confidence,
          matchedIdentifiers: [type],
          matchedFields: [],
        });
      }
    }
  }

  // 2. For each candidate, check fuzzy fields for bonus confidence
  for (const [identityId, candidate] of candidates) {
    const identity = await prisma.globalAnimalIdentity.findUnique({
      where: { id: identityId },
    });

    if (!identity) continue;

    // Name match bonus
    if (identity.name && animal.name && namesMatch(identity.name, animal.name)) {
      candidate.confidence = Math.min(0.99, candidate.confidence + NAME_MATCH_BONUS);
      candidate.matchedFields.push("name");
    }

    // DOB match bonus
    if (datesMatch(identity.birthDate, animal.birthDate)) {
      candidate.confidence = Math.min(0.99, candidate.confidence + DOB_MATCH_BONUS);
      candidate.matchedFields.push("birthDate");
    }

    // Sex must match (no bonus, just filter)
    if (identity.sex && animal.sex && identity.sex !== animal.sex) {
      candidate.confidence = 0; // Disqualify
    }
  }

  // 3. If no identifier matches, try fuzzy name + DOB + breed search
  if (candidates.size === 0 && animal.name && animal.birthDate) {
    const potentialMatches = await prisma.globalAnimalIdentity.findMany({
      where: {
        species: animal.species,
        sex: animal.sex,
        // Search within a date range for DOB
        birthDate: {
          gte: new Date(animal.birthDate.getTime() - 86400000), // -1 day
          lte: new Date(animal.birthDate.getTime() + 86400000), // +1 day
        },
      },
      take: 50, // Limit fuzzy search
    });

    for (const identity of potentialMatches) {
      if (identity.name && namesMatch(identity.name, animal.name)) {
        let confidence = NAME_MATCH_BONUS + DOB_MATCH_BONUS;
        const matchedFields = ["name", "birthDate"];

        // This is a fuzzy match, lower base confidence
        confidence *= 0.7;

        candidates.set(identity.id, {
          globalIdentityId: identity.id,
          confidence,
          matchedIdentifiers: [],
          matchedFields,
        });
      }
    }
  }

  // Filter out disqualified candidates and sort by confidence
  return Array.from(candidates.values())
    .filter(c => c.confidence >= SUGGEST_THRESHOLD)
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Create a new global identity for an animal
 */
export async function createGlobalIdentity(
  animal: AnimalForMatching,
  identifiers: AnimalIdentifiers,
  contributingTenantId: number
): Promise<number> {
  // Create the global identity
  const identity = await prisma.globalAnimalIdentity.create({
    data: {
      species: animal.species,
      sex: animal.sex,
      birthDate: animal.birthDate,
      name: animal.name,
    },
  });

  // Add identifiers
  const identifiersToCreate: Array<{
    identityId: number;
    type: IdentifierType;
    value: string;
    rawValue: string;
    sourceTenantId: number;
  }> = [];

  if (identifiers.microchip) {
    identifiersToCreate.push({
      identityId: identity.id,
      type: "MICROCHIP",
      value: normalizeIdentifier("MICROCHIP", identifiers.microchip),
      rawValue: identifiers.microchip,
      sourceTenantId: contributingTenantId,
    });
  }

  if (identifiers.dnaProfileId) {
    identifiersToCreate.push({
      identityId: identity.id,
      type: "DNA_PROFILE",
      value: normalizeIdentifier("DNA_PROFILE", identifiers.dnaProfileId),
      rawValue: identifiers.dnaProfileId,
      sourceTenantId: contributingTenantId,
    });
  }

  if (identifiers.registrations) {
    for (const reg of identifiers.registrations) {
      identifiersToCreate.push({
        identityId: identity.id,
        type: reg.type,
        value: normalizeIdentifier(reg.type, reg.value),
        rawValue: reg.value,
        sourceTenantId: contributingTenantId,
      });
    }
  }

  if (identifiersToCreate.length > 0) {
    await prisma.globalAnimalIdentifier.createMany({
      data: identifiersToCreate,
      skipDuplicates: true,
    });
  }

  return identity.id;
}

/**
 * Link a local animal to a global identity
 */
export async function linkAnimalToIdentity(
  animalId: number,
  globalIdentityId: number,
  matchedOn: string[],
  confidence: number,
  autoMatched: boolean,
  confirmedByUser?: string
): Promise<void> {
  await prisma.animalIdentityLink.upsert({
    where: { animalId },
    create: {
      animalId,
      identityId: globalIdentityId,
      confidence,
      matchedOn,
      autoMatched,
      confirmedAt: confirmedByUser ? new Date() : null,
      confirmedByUser,
    },
    update: {
      identityId: globalIdentityId,
      confidence,
      matchedOn,
      autoMatched,
      confirmedAt: confirmedByUser ? new Date() : null,
      confirmedByUser,
    },
  });
}

/**
 * Process an animal for global identity matching
 * Called when an animal is created or updated with identifiers
 */
export async function processAnimalForMatching(
  animal: AnimalForMatching,
  identifiers: AnimalIdentifiers
): Promise<{
  matched: boolean;
  globalIdentityId: number | null;
  confidence: number;
  autoLinked: boolean;
  candidates: MatchCandidate[];
}> {
  // Check if already linked
  const existingLink = await prisma.animalIdentityLink.findUnique({
    where: { animalId: animal.id },
  });

  if (existingLink) {
    return {
      matched: true,
      globalIdentityId: existingLink.identityId,
      confidence: existingLink.confidence,
      autoLinked: existingLink.autoMatched,
      candidates: [],
    };
  }

  // Find matches
  const candidates = await findGlobalMatches(animal, identifiers);

  if (candidates.length > 0) {
    const bestMatch = candidates[0];

    // Auto-link if confidence is high enough
    if (bestMatch.confidence >= AUTO_LINK_THRESHOLD) {
      await linkAnimalToIdentity(
        animal.id,
        bestMatch.globalIdentityId,
        [...bestMatch.matchedIdentifiers.map(String), ...bestMatch.matchedFields],
        bestMatch.confidence,
        true // autoMatched
      );

      return {
        matched: true,
        globalIdentityId: bestMatch.globalIdentityId,
        confidence: bestMatch.confidence,
        autoLinked: true,
        candidates,
      };
    }

    // Return candidates for manual review
    return {
      matched: false,
      globalIdentityId: null,
      confidence: bestMatch.confidence,
      autoLinked: false,
      candidates,
    };
  }

  // No matches found - create new global identity
  const newIdentityId = await createGlobalIdentity(animal, identifiers, animal.tenantId);

  await linkAnimalToIdentity(
    animal.id,
    newIdentityId,
    ["new_identity"],
    1.0,
    true
  );

  return {
    matched: true,
    globalIdentityId: newIdentityId,
    confidence: 1.0,
    autoLinked: true,
    candidates: [],
  };
}

/**
 * Get cross-tenant pedigree for an animal
 * Follows global identity links to build a pedigree that spans tenants
 */
export async function getCrossTenantPedigree(
  animalId: number,
  tenantId: number,
  generations: number = 5
): Promise<any> {
  // Get the animal's global identity link
  const link = await prisma.animalIdentityLink.findUnique({
    where: { animalId },
    include: {
      identity: true,
    },
  });

  if (!link) {
    // Fall back to local-only pedigree
    return null;
  }

  // Build pedigree from global identity
  return buildGlobalPedigreeTree(link.identityId, generations, tenantId);
}

/**
 * Recursively build global pedigree tree
 */
async function buildGlobalPedigreeTree(
  identityId: number,
  depth: number,
  viewingTenantId: number
): Promise<any> {
  if (depth <= 0) return null;

  const identity = await prisma.globalAnimalIdentity.findUnique({
    where: { id: identityId },
    include: {
      linkedAnimals: {
        include: {
          animal: {
            include: {
              privacySettings: true,
            },
          },
        },
      },
    },
  });

  if (!identity) return null;

  // Find the "best" local animal record to display
  // Prefer the viewing tenant's own record, then most complete record
  const localAnimals = identity.linkedAnimals.map(l => l.animal);
  const ownAnimal = localAnimals.find(a => a.tenantId === viewingTenantId);
  const bestAnimal = ownAnimal || localAnimals[0];

  // Check privacy settings
  const privacy = bestAnimal?.privacySettings;
  const isOwnAnimal = bestAnimal?.tenantId === viewingTenantId;

  // Build node with privacy-aware fields
  const node: any = {
    globalIdentityId: identity.id,
    species: identity.species,
    sex: identity.sex,
    // Privacy-controlled fields
    name: isOwnAnimal || privacy?.showName !== false ? identity.name : null,
    birthDate: isOwnAnimal || privacy?.showFullDob !== false
      ? identity.birthDate
      : (identity.birthDate ? new Date(identity.birthDate.getFullYear(), 0, 1) : null),
    isOwn: isOwnAnimal,
    isHidden: !isOwnAnimal && privacy?.showName === false,
  };

  // Recursively get parents
  if (identity.damId) {
    node.dam = await buildGlobalPedigreeTree(identity.damId, depth - 1, viewingTenantId);
  }
  if (identity.sireId) {
    node.sire = await buildGlobalPedigreeTree(identity.sireId, depth - 1, viewingTenantId);
  }

  return node;
}

export default {
  findGlobalMatches,
  createGlobalIdentity,
  linkAnimalToIdentity,
  processAnimalForMatching,
  getCrossTenantPedigree,
  AUTO_LINK_THRESHOLD,
  SUGGEST_THRESHOLD,
};
