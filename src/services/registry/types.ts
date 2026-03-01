/**
 * Registry Integration Types (P6 Sprint)
 *
 * Type definitions for registry API clients, verification, and pedigree import.
 * Designed for extensibility as registry partnerships are established.
 */

// Local type definitions (mirrors Prisma enums - will be available after migration)
export type VerificationConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type VerificationMethod = 'API' | 'MANUAL' | 'DOCUMENT';

// ─────────────────────────────────────────────────────────────────────────────
// ET Registry Export Data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structured ET registry data for breed registration submission.
 * Covers requirements for AQHA, ADGA, and similar registries.
 */
export interface ETRegistryExportData {
  // AQHA requirements
  donorPermitNumber?: string;
  enrollmentFee?: string;
  // Common fields
  geneticDamName: string;
  geneticDamRegistration: string;
  geneticDamDNA?: string;
  sireName: string;
  sireRegistration: string;
  sireDNA?: string;
  recipientDamName: string;
  recipientDamRegistration?: string;
  flushDate: string;
  transferDate: string;
  embryoType: "FRESH" | "FROZEN";
  // ADGA requirements
  dnaVerificationStatus?: "PENDING" | "VERIFIED" | "FAILED";
  parentVerificationMethod?: "DNA_TYPING" | "BLOOD_TYPING" | "HAIR_SAMPLE";
  // Offspring
  offspring?: {
    name: string;
    sex?: string;
    dateOfBirth?: string;
    registrationNumber?: string;
  }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry Lookup Results
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standardized result from looking up a horse in a registry
 */
export interface RegistryLookupResult {
  registrationNumber: string;
  name: string;
  sex: 'M' | 'F' | 'G' | string; // Male, Female, Gelding
  color?: string;
  birthDate?: string; // ISO date string
  breed?: string;

  // Parent information (if available)
  sire?: {
    registrationNumber?: string;
    name: string;
  };
  dam?: {
    registrationNumber?: string;
    name: string;
  };

  // Raw response from registry (for debugging/audit)
  rawData: Record<string, unknown>;
}

/**
 * Result from verifying a registration against a registry
 */
export interface VerificationResult {
  verified: boolean;
  confidence: VerificationConfidence;
  method: VerificationMethod;

  // Match details
  nameMatch?: boolean;
  identifierValid?: boolean;

  // Registry data (if lookup succeeded)
  registryData?: RegistryLookupResult;

  // Error information
  errorMessage?: string;
  errorCode?: string;
}

/**
 * Ancestor entry in a pedigree tree
 */
export interface PedigreeAncestor {
  generation: number; // 1 = parents, 2 = grandparents, etc.
  position: string; // "sire", "dam", "sire_sire", "sire_dam", etc.
  registrationNumber?: string;
  name: string;
  color?: string;
  birthYear?: number;
  sex?: 'M' | 'F' | 'G';
}

/**
 * Result from fetching pedigree from a registry
 */
export interface PedigreeResult {
  subjectRegistrationNumber: string;
  subjectName: string;
  generations: number; // How many generations were returned
  ancestors: PedigreeAncestor[];
  rawData: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Credentials for connecting to a registry
 */
export interface RegistryCredentials {
  // OAuth flow
  authorizationCode?: string;
  redirectUri?: string;

  // API key flow
  apiKey?: string;
  apiSecret?: string;

  // Username/password flow (for legacy registries)
  username?: string;
  password?: string;
}

/**
 * Result from establishing a registry connection
 */
export interface ConnectionResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  errorMessage?: string;
  errorCode?: string;
}

/**
 * Result from refreshing an OAuth token
 */
export interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  errorMessage?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry Client Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interface for registry API clients.
 *
 * Each registry that supports API integration should implement this interface.
 * For registries without APIs, use ManualRegistryClient.
 */
export interface IRegistryApiClient {
  /** Registry code (e.g., "AQHA", "JOCKEY_CLUB") */
  readonly registryCode: string;

  /** Human-readable registry name */
  readonly registryName: string;

  /** Whether this registry has API support */
  readonly hasApiSupport: boolean;

  /**
   * Check if API is currently available for this registry.
   * May return false even for API-supported registries if:
   * - No connection is established for the tenant
   * - Token is expired
   * - Registry API is down
   */
  isApiAvailable(tenantId: number): Promise<boolean>;

  /**
   * Establish a connection to the registry.
   * Only applicable for registries with API support.
   */
  connect?(
    tenantId: number,
    credentials: RegistryCredentials
  ): Promise<ConnectionResult>;

  /**
   * Disconnect from the registry.
   * Clears stored tokens/credentials.
   */
  disconnect?(tenantId: number): Promise<void>;

  /**
   * Refresh an expired OAuth token.
   */
  refreshToken?(tenantId: number): Promise<TokenRefreshResult>;

  /**
   * Look up an animal by registration number.
   * Returns null if not found or API unavailable.
   */
  lookupByRegistration(
    identifier: string,
    tenantId?: number
  ): Promise<RegistryLookupResult | null>;

  /**
   * Verify a registration against the registry.
   * For registries without APIs, returns manual verification required.
   */
  verifyRegistration(
    identifier: string,
    animalName?: string,
    tenantId?: number
  ): Promise<VerificationResult>;

  /**
   * Fetch pedigree data from the registry.
   * Returns null if not available.
   *
   * @param identifier Registration number
   * @param generations Number of generations to fetch (default: 3)
   * @param tenantId Tenant ID for API access
   */
  getPedigree(
    identifier: string,
    generations?: number,
    tenantId?: number
  ): Promise<PedigreeResult | null>;

  /**
   * Get information about what API features are available.
   */
  getCapabilities(): RegistryCapabilities;
}

/**
 * Describes what features a registry client supports
 */
export interface RegistryCapabilities {
  /** Can look up animals by registration number */
  lookup: boolean;

  /** Can verify registration numbers */
  verification: boolean;

  /** Can fetch pedigree data */
  pedigree: boolean;

  /** Maximum generations available for pedigree */
  maxPedigreeGenerations: number;

  /** Supports OAuth connection */
  oauth: boolean;

  /** Supports API key authentication */
  apiKey: boolean;

  /** Requires manual verification (no API) */
  manualOnly: boolean;

  /** Notes about limitations or requirements */
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync Log Types
// ─────────────────────────────────────────────────────────────────────────────

export type SyncAction =
  | 'lookup'
  | 'verify'
  | 'import_pedigree'
  | 'refresh_token'
  | 'connect'
  | 'disconnect';

export type SyncStatus = 'success' | 'error' | 'pending';

export interface SyncLogEntry {
  tenantId: number;
  registryId: number;
  action: SyncAction;
  status: SyncStatus;
  animalId?: number;
  identifier?: string;
  requestData?: Record<string, unknown>;
  responseData?: Record<string, unknown>;
  errorMessage?: string;
  durationMs?: number;
  initiatedByUserId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Position Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valid pedigree positions up to 5 generations
 */
export const PEDIGREE_POSITIONS = {
  // Generation 1 (parents)
  sire: { generation: 1, label: 'Sire' },
  dam: { generation: 1, label: 'Dam' },

  // Generation 2 (grandparents)
  sire_sire: { generation: 2, label: 'Paternal Grandsire' },
  sire_dam: { generation: 2, label: 'Paternal Granddam' },
  dam_sire: { generation: 2, label: 'Maternal Grandsire' },
  dam_dam: { generation: 2, label: 'Maternal Granddam' },

  // Generation 3 (great-grandparents)
  sire_sire_sire: { generation: 3, label: 'Paternal GG-Sire' },
  sire_sire_dam: { generation: 3, label: 'Paternal GG-Dam' },
  sire_dam_sire: { generation: 3, label: 'Paternal GG-Sire (dam side)' },
  sire_dam_dam: { generation: 3, label: 'Paternal GG-Dam (dam side)' },
  dam_sire_sire: { generation: 3, label: 'Maternal GG-Sire' },
  dam_sire_dam: { generation: 3, label: 'Maternal GG-Dam' },
  dam_dam_sire: { generation: 3, label: 'Maternal GG-Sire (dam side)' },
  dam_dam_dam: { generation: 3, label: 'Maternal GG-Dam (dam side)' },

  // Generation 4 and 5 follow same pattern...
} as const;

export type PedigreePosition = keyof typeof PEDIGREE_POSITIONS;

/**
 * Get the generation number for a position string
 */
export function getGenerationFromPosition(position: string): number {
  // Count underscores + 1 = generation
  return (position.match(/_/g) || []).length + 1;
}

/**
 * Get human-readable label for a position
 */
export function getPositionLabel(position: string): string {
  const known = PEDIGREE_POSITIONS[position as PedigreePosition];
  if (known) return known.label;

  // Generate label for deep positions
  const parts = position.split('_');
  const gen = parts.length;
  const isPaternal = parts[0] === 'sire';
  const isMale = parts[parts.length - 1] === 'sire';

  return `Gen ${gen} ${isPaternal ? 'Paternal' : 'Maternal'} ${isMale ? 'Sire' : 'Dam'}`;
}
