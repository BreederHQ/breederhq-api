/**
 * Registry Client Factory
 *
 * Returns the appropriate registry client based on registry code.
 * Designed for easy extension when API partnerships are established.
 */

import type { IRegistryApiClient, RegistryCapabilities } from './types.js';
import { ManualRegistryClient, createManualClient } from './manual-client.js';

// Registry codes that have (or will have) dedicated API clients
// Currently all return manual clients, but structure is ready for real clients
const SUPPORTED_REGISTRIES = new Map<
  string,
  () => IRegistryApiClient
>([
  // Horse registries - Currently manual, ready for API integration
  ['AQHA', () => createManualClient('AQHA', 'American Quarter Horse Association')],
  ['JOCKEY_CLUB', () => createManualClient('JOCKEY_CLUB', 'The Jockey Club')],
  ['APHA', () => createManualClient('APHA', 'American Paint Horse Association')],
  ['AHA', () => createManualClient('AHA', 'Arabian Horse Association')],
  ['USEF', () => createManualClient('USEF', 'United States Equestrian Federation')],
  ['FEI', () => createManualClient('FEI', 'Fédération Equestre Internationale')],

  // Warmblood registries
  ['KWPN', () => createManualClient('KWPN', 'Dutch Warmblood')],
  ['HOLV', () => createManualClient('HOLV', 'Holsteiner')],
  ['GOV', () => createManualClient('GOV', 'German Oldenburg Verband')],
  ['WESTF', () => createManualClient('WESTF', 'Westfalen')],
  ['TRAKV', () => createManualClient('TRAKV', 'Trakehner')],

  // Dog registries
  ['AKC', () => createManualClient('AKC', 'American Kennel Club')],
  ['UKC', () => createManualClient('UKC', 'United Kennel Club')],
  ['CKC', () => createManualClient('CKC', 'Canadian Kennel Club')],

  // Cat registries
  ['CFA', () => createManualClient('CFA', 'Cat Fanciers Association')],
  ['TICA', () => createManualClient('TICA', 'The International Cat Association')],
]);

// Cache of created clients to avoid re-instantiation
const clientCache = new Map<string, IRegistryApiClient>();

/**
 * Get the appropriate registry client for a given registry code.
 *
 * @param registryCode Registry code (e.g., "AQHA", "JOCKEY_CLUB")
 * @param registryName Optional display name (used for unknown registries)
 * @returns The registry client (manual client if no API available)
 */
export function getRegistryClient(
  registryCode: string,
  registryName?: string
): IRegistryApiClient {
  const code = registryCode.toUpperCase();

  // Check cache first
  const cached = clientCache.get(code);
  if (cached) {
    return cached;
  }

  // Try to get known client
  const factory = SUPPORTED_REGISTRIES.get(code);
  let client: IRegistryApiClient;

  if (factory) {
    client = factory();
  } else {
    // Unknown registry - create generic manual client
    client = createManualClient(code, registryName ?? code);
  }

  // Cache and return
  clientCache.set(code, client);
  return client;
}

/**
 * Check if a registry has API support (even if not connected).
 * Currently returns false for all registries until partnerships established.
 */
export function hasApiSupport(registryCode: string): boolean {
  const client = getRegistryClient(registryCode);
  return client.hasApiSupport;
}

/**
 * Get capabilities for a registry without instantiating the client
 */
export function getRegistryCapabilities(
  registryCode: string
): RegistryCapabilities {
  const client = getRegistryClient(registryCode);
  return client.getCapabilities();
}

/**
 * List all registries that have dedicated clients (even if manual-only)
 */
export function getSupportedRegistryCodes(): string[] {
  return Array.from(SUPPORTED_REGISTRIES.keys());
}

/**
 * Clear the client cache (useful for testing)
 */
export function clearClientCache(): void {
  clientCache.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// Future API Client Registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a custom registry client.
 * Use this when adding new API integrations.
 *
 * Example:
 * ```typescript
 * // When AQHA partnership is established
 * registerRegistryClient('AQHA', () => new AQHAApiClient());
 * ```
 */
export function registerRegistryClient(
  registryCode: string,
  factory: () => IRegistryApiClient
): void {
  SUPPORTED_REGISTRIES.set(registryCode.toUpperCase(), factory);
  // Clear cache to pick up new client
  clientCache.delete(registryCode.toUpperCase());
}

/**
 * Remove a registry client (revert to manual)
 */
export function unregisterRegistryClient(registryCode: string): void {
  SUPPORTED_REGISTRIES.delete(registryCode.toUpperCase());
  clientCache.delete(registryCode.toUpperCase());
}
