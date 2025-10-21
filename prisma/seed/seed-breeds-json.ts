// prisma/seed/seed-breeds-json.ts
import "./seed-env-bootstrap";
import fs from "node:fs";
import path from "node:path";
import slugify from "slugify";
import { PrismaClient, Species } from "@prisma/client";

const prisma = new PrismaClient();
const root = process.cwd();

/**
 * Options via env or CLI
 * CLEAR_BEFORE=true  → delete existing registry links then delete breeds not present in JSON files
 * ONLY=DOG           → limit to a single species (DOG|CAT|HORSE). Comma list allowed.
 * CHUNK=200          → batch size for upserts
 * DRY_RUN=true       → log actions, do not write
 */
const CLEAR_BEFORE = readBool(envOrArg("CLEAR_BEFORE", "false"));
const DRY_RUN       = readBool(envOrArg("DRY_RUN", "false"));
const CHUNK_SIZE    = Number(envOrArg("CHUNK", "200")) || 200;
const ONLY_SPECIES  = parseOnlySpecies(envOrArg("ONLY", ""));

type Row = {
  name: string;
  species: Species; // "DOG" | "CAT" | "HORSE"
  parents?: string[];
  registries?: Array<{
    code: string;        // "AKC", "TICA", "CFA", "FCI", ...
    status?: string;     // keep EXACT like "PNB", "ANB", "Miscellaneous"
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

function toSlug(name: string) {
  return slugify(String(name || ""), { lower: true, strict: true, trim: true });
}

function readBool(v: string) {
  return /^(1|true|yes|y)$/i.test(v || "");
}

function envOrArg(key: string, fallback = ""): string {
  // CLI: node seed-breeds-json.ts KEY=value
  const kv = process.argv.slice(2).find((a) => a.toUpperCase().startsWith(key + "="));
  if (kv) return kv.split("=").slice(1).join("=");
  return process.env[key] ?? fallback;
}

function parseOnlySpecies(v: string): Species[] | null {
  if (!v?.trim()) return null;
  const set = new Set(
    v
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s === "DOG" || s === "CAT" || s === "HORSE")
  );
  return set.size ? (Array.from(set) as Species[]) : null;
}

async function readRows(): Promise<Row[]> {
  const rows = FILES.flatMap((f) =>
    fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as Row[]) : []
  );

  const valid = rows.filter((r) => r?.name && r?.species);
  if (valid.length !== rows.length) {
    console.warn(`Filtered ${rows.length - valid.length} invalid rows (missing name/species).`);
  }

  const filtered = ONLY_SPECIES ? valid.filter((r) => ONLY_SPECIES!.includes(r.species)) : valid;
  return filtered;
}

async function clearBefore(rows: Row[]) {
  // Limit clear to the species present in the seed rows
  const speciesSet = Array.from(new Set(rows.map((r) => r.species))) as Species[];

  console.log(`CLEAR_BEFORE enabled. Target species: ${speciesSet.join(", ")}`);

  if (DRY_RUN) {
    console.log(`[DRY_RUN] Would delete BreedRegistryLink for breeds of ${speciesSet.join(", ")}`);
    console.log(`[DRY_RUN] Would delete Breeds not present in JSON for ${speciesSet.join(", ")}`);
    return;
  }

  // Find current breeds for those species
  const existing = await prisma.breed.findMany({
    where: { species: { in: speciesSet } },
    select: { id: true, name: true, species: true, slug: true },
  });

  // Rows we intend to keep (by normalized uniqueness). Prefer slug when present
  const keepKey = (r: Row) => `${r.species}::${toSlug(r.name)}`;
  const keepSet = new Set(rows.map(keepKey));

  // Links for all existing of these species can be dropped first
  const existingIds = existing.map((b) => b.id);
  if (existingIds.length) {
    await prisma.breedRegistryLink.deleteMany({ where: { breedId: { in: existingIds } } });
  }

  // Delete breeds not present in JSON
  const toDelete = existing.filter((b) => !keepSet.has(`${b.species}::${b.slug || toSlug(b.name)}`));
  if (toDelete.length) {
    const ids = toDelete.map((b) => b.id);
    await prisma.breed.deleteMany({ where: { id: { in: ids } } });
    console.log(`Deleted ${ids.length} breeds not present in JSON.`);
  }
}

async function upsertBreed(row: Row) {
  const slug = toSlug(row.name);
  // Prefer a composite unique like @@unique([species, slug]) if you have it
  // Fallback uses unique name. Adjust where/update/create to your actual schema.
  const where =
    // If you have composite unique:
    // { species_slug: { species: row.species, slug } }
    // Else fallback:
    { name: row.name };

  if (DRY_RUN) {
    console.log(`[DRY_RUN] Upsert Breed: ${row.species} :: ${row.name}`);
    if (row.registries?.length) {
      for (const r of row.registries) {
        console.log(`[DRY_RUN]  └─ link ${r.code} primary=${r.primary ?? ""} status=${r.status ?? ""}`);
      }
    }
    return;
  }

  const breed = await prisma.breed.upsert({
    where: where as any,
    update: { species: row.species, slug },
    create: { name: row.name, species: row.species, slug },
    select: { id: true, name: true },
  });

  if (!row.registries?.length) return;

  for (const reg of row.registries) {
    const code = reg.code?.toUpperCase?.() || "";
    if (!code) continue;

    const registry = await prisma.registry.findUnique({ where: { code } });
    if (!registry) {
      console.warn(`Skipped link for ${breed.name}: registry code ${code} not found in RegistryCatalog`);
      continue;
    }

    await prisma.breedRegistryLink.upsert({
      where: { breedId_registryId: { breedId: breed.id, registryId: registry.id } },
      update: {
        statusText: reg.status ?? null,
        registryRef: reg.registryId ?? null,
        url: reg.url ?? null,
        primary: typeof reg.primary === "boolean" ? reg.primary : null,
        since: typeof reg.since === "number" ? reg.since : null,
        notes: reg.notes ?? null,
        proofUrl: reg.proofUrl ?? null,
      },
      create: {
        breedId: breed.id,
        registryId: registry.id,
        statusText: reg.status ?? null,
        registryRef: reg.registryId ?? null,
        url: reg.url ?? null,
        primary: typeof reg.primary === "boolean" ? reg.primary : null,
        since: typeof reg.since === "number" ? reg.since : null,
        notes: reg.notes ?? null,
        proofUrl: reg.proofUrl ?? null,
      },
    });
  }
}

function chunk<T>(arr: T[], size = 200) {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));
}

async function main() {
  const rows = await readRows();
  console.log(`Seeding curated breeds from JSON (rows: ${rows.length}) …`);

  if (CLEAR_BEFORE) {
    await clearBefore(rows);
  }

  const batches = chunk(rows, CHUNK_SIZE);
  for (const batch of batches) {
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
