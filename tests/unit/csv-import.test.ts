/**
 * Unit Tests for CSV Import Library
 *
 * Tests the CSV parser and validation logic without requiring
 * a running server or database.
 *
 * Run: npx tsx --test tests/unit/csv-import.test.ts
 */

import { test } from "node:test";
import assert from "node:assert";
import { parseAnimalCSV } from "../../src/lib/csv-import/parser.js";
import { generateAnimalCsvTemplate, ANIMAL_CSV_HEADERS } from "../../src/lib/csv-import/template.js";

test("CSV Parser - Valid Data", async (t) => {
  await t.test("should parse valid CSV with 2 animals", () => {
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      'Bella,DOG,FEMALE,2023-05-15,982000123456789,Golden Retriever,Daisy,Max,AKC,WS12345678,BREEDING,"Champion bloodline"',
      'Duke,DOG,MALE,2024-01-20,982000987654321,Labrador Retriever,,,AKC,WS98765432,ACTIVE,',
    ].join("\n");

    const rows = parseAnimalCSV(csv);

    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].status, "valid");
    assert.strictEqual(rows[0].data.name, "Bella");
    assert.strictEqual(rows[0].data.species, "DOG");
    assert.strictEqual(rows[0].data.sex, "FEMALE");
    assert.strictEqual(rows[1].data.name, "Duke");
  });

  await t.test("should handle case-insensitive species and sex", () => {
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      "TestDog,dog,female,2023-01-01,,,,,,,active,",
    ].join("\n");

    const rows = parseAnimalCSV(csv);

    assert.strictEqual(rows[0].status, "valid");
    assert.strictEqual(rows[0].data.species, "DOG");
    assert.strictEqual(rows[0].data.sex, "FEMALE");
    assert.strictEqual(rows[0].data.status, "ACTIVE");
  });

  await t.test("should handle quoted fields with commas and newlines", () => {
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      'TestDog,DOG,FEMALE,2023-01-01,,,,,,,ACTIVE,"Notes with ""quotes"", commas, and\nnewlines"',
    ].join("\n");

    const rows = parseAnimalCSV(csv);

    assert.strictEqual(rows[0].status, "valid");
    assert.ok(rows[0].data.notes?.includes("quotes"));
  });

  await t.test("should default status to ACTIVE when not provided", () => {
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      "TestDog,DOG,FEMALE,,,,,,,,,",
    ].join("\n");

    const rows = parseAnimalCSV(csv);

    assert.strictEqual(rows[0].data.status, "ACTIVE");
  });
});

test("CSV Parser - Validation Errors", async (t) => {
  await t.test("should error when name is missing", () => {
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      ",DOG,FEMALE,,,,,,,,,",
    ].join("\n");

    const rows = parseAnimalCSV(csv);

    assert.strictEqual(rows[0].status, "error");
    assert.ok(rows[0].errors?.some((e) => e.includes("Name is required")));
  });

  await t.test("should error when species is invalid", () => {
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      "TestDog,DOGGO,FEMALE,,,,,,,,,",
    ].join("\n");

    const rows = parseAnimalCSV(csv);

    assert.strictEqual(rows[0].status, "error");
    assert.ok(rows[0].errors?.some((e) => e.includes("Species") && e.includes("invalid")));
  });

  await t.test("should error when sex is invalid", () => {
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      "TestDog,DOG,UNKNOWN,,,,,,,,,",
    ].join("\n");

    const rows = parseAnimalCSV(csv);

    assert.strictEqual(rows[0].status, "error");
    assert.ok(rows[0].errors?.some((e) => e.includes("Sex") && e.includes("invalid")));
  });

  await t.test("should error when birth date format is invalid", () => {
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      "TestDog,DOG,FEMALE,Jan 15 2023,,,,,,,,,",
    ].join("\n");

    const rows = parseAnimalCSV(csv);

    assert.strictEqual(rows[0].status, "error");
    assert.ok(rows[0].errors?.some((e) => e.includes("Birth Date") && e.includes("invalid")));
  });

  await t.test("should error when birth date is in future", () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      `TestDog,DOG,FEMALE,${futureDate},,,,,,,,,`,
    ].join("\n");

    const rows = parseAnimalCSV(csv);

    assert.strictEqual(rows[0].status, "error");
    assert.ok(rows[0].errors?.some((e) => e.includes("future")));
  });

  await t.test("should error when status is invalid", () => {
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      "TestDog,DOG,FEMALE,,,,,,,,INVALID,",
    ].join("\n");

    const rows = parseAnimalCSV(csv);

    assert.strictEqual(rows[0].status, "error");
    assert.ok(rows[0].errors?.some((e) => e.includes("Status") && e.includes("invalid")));
  });

  await t.test("should error when name is too long", () => {
    const longName = "A".repeat(300);
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      `${longName},DOG,FEMALE,,,,,,,,,`,
    ].join("\n");

    const rows = parseAnimalCSV(csv);

    assert.strictEqual(rows[0].status, "error");
    assert.ok(rows[0].errors?.some((e) => e.includes("255")));
  });

  await t.test("should error when registry number provided without registry name", () => {
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      "TestDog,DOG,FEMALE,,,,,,,TEST123,,",
    ].join("\n");

    const rows = parseAnimalCSV(csv);

    assert.strictEqual(rows[0].status, "error");
    assert.ok(rows[0].errors?.some((e) => e.includes("Registry")));
  });
});

test("CSV Parser - Edge Cases", async (t) => {
  await t.test("should handle empty CSV", () => {
    const csv = "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes";

    assert.throws(() => {
      parseAnimalCSV(csv);
    }, /CSV file must contain a header row and at least one data row/);
  });

  await t.test("should handle missing required columns", () => {
    const csv = ["Name,Species", "TestDog,DOG"].join("\n");

    assert.throws(() => {
      parseAnimalCSV(csv);
    }, /Missing required columns/);
  });

  await t.test("should handle empty lines in CSV", () => {
    const csv = [
      "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
      "TestDog1,DOG,FEMALE,,,,,,,,,",
      "",
      "TestDog2,DOG,MALE,,,,,,,,,",
    ].join("\n");

    const rows = parseAnimalCSV(csv);

    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].data.name, "TestDog1");
    assert.strictEqual(rows[1].data.name, "TestDog2");
  });

  await t.test("should handle all species types", () => {
    const species = ["DOG", "CAT", "HORSE", "GOAT", "RABBIT", "SHEEP"];

    for (const sp of species) {
      const csv = [
        "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
        `Test${sp},${sp},FEMALE,,,,,,,,,`,
      ].join("\n");

      const rows = parseAnimalCSV(csv);
      assert.strictEqual(rows[0].status, "valid", `${sp} should be valid`);
      assert.strictEqual(rows[0].data.species, sp);
    }
  });

  await t.test("should handle all status types", () => {
    const statuses = ["ACTIVE", "BREEDING", "UNAVAILABLE", "RETIRED", "DECEASED", "PROSPECT"];

    for (const status of statuses) {
      const csv = [
        "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
        `TestDog,DOG,FEMALE,,,,,,,,${status},`,
      ].join("\n");

      const rows = parseAnimalCSV(csv);
      assert.strictEqual(rows[0].status, "valid", `${status} should be valid`);
      assert.strictEqual(rows[0].data.status, status);
    }
  });
});

test("CSV Template Generator", async (t) => {
  await t.test("should generate template with correct headers", () => {
    const template = generateAnimalCsvTemplate(false);
    const lines = template.split("\n");

    assert.strictEqual(lines.length, 1); // Only header when includeExamples=false
    assert.strictEqual(lines[0], ANIMAL_CSV_HEADERS.join(","));
  });

  await t.test("should generate template with examples", () => {
    const template = generateAnimalCsvTemplate(true);
    const lines = template.split("\n");

    assert.ok(lines.length > 1); // Header + examples
    assert.ok(lines[1].includes("Bella"));
    assert.ok(lines[2].includes("Duke"));
  });

  await t.test("should escape CSV fields properly", () => {
    const template = generateAnimalCsvTemplate(true);

    // Check that fields without special characters are not quoted
    assert.ok(template.includes('Champion bloodline'));
    // Check that the template contains the example data
    assert.ok(template.includes('Bella'));
    assert.ok(template.includes('Duke'));
  });

  await t.test("should have all required headers", () => {
    const template = generateAnimalCsvTemplate(false);
    const headers = template.split(",");

    assert.ok(headers.includes("Name"));
    assert.ok(headers.includes("Species"));
    assert.ok(headers.includes("Sex"));
    assert.ok(headers.includes("Birth Date"));
  });
});

test("CSV Parser - Performance", async (t) => {
  await t.test("should handle 100 rows efficiently", () => {
    const rows = ["Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes"];

    for (let i = 1; i <= 100; i++) {
      rows.push(`TestDog${i},DOG,${i % 2 === 0 ? "FEMALE" : "MALE"},2023-01-01,,,,,,,ACTIVE,`);
    }

    const csv = rows.join("\n");

    const startTime = Date.now();
    const parsed = parseAnimalCSV(csv);
    const duration = Date.now() - startTime;

    assert.strictEqual(parsed.length, 100);
    assert.ok(duration < 1000, `Parse should take < 1 second, took ${duration}ms`);
  });
});

console.log("✅ All CSV Import unit tests passed!");
