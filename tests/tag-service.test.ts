// tests/tag-service.test.ts
// Unit tests for tag service Step 6B: Party-only

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import prisma from "../src/prisma.js";
import {
  createTagAssignment,
  getTagsForContact,
  getTagsForOrganization,
  resolvePartyIdFromContact,
  resolvePartyIdFromOrganization,
} from "../src/services/tag-service.js";

/**
 * Test suite for Step 6B: Tags Party-Only
 *
 * These tests verify:
 * 1. partyId resolution from contactId and organizationId
 * 2. Party-only writes: creating tag assignments persists ONLY taggedPartyId
 * 3. Party-only reads: fetching tags works via taggedPartyId lookups
 */

describe("Tag Service - Step 6B Party-Only", () => {
  let testTenantId: number;
  let testPartyId: number;
  let testContactId: number;
  let testOrgId: number;
  let testOrgPartyId: number;
  let testTagId: number;

  beforeEach(async () => {
    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: { name: "Test Tenant for Tags" },
    });
    testTenantId = tenant.id;

    // Create test party for contact
    const party = await prisma.party.create({
      data: {
        tenantId: testTenantId,
        type: "CONTACT",
        name: "Test Contact Party",
      },
    });
    testPartyId = party.id;

    // Create test contact with partyId
    const contact = await prisma.contact.create({
      data: {
        tenantId: testTenantId,
        display_name: "Test Contact",
        partyId: testPartyId,
      },
    });
    testContactId = contact.id;

    // Create test party for organization
    const orgParty = await prisma.party.create({
      data: {
        tenantId: testTenantId,
        type: "ORGANIZATION",
        name: "Test Org Party",
      },
    });
    testOrgPartyId = orgParty.id;

    // Create test organization with partyId
    const org = await prisma.organization.create({
      data: {
        tenantId: testTenantId,
        name: "Test Organization",
        partyId: testOrgPartyId,
      },
    });
    testOrgId = org.id;

    // Create test tag for contacts
    const tag = await prisma.tag.create({
      data: {
        tenantId: testTenantId,
        name: "Test Tag",
        module: "CONTACT",
      },
    });
    testTagId = tag.id;
  });

  afterEach(async () => {
    // Clean up test data in reverse order of creation
    await prisma.tagAssignment.deleteMany({ where: { tagId: testTagId } });
    await prisma.tag.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.contact.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.organization.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.party.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.delete({ where: { id: testTenantId } });
  });

  describe("resolvePartyIdFromContact", () => {
    it("should resolve partyId from a valid contactId", async () => {
      const partyId = await resolvePartyIdFromContact(testContactId);
      expect(partyId).toBe(testPartyId);
    });

    it("should return null for non-existent contactId", async () => {
      const partyId = await resolvePartyIdFromContact(999999);
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

      const partyId = await resolvePartyIdFromContact(contactWithoutParty.id);
      expect(partyId).toBeNull();

      await prisma.contact.delete({ where: { id: contactWithoutParty.id } });
    });
  });

  describe("resolvePartyIdFromOrganization", () => {
    it("should resolve partyId from a valid organizationId", async () => {
      const partyId = await resolvePartyIdFromOrganization(testOrgId);
      expect(partyId).toBe(testOrgPartyId);
    });

    it("should return null for non-existent organizationId", async () => {
      const partyId = await resolvePartyIdFromOrganization(999999);
      expect(partyId).toBeNull();
    });
  });

  describe("createTagAssignment - Party-Only Write", () => {
    it("should create tag assignment with ONLY taggedPartyId (no contactId)", async () => {
      await createTagAssignment({
        tagId: testTagId,
        contactId: testContactId,
      });

      const assignment = await prisma.tagAssignment.findFirst({
        where: { tagId: testTagId, taggedPartyId: testPartyId },
      });

      expect(assignment).not.toBeNull();
      expect(assignment?.taggedPartyId).toBe(testPartyId);
      // contactId column should not exist anymore
    });

    it("should create tag assignment with ONLY taggedPartyId for organization", async () => {
      // Create org tag
      const orgTag = await prisma.tag.create({
        data: {
          tenantId: testTenantId,
          name: "Org Tag",
          module: "ORGANIZATION",
        },
      });

      await createTagAssignment({
        tagId: orgTag.id,
        organizationId: testOrgId,
      });

      const assignment = await prisma.tagAssignment.findFirst({
        where: { tagId: orgTag.id, taggedPartyId: testOrgPartyId },
      });

      expect(assignment).not.toBeNull();
      expect(assignment?.taggedPartyId).toBe(testOrgPartyId);
      // organizationId column should not exist anymore

      await prisma.tag.delete({ where: { id: orgTag.id } });
    });

    it("should throw error if contact has no partyId", async () => {
      const contactWithoutParty = await prisma.contact.create({
        data: {
          tenantId: testTenantId,
          display_name: "Contact Without Party",
        },
      });

      await expect(
        createTagAssignment({
          tagId: testTagId,
          contactId: contactWithoutParty.id,
        })
      ).rejects.toThrow(/has no partyId/);

      await prisma.contact.delete({ where: { id: contactWithoutParty.id } });
    });
  });

  describe("getTagsForContact - Party-Only Read", () => {
    it("should retrieve tags assigned via taggedPartyId", async () => {
      await createTagAssignment({
        tagId: testTagId,
        contactId: testContactId,
      });

      const tags = await getTagsForContact(testContactId, testTenantId);

      expect(tags.length).toBe(1);
      expect(tags[0].id).toBe(testTagId);
      expect(tags[0].name).toBe("Test Tag");
    });

    it("should retrieve tags when assignment only has taggedPartyId", async () => {
      // Manually create assignment with only taggedPartyId
      await prisma.tagAssignment.create({
        data: {
          tagId: testTagId,
          taggedPartyId: testPartyId,
        },
      });

      const tags = await getTagsForContact(testContactId, testTenantId);

      expect(tags.length).toBe(1);
      expect(tags[0].id).toBe(testTagId);
    });

    it("should return empty array for contact with no tags", async () => {
      const tags = await getTagsForContact(testContactId, testTenantId);
      expect(tags).toEqual([]);
    });

    it("should return empty array for non-existent contact", async () => {
      const tags = await getTagsForContact(999999, testTenantId);
      expect(tags).toEqual([]);
    });

    it("should return empty array for contact without partyId", async () => {
      const contactWithoutParty = await prisma.contact.create({
        data: {
          tenantId: testTenantId,
          display_name: "Contact Without Party",
        },
      });

      const tags = await getTagsForContact(contactWithoutParty.id, testTenantId);
      expect(tags).toEqual([]);

      await prisma.contact.delete({ where: { id: contactWithoutParty.id } });
    });
  });

  describe("getTagsForOrganization - Party-Only Read", () => {
    it("should retrieve tags assigned via taggedPartyId", async () => {
      const orgTag = await prisma.tag.create({
        data: {
          tenantId: testTenantId,
          name: "Org Tag",
          module: "ORGANIZATION",
        },
      });

      await createTagAssignment({
        tagId: orgTag.id,
        organizationId: testOrgId,
      });

      const tags = await getTagsForOrganization(testOrgId, testTenantId);

      expect(tags.length).toBe(1);
      expect(tags[0].id).toBe(orgTag.id);

      await prisma.tag.delete({ where: { id: orgTag.id } });
    });

    it("should retrieve tags when assignment only has taggedPartyId", async () => {
      const orgTag = await prisma.tag.create({
        data: {
          tenantId: testTenantId,
          name: "Org Tag 2",
          module: "ORGANIZATION",
        },
      });

      // Manually create assignment with only taggedPartyId
      await prisma.tagAssignment.create({
        data: {
          tagId: orgTag.id,
          taggedPartyId: testOrgPartyId,
        },
      });

      const tags = await getTagsForOrganization(testOrgId, testTenantId);

      expect(tags.length).toBe(1);
      expect(tags[0].id).toBe(orgTag.id);

      await prisma.tag.delete({ where: { id: orgTag.id } });
    });

    it("should return empty array for organization with no tags", async () => {
      const tags = await getTagsForOrganization(testOrgId, testTenantId);
      expect(tags).toEqual([]);
    });

    it("should return empty array for non-existent organization", async () => {
      const tags = await getTagsForOrganization(999999, testTenantId);
      expect(tags).toEqual([]);
    });
  });
});
