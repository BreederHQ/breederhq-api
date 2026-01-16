// src/services/contracts/contract-template-renderer.ts
/**
 * Contract Template Renderer
 *
 * Renders contract templates with merge field substitution.
 * Supports mustache-style {{field.key}} syntax and conditional sections.
 */

import {
  CONTRACT_MERGE_FIELDS,
  type ContractRenderContext,
  type MergeFieldDefinition,
} from "./types.js";

// ────────────────────────────────────────────────────────────────────────────
// Rendering
// ────────────────────────────────────────────────────────────────────────────

/**
 * Render contract template with merge field substitution
 */
export function renderContractTemplate(
  templateHtml: string,
  context: ContractRenderContext
): { html: string; missingFields: string[] } {
  const missingFields: string[] = [];

  // First, process conditionals
  let html = processConditionals(templateHtml, context);

  // Then substitute merge fields
  html = html.replace(/\{\{([^#/][^}]*)\}\}/g, (match, fieldPath) => {
    const path = fieldPath.trim();
    const value = getNestedValue(context, path);

    if (value === undefined || value === null || value === "") {
      const fieldDef = CONTRACT_MERGE_FIELDS.find((f) => f.key === path);
      if (fieldDef?.required) {
        missingFields.push(path);
      }
      return ""; // Remove placeholder if no value
    }

    // Format based on type
    const fieldDef = CONTRACT_MERGE_FIELDS.find((f) => f.key === path);
    if (fieldDef?.type === "currency") {
      return formatCurrency(value);
    }
    if (fieldDef?.type === "date") {
      return formatDate(value);
    }

    return escapeHtml(String(value));
  });

  return { html, missingFields };
}

/**
 * Process conditional sections: {{#if field}}...{{/if}}
 */
function processConditionals(html: string, context: ContractRenderContext): string {
  // Simple if/endif processing
  const conditionalRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

  return html.replace(conditionalRegex, (match, condition, content) => {
    const value = getNestedValue(context, condition.trim());
    if (value && value !== "" && value !== "0" && value !== "$0.00") {
      return content;
    }
    return "";
  });
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

// ────────────────────────────────────────────────────────────────────────────
// Formatting
// ────────────────────────────────────────────────────────────────────────────

function formatCurrency(value: string | number): string {
  // If already formatted, return as-is
  if (typeof value === "string" && value.startsWith("$")) {
    return value;
  }

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

function formatDate(value: string | Date): string {
  // If already a formatted string (not ISO), return as-is
  if (typeof value === "string" && !value.includes("T") && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return value;
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => escapeMap[char]);
}

// ────────────────────────────────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Validate template content for valid merge fields
 */
export function validateContractTemplate(bodyHtml: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  foundFields: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const foundFields: string[] = [];

  // Extract all merge field references from HTML (excluding conditionals)
  const fieldRegex = /\{\{([^#/}][^}]*)\}\}/g;
  let match;
  while ((match = fieldRegex.exec(bodyHtml)) !== null) {
    const fieldRef = match[1].trim();
    foundFields.push(fieldRef);

    const isValidField = CONTRACT_MERGE_FIELDS.some((f) => f.key === fieldRef);
    if (!isValidField) {
      errors.push(`Unknown merge field: {{${fieldRef}}}`);
    }
  }

  // Check for conditional syntax
  const conditionalRegex = /\{\{#if\s+([^}]+)\}\}/g;
  while ((match = conditionalRegex.exec(bodyHtml)) !== null) {
    const conditionField = match[1].trim();
    const isValidField = CONTRACT_MERGE_FIELDS.some((f) => f.key === conditionField);
    if (!isValidField) {
      warnings.push(`Conditional references unknown field: {{#if ${conditionField}}}`);
    }
  }

  // Check for unclosed conditionals
  const ifCount = (bodyHtml.match(/\{\{#if\s+[^}]+\}\}/g) || []).length;
  const endifCount = (bodyHtml.match(/\{\{\/if\}\}/g) || []).length;
  if (ifCount !== endifCount) {
    errors.push(`Mismatched conditionals: ${ifCount} {{#if}} but ${endifCount} {{/if}}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    foundFields: [...new Set(foundFields)],
  };
}

/**
 * Get list of required fields that are missing from context
 */
export function getMissingRequiredFields(
  foundFields: string[],
  context: ContractRenderContext
): string[] {
  const missing: string[] = [];

  for (const fieldKey of foundFields) {
    const fieldDef = CONTRACT_MERGE_FIELDS.find((f) => f.key === fieldKey);
    if (fieldDef?.required) {
      const value = getNestedValue(context, fieldKey);
      if (value === undefined || value === null || value === "") {
        missing.push(fieldKey);
      }
    }
  }

  return missing;
}

// ────────────────────────────────────────────────────────────────────────────
// Preview
// ────────────────────────────────────────────────────────────────────────────

/**
 * Generate sample context for template preview
 */
export function getSampleRenderContext(): ContractRenderContext {
  return {
    breeder: {
      name: "Jane Smith",
      businessName: "Happy Paws Breeding",
      address: "123 Breeder Lane, Dogtown, CA 90210",
      phone: "(555) 123-4567",
      email: "jane@happypaws.com",
    },
    buyer: {
      name: "John Doe",
      address: "456 Buyer Street, Apt 2B, Petville, NY 10001",
      phone: "(555) 987-6543",
      email: "john.doe@email.com",
    },
    animal: {
      name: "Luna",
      breed: "Golden Retriever",
      dateOfBirth: "2024-01-15",
      registrationNumber: "AKC-DN12345678",
      microchipNumber: "985112345678901",
      color: "Golden",
      sex: "Female",
    },
    offspring: {
      name: "Sunny",
      collarColor: "Blue",
      sex: "Male",
      dateOfBirth: "2024-06-01",
    },
    transaction: {
      totalPrice: "2500",
      depositAmount: "500",
      balanceDue: "2000",
      paymentTerms: "Balance due at pickup",
      depositDate: "2024-05-15",
      pickupDate: "2024-08-01",
    },
    contract: {
      date: new Date().toISOString().split("T")[0],
      effectiveDate: new Date().toISOString().split("T")[0],
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
  };
}

/**
 * Preview template with sample data
 */
export function previewContractTemplate(templateHtml: string): {
  html: string;
  missingFields: string[];
  sampleData: ContractRenderContext;
} {
  const sampleData = getSampleRenderContext();
  const { html, missingFields } = renderContractTemplate(templateHtml, sampleData);
  return { html, missingFields, sampleData };
}
