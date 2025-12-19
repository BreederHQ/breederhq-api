import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function sh(cmd) {
  execSync(cmd, { stdio: "inherit", shell: true });
}

function shOut(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "inherit"], shell: true }).toString();
}

// You must have DATABASE_URL for prod in .env.prod.migrate
// This script generates a migration SQL by diffing PROD -> schema.prisma,
// without prisma migrate dev.
const ts = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\..+/, "")
  .replace("T", "")
  .slice(0, 14);

const name = process.env.MIGRATION_NAME || "manual_diff";
const dirName = `${ts}_${name}`;
const dir = join("prisma", "migrations", dirName);

mkdirSync(dir, { recursive: true });

const cmd =
  `npx dotenv -e .env.prod.migrate -- ` +
  `prisma migrate diff ` +
  `--from-url "$DATABASE_URL" ` +
  `--to-schema-datamodel prisma/schema.prisma ` +
  `--script`;

const sql = shOut(cmd);

const outPath = join(dir, "migration.sql");
writeFileSync(outPath, sql, "utf8");

console.log(`\nWrote: ${outPath}\n`);
console.log(`Next: review the SQL, then run: npm run db:migrate:apply:dev\n`);
