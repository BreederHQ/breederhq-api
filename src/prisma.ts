// src/prisma.ts
import dotenv from "dotenv";
import { getDatabaseSecrets } from "./config/secrets.js";

// Honor ENV_FILE if present; otherwise default to .env.dev in dev, .env in prod.
const ENV_FILE =
  process.env.ENV_FILE ||
  (process.env.NODE_ENV === "production" ? ".env" : ".env.dev");

// Load envs once, before Prisma client is constructed.
dotenv.config({ path: ENV_FILE });

// Fetch database secrets from AWS Secrets Manager (production only)
if (process.env.NODE_ENV === "production") {
  const dbSecrets = await getDatabaseSecrets();
  // Merge database secrets into process.env
  Object.assign(process.env, dbSecrets);
}

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { __PRISMA__?: PrismaClient };

export const prisma =
  globalForPrisma.__PRISMA__ ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["error", "warn"], // add "query" if you want noisy SQL in dev
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__PRISMA__ = prisma;
}

export default prisma;

export async function closePrisma() {
  try {
    await prisma.$disconnect();
  } catch {
    /* noop */
  }
}
