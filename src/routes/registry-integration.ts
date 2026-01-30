/**
 * Registry Integration Routes (P6 Sprint)
 *
 * Endpoints for:
 * - Registry connections management
 * - Registration verification (API and manual)
 * - Pedigree import
 * - Registry lookup
 * - Sync logs
 */

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from 'fastify';
import prisma from '../prisma.js';
import * as registryService from '../services/registry/index.js';

/* ─────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────────────────────── */

async function assertTenant(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<number | null> {
  const tenantId = Number((req as any).tenantId);
  if (!tenantId) {
    reply.code(400).send({ error: 'missing_tenant' });
    return null;
  }
  return tenantId;
}

function getUserId(req: FastifyRequest): string | undefined {
  return (req as any).userId || (req as any).session?.userId || undefined;
}

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Routes
 * ───────────────────────────────────────────────────────────────────────────── */

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTRY CONNECTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List tenant's registry connections
   * GET /registry-connections
   */
  app.get('/registry-connections', async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    try {
      const connections = await prisma.registryConnection.findMany({
        where: { tenantId },
        include: {
          registry: {
            select: { id: true, name: true, code: true, species: true },
          },
        },
        orderBy: { registry: { name: 'asc' } },
      });

      // Add capabilities for each registry
      const enriched = connections.map((conn: any) => ({
        ...conn,
        capabilities: registryService.getRegistryCapabilities(
          conn.registry.code ?? 'UNKNOWN'
        ),
        // Never expose tokens to client
        accessToken: undefined,
        refreshToken: undefined,
        apiKey: undefined,
        apiSecret: undefined,
      }));

      return reply.send({ ok: true, connections: enriched });
    } catch (err: any) {
      console.error('[registry-integration] list connections error:', err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  /**
   * Get connection status for a specific registry
   * GET /registry-connections/:registryId/status
   */
  app.get('/registry-connections/:registryId/status', async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const registryId = parseIntStrict((req.params as any).registryId);
    if (!registryId) {
      return reply.code(400).send({ error: 'invalid_registry_id' });
    }

    try {
      const connection = await prisma.registryConnection.findUnique({
        where: {
          tenantId_registryId: { tenantId, registryId },
        },
        include: {
          registry: { select: { id: true, name: true, code: true } },
        },
      });

      const registry = await prisma.registry.findUnique({
        where: { id: registryId },
      });

      if (!registry) {
        return reply.code(404).send({ error: 'registry_not_found' });
      }

      const capabilities = registryService.getRegistryCapabilities(
        registry.code ?? 'UNKNOWN'
      );

      return reply.send({
        ok: true,
        connected: connection?.status === 'CONNECTED',
        status: connection?.status ?? 'DISCONNECTED',
        lastSyncAt: connection?.lastSyncAt,
        errorMessage: connection?.errorMessage,
        capabilities,
      });
    } catch (err: any) {
      console.error('[registry-integration] status error:', err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  /**
   * Connect to a registry (placeholder for when APIs are available)
   * POST /registry-connections
   */
  app.post('/registry-connections', async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
      registryId?: number;
      apiKey?: string;
      apiSecret?: string;
    };

    const registryId = parseIntStrict(body.registryId);
    if (!registryId) {
      return reply.code(400).send({ error: 'invalid_registry_id' });
    }

    try {
      const registry = await prisma.registry.findUnique({
        where: { id: registryId },
      });

      if (!registry) {
        return reply.code(404).send({ error: 'registry_not_found' });
      }

      const capabilities = registryService.getRegistryCapabilities(
        registry.code ?? 'UNKNOWN'
      );

      // For now, all registries are manual-only
      if (capabilities.manualOnly) {
        return reply.code(400).send({
          error: 'api_not_available',
          message: `${registry.name} does not have a public API. Manual verification is required.`,
        });
      }

      // TODO: When API partnerships are established, implement OAuth flow here
      return reply.code(501).send({
        error: 'not_implemented',
        message: 'Registry API connections are not yet available.',
      });
    } catch (err: any) {
      console.error('[registry-integration] connect error:', err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  /**
   * Disconnect from a registry
   * DELETE /registry-connections/:registryId
   */
  app.delete('/registry-connections/:registryId', async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const registryId = parseIntStrict((req.params as any).registryId);
    if (!registryId) {
      return reply.code(400).send({ error: 'invalid_registry_id' });
    }

    try {
      await prisma.registryConnection.deleteMany({
        where: { tenantId, registryId },
      });

      return reply.send({ ok: true });
    } catch (err: any) {
      console.error('[registry-integration] disconnect error:', err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Verify a registration via API
   * POST /animals/:animalId/registries/:identifierId/verify
   */
  app.post(
    '/animals/:animalId/registries/:identifierId/verify',
    async (req, reply) => {
      const tenantId = await assertTenant(req, reply);
      if (!tenantId) return;

      const animalId = parseIntStrict((req.params as any).animalId);
      const identifierId = parseIntStrict((req.params as any).identifierId);

      if (!animalId || !identifierId) {
        return reply.code(400).send({ error: 'invalid_ids' });
      }

      const userId = getUserId(req);

      try {
        // Verify the registration belongs to this animal and tenant
        const registration = await prisma.animalRegistryIdentifier.findFirst({
          where: {
            id: identifierId,
            animalId,
            animal: { tenantId },
          },
        });

        if (!registration) {
          return reply.code(404).send({ error: 'registration_not_found' });
        }

        const result = await registryService.verifyRegistrationViaApi({
          tenantId,
          animalId,
          identifierId,
          userId,
        });

        return reply.send({
          ok: true,
          verification: result,
        });
      } catch (err: any) {
        console.error('[registry-integration] verify error:', err);
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  /**
   * Record manual verification
   * POST /animals/:animalId/registries/:identifierId/verify-manual
   */
  app.post(
    '/animals/:animalId/registries/:identifierId/verify-manual',
    async (req, reply) => {
      const tenantId = await assertTenant(req, reply);
      if (!tenantId) return;

      const animalId = parseIntStrict((req.params as any).animalId);
      const identifierId = parseIntStrict((req.params as any).identifierId);

      if (!animalId || !identifierId) {
        return reply.code(400).send({ error: 'invalid_ids' });
      }

      const body = req.body as { documentUrl?: string; notes?: string };
      const userId = getUserId(req);

      try {
        // Verify the registration belongs to this animal and tenant
        const registration = await prisma.animalRegistryIdentifier.findFirst({
          where: {
            id: identifierId,
            animalId,
            animal: { tenantId },
          },
        });

        if (!registration) {
          return reply.code(404).send({ error: 'registration_not_found' });
        }

        const result = await registryService.recordManualVerification({
          tenantId,
          animalId,
          identifierId,
          documentUrl: body.documentUrl,
          notes: body.notes,
          userId,
        });

        if (!result.success) {
          return reply.code(400).send({ error: result.error });
        }

        return reply.send({ ok: true });
      } catch (err: any) {
        console.error('[registry-integration] manual verify error:', err);
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  /**
   * Get verification status for a registration
   * GET /animals/:animalId/registries/:identifierId/verification
   */
  app.get(
    '/animals/:animalId/registries/:identifierId/verification',
    async (req, reply) => {
      const tenantId = await assertTenant(req, reply);
      if (!tenantId) return;

      const animalId = parseIntStrict((req.params as any).animalId);
      const identifierId = parseIntStrict((req.params as any).identifierId);

      if (!animalId || !identifierId) {
        return reply.code(400).send({ error: 'invalid_ids' });
      }

      try {
        // Verify the registration belongs to this animal and tenant
        const registration = await prisma.animalRegistryIdentifier.findFirst({
          where: {
            id: identifierId,
            animalId,
            animal: { tenantId },
          },
        });

        if (!registration) {
          return reply.code(404).send({ error: 'registration_not_found' });
        }

        const verification =
          await registryService.getVerificationStatus(identifierId);

        return reply.send({
          ok: true,
          verification: verification ?? { verified: false, confidence: 'NONE' },
        });
      } catch (err: any) {
        console.error('[registry-integration] get verification error:', err);
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PEDIGREE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Import pedigree from registry
   * POST /animals/:animalId/registries/:identifierId/pedigree/import
   */
  app.post(
    '/animals/:animalId/registries/:identifierId/pedigree/import',
    async (req, reply) => {
      const tenantId = await assertTenant(req, reply);
      if (!tenantId) return;

      const animalId = parseIntStrict((req.params as any).animalId);
      const identifierId = parseIntStrict((req.params as any).identifierId);

      if (!animalId || !identifierId) {
        return reply.code(400).send({ error: 'invalid_ids' });
      }

      const body = req.body as { generations?: number };
      const userId = getUserId(req);

      try {
        // Verify the registration belongs to this animal and tenant
        const registration = await prisma.animalRegistryIdentifier.findFirst({
          where: {
            id: identifierId,
            animalId,
            animal: { tenantId },
          },
          include: { registry: true },
        });

        if (!registration) {
          return reply.code(404).send({ error: 'registration_not_found' });
        }

        // Check if pedigree is available for this registry
        const capabilities = registryService.getRegistryCapabilities(
          registration.registry.code ?? 'UNKNOWN'
        );

        if (!capabilities.pedigree) {
          return reply.code(400).send({
            error: 'pedigree_not_available',
            message: `${registration.registry.name} does not support pedigree import via API. Please enter pedigree data manually.`,
          });
        }

        const result = await registryService.importPedigreeFromRegistry({
          tenantId,
          animalId,
          identifierId,
          generations: body.generations,
          userId,
        });

        if (!result) {
          return reply.code(400).send({
            error: 'import_failed',
            message: 'Unable to import pedigree. Please try again or enter manually.',
          });
        }

        return reply.send({
          ok: true,
          pedigree: result,
        });
      } catch (err: any) {
        console.error('[registry-integration] import pedigree error:', err);
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  /**
   * Add manual pedigree entry
   * POST /animals/:animalId/registries/:identifierId/pedigree
   */
  app.post(
    '/animals/:animalId/registries/:identifierId/pedigree',
    async (req, reply) => {
      const tenantId = await assertTenant(req, reply);
      if (!tenantId) return;

      const animalId = parseIntStrict((req.params as any).animalId);
      const identifierId = parseIntStrict((req.params as any).identifierId);

      if (!animalId || !identifierId) {
        return reply.code(400).send({ error: 'invalid_ids' });
      }

      const body = req.body as {
        position: string;
        name: string;
        registrationNumber?: string;
        color?: string;
        birthYear?: number;
        sex?: 'M' | 'F' | 'G';
      };

      if (!body.position || !body.name) {
        return reply.code(400).send({ error: 'missing_required_fields' });
      }

      try {
        // Verify the registration belongs to this animal and tenant
        const registration = await prisma.animalRegistryIdentifier.findFirst({
          where: {
            id: identifierId,
            animalId,
            animal: { tenantId },
          },
        });

        if (!registration) {
          return reply.code(404).send({ error: 'registration_not_found' });
        }

        const result = await registryService.addManualPedigreeEntry(
          identifierId,
          {
            position: body.position,
            name: body.name,
            registrationNumber: body.registrationNumber,
            color: body.color,
            birthYear: body.birthYear,
            sex: body.sex,
          }
        );

        if (!result.success) {
          return reply.code(400).send({ error: result.error });
        }

        return reply.send({ ok: true });
      } catch (err: any) {
        console.error('[registry-integration] add pedigree error:', err);
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  /**
   * Get pedigree for a registration
   * GET /animals/:animalId/registries/:identifierId/pedigree
   */
  app.get(
    '/animals/:animalId/registries/:identifierId/pedigree',
    async (req, reply) => {
      const tenantId = await assertTenant(req, reply);
      if (!tenantId) return;

      const animalId = parseIntStrict((req.params as any).animalId);
      const identifierId = parseIntStrict((req.params as any).identifierId);

      if (!animalId || !identifierId) {
        return reply.code(400).send({ error: 'invalid_ids' });
      }

      try {
        // Verify the registration belongs to this animal and tenant
        const registration = await prisma.animalRegistryIdentifier.findFirst({
          where: {
            id: identifierId,
            animalId,
            animal: { tenantId },
          },
        });

        if (!registration) {
          return reply.code(404).send({ error: 'registration_not_found' });
        }

        const pedigree = await registryService.getPedigree(identifierId);

        return reply.send({
          ok: true,
          pedigree,
        });
      } catch (err: any) {
        console.error('[registry-integration] get pedigree error:', err);
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  /**
   * Delete pedigree entry
   * DELETE /animals/:animalId/registries/:identifierId/pedigree/:position
   */
  app.delete(
    '/animals/:animalId/registries/:identifierId/pedigree/:position',
    async (req, reply) => {
      const tenantId = await assertTenant(req, reply);
      if (!tenantId) return;

      const animalId = parseIntStrict((req.params as any).animalId);
      const identifierId = parseIntStrict((req.params as any).identifierId);
      const position = (req.params as any).position as string;

      if (!animalId || !identifierId || !position) {
        return reply.code(400).send({ error: 'invalid_params' });
      }

      try {
        // Verify the registration belongs to this animal and tenant
        const registration = await prisma.animalRegistryIdentifier.findFirst({
          where: {
            id: identifierId,
            animalId,
            animal: { tenantId },
          },
        });

        if (!registration) {
          return reply.code(404).send({ error: 'registration_not_found' });
        }

        await prisma.registryPedigree.delete({
          where: {
            animalRegistryIdentifierId_position: {
              animalRegistryIdentifierId: identifierId,
              position,
            },
          },
        });

        return reply.send({ ok: true });
      } catch (err: any) {
        console.error('[registry-integration] delete pedigree error:', err);
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // LOOKUP
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Look up an animal in a registry (without saving)
   * GET /registry-lookup?registryId=X&identifier=Y
   */
  app.get('/registry-lookup', async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as { registryId?: string; identifier?: string };
    const registryId = parseIntStrict(query.registryId);
    const identifier = query.identifier?.trim();

    if (!registryId || !identifier) {
      return reply.code(400).send({ error: 'missing_required_params' });
    }

    const userId = getUserId(req);

    try {
      const result = await registryService.lookupInRegistry({
        tenantId,
        registryId,
        identifier,
        userId,
      });

      return reply.send({
        ok: true,
        found: result.success,
        data: result.data,
        capabilities: result.capabilities,
      });
    } catch (err: any) {
      console.error('[registry-integration] lookup error:', err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC LOGS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get registry sync logs
   * GET /registry-sync-logs
   */
  app.get('/registry-sync-logs', async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      registryId?: string;
      action?: string;
      limit?: string;
      offset?: string;
    };

    try {
      const logs = await registryService.getSyncLogs(tenantId, {
        registryId: query.registryId
          ? parseIntStrict(query.registryId) ?? undefined
          : undefined,
        action: query.action as any,
        limit: parseIntStrict(query.limit) ?? 50,
        offset: parseIntStrict(query.offset) ?? 0,
      });

      return reply.send({ ok: true, logs });
    } catch (err: any) {
      console.error('[registry-integration] get logs error:', err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTRY CAPABILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get capabilities for a registry
   * GET /registries/:registryId/capabilities
   */
  app.get('/registries/:registryId/capabilities', async (req, reply) => {
    const registryId = parseIntStrict((req.params as any).registryId);
    if (!registryId) {
      return reply.code(400).send({ error: 'invalid_registry_id' });
    }

    try {
      const capabilities =
        await registryService.getRegistryCapabilitiesById(registryId);

      if (!capabilities) {
        return reply.code(404).send({ error: 'registry_not_found' });
      }

      return reply.send({ ok: true, capabilities });
    } catch (err: any) {
      console.error('[registry-integration] get capabilities error:', err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });
};

export default routes;
