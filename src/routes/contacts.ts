// src/routes/contacts.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { MarketplaceBlockLevel } from "@prisma/client";
import prisma from "../prisma.js";
import { CommPrefsService } from "../services/comm-prefs-service.js";
import type { CommPreferenceUpdate } from "../services/comm-prefs-service.js";
import {
  blockUser,
  unblockUser,
  getBlockedUsers,
} from "../services/marketplace-block.js";
import { checkQuota } from "../middleware/quota-enforcement.js";
import { updateUsageSnapshot } from "../services/subscription/usage-service.js";
import { activeOnly } from "../utils/query-helpers.js";
import { auditCreate, auditUpdate, auditDelete, type AuditContext } from "../services/audit-trail.js";
import { logEntityActivity } from "../services/activity-log.js";

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
type SortDir = "asc" | "desc";

/* ───────────────────────── helpers ───────────────────────── */

function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q?.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q?.limit ?? "25", 10) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function parseSort(q: any, defaultDir: SortDir) {
  // "display_name:asc,email:desc"
  const s = String(q?.sort || "").trim();
  if (!s) return [{ createdAt: "desc" }] as any;
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  const orderBy: any[] = [];
  const allowed: SortKey[] = ["display_name", "email", "createdAt", "updatedAt"];
  for (const p of parts) {
    const [rawField, rawDir] = p.split(":");
    const field = rawField as SortKey;
    let dir = defaultDir;
    if (rawDir) {
      const normalized = rawDir.toLowerCase();
      if (normalized === "asc" || normalized === "desc") dir = normalized;
    }
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

const PARTY_SELECT = {
  select: {
    name: true,
    email: true,
    phoneE164: true,
    whatsappE164: true,
    street: true,
    street2: true,
    city: true,
    state: true,
    postalCode: true,
    country: true,
  },
};

const ORGANIZATION_SELECT = {
  select: {
    id: true,
    name: true,
    archived: true,
    party: { select: { name: true, archived: true } },
  },
};

function resolveOrganizationName(organization: any, includeArchived: boolean) {
  if (!organization || !organization.party) return null;
  if (!includeArchived && (organization.archived || organization.party.archived)) return null;
  return organization.party.name ?? null;
}

/** Convert comm prefs array to keyed object for frontend */
function formatCommPrefs(prefs: import("../services/comm-prefs-service.js").CommPreferenceRead[]): Record<string, any> {
  const commPreferences: Record<string, any> = {};
  for (const pref of prefs) {
    const channel = pref.channel.toLowerCase();
    commPreferences[channel] = pref.preference;
    if (channel === 'email' || channel === 'sms') {
      commPreferences[`${channel}Compliance`] = pref.compliance;
      commPreferences[`${channel}ComplianceSetAt`] = pref.complianceSetAt;
      commPreferences[`${channel}ComplianceSource`] = pref.complianceSource;
    }
  }
  return commPreferences;
}

function toContactRow(row: any, options: { includeArchivedOrg?: boolean; commPrefs?: Record<string, any> | null } = {}) {
  const { organization, party, ...rest } = row;
  const hasParty = !!party;
  const includeArchivedOrg = options.includeArchivedOrg ?? true;

  return {
    ...rest,
    display_name: hasParty ? party.name : rest.display_name,
    email: hasParty ? party.email : rest.email,
    phoneE164: hasParty ? party.phoneE164 : rest.phoneE164,
    whatsappE164: hasParty ? party.whatsappE164 : rest.whatsappE164,
    street: hasParty ? party.street : rest.street,
    street2: hasParty ? party.street2 : rest.street2,
    city: hasParty ? party.city : rest.city,
    state: hasParty ? party.state : rest.state,
    zip: hasParty ? party.postalCode : rest.zip,
    country: hasParty ? party.country : rest.country,
    organizationName: resolveOrganizationName(organization, includeArchivedOrg),
    commPrefs: options.commPrefs ?? null,
  };
}

/** Single-row variant that fetches comm prefs individually (for detail/update endpoints) */
async function toContactResponse(row: any, options: { includeArchivedOrg?: boolean } = {}) {
  let commPrefs: Record<string, any> | null = null;
  if (row.partyId) {
    try {
      const prefs = await CommPrefsService.getCommPreferences(row.partyId);
      commPrefs = formatCommPrefs(prefs);
    } catch (err) {
      console.error('Failed to fetch comm preferences:', err);
    }
  }
  return toContactRow(row, { includeArchivedOrg: options.includeArchivedOrg, commPrefs });
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

/** Build AuditContext from a Fastify request */
function auditCtx(req: any, tenantId: number): AuditContext {
  return {
    tenantId,
    userId: String((req as any).userId ?? "unknown"),
    userName: (req as any).userName ?? undefined,
    changeSource: "PLATFORM",
    ip: req.ip,
    requestId: req.id,
  };
}

/* ───────────────────────── routes ───────────────────────── */

// Manual verification (dev):
// - POST /api/v1/organizations {"name":"Party QA Org"} -> use returned id (sample uses 8)
// - PATCH /api/v1/organizations/8 {"name":"Party QA Org Renamed"}
// - PATCH /api/v1/contacts/18 {"organizationId":8}
// - GET /api/v1/contacts/18 -> organizationName === "Party QA Org Renamed"
// - SQL: select o.id, o.name, p.name from "Organization" o join "Party" p on p.id=o."partyId" where o.id=8;
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
      const dirRaw = String(q.dir ?? "asc").trim();
      const dirNormalized = (dirRaw || "asc").toLowerCase();
      // Sanity check: only allow asc/desc so direction typos fail fast.
      if (dirNormalized !== "asc" && dirNormalized !== "desc") return reply.code(400).send({ error: "bad_request" });
      const dir = dirNormalized as SortDir;
      const orderBy = parseSort(q, dir);

      const where: any = { tenantId };
      if (!includeArchived) where.archived = false;
      if (search) {
        const organizationNameMatch = includeArchived
          ? { organization: { party: { name: { contains: search, mode: "insensitive" } } } }
          : {
              organization: {
                is: {
                  archived: false,
                  party: {
                    is: {
                      archived: false,
                      name: { contains: search, mode: "insensitive" },
                    },
                  },
                },
              },
            };
        where.OR = [
          { party: { name: { contains: search, mode: "insensitive" } } },
          organizationNameMatch,
          { party: { email: { contains: search } } },
          { party: { phoneE164: { contains: search } } },
          { party: { whatsappE164: { contains: search } } },
          { display_name: { contains: search, mode: "insensitive" } },
          { first_name: { contains: search, mode: "insensitive" } }, // ← added
          { last_name: { contains: search, mode: "insensitive" } }, // ← added
          { nickname: { contains: search, mode: "insensitive" } }, // ← added
          { email: { contains: search, mode: "insensitive" } },
          { phoneE164: { contains: search, mode: "insensitive" } },
          { whatsappE164: { contains: search, mode: "insensitive" } },
        ];
      }

      const whereWithActive = activeOnly(where);
      const [total, rows] = await Promise.all([
        prisma.contact.count({ where: whereWithActive }),
        prisma.contact.findMany({
          where: whereWithActive,
          skip,
          take: limit,
          orderBy,
          select: {
            id: true,
            tenantId: true,
            partyId: true,
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
            organization: ORGANIZATION_SELECT,
            party: PARTY_SELECT,
          },
        }),
      ]);

      // Batch-fetch comm preferences in a single query (avoids N+1)
      const partyIds = rows.map((r) => r.partyId).filter((id): id is number => id != null && id > 0);
      let prefsMap = new Map<number, import("../services/comm-prefs-service.js").CommPreferenceRead[]>();
      try {
        prefsMap = await CommPrefsService.getCommPreferencesBatch(partyIds);
      } catch (err) {
        req.log?.warn?.(err as any, "Failed to batch-fetch comm preferences");
      }

      const items = rows.map((row) => {
        const prefs = row.partyId ? prefsMap.get(row.partyId) : undefined;
        return toContactRow(row, { commPrefs: prefs ? formatCommPrefs(prefs) : null });
      });

      return reply.send({ items, total, page, limit });
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

      const q = (req.query as any) ?? {};
      const includeArchived = String(q.includeArchived ?? "false").toLowerCase() === "true";

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const row = await prisma.contact.findFirst({
        where: activeOnly({ id, tenantId }),
        select: {
          id: true,
          tenantId: true,
          partyId: true,
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
          organization: ORGANIZATION_SELECT,
          party: PARTY_SELECT,
        },
      });
      if (!row) return reply.code(404).send({ error: "not_found" });

      return reply.send(await toContactResponse(row, { includeArchivedOrg: includeArchived }));
    } catch (err) {
      req.log?.error?.(err as any);
      return reply.code(500).send({ error: "get_failed" });
    }
  });

  // POST /contacts
  app.post(
    "/contacts",
    {
      preHandler: [checkQuota("CONTACT_COUNT")],
    },
    async (req, reply) => {
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

      const archived = body.archived === true;
      // Expected: contact create/patch keeps Party and Contact identity fields in sync.
      const created = await prisma.$transaction(async (tx) => {
        const party = await tx.party.create({
          data: {
            tenantId,
            type: "CONTACT",
            name: display_name,
            email,
            phoneE164,
            whatsappE164,
            street,
            street2,
            city,
            state,
            postalCode: zip,
            country,
            archived,
          },
        });

        return tx.contact.create({
          data: {
            tenantId,
            partyId: party.id,
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
            archived, // rarely set on create
          },
          select: {
            id: true,
            tenantId: true,
            partyId: true,
            organizationId: true,
            display_name: true,
            first_name: true,   //   added
            last_name: true,    //   added
            nickname: true,     //   added
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
      });

      // Update usage snapshot after successful creation
      await updateUsageSnapshot(tenantId, "CONTACT_COUNT");

      // Audit trail + activity log (fire-and-forget)
      const ctx = auditCtx(req, tenantId);
      auditCreate("CONTACT", created.id, created as any, ctx);
      logEntityActivity({
        tenantId,
        entityType: "CONTACT",
        entityId: created.id,
        kind: "contact_created",
        category: "system",
        title: `Contact created`,
        actorId: ctx.userId,
        actorName: ctx.userName,
      });

      return reply.code(201).send(created);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
    }
  );

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
      where: activeOnly({ id: contactId, tenantId }),
      select: {
        id: true,
        partyId: true,
        organizationId: true,
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
        archived: true,
      },
    });
    if (!existing) return reply.code(404).send({ error: "contact_not_found" });

    const body = (req.body || {}) as Record<string, any>;

    // Build Prisma data (snake_case) from camelCase body
    const dataCore: Record<string, any> = {};
    const partyData: Record<string, any> = {};
    const trimOrNull = trimToNull;

    setIfProvided(body, dataCore, "firstName", "first_name", trimOrNull);
    setIfProvided(body, dataCore, "first_name", "first_name", trimOrNull);
    setIfProvided(body, dataCore, "lastName", "last_name", trimOrNull);
    setIfProvided(body, dataCore, "last_name", "last_name", trimOrNull);
    setIfProvided(body, dataCore, "nickname", "nickname", trimOrNull);
    if (Object.prototype.hasOwnProperty.call(body, "email")) {
      const nextEmail = trimOrNull(body.email);
      dataCore.email = nextEmail;
      partyData.email = nextEmail;
    }

    // special mappings
    const hasPhone = ["phoneE164", "phone", "phoneMobileE164", "phoneLandlineE164"].some((k) =>
      Object.prototype.hasOwnProperty.call(body, k)
    );
    if (hasPhone) {
      const nextPhone = trimOrNull(body.phoneE164 ?? body.phone ?? body.phoneMobileE164 ?? body.phoneLandlineE164);
      dataCore.phoneE164 = nextPhone;
      partyData.phoneE164 = nextPhone;
    }

    const hasWhatsapp = ["whatsappE164", "whatsapp"].some((k) => Object.prototype.hasOwnProperty.call(body, k));
    if (hasWhatsapp) {
      const nextWhatsapp = trimOrNull(body.whatsappE164 ?? body.whatsapp);
      dataCore.whatsappE164 = nextWhatsapp;
      partyData.whatsappE164 = nextWhatsapp;
    }

    const hasPostal = Object.prototype.hasOwnProperty.call(body, "postalCode") || Object.prototype.hasOwnProperty.call(body, "zip");
    if (hasPostal) {
      const nextZip = trimOrNull(body.postalCode ?? body.zip);
      dataCore.zip = nextZip;
      partyData.postalCode = nextZip;
    }

    if (Object.prototype.hasOwnProperty.call(body, "street")) {
      const nextStreet = trimOrNull(body.street);
      dataCore.street = nextStreet;
      partyData.street = nextStreet;
    }
    if (Object.prototype.hasOwnProperty.call(body, "street2")) {
      const nextStreet2 = trimOrNull(body.street2);
      dataCore.street2 = nextStreet2;
      partyData.street2 = nextStreet2;
    }
    if (Object.prototype.hasOwnProperty.call(body, "city")) {
      const nextCity = trimOrNull(body.city);
      dataCore.city = nextCity;
      partyData.city = nextCity;
    }
    if (Object.prototype.hasOwnProperty.call(body, "state")) {
      const nextState = trimOrNull(body.state);
      dataCore.state = nextState;
      partyData.state = nextState;
    }
    if (Object.prototype.hasOwnProperty.call(body, "country")) {
      const nextCountry = normalizeCountry(body.country);
      dataCore.country = nextCountry;
      partyData.country = nextCountry;
    }

    // optional notes (remove if not in DB)
    setIfProvided(body, dataCore, "notes", "notes", trimOrNull);

    if (Object.prototype.hasOwnProperty.call(body, "archived")) {
      const isArchived = body.archived === true;
      dataCore.archived = isArchived;
      partyData.archived = isArchived;
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
      partyData.name = dataCore.display_name;
    }

    // Handle commPreferences if provided
    let commPreferences: any = null;
    if (body.commPreferences && Array.isArray(body.commPreferences)) {
      // We'll update these after the transaction
      commPreferences = body.commPreferences;
    }

    // Allow updating just preferences, or require at least one field to update
    if (Object.keys(dataCore).length === 0 && !commPreferences) {
      return reply.code(400).send({ error: "no_update_fields" });
    }

    try {
      const updatedDb = await app.prisma.$transaction(async (tx) => {
        let partyId = existing.partyId;

        if (!partyId) {
          const partyName =
            dataCore.display_name ??
            existing.display_name ??
            deriveDisplayName(existing.nickname, existing.first_name, existing.last_name);

          const party = await tx.party.create({
            data: {
              tenantId,
              type: "CONTACT",
              name: partyName,
              email: Object.prototype.hasOwnProperty.call(partyData, "email") ? partyData.email : existing.email,
              phoneE164: Object.prototype.hasOwnProperty.call(partyData, "phoneE164") ? partyData.phoneE164 : existing.phoneE164,
              whatsappE164: Object.prototype.hasOwnProperty.call(partyData, "whatsappE164") ? partyData.whatsappE164 : existing.whatsappE164,
              street: Object.prototype.hasOwnProperty.call(partyData, "street") ? partyData.street : existing.street,
              street2: Object.prototype.hasOwnProperty.call(partyData, "street2") ? partyData.street2 : existing.street2,
              city: Object.prototype.hasOwnProperty.call(partyData, "city") ? partyData.city : existing.city,
              state: Object.prototype.hasOwnProperty.call(partyData, "state") ? partyData.state : existing.state,
              postalCode: Object.prototype.hasOwnProperty.call(partyData, "postalCode") ? partyData.postalCode : existing.zip,
              country: Object.prototype.hasOwnProperty.call(partyData, "country") ? partyData.country : existing.country,
              archived: Object.prototype.hasOwnProperty.call(partyData, "archived") ? partyData.archived : existing.archived,
            },
          });

          partyId = party.id;
          dataCore.partyId = partyId;
        }

        if (partyId && existing.partyId && Object.keys(partyData).length > 0) {
          await tx.party.update({ where: { id: partyId, tenantId }, data: partyData }); // tenant-isolated
        }

        // Only update contact if we have changes to make
        if (Object.keys(dataCore).length > 0) {
          return tx.contact.update({
            where: { id: existing.id, tenantId }, // tenant-isolated mutation
            data: dataCore,
            select: {
              id: true,
              tenantId: true,
              organizationId: true,
              partyId: true,
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
              createdAt: true,
              updatedAt: true,
              organization: ORGANIZATION_SELECT,
              party: PARTY_SELECT,
            },
          });
        } else {
          // No contact fields to update, just fetch current data
          return tx.contact.findUnique({
            where: { id: existing.id },
            select: {
              id: true,
              tenantId: true,
              organizationId: true,
              partyId: true,
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
              createdAt: true,
              updatedAt: true,
              organization: ORGANIZATION_SELECT,
              party: PARTY_SELECT,
            },
          });
        }
      });

      if (!updatedDb) {
        return reply.code(404).send({ error: "contact_not_found" });
      }

      // Handle comm preferences update after transaction
      const finalPartyId = updatedDb.partyId || existing.partyId;
      if (commPreferences && finalPartyId) {
        try {
          const updates: CommPreferenceUpdate[] = commPreferences;
          await CommPrefsService.updateCommPreferences(finalPartyId, updates, undefined, "contact_api");
        } catch (prefErr) {
          req.log.warn({ prefErr }, "Failed to update comm preferences");
          // Don't fail the whole request if comm prefs fail
        }
      }

      // Audit trail (fire-and-forget) — existing snapshot captured before update
      if (existing) {
        auditUpdate("CONTACT", contactId, existing as any, updatedDb as any, auditCtx(req, tenantId));
      }

      return reply.send(await toContactResponse(updatedDb));
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

      const contact = await prisma.contact.findFirst({
        where: activeOnly({ id, tenantId }),
        select: { id: true, tenantId: true, partyId: true },
      });
      if (!contact) return reply.code(404).send({ error: "not_found" });
      const partyId = contact.partyId;
      if (partyId == null) return reply.code(409).send({ error: "contact_missing_party" });

      // Party is the canonical identity; keep archive state in sync.
      const updated = await prisma.$transaction(async (tx) => {
        const partyUpdated = await tx.party.updateMany({
          where: { id: partyId, tenantId },
          data: { archived: true },
        });
        if (partyUpdated.count === 0) return null;

        const contactUpdated = await tx.contact.updateMany({
          where: { id: contact.id, tenantId },
          data: { archived: true },
        });
        if (contactUpdated.count === 0) return null;

        return tx.contact.findFirst({
          where: { id: contact.id, tenantId },
          select: { id: true, archived: true, updatedAt: true },
        });
      });
      if (!updated) return reply.code(404).send({ error: "not_found" });

      // Update usage snapshot after archiving (decreases count)
      await updateUsageSnapshot(tenantId, "CONTACT_COUNT");

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

      const contact = await prisma.contact.findFirst({
        where: activeOnly({ id, tenantId }),
        select: { id: true, tenantId: true, partyId: true },
      });
      if (!contact) return reply.code(404).send({ error: "not_found" });
      const partyId = contact.partyId;
      if (partyId == null) return reply.code(409).send({ error: "contact_missing_party" });

      // Party is the canonical identity; keep archive state in sync.
      const updated = await prisma.$transaction(async (tx) => {
        const partyUpdated = await tx.party.updateMany({
          where: { id: partyId, tenantId },
          data: { archived: false },
        });
        if (partyUpdated.count === 0) return null;

        const contactUpdated = await tx.contact.updateMany({
          where: { id: contact.id, tenantId },
          data: { archived: false },
        });
        if (contactUpdated.count === 0) return null;

        return tx.contact.findFirst({
          where: { id: contact.id, tenantId },
          select: { id: true, archived: true, updatedAt: true },
        });
      });
      if (!updated) return reply.code(404).send({ error: "not_found" });

      // Update usage snapshot after restoring (increases count)
      await updateUsageSnapshot(tenantId, "CONTACT_COUNT");

      return reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // POST /contacts/:id/compliance-reset
  // Resets compliance status for a specific channel (EMAIL or SMS).
  // Used by admins to re-opt-in a contact after an unsubscribe.
  app.post("/contacts/:id/compliance-reset", async (req, reply) => {
    try {
      ensureAuth(req);

      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const body = req.body as { channel?: string } | null;
      const channel = body?.channel?.toUpperCase();
      if (channel !== "EMAIL" && channel !== "SMS") {
        return reply.code(400).send({ error: "invalid_channel", message: "Channel must be EMAIL or SMS" });
      }

      const contact = await prisma.contact.findFirst({
        where: activeOnly({ id, tenantId }),
        select: { id: true, partyId: true },
      });
      if (!contact) return reply.code(404).send({ error: "not_found" });
      if (contact.partyId == null) return reply.code(409).send({ error: "contact_missing_party" });

      const updated = await CommPrefsService.updateCommPreferences(
        contact.partyId,
        [{ channel: channel as "EMAIL" | "SMS", compliance: "SUBSCRIBED", complianceSource: "admin_reset" }],
        undefined,
        "admin_compliance_reset"
      );

      return reply.send({ ok: true, commPreferences: updated });
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
      where: activeOnly({ id, tenantId }),
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

  /**
   * Check all linked data that would block contact deletion.
   * Shared between GET /contacts/:id/can-delete and DELETE /contacts/:id.
   */
  async function checkContactBlockers(partyId: number, tenantId: number) {
    const blockers: Record<string, boolean> = {};
    const details: Record<string, number> = {};

    const [
      animalCount, invoiceCount, paymentCount, waitlistCount, portalAccessCount,
      documentCount, messageCount, contractPartyCount, offspringContractCount,
      planPartyCount, planBuyerCount, expenseCount, buyerRecord, breedingAttemptCount,
    ] = await Promise.all([
      prisma.animalOwner.count({ where: { partyId, animal: { tenantId } } }),
      prisma.invoice.count({ where: { clientPartyId: partyId, tenantId } }),
      prisma.payment.count({ where: { tenantId, invoice: { clientPartyId: partyId } } }),
      prisma.waitlistEntry.count({ where: { clientPartyId: partyId, tenantId } }),
      prisma.portalAccess.count({ where: { partyId, tenantId } }),
      prisma.attachment.count({ where: { attachmentPartyId: partyId, tenantId } }),
      prisma.message.count({ where: { senderPartyId: partyId, thread: { tenantId } } }),
      prisma.contractParty.count({ where: { partyId, tenantId } }),
      prisma.offspringContract.count({ where: { buyerPartyId: partyId, tenantId } }),
      prisma.planParty.count({ where: { partyId, tenantId } }),
      prisma.breedingPlanBuyer.count({ where: { partyId, tenantId } }),
      prisma.expense.count({ where: { vendorPartyId: partyId, tenantId } }),
      prisma.buyer.findFirst({ where: { partyId, tenantId }, select: { id: true } }),
      prisma.breedingAttempt.count({ where: { studOwnerPartyId: partyId, tenantId } }),
    ]);

    if (animalCount > 0) { blockers.hasAnimals = true; details.animalCount = animalCount; }
    if (invoiceCount > 0) { blockers.hasInvoices = true; details.invoiceCount = invoiceCount; }
    if (paymentCount > 0) { blockers.hasPayments = true; details.paymentCount = paymentCount; }
    if (waitlistCount > 0) { blockers.hasWaitlistEntries = true; details.waitlistCount = waitlistCount; }
    if (portalAccessCount > 0) { blockers.hasPortalAccess = true; }
    if (documentCount > 0) { blockers.hasDocuments = true; details.documentCount = documentCount; }
    if (messageCount > 0) { blockers.hasMessages = true; details.messageCount = messageCount; }
    const totalContracts = contractPartyCount + offspringContractCount;
    if (totalContracts > 0) { blockers.hasContracts = true; details.contractCount = totalContracts; }
    const totalPlans = planPartyCount + planBuyerCount;
    if (totalPlans > 0) { blockers.hasBreedingPlans = true; details.breedingPlanCount = totalPlans; }
    if (expenseCount > 0) { blockers.hasExpenses = true; details.expenseCount = expenseCount; }
    if (buyerRecord) { blockers.hasBuyerRecord = true; }
    if (breedingAttemptCount > 0) { blockers.hasBreedingAttempts = true; details.breedingAttemptCount = breedingAttemptCount; }

    return { blockers, details };
  }

  // GET /contacts/:id/can-delete
  // Check if a contact can be safely deleted and return any blockers
  app.get("/contacts/:id/can-delete", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const contactId = idNum((req.params as any).id);
    if (!contactId) return reply.code(400).send({ error: "bad_id" });

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { id: true, partyId: true },
    });
    if (!contact) return reply.code(404).send({ error: "contact_not_found" });

    if (!contact.partyId) {
      return reply.send({ canDelete: true, blockers: {} });
    }

    const { blockers, details } = await checkContactBlockers(contact.partyId, tenantId);
    const canDelete = Object.keys(blockers).length === 0;

    return reply.send({
      canDelete,
      blockers,
      details: Object.keys(details).length > 0 ? details : undefined,
    });
  });

  // DELETE /contacts/:id  (hard delete; tenant enforced; re-validates server-side)
  app.delete("/contacts/:id", async (req, reply) => {
    try {
      ensureAuth(req);

      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const contactId = idNum((req.params as any).id);
      if (!contactId) return reply.code(400).send({ error: "bad_id" });

      const contact = await prisma.contact.findFirst({
        where: { id: contactId, tenantId },
        select: { id: true, partyId: true },
      });
      if (!contact) return reply.code(404).send({ error: "not_found" });

      // Re-validate blockers server-side (defense against race conditions)
      if (contact.partyId) {
        const { blockers } = await checkContactBlockers(contact.partyId, tenantId);
        if (Object.keys(blockers).length > 0) {
          return reply.code(409).send({
            error: "cannot_delete_contact_with_dependents",
            message: "Contact has linked data that prevents deletion. Use archive instead.",
            blockers,
          });
        }

        // Nullify nullable FK references then delete contact + party in a transaction
        await prisma.$transaction(async (tx) => {
          await Promise.all([
            tx.attachment.updateMany({ where: { attachmentPartyId: contact.partyId! }, data: { attachmentPartyId: null } }),
            tx.message.updateMany({ where: { senderPartyId: contact.partyId! }, data: { senderPartyId: null } }),
            tx.animal.updateMany({ where: { buyerPartyId: contact.partyId! }, data: { buyerPartyId: null } }),
            tx.offspring.updateMany({ where: { buyerPartyId: contact.partyId! }, data: { buyerPartyId: null } }),
            tx.draft.updateMany({ where: { partyId: contact.partyId! }, data: { partyId: null } }),
            tx.emailSendLog.updateMany({ where: { partyId: contact.partyId! }, data: { partyId: null } }),
          ]);

          // Delete contact first (Party has onDelete: Restrict from Contact side)
          await tx.contact.deleteMany({ where: { id: contactId, tenantId } });
          // Delete party (cascades to PartyNote, PartyEvent, PartyEmail, etc.)
          await tx.party.deleteMany({ where: { id: contact.partyId!, tenantId } });
        });
      } else {
        // Contact without a party — just delete the contact
        await prisma.contact.deleteMany({ where: { id: contactId, tenantId } });
      }

      await updateUsageSnapshot(tenantId, "CONTACT_COUNT");

      // Audit trail (fire-and-forget)
      auditDelete("CONTACT", contactId, auditCtx(req, tenantId));

      return reply.send({ ok: true });
    } catch (err: any) {
      // Safety net for any FK constraint violations we missed
      if (err?.code === "P2003") {
        return reply.code(409).send({
          error: "cannot_delete_contact_with_dependents",
          message: "Contact has linked data that prevents deletion. Use archive instead.",
        });
      }
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // GET /contacts/:id/animals
  app.get("/contacts/:id/animals", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const contactId = idNum((req.params as any).id);
    if (!contactId) return reply.code(400).send({ error: "bad_id" });

    // Step 6: Verify contact exists in tenant and get partyId
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { id: true, partyId: true },
    });
    if (!contact) return reply.code(404).send({ error: "contact_not_found" });
    if (!contact.partyId) {
      return reply.send({ items: [], total: 0 });
    }

    const ownerships = await prisma.animalOwner.findMany({
      where: {
        partyId: contact.partyId,
        animal: { tenantId },
      },
      orderBy: [{ isPrimary: "desc" }, { percent: "desc" }],
      select: {
        id: true,
        animalId: true,
        partyId: true,
        percent: true,
        isPrimary: true,
        createdAt: true,
        updatedAt: true,
        animal: {
          select: {
            id: true,
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

    const animals = ownerships
      .filter((o) => o.animal)
      .map((o) => ({
        ...o.animal,
        owners: [
          {
            contactId,
            percent: o.percent,
            isPrimary: o.isPrimary,
            partyType: "Contact",
          },
        ],
      }));

    return reply.send({ items: animals, total: animals.length });
  });

  // ============================================================================
  // Marketplace User Block Management
  // ============================================================================

  /**
   * POST /contacts/block-marketplace-user
   * Block a marketplace user at a specific level
   */
  app.post<{
    Body: {
      userId: string;
      level: MarketplaceBlockLevel;
      reason?: string;
    };
  }>("/contacts/block-marketplace-user", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { userId, level, reason } = req.body ?? {};

      // Validate required fields
      if (!userId || typeof userId !== "string") {
        return reply.code(400).send({ error: "userId_required" });
      }

      if (!level || !["LIGHT", "MEDIUM", "HEAVY"].includes(level)) {
        return reply.code(400).send({ error: "invalid_level", message: "Level must be LIGHT, MEDIUM, or HEAVY" });
      }

      // Verify the user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        return reply.code(404).send({ error: "user_not_found" });
      }

      // Get the current user's party (for audit)
      let blockedByPartyId: number | undefined;
      const currentUserId = (req as any).userId;
      if (currentUserId) {
        const currentUser = await prisma.user.findUnique({
          where: { id: currentUserId },
          select: { partyId: true },
        });
        if (currentUser?.partyId) {
          blockedByPartyId = currentUser.partyId;
        }
      }

      const result = await blockUser({
        tenantId,
        userId,
        level,
        reason: reason?.trim() || undefined,
        blockedByPartyId,
      });

      return reply.code(201).send({
        success: true,
        blockId: result.id,
        isNew: result.isNew,
      });
    } catch (err: any) {
      console.error("[block-marketplace-user] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  /**
   * DELETE /contacts/block-marketplace-user/:userId
   * Lift a block on a marketplace user
   */
  app.delete<{
    Params: { userId: string };
  }>("/contacts/block-marketplace-user/:userId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { userId } = req.params;

      if (!userId || typeof userId !== "string") {
        return reply.code(400).send({ error: "userId_required" });
      }

      // Get the current user's party (for audit)
      let liftedByPartyId: number | undefined;
      const currentUserId = (req as any).userId;
      if (currentUserId) {
        const currentUser = await prisma.user.findUnique({
          where: { id: currentUserId },
          select: { partyId: true },
        });
        if (currentUser?.partyId) {
          liftedByPartyId = currentUser.partyId;
        }
      }

      const success = await unblockUser({
        tenantId,
        userId,
        liftedByPartyId,
      });

      if (!success) {
        return reply.code(404).send({ error: "block_not_found" });
      }

      return reply.send({ success: true });
    } catch (err: any) {
      console.error("[unblock-marketplace-user] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  /**
   * GET /contacts/blocked-marketplace-users
   * Get all blocked marketplace users for this tenant
   */
  app.get("/contacts/blocked-marketplace-users", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const blockedUsers = await getBlockedUsers(tenantId);

      return reply.send({
        items: blockedUsers.map((b) => ({
          id: b.id,
          userId: b.userId,
          level: b.level,
          reason: b.reason,
          createdAt: b.createdAt,
          user: {
            id: b.user.id,
            email: b.user.email,
            name: b.user.name || `${b.user.firstName} ${b.user.lastName}`.trim(),
          },
        })),
        total: blockedUsers.length,
      });
    } catch (err: any) {
      console.error("[blocked-marketplace-users] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  /**
   * GET /contacts/templates/csv
   * Download CSV import template for contacts
   * Query params:
   *   - withExamples: boolean (default: true) - include example rows
   */
  app.get("/contacts/templates/csv", async (req, reply) => {
    try {
      const q = (req.query as any) ?? {};
      const withExamples = String(q.withExamples ?? "true").toLowerCase() !== "false";

      const csvRows: string[][] = [];

      // Header row
      csvRows.push([
        "First Name",
        "Last Name",
        "Nickname",
        "Email",
        "Phone",
        "WhatsApp",
        "Organization",
        "Street",
        "Street 2",
        "City",
        "State",
        "Zip",
        "Country",
      ]);

      // Example rows
      if (withExamples) {
        csvRows.push([
          "John",
          "Smith",
          "Johnny",
          "john.smith@example.com",
          "+1-555-123-4567",
          "+1-555-123-4567",
          "Smith Family Farm",
          "123 Main Street",
          "Suite 100",
          "Springfield",
          "IL",
          "62701",
          "US",
        ]);

        csvRows.push([
          "Sarah",
          "Johnson",
          "",
          "sarah.j@example.com",
          "+1-555-987-6543",
          "",
          "",
          "456 Oak Avenue",
          "",
          "Portland",
          "OR",
          "97201",
          "US",
        ]);
      }

      // Escape CSV fields
      const escapeCsvField = (value: string): string => {
        if (!value) return "";
        if (value.includes(",") || value.includes("\n") || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const csv = csvRows.map((row) => row.map(escapeCsvField).join(",")).join("\n");

      const filename = "contacts-import-template.csv";

      reply
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(csv);
    } catch (error) {
      console.error("Contacts CSV template error:", error);
      return reply.code(500).send({
        error: "template_failed",
        message: (error as Error).message,
      });
    }
  });

  /**
   * GET /contacts/export/csv
   * Export contacts to CSV
   * Query params:
   *   - includeArchived: boolean (default: false)
   *   - search: string (optional filter)
   */
  app.get("/contacts/export/csv", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const q = (req.query as any) ?? {};
      const includeArchived = String(q.includeArchived ?? "false").toLowerCase() === "true";
      const search = trimToNull(q.search);

      // Build where clause
      const where: any = { tenantId };
      if (!includeArchived) where.archived = false;
      if (search) {
        const organizationNameMatch = includeArchived
          ? { organization: { party: { name: { contains: search, mode: "insensitive" } } } }
          : {
              organization: {
                is: {
                  archived: false,
                  party: {
                    is: {
                      archived: false,
                      name: { contains: search, mode: "insensitive" },
                    },
                  },
                },
              },
            };
        where.OR = [
          { party: { name: { contains: search, mode: "insensitive" } } },
          organizationNameMatch,
          { party: { email: { contains: search } } },
          { party: { phoneE164: { contains: search } } },
          { party: { whatsappE164: { contains: search } } },
          { display_name: { contains: search, mode: "insensitive" } },
          { first_name: { contains: search, mode: "insensitive" } },
          { last_name: { contains: search, mode: "insensitive" } },
          { nickname: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phoneE164: { contains: search, mode: "insensitive" } },
          { whatsappE164: { contains: search, mode: "insensitive" } },
        ];
      }

      // Fetch all contacts (no pagination for export)
      const contacts = await prisma.contact.findMany({
        where: activeOnly(where),
        orderBy: { display_name: "asc" },
        select: {
          id: true,
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
          archived: true,
          createdAt: true,
          updatedAt: true,
          organization: {
            select: {
              party: {
                select: {
                  name: true,
                },
              },
            },
          },
          party: {
            select: {
              name: true,
              email: true,
              phoneE164: true,
            },
          },
        },
      });

      // Build CSV
      const csvRows: string[][] = [];

      // Header row
      csvRows.push([
        "ID",
        "Display Name",
        "First Name",
        "Last Name",
        "Nickname",
        "Email",
        "Phone",
        "WhatsApp",
        "Organization",
        "Street",
        "Street 2",
        "City",
        "State",
        "Zip",
        "Country",
        "Party Name",
        "Party Email",
        "Party Phone",
        "Archived",
        "Created At",
        "Updated At",
      ]);

      // Data rows
      for (const contact of contacts) {
        const row = [
          String(contact.id),
          contact.display_name || "",
          contact.first_name || "",
          contact.last_name || "",
          contact.nickname || "",
          contact.email || "",
          contact.phoneE164 || "",
          contact.whatsappE164 || "",
          contact.organization?.party?.name || "",
          contact.street || "",
          contact.street2 || "",
          contact.city || "",
          contact.state || "",
          contact.zip || "",
          contact.country || "",
          contact.party?.name || "",
          contact.party?.email || "",
          contact.party?.phoneE164 || "",
          contact.archived ? "Yes" : "No",
          new Date(contact.createdAt).toISOString().split("T")[0],
          new Date(contact.updatedAt).toISOString().split("T")[0],
        ];
        csvRows.push(row);
      }

      // Escape CSV fields
      const escapeCsvField = (value: string): string => {
        if (!value) return "";
        if (value.includes(",") || value.includes("\n") || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const csv = csvRows.map((row) => row.map(escapeCsvField).join(",")).join("\n");

      // Generate filename with date
      const today = new Date().toISOString().split("T")[0];
      const filename = `contacts-export-${today}.csv`;

      reply
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(csv);
    } catch (error) {
      console.error("Contacts CSV export error:", error);
      return reply.code(500).send({
        error: "export_failed",
        message: (error as Error).message,
      });
    }
  });
};


export default contactsRoutes;

