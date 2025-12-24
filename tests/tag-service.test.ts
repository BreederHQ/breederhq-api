// tests/tag-service.test.ts
// Unit tests for tag service party migration step 5

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
 * Test suite for Party Migration Step 5: Tags Domain
 *
 * These tests verify:
 * 1. partyId resolution from contactId and organizationId
 * 2. Dual-write: creating tag assignments sets both legacy ID and partyId
 * 3. Dual-read: fetching tags works via both contactId and taggedPartyId
 */

describe("Tag Service - Party Migration Step 5", () => {
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

  describe("createTagAssignment - Dual Write", () => {
    it("should create tag assignment with both contactId and taggedPartyId", async () => {
      await createTagAssignment({
        tagId: testTagId,
        contactId: testContactId,
      });

      const assignment = await prisma.tagAssignment.findFirst({
        where: { tagId: testTagId, contactId: testContactId },
      });

      expect(assignment).not.toBeNull();
      expect(assignment?.contactId).toBe(testContactId);
      expect(assignment?.taggedPartyId).toBe(testPartyId);
    });

    it("should create tag assignment with organizationId and taggedPartyId", async () => {
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
        where: { tagId: orgTag.id, organizationId: testOrgId },
      });

      expect(assignment).not.toBeNull();
      expect(assignment?.organizationId).toBe(testOrgId);
      expect(assignment?.taggedPartyId).toBe(testOrgPartyId);

      await prisma.tag.delete({ where: { id: orgTag.id } });
    });

    it("should create assignment without taggedPartyId if contact has no partyId", async () => {
      const contactWithoutParty = await prisma.contact.create({
        data: {
          tenantId: testTenantId,
          display_name: "Contact Without Party",
        },
      });

      await createTagAssignment({
        tagId: testTagId,
        contactId: contactWithoutParty.id,
      });

      const assignment = await prisma.tagAssignment.findFirst({
        where: { tagId: testTagId, contactId: contactWithoutParty.id },
      });

      expect(assignment).not.toBeNull();
      expect(assignment?.contactId).toBe(contactWithoutParty.id);
      expect(assignment?.taggedPartyId).toBeNull();

      await prisma.contact.delete({ where: { id: contactWithoutParty.id } });
    });
  });

  describe("getTagsForContact - Dual Read", () => {
    it("should retrieve tags assigned via contactId", async () => {
      await createTagAssignment({
        tagId: testTagId,
        contactId: testContactId,
      });

      const tags = await getTagsForContact(testContactId, testTenantId);

      expect(tags.length).toBe(1);
      expect(tags[0].id).toBe(testTagId);
      expect(tags[0].name).toBe("Test Tag");
    });

    it("should retrieve tags assigned via taggedPartyId", async () => {
      // Manually create assignment with only taggedPartyId (simulating migrated data)
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

    it("should deduplicate tags present in both contactId and taggedPartyId", async () => {
      // Create assignment with dual-write
      await createTagAssignment({
        tagId: testTagId,
        contactId: testContactId,
      });

      const tags = await getTagsForContact(testContactId, testTenantId);

      // Should only return one tag, not duplicates
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
  });

  describe("getTagsForOrganization - Dual Read", () => {
    it("should retrieve tags assigned via organizationId", async () => {
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

    it("should retrieve tags assigned via taggedPartyId", async () => {
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
  });
});
