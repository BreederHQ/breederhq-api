// prisma.config.ts
import { config } from "dotenv";  
import { defineConfig } from "prisma/config";

config({
  path:
    process.env.DOTENV_CONFIG_PATH ??
    (process.env.NODE_ENV === "production" ? ".env" : ".env.dev"),
});


export default defineConfig({
  schema: "prisma/schema.prisma",
});
