// prisma.config.ts
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

const root = process.cwd();

// Highest priority: explicit env file passed via ENV_FILE or DOTENV_CONFIG_PATH
const explicit = process.env.ENV_FILE || process.env.DOTENV_CONFIG_PATH;

function loadEnv(filePath: string) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  if (fs.existsSync(abs)) {
    dotenv.config({ path: abs });
    console.log(`[prisma.config] Loaded env from: ${abs}`);
    return true;
  }
  return false;
}

if (!(explicit && loadEnv(explicit))) {
  const candidates = [".env.local", ".env.dev", ".env.development", ".env"];
  const chosen = candidates
    .map((p) => path.join(root, p))
    .find((abs) => fs.existsSync(abs));

  if (chosen) {
    dotenv.config({ path: chosen });
    console.log(`[prisma.config] Loaded env from: ${chosen}`);
  } else {
    dotenv.config();
    console.log(`[prisma.config] No explicit env file found; using process.env as-is`);
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
});
