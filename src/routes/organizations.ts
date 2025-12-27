// src/routes/organizations.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { CommPrefsService } from "../services/comm-prefs-service.js";
import type { CommPreferenceUpdate } from "../services/comm-prefs-service.js";

/* ───────────────────────── helpers ───────────────────────── */

type SortKey = "name" | "createdAt" | "updatedAt";

type OrgWithParty = {
  id: number;
  partyId: number;
  website: string | null;
  party: {
    tenantId: number;
    type: "ORGANIZATION" | "CONTACT";
    name: string;
    email: string | null;
    phoneE164: string | null;
    street: string | null;
    street2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    archived: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
};

function parsePaging(q: any) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 25) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function parseSort(q: any) {
  // Accepts "name:asc,createdAt:desc"
  const s = String(q?.sort || "").trim();
  const allowed: SortKey[] = ["name", "createdAt", "updatedAt"];
  if (!s) return [{ party: { createdAt: "desc" } }] as any[];
  const orderBy: any[] = [];
  for (const piece of s.split(",").map((p: string) => p.trim()).filter(Boolean)) {
    const [fieldRaw, dirRaw] = piece.split(":");
    const field = fieldRaw as SortKey;
    const dir = (dirRaw || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    if (allowed.includes(field)) orderBy.push({ party: { [field]: dir } });
  }
  return orderBy.length ? orderBy : [{ party: { createdAt: "desc" } }];
}

function idNum(v: any) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function isValidOrgParty(org: { party?: { tenantId: number; type: string } } | null, tenantId: number) {
  return !!org?.party && org.party.tenantId === tenantId && org.party.type === "ORGANIZATION";
}

async function getOrgInTenant(orgId: number, tenantId: number) {
  const org = await prisma.organization.findFirst({
    where: { id: orgId, tenantId },
    select: { id: true, partyId: true },
  });
  if (!org) {
    // Hide cross-tenant existence by default, but if you prefer explicit, keep this split:
    const exists = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!exists) throw Object.assign(new Error("not_found"), { statusCode: 404 });
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }
  return org;
}

function errorReply(err: any) {
  if (err?.code === "P2002") {
    // @@unique([tenantId, name])
    return { status: 409, payload: { error: "duplicate_org", detail: "name_must_be_unique_within_tenant" } };
  }
  if (err?.code === "P2003") {
    // FK constraint, likely contacts or animals referencing this org
    return { status: 409, payload: { error: "cannot_delete_org_with_dependents" } };
  }
  if (err?.statusCode) {
    return { status: err.statusCode, payload: { error: err.message } };
  }
  return { status: 500, payload: { error: "internal_error" } };
}

async function toOrgDTO(org: OrgWithParty) {
  // Fetch communication preferences
  let commPreferences: any = null;
  const partyId = org.partyId;
  if (partyId) {
    try {
      const prefs = await CommPrefsService.getCommPreferences(partyId);
      // Convert array to object keyed by channel for easier frontend access
      commPreferences = {};
      for (const pref of prefs) {
        const channel = pref.channel.toLowerCase();
        commPreferences[channel] = pref.preference === 'ALLOW';
        // Also include compliance info
        if (pref.compliance) {
          commPreferences[`${channel}Compliance`] = pref.compliance;
          commPreferences[`${channel}ComplianceSetAt`] = pref.complianceSetAt;
        }
      }
    } catch (err) {
      // If preferences fetch fails, continue without them
      console.error('Failed to fetch comm preferences:', err);
    }
  }

  return {
    id: org.id,
    partyId: org.partyId,
    name: org.party.name,
    email: org.party.email,
    phone: org.party.phoneE164,
    website: org.website,
    street: org.party.street,
    street2: org.party.street2,
    city: org.party.city,
    state: org.party.state,
    zip: org.party.postalCode,
    country: org.party.country,
    archived: org.party.archived,
    createdAt: org.party.createdAt,
    updatedAt: org.party.updatedAt,
    commPrefs: commPreferences,
  };
}

/* ───────────────────────── routes ───────────────────────── */

// Manual verification (dev):
// - POST /api/v1/organizations {"name":"Party QA Org"} -> use returned id (sample uses 8)
// - PATCH /api/v1/organizations/8 {"name":"Party QA Org Renamed"}
// - PATCH /api/v1/contacts/18 {"organizationId":8}
// - GET /api/v1/contacts/18 -> organizationName === "Party QA Org Renamed"
// - SQL: select o.id, o.name, p.name from "Organization" o join "Party" p on p.id=o."partyId" where o.id=8;
const organizationsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /organizations?q=&includeArchived=&page=&limit=&sort=
  app.get("/organizations", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const q = (req.query || {}) as {
        q?: string;
        includeArchived?: string | "1" | "true";
        page?: string;
        limit?: string;
        sort?: string;
      };

      const search = String(q.q || "").trim();
      const includeArchived =
        q.includeArchived === "1" || String(q.includeArchived || "").toLowerCase() === "true";
      const { page, limit, skip } = parsePaging(q);
      const orderBy = parseSort(q);

      const partyWhere: any = { tenantId, type: "ORGANIZATION" };
      if (!includeArchived) partyWhere.archived = false;
      if (search) {
        partyWhere.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phoneE164: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
          { state: { contains: search, mode: "insensitive" } },
          { country: { contains: search, mode: "insensitive" } },
        ];
      }

      const where: any = { tenantId, party: partyWhere };

      const [rows, total] = await prisma.$transaction([
        prisma.organization.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: { party: true },
        }),
        prisma.organization.count({ where }),
      ]);

      const items = await Promise.all(rows.map((org) => toOrgDTO(org as OrgWithParty)));
      reply.send({ items, total, page, limit });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /organizations/:id
  app.get("/organizations/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const org = await prisma.organization.findFirst({
        where: { id, tenantId },
        include: { party: true },
      });
      if (!org) return reply.code(404).send({ error: "not_found" });
      if (!isValidOrgParty(org, tenantId)) return reply.code(404).send({ error: "not_found" });
      reply.send(await toOrgDTO(org as OrgWithParty));
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /organizations
  app.post("/organizations", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const b = (req.body || {}) as Partial<{
        name: string;
        email: string | null;
        phone: string | null;
        website: string | null;
        street: string | null;
        street2: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
        country: string | null;
        archived: boolean;
        externalProvider: string | null;
        externalId: string | null;
      }>;

      const name = String(b.name || "").trim();
      if (!name) return reply.code(400).send({ error: "name_required" });

      const created = await prisma.$transaction(async (tx) => {
        const party = await tx.party.create({
          data: {
            tenantId,
            type: "ORGANIZATION",
            name,
            email: b.email ?? null,
            phoneE164: b.phone ?? null,
            street: b.street ?? null,
            street2: b.street2 ?? null,
            city: b.city ?? null,
            state: b.state ?? null,
            postalCode: b.zip ?? null,
            country: b.country ?? null,
            archived: b.archived ?? false,
          },
        });

        return tx.organization.create({
          data: {
            tenantId,
            partyId: party.id,
            name,
            email: b.email ?? null,
            phone: b.phone ?? null,
            website: b.website ?? null,
            street: b.street ?? null,
            street2: b.street2 ?? null,
            city: b.city ?? null,
            state: b.state ?? null,
            zip: b.zip ?? null,
            country: b.country ?? null,
            archived: b.archived ?? false,
            externalProvider: b.externalProvider ?? null,
            externalId: b.externalId ?? null,
          },
          include: { party: true },
        });
      });

      return reply.code(201).send(await toOrgDTO(created as OrgWithParty));
    } catch (e: any) {
      const { status, payload } = errorReply(e);
      return reply.code(status).send(payload);
    }
  });

  // PATCH /organizations/:id
  app.patch("/organizations/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as Partial<{
        name: string;
        email: string | null;
        phone: string | null;
        website: string | null;
        street: string | null;
        street2: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
        country: string | null;
        archived: boolean;
        externalProvider: string | null;
        externalId: string | null;
      }>;

      const partyData: any = {};
      const orgData: any = {};
      if (b.name !== undefined) {
        const n = String(b.name || "").trim();
        if (!n) return reply.code(400).send({ error: "name_required" });
        partyData.name = n;
        orgData.name = n;
      }
      if (b.email !== undefined) {
        partyData.email = b.email;
        orgData.email = b.email;
      }
      if (b.phone !== undefined) {
        partyData.phoneE164 = b.phone;
        orgData.phone = b.phone;
      }
      if (b.street !== undefined) {
        partyData.street = b.street;
        orgData.street = b.street;
      }
      if (b.street2 !== undefined) {
        partyData.street2 = b.street2;
        orgData.street2 = b.street2;
      }
      if (b.city !== undefined) {
        partyData.city = b.city;
        orgData.city = b.city;
      }
      if (b.state !== undefined) {
        partyData.state = b.state;
        orgData.state = b.state;
      }
      if (b.zip !== undefined) {
        partyData.postalCode = b.zip;
        orgData.zip = b.zip;
      }
      if (b.country !== undefined) {
        partyData.country = b.country;
        orgData.country = b.country;
      }
      if (b.archived !== undefined) {
        const archived = !!b.archived;
        partyData.archived = archived;
        orgData.archived = archived;
      }

      if (b.website !== undefined) orgData.website = b.website;
      if (b.externalProvider !== undefined) orgData.externalProvider = b.externalProvider;
      if (b.externalId !== undefined) orgData.externalId = b.externalId;

      const org = await prisma.organization.findFirst({
        where: { id, tenantId },
        include: { party: true },
      });
      if (!org) return reply.code(404).send({ error: "not_found" });
      if (!isValidOrgParty(org, tenantId)) return reply.code(404).send({ error: "not_found" });

      const hasPartyUpdates = Object.keys(partyData).length > 0;
      const hasOrgUpdates = Object.keys(orgData).length > 0;

      // Handle commPreferences if provided
      const commPreferences = (b as any).commPreferences;
      const hasCommPrefs = commPreferences && Array.isArray(commPreferences);

      const [updatedParty, updatedOrg] = await prisma.$transaction(async (tx) => {
        const party = hasPartyUpdates
          ? await tx.party.update({ where: { id: org.partyId }, data: partyData })
          : org.party;
        const organization = hasOrgUpdates ? await tx.organization.update({ where: { id }, data: orgData }) : org;
        return [party, organization];
      });

      // Update comm preferences after transaction
      if (hasCommPrefs && org.partyId) {
        try {
          const updates: CommPreferenceUpdate[] = commPreferences;
          await CommPrefsService.updateCommPreferences(org.partyId, updates, undefined, "organization_api");
        } catch (prefErr) {
          req.log.warn({ prefErr }, "Failed to update comm preferences");
          // Don't fail the whole request if comm prefs fail
        }
      }

      const merged = { ...updatedOrg, party: updatedParty };
      reply.send(await toOrgDTO(merged as OrgWithParty));
    } catch (e: any) {
      const { status, payload } = errorReply(e);
      reply.status(status).send(payload);
    }
  });

  // POST /organizations/:id/archive
  app.post("/organizations/:id/archive", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const org = await getOrgInTenant(id, tenantId);
      if (!org.partyId) throw Object.assign(new Error("org_missing_party"), { statusCode: 500 });

      await prisma.$transaction(async (tx) => {
        const partyUpdated = await tx.party.updateMany({
          where: { id: org.partyId, tenantId },
          data: { archived: true },
        });
        if (partyUpdated.count == 0) {
          throw Object.assign(new Error("org_missing_party"), { statusCode: 500 });
        }

        await tx.organization.update({ where: { id: org.id }, data: { archived: true } });
      });
      reply.send({ ok: true });
    } catch (e: any) {
      const { status, payload } = errorReply(e);
      reply.status(status).send(payload);
    }
  });

  // POST /organizations/:id/restore
  app.post("/organizations/:id/restore", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const org = await getOrgInTenant(id, tenantId);
      if (!org.partyId) throw Object.assign(new Error("org_missing_party"), { statusCode: 500 });

      await prisma.$transaction(async (tx) => {
        const partyUpdated = await tx.party.updateMany({
          where: { id: org.partyId, tenantId },
          data: { archived: false },
        });
        if (partyUpdated.count == 0) {
          throw Object.assign(new Error("org_missing_party"), { statusCode: 500 });
        }

        await tx.organization.update({ where: { id: org.id }, data: { archived: false } });
      });
      reply.send({ ok: true });
    } catch (e: any) {
      const { status, payload } = errorReply(e);
      reply.status(status).send(payload);
    }
  });

  // DELETE /organizations/:id  (hard delete; tenant enforced; FK-safe)
  app.delete("/organizations/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      await getOrgInTenant(id, tenantId);

      // Preflight check to produce a friendlier error than raw P2003
      const [contactRefCount, animalRefCount] = await Promise.all([
        prisma.contact.count({ where: { organizationId: id, tenantId } }),
        prisma.animal.count({ where: { organizationId: id, tenantId } }),
      ]);
      if (contactRefCount > 0 || animalRefCount > 0) {
        return reply
          .code(409)
          .send({ error: "cannot_delete_org_with_dependents", contacts: contactRefCount, animals: animalRefCount });
      }

      await prisma.organization.delete({ where: { id } });
      reply.send({ ok: true });
    } catch (e: any) {
      const { status, payload } = errorReply(e);
      reply.status(status).send(payload);
    }
  });
};

export default organizationsRoutes;
