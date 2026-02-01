// src/services/genetics/carrier-detection.ts
/**
 * Carrier Detection Service
 *
 * Detects carrier × carrier pairings that could produce affected/lethal offspring.
 * Used for proactive notifications when breeding plans are created/updated.
 *
 * Reference: apps/breeding/src/features/genetics-lab/genetics-calculator.ts
 */

import type { PrismaClient, Prisma } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface CarrierWarning {
  gene: string; // e.g., "O", "SCID"
  geneName: string; // e.g., "Overo Lethal White Syndrome"
  damStatus: string; // e.g., "N/O" (carrier)
  sireStatus: string; // e.g., "N/O" (carrier)
  riskPercentage: number; // 25 for carrier × carrier
  severity: "danger" | "warning";
  message: string;
  isLethal: boolean;
}

export interface CarrierDetectionResult {
  hasLethalRisk: boolean;
  hasWarnings: boolean;
  warnings: CarrierWarning[];
}

interface LocusData {
  locus: string;
  allele1?: string;
  allele2?: string;
  genotype?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Lethal Gene Definitions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Species-specific lethal and dangerous gene definitions
 * Used to detect carrier × carrier pairings that could produce affected offspring
 *
 * scorePenalty: Used in breeding compatibility scoring
 * isLethal: true if homozygous offspring will not survive
 */
export const LETHAL_GENES: Record<
  string,
  Array<{
    locus: string;
    dangerousAllele: string; // The allele that causes issues when homozygous
    geneName: string;
    message: string;
    severity: "danger" | "warning";
    scorePenalty: number;
    isLethal: boolean;
  }>
> = {
  HORSE: [
    {
      locus: "O",
      dangerousAllele: "O",
      geneName: "Overo Lethal White Syndrome (OLWS)",
      message: "LETHAL WHITE OVERO: Foals will not survive (dies within days)",
      severity: "danger",
      scorePenalty: 100,
      isLethal: true,
    },
    {
      locus: "GBED",
      dangerousAllele: "GBED",
      geneName: "Glycogen Branching Enzyme Deficiency",
      message: "GBED: Affected foals will not survive (dies within weeks)",
      severity: "danger",
      scorePenalty: 100,
      isLethal: true,
    },
    {
      locus: "SCID",
      dangerousAllele: "SCID",
      geneName: "Severe Combined Immunodeficiency",
      message: "SCID: Foals will have no immune system and will not survive (dies by 6 months)",
      severity: "danger",
      scorePenalty: 100,
      isLethal: true,
    },
    {
      locus: "LFS",
      dangerousAllele: "LFS",
      geneName: "Lavender Foal Syndrome",
      message: "LAVENDER FOAL SYNDROME: Affected foals will not survive",
      severity: "danger",
      scorePenalty: 100,
      isLethal: true,
    },
    {
      locus: "JEB",
      dangerousAllele: "JEB",
      geneName: "Junctional Epidermolysis Bullosa",
      message: "JEB: Foals born with fragile blistering skin will not survive",
      severity: "danger",
      scorePenalty: 100,
      isLethal: true,
    },
    {
      locus: "WFFS",
      dangerousAllele: "WFFS",
      geneName: "Warmblood Fragile Foal Syndrome",
      message: "WFFS: Affected foals will not survive (fragile skin syndrome)",
      severity: "danger",
      scorePenalty: 100,
      isLethal: true,
    },
    {
      locus: "LP",
      dangerousAllele: "LP",
      geneName: "Leopard Complex (Double LP)",
      message: "Double LP may have vision issues (Congenital Stationary Night Blindness)",
      severity: "warning",
      scorePenalty: 10,
      isLethal: false,
    },
    {
      locus: "HYPP",
      dangerousAllele: "H",
      geneName: "Hyperkalemic Periodic Paralysis",
      message: "HYPP: Risk of muscle tremors and paralysis episodes",
      severity: "warning",
      scorePenalty: 20,
      isLethal: false,
    },
  ],
  DOG: [
    {
      locus: "M",
      dangerousAllele: "M",
      geneName: "Double Merle",
      message: "DOUBLE MERLE: Can produce deaf and/or blind offspring",
      severity: "danger",
      scorePenalty: 50,
      isLethal: false,
    },
  ],
  CAT: [
    {
      locus: "Fd",
      dangerousAllele: "Fd",
      geneName: "Scottish Fold (Double Fold)",
      message: "DOUBLE FOLD: Causes severe osteochondrodysplasia (painful cartilage/bone disease)",
      severity: "danger",
      scorePenalty: 50,
      isLethal: false,
    },
  ],
  GOAT: [
    {
      locus: "P",
      dangerousAllele: "P",
      geneName: "Polled Gene",
      message: "POLLED x POLLED: Risk of intersex offspring",
      severity: "danger",
      scorePenalty: 30,
      isLethal: false,
    },
  ],
  RABBIT: [
    {
      locus: "En",
      dangerousAllele: "En",
      geneName: "English Spotting (Charlie)",
      message: "CHARLIE: May have digestive issues",
      severity: "warning",
      scorePenalty: 20,
      isLethal: false,
    },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// Detection Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extracts all loci from genetics data into a Map for easy lookup
 */
function buildLociMap(genetics: Record<string, unknown> | null): Map<string, LocusData> {
  const lociMap = new Map<string, LocusData>();
  if (!genetics) return lociMap;

  // Extract from all possible genetics categories
  const categories = ["coatColor", "coatType", "physicalTraits", "eyeColor", "health"];

  for (const category of categories) {
    const categoryData = genetics[category];
    if (Array.isArray(categoryData)) {
      for (const locus of categoryData) {
        if (locus && typeof locus === "object" && "locus" in locus) {
          lociMap.set(locus.locus as string, locus as LocusData);
        }
      }
    }
  }

  return lociMap;
}

/**
 * Checks if an animal has a specific allele at a given locus
 */
function hasAllele(locus: LocusData | undefined, allele: string): boolean {
  if (!locus) return false;
  return locus.allele1 === allele || locus.allele2 === allele;
}

/**
 * Determines the carrier status string for display
 */
function getCarrierStatus(locus: LocusData | undefined, dangerousAllele: string): string {
  if (!locus) return "Unknown";
  const has1 = locus.allele1 === dangerousAllele;
  const has2 = locus.allele2 === dangerousAllele;

  if (has1 && has2) return `${dangerousAllele}/${dangerousAllele} (Affected)`;
  if (has1 || has2) {
    const normalAllele = has1 ? locus.allele2 || "N" : locus.allele1 || "N";
    return `${normalAllele}/${dangerousAllele} (Carrier)`;
  }
  return `${locus.allele1 || "N"}/${locus.allele2 || "N"} (Clear)`;
}

/**
 * Also checks genotype string for carrier status (from health genetics)
 * Handles formats like "Carrier", "Clear", "Affected", "N/SCID", etc.
 */
function isCarrierByGenotype(locus: LocusData | undefined, dangerousAllele: string): boolean {
  if (!locus) return false;

  // First check alleles directly
  if (hasAllele(locus, dangerousAllele)) {
    // Make sure it's not homozygous affected
    const has1 = locus.allele1 === dangerousAllele;
    const has2 = locus.allele2 === dangerousAllele;
    if (has1 && has2) return false; // Affected, not carrier
    return true; // Heterozygous carrier
  }

  // Check genotype string for "carrier" keyword
  if (locus.genotype) {
    const gt = locus.genotype.toLowerCase();
    return gt.includes("carrier") || gt.includes("n/" + dangerousAllele.toLowerCase());
  }

  return false;
}

/**
 * Detects carrier × carrier pairings that could produce affected offspring
 *
 * @param damGenetics - Dam's genetics data (healthGeneticsData, coatColorData, etc.)
 * @param sireGenetics - Sire's genetics data
 * @param species - Animal species (HORSE, DOG, CAT, etc.)
 */
export function detectCarrierPairings(
  damGenetics: Record<string, unknown> | null,
  sireGenetics: Record<string, unknown> | null,
  species: string
): CarrierDetectionResult {
  const result: CarrierDetectionResult = {
    hasLethalRisk: false,
    hasWarnings: false,
    warnings: [],
  };

  // Get species-specific lethal genes
  const speciesUpper = species?.toUpperCase() || "HORSE";
  const lethalGenes = LETHAL_GENES[speciesUpper] || [];

  if (lethalGenes.length === 0) {
    return result;
  }

  // Build loci maps for both animals
  const damLoci = buildLociMap(damGenetics);
  const sireLoci = buildLociMap(sireGenetics);

  // Check each lethal gene
  for (const gene of lethalGenes) {
    const damLocus = damLoci.get(gene.locus);
    const sireLocus = sireLoci.get(gene.locus);

    // Both animals must have data for this locus to check
    if (!damLocus && !sireLocus) continue;

    // Check if both are carriers (heterozygous)
    const damIsCarrier = isCarrierByGenotype(damLocus, gene.dangerousAllele);
    const sireIsCarrier = isCarrierByGenotype(sireLocus, gene.dangerousAllele);

    if (damIsCarrier && sireIsCarrier) {
      const warning: CarrierWarning = {
        gene: gene.locus,
        geneName: gene.geneName,
        damStatus: getCarrierStatus(damLocus, gene.dangerousAllele),
        sireStatus: getCarrierStatus(sireLocus, gene.dangerousAllele),
        riskPercentage: 25, // Carrier × Carrier = 25% affected
        severity: gene.severity,
        message: gene.message,
        isLethal: gene.isLethal,
      };

      result.warnings.push(warning);
      result.hasWarnings = true;

      if (gene.isLethal) {
        result.hasLethalRisk = true;
      }
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Breeding Plan Integration
// ────────────────────────────────────────────────────────────────────────────

/**
 * Checks a breeding plan for carrier warnings and optionally creates a notification
 *
 * @param prisma - Prisma client or transaction
 * @param breedingPlanId - The breeding plan ID to check
 * @param tenantId - Tenant ID for notification creation
 * @param userId - User ID (plan creator) for notification targeting
 * @param createNotification - Whether to create a notification (default: true)
 */
export async function checkBreedingPlanCarrierRisk(
  prisma: PrismaClient | Prisma.TransactionClient,
  breedingPlanId: number,
  tenantId: number,
  userId?: string | null,
  createNotification = true
): Promise<CarrierDetectionResult & { notificationCreated: boolean }> {
  // 1. Load breeding plan with dam and sire
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: breedingPlanId, tenantId },
    select: {
      id: true,
      name: true,
      species: true,
      damId: true,
      sireId: true,
      dam: {
        select: {
          id: true,
          name: true,
          species: true,
          genetics: {
            select: {
              healthGeneticsData: true,
              coatColorData: true,
              physicalTraitsData: true,
            },
          },
        },
      },
      sire: {
        select: {
          id: true,
          name: true,
          species: true,
          genetics: {
            select: {
              healthGeneticsData: true,
              coatColorData: true,
              physicalTraitsData: true,
            },
          },
        },
      },
    },
  });

  const emptyResult: CarrierDetectionResult & { notificationCreated: boolean } = {
    hasLethalRisk: false,
    hasWarnings: false,
    warnings: [],
    notificationCreated: false,
  };

  if (!plan) {
    console.warn(`[carrier-detection] Plan ${breedingPlanId} not found for tenant ${tenantId}`);
    return emptyResult;
  }

  // Need both dam and sire to check for carrier pairings
  if (!plan.dam || !plan.sire) {
    return emptyResult;
  }

  // 2. Build combined genetics data for each animal
  const damGenetics = {
    health: plan.dam.genetics?.healthGeneticsData as unknown[],
    coatColor: plan.dam.genetics?.coatColorData as unknown[],
    physicalTraits: plan.dam.genetics?.physicalTraitsData as unknown[],
  };

  const sireGenetics = {
    health: plan.sire.genetics?.healthGeneticsData as unknown[],
    coatColor: plan.sire.genetics?.coatColorData as unknown[],
    physicalTraits: plan.sire.genetics?.physicalTraitsData as unknown[],
  };

  // 3. Detect carrier pairings
  const species = plan.species || plan.dam.species || "HORSE";
  const detection = detectCarrierPairings(damGenetics, sireGenetics, species);

  // 4. Create notification if lethal risk detected
  let notificationCreated = false;

  if (detection.hasLethalRisk && createNotification) {
    // Find the most severe warning for the notification
    const lethalWarning = detection.warnings.find((w) => w.isLethal) || detection.warnings[0];

    const idempotencyKey = `genetic_test_carrier_warning:BreedingPlan:${breedingPlanId}:${lethalWarning.gene}`;

    // Check if notification already exists
    const existing = await prisma.notification.findUnique({
      where: { idempotencyKey },
    });

    if (!existing) {
      await prisma.notification.create({
        data: {
          tenantId,
          userId: userId ?? null, // Null = notify all tenant users
          type: "genetic_test_carrier_warning",
          priority: "URGENT",
          title: "Lethal Pairing Risk Detected",
          message: `Both ${plan.dam.name} and ${plan.sire.name} are carriers of ${lethalWarning.geneName}. Breeding has a ${lethalWarning.riskPercentage}% chance of producing affected offspring.`,
          linkUrl: `/breeding/plans/${breedingPlanId}`,
          status: "UNREAD",
          idempotencyKey,
          metadata: {
            breedingPlanId,
            planName: plan.name,
            damId: plan.dam.id,
            damName: plan.dam.name,
            sireId: plan.sire.id,
            sireName: plan.sire.name,
            gene: lethalWarning.gene,
            geneName: lethalWarning.geneName,
            damStatus: lethalWarning.damStatus,
            sireStatus: lethalWarning.sireStatus,
            riskPercentage: lethalWarning.riskPercentage,
            isLethal: lethalWarning.isLethal,
            allWarnings: detection.warnings.map((w) => ({
              gene: w.gene,
              geneName: w.geneName,
              damStatus: w.damStatus,
              sireStatus: w.sireStatus,
              riskPercentage: w.riskPercentage,
              severity: w.severity,
              message: w.message,
              isLethal: w.isLethal,
            })),
          },
        },
      });
      notificationCreated = true;
      console.log(
        `[carrier-detection] Created URGENT notification for plan ${breedingPlanId}: ${lethalWarning.geneName} carrier × carrier`
      );
    }
  }

  return {
    ...detection,
    notificationCreated,
  };
}
