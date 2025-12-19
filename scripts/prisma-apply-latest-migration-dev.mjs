import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

function sh(cmd) {
  execSync(cmd, { stdio: "inherit", shell: true });
}

function latestMigrationDir() {
  const base = join("prisma", "migrations");
  const dirs = readdirSync(base)
    .map((d) => join(base, d))
    .filter((p) => statSync(p).isDirectory())
    .sort();
  return dirs[dirs.length - 1];
}

const dir = latestMigrationDir();
const file = join(dir, "migration.sql");
const name = dir.split(/[\\/]/).pop();

console.log(`Applying ${name} to DEV via db execute...`);
sh(`npx dotenv -e .env.dev -- prisma db execute --schema=prisma/schema.prisma --file "${file}"`);

console.log(`Marking ${name} as applied in DEV migrations history...`);
sh(`npx dotenv -e .env.dev -- prisma migrate resolve --schema=prisma/schema.prisma --applied "${name}"`);

console.log("Done.\n");
