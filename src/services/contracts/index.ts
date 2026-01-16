// src/services/contracts/index.ts
/**
 * Contract E-Signature Services
 *
 * Barrel export for all contract-related services.
 */

// Types
export * from "./types.js";

// Template rendering
export {
  renderContractTemplate,
  validateContractTemplate,
  getSampleRenderContext,
  previewContractTemplate,
  getMissingRequiredFields,
} from "./contract-template-renderer.js";

// Core contract operations
export {
  createContract,
  buildRenderContext,
  renderAndStoreContractContent,
  sendContract,
  getSignatureOptionsForTenant,
  validateSignatureType,
  canPartySign,
  signContract,
  checkAllPartiesSigned,
  declineContract,
  voidContract,
  getContractWithDetails,
  listContracts,
} from "./contract-service.js";

// Signature event logging
export {
  getClientIp,
  getUserAgent,
  logSignatureEvent,
  logContractCreated,
  logContractSent,
  logContractViewed,
  logSignatureCaptured,
  logContractDeclined,
  logContractVoided,
  logContractExpired,
  getContractEvents,
} from "./signature-event-service.js";

// Contract scanning (for cron integration)
export {
  scanContractExpirations,
  scanExpiredContracts,
  createContractNotifications,
  processExpiredContracts,
  runContractScan,
} from "./contract-scanner.js";

// PDF generation
export {
  generateContractPdf,
  generateContractPdfBuffer,
  createAuditFooter,
  embedSignatureImage,
  processSignatureImage,
} from "./pdf-generator/index.js";
