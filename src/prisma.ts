// src/prisma.ts
import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma instance across the whole process.
 * - Cached on globalThis in dev to survive hot reloads.
 * - Default export only (avoid named+default duplicates).
 */
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    // Optional: enable query logging in dev
    log:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["error", "warn", "info"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}

// Optional: tidy shutdown (doesn't harm if omitted)
process.on("beforeExit", async () => {
  try {
    await prisma.$disconnect();
  } catch {
    /* noop */
  }
});

export default prisma;
