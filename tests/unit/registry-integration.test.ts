/**
 * Unit Tests for Registry Integration
 *
 * Tests the registry client pattern and validation logic without requiring
 * a running server or database.
 *
 * Run: npx tsx --test tests/unit/registry-integration.test.ts
 */

import { test } from "node:test";
import assert from "node:assert";
import { ManualRegistryClient, createManualClient } from "../../src/services/registry/manual-client.js";
import {
  getRegistryClient,
  getRegistryCapabilities,
  getSupportedRegistryCodes,
  hasApiSupport,
  clearClientCache,
} from "../../src/services/registry/client-factory.js";
import {
  getGenerationFromPosition,
  getPositionLabel,
  PEDIGREE_POSITIONS,
} from "../../src/services/registry/types.js";

// ─────────────────────────────────────────────────────────────────────────────
// ManualRegistryClient Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ManualRegistryClient - Properties", async (t) => {
  await t.test("should have correct registry code and name", () => {
    const client = new ManualRegistryClient("AQHA", "American Quarter Horse Association");

    assert.strictEqual(client.registryCode, "AQHA");
    assert.strictEqual(client.registryName, "American Quarter Horse Association");
    assert.strictEqual(client.hasApiSupport, false);
  });

  await t.test("should use registry code as name when name not provided", () => {
    const client = new ManualRegistryClient("CUSTOM");

    assert.strictEqual(client.registryCode, "CUSTOM");
    assert.strictEqual(client.registryName, "CUSTOM");
  });

  await t.test("should report API as unavailable", async () => {
    const client = new ManualRegistryClient("AQHA");
    const available = await client.isApiAvailable();

    assert.strictEqual(available, false);
  });
});

test("ManualRegistryClient - Capabilities", async (t) => {
  await t.test("should report manualOnly capabilities", () => {
    const client = new ManualRegistryClient("AQHA", "American Quarter Horse Association");
    const caps = client.getCapabilities();

    assert.strictEqual(caps.lookup, false);
    assert.strictEqual(caps.verification, false);
    assert.strictEqual(caps.pedigree, false);
    assert.strictEqual(caps.maxPedigreeGenerations, 0);
    assert.strictEqual(caps.oauth, false);
    assert.strictEqual(caps.apiKey, false);
    assert.strictEqual(caps.manualOnly, true);
    assert.ok(caps.notes?.includes("does not have a public API"));
  });
});

test("ManualRegistryClient - Registration Format Validation", async (t) => {
  await t.test("should validate AQHA format (7 digits)", async () => {
    const client = new ManualRegistryClient("AQHA");

    // Valid: 7 digits
    const validResult = await client.verifyRegistration("5849202");
    assert.strictEqual(validResult.identifierValid, true);
    assert.strictEqual(validResult.verified, false); // Manual verification still required
    assert.strictEqual(validResult.confidence, "LOW");

    // Invalid: 6 digits
    const invalidResult = await client.verifyRegistration("584920");
    assert.strictEqual(invalidResult.identifierValid, false);
    assert.strictEqual(invalidResult.verified, false);
    assert.strictEqual(invalidResult.confidence, "NONE");
    assert.ok(invalidResult.errorMessage?.includes("format invalid"));
  });

  await t.test("should validate Jockey Club format (1-2 letters + 5-6 digits)", async () => {
    const client = new ManualRegistryClient("JOCKEY_CLUB");

    // Valid: A12345
    const validResult1 = await client.verifyRegistration("A12345");
    assert.strictEqual(validResult1.identifierValid, true);

    // Valid: AB123456
    const validResult2 = await client.verifyRegistration("AB123456");
    assert.strictEqual(validResult2.identifierValid, true);

    // Invalid: no letter
    const invalidResult = await client.verifyRegistration("123456");
    assert.strictEqual(invalidResult.identifierValid, false);
  });

  await t.test("should validate APHA format (6-7 digits)", async () => {
    const client = new ManualRegistryClient("APHA");

    const validResult1 = await client.verifyRegistration("123456");
    assert.strictEqual(validResult1.identifierValid, true);

    const validResult2 = await client.verifyRegistration("1234567");
    assert.strictEqual(validResult2.identifierValid, true);

    const invalidResult = await client.verifyRegistration("12345");
    assert.strictEqual(invalidResult.identifierValid, false);
  });

  await t.test("should validate AHA format (6-9 digits)", async () => {
    const client = new ManualRegistryClient("AHA");

    const validResult = await client.verifyRegistration("123456789");
    assert.strictEqual(validResult.identifierValid, true);

    const invalidResult = await client.verifyRegistration("12345");
    assert.strictEqual(invalidResult.identifierValid, false);
  });

  await t.test("should validate USEF format (8-12 alphanumeric)", async () => {
    const client = new ManualRegistryClient("USEF");

    const validResult = await client.verifyRegistration("ABCD1234");
    assert.strictEqual(validResult.identifierValid, true);

    const invalidResult = await client.verifyRegistration("ABC");
    assert.strictEqual(invalidResult.identifierValid, false);
  });

  await t.test("should use default pattern for unknown registries", async () => {
    const client = new ManualRegistryClient("UNKNOWN_REGISTRY");

    // Default: 4-20 alphanumeric characters
    const validResult = await client.verifyRegistration("ABC-12345");
    assert.strictEqual(validResult.identifierValid, true);

    const invalidResult = await client.verifyRegistration("AB");
    assert.strictEqual(invalidResult.identifierValid, false);
  });
});

test("ManualRegistryClient - Unsupported Operations", async (t) => {
  await t.test("should return null for lookup", async () => {
    const client = new ManualRegistryClient("AQHA");
    const result = await client.lookupByRegistration("5849202");

    assert.strictEqual(result, null);
  });

  await t.test("should return null for pedigree", async () => {
    const client = new ManualRegistryClient("AQHA");
    const result = await client.getPedigree("5849202", 3);

    assert.strictEqual(result, null);
  });

  await t.test("should throw for connect", async () => {
    const client = new ManualRegistryClient("AQHA");

    await assert.rejects(
      async () => {
        await client.connect?.(1, { apiKey: "test" });
      },
      /does not support API connections/
    );
  });

  await t.test("should throw for disconnect", async () => {
    const client = new ManualRegistryClient("AQHA");

    await assert.rejects(
      async () => {
        await client.disconnect?.(1);
      },
      /does not support API connections/
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Client Factory Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ClientFactory - getRegistryClient", async (t) => {
  // Clear cache before each test run
  clearClientCache();

  await t.test("should return ManualRegistryClient for known registries", () => {
    const client = getRegistryClient("AQHA");

    assert.ok(client instanceof ManualRegistryClient);
    assert.strictEqual(client.registryCode, "AQHA");
    assert.strictEqual(client.registryName, "American Quarter Horse Association");
  });

  await t.test("should handle case insensitivity", () => {
    clearClientCache();
    const client1 = getRegistryClient("aqha");
    const client2 = getRegistryClient("AQHA");

    assert.ok(client1 instanceof ManualRegistryClient);
    assert.strictEqual(client1, client2); // Should be cached
  });

  await t.test("should return ManualRegistryClient for unknown registries", () => {
    const client = getRegistryClient("CUSTOM_REGISTRY", "Custom Registry Name");

    assert.ok(client instanceof ManualRegistryClient);
    assert.strictEqual(client.registryCode, "CUSTOM_REGISTRY");
    assert.strictEqual(client.registryName, "Custom Registry Name");
  });

  await t.test("should cache clients", () => {
    clearClientCache();
    const client1 = getRegistryClient("JOCKEY_CLUB");
    const client2 = getRegistryClient("JOCKEY_CLUB");

    assert.strictEqual(client1, client2);
  });
});

test("ClientFactory - hasApiSupport", async (t) => {
  await t.test("should return false for all current registries", () => {
    const codes = ["AQHA", "JOCKEY_CLUB", "APHA", "AHA", "USEF"];

    for (const code of codes) {
      assert.strictEqual(hasApiSupport(code), false, `${code} should not have API support`);
    }
  });
});

test("ClientFactory - getRegistryCapabilities", async (t) => {
  await t.test("should return capabilities for known registry", () => {
    const caps = getRegistryCapabilities("AQHA");

    assert.strictEqual(caps.manualOnly, true);
    assert.strictEqual(caps.lookup, false);
    assert.ok(caps.notes?.includes("does not have a public API"));
  });
});

test("ClientFactory - getSupportedRegistryCodes", async (t) => {
  await t.test("should return all supported registry codes", () => {
    const codes = getSupportedRegistryCodes();

    assert.ok(codes.includes("AQHA"));
    assert.ok(codes.includes("JOCKEY_CLUB"));
    assert.ok(codes.includes("APHA"));
    assert.ok(codes.includes("AHA"));
    assert.ok(codes.includes("USEF"));
    assert.ok(codes.includes("FEI"));
    assert.ok(codes.includes("AKC")); // Dog registry
    assert.ok(codes.includes("CFA")); // Cat registry
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pedigree Position Utilities Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Pedigree Utilities - getGenerationFromPosition", async (t) => {
  await t.test("should return 1 for parents", () => {
    assert.strictEqual(getGenerationFromPosition("sire"), 1);
    assert.strictEqual(getGenerationFromPosition("dam"), 1);
  });

  await t.test("should return 2 for grandparents", () => {
    assert.strictEqual(getGenerationFromPosition("sire_sire"), 2);
    assert.strictEqual(getGenerationFromPosition("sire_dam"), 2);
    assert.strictEqual(getGenerationFromPosition("dam_sire"), 2);
    assert.strictEqual(getGenerationFromPosition("dam_dam"), 2);
  });

  await t.test("should return 3 for great-grandparents", () => {
    assert.strictEqual(getGenerationFromPosition("sire_sire_sire"), 3);
    assert.strictEqual(getGenerationFromPosition("dam_dam_dam"), 3);
  });

  await t.test("should return correct generation for deeper positions", () => {
    assert.strictEqual(getGenerationFromPosition("sire_sire_sire_sire"), 4);
    assert.strictEqual(getGenerationFromPosition("dam_dam_dam_dam_dam"), 5);
  });
});

test("Pedigree Utilities - getPositionLabel", async (t) => {
  await t.test("should return correct labels for known positions", () => {
    assert.strictEqual(getPositionLabel("sire"), "Sire");
    assert.strictEqual(getPositionLabel("dam"), "Dam");
    assert.strictEqual(getPositionLabel("sire_sire"), "Paternal Grandsire");
    assert.strictEqual(getPositionLabel("dam_dam"), "Maternal Granddam");
  });

  await t.test("should generate labels for deep positions", () => {
    const label = getPositionLabel("sire_sire_sire_sire");

    assert.ok(label.includes("Gen 4"));
    assert.ok(label.includes("Paternal"));
    assert.ok(label.includes("Sire"));
  });

  await t.test("should distinguish maternal and paternal lines", () => {
    const paternalLabel = getPositionLabel("sire_sire_sire_sire_sire");
    const maternalLabel = getPositionLabel("dam_dam_dam_dam_dam");

    assert.ok(paternalLabel.includes("Paternal"));
    assert.ok(maternalLabel.includes("Maternal"));
  });
});

test("Pedigree Utilities - PEDIGREE_POSITIONS constant", async (t) => {
  await t.test("should have correct structure for generation 1", () => {
    assert.deepStrictEqual(PEDIGREE_POSITIONS.sire, { generation: 1, label: "Sire" });
    assert.deepStrictEqual(PEDIGREE_POSITIONS.dam, { generation: 1, label: "Dam" });
  });

  await t.test("should have correct structure for generation 2", () => {
    assert.strictEqual(PEDIGREE_POSITIONS.sire_sire.generation, 2);
    assert.strictEqual(PEDIGREE_POSITIONS.dam_dam.generation, 2);
  });

  await t.test("should have all 8 positions for generation 3", () => {
    const gen3Positions = [
      "sire_sire_sire",
      "sire_sire_dam",
      "sire_dam_sire",
      "sire_dam_dam",
      "dam_sire_sire",
      "dam_sire_dam",
      "dam_dam_sire",
      "dam_dam_dam",
    ] as const;

    for (const pos of gen3Positions) {
      assert.strictEqual(
        PEDIGREE_POSITIONS[pos].generation,
        3,
        `${pos} should be generation 3`
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createManualClient Helper Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createManualClient helper", async (t) => {
  await t.test("should create ManualRegistryClient with correct properties", () => {
    const client = createManualClient("TEST", "Test Registry");

    assert.ok(client instanceof ManualRegistryClient);
    assert.strictEqual(client.registryCode, "TEST");
    assert.strictEqual(client.registryName, "Test Registry");
  });
});

console.log("✅ All Registry Integration unit tests passed!");
