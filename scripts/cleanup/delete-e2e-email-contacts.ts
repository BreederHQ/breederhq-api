#!/usr/bin/env tsx
/**
 * Delete Contacts with "e2e" in Email
 *
 * Permanently deletes all contacts in tenant 4 (DEV) that have "e2e" in their email address.
 * These are leftover test contacts from E2E test runs.
 *
 * Usage:
 *   tsx scripts/cleanup/delete-e2e-email-contacts.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TENANT_ID = 4;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("\n╔═══════════════════════════════════════════════════╗");
  console.log("║  Delete E2E Email Contacts - Tenant 4 (DEV)       ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");
  console.log(`Mode: ${dryRun ? "DRY RUN (preview only)" : "DELETE (permanent)"}\n`);

  // Find all contacts with "e2e" in email
  const contacts = await prisma.contact.findMany({
    where: {
      tenantId: TENANT_ID,
      email: {
        contains: "e2e",
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      display_name: true,
      email: true,
      partyId: true,
    },
    orderBy: { id: "asc" },
  });

  if (contacts.length === 0) {
    console.log("✅ No contacts with 'e2e' in email found. Nothing to delete.\n");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${contacts.length} contacts to delete:\n`);

  for (const contact of contacts) {
    console.log(`  ID: ${contact.id}`);
    console.log(`  Name: ${contact.display_name}`);
    console.log(`  Email: ${contact.email}`);
    console.log(`  Party ID: ${contact.partyId || "(none)"}`);
    console.log("");
  }

  if (dryRun) {
    console.log(`ℹ️  DRY RUN - No changes made.`);
    console.log(`   Run without --dry-run to delete these contacts.\n`);
    await prisma.$disconnect();
    return;
  }

  console.log(`⚠️  About to PERMANENTLY DELETE ${contacts.length} contacts!`);
  console.log(`   Waiting 3 seconds before proceeding...\n`);
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const contactIds = contacts.map((c) => c.id);
  const partyIds = contacts.map((c) => c.partyId).filter((id): id is number => id !== null);

  // Delete in correct order:
  // 1. Delete Contact first (clears FK to Party, change requests cascade automatically)
  // 2. Delete Party (CRM records like notes, events, activity cascade automatically)

  const deletedContacts = await prisma.contact.deleteMany({
    where: {
      id: { in: contactIds },
      tenantId: TENANT_ID,
    },
  });
  console.log(`✅ Deleted ${deletedContacts.count} contacts`);

  // Delete orphaned parties
  if (partyIds.length > 0) {
    const deletedParties = await prisma.party.deleteMany({
      where: {
        id: { in: partyIds },
        tenantId: TENANT_ID,
      },
    });
    if (deletedParties.count > 0) {
      console.log(`✅ Deleted ${deletedParties.count} associated parties`);
    }
  }

  // Verify cleanup
  const remaining = await prisma.contact.count({
    where: {
      tenantId: TENANT_ID,
      email: { contains: "e2e", mode: "insensitive" },
    },
  });

  if (remaining === 0) {
    console.log("\n✅ All e2e contacts have been deleted!\n");
  } else {
    console.log(`\n⚠️  ${remaining} contacts still remain with 'e2e' in email.\n`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
