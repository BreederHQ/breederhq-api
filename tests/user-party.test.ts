// tests/user-party.test.ts
// Unit tests for user party migration step 5

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import prisma from "../src/prisma.js";
import { resolvePartyId } from "../src/services/party-resolver.js";

/**
 * Test suite for Party Migration Step 5: Users Domain
 *
 * These tests verify:
 * 1. partyId resolution from contactId
 * 2. Dual-write: updating user contactId also sets partyId
 * 3. Schema integrity: partyId field exists and has proper FK
 */

describe("User - Party Migration Step 5", () => {
  let testTenantId: number;
  let testPartyId: number;
  let testContactId: number;
  let testUserId: string;

  beforeEach(async () => {
    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: { name: "Test Tenant for Users" },
    });
    testTenantId = tenant.id;

    // Create test party for contact
    const party = await prisma.party.create({
      data: {
        tenantId: testTenantId,
        type: "CONTACT",
        name: "Test User Contact Party",
      },
    });
    testPartyId = party.id;

    // Create test contact with partyId
    const contact = await prisma.contact.create({
      data: {
        tenantId: testTenantId,
        display_name: "Test User Contact",
        partyId: testPartyId,
      },
    });
    testContactId = contact.id;

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-user-${Date.now()}@example.com`,
        name: "Test User",
      },
    });
    testUserId = user.id;

    // Create tenant membership for the user
    await prisma.tenantMembership.create({
      data: {
        userId: testUserId,
        tenantId: testTenantId,
        role: "MEMBER",
      },
    });
  });

  afterEach(async () => {
    // Clean up test data in reverse order of creation
    await prisma.tenantMembership.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.contact.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.party.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.delete({ where: { id: testTenantId } });
  });

  describe("partyId resolution", () => {
    it("should resolve partyId from a valid contactId", async () => {
      const partyId = await resolvePartyId(prisma, { contactId: testContactId });
      expect(partyId).toBe(testPartyId);
    });

    it("should return null for non-existent contactId", async () => {
      const partyId = await resolvePartyId(prisma, { contactId: 999999 });
      expect(partyId).toBeNull();
    });

    it("should return null for contact without partyId", async () => {
      // Create contact without partyId
      const contactWithoutParty = await prisma.contact.create({
        data: {
          tenantId: testTenantId,
          display_name: "Contact Without Party",
        },
      });

      const partyId = await resolvePartyId(prisma, { contactId: contactWithoutParty.id });
      expect(partyId).toBeNull();

      await prisma.contact.delete({ where: { id: contactWithoutParty.id } });
    });
  });

  describe("User contactId update - Dual Write", () => {
    it("should set both contactId and partyId when updating user contact", async () => {
      // Resolve partyId from contactId
      const partyId = await resolvePartyId(prisma, { contactId: testContactId });

      // Update user with both contactId and partyId (simulating dual-write)
      await prisma.user.update({
        where: { id: testUserId },
        data: {
          contactId: testContactId,
          partyId: partyId,
        },
      });

      const updatedUser = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { contactId: true, partyId: true },
      });

      expect(updatedUser?.contactId).toBe(testContactId);
      expect(updatedUser?.partyId).toBe(testPartyId);
    });

    it("should clear both contactId and partyId when setting to null", async () => {
      // First set contactId and partyId
      const partyId = await resolvePartyId(prisma, { contactId: testContactId });
      await prisma.user.update({
        where: { id: testUserId },
        data: {
          contactId: testContactId,
          partyId: partyId,
        },
      });

      // Then clear both
      await prisma.user.update({
        where: { id: testUserId },
        data: {
          contactId: null,
          partyId: null,
        },
      });

      const updatedUser = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { contactId: true, partyId: true },
      });

      expect(updatedUser?.contactId).toBeNull();
      expect(updatedUser?.partyId).toBeNull();
    });

    it("should set contactId but leave partyId null if contact has no party", async () => {
      // Create contact without partyId
      const contactWithoutParty = await prisma.contact.create({
        data: {
          tenantId: testTenantId,
          display_name: "Contact Without Party",
        },
      });

      const partyId = await resolvePartyId(prisma, { contactId: contactWithoutParty.id });

      await prisma.user.update({
        where: { id: testUserId },
        data: {
          contactId: contactWithoutParty.id,
          partyId: partyId,
        },
      });

      const updatedUser = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { contactId: true, partyId: true },
      });

      expect(updatedUser?.contactId).toBe(contactWithoutParty.id);
      expect(updatedUser?.partyId).toBeNull();

      await prisma.contact.delete({ where: { id: contactWithoutParty.id } });
    });
  });

  describe("User-Party relation", () => {
    it("should be able to query user with party relation", async () => {
      // Set user contactId and partyId
      const partyId = await resolvePartyId(prisma, { contactId: testContactId });
      await prisma.user.update({
        where: { id: testUserId },
        data: {
          contactId: testContactId,
          partyId: partyId,
        },
      });

      // Query user with party relation
      const userWithParty = await prisma.user.findUnique({
        where: { id: testUserId },
        include: { party: true },
      });

      expect(userWithParty?.party).not.toBeNull();
      expect(userWithParty?.party?.id).toBe(testPartyId);
      expect(userWithParty?.party?.name).toBe("Test User Contact Party");
    });

    it("should handle user with no party relation", async () => {
      // Query user without party
      const userWithoutParty = await prisma.user.findUnique({
        where: { id: testUserId },
        include: { party: true },
      });

      expect(userWithoutParty?.party).toBeNull();
    });
  });

  describe("Backfill verification", () => {
    it("should verify partyId is populated after backfill", async () => {
      // First create a user with only contactId (pre-migration state)
      const preMigrationUser = await prisma.user.create({
        data: {
          email: `pre-migration-${Date.now()}@example.com`,
          contactId: testContactId,
        },
      });

      // Simulate backfill by running update query
      await prisma.$executeRaw`
        UPDATE "User" u
        SET "partyId" = c."partyId"
        FROM "Contact" c
        WHERE u."contactId" = c.id
          AND u."partyId" IS NULL
          AND c."partyId" IS NOT NULL
          AND u.id = ${preMigrationUser.id}
      `;

      // Verify partyId was populated
      const backfilledUser = await prisma.user.findUnique({
        where: { id: preMigrationUser.id },
        select: { contactId: true, partyId: true },
      });

      expect(backfilledUser?.contactId).toBe(testContactId);
      expect(backfilledUser?.partyId).toBe(testPartyId);

      await prisma.user.delete({ where: { id: preMigrationUser.id } });
    });
  });
});
