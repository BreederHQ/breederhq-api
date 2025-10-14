import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: process.env.DOTENV_CONFIG_PATH ?? ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasources: {
    db: {
      url: { fromEnvVar: "DATABASE_URL" },
      shadowDatabaseUrl: { fromEnvVar: "SHADOW_DATABASE_URL" }, // ← required
    },
  },
});
