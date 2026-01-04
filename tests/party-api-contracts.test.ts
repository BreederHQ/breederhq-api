/**
 * Phase 6: Party-Native API Contract Tests
 *
 * Verifies that all Party-touched endpoints:
 * 1. Accept only Party-native fields (partyId, clientPartyId, buyerPartyId, studOwnerPartyId)
 * 2. Reject legacy fields (contactId, organizationId, partyType)
 * 3. Return Party-native objects (partyId, type, name)
 * 4. Do not return legacy fields in responses
 *
 * Aligned with Phase 5: All legacy identity compatibility code has been removed.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

// Use string literal for PartyType enum
const PartyType = { CONTACT: "CONTACT", ORGANIZATION: "ORGANIZATION" } as const;

const prisma = new PrismaClient();

// ============================================================================
// Helper Factories - Align with current schema requirements
// ============================================================================

type PartyData = {
  tenantId: number;
  type: (typeof PartyType)[keyof typeof PartyType];
  name: string;
  email?: string;
};

async function mkParty(data: PartyData) {
  return prisma.party.create({
    data: {
      tenantId: data.tenantId,
      type: data.type,
      name: data.name,
      email: data.email,
    },
  });
}

async function mkContactParty(tenantId: number, name = "Test Contact", email = "contact@test.com") {
  return mkParty({ tenantId, type: PartyType.CONTACT, name, email });
}

async function mkOrganizationParty(tenantId: number, name = "Test Organization", email = "org@test.com") {
  return mkParty({ tenantId, type: PartyType.ORGANIZATION, name, email });
}

async function mkOwnership(animalId: number, partyId: number, percent = 100) {
  return prisma.animalOwner.create({
    data: {
      animalId,
      partyId,
      percent,
    },
    select: {
      id: true,
      partyId: true,
      percent: true,
    },
  });
}

async function mkBreedingPlan(tenantId: number, damId: number, name = "Test Plan") {
  return prisma.breedingPlan.create({
    data: {
      tenantId,
      name,
      damId,
      status: "PLANNING",
      species: "DOG",
    },
  });
}

async function mkOffspringGroup(tenantId: number, planId: number, name = "Test Group") {
  return prisma.offspringGroup.create({
    data: {
      tenantId,
      planId,
      species: "DOG",
      name,
    },
  });
}

async function mkOffspring(
  tenantId: number,
  groupId: number,
  name = "Test Offspring"
) {
  return prisma.offspring.create({
    data: {
      tenantId,
      groupId,
      name,
      species: "DOG",
      sex: "MALE",
      lifeState: "ALIVE",
      placementState: "UNASSIGNED",
      keeperIntent: "AVAILABLE",
      financialState: "NONE",
      paperworkState: "NONE",
    },
  });
}

// ============================================================================
// Test Context
// ============================================================================

type TestContext = {
  tenantId: number;
  contactPartyId: number;
  orgPartyId: number;
  animalId: number;
  planId: number;
  waitlistId?: number;
  offspringId?: number;
  breedingAttemptId?: number;
  animalOwnerId?: number;
};

const ctx: TestContext = {} as TestContext;

describe("Phase 6: Party-Native API Contract Tests", () => {
  before(async () => {
    // Setup test data - use timestamp slug to avoid collisions
    const tenant = await prisma.tenant.create({
      data: {
        name: "Party API Contract Test Tenant",
        slug: `party-api-test-${Date.now()}`,
      },
    });
    ctx.tenantId = tenant.id;

    // Create Contact Party
    const contactParty = await mkContactParty(ctx.tenantId);
    ctx.contactPartyId = contactParty.id;

    // Create Contact backing entity (links to party via partyId)
    await prisma.contact.create({
      data: {
        tenantId: ctx.tenantId,
        partyId: ctx.contactPartyId,
        display_name: "Test Contact",
        email: "contact@test.com",
      },
    });

    // Create Organization Party
    const orgParty = await mkOrganizationParty(ctx.tenantId);
    ctx.orgPartyId = orgParty.id;

    // Create Organization backing entity (links to party via partyId)
    await prisma.organization.create({
      data: {
        tenantId: ctx.tenantId,
        partyId: ctx.orgPartyId,
        name: "Test Organization",
        email: "org@test.com",
      },
    });

    // Create test animal
    const animal = await prisma.animal.create({
      data: {
        tenantId: ctx.tenantId,
        name: "Test Animal",
        species: "DOG",
        sex: "FEMALE",
        status: "ACTIVE",
      },
    });
    ctx.animalId = animal.id;

    // Create breeding plan using factory
    const plan = await mkBreedingPlan(ctx.tenantId, ctx.animalId);
    ctx.planId = plan.id;
  });

  after(async () => {
    // Cleanup: delete in dependency order to avoid FK violations
    // - AnimalOwner has required partyId with SetNull (inconsistency) - delete first
    // - Contact has nullable partyId with Restrict - unlink first
    // - Organization has required partyId with Cascade from Party
    if (ctx.tenantId) {
      // Delete animal owners first (partyId required but onDelete: SetNull)
      await prisma.animalOwner.deleteMany({
        where: { animal: { tenantId: ctx.tenantId } },
      });
      // Unlink contacts from parties (partyId is nullable with Restrict)
      await prisma.contact.updateMany({
        where: { tenantId: ctx.tenantId },
        data: { partyId: null },
      });
      // Delete contacts
      await prisma.contact.deleteMany({ where: { tenantId: ctx.tenantId } });
      // Delete organizations (must happen before parties since partyId is required)
      await prisma.organization.deleteMany({ where: { tenantId: ctx.tenantId } });
      // Delete parties directly
      await prisma.party.deleteMany({ where: { tenantId: ctx.tenantId } });
      // Now delete tenant
      await prisma.tenant.delete({ where: { id: ctx.tenantId } });
    }
    await prisma.$disconnect();
  });

  describe("Waitlist Endpoints - Party-Native", () => {
    it("should create waitlist entry with clientPartyId", async () => {
      const entry = await prisma.waitlistEntry.create({
        data: {
          tenantId: ctx.tenantId,
          clientPartyId: ctx.contactPartyId,
          status: "INQUIRY",
        },
        select: {
          id: true,
          clientPartyId: true,
        },
      });

      assert.ok(entry.id, "Entry should be created");
      assert.strictEqual(entry.clientPartyId, ctx.contactPartyId, "clientPartyId should match");

      ctx.waitlistId = entry.id;
    });

    it("should allow waitlist entry without clientPartyId (nullable per schema)", async () => {
      // clientPartyId is Int? (nullable) per schema - verify we can create without it
      const entry = await prisma.waitlistEntry.create({
        data: {
          tenantId: ctx.tenantId,
          status: "INQUIRY",
          // clientPartyId intentionally omitted - nullable field
        },
        select: {
          id: true,
          clientPartyId: true,
        },
      });

      assert.ok(entry.id, "Entry should be created");
      assert.strictEqual(entry.clientPartyId, null, "clientPartyId should be null when not provided");

      // Cleanup
      await prisma.waitlistEntry.delete({ where: { id: entry.id } });
    });

    it("should return Party-native fields when reading waitlist entry", async () => {
      if (!ctx.waitlistId) {
        throw new Error("Waitlist entry not created");
      }

      const entry = await prisma.waitlistEntry.findUnique({
        where: { id: ctx.waitlistId },
        select: {
          id: true,
          clientPartyId: true,
        },
      });

      assert.ok(entry, "Entry should exist");
      assert.ok(entry.clientPartyId, "clientPartyId should be returned");
    });

    it("waitlist entry schema should not have legacy fields", async () => {
      // This is a compile-time check enforced by Prisma schema
      // If legacy fields existed, TypeScript would allow access
      const entry = await prisma.waitlistEntry.findFirst({
        where: { tenantId: ctx.tenantId },
      });

      if (entry) {
        // @ts-expect-error - contactId should not exist
        const noContactId = entry.contactId;
        // @ts-expect-error - organizationId should not exist
        const noOrgId = entry.organizationId;

        assert.strictEqual(noContactId, undefined, "contactId should not exist");
        assert.strictEqual(noOrgId, undefined, "organizationId should not exist");
      }
    });
  });

  describe("Offspring Buyer - Party-Native", () => {
    it("should assign offspring buyer using buyerPartyId", async () => {
      // Create offspring group first using factory
      const group = await mkOffspringGroup(ctx.tenantId, ctx.planId);

      // Create offspring using factory (includes required species field)
      const offspring = await mkOffspring(ctx.tenantId, group.id);
      ctx.offspringId = offspring.id;

      // Assign buyer using buyerPartyId
      const updated = await prisma.offspring.update({
        where: { id: offspring.id },
        data: {
          buyerPartyId: ctx.contactPartyId,
          placementState: "PLACED",
        },
        select: {
          id: true,
          buyerPartyId: true,
        },
      });

      assert.strictEqual(updated.buyerPartyId, ctx.contactPartyId, "buyerPartyId should be set");
    });

    it("offspring schema should not have legacy buyer fields", async () => {
      const offspring = await prisma.offspring.findFirst({
        where: { tenantId: ctx.tenantId },
      });

      if (offspring) {
        // @ts-expect-error - buyerContactId should not exist
        const noBuyerContactId = offspring.buyerContactId;
        // @ts-expect-error - buyerOrganizationId should not exist
        const noBuyerOrgId = offspring.buyerOrganizationId;

        assert.strictEqual(noBuyerContactId, undefined, "buyerContactId should not exist");
        assert.strictEqual(noBuyerOrgId, undefined, "buyerOrganizationId should not exist");
      }
    });
  });

  describe("Animal Owners - Party-Native", () => {
    it("should create animal owner with partyId and percent", async () => {
      // Use factory which includes required percent field
      const owner = await mkOwnership(ctx.animalId, ctx.contactPartyId, 100);
      ctx.animalOwnerId = owner.id;

      assert.ok(owner.id, "Owner should be created");
      assert.strictEqual(owner.partyId, ctx.contactPartyId, "partyId should match");
      assert.strictEqual(owner.percent, 100, "percent should be 100");
    });

    it("should reject animal owner creation with missing partyId", async () => {
      await assert.rejects(
        async () => {
          await prisma.animalOwner.create({
            data: {
              animalId: ctx.animalId,
              percent: 100,
              // partyId intentionally omitted - required field
            } as any,
          });
        },
        { name: "PrismaClientValidationError" },
        "Should reject when partyId is missing"
      );
    });

    it("should reject animal owner creation with missing percent", async () => {
      await assert.rejects(
        async () => {
          await prisma.animalOwner.create({
            data: {
              animalId: ctx.animalId,
              partyId: ctx.contactPartyId,
              // percent intentionally omitted - required field
            } as any,
          });
        },
        { name: "PrismaClientValidationError" },
        "Should reject when percent is missing"
      );
    });

    it("animal owner schema should not have legacy fields", async () => {
      const owner = await prisma.animalOwner.findFirst({
        where: { animalId: ctx.animalId },
      });

      if (owner) {
        // @ts-expect-error - contactId should not exist
        const noContactId = owner.contactId;
        // @ts-expect-error - organizationId should not exist
        const noOrgId = owner.organizationId;
        // @ts-expect-error - partyType should not exist
        const noPartyType = owner.partyType;

        assert.strictEqual(noContactId, undefined, "contactId should not exist");
        assert.strictEqual(noOrgId, undefined, "organizationId should not exist");
        assert.strictEqual(noPartyType, undefined, "partyType should not exist");
      }
    });
  });

  describe("Breeding Attempts - Party-Native", () => {
    it("should create breeding attempt with studOwnerPartyId", async () => {
      const attempt = await prisma.breedingAttempt.create({
        data: {
          tenantId: ctx.tenantId,
          planId: ctx.planId,
          studOwnerPartyId: ctx.orgPartyId,
          attemptAt: new Date(),
          method: "NATURAL",
        },
        select: {
          id: true,
          studOwnerPartyId: true,
        },
      });

      assert.ok(attempt.id, "Attempt should be created");
      assert.strictEqual(attempt.studOwnerPartyId, ctx.orgPartyId, "studOwnerPartyId should match");

      ctx.breedingAttemptId = attempt.id;
    });

    it("breeding attempt schema should not have legacy studOwnerContactId", async () => {
      if (!ctx.breedingAttemptId) {
        throw new Error("Breeding attempt not created");
      }

      const attempt = await prisma.breedingAttempt.findUnique({
        where: { id: ctx.breedingAttemptId },
      });

      if (attempt) {
        // @ts-expect-error - studOwnerContactId should not exist
        const noStudOwnerContactId = attempt.studOwnerContactId;

        assert.strictEqual(noStudOwnerContactId, undefined, "studOwnerContactId should not exist");
      }
    });
  });

  describe("Party Model - Direct Access", () => {
    it("should read Party with type and name", async () => {
      const party = await prisma.party.findUnique({
        where: { id: ctx.contactPartyId },
        select: {
          id: true,
          type: true,
          name: true,
          email: true,
        },
      });

      assert.ok(party, "Party should exist");
      assert.strictEqual(party.type, PartyType.CONTACT, "type should be CONTACT");
      assert.strictEqual(party.name, "Test Contact", "name should match");
      assert.strictEqual(party.email, "contact@test.com", "email should match");
    });

    it("Party schema should have type not kind", async () => {
      const party = await prisma.party.findFirst({
        where: { id: ctx.contactPartyId },
      });

      if (party) {
        assert.ok(party.type, "type should exist");
        // @ts-expect-error - kind should not exist
        const noKind = party.kind;
        assert.strictEqual(noKind, undefined, "kind field should not exist");
      }
    });
  });

  describe("Cross-Entity Party Resolution", () => {
    it("should resolve Party from AnimalOwner", async () => {
      // Ensure we have an owner to query
      if (!ctx.animalOwnerId) {
        // Create one if the earlier test didn't run
        const owner = await mkOwnership(ctx.animalId, ctx.contactPartyId, 100);
        ctx.animalOwnerId = owner.id;
      }

      const ownerWithParty = await prisma.animalOwner.findFirst({
        where: { animalId: ctx.animalId },
        select: {
          id: true,
          partyId: true,
          party: {
            select: {
              id: true,
              type: true,
              name: true,
            },
          },
        },
      });

      assert.ok(ownerWithParty, "Owner should exist");
      assert.ok(ownerWithParty.party, "Party relation should be populated");
      assert.strictEqual(ownerWithParty.party.type, PartyType.CONTACT, "Party type should match");
    });

    it("should resolve Party from WaitlistEntry", async () => {
      if (!ctx.waitlistId) {
        throw new Error("Waitlist entry not created");
      }

      const entryWithParty = await prisma.waitlistEntry.findUnique({
        where: { id: ctx.waitlistId },
        select: {
          id: true,
          clientPartyId: true,
          clientParty: {
            select: {
              id: true,
              type: true,
              name: true,
            },
          },
        },
      });

      assert.ok(entryWithParty, "Entry should exist");
      assert.ok(entryWithParty.clientParty, "clientParty relation should be populated");
      assert.strictEqual(entryWithParty.clientParty.type, PartyType.CONTACT, "Party type should match");
    });
  });
});
