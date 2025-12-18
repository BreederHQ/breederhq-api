// prisma/seed/seed-env-bootstrap.ts
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const root = process.cwd();
const fromEnv = process.env.ENV_FILE;
const candidates = [
  fromEnv && (path.isAbsolute(fromEnv) ? fromEnv : path.join(root, fromEnv)),
  path.join(root, ".env"),
  path.join(root, ".env.dev.migrate"),
  path.join(root, ".env.dev"),
].filter(Boolean) as string[];

for (const p of candidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}
// If none found, dotenv will noop; Prisma Client will then fail loudly, which is fine.
