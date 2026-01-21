#!/usr/bin/env node
/**
 * Verification script for TagModule filtering in GET /tags endpoint
 *
 * Tests that all 6 TagModule enum values are accepted:
 * - CONTACT
 * - ORGANIZATION
 * - ANIMAL
 * - WAITLIST_ENTRY
 * - OFFSPRING_GROUP
 * - OFFSPRING
 *
 * Also verifies that invalid module values return 400 error
 */

const BASE_URL = process.env.API_URL || "http://localhost:3000";
const TENANT_ID = process.env.TENANT_ID || "1";

// Test cases: valid module values
const VALID_MODULES = [
  "CONTACT",
  "ORGANIZATION",
  "ANIMAL",
  "WAITLIST_ENTRY",
  "OFFSPRING_GROUP",
  "OFFSPRING",
];

// Test cases: invalid module values
const INVALID_MODULES = [
  "BAD_VALUE",
  "INVALID",
  "contact", // lowercase should fail
];

async function testModuleFilter(module, shouldSucceed = true) {
  const url = `${BASE_URL}/api/v1/tags?module=${module}`;

  try {
    const response = await fetch(url, {
      headers: {
        "x-tenant-id": TENANT_ID,
      },
    });

    const status = response.status;
    const data = await response.json();

    if (shouldSucceed) {
      if (status === 200) {
        console.log(`✓ ${module.padEnd(20)} → 200 OK (${data.total || 0} tags)`);
        return true;
      } else {
        console.log(`✗ ${module.padEnd(20)} → ${status} (expected 200)`);
        console.log(`  Response:`, data);
        return false;
      }
    } else {
      if (status === 400) {
        console.log(`✓ ${module.padEnd(20)} → 400 Bad Request (as expected)`);
        return true;
      } else {
        console.log(`✗ ${module.padEnd(20)} → ${status} (expected 400)`);
        console.log(`  Response:`, data);
        return false;
      }
    }
  } catch (error) {
    console.log(`✗ ${module.padEnd(20)} → Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log("=".repeat(60));
  console.log("Tag Module Filtering Verification");
  console.log("=".repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Tenant ID: ${TENANT_ID}`);
  console.log();

  console.log("Testing valid module values (should return 200):");
  console.log("-".repeat(60));
  let validPassed = 0;
  for (const module of VALID_MODULES) {
    const passed = await testModuleFilter(module, true);
    if (passed) validPassed++;
  }
  console.log();

  console.log("Testing invalid module values (should return 400):");
  console.log("-".repeat(60));
  let invalidPassed = 0;
  for (const module of INVALID_MODULES) {
    const passed = await testModuleFilter(module, false);
    if (passed) invalidPassed++;
  }
  console.log();

  console.log("=".repeat(60));
  console.log("Results:");
  console.log(`  Valid modules:   ${validPassed}/${VALID_MODULES.length} passed`);
  console.log(`  Invalid modules: ${invalidPassed}/${INVALID_MODULES.length} passed`);

  const totalTests = VALID_MODULES.length + INVALID_MODULES.length;
  const totalPassed = validPassed + invalidPassed;

  if (totalPassed === totalTests) {
    console.log(`  Overall: ${totalPassed}/${totalTests} tests passed ✓`);
    console.log("=".repeat(60));
    process.exit(0);
  } else {
    console.log(`  Overall: ${totalPassed}/${totalTests} tests passed ✗`);
    console.log("=".repeat(60));
    process.exit(1);
  }
}

// Test if server is running
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// Main
(async () => {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log("⚠️  Warning: Server may not be running at", BASE_URL);
    console.log("   Set API_URL environment variable if using different URL");
    console.log();
  }

  await runTests();
})();
