/**
 * Integration Tests for Animal Import/Export API
 *
 * Tests the API endpoints directly without requiring UI
 * Run: npx tsx --test tests/integration/animal-import-api.test.ts
 */

import { test } from "node:test";
import assert from "node:assert";

const BASE_URL = "http://localhost:6001";

// Note: These tests require a valid session token
// You'll need to manually obtain a session token from a logged-in user
const SESSION_TOKEN = process.env.TEST_SESSION_TOKEN || "";

test.describe("Animal Import/Export API", { skip: !SESSION_TOKEN }, () => {
  const createdAnimalIds: number[] = [];

  test.after(async () => {
    // Cleanup created animals
    for (const id of createdAnimalIds) {
      try {
        await fetch(`${BASE_URL}/api/animals/${id}`, {
          method: "DELETE",
          headers: { Cookie: `session=${SESSION_TOKEN}` },
        });
        console.log(`✓ Cleaned up animal ${id}`);
      } catch (error) {
        console.error(`✗ Failed to cleanup animal ${id}:`, error);
      }
    }
  });

  test("should download CSV template", async () => {
    const response = await fetch(`${BASE_URL}/api/animals/templates/csv`, {
      headers: { Cookie: `session=${SESSION_TOKEN}` },
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get("content-type"), "text/csv");

    const content = await response.text();
    assert.ok(content.includes("Name,Species,Sex"));
    assert.ok(content.includes("Bella"));
  });

  test("should preview valid CSV", async () => {
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      'TestAPIAnimal,DOG,FEMALE,2023-01-15,,,,,,,ACTIVE,"API test animal"',
    ].join("\n");

    const response = await fetch(`${BASE_URL}/api/animals/import/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${SESSION_TOKEN}`,
      },
      body: JSON.stringify({ csvContent: csv }),
    });

    assert.strictEqual(response.status, 200);

    const result = await response.json();
    assert.strictEqual(result.rows.length, 1);
    assert.strictEqual(result.rows[0].status, "valid");
    assert.strictEqual(result.summary.valid, 1);
  });

  test("should import valid CSV", async () => {
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      'TestAPIImport,DOG,MALE,2023-06-01,,,,,,,BREEDING,"Imported via API test"',
    ].join("\n");

    // Preview first
    const previewResponse = await fetch(`${BASE_URL}/api/animals/import/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${SESSION_TOKEN}`,
      },
      body: JSON.stringify({ csvContent: csv }),
    });

    assert.strictEqual(previewResponse.status, 200);
    const previewResult = await previewResponse.json();

    // Import with empty resolutions (no warnings)
    const importResponse = await fetch(`${BASE_URL}/api/animals/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${SESSION_TOKEN}`,
      },
      body: JSON.stringify({
        rows: previewResult.rows,
        resolutions: {},
      }),
    });

    assert.strictEqual(importResponse.status, 200);

    const importResult = await importResponse.json();
    assert.strictEqual(importResult.summary.imported, 1);
    assert.ok(importResult.importedIds.length > 0);

    // Track for cleanup
    createdAnimalIds.push(...importResult.importedIds);
  });

  test("should detect validation errors", async () => {
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      ",DOG,FEMALE,,,,,,,,,", // Missing name
    ].join("\n");

    const response = await fetch(`${BASE_URL}/api/animals/import/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${SESSION_TOKEN}`,
      },
      body: JSON.stringify({ csvContent: csv }),
    });

    assert.strictEqual(response.status, 200);

    const result = await response.json();
    assert.strictEqual(result.rows[0].status, "error");
    assert.ok(result.rows[0].errors.some((e: string) => e.includes("Name is required")));
  });

  test("should export animals to CSV", async () => {
    const response = await fetch(`${BASE_URL}/api/animals/export/csv?species=DOG&status=ACTIVE`, {
      headers: { Cookie: `session=${SESSION_TOKEN}` },
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get("content-type"), "text/csv");

    const content = await response.text();
    assert.ok(content.includes("ID,Name,Species"));
  });
});

console.log("✅ API Integration tests ready");
console.log("ℹ️  Set TEST_SESSION_TOKEN environment variable to run tests");
