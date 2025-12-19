// prisma.config.ts
import * as path from "path";
import * as fs from "fs";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Choose the first existing env file from this priority list:
const candidates = [
  process.env.DOTENV_CONFIG_PATH,                     // explicit override
  path.resolve(__dirname, "prisma/.env.dev.migrate"), // preferred dev-migrate
  path.resolve(__dirname, ".env.dev.migrate"),
  path.resolve(__dirname, "prisma/.env"),             // common Prisma default
  path.resolve(__dirname, ".env"),
].filter(Boolean) as string[];

const chosen = candidates.find((p) => fs.existsSync(p));

// Load envs (if nothing found, dotenv will noop)
if (chosen) config({ path: chosen });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasources: {
    db: {
      url: { fromEnvVar: "DATABASE_URL" },
    },
  },
});
