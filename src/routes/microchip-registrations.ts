// src/routes/microchip-registrations.ts
// Microchip registry tracking API endpoints
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

// Microchip renewal type (matches Prisma enum)
type MicrochipRenewalType = "LIFETIME" | "ANNUAL" | "UNKNOWN";

// ────────────────────────────────────────────────────────────────────────────
// Utils
// ────────────────────────────────────────────────────────────────────────────

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseDateIso(v: unknown): Date | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(+d) ? null : d;
}

async function assertTenant(req: any, reply: any): Promise<number | null> {
  const tenantId = Number((req as any).tenantId);
  if (!tenantId) {
    reply.code(400).send({ error: "missing_tenant" });
    return null;
  }
  return tenantId;
}

async function assertAnimalInTenant(animalId: number, tenantId: number) {
  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    select: { id: true, tenantId: true, species: true, name: true, microchip: true },
  });
  if (!animal) throw Object.assign(new Error("animal_not_found"), { statusCode: 404 });
  if (animal.tenantId !== tenantId) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  return animal;
}

async function assertOffspringInTenant(offspringId: number, tenantId: number) {
  const offspring = await prisma.offspring.findUnique({
    where: { id: offspringId },
    select: {
      id: true,
      tenantId: true,
      species: true,
      name: true,
    },
  });
  if (!offspring) throw Object.assign(new Error("offspring_not_found"), { statusCode: 404 });
  if (offspring.tenantId !== tenantId) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  return offspring;
}

// ────────────────────────────────────────────────────────────────────────────
// Status Calculation
// ────────────────────────────────────────────────────────────────────────────

type RegistrationStatus = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "LIFETIME";

function differenceInDays(dateA: Date, dateB: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((dateA.getTime() - dateB.getTime()) / msPerDay);
}

function calculateRegistrationStatus(
  expirationDate: Date | null,
  renewalType: MicrochipRenewalType
): { status: RegistrationStatus; daysUntilExpiration: number | null } {
  // Lifetime registrations never expire
  if (renewalType === "LIFETIME" || !expirationDate) {
    return { status: "LIFETIME", daysUntilExpiration: null };
  }

  const now = new Date();
  const daysUntil = differenceInDays(expirationDate, now);

  if (daysUntil < 0) {
    return { status: "EXPIRED", daysUntilExpiration: daysUntil };
  }
  if (daysUntil <= 30) {
    return { status: "EXPIRING_SOON", daysUntilExpiration: daysUntil };
  }
  return { status: "ACTIVE", daysUntilExpiration: daysUntil };
}

// ────────────────────────────────────────────────────────────────────────────
// Response Formatters
// ────────────────────────────────────────────────────────────────────────────

function formatRegistration(reg: any) {
  const statusInfo = calculateRegistrationStatus(
    reg.expirationDate,
    reg.registry.renewalType
  );

  return {
    id: reg.id,
    microchipNumber: reg.microchipNumber,
    registry: {
      id: reg.registry.id,
      name: reg.registry.name,
      slug: reg.registry.slug,
      website: reg.registry.website,
      renewalType: reg.registry.renewalType,
    },
    registrationDate: reg.registrationDate?.toISOString() ?? null,
    expirationDate: reg.expirationDate?.toISOString() ?? null,
    accountNumber: reg.accountNumber,
    registeredTo: reg.registeredTo
      ? {
          id: reg.registeredTo.id,
          name: reg.registeredTo.display_name,
          email: reg.registeredTo.email,
        }
      : null,
    notes: reg.notes,
    status: statusInfo.status,
    daysUntilExpiration: statusInfo.daysUntilExpiration,
    createdAt: reg.createdAt.toISOString(),
    updatedAt: reg.updatedAt.toISOString(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────

const microchipRegistrationsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ──────────────────────────────────────────────────────────────────────────
  // Registry Lookup Endpoints (public data)
  // ──────────────────────────────────────────────────────────────────────────

  // GET /api/v1/microchip-registries
  // List all active microchip registries, optionally filtered by species
  app.get("/microchip-registries", async (req, reply) => {
    const query = req.query as { species?: string };
    const species = query.species?.toUpperCase();

    const registries = await prisma.microchipRegistry.findMany({
      where: {
        isActive: true,
        ...(species && {
          OR: [{ species: { has: species } }, { species: { has: "ALL" } }],
        }),
      },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        website: true,
        renewalType: true,
        species: true,
      },
    });

    return reply.send({ registries });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Animal Microchip Registration Endpoints
  // ──────────────────────────────────────────────────────────────────────────

  // GET /api/v1/animals/:animalId/microchip-registrations
  // Get all microchip registrations for an animal
  app.get("/animals/:animalId/microchip-registrations", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const registrations = await prisma.animalMicrochipRegistration.findMany({
      where: { tenantId, animalId },
      orderBy: { createdAt: "desc" },
      include: {
        registry: true,
        registeredTo: {
          select: { id: true, display_name: true, email: true },
        },
      },
    });

    return reply.send({
      registrations: registrations.map(formatRegistration),
    });
  });

  // POST /api/v1/animals/:animalId/microchip-registrations
  // Create a new microchip registration for an animal
  app.post("/animals/:animalId/microchip-registrations", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: "animal_id_invalid" });

    const animal = await assertAnimalInTenant(animalId, tenantId);

    const body = req.body as {
      microchipNumber?: string;
      registryId: number;
      registrationDate?: string;
      expirationDate?: string;
      accountNumber?: string;
      registeredToContactId?: number;
      notes?: string;
    };

    if (!body.registryId) {
      return reply.code(400).send({ error: "registryId_required" });
    }

    // Verify registry exists
    const registry = await prisma.microchipRegistry.findUnique({
      where: { id: body.registryId },
    });
    if (!registry) {
      return reply.code(404).send({ error: "registry_not_found" });
    }

    // Use provided microchip number or fall back to animal's microchip
    const microchipNumber = body.microchipNumber?.trim() || animal.microchip;
    if (!microchipNumber) {
      return reply.code(400).send({ error: "microchipNumber_required" });
    }

    // If registry requires annual renewal, expiration date should be provided
    if (registry.renewalType === "ANNUAL" && !body.expirationDate) {
      return reply.code(400).send({ error: "expirationDate_required_for_annual_registry" });
    }

    // Verify contact if provided
    if (body.registeredToContactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: body.registeredToContactId, tenantId },
      });
      if (!contact) {
        return reply.code(404).send({ error: "contact_not_found" });
      }
    }

    // Check for duplicate registration with same registry
    const existing = await prisma.animalMicrochipRegistration.findUnique({
      where: {
        unique_animal_registry: {
          tenantId,
          animalId,
          registryId: body.registryId,
        },
      },
    });
    if (existing) {
      return reply.code(409).send({ error: "registration_already_exists_for_this_registry" });
    }

    const registration = await prisma.animalMicrochipRegistration.create({
      data: {
        tenantId,
        animalId,
        microchipNumber,
        registryId: body.registryId,
        registrationDate: body.registrationDate ? parseDateIso(body.registrationDate) : null,
        expirationDate: body.expirationDate ? parseDateIso(body.expirationDate) : null,
        accountNumber: body.accountNumber || null,
        registeredToContactId: body.registeredToContactId || null,
        notes: body.notes || null,
      },
      include: {
        registry: true,
        registeredTo: {
          select: { id: true, display_name: true, email: true },
        },
      },
    });

    return reply.code(201).send(formatRegistration(registration));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Offspring Microchip Registration Endpoints
  // ──────────────────────────────────────────────────────────────────────────

  // GET /api/v1/offspring/:offspringId/microchip-registrations
  app.get("/offspring/:offspringId/microchip-registrations", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const offspringId = parseIntStrict((req.params as { offspringId: string }).offspringId);
    if (!offspringId) return reply.code(400).send({ error: "offspring_id_invalid" });

    await assertOffspringInTenant(offspringId, tenantId);

    const registrations = await prisma.animalMicrochipRegistration.findMany({
      where: { tenantId, offspringId },
      orderBy: { createdAt: "desc" },
      include: {
        registry: true,
        registeredTo: {
          select: { id: true, display_name: true, email: true },
        },
      },
    });

    return reply.send({
      registrations: registrations.map(formatRegistration),
    });
  });

  // POST /api/v1/offspring/:offspringId/microchip-registrations
  app.post("/offspring/:offspringId/microchip-registrations", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const offspringId = parseIntStrict((req.params as { offspringId: string }).offspringId);
    if (!offspringId) return reply.code(400).send({ error: "offspring_id_invalid" });

    const offspring = await assertOffspringInTenant(offspringId, tenantId);

    const body = req.body as {
      microchipNumber?: string;
      registryId: number;
      registrationDate?: string;
      expirationDate?: string;
      accountNumber?: string;
      registeredToContactId?: number;
      notes?: string;
    };

    if (!body.registryId) {
      return reply.code(400).send({ error: "registryId_required" });
    }

    const registry = await prisma.microchipRegistry.findUnique({
      where: { id: body.registryId },
    });
    if (!registry) {
      return reply.code(404).send({ error: "registry_not_found" });
    }

    // Microchip number is required for offspring (they don't have a default)
    const microchipNumber = body.microchipNumber?.trim();
    if (!microchipNumber) {
      return reply.code(400).send({ error: "microchipNumber_required" });
    }

    if (registry.renewalType === "ANNUAL" && !body.expirationDate) {
      return reply.code(400).send({ error: "expirationDate_required_for_annual_registry" });
    }

    if (body.registeredToContactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: body.registeredToContactId, tenantId },
      });
      if (!contact) {
        return reply.code(404).send({ error: "contact_not_found" });
      }
    }

    const existing = await prisma.animalMicrochipRegistration.findUnique({
      where: {
        unique_offspring_registry: {
          tenantId,
          offspringId,
          registryId: body.registryId,
        },
      },
    });
    if (existing) {
      return reply.code(409).send({ error: "registration_already_exists_for_this_registry" });
    }

    const registration = await prisma.animalMicrochipRegistration.create({
      data: {
        tenantId,
        offspringId,
        microchipNumber,
        registryId: body.registryId,
        registrationDate: body.registrationDate ? parseDateIso(body.registrationDate) : null,
        expirationDate: body.expirationDate ? parseDateIso(body.expirationDate) : null,
        accountNumber: body.accountNumber || null,
        registeredToContactId: body.registeredToContactId || null,
        notes: body.notes || null,
      },
      include: {
        registry: true,
        registeredTo: {
          select: { id: true, display_name: true, email: true },
        },
      },
    });

    return reply.code(201).send(formatRegistration(registration));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Shared Registration Endpoints (PATCH, DELETE)
  // ──────────────────────────────────────────────────────────────────────────

  // PATCH /api/v1/microchip-registrations/:id
  // Update an existing microchip registration
  app.patch("/microchip-registrations/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const registrationId = parseIntStrict((req.params as { id: string }).id);
    if (!registrationId) return reply.code(400).send({ error: "id_invalid" });

    const existing = await prisma.animalMicrochipRegistration.findFirst({
      where: { id: registrationId, tenantId },
    });
    if (!existing) {
      return reply.code(404).send({ error: "registration_not_found" });
    }

    const body = req.body as {
      microchipNumber?: string;
      registrationDate?: string | null;
      expirationDate?: string | null;
      accountNumber?: string | null;
      registeredToContactId?: number | null;
      notes?: string | null;
    };

    const updates: any = {};

    if (body.microchipNumber !== undefined) {
      updates.microchipNumber = body.microchipNumber.trim();
    }
    if (body.registrationDate !== undefined) {
      updates.registrationDate = body.registrationDate ? parseDateIso(body.registrationDate) : null;
    }
    if (body.expirationDate !== undefined) {
      updates.expirationDate = body.expirationDate ? parseDateIso(body.expirationDate) : null;
    }
    if (body.accountNumber !== undefined) {
      updates.accountNumber = body.accountNumber;
    }
    if (body.registeredToContactId !== undefined) {
      if (body.registeredToContactId) {
        const contact = await prisma.contact.findFirst({
          where: { id: body.registeredToContactId, tenantId },
        });
        if (!contact) {
          return reply.code(404).send({ error: "contact_not_found" });
        }
      }
      updates.registeredToContactId = body.registeredToContactId;
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }

    const registration = await prisma.animalMicrochipRegistration.update({
      where: { id: registrationId },
      data: updates,
      include: {
        registry: true,
        registeredTo: {
          select: { id: true, display_name: true, email: true },
        },
      },
    });

    return reply.send(formatRegistration(registration));
  });

  // DELETE /api/v1/microchip-registrations/:id
  // Delete a microchip registration
  app.delete("/microchip-registrations/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const registrationId = parseIntStrict((req.params as { id: string }).id);
    if (!registrationId) return reply.code(400).send({ error: "id_invalid" });

    const existing = await prisma.animalMicrochipRegistration.findFirst({
      where: { id: registrationId, tenantId },
    });
    if (!existing) {
      return reply.code(404).send({ error: "registration_not_found" });
    }

    await prisma.animalMicrochipRegistration.delete({ where: { id: registrationId } });

    return reply.code(204).send();
  });
};

export default microchipRegistrationsRoutes;
