// src/prisma.ts
// Secrets are injected by boot-with-secrets.js (deployed) or dotenv-cli (local dev).
// No in-app secret fetching needed.
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
