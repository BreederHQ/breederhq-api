// src/services/compliance-extraction.ts
/**
 * Compliance Extraction Service
 *
 * Extracts health guarantee requirements from signed contracts and creates
 * ComplianceRequirement records. Called after a HEALTH_GUARANTEE contract
 * is fully signed.
 */

import prisma from "../prisma.js";

/**
 * Known compliance type patterns to search for in contract content.
 * Maps keywords found in contract HTML to compliance requirement types.
 */
const COMPLIANCE_PATTERNS: Array<{
  type: string;
  keywords: RegExp;
  defaultDescription: string;
  defaultDueDaysFromPlacement?: number;
}> = [
  {
    type: "spay",
    keywords: /\b(spay|spaying)\b/i,
    defaultDescription: "Spay surgery required per health guarantee contract.",
    defaultDueDaysFromPlacement: 365,
  },
  {
    type: "neuter",
    keywords: /\b(neuter|neutering|castrat)/i,
    defaultDescription: "Neuter surgery required per health guarantee contract.",
    defaultDueDaysFromPlacement: 365,
  },
  {
    type: "annual_vet_check",
    keywords: /\b(annual\s+(vet|veterinar|check|exam)|yearly\s+(vet|check|exam))\b/i,
    defaultDescription: "Annual veterinary wellness exam required per health guarantee contract.",
    defaultDueDaysFromPlacement: 365,
  },
  {
    type: "vaccination_current",
    keywords: /\b(vaccin\w+\s+(current|up\s*-?\s*to\s*-?\s*date|schedule|protocol)|keep\s+vaccin\w+)\b/i,
    defaultDescription: "Keep vaccinations current per health guarantee contract.",
  },
  {
    type: "microchip_registration",
    keywords: /\b(microchip\s+(registr|transfer)|register\s+microchip)\b/i,
    defaultDescription: "Register microchip with your contact information per health guarantee contract.",
    defaultDueDaysFromPlacement: 30,
  },
  {
    type: "pet_insurance",
    keywords: /\b(pet\s+insurance|maintain\s+insurance|insurance\s+coverage)\b/i,
    defaultDescription: "Maintain pet insurance coverage per health guarantee contract.",
  },
  {
    type: "feeding_requirements",
    keywords: /\b(feed\w+\s+require|specific\s+diet|approved\s+food|recommended\s+food)\b/i,
    defaultDescription: "Follow feeding requirements per health guarantee contract.",
  },
  {
    type: "no_breeding",
    keywords: /\b(no\s+breed|not\s+breed|shall\s+not\s+be\s+bred|non-breeding|limited\s+registration)\b/i,
    defaultDescription: "Animal shall not be bred per health guarantee contract.",
  },
  {
    type: "return_policy",
    keywords: /\b(first\s+right\s+of\s+(return|refusal)|return\s+to\s+breeder|must\s+return)\b/i,
    defaultDescription: "First right of return to breeder per health guarantee contract.",
  },
];

/**
 * Extract compliance requirements from a signed HEALTH_GUARANTEE contract
 * and create ComplianceRequirement records for the associated offspring.
 *
 * @param contractId - The signed contract ID
 * @param tenantId   - Tenant context
 * @param offspringId - The offspring the contract covers
 */
export async function extractComplianceRequirements(
  contractId: number,
  tenantId: number,
  offspringId: number,
): Promise<void> {
  // 1. Load contract with template and rendered content
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      template: { select: { category: true, bodyHtml: true } },
      content: { select: { renderedHtml: true } },
    },
  });

  if (!contract) {
    console.warn(`[compliance-extraction] Contract ${contractId} not found`);
    return;
  }

  // 2. Only process HEALTH_GUARANTEE contracts
  if (contract.template?.category !== "HEALTH_GUARANTEE") {
    return;
  }

  // 3. Get the offspring placement date for deadline calculations
  const offspring = await prisma.offspring.findUnique({
    where: { id: offspringId },
    select: { bornAt: true, placedAt: true },
  });

  // Use placedAt or signedAt as the reference date for deadlines
  const referenceDate = (offspring?.placedAt ?? contract.signedAt ?? new Date());

  // 4. Parse the rendered contract HTML for compliance keywords
  const htmlContent = contract.content?.renderedHtml || contract.template?.bodyHtml || "";

  // Strip HTML tags for keyword matching
  const textContent = htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const requirementsToCreate: Array<{
    type: string;
    description: string;
    dueBy: Date | null;
  }> = [];

  for (const pattern of COMPLIANCE_PATTERNS) {
    if (pattern.keywords.test(textContent)) {
      let dueBy: Date | null = null;
      if (pattern.defaultDueDaysFromPlacement) {
        dueBy = new Date(referenceDate);
        dueBy.setDate(dueBy.getDate() + pattern.defaultDueDaysFromPlacement);
      }

      requirementsToCreate.push({
        type: pattern.type,
        description: pattern.defaultDescription,
        dueBy,
      });
    }
  }

  if (requirementsToCreate.length === 0) {
    console.info(
      `[compliance-extraction] No compliance requirements found in contract ${contractId}`,
    );
    return;
  }

  // 5. Avoid duplicates — check for existing requirements from this contract
  const existing = await prisma.complianceRequirement.findMany({
    where: { tenantId, offspringId, contractId },
    select: { type: true },
  });
  const existingTypes = new Set(existing.map((e) => e.type));

  const newRequirements = requirementsToCreate.filter(
    (r) => !existingTypes.has(r.type),
  );

  if (newRequirements.length === 0) {
    return;
  }

  // 6. Create ComplianceRequirement records
  await prisma.complianceRequirement.createMany({
    data: newRequirements.map((r) => ({
      tenantId,
      offspringId,
      contractId,
      type: r.type,
      description: r.description,
      dueBy: r.dueBy,
      reminderDays: [30, 7, 1],
      status: "pending",
      verifiedByBreeder: false,
      updatedAt: new Date(),
    })),
  });

  console.info(
    `[compliance-extraction] Created ${newRequirements.length} compliance requirement(s) for offspring ${offspringId} from contract ${contractId}: ${newRequirements.map((r) => r.type).join(", ")}`,
  );
}
