/**
 * Manual Registry Client
 *
 * Fallback client for registries without API access.
 * Provides manual verification workflow and registration number validation.
 */

import type {
  IRegistryApiClient,
  RegistryCapabilities,
  RegistryCredentials,
  ConnectionResult,
  RegistryLookupResult,
  VerificationResult,
  PedigreeResult,
} from './types.js';

/**
 * Registration number patterns for common registries.
 * Used for basic format validation when no API is available.
 */
const REGISTRATION_PATTERNS: Record<string, RegExp> = {
  // AQHA: 7 digits
  AQHA: /^\d{7}$/,

  // Jockey Club: letter + 5-6 digits (e.g., "A12345" or "AB123456")
  JOCKEY_CLUB: /^[A-Z]{1,2}\d{5,6}$/i,

  // APHA: Similar to AQHA
  APHA: /^\d{6,7}$/,

  // AHA: 6-9 digits
  AHA: /^\d{6,9}$/,

  // USEF: Alphanumeric, 8-12 characters
  USEF: /^[A-Z0-9]{8,12}$/i,

  // Default: Any alphanumeric 4-20 characters
  DEFAULT: /^[A-Z0-9-]{4,20}$/i,
};

/**
 * ManualRegistryClient - Fallback for registries without APIs
 *
 * This client:
 * - Validates registration number format
 * - Returns "manual verification required" for all verification requests
 * - Does not support lookup or pedigree fetching
 */
export class ManualRegistryClient implements IRegistryApiClient {
  public readonly registryCode: string;
  public readonly registryName: string;
  public readonly hasApiSupport = false;

  private readonly pattern: RegExp;

  constructor(registryCode: string, registryName?: string) {
    this.registryCode = registryCode;
    this.registryName = registryName ?? registryCode;
    this.pattern =
      REGISTRATION_PATTERNS[registryCode] ?? REGISTRATION_PATTERNS.DEFAULT;
  }

  async isApiAvailable(): Promise<boolean> {
    // Manual client never has API available
    return false;
  }

  async lookupByRegistration(): Promise<RegistryLookupResult | null> {
    // Cannot look up without API
    return null;
  }

  async verifyRegistration(
    identifier: string,
    animalName?: string
  ): Promise<VerificationResult> {
    // Validate format
    const formatValid = this.pattern.test(identifier);

    if (!formatValid) {
      return {
        verified: false,
        confidence: 'NONE',
        method: 'MANUAL',
        identifierValid: false,
        errorMessage: `Registration number format invalid for ${this.registryName}. Expected format: ${this.getFormatDescription()}`,
      };
    }

    // Format is valid but we can't verify against registry
    return {
      verified: false,
      confidence: 'LOW',
      method: 'MANUAL',
      identifierValid: true,
      nameMatch: animalName ? undefined : undefined, // Can't verify name
      errorMessage:
        'Manual verification required. Please upload registration document for verification.',
    };
  }

  async getPedigree(): Promise<PedigreeResult | null> {
    // Cannot fetch pedigree without API
    return null;
  }

  getCapabilities(): RegistryCapabilities {
    return {
      lookup: false,
      verification: false, // Format validation only, not true verification
      pedigree: false,
      maxPedigreeGenerations: 0,
      oauth: false,
      apiKey: false,
      manualOnly: true,
      notes: `${this.registryName} does not have a public API. Manual document verification is required.`,
    };
  }

  /**
   * Get a human-readable description of the expected format
   */
  private getFormatDescription(): string {
    switch (this.registryCode) {
      case 'AQHA':
        return '7 digits (e.g., 5849202)';
      case 'JOCKEY_CLUB':
        return '1-2 letters followed by 5-6 digits (e.g., A12345)';
      case 'APHA':
        return '6-7 digits';
      case 'AHA':
        return '6-9 digits';
      case 'USEF':
        return '8-12 alphanumeric characters';
      default:
        return '4-20 alphanumeric characters';
    }
  }

  // Connection methods not applicable for manual client
  connect?(
    _tenantId: number,
    _credentials: RegistryCredentials
  ): Promise<ConnectionResult> {
    throw new Error(
      `${this.registryName} does not support API connections. Use manual verification.`
    );
  }

  disconnect?(_tenantId: number): Promise<void> {
    throw new Error(
      `${this.registryName} does not support API connections.`
    );
  }
}

/**
 * Create a manual client for a given registry code
 */
export function createManualClient(
  registryCode: string,
  registryName?: string
): ManualRegistryClient {
  return new ManualRegistryClient(registryCode, registryName);
}
