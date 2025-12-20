import { spawnSync, spawn } from "node:child_process";
import process from "node:process";

function run(cmd, args, env) {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    env,
  });
  return res.status ?? 1;
}

const schemaPath = "prisma/schema.prisma";
const migrateUrl = process.env.MIGRATE_DATABASE_URL;
const appUrl = process.env.DATABASE_URL;

if (!appUrl) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}
if (!migrateUrl) {
  console.error("MIGRATE_DATABASE_URL is missing.");
  process.exit(1);
}

const prismaBin =
  process.platform === "win32"
    ? "node_modules/.bin/prisma.cmd"
    : "node_modules/.bin/prisma";

console.log("Running prisma migrate deploy using MIGRATE_DATABASE_URL...");
const migrateEnv = { ...process.env, DATABASE_URL: migrateUrl };
const migrateStatus = run(prismaBin, ["migrate", "deploy", "--schema", schemaPath], migrateEnv);

if (migrateStatus !== 0) {
  console.error("Migration failed. Not starting server.");
  process.exit(migrateStatus);
}

console.log("Starting API with runtime DATABASE_URL...");
const child = spawn("node", ["dist/server.js"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: appUrl },
});

child.on("exit", (code) => process.exit(code ?? 1));
