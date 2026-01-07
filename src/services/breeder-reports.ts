// src/services/breeder-reports.ts
// Service for managing breeder reports from marketplace users

import type {
  BreederReportReason,
  BreederReportSeverity,
  BreederReportStatus,
  Prisma,
} from "@prisma/client";
import prisma from "../prisma.js";

// ============================================================================
// Types
// ============================================================================

export interface BreederReportSettings {
  flagThreshold: number; // Flag for review after N reports
  enableAutoFlag: boolean; // Auto-flag when threshold is reached
}

export interface BreederReportInfo {
  id: number;
  reporterUserIdMasked: string;
  breederTenantId: number;
  reason: BreederReportReason;
  severity: BreederReportSeverity;
  description: string | null;
  status: BreederReportStatus;
  adminNotes: string | null;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface BreederFlagInfo {
  id: number;
  breederTenantId: number;
  totalReports: number;
  pendingReports: number;
  lightReports: number;
  mediumReports: number;
  heavyReports: number;
  flaggedAt: Date | null;
  flagReason: string | null;
  warningIssuedAt: Date | null;
  warningNote: string | null;
  marketplaceSuspendedAt: Date | null;
  suspendedReason: string | null;
  updatedAt: Date;
  tenant: {
    id: number;
    name: string;
    primaryEmail: string | null;
  };
}

export interface SubmitReportParams {
  reporterUserId: string;
  breederTenantId?: number;
  breederTenantSlug?: string;
  reason: BreederReportReason;
  severity: BreederReportSeverity;
  description?: string;
}

// ============================================================================
// Constants
// ============================================================================

const BREEDER_REPORTS_NAMESPACE = "breeder-reports";

const DEFAULT_SETTINGS: BreederReportSettings = {
  flagThreshold: 3,
  enableAutoFlag: true,
};

// Rate limiting: prevent duplicate reports from same user within 24 hours
const DUPLICATE_REPORT_WINDOW_HOURS = 24;

// ============================================================================
// Settings Functions
// ============================================================================

/**
 * Get breeder report settings
 */
export async function getReportSettings(): Promise<BreederReportSettings> {
  const setting = await prisma.platformSetting.findUnique({
    where: { namespace: BREEDER_REPORTS_NAMESPACE },
  });

  if (!setting) {
    return DEFAULT_SETTINGS;
  }

  const data = setting.data as Partial<BreederReportSettings>;
  return {
    flagThreshold: data.flagThreshold ?? DEFAULT_SETTINGS.flagThreshold,
    enableAutoFlag: data.enableAutoFlag ?? DEFAULT_SETTINGS.enableAutoFlag,
  };
}

/**
 * Update breeder report settings
 */
export async function updateReportSettings(
  updates: Partial<BreederReportSettings>
): Promise<BreederReportSettings> {
  const current = await getReportSettings();
  const newSettings: BreederReportSettings = {
    ...current,
    ...updates,
  };

  await prisma.platformSetting.upsert({
    where: { namespace: BREEDER_REPORTS_NAMESPACE },
    create: {
      namespace: BREEDER_REPORTS_NAMESPACE,
      data: newSettings as unknown as Prisma.InputJsonValue,
    },
    update: {
      data: newSettings as unknown as Prisma.InputJsonValue,
    },
  });

  return newSettings;
}

// ============================================================================
// Flag Management Functions
// ============================================================================

/**
 * Get or create a BreederReportFlag for a tenant
 */
async function getOrCreateFlag(breederTenantId: number) {
  let flag = await prisma.breederReportFlag.findUnique({
    where: { breederTenantId },
  });

  if (!flag) {
    flag = await prisma.breederReportFlag.create({
      data: { breederTenantId },
    });
  }

  return flag;
}

/**
 * Update flag counters when a new report is submitted
 */
async function updateFlagOnReport(
  breederTenantId: number,
  severity: BreederReportSeverity
): Promise<void> {
  const flag = await getOrCreateFlag(breederTenantId);
  const settings = await getReportSettings();

  // Build update data
  const updateData: Record<string, unknown> = {
    totalReports: { increment: 1 },
    pendingReports: { increment: 1 },
  };

  // Increment severity-specific counter
  if (severity === "LIGHT") {
    updateData.lightReports = { increment: 1 };
  } else if (severity === "MEDIUM") {
    updateData.mediumReports = { increment: 1 };
  } else if (severity === "HEAVY") {
    updateData.heavyReports = { increment: 1 };
  }

  // Check if we need to auto-flag the breeder
  const newPendingReports = flag.pendingReports + 1;
  if (
    settings.enableAutoFlag &&
    !flag.flaggedAt &&
    newPendingReports >= settings.flagThreshold
  ) {
    updateData.flaggedAt = new Date();
    updateData.flagReason = `Breeder has ${newPendingReports} pending report(s)`;
  }

  await prisma.breederReportFlag.update({
    where: { id: flag.id },
    data: updateData,
  });
}

/**
 * Update flag counters when a report is reviewed/dismissed
 */
async function updateFlagOnReportReview(
  breederTenantId: number,
  _oldStatus: BreederReportStatus,
  newStatus: BreederReportStatus
): Promise<void> {
  const flag = await prisma.breederReportFlag.findUnique({
    where: { breederTenantId },
  });

  if (!flag) return;

  // Decrement pending count if was pending and now is reviewed/dismissed/actioned
  if (newStatus !== "PENDING") {
    await prisma.breederReportFlag.update({
      where: { id: flag.id },
      data: {
        pendingReports: { decrement: 1 },
      },
    });
  }
}

// ============================================================================
// Report Submission (Marketplace User Endpoint)
// ============================================================================

/**
 * Mask a user ID for privacy (show first 4 and last 4 chars)
 */
function maskUserId(userId: string): string {
  if (userId.length <= 8) {
    return "****";
  }
  return `${userId.slice(0, 4)}...${userId.slice(-4)}`;
}

/**
 * Submit a report against a breeder
 */
export async function submitReport(
  params: SubmitReportParams
): Promise<{ success: boolean; reportId: number }> {
  const {
    reporterUserId,
    breederTenantId,
    breederTenantSlug,
    reason,
    severity,
    description,
  } = params;

  // Resolve tenant ID from slug if needed
  let tenantId = breederTenantId;
  if (!tenantId && breederTenantSlug) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: breederTenantSlug },
      select: { id: true },
    });
    if (!tenant) {
      throw new Error("Breeder not found");
    }
    tenantId = tenant.id;
  }

  if (!tenantId) {
    throw new Error("Breeder identifier required");
  }

  // Check for duplicate report within window
  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - DUPLICATE_REPORT_WINDOW_HOURS);

  const existingReport = await prisma.breederReport.findFirst({
    where: {
      reporterUserId,
      breederTenantId: tenantId,
      createdAt: { gte: windowStart },
    },
  });

  if (existingReport) {
    throw new Error(
      "You have already submitted a report for this breeder recently"
    );
  }

  // Create the report
  const report = await prisma.breederReport.create({
    data: {
      breederTenantId: tenantId,
      reporterUserId,
      reason,
      severity,
      description: description || null,
      status: "PENDING",
    },
  });

  // Update flag aggregation
  await updateFlagOnReport(tenantId, severity);

  return { success: true, reportId: report.id };
}

// ============================================================================
// Admin Query Functions
// ============================================================================

export type FlaggedBreederStatus =
  | "all"
  | "flagged"
  | "warning"
  | "suspended";

export interface GetFlaggedBreedersParams {
  q?: string;
  status: FlaggedBreederStatus;
  page: number;
  limit: number;
}

/**
 * Get flagged breeders for admin review
 */
export async function getFlaggedBreeders(
  params: GetFlaggedBreedersParams
): Promise<{ items: BreederFlagInfo[]; total: number }> {
  const { q, status, page, limit } = params;
  const skip = (page - 1) * limit;

  // Build where clause based on status
  let where: Prisma.BreederReportFlagWhereInput = {};

  if (status === "flagged") {
    where = {
      flaggedAt: { not: null },
      marketplaceSuspendedAt: null,
    };
  } else if (status === "warning") {
    where = {
      warningIssuedAt: { not: null },
      marketplaceSuspendedAt: null,
    };
  } else if (status === "suspended") {
    where = {
      marketplaceSuspendedAt: { not: null },
    };
  } else {
    // "all" - get any flagged, warned, or suspended breeders, OR with pending reports
    where = {
      OR: [
        { flaggedAt: { not: null } },
        { warningIssuedAt: { not: null } },
        { marketplaceSuspendedAt: { not: null } },
        { pendingReports: { gt: 0 } },
      ],
    };
  }

  // Add search filter if provided
  if (q) {
    where = {
      AND: [
        where,
        {
          breederTenant: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { primaryEmail: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      ],
    };
  }

  const [items, total] = await prisma.$transaction([
    prisma.breederReportFlag.findMany({
      where,
      skip,
      take: limit,
      orderBy: [
        { marketplaceSuspendedAt: "desc" },
        { warningIssuedAt: "desc" },
        { flaggedAt: "desc" },
        { pendingReports: "desc" },
      ],
      include: {
        breederTenant: {
          select: {
            id: true,
            name: true,
            primaryEmail: true,
          },
        },
      },
    }),
    prisma.breederReportFlag.count({ where }),
  ]);

  return {
    items: items.map((f) => ({
      id: f.id,
      breederTenantId: f.breederTenantId,
      totalReports: f.totalReports,
      pendingReports: f.pendingReports,
      lightReports: f.lightReports,
      mediumReports: f.mediumReports,
      heavyReports: f.heavyReports,
      flaggedAt: f.flaggedAt,
      flagReason: f.flagReason,
      warningIssuedAt: f.warningIssuedAt,
      warningNote: f.warningNote,
      marketplaceSuspendedAt: f.marketplaceSuspendedAt,
      suspendedReason: f.suspendedReason,
      updatedAt: f.updatedAt,
      tenant: f.breederTenant,
    })),
    total,
  };
}

/**
 * Get all reports for a specific breeder
 */
export async function getBreederReports(
  breederTenantId: number
): Promise<{ flag: BreederFlagInfo | null; reports: BreederReportInfo[] }> {
  const [flag, reports] = await prisma.$transaction([
    prisma.breederReportFlag.findUnique({
      where: { breederTenantId },
      include: {
        breederTenant: {
          select: {
            id: true,
            name: true,
            primaryEmail: true,
          },
        },
      },
    }),
    prisma.breederReport.findMany({
      where: { breederTenantId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    flag: flag
      ? {
          id: flag.id,
          breederTenantId: flag.breederTenantId,
          totalReports: flag.totalReports,
          pendingReports: flag.pendingReports,
          lightReports: flag.lightReports,
          mediumReports: flag.mediumReports,
          heavyReports: flag.heavyReports,
          flaggedAt: flag.flaggedAt,
          flagReason: flag.flagReason,
          warningIssuedAt: flag.warningIssuedAt,
          warningNote: flag.warningNote,
          marketplaceSuspendedAt: flag.marketplaceSuspendedAt,
          suspendedReason: flag.suspendedReason,
          updatedAt: flag.updatedAt,
          tenant: flag.breederTenant,
        }
      : null,
    reports: reports.map((r) => ({
      id: r.id,
      reporterUserIdMasked: maskUserId(r.reporterUserId),
      breederTenantId: r.breederTenantId,
      reason: r.reason,
      severity: r.severity,
      description: r.description,
      status: r.status,
      adminNotes: r.adminNotes,
      reviewedByUserId: r.reviewedByUserId,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
    })),
  };
}

// ============================================================================
// Admin Action Functions
// ============================================================================

/**
 * Dismiss a report
 */
export async function dismissReport(
  reportId: number,
  reason: string,
  reviewedByUserId: string
): Promise<void> {
  const report = await prisma.breederReport.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new Error("Report not found");
  }

  const oldStatus = report.status;

  await prisma.breederReport.update({
    where: { id: reportId },
    data: {
      status: "DISMISSED",
      adminNotes: reason,
      reviewedByUserId,
      reviewedAt: new Date(),
    },
  });

  // Update flag counters
  await updateFlagOnReportReview(report.breederTenantId, oldStatus, "DISMISSED");
}

/**
 * Mark a report as reviewed
 */
export async function markReportReviewed(
  reportId: number,
  adminNotes: string | null,
  reviewedByUserId: string
): Promise<void> {
  const report = await prisma.breederReport.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new Error("Report not found");
  }

  const oldStatus = report.status;

  await prisma.breederReport.update({
    where: { id: reportId },
    data: {
      status: "REVIEWED",
      adminNotes,
      reviewedByUserId,
      reviewedAt: new Date(),
    },
  });

  // Update flag counters
  await updateFlagOnReportReview(report.breederTenantId, oldStatus, "REVIEWED");
}

/**
 * Issue a warning to a breeder
 */
export async function warnBreeder(
  breederTenantId: number,
  note: string
): Promise<void> {
  const flag = await getOrCreateFlag(breederTenantId);

  await prisma.breederReportFlag.update({
    where: { id: flag.id },
    data: {
      warningIssuedAt: new Date(),
      warningNote: note,
    },
  });
}

/**
 * Suspend a breeder's marketplace listing (soft suspension)
 */
export async function suspendBreederMarketplace(
  breederTenantId: number,
  reason: string
): Promise<void> {
  const flag = await getOrCreateFlag(breederTenantId);

  await prisma.breederReportFlag.update({
    where: { id: flag.id },
    data: {
      marketplaceSuspendedAt: new Date(),
      suspendedReason: reason,
    },
  });
}

/**
 * Unsuspend a breeder's marketplace listing
 */
export async function unsuspendBreederMarketplace(
  breederTenantId: number
): Promise<void> {
  const flag = await prisma.breederReportFlag.findUnique({
    where: { breederTenantId },
  });

  if (!flag) return;

  await prisma.breederReportFlag.update({
    where: { id: flag.id },
    data: {
      marketplaceSuspendedAt: null,
      suspendedReason: null,
    },
  });
}

/**
 * Clear flagged status (keep historical data)
 */
export async function clearBreederFlag(breederTenantId: number): Promise<void> {
  const flag = await prisma.breederReportFlag.findUnique({
    where: { breederTenantId },
  });

  if (!flag) return;

  await prisma.breederReportFlag.update({
    where: { id: flag.id },
    data: {
      flaggedAt: null,
      flagReason: null,
    },
  });
}

/**
 * Check if a breeder's marketplace listing is suspended
 */
export async function isBreederSuspended(
  breederTenantId: number
): Promise<boolean> {
  const flag = await prisma.breederReportFlag.findUnique({
    where: { breederTenantId },
    select: { marketplaceSuspendedAt: true },
  });

  return (
    flag?.marketplaceSuspendedAt !== null &&
    flag?.marketplaceSuspendedAt !== undefined
  );
}
