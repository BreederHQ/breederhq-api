// src/routes/semen-inventory.ts
// Semen Inventory Management API (P7)
// Tracks frozen and cooled semen at the dose level for stallion stations

import type { FastifyInstance } from "fastify";
import prisma from "../prisma.js";
import { auditCreate, auditUpdate, auditDelete, type AuditContext } from "../services/audit-trail.js";
import { logEntityActivity } from "../services/activity-log.js";

// Type definitions (matches Prisma schema enums)
// NOTE: After running migration, these can be imported from @prisma/client
type SemenCollectionMethod = "AV" | "EE" | "MANUAL";
type SemenStorageType = "FRESH" | "COOLED" | "FROZEN";
type SemenQualityGrade = "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
type SemenInventoryStatus = "AVAILABLE" | "RESERVED" | "DEPLETED" | "EXPIRED" | "DISCARDED";
type SemenUsageType = "BREEDING_ON_SITE" | "BREEDING_SHIPPED" | "TRANSFERRED" | "SAMPLE_TESTING" | "DISCARDED";

// ============================================================================
// Types
// ============================================================================

interface SemenInventoryInput {
  stallionId: number;
  collectionDate: string;
  collectionMethod?: SemenCollectionMethod;
  storageType: SemenStorageType;
  storageLocation?: string;
  storageFacility?: string;
  initialDoses: number;
  doseVolumeMl?: number;
  concentration?: number;
  motility?: number;
  morphology?: number;
  qualityGrade?: SemenQualityGrade;
  expiresAt?: string;
  notes?: string;
}

interface SemenInventoryUpdateInput {
  storageLocation?: string;
  storageFacility?: string;
  concentration?: number;
  motility?: number;
  morphology?: number;
  qualityGrade?: SemenQualityGrade;
  expiresAt?: string;
  notes?: string;
  status?: SemenInventoryStatus;
}

interface DispenseInput {
  usageType: SemenUsageType;
  dosesUsed?: number;
  usageDate?: string;
  breedingAttemptId?: number;
  shippedToName?: string;
  shippedToAddress?: string;
  shippingCarrier?: string;
  trackingNumber?: string;
  transferredToFacility?: string;
  notes?: string;
}

interface SemenInventoryResponse {
  id: number;
  tenantId: number;
  stallionId: number;
  stallionName: string | null;
  stallionPhotoUrl: string | null;
  batchNumber: string;
  collectionDate: string;
  collectionMethod: SemenCollectionMethod;
  storageType: SemenStorageType;
  storageLocation: string | null;
  storageFacility: string | null;
  initialDoses: number;
  availableDoses: number;
  doseVolumeMl: number | null;
  concentration: number | null;
  motility: number | null;
  morphology: number | null;
  qualityGrade: SemenQualityGrade | null;
  expiresAt: string | null;
  isExpired: boolean;
  status: SemenInventoryStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  archivedAt: string | null;
}

interface SemenUsageResponse {
  id: number;
  tenantId: number;
  inventoryId: number;
  batchNumber: string | null;
  usageType: SemenUsageType;
  usageDate: string;
  dosesUsed: number;
  breedingAttemptId: number | null;
  shippedToName: string | null;
  shippedToAddress: string | null;
  shippingCarrier: string | null;
  trackingNumber: string | null;
  transferredToFacility: string | null;
  notes: string | null;
  recordedBy: number | null;
  createdAt: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Build AuditContext from a Fastify request */
function auditCtx(req: any, tenantId: number): AuditContext {
  return {
    tenantId,
    userId: String((req as any).userId ?? "unknown"),
    userName: (req as any).userName ?? undefined,
    changeSource: "PLATFORM",
    ip: req.ip,
  };
}

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parsePaging(q: Record<string, unknown>) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 25) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Calculate quality grade based on motility and morphology
 */
function calculateQualityGrade(
  motility?: number,
  morphology?: number
): SemenQualityGrade | null {
  if (motility === undefined || motility === null) return null;

  if (motility >= 70 && (morphology === undefined || morphology === null || morphology >= 70)) {
    return "EXCELLENT";
  }
  if (motility >= 50) return "GOOD";
  if (motility >= 30) return "FAIR";
  return "POOR";
}

/**
 * Generate a unique batch number for a stallion
 * Format: XXX-YYYY-NNN (e.g., THU-2026-001)
 */
async function generateBatchNumber(
  tenantId: number,
  stallionId: number
): Promise<string> {
  const stallion = await prisma.animal.findUnique({
    where: { id: stallionId },
    select: { name: true },
  });

  // Use first 3 letters of name or default to "XXX"
  const prefix = stallion?.name?.substring(0, 3).toUpperCase() || "XXX";
  const year = new Date().getFullYear();

  // Get next sequence number for this stallion this year
  const count = await prisma.semenInventory.count({
    where: {
      tenantId,
      stallionId,
      batchNumber: { startsWith: `${prefix}-${year}-` },
    },
  });

  const sequence = String(count + 1).padStart(3, "0");
  return `${prefix}-${year}-${sequence}`;
}

function toInventoryResponse(inventory: any): SemenInventoryResponse {
  return {
    id: inventory.id,
    tenantId: inventory.tenantId,
    stallionId: inventory.stallionId,
    stallionName: inventory.stallion?.name ?? null,
    stallionPhotoUrl: inventory.stallion?.photoUrl ?? null,
    batchNumber: inventory.batchNumber,
    collectionDate: inventory.collectionDate.toISOString(),
    collectionMethod: inventory.collectionMethod,
    storageType: inventory.storageType,
    storageLocation: inventory.storageLocation,
    storageFacility: inventory.storageFacility,
    initialDoses: inventory.initialDoses,
    availableDoses: inventory.availableDoses,
    doseVolumeMl: inventory.doseVolumeMl ? Number(inventory.doseVolumeMl) : null,
    concentration: inventory.concentration,
    motility: inventory.motility,
    morphology: inventory.morphology,
    qualityGrade: inventory.qualityGrade,
    expiresAt: inventory.expiresAt?.toISOString() ?? null,
    isExpired: inventory.isExpired,
    status: inventory.status,
    notes: inventory.notes,
    createdAt: inventory.createdAt.toISOString(),
    updatedAt: inventory.updatedAt.toISOString(),
    createdBy: inventory.createdBy,
    archivedAt: inventory.archivedAt?.toISOString() ?? null,
  };
}

function toUsageResponse(usage: any): SemenUsageResponse {
  return {
    id: usage.id,
    tenantId: usage.tenantId,
    inventoryId: usage.inventoryId,
    batchNumber: usage.inventory?.batchNumber ?? null,
    usageType: usage.usageType,
    usageDate: usage.usageDate.toISOString(),
    dosesUsed: usage.dosesUsed,
    breedingAttemptId: usage.breedingAttemptId,
    shippedToName: usage.shippedToName,
    shippedToAddress: usage.shippedToAddress,
    shippingCarrier: usage.shippingCarrier,
    trackingNumber: usage.trackingNumber,
    transferredToFacility: usage.transferredToFacility,
    notes: usage.notes,
    recordedBy: usage.recordedBy,
    createdAt: usage.createdAt.toISOString(),
  };
}

// ============================================================================
// Routes
// ============================================================================

export default async function semenInventoryRoutes(app: FastifyInstance) {
  // --------------------------------------------------------------------------
  // GET /semen/inventory - List all semen inventory batches
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: {
      stallionId?: string;
      status?: string;
      storageType?: string;
      includeArchived?: string;
      page?: string;
      limit?: string;
    };
  }>("/semen/inventory", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const q = req.query;
    const { page, limit, skip } = parsePaging(q as Record<string, unknown>);

    const where: any = { tenantId };

    // Filters
    if (q.stallionId) {
      const stallionId = parseIntStrict(q.stallionId);
      if (stallionId) where.stallionId = stallionId;
    }

    if (q.status) {
      where.status = q.status.toUpperCase() as SemenInventoryStatus;
    }

    if (q.storageType) {
      where.storageType = q.storageType.toUpperCase() as SemenStorageType;
    }

    // Exclude archived by default
    if (q.includeArchived !== "true") {
      where.archivedAt = null;
    }

    const [items, total] = await Promise.all([
      prisma.semenInventory.findMany({
        where,
        orderBy: { collectionDate: "desc" },
        skip,
        take: limit,
        include: {
          stallion: { select: { id: true, name: true, photoUrl: true } },
        },
      }),
      prisma.semenInventory.count({ where }),
    ]);

    return reply.send({
      items: items.map(toInventoryResponse),
      total,
      page,
      limit,
    });
  });

  // --------------------------------------------------------------------------
  // GET /semen/inventory/:id - Get a single inventory batch
  // --------------------------------------------------------------------------
  app.get<{
    Params: { id: string };
  }>("/semen/inventory/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseIntStrict(req.params.id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const inventory = await prisma.semenInventory.findFirst({
      where: { id, tenantId },
      include: {
        stallion: { select: { id: true, name: true, photoUrl: true } },
      },
    });

    if (!inventory) {
      return reply.code(404).send({ error: "not_found" });
    }

    return reply.send(toInventoryResponse(inventory));
  });

  // --------------------------------------------------------------------------
  // POST /semen/inventory - Create a new collection batch
  // --------------------------------------------------------------------------
  app.post<{
    Body: SemenInventoryInput;
  }>("/semen/inventory", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const {
      stallionId,
      collectionDate,
      collectionMethod,
      storageType,
      storageLocation,
      storageFacility,
      initialDoses,
      doseVolumeMl,
      concentration,
      motility,
      morphology,
      qualityGrade,
      expiresAt,
      notes,
    } = req.body;

    // Validate required fields
    if (!stallionId || !collectionDate || !storageType || !initialDoses) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["stallionId", "collectionDate", "storageType", "initialDoses"],
      });
    }

    // Validate stallion exists and belongs to tenant
    const stallion = await prisma.animal.findFirst({
      where: { id: stallionId, tenantId, sex: "MALE" },
    });

    if (!stallion) {
      return reply.code(400).send({
        error: "invalid_stallion",
        message: "Stallion must exist and be a male animal in your tenant",
      });
    }

    // Validate expiresAt is required for COOLED storage
    if (storageType === "COOLED" && !expiresAt) {
      return reply.code(400).send({
        error: "expiration_required",
        message: "Expiration date is required for cooled semen",
      });
    }

    // Generate batch number
    const batchNumber = await generateBatchNumber(tenantId, stallionId);

    // Auto-calculate quality grade if motility provided and grade not specified
    const calculatedGrade = qualityGrade ?? calculateQualityGrade(motility, morphology);

    // Set expiration for FRESH to collection date (same-day use)
    let finalExpiresAt = expiresAt ? new Date(expiresAt) : null;
    if (storageType === "FRESH") {
      finalExpiresAt = new Date(collectionDate);
      finalExpiresAt.setHours(23, 59, 59, 999);
    }

    const inventory = await prisma.semenInventory.create({
      data: {
        tenantId,
        stallionId,
        batchNumber,
        collectionDate: new Date(collectionDate),
        collectionMethod: collectionMethod || "AV",
        storageType,
        storageLocation: storageLocation || null,
        storageFacility: storageFacility || null,
        initialDoses,
        availableDoses: initialDoses,
        doseVolumeMl: doseVolumeMl || null,
        concentration: concentration || null,
        motility: motility || null,
        morphology: morphology || null,
        qualityGrade: calculatedGrade,
        expiresAt: finalExpiresAt,
        notes: notes || null,
        status: "AVAILABLE",
      },
      include: {
        stallion: { select: { id: true, name: true, photoUrl: true } },
      },
    });

    // Audit trail & activity log (fire-and-forget)
    const ctx = auditCtx(req, tenantId);
    auditCreate("SEMEN_INVENTORY", inventory.id, inventory as any, ctx);
    logEntityActivity({
      tenantId,
      entityType: "SEMEN_INVENTORY",
      entityId: inventory.id,
      kind: "semen_inventory_created",
      category: "event",
      title: "Semen inventory record created",
      actorId: ctx.userId,
      actorName: ctx.userName,
    });

    return reply.code(201).send(toInventoryResponse(inventory));
  });

  // --------------------------------------------------------------------------
  // PATCH /semen/inventory/:id - Update an inventory batch
  // --------------------------------------------------------------------------
  app.patch<{
    Params: { id: string };
    Body: SemenInventoryUpdateInput;
  }>("/semen/inventory/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseIntStrict(req.params.id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const existing = await prisma.semenInventory.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }

    const {
      storageLocation,
      storageFacility,
      concentration,
      motility,
      morphology,
      qualityGrade,
      expiresAt,
      notes,
      status,
    } = req.body;

    const updateData: any = {};

    if (storageLocation !== undefined) updateData.storageLocation = storageLocation;
    if (storageFacility !== undefined) updateData.storageFacility = storageFacility;
    if (concentration !== undefined) updateData.concentration = concentration;
    if (motility !== undefined) updateData.motility = motility;
    if (morphology !== undefined) updateData.morphology = morphology;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    // Recalculate quality grade if motility changed and grade not explicitly set
    if (motility !== undefined && qualityGrade === undefined) {
      updateData.qualityGrade = calculateQualityGrade(
        motility ?? existing.motility ?? undefined,
        morphology ?? existing.morphology ?? undefined
      );
    } else if (qualityGrade !== undefined) {
      updateData.qualityGrade = qualityGrade;
    }

    const inventory = await prisma.semenInventory.update({
      where: { id },
      data: updateData,
      include: {
        stallion: { select: { id: true, name: true, photoUrl: true } },
      },
    });

    // Audit trail (fire-and-forget)
    if (existing) {
      auditUpdate("SEMEN_INVENTORY", id, existing as any, inventory as any, auditCtx(req, tenantId));
    }

    return reply.send(toInventoryResponse(inventory));
  });

  // --------------------------------------------------------------------------
  // DELETE /semen/inventory/:id - Soft delete an inventory batch
  // --------------------------------------------------------------------------
  app.delete<{
    Params: { id: string };
  }>("/semen/inventory/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseIntStrict(req.params.id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const existing = await prisma.semenInventory.findFirst({
      where: { id, tenantId },
      include: { usages: true },
    });

    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Don't allow deletion if there are usage records
    if (existing.usages.length > 0) {
      return reply.code(409).send({
        error: "has_usages",
        message: "Cannot delete batch with usage records. Archive instead.",
      });
    }

    // Soft delete
    await prisma.semenInventory.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    // Audit trail (fire-and-forget)
    auditDelete("SEMEN_INVENTORY", id, auditCtx(req, tenantId));

    return reply.code(204).send();
  });

  // --------------------------------------------------------------------------
  // POST /semen/inventory/:id/dispense - Dispense semen from a batch
  // --------------------------------------------------------------------------
  app.post<{
    Params: { id: string };
    Body: DispenseInput;
  }>("/semen/inventory/:id/dispense", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseIntStrict(req.params.id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const {
      usageType,
      dosesUsed = 1,
      usageDate,
      breedingAttemptId,
      shippedToName,
      shippedToAddress,
      shippingCarrier,
      trackingNumber,
      transferredToFacility,
      notes,
    } = req.body;

    if (!usageType) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["usageType"],
      });
    }

    // Validate shipping info required for BREEDING_SHIPPED
    if (usageType === "BREEDING_SHIPPED" && !shippedToName) {
      return reply.code(400).send({
        error: "shipping_name_required",
        message: "Ship-to name is required for shipped semen",
      });
    }

    // Use transaction to ensure atomic update
    const result = await prisma.$transaction(async (tx) => {
      const inventory = await tx.semenInventory.findFirst({
        where: { id, tenantId },
      });

      if (!inventory) {
        throw { status: 404, message: "not_found" };
      }

      if (inventory.status === "DEPLETED") {
        throw { status: 400, message: "batch_depleted" };
      }

      if (inventory.status === "EXPIRED" || inventory.isExpired) {
        throw { status: 400, message: "batch_expired" };
      }

      if (inventory.status === "DISCARDED") {
        throw { status: 400, message: "batch_discarded" };
      }

      if (dosesUsed > inventory.availableDoses) {
        throw {
          status: 400,
          message: "insufficient_doses",
          available: inventory.availableDoses,
        };
      }

      // Validate breeding attempt if provided
      if (breedingAttemptId) {
        const attempt = await tx.breedingAttempt.findFirst({
          where: { id: breedingAttemptId, tenantId },
        });
        if (!attempt) {
          throw { status: 400, message: "invalid_breeding_attempt" };
        }
      }

      // Create usage record
      const usage = await tx.semenUsage.create({
        data: {
          tenantId,
          inventoryId: id,
          usageType,
          usageDate: usageDate ? new Date(usageDate) : new Date(),
          dosesUsed,
          breedingAttemptId: breedingAttemptId || null,
          shippedToName: shippedToName || null,
          shippedToAddress: shippedToAddress || null,
          shippingCarrier: shippingCarrier || null,
          trackingNumber: trackingNumber || null,
          transferredToFacility: transferredToFacility || null,
          notes: notes || null,
        },
        include: {
          inventory: { select: { batchNumber: true } },
        },
      });

      // Update inventory
      const newAvailable = inventory.availableDoses - dosesUsed;
      const newStatus: SemenInventoryStatus =
        newAvailable === 0 ? "DEPLETED" : inventory.status;

      const updatedInventory = await tx.semenInventory.update({
        where: { id },
        data: {
          availableDoses: newAvailable,
          status: newStatus,
        },
      });

      return { usage, updatedInventory };
    });

    // Activity log (fire-and-forget)
    const dispenseCtx = auditCtx(req, tenantId);
    logEntityActivity({
      tenantId,
      entityType: "SEMEN_INVENTORY",
      entityId: id,
      kind: "semen_dispensed",
      category: "event",
      title: "Semen units dispensed",
      actorId: dispenseCtx.userId,
      actorName: dispenseCtx.userName,
      metadata: { unitsDispensed: dosesUsed },
    });

    return reply.send({
      success: true,
      usage: toUsageResponse(result.usage),
      inventory: {
        availableDoses: result.updatedInventory.availableDoses,
        status: result.updatedInventory.status,
      },
    });
  });

  // --------------------------------------------------------------------------
  // GET /semen/inventory/:id/usage - Get usage history for a batch
  // --------------------------------------------------------------------------
  app.get<{
    Params: { id: string };
  }>("/semen/inventory/:id/usage", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseIntStrict(req.params.id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    // Verify batch exists and belongs to tenant
    const inventory = await prisma.semenInventory.findFirst({
      where: { id, tenantId },
    });

    if (!inventory) {
      return reply.code(404).send({ error: "not_found" });
    }

    const usages = await prisma.semenUsage.findMany({
      where: { inventoryId: id, tenantId },
      orderBy: { usageDate: "desc" },
      include: {
        inventory: { select: { batchNumber: true } },
      },
    });

    return reply.send(usages.map(toUsageResponse));
  });

  // --------------------------------------------------------------------------
  // GET /semen/summary - Dashboard summary stats
  // --------------------------------------------------------------------------
  app.get("/semen/summary", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const yearStart = new Date(new Date().getFullYear(), 0, 1);

    const [
      availableInventory,
      usedYTD,
      batchesByType,
      expiringBatches,
      lowInventoryStallions,
    ] = await Promise.all([
      // Total available doses
      prisma.semenInventory.aggregate({
        where: { tenantId, status: "AVAILABLE", archivedAt: null },
        _sum: { availableDoses: true },
        _count: true,
      }),

      // Doses used YTD
      prisma.semenUsage.aggregate({
        where: {
          tenantId,
          usageDate: { gte: yearStart },
        },
        _sum: { dosesUsed: true },
      }),

      // Batches by storage type
      prisma.semenInventory.groupBy({
        by: ["storageType"],
        where: { tenantId, status: "AVAILABLE", archivedAt: null },
        _count: true,
      }),

      // Expiring within 30 days
      prisma.semenInventory.findMany({
        where: {
          tenantId,
          status: "AVAILABLE",
          archivedAt: null,
          availableDoses: { gt: 0 },
          expiresAt: { not: null, lte: thirtyDaysFromNow },
          isExpired: false,
        },
        include: {
          stallion: { select: { id: true, name: true } },
        },
        orderBy: { expiresAt: "asc" },
        take: 10,
      }),

      // Low inventory stallions (aggregated)
      prisma.semenInventory.groupBy({
        by: ["stallionId"],
        where: {
          tenantId,
          status: "AVAILABLE",
          archivedAt: null,
        },
        _sum: { availableDoses: true },
        having: {
          availableDoses: { _sum: { lt: 10 } },
        },
      }),
    ]);

    // Get stallion names for low inventory
    const lowInventoryWithNames = await Promise.all(
      lowInventoryStallions.map(async (item) => {
        const stallion = await prisma.animal.findUnique({
          where: { id: item.stallionId },
          select: { id: true, name: true },
        });
        return {
          stallionId: item.stallionId,
          stallionName: stallion?.name || "Unknown",
          availableDoses: item._sum.availableDoses || 0,
        };
      })
    );

    // Build batches by type map
    const batchesByTypeMap: Record<string, number> = {
      FRESH: 0,
      COOLED: 0,
      FROZEN: 0,
    };
    for (const item of batchesByType) {
      batchesByTypeMap[item.storageType] = item._count;
    }

    return reply.send({
      totalDosesAvailable: availableInventory._sum.availableDoses || 0,
      totalDosesUsedYTD: usedYTD._sum.dosesUsed || 0,
      activeBatches: availableInventory._count || 0,
      batchesByStorageType: batchesByTypeMap,
      expiringWithin30Days: expiringBatches.length,
      expiringBatches: expiringBatches.map((batch) => ({
        id: batch.id,
        batchNumber: batch.batchNumber,
        stallionId: batch.stallionId,
        stallionName: batch.stallion?.name || "Unknown",
        availableDoses: batch.availableDoses,
        expiresAt: batch.expiresAt!.toISOString(),
      })),
      lowInventoryStallions: lowInventoryWithNames,
    });
  });

  // --------------------------------------------------------------------------
  // GET /semen/animal/:animalId/inventory - Per-animal inventory view (species-neutral)
  // GET /semen/stallion/:stallionId/inventory - Legacy alias
  // --------------------------------------------------------------------------
  async function handleAnimalInventory(req: any, reply: any) {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const animalId = parseIntStrict(req.params.animalId || req.params.stallionId);
    if (!animalId) {
      return reply.code(400).send({ error: "invalid_animal_id" });
    }

    // Verify animal exists and belongs to tenant
    const animal = await prisma.animal.findFirst({
      where: { id: animalId, tenantId },
      select: { id: true, name: true, photoUrl: true },
    });

    if (!animal) {
      return reply.code(404).send({ error: "animal_not_found" });
    }

    const [batches, usageHistory, totalAvailable] = await Promise.all([
      prisma.semenInventory.findMany({
        where: { stallionId: animalId, tenantId, archivedAt: null },
        orderBy: { collectionDate: "desc" },
        include: {
          stallion: { select: { id: true, name: true, photoUrl: true } },
        },
      }),
      prisma.semenUsage.findMany({
        where: {
          tenantId,
          inventory: { stallionId: animalId },
        },
        orderBy: { usageDate: "desc" },
        take: 50,
        include: {
          inventory: { select: { batchNumber: true } },
        },
      }),
      prisma.semenInventory.aggregate({
        where: { stallionId: animalId, tenantId, status: "AVAILABLE", archivedAt: null },
        _sum: { availableDoses: true },
      }),
    ]);

    return reply.send({
      stallion: {
        id: animal.id,
        name: animal.name,
        photoUrl: animal.photoUrl,
      },
      totalAvailable: totalAvailable._sum.availableDoses || 0,
      batches: batches.map(toInventoryResponse),
      usageHistory: usageHistory.map(toUsageResponse),
    });
  }

  app.get("/semen/animal/:animalId/inventory", handleAnimalInventory);
  app.get("/semen/stallion/:stallionId/inventory", handleAnimalInventory); // legacy alias
}
