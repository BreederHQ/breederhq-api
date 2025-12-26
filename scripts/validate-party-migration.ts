#!/usr/bin/env tsx
/**
 * Party Migration SQL Validation Runner
 *
 * Executes all validate_step6*.sql files and reports results.
 * Fails if any validation query returns FAIL status.
 */

import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function runSQLValidation(sqlFile: string): Promise<boolean> {
  console.log(`\n=== Running ${path.basename(sqlFile)} ===\n`);

  try {
    const sql = await fs.readFile(sqlFile, "utf-8");

    // Execute the SQL file
    const results = await prisma.$queryRawUnsafe<Array<Record<string, any>>>(sql);

    let hasFailures = false;

    // Print results
    for (const row of results) {
      const result = row.result || row.status || row.check_type || "";
      const isFail = String(result).toLowerCase().includes("fail");

      if (isFail) {
        hasFailures = true;
        console.error("❌", JSON.stringify(row, null, 2));
      } else {
        console.log("✅", JSON.stringify(row, null, 2));
      }
    }

    return !hasFailures;
  } catch (error) {
    console.error(`Error running ${sqlFile}:`, error);
    return false;
  }
}

async function main() {
  console.log("Running Party Migration SQL Validation\n");

  const sqlDir = path.join(__dirname, "..", "prisma", "sql");

  const validationFiles = [
    "validate_step6_party_only_runtime.sql",
    "validate_step6_waitlist_post.sql",
    "validate_step6_offspring_buyer_post.sql",
    "validate_step6_offspring_group_buyer_post.sql",
    "validate_step6f_planparty_post.sql",
    "validate_step6g_animal_post.sql",
    "validate_step6h_animalowner_post.sql",
    "validate_step6i_breedingattempt_post.sql",
    "validate_step6j_invoice_post.sql",
    "validate_step6k_contractparty_post.sql",
    "validate_step6l_offspringcontract_post.sql",
    "validate_step6m_user_post.sql",
  ];

  let allPassed = true;

  for (const file of validationFiles) {
    const filePath = path.join(sqlDir, file);

    try {
      await fs.access(filePath);
    } catch {
      console.warn(`⚠️  Skipping ${file} (not found)`);
      continue;
    }

    const passed = await runSQLValidation(filePath);
    if (!passed) {
      allPassed = false;
    }
  }

  await prisma.$disconnect();

  if (!allPassed) {
    console.error("\n❌ Some SQL validations failed");
    process.exit(1);
  } else {
    console.log("\n✅ All SQL validations passed");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
