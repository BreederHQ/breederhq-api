/**
 * Anchor Validation Service
 *
 * Validates that invoices and expenses have exactly one valid anchor.
 * Anchors tie financial records to business entities like animals, breeding plans, etc.
 *
 * Supported anchors:
 * - offspringId
 * - animalId
 * - breedingPlanId
 * - serviceCode (for general services - not an FK)
 */

export interface InvoiceAnchors {
  offspringId?: number | null;
  animalId?: number | null;
  breedingPlanId?: number | null;
  serviceCode?: string | null;
}

export interface ExpenseAnchors {
  breedingPlanId?: number | null;
  animalId?: number | null;
}

/**
 * Validate that invoice has exactly one anchor.
 * Throws error if zero or multiple anchors are provided.
 *
 * @param anchors - The anchor fields from the request
 * @throws Error if validation fails
 */
export function validateInvoiceAnchors(anchors: InvoiceAnchors): void {
  const anchorKeys: (keyof InvoiceAnchors)[] = [
    "offspringId",
    "animalId",
    "breedingPlanId",
    "serviceCode",
  ];

  const providedAnchors = anchorKeys.filter(
    (key) => anchors[key] !== null && anchors[key] !== undefined
  );

  if (providedAnchors.length === 0) {
    throw new Error(
      "Invoice must have exactly one anchor: offspringId, animalId, breedingPlanId, or serviceCode"
    );
  }

  if (providedAnchors.length > 1) {
    throw new Error(
      `Invoice can only have one anchor, but got: ${providedAnchors.join(", ")}`
    );
  }
}

/**
 * Validate that expense has at most one anchor.
 * Expenses can be general (no anchor) or tied to one entity.
 *
 * @param anchors - The anchor fields from the request
 * @throws Error if validation fails
 */
export function validateExpenseAnchors(anchors: ExpenseAnchors): void {
  const anchorKeys: (keyof ExpenseAnchors)[] = [
    "breedingPlanId",
    "animalId",
  ];

  const providedAnchors = anchorKeys.filter(
    (key) => anchors[key] !== null && anchors[key] !== undefined
  );

  if (providedAnchors.length > 1) {
    throw new Error(
      `Expense can only have one anchor, but got: ${providedAnchors.join(", ")}`
    );
  }
}

/**
 * Determine the finance scope based on which anchor is provided.
 * Used for the Invoice.scope field.
 *
 * @param anchors - The anchor fields
 * @returns The scope string
 */
export function determineInvoiceScope(anchors: InvoiceAnchors): string {
  if (anchors.offspringId) return "offspring";
  if (anchors.animalId) return "contact"; // Animal sales use contact scope
  if (anchors.breedingPlanId) return "contact"; // Breeding services use contact scope
  if (anchors.serviceCode) return "general";
  return "general";
}
