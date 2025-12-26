/**
 * Step 6E: WaitlistEntry Party Mapping Tests
 * Tests backward-compatible mapping between Party-only storage and legacy contact/org fields
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { PrismaClient, PartyType } from "@prisma/client";
import {
  deriveLegacyClientFields,
  resolveClientPartyId,
} from "../src/services/waitlist-mapping.js";

const prisma = new PrismaClient();

describe("WaitlistEntry Party Mapping (Step 6E)", () => {
  let testTenantId: number;
  let testContactId: number;
  let testContactPartyId: number;
  let testOrganizationId: number;
  let testOrganizationPartyId: number;

  beforeAll(async () => {
    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: "WaitlistPartyTestTenant",
        slug: "waitlist-party-test",
      },
    });
    testTenantId = tenant.id;

    // Create test contact with party
    const contactParty = await prisma.party.create({
      data: {
        tenantId: testTenantId,
        type: PartyType.CONTACT,
        name: "Test Contact",
        email: "contact@test.com",
      },
    });
    testContactPartyId = contactParty.id;

    const contact = await prisma.contact.create({
      data: {
        tenantId: testTenantId,
        partyId: testContactPartyId,
        display_name: "Test Contact",
        email: "contact@test.com",
      },
    });
    testContactId = contact.id;

    // Link party to contact
    await prisma.party.update({
      where: { id: testContactPartyId },
      data: {
        contact: { connect: { id: testContactId } },
      },
    });

    // Create test organization with party
    const orgParty = await prisma.party.create({
      data: {
        tenantId: testTenantId,
        type: PartyType.ORGANIZATION,
        name: "Test Organization",
        email: "org@test.com",
      },
    });
    testOrganizationPartyId = orgParty.id;

    const organization = await prisma.organization.create({
      data: {
        tenantId: testTenantId,
        partyId: testOrganizationPartyId,
        name: "Test Organization",
        email: "org@test.com",
      },
    });
    testOrganizationId = organization.id;

    // Link party to organization
    await prisma.party.update({
      where: { id: testOrganizationPartyId },
      data: {
        organization: { connect: { id: testOrganizationId } },
      },
    });
  });

  afterAll(async () => {
    // Cleanup: delete tenant and all related data (cascade)
    await prisma.tenant.delete({ where: { id: testTenantId } });
    await prisma.$disconnect();
  });

  describe("resolveClientPartyId", () => {
    it("should resolve partyId from contactId", async () => {
      const partyId = await resolveClientPartyId(prisma, testContactId, null);
      expect(partyId).toBe(testContactPartyId);
    });

    it("should resolve partyId from organizationId", async () => {
      const partyId = await resolveClientPartyId(prisma, null, testOrganizationId);
      expect(partyId).toBe(testOrganizationPartyId);
    });

    it("should prefer organizationId over contactId when both provided", async () => {
      const partyId = await resolveClientPartyId(prisma, testContactId, testOrganizationId);
      expect(partyId).toBe(testOrganizationPartyId);
    });

    it("should return null when neither contactId nor organizationId provided", async () => {
      const partyId = await resolveClientPartyId(prisma, null, null);
      expect(partyId).toBeNull();
    });

    it("should return null for non-existent contactId", async () => {
      const partyId = await resolveClientPartyId(prisma, 999999, null);
      expect(partyId).toBeNull();
    });
  });

  describe("deriveLegacyClientFields", () => {
    it("should derive contactId and contact object from CONTACT Party", () => {
      const mockEntry = {
        id: 1,
        tenantId: testTenantId,
        clientPartyId: testContactPartyId,
        clientParty: {
          id: testContactPartyId,
          type: PartyType.CONTACT,
          contact: {
            id: testContactId,
            display_name: "Test Contact",
            email: "contact@test.com",
            phoneE164: null,
          },
          organization: null,
        },
      };

      const legacy = deriveLegacyClientFields(mockEntry);

      expect(legacy.contactId).toBe(testContactId);
      expect(legacy.organizationId).toBeNull();
      expect(legacy.contact).toEqual({
        id: testContactId,
        display_name: "Test Contact",
        email: "contact@test.com",
        phoneE164: null,
      });
      expect(legacy.organization).toBeNull();
    });

    it("should derive organizationId and organization object from ORGANIZATION Party", () => {
      const mockEntry = {
        id: 2,
        tenantId: testTenantId,
        clientPartyId: testOrganizationPartyId,
        clientParty: {
          id: testOrganizationPartyId,
          type: PartyType.ORGANIZATION,
          contact: null,
          organization: {
            id: testOrganizationId,
            name: "Test Organization",
            email: "org@test.com",
            phone: null,
          },
        },
      };

      const legacy = deriveLegacyClientFields(mockEntry);

      expect(legacy.contactId).toBeNull();
      expect(legacy.organizationId).toBe(testOrganizationId);
      expect(legacy.contact).toBeNull();
      expect(legacy.organization).toEqual({
        id: testOrganizationId,
        name: "Test Organization",
        email: "org@test.com",
        phone: null,
      });
    });

    it("should return nulls when clientParty is null", () => {
      const mockEntry = {
        id: 3,
        tenantId: testTenantId,
        clientPartyId: null,
        clientParty: null,
      };

      const legacy = deriveLegacyClientFields(mockEntry);

      expect(legacy.contactId).toBeNull();
      expect(legacy.organizationId).toBeNull();
      expect(legacy.contact).toBeNull();
      expect(legacy.organization).toBeNull();
    });

    it("should handle orphaned Party (no backing entity)", () => {
      const mockEntry = {
        id: 4,
        tenantId: testTenantId,
        clientPartyId: 999,
        clientParty: {
          id: 999,
          type: PartyType.CONTACT,
          contact: null,
          organization: null,
        },
      };

      const legacy = deriveLegacyClientFields(mockEntry);

      expect(legacy.contactId).toBeNull();
      expect(legacy.organizationId).toBeNull();
      expect(legacy.contact).toBeNull();
      expect(legacy.organization).toBeNull();
    });
  });

  describe("End-to-End: Create and Read WaitlistEntry with Party Mapping", () => {
    it("should create waitlist entry with contactId, persist as clientPartyId, and read back with derived legacy fields", async () => {
      // Simulate: POST /api/v1/waitlist with legacy contactId
      const clientPartyId = await resolveClientPartyId(prisma, testContactId, null);
      expect(clientPartyId).toBe(testContactPartyId);

      const waitlistEntry = await prisma.waitlistEntry.create({
        data: {
          tenantId: testTenantId,
          clientPartyId,
          status: "INQUIRY",
        },
        include: {
          clientParty: {
            select: {
              id: true,
              type: true,
              contact: {
                select: { id: true, display_name: true, email: true, phoneE164: true },
              },
              organization: {
                select: { id: true, name: true, email: true, phone: true },
              },
            },
          },
        },
      });

      // Derive legacy fields for response
      const legacy = deriveLegacyClientFields(waitlistEntry as any);

      expect(legacy.contactId).toBe(testContactId);
      expect(legacy.organizationId).toBeNull();
      expect(legacy.contact?.display_name).toBe("Test Contact");

      // Cleanup
      await prisma.waitlistEntry.delete({ where: { id: waitlistEntry.id } });
    });

    it("should create waitlist entry with organizationId, persist as clientPartyId, and read back with derived legacy fields", async () => {
      // Simulate: POST /api/v1/waitlist with legacy organizationId
      const clientPartyId = await resolveClientPartyId(prisma, null, testOrganizationId);
      expect(clientPartyId).toBe(testOrganizationPartyId);

      const waitlistEntry = await prisma.waitlistEntry.create({
        data: {
          tenantId: testTenantId,
          clientPartyId,
          status: "INQUIRY",
        },
        include: {
          clientParty: {
            select: {
              id: true,
              type: true,
              contact: {
                select: { id: true, display_name: true, email: true, phoneE164: true },
              },
              organization: {
                select: { id: true, name: true, email: true, phone: true },
              },
            },
          },
        },
      });

      // Derive legacy fields for response
      const legacy = deriveLegacyClientFields(waitlistEntry as any);

      expect(legacy.contactId).toBeNull();
      expect(legacy.organizationId).toBe(testOrganizationId);
      expect(legacy.organization?.name).toBe("Test Organization");

      // Cleanup
      await prisma.waitlistEntry.delete({ where: { id: waitlistEntry.id } });
    });
  });
});
