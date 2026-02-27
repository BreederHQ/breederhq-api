/**
 * Archive Validation Service
 *
 * Validates whether a breeding plan is ready for archival.
 * Returns blockers (must fix) and warnings (advisory).
 *
 * Key Design Decisions:
 * - Deceased offspring (lifeState = DECEASED) are excluded from placement validation
 * - Health records are advisory only (never block)
 * - Validation rules can be customized per organization via TenantSetting
 */

import type { PrismaClient } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ArchiveValidationCode =
  | "UNPLACED_OFFSPRING"
  | "UNDER_EVALUATION_OFFSPRING"
  | "UNPAID_INVOICE"
  | "OUTSTANDING_BALANCE"
  | "UNSIGNED_CONTRACT"
  | "INCOMPLETE_PAPERWORK_STATE"
  | "PENDING_WAITLIST_ENTRIES"
  | "MISSING_PLACEMENT_COMPLETED_DATE"
  | "OFFSPRING_COUNT_MISMATCH"
  | "OPEN_TASKS";

export type ValidationSeverity = "blocker" | "warning" | "disabled";

export interface ValidationCheckResult {
  code: ArchiveValidationCode;
  category: "offspring" | "financial" | "contracts" | "waitlist" | "group" | "tasks";
  severity: ValidationSeverity;
  passed: boolean;
  message: string;
  entities?: Array<{
    type: "invoice" | "contract" | "offspring" | "task" | "waitlist_entry";
    id: number;
    label: string;
    contactName?: string;
    amount?: number;
  }>;
}

export interface HealthRecordsAdvisory {
  show: boolean;
  offspringMissingRecords: Array<{
    offspringId: number;
    name: string | null;
    collarColorName: string | null;
    collarColorHex: string | null;
    sex: string | null;
    healthRecordCount: number;
  }>;
  totalHealthRecords: number;
}

export interface ArchiveReadinessResponse {
  planId: number;
  planName: string;
  canArchive: boolean;
  summary: {
    blockers: number;
    warnings: number;
    passed: number;
  };
  checks: ValidationCheckResult[];
  healthRecordsAdvisory: HealthRecordsAdvisory;
  offspringSummary: {
    totalOffspring: number;
    livingOffspring: number;
    deceasedOffspring: number;
  } | null;
  configuredRules: Record<ArchiveValidationCode, ValidationSeverity>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Validation Rules
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_VALIDATION_RULES: Record<ArchiveValidationCode, ValidationSeverity> = {
  UNPLACED_OFFSPRING: "blocker",
  UNDER_EVALUATION_OFFSPRING: "warning",
  UNPAID_INVOICE: "blocker",
  OUTSTANDING_BALANCE: "blocker",
  UNSIGNED_CONTRACT: "blocker",
  INCOMPLETE_PAPERWORK_STATE: "warning",
  PENDING_WAITLIST_ENTRIES: "warning",
  MISSING_PLACEMENT_COMPLETED_DATE: "blocker",
  OFFSPRING_COUNT_MISMATCH: "warning",
  OPEN_TASKS: "warning",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get organization-specific validation rules from TenantSetting.
 * Falls back to defaults if no custom rules are configured.
 */
export async function getArchiveValidationRules(
  prisma: PrismaClient,
  tenantId: number
): Promise<Record<ArchiveValidationCode, ValidationSeverity>> {
  try {
    const setting = await prisma.tenantSetting.findUnique({
      where: {
        tenantId_namespace: {
          tenantId,
          namespace: "archive_validation",
        },
      },
    });

    if (setting?.data && typeof setting.data === "object") {
      const customRules = (setting.data as { rules?: Record<string, string> }).rules;
      if (customRules) {
        return {
          ...DEFAULT_VALIDATION_RULES,
          ...Object.fromEntries(
            Object.entries(customRules).filter(
              ([key, value]) =>
                key in DEFAULT_VALIDATION_RULES &&
                ["blocker", "warning", "disabled"].includes(value)
            )
          ),
        } as Record<ArchiveValidationCode, ValidationSeverity>;
      }
    }
  } catch {
    // If TenantSetting table doesn't exist or query fails, use defaults
  }

  return DEFAULT_VALIDATION_RULES;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Validation Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a breeding plan is ready for archival.
 * Runs all validation checks and returns detailed results.
 */
export async function checkArchiveReadiness(
  prisma: PrismaClient,
  tenantId: number,
  planId: number
): Promise<ArchiveReadinessResponse> {
  const rules = await getArchiveValidationRules(prisma, tenantId);
  const checks: ValidationCheckResult[] = [];

  // Fetch plan with all related data needed for validation
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: planId, tenantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      placementCompletedDateActual: true,
      countPlaced: true,
      Offspring: {
        where: { archivedAt: null },
        select: {
          id: true,
          name: true,
          sex: true,
          lifeState: true,
          placementState: true,
          keeperIntent: true,
          paperworkState: true,
          buyerPartyId: true,
          collarColorName: true,
          collarColorHex: true,
        },
      },
      Waitlist: {
        select: {
          id: true,
          status: true,
          clientPartyId: true,
        },
      },
      Invoice: {
        where: { deletedAt: null },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          balanceCents: true,
          clientPartyId: true,
        },
      },
      Contract: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });

  if (!plan) {
    throw new Error("Plan not found");
  }

  const hasOffspring = plan.Offspring && plan.Offspring.length > 0;

  // Fetch tasks associated with the plan's offspring
  const offspringIds = plan.Offspring?.map(o => o.id) ?? [];
  const planTasks = offspringIds.length > 0 ? await prisma.task.findMany({
    where: {
      tenantId,
      offspringId: { in: offspringIds },
    },
    select: {
      id: true,
      title: true,
      status: true,
    },
  }) : [];

  // Helper to add a check result based on configured severity
  const addCheck = (
    code: ArchiveValidationCode,
    category: ValidationCheckResult["category"],
    passed: boolean,
    message: string,
    entities?: ValidationCheckResult["entities"]
  ) => {
    const severity = rules[code];
    if (severity === "disabled") return;

    checks.push({
      code,
      category,
      severity,
      passed,
      message,
      entities,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Run Validation Checks
  // ─────────────────────────────────────────────────────────────────────────

  if (hasOffspring) {
    const offspring = plan.Offspring || [];
    const livingOffspring = offspring.filter((o) => o.lifeState !== "DECEASED");

    // 1. UNPLACED_OFFSPRING - All living offspring must be placed
    const unplacedOffspring = livingOffspring.filter(
      (o) => o.placementState === "UNASSIGNED"
    );
    addCheck(
      "UNPLACED_OFFSPRING",
      "offspring",
      unplacedOffspring.length === 0,
      unplacedOffspring.length === 0
        ? "All living offspring have been placed"
        : `${unplacedOffspring.length} living offspring have not been placed`,
      unplacedOffspring.length > 0
        ? unplacedOffspring.map((o) => ({
            type: "offspring" as const,
            id: o.id,
            label: o.name || `Offspring #${o.id}`,
          }))
        : undefined
    );

    // 2. UNDER_EVALUATION_OFFSPRING - No offspring under evaluation
    const underEvaluation = offspring.filter(
      (o) => o.keeperIntent === "UNDER_EVALUATION"
    );
    addCheck(
      "UNDER_EVALUATION_OFFSPRING",
      "offspring",
      underEvaluation.length === 0,
      underEvaluation.length === 0
        ? "No offspring are under evaluation"
        : `${underEvaluation.length} offspring are still under evaluation`,
      underEvaluation.length > 0
        ? underEvaluation.map((o) => ({
            type: "offspring" as const,
            id: o.id,
            label: o.name || `Offspring #${o.id}`,
          }))
        : undefined
    );

    // 3. INCOMPLETE_PAPERWORK_STATE - All offspring should have complete paperwork
    const incompletePaperwork = offspring.filter(
      (o) => o.paperworkState !== "COMPLETE" && o.lifeState !== "DECEASED"
    );
    addCheck(
      "INCOMPLETE_PAPERWORK_STATE",
      "contracts",
      incompletePaperwork.length === 0,
      incompletePaperwork.length === 0
        ? "All offspring have complete paperwork"
        : `${incompletePaperwork.length} offspring have incomplete paperwork`
    );

    // 4. MISSING_PLACEMENT_COMPLETED_DATE - Plan must have placement completed date
    addCheck(
      "MISSING_PLACEMENT_COMPLETED_DATE",
      "group",
      !!plan.placementCompletedDateActual,
      plan.placementCompletedDateActual
        ? "Placement completed date is set"
        : "Placement completed date has not been set"
    );

    // 5. OFFSPRING_COUNT_MISMATCH - Recorded count should match actual
    const actualPlacedCount = livingOffspring.filter(
      (o) =>
        o.placementState === "PLACED" ||
        o.placementState === "TRANSFERRED"
    ).length;
    const keptCount = livingOffspring.filter(
      (o) => o.keeperIntent === "KEEP"
    ).length;
    const totalAccountedFor = actualPlacedCount + keptCount;

    const countMatches =
      plan.countPlaced === null ||
      plan.countPlaced === actualPlacedCount ||
      plan.countPlaced === totalAccountedFor;

    addCheck(
      "OFFSPRING_COUNT_MISMATCH",
      "group",
      countMatches,
      countMatches
        ? "Offspring counts are reconciled"
        : `Count mismatch: recorded ${plan.countPlaced} placed but found ${actualPlacedCount} placed (${keptCount} kept)`
    );
  } else {
    // No offspring - placement checks are not applicable
    addCheck(
      "UNPLACED_OFFSPRING",
      "offspring",
      true,
      "No offspring linked to this plan"
    );
    // MISSING_PLACEMENT_COMPLETED_DATE is not applicable when there are no offspring
  }

  // 6. PENDING_WAITLIST_ENTRIES - All waitlist entries must be resolved
  const terminalWaitlistStatuses = ["COMPLETED", "CANCELED", "REJECTED"];
  const pendingWaitlist = (plan.Waitlist || []).filter(
    (w) => !terminalWaitlistStatuses.includes(w.status)
  );
  addCheck(
    "PENDING_WAITLIST_ENTRIES",
    "waitlist",
    pendingWaitlist.length === 0,
    pendingWaitlist.length === 0
      ? "All waitlist entries are resolved"
      : `${pendingWaitlist.length} waitlist entries are still pending`,
    pendingWaitlist.length > 0
      ? pendingWaitlist.map((w) => ({
          type: "waitlist_entry" as const,
          id: w.id,
          label: `Waitlist #${w.id} (${w.status})`,
        }))
      : undefined
  );

  // 7. OPEN_TASKS - No open tasks
  const openTasks = planTasks.filter(
    (t) => t.status === "open" || t.status === "in_progress"
  );
  addCheck(
    "OPEN_TASKS",
    "tasks",
    openTasks.length === 0,
    openTasks.length === 0
      ? "All tasks are complete"
      : `${openTasks.length} tasks are still open or in progress`,
    openTasks.length > 0
      ? openTasks.map((t) => ({
          type: "task" as const,
          id: t.id,
          label: t.title || `Task #${t.id}`,
        }))
      : undefined
  );

  // 8. UNPAID_INVOICE - All invoices must be in terminal state
  const allInvoices = plan.Invoice || [];
  const terminalInvoiceStatuses = ["paid", "void", "cancelled", "refunded"];
  const unpaidInvoices = allInvoices.filter(
    (i) => !terminalInvoiceStatuses.includes(i.status)
  );
  addCheck(
    "UNPAID_INVOICE",
    "financial",
    unpaidInvoices.length === 0,
    unpaidInvoices.length === 0
      ? "All invoices are in a terminal state"
      : `${unpaidInvoices.length} invoices are not paid or resolved`,
    unpaidInvoices.length > 0
      ? unpaidInvoices.map((i) => ({
          type: "invoice" as const,
          id: i.id,
          label: i.invoiceNumber || `Invoice #${i.id}`,
          amount: Number(i.balanceCents) || 0,
        }))
      : undefined
  );

  // 9. OUTSTANDING_BALANCE - No invoices with outstanding balance
  const withBalance = allInvoices.filter(
    (i) => Number(i.balanceCents) > 0 && i.status !== "void" && i.status !== "cancelled"
  );
  addCheck(
    "OUTSTANDING_BALANCE",
    "financial",
    withBalance.length === 0,
    withBalance.length === 0
      ? "No outstanding balances"
      : `${withBalance.length} invoices have outstanding balances`,
    withBalance.length > 0
      ? withBalance.map((i) => ({
          type: "invoice" as const,
          id: i.id,
          label: i.invoiceNumber || `Invoice #${i.id}`,
          amount: Number(i.balanceCents),
        }))
      : undefined
  );

  // 10. UNSIGNED_CONTRACT - All contracts must be signed or voided
  const terminalContractStatuses = ["signed", "voided"];
  const unsignedContracts = (plan.Contract || []).filter(
    (c) => !terminalContractStatuses.includes(c.status)
  );
  addCheck(
    "UNSIGNED_CONTRACT",
    "contracts",
    unsignedContracts.length === 0,
    unsignedContracts.length === 0
      ? "All contracts are signed or voided"
      : `${unsignedContracts.length} contracts are not signed`,
    unsignedContracts.length > 0
      ? unsignedContracts.map((c) => ({
          type: "contract" as const,
          id: c.id,
          label: c.title || `Contract #${c.id}`,
        }))
      : undefined
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Health Records Advisory (non-blocking)
  // ─────────────────────────────────────────────────────────────────────────

  let healthRecordsAdvisory: HealthRecordsAdvisory = {
    show: false,
    offspringMissingRecords: [],
    totalHealthRecords: 0,
  };

  if (hasOffspring) {
    const offspringIds = plan.Offspring.map((o) => o.id);

    // Get health record counts per offspring
    const healthCounts = await prisma.healthEvent.groupBy({
      by: ["offspringId"],
      where: {
        tenantId,
        offspringId: { in: offspringIds },
      },
      _count: { id: true },
    });

    const countMap = new Map(
      healthCounts.map((h) => [h.offspringId, h._count.id])
    );

    const livingOffspring = plan.Offspring.filter(
      (o) => o.lifeState !== "DECEASED"
    );
    const missingRecords = livingOffspring
      .filter((o) => !countMap.has(o.id) || countMap.get(o.id) === 0)
      .map((o) => ({
        offspringId: o.id,
        name: o.name,
        collarColorName: o.collarColorName,
        collarColorHex: o.collarColorHex,
        sex: o.sex,
        healthRecordCount: 0,
      }));

    const totalHealthRecords = healthCounts.reduce(
      (sum, h) => sum + h._count.id,
      0
    );

    healthRecordsAdvisory = {
      show: missingRecords.length > 0,
      offspringMissingRecords: missingRecords,
      totalHealthRecords,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build Response
  // ─────────────────────────────────────────────────────────────────────────

  const blockers = checks.filter((c) => !c.passed && c.severity === "blocker");
  const warnings = checks.filter((c) => !c.passed && c.severity === "warning");
  const passed = checks.filter((c) => c.passed);

  return {
    planId,
    planName: plan.name,
    canArchive: blockers.length === 0,
    summary: {
      blockers: blockers.length,
      warnings: warnings.length,
      passed: passed.length,
    },
    checks,
    healthRecordsAdvisory,
    offspringSummary: hasOffspring
      ? {
          totalOffspring: plan.Offspring.length,
          livingOffspring: plan.Offspring.filter(
            (o) => o.lifeState !== "DECEASED"
          ).length,
          deceasedOffspring: plan.Offspring.filter(
            (o) => o.lifeState === "DECEASED"
          ).length,
        }
      : null,
    configuredRules: rules,
  };
}
