// src/services/contracts/pdf-generator/index.ts
/**
 * PDF Generator Service
 *
 * Generates signed PDF documents from contracts with embedded signatures
 * and audit trail footer.
 */

export { generateContractPdf, generateContractPdfBuffer } from "./contract-pdf-builder.js";
export { createAuditFooter } from "./audit-footer.js";
export { embedSignatureImage, processSignatureImage } from "./signature-embedder.js";
