// src/routes/animals-breeds.ts
import { FastifyInstance } from "fastify";
import { z } from "zod";
import prisma from "../prisma.js";

const Snapshot = z.object({
  animalId: z.string(),
  species: z.enum(["Dog", "Cat", "Horse"]),
  primaryBreedId: z.string().nullable(),
  primaryBreedName: z.string().nullable(),
  canonicalMix: z.array(z.object({
    breedId: z.string(),
    name: z.string(),
    percentage: z.number().min(0).max(100),
  })),
  customMix: z.array(z.object({
    id: z.string(),
    name: z.string(),
    percentage: z.number().min(0).max(100),
  })),
});

const PutBody = z.object({
  species: z.enum(["DOG", "CAT", "HORSE"]),
  primaryBreedId: z.string().nullable(),
  canonical: z.array(z.object({
    breedId: z.string(),
    percentage: z.number().min(0).max(100),
  })),
  custom: z.array(z.object({
    id: z.string(),
    percentage: z.number().min(0).max(100),
  })),
});

function apiToUiSpecies(code: string): "Dog" | "Cat" | "Horse" {
  const c = String(code).toUpperCase();
  return c === "DOG" ? "Dog" : c === "CAT" ? "Cat" : "Horse";
}
function getOrgIdFrom(req: any): number | undefined {
  const orgIdHeader = req.headers?.["x-org-id"];
  const hdr = typeof orgIdHeader === "string" ? orgIdHeader : Array.isArray(orgIdHeader) ? orgIdHeader[0] : orgIdHeader;
  const fromAuth = req.authUser?.orgId;
  const n = Number(fromAuth ?? hdr);
  return Number.isFinite(n) ? n : undefined;
}

export default async function animalsBreedsRoutes(app: FastifyInstance) {
  // GET editor-ready snapshot (normalized)
  app.get("/api/v1/animals/:id/breeds", async (req: any, reply) => {
    try {
      const orgId = getOrgIdFrom(req);
      if (!orgId) return reply.code(400).send({ error: "org_required" });

      const id = String((req.params as any).id);

      const a = await prisma.animal.findFirst({
        where: { id, organizationId: orgId },
        include: {
          breed: { select: { id: true, name: true } }, // primary
          breeds: {
            select: {
              percentage: true,
              breed: { select: { id: true, name: true } },
            },
          }, // mix rows
        },
      });
      if (!a) return reply.code(404).send({ message: "Animal not found" });

      const canonicalMix = Array.isArray(a.breeds)
        ? a.breeds
            .map((b: any) =>
              b?.breed?.id
                ? {
                    breedId: String(b.breed.id),
                    name: String(b.breed.name ?? ""),
                    percentage: Number(b?.percentage ?? 0) || 0,
                  }
                : null
            )
            .filter(Boolean) as { breedId: string; name: string; percentage: number }[]
        : [];

      // Start with DB primary (may be null)
      let primaryBreedId: string | null = a.breed?.id ? String(a.breed.id) : null;
      let primaryBreedName: string | null = a.breed?.name ?? null;

      // 🔒 Normalize to a single truth:
      // - If more than one mix row → MIXED ⇒ blank out primary
      // - If exactly one mix row and no primary set → adopt it as primary
      if (canonicalMix.length > 1) {
        primaryBreedId = null;
        primaryBreedName = null;
      } else if (canonicalMix.length === 1 && !primaryBreedId) {
        primaryBreedId = canonicalMix[0].breedId;
        primaryBreedName = canonicalMix[0].name;
      }

      const payload = {
        animalId: String(a.id),
        species: apiToUiSpecies(String(a.species ?? "DOG")),
        primaryBreedId,
        primaryBreedName,
        canonicalMix,
        customMix: [], // no custom breeds table yet
      };

      return reply.send(payload);
    } catch (err: any) {
      req.log.error({ err, animalId: req.params?.id }, "breeds GET failed");
      return reply.code(500).send({ error: "internal_error", message: err?.message || "Failed to load breed snapshot" });
    }
  });

  // PUT save → enforce invariant, then return normalized snapshot
  app.put("/api/v1/animals/:id/breeds", async (req: any, reply) => {
    const orgId = getOrgIdFrom(req);
    if (!orgId) return reply.code(400).send({ error: "org_required" });

    const id = String((req.params as any).id);
    const body = PutBody.parse(req.body);

    // Ensure animal belongs to org
    const exists = await prisma.animal.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!exists) return reply.code(404).send({ message: "Animal not found" });

    const total =
      body.canonical.reduce((a, b) => a + b.percentage, 0) +
      body.custom.reduce((a, b) => a + b.percentage, 0);
    if (total > 100 + 1e-6) return reply.code(422).send({ message: "Percentages exceed 100" });

    const seen = new Set<string>();
    for (const r of body.canonical) {
      if (seen.has(r.breedId)) return reply.code(422).send({ message: "Duplicate canonical breed" });
      seen.add(r.breedId);
    }
    if (body.custom.length) {
      return reply.code(400).send({ message: "Custom breeds are not supported yet" });
    }

    // 🔒 Enforce the same invariant when saving
    const isMixed = body.canonical.length > 1;
    const effectivePrimary =
      isMixed ? null : (body.primaryBreedId ?? (body.canonical[0]?.breedId ?? null));

    await prisma.$transaction(async (tx) => {
      // Update primary species/breed
      await tx.animal.update({
        where: { id },
        data: {
          species: body.species,
          breedId: effectivePrimary, // if mixed → null
        },
      });

      // Replace mix rows
      await tx.animalBreed.deleteMany({ where: { animalId: id } });
      if (isMixed) {
        // When mixed, persist all rows
        await tx.animalBreed.createMany({
          data: body.canonical.map((r) => ({
            animalId: id,
            breedId: r.breedId,
            percentage: r.percentage,
          })),
        });
      } else if (effectivePrimary) {
        // When pure, we can either store zero rows or a single 100% row.
        // Choose zero rows to keep the source of truth in primaryBreedId.
        // If you prefer 100% row, uncomment below:
        // await tx.animalBreed.create({
        //   data: { animalId: id, breedId: effectivePrimary, percentage: 100 },
        // });
      }
    });

    // Return fresh, normalized snapshot
    const fresh = await prisma.animal.findFirst({
      where: { id, organizationId: orgId },
      include: {
        breed: { select: { id: true, name: true } },
        breeds: {
          select: {
            percentage: true,
            breed: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!fresh) return reply.code(404).send({ message: "Animal not found" });

    const mix = Array.isArray(fresh.breeds)
      ? fresh.breeds
          .map((b: any) =>
            b?.breed?.id
              ? {
                  breedId: String(b.breed.id),
                  name: String(b.breed.name ?? ""),
                  percentage: Number(b?.percentage ?? 0) || 0,
                }
              : null
          )
          .filter(Boolean) as { breedId: string; name: string; percentage: number }[]
      : [];

    let pId: string | null = fresh.breed?.id ? String(fresh.breed.id) : null;
    let pName: string | null = fresh.breed?.name ?? null;

    if (mix.length > 1) {
      pId = null;
      pName = null;
    } else if (mix.length === 1 && !pId) {
      pId = mix[0].breedId;
      pName = mix[0].name;
    }

    const snapshot = {
      animalId: String(fresh.id),
      species: apiToUiSpecies(String(fresh.species ?? "DOG")),
      primaryBreedId: pId,
      primaryBreedName: pName,
      canonicalMix: mix,
      customMix: [],
    };

    return reply.send(snapshot);
  });
}
