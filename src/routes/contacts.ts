// src/routes/contacts.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/**
 * Contact schema alignment
 * - id: Int (PK)
 * - tenantId: Int (required, scope EVERY query)
 * - organizationId: Int? (composite relation with tenantId)
 * - display_name: String (required, derived server-side)
 * - first_name: String?  ← added
 * - last_name: String?   ← added
 * - nickname: String?    ← added
 * - email: String? @db.Citext (unique per-tenant)
 * - phoneE164, whatsappE164: String? @db.VarChar(32)
 * - address fields: street, street2, city, state, zip, country @db.Char(2) for country
 * - archived: Boolean @default(false)
 * - createdAt / updatedAt
 */

type SortKey = "display_name" | "email" | "createdAt" | "updatedAt"; // keep existing sort surface

/* ───────────────────────── helpers ───────────────────────── */

function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q?.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q?.limit ?? "25", 10) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function parseSort(q: any) {
  // "display_name:asc,email:desc"
  const s = String(q?.sort || "").trim();
  if (!s) return [{ createdAt: "desc" }] as any;
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  const orderBy: any[] = [];
  const allowed: SortKey[] = ["display_name", "email", "createdAt", "updatedAt"];
  for (const p of parts) {
    const [rawField, rawDir] = p.split(":");
    const field = rawField as SortKey;
    const dir = (rawDir || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    if (allowed.includes(field)) orderBy.push({ [field]: dir });
  }
  return orderBy.length ? orderBy : [{ createdAt: "desc" }];
}

function idNum(v: any) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function trimToNull(v: any) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function deriveDisplayName(nickname: string | null, firstName: string | null, lastName: string | null) {
  const base = nickname || firstName || "";
  return [base, lastName].filter(Boolean).join(" ").trim();
}

// Map full country names to ISO 3166-1 alpha-2 codes
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  "United States": "US",
  "United States of America": "US",
  "USA": "US",
  "Canada": "CA",
  "United Kingdom": "GB",
  "UK": "GB",
  "Australia": "AU",
  "New Zealand": "NZ",
  "Ireland": "IE",
  "Germany": "DE",
  "France": "FR",
  "Spain": "ES",
  "Italy": "IT",
  "Netherlands": "NL",
  "Belgium": "BE",
  "Switzerland": "CH",
  "Austria": "AT",
  "Sweden": "SE",
  "Norway": "NO",
  "Denmark": "DK",
  "Finland": "FI",
  "Poland": "PL",
  "Portugal": "PT",
  "Greece": "GR",
  "Czech Republic": "CZ",
  "Mexico": "MX",
  "Brazil": "BR",
  "Argentina": "AR",
  "Chile": "CL",
  "Japan": "JP",
  "China": "CN",
  "India": "IN",
  "South Korea": "KR",
  "Singapore": "SG",
  "Hong Kong": "HK",
  "Taiwan": "TW",
  "Israel": "IL",
  "South Africa": "ZA",
};

function normalizeCountry(raw: any): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // If already 2-char code, return uppercase
  if (s.length === 2) return s.toUpperCase();
  // Try mapping from full name
  return COUNTRY_NAME_TO_CODE[s] || null;
}

function errorReply(err: any) {
  if (err?.code === "P2002") {
    // unique constraint (likely [tenantId, email])
    return {
      status: 409,
      payload: {
        error: "conflict",
        message: "Email must be unique within this tenant.",
        fieldErrors: { email: "Email must be unique within this tenant." },
      },
    };
  }
  if (err?.status) {
    return { status: err.status, payload: { error: err.message || "error", message: err.message || "error" } };
  }
  // Log full error details for debugging
  console.error("[errorReply] Unhandled error:", err);
  return { status: 500, payload: { error: "internal_error", detail: err?.message || "unknown" } };
}

/* if you attach auth to req.user, enforce here (kept no-op for compatibility) */
const ensureAuth = (_req: any) => {
  // if (!(_req as any).user) throw { status: 401, message: "unauthorized" };
};

/* ───────────────────────── routes ───────────────────────── */

const contactsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /contacts
  app.get("/contacts", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const q = (req.query as any) ?? {};
      const { page, limit, skip } = parsePaging(q);
      const includeArchived = String(q.includeArchived ?? "false").toLowerCase() === "true";
      const search = trimToNull(q.search ?? q.q);
      const orderBy = parseSort(q);

      const where: any = { tenantId };
      if (!includeArchived) where.archived = false;
      if (search) {
        where.OR = [
          { party: { name: { contains: search, mode: "insensitive" } } },
          { party: { email: { contains: search } } },
          { party: { phoneE164: { contains: search } } },
          { display_name: { contains: search, mode: "insensitive" } },
          { first_name: { contains: search, mode: "insensitive" } }, // ← added
          { last_name: { contains: search, mode: "insensitive" } }, // ← added
          { nickname: { contains: search, mode: "insensitive" } }, // ← added
          { email: { contains: search, mode: "insensitive" } },
          { phoneE164: { contains: search, mode: "insensitive" } },
          { whatsappE164: { contains: search, mode: "insensitive" } },
        ];
      }

      const [total, rows] = await Promise.all([
        prisma.contact.count({ where }),
        prisma.contact.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          select: {
            id: true,
            tenantId: true,
            organizationId: true,
            display_name: true,
            first_name: true,   // ← added
            last_name: true,    // ← added
            nickname: true,     // ← added
            email: true,
            phoneE164: true,
            whatsappE164: true,
            street: true,
            street2: true,
            city: true,
            state: true,
            zip: true,
            country: true,
            archived: true,
            createdAt: true,
            updatedAt: true,
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
      ]);

      // Flatten organization name to top level for frontend compatibility
      const itemsWithOrgName = rows.map((row) => ({
        ...row,
        organizationName: row.organization?.name ?? null,
        organization: undefined,
      }));

      return reply.send({ items: itemsWithOrgName, total, page, limit });
    } catch (err) {
      req.log?.error?.(err as any);
      return reply.code(500).send({ error: "contacts_unavailable" });
    }
  });

  // GET /contacts/:id
  app.get("/contacts/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const row = await prisma.contact.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          tenantId: true,
          organizationId: true,
          display_name: true,
          first_name: true,   // ← added
          last_name: true,    // ← added
          nickname: true,     // ← added
          email: true,
          phoneE164: true,
          whatsappE164: true,
          street: true,
          street2: true,
          city: true,
          state: true,
          zip: true,
          country: true,
          archived: true,
          createdAt: true,
          updatedAt: true,
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      if (!row) return reply.code(404).send({ error: "not_found" });

      // Flatten organization name to top level for frontend compatibility
      const response = {
        ...row,
        organizationName: row.organization?.name ?? null,
        organization: undefined, // Remove nested object
      };

      return reply.send(response);
    } catch (err) {
      req.log?.error?.(err as any);
      return reply.code(500).send({ error: "get_failed" });
    }
  });

  // POST /contacts
  app.post("/contacts", async (req, reply) => {
    try {
      ensureAuth(req);

      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      req.log?.info?.({ body: req.body }, "[POST /contacts] Request body");

      const body = (req.body as any) ?? {};
      const firstName = trimToNull(body.firstName ?? body.first_name);
      const lastName = trimToNull(body.lastName ?? body.last_name);
      const nickname = trimToNull(body.nickname);
      const email = trimToNull(body.email);
      const phoneE164 = trimToNull(
        body.phoneE164 ?? body.phone ?? body.phoneMobileE164 ?? body.phoneLandlineE164
      );
      const whatsappE164 = trimToNull(body.whatsappE164 ?? body.whatsapp);
      const street = trimToNull(body.street);
      const street2 = trimToNull(body.street2);
      const city = trimToNull(body.city);
      const state = trimToNull(body.state);
      const zip = trimToNull(body.postalCode ?? body.zip);
      const country = normalizeCountry(body.country);

      const fieldErrors: Record<string, string> = {};
      if (!firstName) fieldErrors.firstName = "First name is required.";
      if (!lastName) fieldErrors.lastName = "Last name is required.";
      if (Object.keys(fieldErrors).length > 0) {
        return reply.code(400).send({ message: "Validation failed", fieldErrors });
      }

      const display_name = deriveDisplayName(nickname, firstName, lastName);
      if (!display_name || !display_name.trim()) {
        return reply.code(400).send({
          message: "Validation failed",
          fieldErrors: { displayName: "Display name cannot be empty. Please provide first and last name." },
        });
      }

      // Optional org linkage, must be same-tenant if provided
      let organizationId: number | null = null;
      if (Object.prototype.hasOwnProperty.call(body, "organizationId") || Object.prototype.hasOwnProperty.call(body, "organization_id")) {
        const rawOrg = body.organizationId ?? body.organization_id;
        if (rawOrg == null || String(rawOrg).trim() === "") {
          organizationId = null;
        } else {
          const orgId = idNum(rawOrg);
          if (!orgId) {
            return reply.code(400).send({
              message: "Validation failed",
              fieldErrors: { organizationId: "Organization is invalid." },
            });
          }
          const org = await prisma.organization.findFirst({ where: { id: orgId, tenantId }, select: { id: true } });
          if (!org) {
            return reply.code(400).send({
              message: "Validation failed",
              fieldErrors: { organizationId: "Organization not found." },
            });
          }
          organizationId = org.id;
        }
      }

      const created = await prisma.contact.create({
        data: {
          tenantId,
          organizationId,
          display_name,
          first_name: firstName,  // added
          last_name: lastName,   // added
          nickname,    // added
          email,
          phoneE164,
          whatsappE164,
          street,
          street2,
          city,
          state,
          zip,
          country,
          archived: body.archived === true, // rarely set on create
        },
        select: {
          id: true,
          tenantId: true,
          organizationId: true,
          display_name: true,
          first_name: true,   // ← added
          last_name: true,    // ← added
          nickname: true,     // ← added
          email: true,
          phoneE164: true,
          whatsappE164: true,
          street: true,
          street2: true,
          city: true,
          state: true,
          zip: true,
          country: true,
          archived: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.code(201).send(created);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // PATCH /contacts/:id
  // helpers at top of file (or near this route)
  function contactDTO(row: any) {
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenantId,
      displayName: row.display_name,
      firstName: row.first_name ?? null,
      lastName: row.last_name ?? null,
      nickname: row.nickname ?? null,
      email: row.email ?? null,
      phone: row.phoneE164 ?? null,
      whatsapp: row.whatsappE164 ?? null,
      street: row.street ?? null,
      street2: row.street2 ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      postalCode: row.zip ?? null,
      country: row.country ?? null,
      notes: row.notes ?? null,           // if you don’t have notes, drop this line
      archived: row.archived,
      organizationId: row.organizationId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  function setIfProvided(
    src: Record<string, any>,
    dst: Record<string, any>,
    srcKey: string,
    dbKey: string,
    transform?: (v: any) => any
  ) {
    if (Object.prototype.hasOwnProperty.call(src, srcKey)) {
      const v = src[srcKey];
      dst[dbKey] = transform ? transform(v) : v;
    }
  }

  // ---------- PATCH /contacts/:id ----------
  app.patch<{
    Params: { id: string };
    Body: Partial<{
      firstName: string | null;
      lastName: string | null;
      nickname: string | null;
      email: string | null;
      phone: string | null;         // maps to phoneE164
      whatsapp: string | null;      // maps to whatsappE164
      street: string | null;
      street2: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;    // maps to zip
      country: string | null;
      notes: string | null;         // drop if your schema doesn’t have a notes column
      archived: boolean;
      organizationId: number | null;
    }>;
  }>("/contacts/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const contactId = Number(req.params.id);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return reply.code(400).send({ error: "invalid_contact_id" });
    }

    // Ensure contact exists in this tenant
    const existing = await app.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { id: true, organizationId: true, first_name: true, last_name: true, nickname: true },
    });
    if (!existing) return reply.code(404).send({ error: "contact_not_found" });

    const body = (req.body || {}) as Record<string, any>;

    // Build Prisma data (snake_case) from camelCase body
    const dataCore: Record<string, any> = {};
    const trimOrNull = trimToNull;

    setIfProvided(body, dataCore, "firstName", "first_name", trimOrNull);
    setIfProvided(body, dataCore, "first_name", "first_name", trimOrNull);
    setIfProvided(body, dataCore, "lastName", "last_name", trimOrNull);
    setIfProvided(body, dataCore, "last_name", "last_name", trimOrNull);
    setIfProvided(body, dataCore, "nickname", "nickname", trimOrNull);
    setIfProvided(body, dataCore, "email", "email", trimOrNull);

    // special mappings
    const hasPhone = ["phoneE164", "phone", "phoneMobileE164", "phoneLandlineE164"].some((k) =>
      Object.prototype.hasOwnProperty.call(body, k)
    );
    if (hasPhone) {
      dataCore.phoneE164 = trimOrNull(body.phoneE164 ?? body.phone ?? body.phoneMobileE164 ?? body.phoneLandlineE164);
    }

    const hasWhatsapp = ["whatsappE164", "whatsapp"].some((k) => Object.prototype.hasOwnProperty.call(body, k));
    if (hasWhatsapp) {
      dataCore.whatsappE164 = trimOrNull(body.whatsappE164 ?? body.whatsapp);
    }

    setIfProvided(body, dataCore, "postalCode", "zip", trimOrNull);
    setIfProvided(body, dataCore, "zip", "zip", trimOrNull);

    // address
    setIfProvided(body, dataCore, "street", "street", trimOrNull);
    setIfProvided(body, dataCore, "street2", "street2", trimOrNull);
    setIfProvided(body, dataCore, "city", "city", trimOrNull);
    setIfProvided(body, dataCore, "state", "state", trimOrNull);
    setIfProvided(body, dataCore, "country", "country", normalizeCountry);

    // optional notes (remove if not in DB)
    setIfProvided(body, dataCore, "notes", "notes", trimOrNull);

    if (Object.prototype.hasOwnProperty.call(body, "archived")) {
      dataCore.archived = body.archived === true;
    }

    // Handle organizationId separately (validate tenant, allow null to clear)
    if (Object.prototype.hasOwnProperty.call(body, "organizationId") || Object.prototype.hasOwnProperty.call(body, "organization_id")) {
      const orgVal = body.organizationId ?? body.organization_id;
      if (orgVal === null || String(orgVal).trim() === "") {
        dataCore.organizationId = null; // clear link
      } else {
        const orgId = Number(orgVal);
        if (!Number.isInteger(orgId) || orgId <= 0) {
          return reply.code(400).send({
            message: "Validation failed",
            fieldErrors: { organizationId: "Organization is invalid." },
          });
        }
        const org = await app.prisma.organization.findFirst({
          where: { id: orgId, tenantId },
          select: { id: true },
        });
        if (!org) {
          return reply.code(400).send({
            message: "Validation failed",
            fieldErrors: { organizationId: "Organization not found." },
          });
        }
        dataCore.organizationId = org.id;
      }
    }

    const nameKeys = ["firstName", "lastName", "nickname", "first_name", "last_name"];
    const hasNameUpdate = nameKeys.some((k) => Object.prototype.hasOwnProperty.call(body, k));
    if (hasNameUpdate) {
      const nextFirst =
        Object.prototype.hasOwnProperty.call(dataCore, "first_name") ? dataCore.first_name : existing.first_name;
      const nextLast =
        Object.prototype.hasOwnProperty.call(dataCore, "last_name") ? dataCore.last_name : existing.last_name;
      const nextNick =
        Object.prototype.hasOwnProperty.call(dataCore, "nickname") ? dataCore.nickname : existing.nickname;

      const nameErrors: Record<string, string> = {};
      if (!nextFirst) nameErrors.firstName = "First name is required.";
      if (!nextLast) nameErrors.lastName = "Last name is required.";
      if (Object.keys(nameErrors).length > 0) {
        return reply.code(400).send({ message: "Validation failed", fieldErrors: nameErrors });
      }

      dataCore.display_name = deriveDisplayName(nextNick, nextFirst, nextLast);
    }

    if (Object.keys(dataCore).length === 0) {
      return reply.code(400).send({ error: "no_update_fields" });
    }

    try {
      const updatedDb = await app.prisma.contact.update({
        where: { id: existing.id },
        data: dataCore,
        // select snake_case, then map to camelCase DTO
        select: {
          id: true,
          tenantId: true,
          display_name: true,
          first_name: true,
          last_name: true,
          nickname: true,
          email: true,
          phoneE164: true,
          whatsappE164: true,
          street: true,
          street2: true,
          city: true,
          state: true,
          zip: true,
          country: true,
          // notes: true, // uncomment if you have this field in your schema
          archived: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const response = {
        ...contactDTO(updatedDb),
        organizationName: updatedDb.organization?.name ?? null,
      };

      return reply.send(response);
    } catch (err: any) {
      req.log.error({ err }, "contacts.patch failed");
      if (err?.code === "P2002") {
        return reply.code(409).send({ error: "conflict", detail: "unique_constraint_violation" });
      }
      if (err?.code === "P2003") {
        return reply.code(400).send({ error: "foreign_key_violation" });
      }
      return reply.code(500).send({ error: "internal_error", detail: err?.message || "unexpected" });
    }
  });

  // POST /contacts/:id/archive
  app.post("/contacts/:id/archive", async (req, reply) => {
    try {
      ensureAuth(req);

      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const updated = await prisma.contact.update({
        where: { id },
        data: { archived: true },
        select: { id: true, archived: true, updatedAt: true },
      });

      return reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // POST /contacts/:id/restore
  app.post("/contacts/:id/restore", async (req, reply) => {
    try {
      ensureAuth(req);

      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const updated = await prisma.contact.update({
        where: { id },
        data: { archived: false },
        select: { id: true, archived: true, updatedAt: true },
      });

      return reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // GET /contacts/:id/audit  (stub until wired to real audit log)
  app.get("/contacts/:id/audit", async (_req, reply) => {
    return reply.send([] as any[]);
  });

  // GET /contacts/:id/affiliations  (returns org if present)
  app.get("/contacts/:id/affiliations", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = idNum((req.params as any).id);
    if (!id) return reply.code(400).send({ error: "bad_id" });

    const c = await prisma.contact.findFirst({
      where: { id, tenantId },
      select: { organizationId: true },
    });
    if (!c) return reply.code(404).send({ error: "not_found" });

    if (!c.organizationId) return reply.send([]);

    const org = await prisma.organization.findFirst({
      where: { id: c.organizationId, tenantId },
      select: { id: true, name: true, email: true, phone: true },
    });

    return reply.send(org ? [org] : []);
  });

  // GET /contacts/:id/animals
  app.get("/contacts/:id/animals", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const contactId = idNum((req.params as any).id);
    if (!contactId) return reply.code(400).send({ error: "bad_id" });

    // Verify contact exists in tenant
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { id: true },
    });
    if (!contact) return reply.code(404).send({ error: "contact_not_found" });

    // Find all animal ownerships for this contact
    const ownerships = await prisma.animalOwner.findMany({
      where: { contactId },
      orderBy: [{ isPrimary: "desc" }, { percent: "desc" }],
      select: {
        id: true,
        animalId: true,
        percent: true,
        isPrimary: true,
        animal: {
          select: {
            id: true,
            tenantId: true,
            name: true,
            species: true,
            sex: true,
            status: true,
            birthDate: true,
            microchip: true,
            breed: true,
            photoUrl: true,
            archived: true,
          },
        },
      },
    });

    // Filter to only animals in this tenant
    const animals = ownerships
      .filter(o => o.animal.tenantId === tenantId)
      .map(o => ({
        ...o.animal,
        owners: [{
          contactId,
          percent: o.percent,
          isPrimary: o.isPrimary,
          partyType: "Contact",
        }],
      }));

    return reply.send({ items: animals, total: animals.length });
  });
};


export default contactsRoutes;
