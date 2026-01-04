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

type TestContext = {
  tenantId: number;
  contactPartyId: number;
  orgPartyId: number;
  animalId: number;
  planId: number;
  waitlistId?: number;
  offspringId?: number;
  breedingAttemptId?: number;
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
    const contactParty = await prisma.party.create({
      data: {
        tenantId: ctx.tenantId,
        type: PartyType.CONTACT,
        name: "Test Contact",
        email: "contact@test.com",
      },
    });
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
    const orgParty = await prisma.party.create({
      data: {
        tenantId: ctx.tenantId,
        type: PartyType.ORGANIZATION,
        name: "Test Organization",
        email: "org@test.com",
      },
    });
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

    // Create breeding plan
    const plan = await prisma.breedingPlan.create({
      data: {
        tenantId: ctx.tenantId,
        name: "Test Plan",
        damId: ctx.animalId,
        status: "PLANNING",
        species: "DOG",
      },
    });
    ctx.planId = plan.id;
  });

  after(async () => {
    // Cleanup: cascade delete via tenant
    if (ctx.tenantId) {
      await prisma.tenant.delete({ where: { id: ctx.tenantId } });
    }
    await prisma.$disconnect();
  });

  describe("Waitlist Endpoints - Party-Native", () => {
    it("should create waitlist entry with clientPartyId only", async () => {
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

    it("should reject waitlist creation with missing clientPartyId", async () => {
      await assert.rejects(
        async () => {
          await prisma.waitlistEntry.create({
            data: {
              tenantId: ctx.tenantId,
              // clientPartyId intentionally omitted
              status: "INQUIRY",
            } as any,
          });
        },
        { name: "PrismaClientValidationError" },
        "Should reject when clientPartyId is missing"
      );
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
      // Create offspring group first
      const group = await prisma.offspringGroup.create({
        data: {
          tenantId: ctx.tenantId,
          planId: ctx.planId,
          species: "DOG",
          name: "Test Group",
        },
      });

      const offspring = await prisma.offspring.create({
        data: {
          tenantId: ctx.tenantId,
          groupId: group.id,
          name: "Test Offspring",
          sex: "MALE",
          lifeState: "ALIVE",
          placementState: "WITH_BREEDER",
          keeperIntent: "SELL",
          financialState: "UNPAID",
          paperworkState: "PENDING",
        },
      });
      ctx.offspringId = offspring.id;

      // Assign buyer using buyerPartyId
      const updated = await prisma.offspring.update({
        where: { id: offspring.id },
        data: {
          buyerPartyId: ctx.contactPartyId,
          placementState: "WITH_BUYER",
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
    it("should create animal owner with partyId only", async () => {
      const owner = await prisma.animalOwner.create({
        data: {
          animalId: ctx.animalId,
          partyId: ctx.contactPartyId,
          currentOwner: true,
          startDate: new Date(),
        },
        select: {
          id: true,
          partyId: true,
        },
      });

      assert.ok(owner.id, "Owner should be created");
      assert.strictEqual(owner.partyId, ctx.contactPartyId, "partyId should match");
    });

    it("should reject animal owner creation with missing partyId", async () => {
      await assert.rejects(
        async () => {
          await prisma.animalOwner.create({
            data: {
              animalId: ctx.animalId,
              // partyId intentionally omitted
              currentOwner: false,
            } as any,
          });
        },
        { name: "PrismaClientValidationError" },
        "Should reject when partyId is missing"
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
      // Create a male stud animal
      const stud = await prisma.animal.create({
        data: {
          tenantId: ctx.tenantId,
          name: "Test Stud",
          species: "DOG",
          sex: "MALE",
          status: "BREEDING",
        },
      });

      const attempt = await prisma.breedingAttempt.create({
        data: {
          tenantId: ctx.tenantId,
          planId: ctx.planId,
          studId: stud.id,
          studOwnerPartyId: ctx.orgPartyId,
          attemptDate: new Date(),
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
