import { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import crypto from "node:crypto";



const ALLOWED_FIELDS = new Set([
  "id",
  "name",
  "species",
  "sex",
  "birthDate",
  "createdAt",
  "updatedAt",
]);

function sanitizeFields(fields?: string) {
  if (!fields) return Array.from(ALLOWED_FIELDS);
  return fields
    .split(",")
    .map(f => f.trim())
    .filter(f => ALLOWED_FIELDS.has(f));
}

function toSelectSQL(cols: string[]) {
  if (!cols.length) cols = Array.from(ALLOWED_FIELDS);
  return cols.map(c => `"${c}"`).join(", ");
}

function withTimeout<T>(p: Promise<T>, ms = 400) {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

const animalsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/animals?limit=&cursor=&fields=
  app.get("/api/v1/animals", async (req, reply) => {
    const { limit = "25", cursor, fields } = (req.query || {}) as Record<
      string,
      string
    >;

    const lim = Math.min(Math.max(parseInt(String(limit)) || 25, 1), 200);
    const cols = sanitizeFields(fields);
    const selectSQL = toSelectSQL(cols);

    // Raw-first with timeout, fallback to Prisma
    try {
      const rows = await withTimeout(
        prisma.$queryRawUnsafe<any[]>(
          `
          SELECT ${selectSQL}
          FROM "Animal"
          WHERE ($1::text IS NULL OR "id" > $1)
          ORDER BY "id" ASC
          LIMIT $2
        `,
          cursor || null,
          lim
        )
      );
      const nextCursor = rows.length === lim ? rows[rows.length - 1].id : null;
      return reply.send({ data: rows, nextCursor });
    } catch {
      const data = await prisma.animal.findMany({
        where: cursor ? { id: { gt: String(cursor) } } : undefined,
        orderBy: { id: "asc" },
        take: lim,
        select: Object.fromEntries(cols.map(c => [c, true])) as any,
      });
      const nextCursor = data.length === lim ? data[data.length - 1].id : null;
      return reply.send({ data, nextCursor });
    }
  });

  // POST /api/v1/animals
  app.post("/api/v1/animals", async (req, reply) => {
    const body = (req.body as any) || {};
    const now = new Date();
    const id = body.id || crypto.randomUUID();

    const rec = {
      id,
      name: body.name ?? null,
      species: body.species ?? null,
      sex: body.sex ?? null,
      birthDate: body.birthDate ? new Date(body.birthDate) : null,
      createdAt: now,
      updatedAt: now,
    };

    // Raw-first insert with timeout, fallback to Prisma
    try {
      const rows = await withTimeout(
        prisma.$queryRawUnsafe<any[]>(
          `
          INSERT INTO "Animal" ("id","name","species","sex","birthDate","createdAt","updatedAt")
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          RETURNING "id","name","species","sex","birthDate","createdAt","updatedAt"
        `,
          rec.id,
          rec.name,
          rec.species,
          rec.sex,
          rec.birthDate,
          rec.createdAt,
          rec.updatedAt
        )
      );
      return reply.code(201).send(rows[0]);
    } catch {
      const created = await prisma.animal.create({ data: rec });
      return reply.code(201).send(created);
    }
  });
};

export default animalsRoutes;

