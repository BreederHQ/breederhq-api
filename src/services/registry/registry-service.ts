/**
 * Registry Service
 *
 * High-level service for registry operations:
 * - Verification (API and manual)
 * - Pedigree import
 * - Sync logging
 */

import { Prisma, PrismaClient } from '@prisma/client';
import type {
  VerificationResult,
  PedigreeResult,
  PedigreeAncestor,
  SyncLogEntry,
  SyncAction,
  SyncStatus,
} from './types.js';
import { getRegistryClient, getRegistryCapabilities } from './client-factory.js';
import { getGenerationFromPosition } from './types.js';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Verification Service
// ─────────────────────────────────────────────────────────────────────────────

export interface VerifyRegistrationParams {
  tenantId: number;
  animalId: number;
  identifierId: number;
  userId?: string;
}

export interface ManualVerificationParams extends VerifyRegistrationParams {
  documentUrl?: string;
  notes?: string;
}

/**
 * Attempt to verify a registration via API.
 * Falls back to format validation if no API available.
 */
export async function verifyRegistrationViaApi(
  params: VerifyRegistrationParams
): Promise<VerificationResult> {
  const { tenantId, identifierId, userId } = params;
  const startTime = Date.now();

  // Fetch the registration record
  const registration = await prisma.animalRegistryIdentifier.findUnique({
    where: { id: identifierId },
    include: {
      registry: true,
      animal: { select: { name: true } },
    },
  });

  if (!registration) {
    return {
      verified: false,
      confidence: 'NONE',
      method: 'API',
      errorMessage: 'Registration not found',
    };
  }

  const client = getRegistryClient(
    registration.registry.code ?? 'UNKNOWN',
    registration.registry.name
  );

  // Attempt verification
  const result = await client.verifyRegistration(
    registration.identifier,
    registration.animal.name,
    tenantId
  );

  const durationMs = Date.now() - startTime;

  // Log the sync operation
  await logSyncOperation({
    tenantId,
    registryId: registration.registryId,
    action: 'verify',
    status: result.verified ? 'success' : 'error',
    animalId: registration.animalId,
    identifier: registration.identifier,
    responseData: result as unknown as Record<string, unknown>,
    errorMessage: result.errorMessage,
    durationMs,
    initiatedByUserId: userId,
  });

  // Store verification result
  await prisma.registryVerification.upsert({
    where: { animalRegistryIdentifierId: identifierId },
    create: {
      animalRegistryIdentifierId: identifierId,
      verified: result.verified,
      verifiedAt: result.verified ? new Date() : null,
      method: result.method,
      confidence: result.confidence,
      registryData: result.registryData as object | undefined,
    },
    update: {
      verified: result.verified,
      verifiedAt: result.verified ? new Date() : null,
      method: result.method,
      confidence: result.confidence,
      registryData: result.registryData as object | undefined,
    },
  });

  return result;
}

/**
 * Record manual verification of a registration.
 * Used when user uploads document proof.
 */
export async function recordManualVerification(
  params: ManualVerificationParams
): Promise<{ success: boolean; error?: string }> {
  const { tenantId, identifierId, documentUrl, notes, userId } = params;

  // Fetch the registration record
  const registration = await prisma.animalRegistryIdentifier.findUnique({
    where: { id: identifierId },
  });

  if (!registration) {
    return { success: false, error: 'Registration not found' };
  }

  try {
    await prisma.registryVerification.upsert({
      where: { animalRegistryIdentifierId: identifierId },
      create: {
        animalRegistryIdentifierId: identifierId,
        verified: true,
        verifiedAt: new Date(),
        method: documentUrl ? 'DOCUMENT' : 'MANUAL',
        confidence: 'HIGH',
        documentUrl,
        documentNotes: notes,
        verifiedByUserId: userId,
      },
      update: {
        verified: true,
        verifiedAt: new Date(),
        method: documentUrl ? 'DOCUMENT' : 'MANUAL',
        confidence: 'HIGH',
        documentUrl,
        documentNotes: notes,
        verifiedByUserId: userId,
      },
    });

    // Log the operation
    await logSyncOperation({
      tenantId,
      registryId: registration.registryId,
      action: 'verify',
      status: 'success',
      animalId: registration.animalId,
      identifier: registration.identifier,
      requestData: { method: 'manual', documentUrl, notes },
      initiatedByUserId: userId,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get verification status for a registration
 */
export async function getVerificationStatus(identifierId: number) {
  return prisma.registryVerification.findUnique({
    where: { animalRegistryIdentifierId: identifierId },
    include: {
      verifiedByUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Pedigree Import Service
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportPedigreeParams {
  tenantId: number;
  animalId: number;
  identifierId: number;
  generations?: number;
  userId?: string;
}

/**
 * Import pedigree from registry API.
 * Returns null if registry doesn't support pedigree API.
 */
export async function importPedigreeFromRegistry(
  params: ImportPedigreeParams
): Promise<PedigreeResult | null> {
  const { tenantId, identifierId, generations = 3, userId } = params;
  const startTime = Date.now();

  // Fetch the registration record
  const registration = await prisma.animalRegistryIdentifier.findUnique({
    where: { id: identifierId },
    include: { registry: true },
  });

  if (!registration) {
    return null;
  }

  const client = getRegistryClient(
    registration.registry.code ?? 'UNKNOWN',
    registration.registry.name
  );

  // Check capabilities
  const capabilities = client.getCapabilities();
  if (!capabilities.pedigree) {
    // Log that pedigree is not available
    await logSyncOperation({
      tenantId,
      registryId: registration.registryId,
      action: 'import_pedigree',
      status: 'error',
      animalId: registration.animalId,
      identifier: registration.identifier,
      errorMessage: 'Pedigree API not available for this registry',
      initiatedByUserId: userId,
    });
    return null;
  }

  // Fetch pedigree
  const pedigree = await client.getPedigree(
    registration.identifier,
    generations,
    tenantId
  );

  const durationMs = Date.now() - startTime;

  if (!pedigree) {
    await logSyncOperation({
      tenantId,
      registryId: registration.registryId,
      action: 'import_pedigree',
      status: 'error',
      animalId: registration.animalId,
      identifier: registration.identifier,
      errorMessage: 'Pedigree not found or API error',
      durationMs,
      initiatedByUserId: userId,
    });
    return null;
  }

  // Store pedigree ancestors
  await storePedigreeAncestors(identifierId, pedigree.ancestors);

  // Log success
  await logSyncOperation({
    tenantId,
    registryId: registration.registryId,
    action: 'import_pedigree',
    status: 'success',
    animalId: registration.animalId,
    identifier: registration.identifier,
    responseData: { generations: pedigree.generations, ancestorCount: pedigree.ancestors.length },
    durationMs,
    initiatedByUserId: userId,
  });

  return pedigree;
}

/**
 * Store pedigree ancestors in the database.
 * Replaces existing pedigree data.
 */
async function storePedigreeAncestors(
  identifierId: number,
  ancestors: PedigreeAncestor[]
): Promise<void> {
  // Delete existing pedigree for this registration
  await prisma.registryPedigree.deleteMany({
    where: { animalRegistryIdentifierId: identifierId },
  });

  // Insert new ancestors
  await prisma.registryPedigree.createMany({
    data: ancestors.map((ancestor) => ({
      animalRegistryIdentifierId: identifierId,
      generation: ancestor.generation,
      position: ancestor.position,
      registrationNumber: ancestor.registrationNumber,
      name: ancestor.name,
      color: ancestor.color,
      birthYear: ancestor.birthYear,
      sex: ancestor.sex,
    })),
  });
}

/**
 * Add a single pedigree entry manually.
 * Used when user enters pedigree data by hand.
 */
export async function addManualPedigreeEntry(
  identifierId: number,
  entry: Omit<PedigreeAncestor, 'generation'>
): Promise<{ success: boolean; error?: string }> {
  const generation = getGenerationFromPosition(entry.position);

  try {
    await prisma.registryPedigree.upsert({
      where: {
        animalRegistryIdentifierId_position: {
          animalRegistryIdentifierId: identifierId,
          position: entry.position,
        },
      },
      create: {
        animalRegistryIdentifierId: identifierId,
        generation,
        position: entry.position,
        registrationNumber: entry.registrationNumber,
        name: entry.name,
        color: entry.color,
        birthYear: entry.birthYear,
        sex: entry.sex,
      },
      update: {
        name: entry.name,
        registrationNumber: entry.registrationNumber,
        color: entry.color,
        birthYear: entry.birthYear,
        sex: entry.sex,
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get pedigree data for a registration
 */
export async function getPedigree(identifierId: number) {
  return prisma.registryPedigree.findMany({
    where: { animalRegistryIdentifierId: identifierId },
    orderBy: [{ generation: 'asc' }, { position: 'asc' }],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry Lookup (without saving)
// ─────────────────────────────────────────────────────────────────────────────

export interface LookupParams {
  tenantId: number;
  registryId: number;
  identifier: string;
  userId?: string;
}

/**
 * Look up a horse in a registry without saving.
 * Useful for searching before adding a registration.
 */
export async function lookupInRegistry(params: LookupParams) {
  const { tenantId, registryId, identifier, userId } = params;
  const startTime = Date.now();

  const registry = await prisma.registry.findUnique({
    where: { id: registryId },
  });

  if (!registry) {
    return { success: false, error: 'Registry not found' };
  }

  const client = getRegistryClient(registry.code ?? 'UNKNOWN', registry.name);

  const result = await client.lookupByRegistration(identifier, tenantId);
  const durationMs = Date.now() - startTime;

  // Log the lookup
  await logSyncOperation({
    tenantId,
    registryId,
    action: 'lookup',
    status: result ? 'success' : 'error',
    identifier,
    responseData: result as unknown as Record<string, unknown> | undefined,
    errorMessage: result ? undefined : 'Not found or API unavailable',
    durationMs,
    initiatedByUserId: userId,
  });

  return {
    success: !!result,
    data: result,
    capabilities: client.getCapabilities(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync Logging
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log a registry sync operation for audit trail
 */
async function logSyncOperation(entry: SyncLogEntry): Promise<void> {
  try {
    await prisma.registrySyncLog.create({
      data: {
        tenantId: entry.tenantId,
        registryId: entry.registryId,
        action: entry.action,
        status: entry.status,
        animalId: entry.animalId,
        identifier: entry.identifier,
        requestData: entry.requestData as Prisma.InputJsonValue | undefined,
        responseData: entry.responseData as Prisma.InputJsonValue | undefined,
        errorMessage: entry.errorMessage,
        durationMs: entry.durationMs,
        initiatedByUserId: entry.initiatedByUserId,
      },
    });
  } catch (error) {
    // Don't fail operations if logging fails
    console.error('Failed to log registry sync operation:', error);
  }
}

/**
 * Get sync logs for a tenant
 */
export async function getSyncLogs(
  tenantId: number,
  options?: {
    registryId?: number;
    action?: SyncAction;
    limit?: number;
    offset?: number;
  }
) {
  const { registryId, action, limit = 50, offset = 0 } = options ?? {};

  return prisma.registrySyncLog.findMany({
    where: {
      tenantId,
      ...(registryId && { registryId }),
      ...(action && { action }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: {
      initiatedByUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry Info
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get capabilities for a registry by ID
 */
export async function getRegistryCapabilitiesById(registryId: number) {
  const registry = await prisma.registry.findUnique({
    where: { id: registryId },
  });

  if (!registry) {
    return null;
  }

  return getRegistryCapabilities(registry.code ?? 'UNKNOWN');
}
