// src/routes/user.ts
import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import prisma from "../prisma.js";
import bcrypt from "bcryptjs";
import { resolvePartyId } from "../services/party-resolver.js";
import { getActorId, parseVerifiedSession, Surface } from "../utils/session.js";
import { deriveSurface } from "../middleware/actor-context.js";

/* ───────────────────────── helpers ───────────────────────── */

// ⬇️ expanded to support new sortable fields
type SortKey =
  | "createdAt"
  | "updatedAt"
  | "email"
  | "name"
  | "firstName"
  | "lastName"
  | "nickname";

function parseSort(sort?: string) {
  if (!sort) return [{ createdAt: "desc" } as any];
  const allowed = new Set<SortKey>([
    "createdAt",
    "updatedAt",
    "email",
    "name",
    "firstName",
    "lastName",
    "nickname",
  ]);
  const parts = String(sort)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const orderBy: any[] = [];
  for (const p of parts) {
    const desc = p.startsWith("-");
    const key = p.replace(/^-/, "") as SortKey;
    if (allowed.has(key)) orderBy.push({ [key]: desc ? "desc" : "asc" });
  }
  return orderBy.length ? orderBy : [{ createdAt: "desc" }];
}

// Session verification is now imported from utils/session.js

async function requireSession(req: FastifyRequest, reply: any) {
  const actorId = getActorId(req);
  if (!actorId) {
    reply.code(401).send({ error: "unauthorized" });
    return null as string | null;
  }
  return actorId;
}
async function requireSuperAdmin(req: any, reply: any) {
  const actorId = await requireSession(req, reply);
  if (!actorId) return null;
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { isSuperAdmin: true },
  });
  if (!actor?.isSuperAdmin) {
    reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return actorId;
}
async function requireSelfOrSuperAdmin(
  req: any,
  reply: any,
  targetUserId: string
) {
  const actorId = await requireSession(req, reply);
  if (!actorId) return null;
  if (actorId === targetUserId) return actorId;
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { isSuperAdmin: true },
  });
  if (!actor?.isSuperAdmin) {
    reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return actorId;
}

function normEmail(v?: string | null) {
  return String(v || "").trim().toLowerCase();
}
function normCountry(v?: string | null) {
  const s = String(v || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
}
function nonEmptyOrNull(v: any) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** Accepts cuid/cuid2/ulid/uuid-ish ids (long base36/62 with _ and -) */
const STRING_ID_SEG = ":id([A-Za-z0-9_-]{16,})";

/* ───────────────────────── routes ───────────────────────── */

export default async function userRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // GET /user → current session user (minimal)
  app.get("/user", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    // Use signature-verified session parsing with surface-specific cookie
    const surface = deriveSurface(req) as Surface;
    const sess = parseVerifiedSession(req, surface);
    if (!sess) return reply.code(401).send({ user: null });

    const user = await prisma.user.findUnique({
      where: { id: String(sess.userId) },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        defaultTenantId: true,
        isSuperAdmin: true,
        emailVerifiedAt: true,
        // ⬇️ NEW FIELDS
        firstName: true,
        lastName: true,
        nickname: true,
      },
    });
    if (!user) return reply.code(401).send({ user: null });

    return reply.send({
      user: {
        ...user,
        name: user.name ?? null,
        image: user.image ?? null,
        defaultTenantId: user.defaultTenantId ?? null,
        emailVerifiedAt: user.emailVerifiedAt ?? null,
        // ⬇️ ensure nulls not undefined
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        nickname: user.nickname ?? null,
      },
    });
  });

  /* ───────── Admin / profile endpoints ───────── */

  // GET /users?q=&tenantId=&page=&limit=&sort=   (Super Admin only)
  app.get("/users", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    const {
      q = "",
      tenantId = "",
      page = "1",
      limit = "25",
      sort = "-createdAt",
    } = (req.query || {}) as {
      q?: string;
      tenantId?: string;
      page?: string;
      limit?: string;
      sort?: string;
    };

    const take = Math.min(100, Math.max(1, Number(limit) || 25));
    const skip = Math.max(0, ((Number(page) || 1) - 1) * take);
    const orderBy = parseSort(sort);

    const where: any = {};
    if (q) {
      // ⬇️ broadened to include new fields
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { nickname: { contains: q, mode: "insensitive" } },
      ];
    }
    if (tenantId) {
      const tId = Number(tenantId);
      if (!Number.isFinite(tId) || tId <= 0)
        return reply.code(400).send({ error: "tenantId_invalid" });
      where.tenantMemberships = { some: { tenantId: tId } };
    }

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          isSuperAdmin: true,
          defaultTenantId: true,
          tenantMemberships: { select: { tenantId: true, role: true } },
          createdAt: true,
          updatedAt: true,
          // ⬇️ NEW FIELDS
          firstName: true,
          lastName: true,
          nickname: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    const items = rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name ?? null,
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      nickname: u.nickname ?? null,
      image: u.image ?? null,
      isSuperAdmin: !!u.isSuperAdmin,
      defaultTenantId: u.defaultTenantId ?? null,
      memberships: u.tenantMemberships.map((m) => ({
        tenantId: m.tenantId,
        role: m.role,
      })),
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }));

    reply.send({ items, total, page: Number(page) || 1, limit: take });
  });

  // GET /users/:id — full profile (self or Super Admin)
  app.get<{ Params: { id: string } }>(
    `/users/${STRING_ID_SEG}`,
    {
      schema: {
        params: {
          type: "object",
          properties: {
            id: {
              type: "string",
              minLength: 16,
              pattern: "^[A-Za-z0-9_-]{16,}$",
            },
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      reply.header("Cache-Control", "no-store");
      const { id } = req.params;
      const actorId = await requireSelfOrSuperAdmin(req, reply, id);
      if (!actorId) return;

      const u = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          isSuperAdmin: true,
          defaultTenantId: true,
          tenantMemberships: { select: { tenantId: true, role: true } },
          createdAt: true,
          updatedAt: true,
          phoneE164: true,
          whatsappE164: true,
          street: true,
          street2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          partyId: true,
          party: {
            select: {
              id: true,
              type: true,
              contact: { select: { id: true } },
            },
          },
          emailVerifiedAt: true,
          // ⬇️ NEW FIELDS
          firstName: true,
          lastName: true,
          nickname: true,
        },
      });
      if (!u) return reply.code(404).send({ error: "not_found" });

      return reply.send({
        id: u.id,
        email: u.email,
        name: u.name ?? null,
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        nickname: u.nickname ?? null,
        image: u.image ?? null,
        isSuperAdmin: !!u.isSuperAdmin,
        defaultTenantId: u.defaultTenantId ?? null,
        memberships: u.tenantMemberships.map((m) => ({
          tenantId: m.tenantId,
          role: m.role,
        })),
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
        phoneE164: u.phoneE164 ?? null,
        whatsappE164: u.whatsappE164 ?? null,
        street: u.street ?? null,
        street2: u.street2 ?? null,
        city: u.city ?? null,
        state: u.state ?? null,
        postalCode: u.postalCode ?? null,
        country: u.country ?? null,
        partyId: u.partyId ?? null,
        emailVerifiedAt: u.emailVerifiedAt ?? null,
      });
    }
  );

  // POST /users — create user (Super Admin only)
  app.post("/users", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    const body = (req.body || {}) as {
      email?: string;
      name?: string | null;
      image?: string | null;
      isSuperAdmin?: boolean;
      country?: string | null;
      // ⬇️ NEW FIELDS
      firstName?: string | null;
      lastName?: string | null;
      nickname?: string | null;
    };
    const email = normEmail(body.email);
    if (!email) return reply.code(400).send({ error: "email_required" });

    const data: any = {
      email,
      name: nonEmptyOrNull(body.name),
      image: nonEmptyOrNull(body.image),
      // ⬇️ NEW
      firstName: nonEmptyOrNull(body.firstName),
      lastName: nonEmptyOrNull(body.lastName),
      nickname: nonEmptyOrNull(body.nickname),
    };
    if (body.isSuperAdmin !== undefined) data.isSuperAdmin = !!body.isSuperAdmin;
    if (body.country !== undefined) data.country = normCountry(body.country);

    try {
      const created = await prisma.user.create({
        data,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          isSuperAdmin: true,
          defaultTenantId: true,
          createdAt: true,
          updatedAt: true,
          // ⬇️ NEW FIELDS
          firstName: true,
          lastName: true,
          nickname: true,
        },
      });
      return reply.code(201).send({
        ...created,
        name: created.name ?? null,
        firstName: created.firstName ?? null,
        lastName: created.lastName ?? null,
        nickname: created.nickname ?? null,
        image: created.image ?? null,
        defaultTenantId: created.defaultTenantId ?? null,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      });
    } catch (e: any) {
      if (e?.code === "P2002")
        return reply.code(409).send({ error: "email_already_exists" });
      throw e;
    }
  });

  // PATCH /users/:id — update core/profile (self or Super Admin)
  app.patch<{
    Params: { id: string };
    Body: Partial<{
      email: string;
      name: string | null;
      image: string | null;
      isSuperAdmin: boolean;
      phoneE164: string | null;
      whatsappE164: string | null;
      street: string | null;
      street2: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      country: string | null;
      defaultTenantId: number | null;
      // ⬇️ NEW FIELDS
      firstName: string | null;
      lastName: string | null;
      nickname: string | null;
    }>;
  }>(`/users/${STRING_ID_SEG}`, async (req, reply) => {
    const { id } = req.params;
    const actorId = await requireSelfOrSuperAdmin(req, reply, id);
    if (!actorId) return;
    const b = req.body || {};

    if (actorId === id && b.isSuperAdmin === false) {
      return reply
        .code(400)
        .send({ error: "cannot_self_demote_super_admin" });
    }

    let oldEmail: string | null = null;
    if (b.email !== undefined) {
      const cur = await prisma.user.findUnique({
        where: { id },
        select: { email: true },
      });
      oldEmail = cur?.email?.toLowerCase() || null;
    }

    const data: any = {};
    if (b.email !== undefined) data.email = normEmail(b.email);
    if (b.name !== undefined) data.name = nonEmptyOrNull(b.name);
    if (b.image !== undefined) data.image = nonEmptyOrNull(b.image);

    // ⬇️ NEW assignments
    if (b.firstName !== undefined) data.firstName = nonEmptyOrNull(b.firstName);
    if (b.lastName !== undefined) data.lastName = nonEmptyOrNull(b.lastName);
    if (b.nickname !== undefined) data.nickname = nonEmptyOrNull(b.nickname);

    if (b.isSuperAdmin !== undefined) {
      const actor = await prisma.user.findUnique({
        where: { id: actorId },
        select: { isSuperAdmin: true },
      });
      if (!actor?.isSuperAdmin) return reply.code(403).send({ error: "forbidden" });
      data.isSuperAdmin = !!b.isSuperAdmin;
    }

    if (b.phoneE164 !== undefined) data.phoneE164 = nonEmptyOrNull(b.phoneE164);
    if (b.whatsappE164 !== undefined)
      data.whatsappE164 = nonEmptyOrNull(b.whatsappE164);
    if (b.street !== undefined) data.street = nonEmptyOrNull(b.street);
    if (b.street2 !== undefined) data.street2 = nonEmptyOrNull(b.street2);
    if (b.city !== undefined) data.city = nonEmptyOrNull(b.city);
    if (b.state !== undefined) data.state = nonEmptyOrNull(b.state);
    if (b.postalCode !== undefined)
      data.postalCode = nonEmptyOrNull(b.postalCode);
    if (b.country !== undefined) data.country = normCountry(b.country);

    if (b.defaultTenantId !== undefined) {
      const tId = b.defaultTenantId == null ? null : Number(b.defaultTenantId);
      if (tId != null && (!Number.isFinite(tId) || tId <= 0)) {
        return reply.code(400).send({ error: "tenantId_invalid" });
      }
      if (tId != null) {
        const membership = await prisma.tenantMembership.findUnique({
          where: { userId_tenantId: { userId: id, tenantId: tId } },
          select: { userId: true },
        });
        if (!membership)
          return reply.code(403).send({ error: "not_a_member_of_tenant" });
      }
      data.defaultTenantId = tId;
    }

    if (b.isSuperAdmin === false) {
      const target = await prisma.user.findUnique({
        where: { id },
        select: { isSuperAdmin: true },
      });
      if (target?.isSuperAdmin) {
        const others = await prisma.user.count({
          where: { isSuperAdmin: true, NOT: { id } },
        });
        if (others === 0) {
          return reply
            .code(409)
            .send({ error: "cannot_remove_last_super_admin" });
        }
      }
    }

    try {
      const u = await prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          isSuperAdmin: true,
          defaultTenantId: true,
          createdAt: true,
          updatedAt: true,
          phoneE164: true,
          whatsappE164: true,
          street: true,
          street2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          // ⬇️ NEW FIELDS
          firstName: true,
          lastName: true,
          nickname: true,
        },
      });

      if (b.email !== undefined) {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id },
            data: { emailVerifiedAt: null },
          });
          const newEmail = u.email.toLowerCase();
          await tx.verificationToken.deleteMany({
            where: {
              OR: [{ identifier: oldEmail ?? "" }, { identifier: newEmail }],
            },
          });
        });
      }

      return reply.send({
        ...u,
        name: u.name ?? null,
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        nickname: u.nickname ?? null,
        image: u.image ?? null,
        defaultTenantId: u.defaultTenantId ?? null,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      });
    } catch (e: any) {
      if (e?.code === "P2002")
        return reply.code(409).send({ error: "email_already_exists" });
      if (e?.code === "P2025")
        return reply.code(404).send({ error: "not_found" });
      throw e;
    }
  });

  // PATCH /users/:id/default-tenant — self or Super Admin
  app.patch<{ Params: { id: string }; Body: { tenantId: number | null } }>(
    `/users/${STRING_ID_SEG}/default-tenant`,
    async (req, reply) => {
      const { id } = req.params;
      const actorId = await requireSelfOrSuperAdmin(req, reply, id);
      if (!actorId) return;

      const body = req.body || { tenantId: null };

      if (body.tenantId != null) {
        const tId = Number(body.tenantId);
        if (!Number.isFinite(tId) || tId <= 0)
          return reply.code(400).send({ error: "tenantId_invalid" });

        const membership = await prisma.tenantMembership.findUnique({
          where: { userId_tenantId: { userId: id, tenantId: tId } },
          select: { userId: true },
        });
        if (!membership)
          return reply.code(403).send({ error: "not_a_member_of_tenant" });
      }

      const u = await prisma.user.update({
        where: { id },
        data: { defaultTenantId: body.tenantId ?? null },
        select: { id: true, email: true, defaultTenantId: true, updatedAt: true },
      });

      return reply.send({
        id: u.id,
        email: u.email,
        defaultTenantId: u.defaultTenantId ?? null,
        updatedAt: u.updatedAt.toISOString(),
      });
    }
  );

  // PATCH /users/:id/contact — set/clear contactId (self or Super Admin)
  // Step 6: Accepts legacy contactId but persists only partyId
  app.patch<{ Params: { id: string }; Body: { contactId: number | null } }>(
    `/users/${STRING_ID_SEG}/contact`,
    async (req, reply) => {
      const { id } = req.params;
      const actorId = await requireSelfOrSuperAdmin(req, reply, id);
      if (!actorId) return;

      const body = req.body || { contactId: null };
      let partyId: number | null = null;
      let contactIdForResponse: number | null = null;

      if (body.contactId != null) {
        const cid = Number(body.contactId);
        if (!Number.isFinite(cid) || cid <= 0)
          return reply.code(400).send({ error: "contactId_invalid" });
        const contact = await prisma.contact.findUnique({
          where: { id: cid },
          select: { id: true, tenantId: true },
        });
        if (!contact) return reply.code(404).send({ error: "contact_not_found" });

        const membership = await prisma.tenantMembership.findUnique({
          where: { userId_tenantId: { userId: id, tenantId: contact.tenantId } },
          select: { userId: true },
        });
        if (!membership)
          return reply.code(403).send({ error: "not_a_member_of_contact_tenant" });

        // Step 6: Resolve partyId from contactId (Party-only persistence)
        partyId = await resolvePartyId(prisma, { contactId: cid });
        contactIdForResponse = cid;
      }

      try {
        const u = await prisma.user.update({
          where: { id },
          data: {
            partyId
          },
          select: {
            id: true,
            email: true,
            partyId: true,
            updatedAt: true
          },
        });

        return reply.send({
          id: u.id,
          email: u.email,
          partyId: u.partyId ?? null,
          updatedAt: u.updatedAt.toISOString(),
        });
      } catch (e: any) {
        if (e?.code === "P2025") return reply.code(404).send({ error: "not_found" });
        throw e;
      }
    }
  );

  // PATCH /users/:id/password — set passwordHash (self or Super Admin) + audit
  app.patch<{ Params: { id: string }; Body: { password: string } }>(
    `/users/${STRING_ID_SEG}/password`,
    async (req, reply) => {
      const { id } = req.params;
      const actorId = await requireSelfOrSuperAdmin(req, reply, id);
      if (!actorId) return;

      const { password } = (req.body || {}) as { password?: string };
      const pw = String(password || "").trim();
      if (pw.length < 8) return reply.code(400).send({ error: "password_too_short" });

      try {
        const passwordHash = await bcrypt.hash(pw, 12);
        const u = await prisma.user.update({
          where: { id },
          data: { passwordHash, passwordUpdatedAt: new Date() },
          select: { id: true, email: true, updatedAt: true },
        });

        // Optional: revoke sessions
        // await prisma.session.deleteMany({ where: { userId: id } });

        return reply.send({
          id: u.id,
          email: u.email,
          updatedAt: u.updatedAt.toISOString(),
        });
      } catch (e: any) {
        if (e?.code === "P2025") return reply.code(404).send({ error: "not_found" });
        throw e;
      }
    }
  );

  // DELETE /users/:id (Super Admin only; cannot delete self; cannot remove last super admin)
  app.delete<{ Params: { id: string } }>(
    `/users/${STRING_ID_SEG}`,
    async (req, reply) => {
      const { id } = req.params;

      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;
      if (actorId === id)
        return reply.code(400).send({ error: "cannot_delete_self" });

      const target = await prisma.user.findUnique({
        where: { id },
        select: { isSuperAdmin: true },
      });
      if (target?.isSuperAdmin) {
        const others = await prisma.user.count({
          where: { isSuperAdmin: true, NOT: { id } },
        });
        if (others === 0)
          return reply
            .code(409)
            .send({ error: "cannot_delete_last_super_admin" });
      }

      try {
        await prisma.user.delete({ where: { id } });
        return reply.send({ ok: true });
      } catch (e: any) {
        if (e?.code === "P2025")
          return reply.code(404).send({ error: "not_found" });
        throw e;
      }
    }
  );
}
