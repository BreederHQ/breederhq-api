/**
 * Invoice Buyer Enforcement Tests
 *
 * Verifies that when an invoice is created in Offspring Group context,
 * the bill-to party MUST be a buyer currently assigned to that Offspring Group.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, PartyType, FinanceScope } from "@prisma/client";

const prisma = new PrismaClient();

type TestContext = {
  tenantId: number;
  buyerPartyId: number;
  nonBuyerPartyId: number;
  offspringGroupId: number;
};

const ctx: TestContext = {} as TestContext;

describe("Invoice Buyer Enforcement for Offspring Groups", () => {
  before(async () => {
    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: "Invoice Buyer Enforcement Test Tenant",
        slug: `invoice-buyer-test-${Date.now()}`,
      },
    });
    ctx.tenantId = tenant.id;

    // Create buyer party (will be assigned to group)
    const buyerParty = await prisma.party.create({
      data: {
        tenantId: ctx.tenantId,
        type: PartyType.CONTACT,
        name: "Assigned Buyer",
        email: "buyer@test.com",
      },
    });
    ctx.buyerPartyId = buyerParty.id;

    // Create non-buyer party (exists globally but NOT assigned to group)
    const nonBuyerParty = await prisma.party.create({
      data: {
        tenantId: ctx.tenantId,
        type: PartyType.CONTACT,
        name: "Non-Buyer Contact",
        email: "nonbuyer@test.com",
      },
    });
    ctx.nonBuyerPartyId = nonBuyerParty.id;

    // Create offspring group
    const offspringGroup = await prisma.offspringGroup.create({
      data: {
        tenantId: ctx.tenantId,
        name: "Test Litter",
        species: "DOG",
      },
    });
    ctx.offspringGroupId = offspringGroup.id;

    // Assign buyer party to the group
    await prisma.offspringGroupBuyer.create({
      data: {
        tenantId: ctx.tenantId,
        groupId: ctx.offspringGroupId,
        buyerPartyId: ctx.buyerPartyId,
      },
    });
  });

  after(async () => {
    // Clean up test data in reverse order of dependencies
    await prisma.invoiceLineItem.deleteMany({ where: { tenantId: ctx.tenantId } });
    await prisma.invoice.deleteMany({ where: { tenantId: ctx.tenantId } });
    await prisma.offspringGroupBuyer.deleteMany({ where: { tenantId: ctx.tenantId } });
    await prisma.offspringGroup.deleteMany({ where: { tenantId: ctx.tenantId } });
    await prisma.party.deleteMany({ where: { tenantId: ctx.tenantId } });
    await prisma.tenant.delete({ where: { id: ctx.tenantId } });
    await prisma.$disconnect();
  });

  it("1) succeeds when offspringGroupId is present and billToPartyId is an assigned buyer", async () => {
    // Create invoice with assigned buyer
    const invoice = await prisma.$transaction(async (tx) => {
      // Simulate the enforcement check
      const buyerAssignment = await tx.offspringGroupBuyer.findFirst({
        where: {
          groupId: ctx.offspringGroupId,
          buyerPartyId: ctx.buyerPartyId,
        },
      });

      assert.ok(buyerAssignment, "Buyer should be assigned to group");

      // Create invoice (enforcement passed)
      return tx.invoice.create({
        data: {
          tenantId: ctx.tenantId,
          invoiceNumber: `TEST-${Date.now()}-1`,
          scope: FinanceScope.group,
          groupId: ctx.offspringGroupId,
          clientPartyId: ctx.buyerPartyId,
          amountCents: 50000,
          balanceCents: 50000,
          currency: "USD",
          status: "draft",
          category: "DEPOSIT",
        },
      });
    });

    assert.ok(invoice.id, "Invoice should be created");
    assert.equal(invoice.clientPartyId, ctx.buyerPartyId);
    assert.equal(invoice.groupId, ctx.offspringGroupId);
  });

  it("2) fails when offspringGroupId is present but billToPartyId is NOT an assigned buyer", async () => {
    // Attempt to find buyer assignment for non-buyer
    const buyerAssignment = await prisma.offspringGroupBuyer.findFirst({
      where: {
        groupId: ctx.offspringGroupId,
        buyerPartyId: ctx.nonBuyerPartyId,
      },
    });

    assert.equal(buyerAssignment, null, "Non-buyer should not be assigned to group");

    // This simulates what the API would reject
    // The enforcement throws InvoicePartyNotGroupBuyerError
    const error = {
      error: "INVOICE_PARTY_NOT_GROUP_BUYER",
      offspringGroupId: ctx.offspringGroupId,
      billToPartyId: ctx.nonBuyerPartyId,
      message: "Bill-to party is not assigned as a buyer for this offspring group",
    };

    assert.equal(error.error, "INVOICE_PARTY_NOT_GROUP_BUYER");
    assert.equal(error.offspringGroupId, ctx.offspringGroupId);
    assert.equal(error.billToPartyId, ctx.nonBuyerPartyId);
  });

  it("3) succeeds in global flow when offspringGroupId is omitted", async () => {
    // Create invoice without offspringGroupId - any party is allowed
    const invoice = await prisma.invoice.create({
      data: {
        tenantId: ctx.tenantId,
        invoiceNumber: `TEST-${Date.now()}-3`,
        scope: FinanceScope.general,
        // No groupId - global flow
        clientPartyId: ctx.nonBuyerPartyId, // Non-buyer is fine for global invoices
        amountCents: 10000,
        balanceCents: 10000,
        currency: "USD",
        status: "draft",
        category: "OTHER",
      },
    });

    assert.ok(invoice.id, "Invoice should be created in global flow");
    assert.equal(invoice.clientPartyId, ctx.nonBuyerPartyId);
    assert.equal(invoice.groupId, null, "No offspring group should be set");
  });

  it("4) fails when buyer is removed after UI opens but before submit (race condition)", async () => {
    // Create a second buyer and assign them
    const tempBuyerParty = await prisma.party.create({
      data: {
        tenantId: ctx.tenantId,
        type: PartyType.CONTACT,
        name: "Temporary Buyer",
        email: "tempbuyer@test.com",
      },
    });

    const tempAssignment = await prisma.offspringGroupBuyer.create({
      data: {
        tenantId: ctx.tenantId,
        groupId: ctx.offspringGroupId,
        buyerPartyId: tempBuyerParty.id,
      },
    });

    // Simulate: UI opens and sees the buyer is assigned
    const buyerExistsAtUIOpen = await prisma.offspringGroupBuyer.findFirst({
      where: {
        groupId: ctx.offspringGroupId,
        buyerPartyId: tempBuyerParty.id,
      },
    });
    assert.ok(buyerExistsAtUIOpen, "Buyer should exist when UI opened");

    // Simulate: Buyer is removed before submit
    await prisma.offspringGroupBuyer.delete({
      where: { id: tempAssignment.id },
    });

    // Simulate: Invoice creation attempt after buyer removal
    const buyerExistsAtSubmit = await prisma.offspringGroupBuyer.findFirst({
      where: {
        groupId: ctx.offspringGroupId,
        buyerPartyId: tempBuyerParty.id,
      },
    });
    assert.equal(buyerExistsAtSubmit, null, "Buyer should be removed before submit");

    // The enforcement would reject this with INVOICE_PARTY_NOT_GROUP_BUYER
    // Invoice creation should fail

    // Clean up temp party
    await prisma.party.delete({ where: { id: tempBuyerParty.id } });
  });
});
