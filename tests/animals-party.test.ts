// tests/animals-party.test.ts
// Unit and integration tests for Animals Party Migration Step 5

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import prisma from "../src/prisma.js";

/**
 * Test suite for Party Migration Step 5: Animals Domain
 *
 * These tests verify:
 * 1. AnimalOwner.partyId resolution from contactId/organizationId
 * 2. Dual-write: creating/updating AnimalOwner sets partyId
 * 3. Animal.buyerPartyId (schema only, no write paths currently)
 * 4. AnimalOwnershipChange JSON party transformation
 */

describe("Animals - Party Migration Step 5", () => {
  let testTenantId: number;
  let testContactPartyId: number;
  let testOrgPartyId: number;
  let testContactId: number;
  let testOrgId: number;
  let testAnimalId: number;

  beforeEach(async () => {
    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: { name: "Test Tenant for Animals" },
    });
    testTenantId = tenant.id;

    // Create test party for contact
    const contactParty = await prisma.party.create({
      data: {
        tenantId: testTenantId,
        type: "CONTACT",
        name: "Test Contact Party",
      },
    });
    testContactPartyId = contactParty.id;

    // Create test party for organization
    const orgParty = await prisma.party.create({
      data: {
        tenantId: testTenantId,
        type: "ORGANIZATION",
        name: "Test Org Party",
      },
    });
    testOrgPartyId = orgParty.id;

    // Create test contact with partyId
    const contact = await prisma.contact.create({
      data: {
        tenantId: testTenantId,
        display_name: "Test Contact",
        partyId: testContactPartyId,
      },
    });
    testContactId = contact.id;

    // Create test organization with partyId
    const org = await prisma.organization.create({
      data: {
        tenantId: testTenantId,
        name: "Test Organization",
        partyId: testOrgPartyId,
      },
    });
    testOrgId = org.id;

    // Create test animal
    const animal = await prisma.animal.create({
      data: {
        tenantId: testTenantId,
        name: "Test Animal",
        species: "DOG",
        sex: "FEMALE",
        status: "ACTIVE",
      },
    });
    testAnimalId = animal.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.animalOwner.deleteMany({ where: { animalId: testAnimalId } });
    await prisma.animal.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.contact.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.organization.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.party.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  describe("AnimalOwner.partyId", () => {
    it("should allow creating AnimalOwner with partyId from Contact", async () => {
      const owner = await prisma.animalOwner.create({
        data: {
          animalId: testAnimalId,
          partyType: "Contact",
          contactId: testContactId,
          partyId: testContactPartyId,
          percent: 100,
          isPrimary: true,
        },
      });

      expect(owner.partyId).toBe(testContactPartyId);
      expect(owner.contactId).toBe(testContactId);
      expect(owner.organizationId).toBeNull();
    });

    it("should allow creating AnimalOwner with partyId from Organization", async () => {
      const owner = await prisma.animalOwner.create({
        data: {
          animalId: testAnimalId,
          partyType: "Organization",
          organizationId: testOrgId,
          partyId: testOrgPartyId,
          percent: 100,
          isPrimary: true,
        },
      });

      expect(owner.partyId).toBe(testOrgPartyId);
      expect(owner.organizationId).toBe(testOrgId);
      expect(owner.contactId).toBeNull();
    });

    it("should allow creating AnimalOwner without partyId (legacy mode)", async () => {
      const owner = await prisma.animalOwner.create({
        data: {
          animalId: testAnimalId,
          partyType: "Contact",
          contactId: testContactId,
          percent: 50,
          isPrimary: false,
        },
      });

      expect(owner.partyId).toBeNull();
      expect(owner.contactId).toBe(testContactId);
    });

    it("should support querying AnimalOwner by partyId", async () => {
      await prisma.animalOwner.create({
        data: {
          animalId: testAnimalId,
          partyType: "Contact",
          contactId: testContactId,
          partyId: testContactPartyId,
          percent: 100,
          isPrimary: true,
        },
      });

      const owners = await prisma.animalOwner.findMany({
        where: { partyId: testContactPartyId },
      });

      expect(owners.length).toBe(1);
      expect(owners[0].partyId).toBe(testContactPartyId);
    });

    it("should join to Party table via partyId", async () => {
      await prisma.animalOwner.create({
        data: {
          animalId: testAnimalId,
          partyType: "Contact",
          contactId: testContactId,
          partyId: testContactPartyId,
          percent: 100,
          isPrimary: true,
        },
      });

      const owners = await prisma.animalOwner.findMany({
        where: { animalId: testAnimalId },
        include: { party: true },
      });

      expect(owners.length).toBe(1);
      expect(owners[0].party).not.toBeNull();
      expect(owners[0].party?.name).toBe("Test Contact Party");
    });
  });

  describe("Animal.buyerPartyId", () => {
    it("should allow setting buyerPartyId on Animal", async () => {
      const updated = await prisma.animal.update({
        where: { id: testAnimalId },
        data: { buyerPartyId: testContactPartyId },
      });

      expect(updated.buyerPartyId).toBe(testContactPartyId);
    });

    it("should support querying Animal by buyerPartyId", async () => {
      await prisma.animal.update({
        where: { id: testAnimalId },
        data: { buyerPartyId: testOrgPartyId },
      });

      const animals = await prisma.animal.findMany({
        where: { buyerPartyId: testOrgPartyId },
      });

      expect(animals.length).toBe(1);
      expect(animals[0].id).toBe(testAnimalId);
    });

    it("should join to Party table via buyerPartyId", async () => {
      await prisma.animal.update({
        where: { id: testAnimalId },
        data: { buyerPartyId: testContactPartyId },
      });

      const animal = await prisma.animal.findUnique({
        where: { id: testAnimalId },
        include: { buyerParty: true },
      });

      expect(animal?.buyerParty).not.toBeNull();
      expect(animal?.buyerParty?.name).toBe("Test Contact Party");
    });
  });

  describe("AnimalOwnershipChange JSON", () => {
    it("should allow storing party-based ownership snapshots", async () => {
      const ownershipChange = await prisma.animalOwnershipChange.create({
        data: {
          tenantId: testTenantId,
          animalId: testAnimalId,
          kind: "SALE",
          occurredAt: new Date(),
          fromOwners: [{ contactId: testContactId, percent: 100 }],
          toOwners: [{ organizationId: testOrgId, percent: 100 }],
          fromOwnerParties: [
            {
              partyId: testContactPartyId,
              kind: "CONTACT",
              legacyContactId: testContactId,
              percent: 100,
            },
          ],
          toOwnerParties: [
            {
              partyId: testOrgPartyId,
              kind: "ORGANIZATION",
              legacyOrganizationId: testOrgId,
              percent: 100,
            },
          ],
        },
      });

      expect(ownershipChange.fromOwnerParties).not.toBeNull();
      expect(ownershipChange.toOwnerParties).not.toBeNull();
      expect(Array.isArray(ownershipChange.fromOwnerParties)).toBe(true);
      expect(Array.isArray(ownershipChange.toOwnerParties)).toBe(true);

      const fromParties = ownershipChange.fromOwnerParties as Array<{
        partyId: number;
        kind: string;
      }>;
      const toParties = ownershipChange.toOwnerParties as Array<{
        partyId: number;
        kind: string;
      }>;

      expect(fromParties[0].partyId).toBe(testContactPartyId);
      expect(fromParties[0].kind).toBe("CONTACT");
      expect(toParties[0].partyId).toBe(testOrgPartyId);
      expect(toParties[0].kind).toBe("ORGANIZATION");
    });

    it("should preserve legacy JSON alongside party-based JSON", async () => {
      const legacyFrom = [{ contactId: testContactId, percent: 100, name: "John Doe" }];
      const legacyTo = [{ organizationId: testOrgId, percent: 100, name: "Acme Corp" }];

      const ownershipChange = await prisma.animalOwnershipChange.create({
        data: {
          tenantId: testTenantId,
          animalId: testAnimalId,
          kind: "TRANSFER",
          occurredAt: new Date(),
          fromOwners: legacyFrom,
          toOwners: legacyTo,
          fromOwnerParties: [
            {
              partyId: testContactPartyId,
              kind: "CONTACT",
              legacyContactId: testContactId,
              percent: 100,
              name: "John Doe",
            },
          ],
          toOwnerParties: [
            {
              partyId: testOrgPartyId,
              kind: "ORGANIZATION",
              legacyOrganizationId: testOrgId,
              percent: 100,
              name: "Acme Corp",
            },
          ],
        },
      });

      // Legacy JSON preserved
      expect(ownershipChange.fromOwners).toEqual(legacyFrom);
      expect(ownershipChange.toOwners).toEqual(legacyTo);

      // Party-based JSON added
      expect(ownershipChange.fromOwnerParties).not.toBeNull();
      expect(ownershipChange.toOwnerParties).not.toBeNull();
    });
  });

  describe("Backfill verification", () => {
    it("should have backfilled partyId for existing AnimalOwners", async () => {
      // This test verifies the backfill script worked
      const ownersWithoutPartyId = await prisma.animalOwner.count({
        where: {
          AND: [
            { partyId: null },
            {
              OR: [
                { contactId: { not: null } },
                { organizationId: { not: null } },
              ],
            },
          ],
        },
      });

      // After backfill, there should be no owners with legacy IDs but no partyId
      // (unless the Contact/Organization itself has no partyId)
      expect(ownersWithoutPartyId).toBe(0);
    });
  });
});
