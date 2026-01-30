/**
 * Registry Integration Services (P6 Sprint)
 *
 * Exports:
 * - Types for registry API clients
 * - Client factory for getting registry clients
 * - Registry service for verification and pedigree operations
 */

// Types
export type {
  IRegistryApiClient,
  RegistryCapabilities,
  RegistryCredentials,
  ConnectionResult,
  TokenRefreshResult,
  RegistryLookupResult,
  VerificationResult,
  PedigreeResult,
  PedigreeAncestor,
  SyncLogEntry,
  SyncAction,
  SyncStatus,
  PedigreePosition,
  VerificationConfidence,
  VerificationMethod,
} from './types.js';

export {
  PEDIGREE_POSITIONS,
  getGenerationFromPosition,
  getPositionLabel,
} from './types.js';

// Client Factory
export {
  getRegistryClient,
  hasApiSupport,
  getRegistryCapabilities,
  getSupportedRegistryCodes,
  registerRegistryClient,
  unregisterRegistryClient,
  clearClientCache,
} from './client-factory.js';

// Manual Client (for direct use if needed)
export { ManualRegistryClient, createManualClient } from './manual-client.js';

// Registry Service (main service for routes to use)
export {
  // Verification
  verifyRegistrationViaApi,
  recordManualVerification,
  getVerificationStatus,

  // Pedigree
  importPedigreeFromRegistry,
  addManualPedigreeEntry,
  getPedigree,

  // Lookup
  lookupInRegistry,

  // Sync Logs
  getSyncLogs,

  // Registry Info
  getRegistryCapabilitiesById,
} from './registry-service.js';

export type {
  VerifyRegistrationParams,
  ManualVerificationParams,
  ImportPedigreeParams,
  LookupParams,
} from './registry-service.js';
