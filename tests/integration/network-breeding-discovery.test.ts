/**
 * Network Breeding Discovery Integration Tests
 *
 * Comprehensive tests for the cross-tenant breeding discovery feature:
 * - Share Code lifecycle (generate, redeem, revoke, expiry, max uses)
 * - Animal Access / Shadow Animals (tiered data filtering, CRUD)
 * - Network Search Index (privacy-preserving aggregated traits)
 * - Breeding Inquiries (send, respond, decline, rate limiting, privacy)
 * - Breeding Data Agreements (create, approve, reject, duplicate prevention)
 * - Animal Access Conversations (per-animal messaging)
 *
 * @see docs/codebase/api/NETWORK-BREEDING-DISCOVERY-API.md
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  TENANT_PREFIXES,
  createTestTenant,
  teardownTestTenant,
  cleanupStaleTenants,
} from "../helpers/tenant-helpers.js";

// Service imports
import {
  generateShareCode,
  redeemShareCode,
  revokeShareCode,
  validateShareCode,
} from "../../src/services/share-codes.js";

import {
  getAccessForTenant,
  getSharedByTenant,
  removeAccess,
  revokeAccessByOwner,
  upgradeAccessTier,
  handleAnimalDeleted,
} from "../../src/services/animal-access.js";

import {
  rebuildTenantIndex,
  searchNetwork,
} from "../../src/services/network-search-index.js";

import {
  sendInquiry,
  getInquiriesReceived,
  getInquiriesSent,
  respondToInquiry,
} from "../../src/services/breeding-inquiries.js";

import {
  createAgreement,
  approveAgreement,
  rejectAgreement,
} from "../../src/services/breeding-data-agreements.js";

import {
  getOrCreateConversation,
  sendMessage,
  getConversation,
} from "../../src/services/animal-access-conversation.js";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Test Context
// ─────────────────────────────────────────────────────────────────────────────

interface TestContext {
  // Owner tenant (breeder who owns animals)
  ownerTenantId: number;
  ownerOrgPartyId: number;

  // Accessor tenant (breeder who discovers/accesses animals)
  accessorTenantId: number;
  accessorOrgPartyId: number;

  // Animals owned by owner tenant
  animalId1: number; // Horse stallion with genetics
  animalId2: number; // Horse mare with genetics
  animalId3: number; // Horse stallion, networkSearchVisible=false

  // Share codes
  shareCodeId: number;
  shareCodeStr: string;
  multiShareCodeId: number;
  multiShareCodeStr: string;

  // Animal access
  accessId1: number; // Access to animalId1

  // Breeding plan (for agreements)
  breedingPlanId: number;

  // Inquiry
  inquiryId: number;
}

const ctx: TestContext = {} as TestContext;

// ─────────────────────────────────────────────────────────────────────────────
// Setup and Teardown
// ─────────────────────────────────────────────────────────────────────────────

describe("Network Breeding Discovery Integration Tests", () => {
  before(async () => {
    // Cleanup stale tenants from previous runs
    await cleanupStaleTenants(
      TENANT_PREFIXES.networkBreedingDiscovery,
      24,
      prisma
    );

    // Create owner tenant (the breeder sharing animals)
    const ownerTenant = await createTestTenant(
      "Owner Ranch Test",
      TENANT_PREFIXES.networkBreedingDiscovery
    );
    ctx.ownerTenantId = ownerTenant.id;

    // Set owner tenant to VISIBLE for network search
    await prisma.tenant.update({
      where: { id: ctx.ownerTenantId },
      data: {
        networkVisibility: "VISIBLE",
        inquiryPermission: "ANYONE",
        city: "Austin",
        region: "Texas",
      },
    });

    // Create organization + party for owner tenant
    const ownerParty = await prisma.party.create({
      data: {
        tenantId: ctx.ownerTenantId,
        type: "ORGANIZATION",
        name: "Owner Ranch Test",
        email: `owner-ranch-${Date.now()}@test.bhq.dev`,
      },
    });
    ctx.ownerOrgPartyId = ownerParty.id;

    await prisma.organization.create({
      data: {
        tenantId: ctx.ownerTenantId,
        partyId: ownerParty.id,
        name: "Owner Ranch Test",
      },
    });

    // Create accessor tenant (the breeder discovering animals)
    const accessorTenant = await createTestTenant(
      "Accessor Farm Test",
      TENANT_PREFIXES.networkBreedingDiscovery
    );
    ctx.accessorTenantId = accessorTenant.id;

    await prisma.tenant.update({
      where: { id: ctx.accessorTenantId },
      data: {
        networkVisibility: "VISIBLE",
        inquiryPermission: "ANYONE",
        city: "Dallas",
        region: "Texas",
      },
    });

    // Create organization + party for accessor tenant
    const accessorParty = await prisma.party.create({
      data: {
        tenantId: ctx.accessorTenantId,
        type: "ORGANIZATION",
        name: "Accessor Farm Test",
        email: `accessor-farm-${Date.now()}@test.bhq.dev`,
      },
    });
    ctx.accessorOrgPartyId = accessorParty.id;

    await prisma.organization.create({
      data: {
        tenantId: ctx.accessorTenantId,
        partyId: accessorParty.id,
        name: "Accessor Farm Test",
      },
    });

    // Create test animals in owner tenant
    const animal1 = await prisma.animal.create({
      data: {
        tenantId: ctx.ownerTenantId,
        name: "Maximum Star",
        species: "HORSE",
        sex: "MALE",
        status: "ACTIVE",
        breed: "Quarter Horse",
        networkSearchVisible: true,
      },
    });
    ctx.animalId1 = animal1.id;

    const animal2 = await prisma.animal.create({
      data: {
        tenantId: ctx.ownerTenantId,
        name: "Diamond Lady",
        species: "HORSE",
        sex: "FEMALE",
        status: "ACTIVE",
        breed: "Quarter Horse",
        networkSearchVisible: true,
      },
    });
    ctx.animalId2 = animal2.id;

    const animal3 = await prisma.animal.create({
      data: {
        tenantId: ctx.ownerTenantId,
        name: "Hidden Gem",
        species: "HORSE",
        sex: "MALE",
        status: "ACTIVE",
        breed: "Quarter Horse",
        networkSearchVisible: false, // Not visible in network search
      },
    });
    ctx.animalId3 = animal3.id;

    // Add genetics loci to animals for search indexing
    // Animal 1: stallion with E locus and HYPP clear
    await prisma.animalLoci.createMany({
      data: [
        {
          animalId: ctx.animalId1,
          category: "coatColor",
          locus: "E",
          locusName: "Extension",
          allele1: "E",
          allele2: "e",
          genotype: "Ee",
        },
        {
          animalId: ctx.animalId1,
          category: "health",
          locus: "HYPP",
          locusName: "Hyperkalemic Periodic Paralysis",
          allele1: "N",
          allele2: "N",
          genotype: "NN",
        },
        {
          animalId: ctx.animalId1,
          category: "coatColor",
          locus: "A",
          locusName: "Agouti",
          allele1: "A",
          allele2: "a",
          genotype: "Aa",
        },
      ],
    });

    // Animal 2: mare with E locus and HYPP carrier
    await prisma.animalLoci.createMany({
      data: [
        {
          animalId: ctx.animalId2,
          category: "coatColor",
          locus: "E",
          locusName: "Extension",
          allele1: "E",
          allele2: "E",
          genotype: "EE",
        },
        {
          animalId: ctx.animalId2,
          category: "health",
          locus: "HYPP",
          locusName: "Hyperkalemic Periodic Paralysis",
          allele1: "N",
          allele2: "H",
          genotype: "NH",
        },
      ],
    });

    // Create a breeding plan in accessor tenant (for agreement tests)
    const plan = await prisma.breedingPlan.create({
      data: {
        tenantId: ctx.accessorTenantId,
        name: "2026 Spring Breeding Plan",
        status: "PLANNING",
        species: "HORSE",
      },
    });
    ctx.breedingPlanId = plan.id;
  });

  after(async () => {
    // Teardown in reverse order
    if (ctx.ownerTenantId) {
      await teardownTestTenant(ctx.ownerTenantId, prisma);
    }
    if (ctx.accessorTenantId) {
      await teardownTestTenant(ctx.accessorTenantId, prisma);
    }
    await prisma.$disconnect();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Suite 1: Share Code Lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Share Code Lifecycle", () => {
    it("should generate a share code for a single animal", async () => {
      const shareCode = await generateShareCode({
        tenantId: ctx.ownerTenantId,
        animalIds: [ctx.animalId1],
        defaultAccessTier: "BASIC",
      });

      assert.ok(shareCode.id, "Share code should have an ID");
      assert.ok(shareCode.code, "Share code should have a code string");
      assert.strictEqual(shareCode.tenantId, ctx.ownerTenantId);
      assert.deepStrictEqual(shareCode.animalIds, [ctx.animalId1]);
      assert.strictEqual(shareCode.defaultAccessTier, "BASIC");
      assert.strictEqual(shareCode.status, "ACTIVE");
      assert.strictEqual(shareCode.useCount, 0);
      assert.strictEqual(shareCode.maxUses, null);
      assert.strictEqual(shareCode.expiresAt, null);

      // Code format: 3-letter prefix + dash + 4 alphanumeric + dash + word
      assert.match(shareCode.code, /^[A-Z]{3}-[A-Z0-9]{4}-[A-Z]+$/);

      ctx.shareCodeId = shareCode.id;
      ctx.shareCodeStr = shareCode.code;
    });

    it("should generate a multi-animal share code", async () => {
      const shareCode = await generateShareCode({
        tenantId: ctx.ownerTenantId,
        animalIds: [ctx.animalId1, ctx.animalId2],
        defaultAccessTier: "GENETICS",
        perAnimalTiers: {
          [String(ctx.animalId2)]: "BASIC",
        },
        maxUses: 3,
      });

      assert.ok(shareCode.id);
      assert.deepStrictEqual(
        shareCode.animalIds.sort(),
        [ctx.animalId1, ctx.animalId2].sort()
      );
      assert.strictEqual(shareCode.defaultAccessTier, "GENETICS");
      assert.strictEqual(shareCode.maxUses, 3);

      const perTiers = shareCode.perAnimalTiers as Record<string, string>;
      assert.strictEqual(perTiers[String(ctx.animalId2)], "BASIC");

      ctx.multiShareCodeId = shareCode.id;
      ctx.multiShareCodeStr = shareCode.code;
    });

    it("should redeem a share code and create AnimalAccess records", async () => {
      const accesses = await redeemShareCode(
        ctx.shareCodeStr,
        ctx.accessorTenantId
      );

      assert.strictEqual(accesses.length, 1, "Should create 1 access record");
      assert.strictEqual(accesses[0].ownerTenantId, ctx.ownerTenantId);
      assert.strictEqual(accesses[0].accessorTenantId, ctx.accessorTenantId);
      assert.strictEqual(accesses[0].animalId, ctx.animalId1);
      assert.strictEqual(accesses[0].accessTier, "BASIC");
      assert.strictEqual(accesses[0].source, "SHARE_CODE");
      assert.strictEqual(accesses[0].status, "ACTIVE");
      assert.strictEqual(accesses[0].shareCodeId, ctx.shareCodeId);

      ctx.accessId1 = accesses[0].id;

      // Verify use count incremented
      const updated = await prisma.shareCode.findUnique({
        where: { id: ctx.shareCodeId },
      });
      assert.strictEqual(updated?.useCount, 1);
    });

    it("should redeem multi-animal share code with per-animal tiers", async () => {
      const accesses = await redeemShareCode(
        ctx.multiShareCodeStr,
        ctx.accessorTenantId
      );

      // animalId1 already has access from previous test, so only animalId2 should be new
      assert.strictEqual(
        accesses.length,
        1,
        "Should create 1 access (animal1 already has access)"
      );
      assert.strictEqual(accesses[0].animalId, ctx.animalId2);
      // animalId2 has perAnimalTier = BASIC, overriding default GENETICS
      assert.strictEqual(accesses[0].accessTier, "BASIC");
    });

    it("should not allow redeeming own share code", async () => {
      await assert.rejects(
        () => redeemShareCode(ctx.shareCodeStr, ctx.ownerTenantId),
        (err: Error & { statusCode?: number }) => {
          assert.strictEqual(err.message, "cannot_redeem_own_code");
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );
    });

    it("should not allow redeeming an expired share code", async () => {
      // Create a code that's already expired
      const expiredCode = await generateShareCode({
        tenantId: ctx.ownerTenantId,
        animalIds: [ctx.animalId1],
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      });

      await assert.rejects(
        () => redeemShareCode(expiredCode.code, ctx.accessorTenantId),
        (err: Error & { statusCode?: number }) => {
          assert.strictEqual(err.message, "code_expired");
          assert.strictEqual(err.statusCode, 410);
          return true;
        }
      );

      // Verify code status was updated to EXPIRED
      const updated = await prisma.shareCode.findUnique({
        where: { id: expiredCode.id },
      });
      assert.strictEqual(updated?.status, "EXPIRED");
    });

    it("should not allow redeeming a revoked share code", async () => {
      // Create a code and immediately revoke it
      const code = await generateShareCode({
        tenantId: ctx.ownerTenantId,
        animalIds: [ctx.animalId1],
      });
      await revokeShareCode(code.id, ctx.ownerTenantId);

      await assert.rejects(
        () => redeemShareCode(code.code, ctx.accessorTenantId),
        (err: Error & { statusCode?: number }) => {
          assert.strictEqual(err.message, "code_revoked");
          assert.strictEqual(err.statusCode, 410);
          return true;
        }
      );
    });

    it("should not exceed max uses", async () => {
      // Create a code with maxUses=1
      const limitedCode = await generateShareCode({
        tenantId: ctx.ownerTenantId,
        animalIds: [ctx.animalId3], // Hidden gem, not yet shared
        maxUses: 1,
      });

      // Create a third tenant to redeem the code
      const thirdTenant = await createTestTenant(
        "Third Tenant Test",
        TENANT_PREFIXES.networkBreedingDiscovery
      );

      try {
        // First redemption should succeed
        await redeemShareCode(limitedCode.code, thirdTenant.id);

        // Second redemption should fail (max uses reached)
        // Need a fourth tenant since accessor already redeemed
        const fourthTenant = await createTestTenant(
          "Fourth Tenant Test",
          TENANT_PREFIXES.networkBreedingDiscovery
        );

        try {
          await assert.rejects(
            () => redeemShareCode(limitedCode.code, fourthTenant.id),
            (err: Error & { statusCode?: number }) => {
              assert.strictEqual(err.message, "code_max_uses_reached");
              assert.strictEqual(err.statusCode, 410);
              return true;
            }
          );
        } finally {
          await teardownTestTenant(fourthTenant.id, prisma);
        }
      } finally {
        await teardownTestTenant(thirdTenant.id, prisma);
      }
    });

    it("should revoke a share code and associated accesses", async () => {
      // Create a fresh code and redeem it
      const code = await generateShareCode({
        tenantId: ctx.ownerTenantId,
        animalIds: [ctx.animalId3],
      });

      const thirdTenant = await createTestTenant(
        "Revoke Test Tenant",
        TENANT_PREFIXES.networkBreedingDiscovery
      );

      try {
        const accesses = await redeemShareCode(code.code, thirdTenant.id);
        assert.strictEqual(accesses.length, 1);
        const accessId = accesses[0].id;

        // Revoke the share code
        await revokeShareCode(code.id, ctx.ownerTenantId);

        // Verify code is revoked
        const updatedCode = await prisma.shareCode.findUnique({
          where: { id: code.id },
        });
        assert.strictEqual(updatedCode?.status, "REVOKED");
        assert.ok(updatedCode?.revokedAt);

        // Verify associated access is revoked
        const updatedAccess = await prisma.animalAccess.findUnique({
          where: { id: accessId },
        });
        assert.strictEqual(updatedAccess?.status, "REVOKED");
      } finally {
        await teardownTestTenant(thirdTenant.id, prisma);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Suite 2: Animal Access (Shadow Animals)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Animal Access (Shadow Animals)", () => {
    it("should list shadow animals for accessor tenant", async () => {
      const result = await getAccessForTenant(ctx.accessorTenantId);

      assert.ok(result.data.length >= 1, "Should have at least 1 shadow animal");
      assert.ok(result.pagination, "Should include pagination metadata");
      assert.ok(result.pagination.total >= 1);

      // Verify the access record for animal1 is present
      const animal1Access = result.data.find(
        (a) => a.animalId === ctx.animalId1
      );
      assert.ok(animal1Access, "Should include access to animal1");
      assert.strictEqual(animal1Access.accessTier, "BASIC");
      assert.strictEqual(animal1Access.status, "ACTIVE");
    });

    it("should filter shadow animal data by BASIC access tier", async () => {
      const result = await getAccessForTenant(ctx.accessorTenantId);
      const basicAccess = result.data.find(
        (a) => a.animalId === ctx.animalId1 && a.accessTier === "BASIC"
      );

      assert.ok(basicAccess, "Should find BASIC access for animal1");
      assert.ok(basicAccess.animal, "Animal data should be present");

      const animalData = basicAccess.animal as Record<string, unknown>;

      // BASIC tier should include name, species, sex, breed
      assert.ok(animalData.name, "BASIC should include name");
      assert.ok(animalData.species, "BASIC should include species");
      assert.ok(animalData.sex, "BASIC should include sex");

      // BASIC tier should NOT include genetics/loci fields
      // (The getAccessForTenant only selects basic fields for the list view)
      assert.strictEqual(
        animalData.genetics,
        undefined,
        "BASIC should not include genetics"
      );
    });

    it("should show owner what they have shared", async () => {
      const result = await getSharedByTenant(ctx.ownerTenantId);

      assert.ok(
        result.data.length >= 1,
        "Owner should see shared access records"
      );
      assert.ok(result.pagination);

      // Check that shared records reference the accessor tenant
      const sharedToAccessor = result.data.filter(
        (a) => a.accessorTenantId === ctx.accessorTenantId
      );
      assert.ok(
        sharedToAccessor.length >= 1,
        "Should show records shared with accessor"
      );
    });

    it("should allow accessor to remove shadow from their list", async () => {
      // Create a fresh access for removal test
      const freshCode = await generateShareCode({
        tenantId: ctx.ownerTenantId,
        animalIds: [ctx.animalId3],
      });

      const thirdTenant = await createTestTenant(
        "Remove Shadow Test",
        TENANT_PREFIXES.networkBreedingDiscovery
      );

      try {
        const accesses = await redeemShareCode(freshCode.code, thirdTenant.id);
        const accessId = accesses[0].id;

        // Accessor removes the shadow
        await removeAccess(accessId, thirdTenant.id);

        // Verify access is revoked
        const updated = await prisma.animalAccess.findUnique({
          where: { id: accessId },
        });
        assert.strictEqual(updated?.status, "REVOKED");
      } finally {
        await teardownTestTenant(thirdTenant.id, prisma);
      }
    });

    it("should allow owner to revoke access", async () => {
      // Create a separate access for this test
      const code = await generateShareCode({
        tenantId: ctx.ownerTenantId,
        animalIds: [ctx.animalId3],
      });

      const thirdTenant = await createTestTenant(
        "Owner Revoke Test",
        TENANT_PREFIXES.networkBreedingDiscovery
      );

      try {
        const accesses = await redeemShareCode(code.code, thirdTenant.id);
        const accessId = accesses[0].id;

        // Owner revokes access
        await revokeAccessByOwner(accessId, ctx.ownerTenantId);

        const updated = await prisma.animalAccess.findUnique({
          where: { id: accessId },
        });
        assert.strictEqual(updated?.status, "REVOKED");
      } finally {
        await teardownTestTenant(thirdTenant.id, prisma);
      }
    });

    it("should allow owner to upgrade access tier", async () => {
      // Upgrade animal1 access from BASIC to GENETICS
      const updated = await upgradeAccessTier(
        ctx.accessId1,
        ctx.ownerTenantId,
        "GENETICS"
      );

      assert.strictEqual(updated.accessTier, "GENETICS");
      assert.strictEqual(updated.id, ctx.accessId1);

      // Verify in database
      const fromDb = await prisma.animalAccess.findUnique({
        where: { id: ctx.accessId1 },
      });
      assert.strictEqual(fromDb?.accessTier, "GENETICS");
    });

    it("should handle animal deletion with OWNER_DELETED status and name snapshot", async () => {
      // Create a temporary animal and share it
      const tempAnimal = await prisma.animal.create({
        data: {
          tenantId: ctx.ownerTenantId,
          name: "Temporary Horse",
          species: "HORSE",
          sex: "MALE",
          status: "ACTIVE",
          networkSearchVisible: true,
        },
      });

      const code = await generateShareCode({
        tenantId: ctx.ownerTenantId,
        animalIds: [tempAnimal.id],
      });

      const thirdTenant = await createTestTenant(
        "Delete Animal Test",
        TENANT_PREFIXES.networkBreedingDiscovery
      );

      try {
        const accesses = await redeemShareCode(code.code, thirdTenant.id);
        const accessId = accesses[0].id;

        // Simulate animal deletion (call the handler before actually deleting)
        await handleAnimalDeleted(tempAnimal.id);

        // Verify access shows OWNER_DELETED with snapshot
        const updated = await prisma.animalAccess.findUnique({
          where: { id: accessId },
        });
        assert.strictEqual(updated?.status, "OWNER_DELETED");
        assert.strictEqual(updated?.animalNameSnapshot, "Temporary Horse");
        assert.strictEqual(updated?.animalSpeciesSnapshot, "HORSE");
        assert.strictEqual(updated?.animalSexSnapshot, "MALE");
        assert.ok(updated?.deletedAt, "deletedAt should be set");

        // Clean up: actually delete the animal
        await prisma.animal.delete({ where: { id: tempAnimal.id } });
      } finally {
        await teardownTestTenant(thirdTenant.id, prisma);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Suite 3: Network Search Index
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Network Search Index", () => {
    it("should rebuild index for a tenant with visible animals", async () => {
      await rebuildTenantIndex(ctx.ownerTenantId);

      // Check that index entries were created
      const entries = await prisma.networkSearchIndex.findMany({
        where: { tenantId: ctx.ownerTenantId },
      });

      assert.ok(entries.length > 0, "Should create index entries");

      // Should have entries for HORSE/MALE and HORSE/FEMALE
      const maleEntry = entries.find(
        (e) => e.species === "HORSE" && e.sex === "MALE"
      );
      const femaleEntry = entries.find(
        (e) => e.species === "HORSE" && e.sex === "FEMALE"
      );

      assert.ok(maleEntry, "Should have index entry for HORSE/MALE");
      assert.ok(femaleEntry, "Should have index entry for HORSE/FEMALE");

      // Male entry: only animal1 is visible (animal3 has networkSearchVisible=false)
      assert.strictEqual(maleEntry.animalCount, 1);

      // Female entry: animal2
      assert.strictEqual(femaleEntry.animalCount, 1);
    });

    it("should contain aggregated traits, NOT animal IDs", async () => {
      const entries = await prisma.networkSearchIndex.findMany({
        where: { tenantId: ctx.ownerTenantId, species: "HORSE", sex: "MALE" },
      });

      assert.strictEqual(entries.length, 1);
      const entry = entries[0];

      // Genetic traits should be aggregated genotypes per locus
      const genetics = entry.geneticTraits as Record<string, string[]>;
      assert.ok(genetics.E, "Should have E locus data");
      assert.ok(genetics.E.includes("Ee"), "E locus should include Ee");
      assert.ok(genetics.A, "Should have A locus data");
      assert.ok(genetics.A.includes("Aa"), "A locus should include Aa");

      // Health clearances should be aggregated
      const health = entry.healthClearances as Record<string, string[]>;
      assert.ok(health.HYPP, "Should have HYPP health data");
      assert.ok(health.HYPP.includes("NN"), "HYPP should include NN");

      // Verify NO animal IDs are stored in the index
      const indexStr = JSON.stringify(entry);
      assert.ok(
        !indexStr.includes(String(ctx.animalId1)),
        "Index must NOT contain animal IDs"
      );
    });

    it("should exclude hidden tenant from index", async () => {
      // Create a hidden tenant with animals
      const hiddenTenant = await createTestTenant(
        "Hidden Breeder Test",
        TENANT_PREFIXES.networkBreedingDiscovery
      );

      try {
        await prisma.tenant.update({
          where: { id: hiddenTenant.id },
          data: { networkVisibility: "HIDDEN" },
        });

        const hiddenAnimal = await prisma.animal.create({
          data: {
            tenantId: hiddenTenant.id,
            name: "Secret Stallion",
            species: "HORSE",
            sex: "MALE",
            status: "ACTIVE",
            networkSearchVisible: true,
          },
        });

        await prisma.animalLoci.create({
          data: {
            animalId: hiddenAnimal.id,
            category: "coatColor",
            locus: "E",
            locusName: "Extension",
            genotype: "EE",
          },
        });

        // Rebuild index - hidden tenant should not be indexed
        await rebuildTenantIndex(hiddenTenant.id);

        const entries = await prisma.networkSearchIndex.findMany({
          where: { tenantId: hiddenTenant.id },
        });

        // The index can be built but search should filter it out
        // Let's verify search excludes HIDDEN tenants
        const results = await searchNetwork({
          species: "HORSE",
          sex: "MALE",
          genetics: [{ locus: "E", acceptableGenotypes: ["EE"] }],
        });

        const hiddenResult = results.results.find(
          (r) => r.tenantId === hiddenTenant.id
        );
        assert.strictEqual(
          hiddenResult,
          undefined,
          "Hidden tenant should not appear in search results"
        );
      } finally {
        await teardownTestTenant(hiddenTenant.id, prisma);
      }
    });

    it("should exclude animal with networkSearchVisible=false from index", async () => {
      // animal3 has networkSearchVisible=false
      // After rebuild, only animal1 should be in the HORSE/MALE index
      await rebuildTenantIndex(ctx.ownerTenantId);

      const maleEntry = await prisma.networkSearchIndex.findFirst({
        where: {
          tenantId: ctx.ownerTenantId,
          species: "HORSE",
          sex: "MALE",
        },
      });

      assert.ok(maleEntry);
      // Only animal1 is visible, animal3 is not
      assert.strictEqual(
        maleEntry.animalCount,
        1,
        "Only networkSearchVisible=true animals should be counted"
      );
    });

    it("should return breeder matches (not animals) in search", async () => {
      // Ensure index is up to date
      await rebuildTenantIndex(ctx.ownerTenantId);

      const results = await searchNetwork({
        species: "HORSE",
        sex: "MALE",
        genetics: [{ locus: "E", acceptableGenotypes: ["Ee", "EE"] }],
      });

      assert.ok(results.results.length >= 1, "Should find at least 1 breeder");
      assert.ok(
        results.totalBreeders >= 1,
        "totalBreeders should be at least 1"
      );

      const ownerResult = results.results.find(
        (r) => r.tenantId === ctx.ownerTenantId
      );
      assert.ok(ownerResult, "Owner tenant should appear in results");

      // Result should show breeder info, not animal IDs
      assert.strictEqual(ownerResult.breederName, "Owner Ranch Test");
      assert.strictEqual(ownerResult.breederLocation, "Austin, Texas");
      assert.ok(ownerResult.matchCount > 0, "matchCount should be positive");
      assert.ok(
        ownerResult.matchedCategories.length > 0,
        "matchedCategories should not be empty"
      );
    });

    it("should show anonymous tenant as 'A breeder'", async () => {
      // Create an anonymous tenant
      const anonTenant = await createTestTenant(
        "Anonymous Breeder Test",
        TENANT_PREFIXES.networkBreedingDiscovery
      );

      try {
        await prisma.tenant.update({
          where: { id: anonTenant.id },
          data: { networkVisibility: "ANONYMOUS", city: "Seattle", region: "WA" },
        });

        const anonAnimal = await prisma.animal.create({
          data: {
            tenantId: anonTenant.id,
            name: "Anon Stallion",
            species: "HORSE",
            sex: "MALE",
            status: "ACTIVE",
            networkSearchVisible: true,
          },
        });

        await prisma.animalLoci.create({
          data: {
            animalId: anonAnimal.id,
            category: "coatColor",
            locus: "CR",
            locusName: "Cream",
            genotype: "CRcr",
          },
        });

        await rebuildTenantIndex(anonTenant.id);

        const results = await searchNetwork({
          species: "HORSE",
          sex: "MALE",
          genetics: [{ locus: "CR", acceptableGenotypes: ["CRcr"] }],
        });

        const anonResult = results.results.find(
          (r) => r.tenantId === anonTenant.id
        );
        assert.ok(anonResult, "Anonymous tenant should appear in results");
        assert.strictEqual(
          anonResult.breederName,
          "A breeder",
          "Anonymous breeder name should be masked"
        );
        assert.strictEqual(
          anonResult.breederLocation,
          null,
          "Anonymous breeder location should be null"
        );
      } finally {
        await teardownTestTenant(anonTenant.id, prisma);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Suite 4: Breeding Inquiries
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Breeding Inquiries", () => {
    it("should send inquiry to matched breeder", async () => {
      const searchCriteria = {
        species: "HORSE" as const,
        sex: "MALE" as const,
        genetics: [{ locus: "E", acceptableGenotypes: ["Ee", "EE"] }],
      };

      const result = await sendInquiry({
        senderTenantId: ctx.accessorTenantId,
        recipientTenantId: ctx.ownerTenantId,
        searchCriteria,
        message: "I'm interested in your stallion for breeding.",
      });

      assert.ok(result.inquiry.id, "Inquiry should be created");
      assert.strictEqual(result.inquiry.senderTenantId, ctx.accessorTenantId);
      assert.strictEqual(result.inquiry.recipientTenantId, ctx.ownerTenantId);
      assert.strictEqual(result.inquiry.status, "PENDING");
      assert.ok(
        result.inquiry.matchingAnimalIds.length > 0,
        "Should find matching animals"
      );
      assert.ok(result.messageThread.id, "Should create message thread");

      ctx.inquiryId = result.inquiry.id;

      // Verify notification was created for recipient
      const notification = await prisma.notification.findFirst({
        where: {
          tenantId: ctx.ownerTenantId,
          type: "network_breeding_inquiry",
          idempotencyKey: `network_inquiry:${result.inquiry.id}`,
        },
      });
      assert.ok(notification, "Should create notification for recipient");
    });

    it("should enforce rate limiting (20 inquiries/day)", async () => {
      // Create a temporary tenant to test rate limiting
      const rateLimitTenant = await createTestTenant(
        "Rate Limit Test",
        TENANT_PREFIXES.networkBreedingDiscovery
      );

      // Create org + party for the rate limit tenant
      const rlParty = await prisma.party.create({
        data: {
          tenantId: rateLimitTenant.id,
          type: "ORGANIZATION",
          name: "Rate Limit Test Org",
          email: `ratelimit-${Date.now()}@test.bhq.dev`,
        },
      });
      await prisma.organization.create({
        data: {
          tenantId: rateLimitTenant.id,
          partyId: rlParty.id,
          name: "Rate Limit Test Org",
        },
      });

      try {
        // Create 20 inquiry records directly to simulate hitting the limit
        const now = new Date();
        for (let i = 0; i < 20; i++) {
          await prisma.networkBreedingInquiry.create({
            data: {
              senderTenantId: rateLimitTenant.id,
              recipientTenantId: ctx.ownerTenantId,
              searchCriteria: { species: "HORSE", sex: "MALE" },
              matchingAnimalIds: [],
              matchedTraits: [],
              createdAt: now,
            },
          });
        }

        // 21st inquiry should be rejected
        await assert.rejects(
          () =>
            sendInquiry({
              senderTenantId: rateLimitTenant.id,
              recipientTenantId: ctx.ownerTenantId,
              searchCriteria: { species: "HORSE", sex: "MALE" },
            }),
          (err: Error & { statusCode?: number }) => {
            assert.strictEqual(err.message, "rate_limit_exceeded");
            assert.strictEqual(err.statusCode, 429);
            return true;
          }
        );
      } finally {
        // Clean up the inquiry records
        await prisma.networkBreedingInquiry.deleteMany({
          where: { senderTenantId: rateLimitTenant.id },
        });
        await teardownTestTenant(rateLimitTenant.id, prisma);
      }
    });

    it("should show matching animals to recipient (privacy check)", async () => {
      const received = await getInquiriesReceived(ctx.ownerTenantId);

      assert.ok(received.data.length >= 1, "Recipient should see inquiries");

      const inquiry = received.data.find((i) => i.id === ctx.inquiryId);
      assert.ok(inquiry, "Should find the test inquiry");
      assert.ok(
        inquiry.matchingAnimals.length > 0,
        "Recipient should see matching animals"
      );
      assert.ok(
        inquiry.matchingAnimals[0].id,
        "Matching animals should include IDs"
      );
      assert.ok(
        inquiry.matchingAnimals[0].name,
        "Matching animals should include names"
      );
    });

    it("should NOT show matching animal IDs to sender", async () => {
      const sent = await getInquiriesSent(ctx.accessorTenantId);

      assert.ok(sent.data.length >= 1, "Sender should see sent inquiries");

      const inquiry = sent.data.find((i) => i.id === ctx.inquiryId);
      assert.ok(inquiry, "Should find the test inquiry");

      // Sender view should NOT have matchingAnimals property
      assert.strictEqual(
        (inquiry as any).matchingAnimals,
        undefined,
        "Sender should NOT see matchingAnimals"
      );
    });

    it("should respond to inquiry", async () => {
      const updated = await respondToInquiry(
        ctx.inquiryId,
        ctx.ownerTenantId,
        "respond"
      );

      assert.strictEqual(updated.status, "RESPONDED");
      assert.ok(updated.respondedAt, "respondedAt should be set");

      // Verify notification sent to sender
      const notification = await prisma.notification.findFirst({
        where: {
          tenantId: ctx.accessorTenantId,
          type: "network_inquiry_response",
          idempotencyKey: `network_inquiry_response:${ctx.inquiryId}:respond`,
        },
      });
      assert.ok(notification, "Should notify sender of response");
    });

    it("should decline an inquiry", async () => {
      // Create a new inquiry to decline
      const searchCriteria = {
        species: "HORSE" as const,
        sex: "FEMALE" as const,
        genetics: [{ locus: "E", acceptableGenotypes: ["EE"] }],
      };

      const result = await sendInquiry({
        senderTenantId: ctx.accessorTenantId,
        recipientTenantId: ctx.ownerTenantId,
        searchCriteria,
        message: "Looking for mares.",
      });

      const declined = await respondToInquiry(
        result.inquiry.id,
        ctx.ownerTenantId,
        "decline"
      );

      assert.strictEqual(declined.status, "DECLINED");
      assert.ok(declined.respondedAt, "respondedAt should be set");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Suite 5: Breeding Data Agreements
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Breeding Data Agreements", () => {
    it("should create agreement when adding shadow to plan", async () => {
      const agreement = await createAgreement({
        breedingPlanId: ctx.breedingPlanId,
        animalAccessId: ctx.accessId1,
        requestingTenantId: ctx.accessorTenantId,
        animalRole: "sire",
        message: "We would like to use your stallion in our breeding plan.",
      });

      assert.ok(agreement.id, "Agreement should have an ID");
      assert.strictEqual(agreement.breedingPlanId, ctx.breedingPlanId);
      assert.strictEqual(agreement.animalAccessId, ctx.accessId1);
      assert.strictEqual(agreement.requestingTenantId, ctx.accessorTenantId);
      assert.strictEqual(agreement.approvingTenantId, ctx.ownerTenantId);
      assert.strictEqual(agreement.animalRole, "sire");
      assert.strictEqual(agreement.status, "PENDING");
      assert.strictEqual(
        agreement.requestMessage,
        "We would like to use your stallion in our breeding plan."
      );

      // Verify notification sent to owner
      const notification = await prisma.notification.findFirst({
        where: {
          tenantId: ctx.ownerTenantId,
          type: "breeding_data_agreement_request",
          idempotencyKey: `breeding_agreement_request:${agreement.id}`,
        },
      });
      assert.ok(
        notification,
        "Should notify animal owner of agreement request"
      );
    });

    it("should approve agreement and make access permanent", async () => {
      // Find the pending agreement
      const pending = await prisma.breedingDataAgreement.findFirst({
        where: {
          breedingPlanId: ctx.breedingPlanId,
          animalAccessId: ctx.accessId1,
          status: "PENDING",
        },
      });
      assert.ok(pending, "Should have a pending agreement");

      const approved = await approveAgreement(
        pending.id,
        ctx.ownerTenantId,
        "Approved! Good luck with the breeding program."
      );

      assert.strictEqual(approved.status, "APPROVED");
      assert.ok(approved.approvedAt, "approvedAt should be set");
      assert.strictEqual(
        approved.responseMessage,
        "Approved! Good luck with the breeding program."
      );

      // Verify AnimalAccess was updated: permanent + source changed
      const access = await prisma.animalAccess.findUnique({
        where: { id: ctx.accessId1 },
      });
      assert.strictEqual(
        access?.expiresAt,
        null,
        "Access should be permanent (null expiresAt)"
      );
      assert.strictEqual(
        access?.source,
        "BREEDING_AGREEMENT",
        "Source should be updated to BREEDING_AGREEMENT"
      );

      // Verify notification sent to requester
      const notification = await prisma.notification.findFirst({
        where: {
          tenantId: ctx.accessorTenantId,
          type: "breeding_data_agreement_approved",
        },
      });
      assert.ok(notification, "Should notify requester of approval");
    });

    it("should reject an agreement", async () => {
      // Create a second access and agreement to reject
      const access2 = await prisma.animalAccess.findFirst({
        where: {
          animalId: ctx.animalId2,
          accessorTenantId: ctx.accessorTenantId,
          status: "ACTIVE",
        },
      });
      assert.ok(access2, "Should have access to animal2");

      const agreement = await createAgreement({
        breedingPlanId: ctx.breedingPlanId,
        animalAccessId: access2.id,
        requestingTenantId: ctx.accessorTenantId,
        animalRole: "dam",
      });

      const rejected = await rejectAgreement(
        agreement.id,
        ctx.ownerTenantId,
        "Not available this season."
      );

      assert.strictEqual(rejected.status, "REJECTED");
      assert.ok(rejected.rejectedAt, "rejectedAt should be set");
      assert.strictEqual(
        rejected.responseMessage,
        "Not available this season."
      );
    });

    it("should not allow duplicate agreement for same plan + access", async () => {
      // The agreement for plan + accessId1 was approved in a previous test.
      // Trying to create another should fail with 409.
      await assert.rejects(
        () =>
          createAgreement({
            breedingPlanId: ctx.breedingPlanId,
            animalAccessId: ctx.accessId1,
            requestingTenantId: ctx.accessorTenantId,
            animalRole: "sire",
          }),
        (err: Error & { statusCode?: number }) => {
          assert.strictEqual(err.statusCode, 409);
          return true;
        }
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Suite 6: Animal Access Conversations (Per-Animal Messaging)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Animal Access Conversations", () => {
    it("should create conversation for animal access", async () => {
      const result = await getOrCreateConversation(
        ctx.accessId1,
        ctx.accessorTenantId
      );

      assert.ok(result.conversationId, "Should create conversation");
      assert.ok(result.messageThreadId, "Should create message thread");
      assert.strictEqual(result.isNew, true, "Should indicate new conversation");

      // Call again - should return existing
      const result2 = await getOrCreateConversation(
        ctx.accessId1,
        ctx.accessorTenantId
      );
      assert.strictEqual(
        result2.conversationId,
        result.conversationId,
        "Should return existing conversation"
      );
      assert.strictEqual(
        result2.isNew,
        false,
        "Should indicate existing conversation"
      );
    });

    it("should send message in conversation", async () => {
      const result = await sendMessage(
        ctx.accessId1,
        ctx.accessorTenantId,
        "Hello, I have a question about Maximum Star's genetics."
      );

      assert.ok(result.messageId, "Should create message");
      assert.ok(result.conversationId, "Should return conversation ID");
      assert.ok(result.messageThreadId, "Should return thread ID");

      // Owner also sends a reply
      const reply = await sendMessage(
        ctx.accessId1,
        ctx.ownerTenantId,
        "Sure! What would you like to know?"
      );

      assert.ok(reply.messageId, "Owner reply should be created");
      assert.notStrictEqual(
        reply.messageId,
        result.messageId,
        "Messages should have different IDs"
      );
    });

    it("should get conversation with messages", async () => {
      // Get conversation from accessor's perspective
      const conversation = await getConversation(
        ctx.accessId1,
        ctx.accessorTenantId
      );

      assert.ok(conversation, "Conversation should exist");
      assert.ok(conversation.conversationId);
      assert.ok(conversation.messageThreadId);
      assert.strictEqual(conversation.animalName, "Maximum Star");
      assert.ok(conversation.otherParty, "Should have otherParty info");
      assert.ok(conversation.messages.length >= 2, "Should have at least 2 messages");

      // Verify message content
      const firstMessage = conversation.messages[0];
      assert.ok(
        firstMessage.body.includes("question about Maximum Star"),
        "First message should contain the question"
      );
      assert.strictEqual(
        firstMessage.isMe,
        true,
        "First message should be from accessor"
      );

      const secondMessage = conversation.messages[1];
      assert.ok(
        secondMessage.body.includes("What would you like to know"),
        "Second message should contain the reply"
      );
      assert.strictEqual(
        secondMessage.isMe,
        false,
        "Second message should be from owner"
      );

      // Verify from owner's perspective
      const ownerView = await getConversation(
        ctx.accessId1,
        ctx.ownerTenantId
      );

      assert.ok(ownerView, "Owner should also see conversation");
      assert.ok(ownerView.messages.length >= 2);

      // Owner's first message should show isMe=false (it was sent by accessor)
      const ownerFirstMsg = ownerView.messages[0];
      assert.strictEqual(
        ownerFirstMsg.isMe,
        false,
        "Accessor's message should show isMe=false for owner"
      );
    });
  });
});
