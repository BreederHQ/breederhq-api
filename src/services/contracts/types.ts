// src/services/contracts/types.ts
/**
 * Contract E-Signature System - Type Definitions
 *
 * Core types for contract templates, merge fields, rendering, and signatures.
 */

// ────────────────────────────────────────────────────────────────────────────
// Merge Field System
// ────────────────────────────────────────────────────────────────────────────

export type MergeFieldNamespace =
  | "breeder" // Tenant/business info
  | "buyer" // Contact/party info
  | "animal" // Animal details
  | "offspring" // Offspring details
  | "transaction" // Financial terms
  | "contract"; // Contract metadata

export type MergeFieldType = "string" | "date" | "currency" | "number";

export interface MergeFieldDefinition {
  key: string; // e.g., "breeder.name"
  label: string; // e.g., "Breeder Name"
  namespace: MergeFieldNamespace;
  type: MergeFieldType;
  required: boolean;
  description?: string;
}

/**
 * All available merge fields for contract templates
 */
export const CONTRACT_MERGE_FIELDS: MergeFieldDefinition[] = [
  // Breeder fields
  {
    key: "breeder.name",
    label: "Breeder Name",
    namespace: "breeder",
    type: "string",
    required: true,
    description: "Primary contact name of the breeder",
  },
  {
    key: "breeder.businessName",
    label: "Business Name",
    namespace: "breeder",
    type: "string",
    required: false,
    description: "Registered business or kennel name",
  },
  {
    key: "breeder.address",
    label: "Breeder Address",
    namespace: "breeder",
    type: "string",
    required: false,
    description: "Full mailing address",
  },
  {
    key: "breeder.phone",
    label: "Breeder Phone",
    namespace: "breeder",
    type: "string",
    required: false,
  },
  {
    key: "breeder.email",
    label: "Breeder Email",
    namespace: "breeder",
    type: "string",
    required: true,
  },

  // Buyer fields
  {
    key: "buyer.name",
    label: "Buyer Name",
    namespace: "buyer",
    type: "string",
    required: true,
    description: "Full legal name of the buyer",
  },
  {
    key: "buyer.address",
    label: "Buyer Address",
    namespace: "buyer",
    type: "string",
    required: false,
    description: "Full mailing address",
  },
  {
    key: "buyer.phone",
    label: "Buyer Phone",
    namespace: "buyer",
    type: "string",
    required: false,
  },
  {
    key: "buyer.email",
    label: "Buyer Email",
    namespace: "buyer",
    type: "string",
    required: true,
  },

  // Animal fields
  {
    key: "animal.name",
    label: "Animal Name",
    namespace: "animal",
    type: "string",
    required: true,
    description: "Registered or call name of the animal",
  },
  {
    key: "animal.breed",
    label: "Breed",
    namespace: "animal",
    type: "string",
    required: true,
  },
  {
    key: "animal.dateOfBirth",
    label: "Date of Birth",
    namespace: "animal",
    type: "date",
    required: false,
  },
  {
    key: "animal.registrationNumber",
    label: "Registration #",
    namespace: "animal",
    type: "string",
    required: false,
    description: "AKC, CKC, or other registration number",
  },
  {
    key: "animal.microchipNumber",
    label: "Microchip #",
    namespace: "animal",
    type: "string",
    required: false,
  },
  {
    key: "animal.color",
    label: "Color/Markings",
    namespace: "animal",
    type: "string",
    required: false,
  },
  {
    key: "animal.sex",
    label: "Sex",
    namespace: "animal",
    type: "string",
    required: false,
    description: "Male, Female, or Intact/Neutered status",
  },

  // Offspring fields (for litter sales)
  {
    key: "offspring.name",
    label: "Offspring Name",
    namespace: "offspring",
    type: "string",
    required: false,
    description: "Name assigned to puppy/kitten",
  },
  {
    key: "offspring.collarColor",
    label: "Collar Color",
    namespace: "offspring",
    type: "string",
    required: false,
    description: "Identifying collar color",
  },
  {
    key: "offspring.sex",
    label: "Offspring Sex",
    namespace: "offspring",
    type: "string",
    required: false,
  },
  {
    key: "offspring.dateOfBirth",
    label: "Offspring DOB",
    namespace: "offspring",
    type: "date",
    required: false,
  },

  // Transaction fields
  {
    key: "transaction.totalPrice",
    label: "Total Price",
    namespace: "transaction",
    type: "currency",
    required: true,
    description: "Full purchase price",
  },
  {
    key: "transaction.depositAmount",
    label: "Deposit Amount",
    namespace: "transaction",
    type: "currency",
    required: false,
  },
  {
    key: "transaction.balanceDue",
    label: "Balance Due",
    namespace: "transaction",
    type: "currency",
    required: false,
    description: "Remaining amount after deposit",
  },
  {
    key: "transaction.paymentTerms",
    label: "Payment Terms",
    namespace: "transaction",
    type: "string",
    required: false,
    description: "Payment schedule or terms",
  },
  {
    key: "transaction.depositDate",
    label: "Deposit Date",
    namespace: "transaction",
    type: "date",
    required: false,
  },
  {
    key: "transaction.pickupDate",
    label: "Pickup Date",
    namespace: "transaction",
    type: "date",
    required: false,
    description: "Expected pickup/transfer date",
  },

  // Contract fields
  {
    key: "contract.date",
    label: "Contract Date",
    namespace: "contract",
    type: "date",
    required: true,
    description: "Date contract is issued",
  },
  {
    key: "contract.effectiveDate",
    label: "Effective Date",
    namespace: "contract",
    type: "date",
    required: false,
    description: "Date contract becomes effective (if different from issue date)",
  },
  {
    key: "contract.expirationDate",
    label: "Expiration Date",
    namespace: "contract",
    type: "date",
    required: false,
    description: "Date signature request expires",
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Render Context - Data passed to template renderer
// ────────────────────────────────────────────────────────────────────────────

export interface ContractRenderContext {
  breeder: {
    name: string;
    businessName?: string;
    address?: string;
    phone?: string;
    email: string;
  };
  buyer: {
    name: string;
    address?: string;
    phone?: string;
    email: string;
  };
  animal?: {
    name: string;
    breed: string;
    dateOfBirth?: string;
    registrationNumber?: string;
    microchipNumber?: string;
    color?: string;
    sex?: string;
  };
  offspring?: {
    name?: string;
    collarColor?: string;
    sex?: string;
    dateOfBirth?: string;
  };
  transaction: {
    totalPrice: string;
    depositAmount?: string;
    balanceDue?: string;
    paymentTerms?: string;
    depositDate?: string;
    pickupDate?: string;
  };
  contract: {
    date: string;
    effectiveDate?: string;
    expirationDate?: string;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Signature Types
// ────────────────────────────────────────────────────────────────────────────

export type SignatureType = "typed" | "drawn" | "uploaded";

export interface SignatureData {
  type: SignatureType;
  typedName?: string; // For typed signatures
  imageData?: string; // Base64 PNG for drawn signatures
  imageUrl?: string; // Storage URL for uploaded signatures
  capturedAt: string; // ISO timestamp
  capturedIp: string;
  capturedUserAgent: string;
}

export interface SignatureOptions {
  allowTyped: boolean;
  allowDrawn: boolean;
  allowUploaded: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Contract Party Roles
// ────────────────────────────────────────────────────────────────────────────

export type ContractPartyRole = "SELLER" | "BUYER" | "GUARANTOR" | "WITNESS" | "CO_OWNER";

// ────────────────────────────────────────────────────────────────────────────
// Conditional Sections (for template logic)
// ────────────────────────────────────────────────────────────────────────────

export interface ConditionalSection {
  id: string;
  condition: ConditionalExpression;
  htmlContent: string;
}

export interface ConditionalExpression {
  field: string; // e.g., "contract.type" or "transaction.depositAmount"
  operator: "equals" | "notEquals" | "exists" | "notExists" | "greaterThan" | "lessThan";
  value?: string | number | boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// API Input/Output Types
// ────────────────────────────────────────────────────────────────────────────

export interface CreateContractInput {
  templateId?: number;
  title: string;
  offspringId?: number;
  animalId?: number;
  waitlistEntryId?: number;
  invoiceId?: number;
  parties: Array<{
    role: ContractPartyRole;
    partyId?: number;
    email: string;
    name: string;
    signer: boolean;
    order?: number;
  }>;
  expiresInDays?: number; // Default 30
  reminderDays?: number[]; // e.g., [7, 3, 1]
  customContent?: string; // Optional HTML content override
}

export interface SendContractInput {
  contractId: number;
  message?: string; // Optional message to include in email
}

export interface SignContractInput {
  signatureType: SignatureType;
  signatureData: {
    typedName?: string;
    drawnImageBase64?: string;
    uploadedImageBase64?: string;
  };
  consent: boolean;
}

export interface DeclineContractInput {
  reason?: string;
}
