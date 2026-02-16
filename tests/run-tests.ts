#!/usr/bin/env tsx
/**
 * Test Runner for Node.js Built-in Test Runner Tests
 *
 * Runs all test files using Node.js built-in test runner.
 * Exits with non-zero code if any test fails.
 *
 * IMPORTANT: Jest-based tests are NOT supported here.
 * This runner will reject any file containing @jest/globals imports.
 * Jest tests must be run separately with Jest.
 */

import { run } from "node:test";
import { spec as specReporter } from "node:test/reporters";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Defensive check: Reject Jest test files from being run with Node.js test runner.
 * Fails fast with a clear error message naming the file.
 */
async function assertNotJestFile(filePath: string): Promise<void> {
  const basename = path.basename(filePath);

  // Pattern check: reject *.jest.* files
  if (basename.includes(".jest.")) {
    throw new Error(
      `REJECTED: ${basename} matches *.jest.* pattern. Jest tests cannot run in Node.js test runner.`
    );
  }

  // Content check: reject files importing @jest/globals
  const content = await readFile(filePath, "utf-8");
  if (content.includes("@jest/globals")) {
    throw new Error(
      `REJECTED: ${basename} contains @jest/globals import. Jest tests cannot run in Node.js test runner.`
    );
  }
}

async function runTests() {
  console.log("Running Node.js Test Runner Tests...\n");

  const testFiles = [
    path.join(__dirname, "party-api-contracts.test.ts"),
    path.join(__dirname, "party-migration-regression.test.ts"),
    path.join(__dirname, "animal-public-listing.test.ts"),
    path.join(__dirname, "invoice-buyer-enforcement.test.ts"),
    path.join(__dirname, "trait-definitions-contract.test.ts"),
    path.join(__dirname, "integration", "network-breeding-discovery.test.ts"),
    path.join(__dirname, "integration", "listing-boost.test.ts"),
  ];

  // Defensive check: reject any Jest files before running
  console.log("Validating test files are Node.js test runner compatible...");
  for (const file of testFiles) {
    try {
      await assertNotJestFile(file);
    } catch (error) {
      console.error(`\n❌ ${(error as Error).message}`);
      process.exit(1);
    }
  }
  console.log("✓ All test files validated\n");

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
