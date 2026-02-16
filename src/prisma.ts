// src/prisma.ts
import dotenv from "dotenv";
import { getAppSecrets } from "./config/secrets.js";

// Honor ENV_FILE if present; otherwise default to .env.dev in dev, .env in prod.
const ENV_FILE =
  process.env.ENV_FILE ||
  (process.env.NODE_ENV === "production" ? ".env" : ".env.dev");

// Load envs once, before Prisma client is constructed.
dotenv.config({ path: ENV_FILE });

// Fetch all secrets from AWS Secrets Manager (deployed environments)
// Merges DATABASE_URL, STRIPE_SECRET_KEY, JWT secrets, etc. into process.env
if (process.env.USE_SECRETS_MANAGER === "true") {
  const secrets = await getAppSecrets();
  Object.assign(process.env, secrets);
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
