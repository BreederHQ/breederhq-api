#!/usr/bin/env tsx
/**
 * Test Runner for Phase 6 Party Migration Tests
 *
 * Runs all test files using Node.js built-in test runner.
 * Exits with non-zero code if any test fails.
 */

import { run } from "node:test";
import { spec as specReporter } from "node:test/reporters";
import { glob } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log("Running Phase 6 Party Migration Tests...\n");

  const testFiles = [
    path.join(__dirname, "party-api-contracts.test.ts"),
    path.join(__dirname, "party-migration-regression.test.ts"),
  ];

  let hasFailures = false;

  for (const file of testFiles) {
    console.log(`\n=== Running ${path.basename(file)} ===\n`);

    try {
      const stream = run({
        files: [file],
      });

      stream.compose(specReporter).pipe(process.stdout);

      for await (const event of stream) {
        if (event.type === "test:fail") {
          hasFailures = true;
        }
      }
    } catch (error) {
      console.error(`Error running test file ${file}:`, error);
      hasFailures = true;
    }
  }

  if (hasFailures) {
    console.error("\n❌ Some tests failed");
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed");
    process.exit(0);
  }
}

runTests().catch((error) => {
  console.error("Fatal error running tests:", error);
  process.exit(1);
});
