// prisma/seed/seed-breeds-json.ts
import "./seed-env-bootstrap";
import fs from "node:fs";
import path from "node:path";
import slugify from "slugify";
import { PrismaClient, Species } from "@prisma/client";

const prisma = new PrismaClient();
const root = process.cwd();

type Row = {
  name: string;
  species: Species; // "DOG" | "CAT" | "HORSE"
  parents?: string[];
  registries?: Array<{
    code: string;        // e.g. "AKC", "TICA", "CFA", "FCI", ...
    status?: string;     // keep EXACT (e.g. "PNB", "ANB", "Miscellaneous")
    registryId?: string;
    url?: string;
    primary?: boolean;
    since?: number;
    notes?: string;
    proofUrl?: string;
  }>;
};

const FILES = [
  path.join(root, "prisma/seed/data/dogs.json"),
  path.join(root, "prisma/seed/data/cats.json"),
  path.join(root, "prisma/seed/data/horses.json"),
];

const toSlug = (s: string) => slugify(s, { lower: true, strict: true, locale: "en" });

async function upsertBreed(row: Row) {
  // breed by unique name
  const breed = await prisma.breed.upsert({
    where: { name: row.name },
    update: { species: row.species, slug: toSlug(row.name) },
    create: { name: row.name, species: row.species, slug: toSlug(row.name) },
    select: { id: true, name: true },
  });

  if (!row.registries?.length) return;

  for (const reg of row.registries) {
    const code = reg.code?.toUpperCase?.() || "";
    if (!code) continue;

    // ensure registry exists (do NOT create; we respect your separate registries seed)
    const registry = await prisma.registryCatalog.findUnique({ where: { code } });
    if (!registry) {
      console.warn(`Skipped link for ${breed.name}: registry code ${code} not found in RegistryCatalog`);
      continue;
    }

    await prisma.breedRegistryLink.upsert({
      where: { breedId_registryCode: { breedId: breed.id, registryCode: code } } as any,
      update: {
        registryCode: code,
        statusText: reg.status ?? null,         // <-- store EXACT text from JSON
        registryId: reg.registryId ?? null,
        url: reg.url ?? null,
        primary: typeof reg.primary === "boolean" ? reg.primary : null,
        since: typeof reg.since === "number" ? reg.since : null,
        notes: reg.notes ?? null,
        proofUrl: reg.proofUrl ?? null,
      },
      create: {
        breedId: breed.id,
        registryCode: code,
        statusText: reg.status ?? null,         // <-- store EXACT text from JSON
        registryId: reg.registryId ?? null,
        url: reg.url ?? null,
        primary: typeof reg.primary === "boolean" ? reg.primary : null,
        since: typeof reg.since === "number" ? reg.since : null,
        notes: reg.notes ?? null,
        proofUrl: reg.proofUrl ?? null,
      },
    });
  }
}

async function main() {
  const rows: Row[] = FILES.flatMap((f) =>
    fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as Row[]) : []
  );

  console.log(`Seeding curated breeds from JSON (rows: ${rows.length}) …`);
  const valid = rows.filter((r) => r?.name && r?.species);
  if (valid.length !== rows.length) {
    console.warn(`Filtered ${rows.length - valid.length} invalid rows (missing name/species).`);
  }

  // process in chunks
  const chunk = <T,>(arr: T[], size = 200) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));

  for (const batch of chunk(valid, 200)) {
    await Promise.all(batch.map(upsertBreed));
  }

  console.log("Breeds JSON seed complete ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
