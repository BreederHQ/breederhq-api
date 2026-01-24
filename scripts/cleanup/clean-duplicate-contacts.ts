#!/usr/bin/env tsx
/**
 * Clean Duplicate Contacts Script
 *
 * This script identifies and removes duplicate contacts in a specific tenant.
 * It groups contacts by email/name/phone and keeps the oldest record (lowest ID),
 * archiving or deleting the duplicates.
 *
 * Usage:
 *   tsx scripts/clean-duplicate-contacts.ts --tenant-id=4 [--dry-run] [--delete]
 *
 * Options:
 *   --tenant-id=N  Required: Tenant ID to clean
 *   --dry-run      Show what would be deleted without actually deleting
 *   --delete       Permanently delete duplicates (default: archive them)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface DuplicateGroup {
  key: string;
  contacts: Array<{
    id: number;
    display_name: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    phoneE164: string | null;
    partyId: number | null;
    archived: boolean;
    createdAt: Date;
  }>;
}

async function findDuplicates(tenantId: number): Promise<DuplicateGroup[]> {
  console.log(`\n🔍 Finding duplicate contacts in tenant ${tenantId}...\n`);

  // Fetch all contacts for this tenant
  const contacts = await prisma.contact.findMany({
    where: { tenantId },
    select: {
      id: true,
      display_name: true,
      email: true,
      first_name: true,
      last_name: true,
      phoneE164: true,
      partyId: true,
      archived: true,
      createdAt: true,
    },
    orderBy: { id: 'asc' },
  });

  console.log(`📊 Total contacts found: ${contacts.length}`);

  // Group by multiple criteria to catch all types of duplicates
  const groups = new Map<string, typeof contacts>();

  for (const contact of contacts) {
    const keys: string[] = [];

    // Strategy 1: Group by email if exists
    if (contact.email && contact.email.trim()) {
      keys.push(`email:${contact.email.toLowerCase().trim()}`);
    }

    // Strategy 2: Group by name + phone if both exist
    if (contact.display_name && contact.phoneE164) {
      const normalizedName = contact.display_name.toLowerCase().trim();
      const normalizedPhone = contact.phoneE164.replace(/\D/g, ''); // Remove non-digits
      if (normalizedName && normalizedPhone) {
        keys.push(`name-phone:${normalizedName}|${normalizedPhone}`);
      }
    }

    // Strategy 3: Group by exact display name match (for contacts without email/phone)
    if (contact.display_name) {
      keys.push(`name-exact:${contact.display_name.toLowerCase().trim()}`);
    }

    // Add contact to all matching groups
    for (const key of keys) {
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      const existing = groups.get(key)!;
      // Avoid adding same contact twice to same group
      if (!existing.find(c => c.id === contact.id)) {
        existing.push(contact);
      }
    }
  }

  // Filter to only groups with duplicates
  const duplicateGroups: DuplicateGroup[] = [];
  for (const [key, contactList] of groups.entries()) {
    if (contactList.length > 1) {
      duplicateGroups.push({ key, contacts: contactList });
    }
  }

  return duplicateGroups;
}

async function cleanDuplicates(
  tenantId: number,
  dryRun: boolean = true,
  deleteMode: boolean = false
): Promise<void> {
  const duplicateGroups = await findDuplicates(tenantId);

  if (duplicateGroups.length === 0) {
    console.log('\n✅ No duplicates found!\n');
    return;
  }

  console.log(`\n⚠️  Found ${duplicateGroups.length} groups of duplicates:\n`);

  let totalDuplicates = 0;
  const toRemove = new Set<number>(); // Use Set to avoid duplicates in removal list

  // Display duplicates and determine which to keep
  for (const group of duplicateGroups) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 Duplicate group: ${group.key}`);
    console.log(`   Count: ${group.contacts.length} contacts\n`);

    // Sort by: not archived first, then by oldest createdAt, then by lowest ID
    const sorted = [...group.contacts].sort((a, b) => {
      // Prefer non-archived
      if (a.archived !== b.archived) return a.archived ? 1 : -1;
      // Prefer older creation date
      if (a.createdAt.getTime() !== b.createdAt.getTime()) {
        return a.createdAt.getTime() - b.createdAt.getTime();
      }
      // Prefer lower ID (older record)
      return a.id - b.id;
    });

    const keeper = sorted[0];
    const duplicates = sorted.slice(1);

    console.log(`   ✅ KEEP: ID ${keeper.id}`);
    console.log(`      Name: ${keeper.display_name}`);
    console.log(`      Email: ${keeper.email || '(none)'}`);
    console.log(`      Phone: ${keeper.phoneE164 || '(none)'}`);
    console.log(`      Created: ${keeper.createdAt.toISOString()}`);
    console.log(`      Archived: ${keeper.archived}\n`);

    for (const dup of duplicates) {
      const alreadyMarked = toRemove.has(dup.id);
      console.log(`   ${alreadyMarked ? '⏭️ ' : '❌'} ${dryRun ? 'WOULD' : 'WILL'} ${deleteMode ? 'DELETE' : 'ARCHIVE'}: ID ${dup.id}${alreadyMarked ? ' (already marked from another group)' : ''}`);
      console.log(`      Name: ${dup.display_name}`);
      console.log(`      Email: ${dup.email || '(none)'}`);
      console.log(`      Phone: ${dup.phoneE164 || '(none)'}`);
      console.log(`      Created: ${dup.createdAt.toISOString()}`);
      console.log(`      Archived: ${dup.archived}\n`);

      if (!alreadyMarked) {
        toRemove.add(dup.id);
        totalDuplicates++;
      }
    }
  }

  const removalList = Array.from(toRemove);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Summary:`);
  console.log(`   Total duplicate groups found: ${duplicateGroups.length}`);
  console.log(`   Unique contacts to ${deleteMode ? 'delete' : 'archive'}: ${totalDuplicates}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (dryRun) {
    console.log(`ℹ️  DRY RUN MODE - No changes made.`);
    console.log(`   Run without --dry-run to apply changes.\n`);
    return;
  }

  // Confirm before proceeding
  console.log(`⚠️  About to ${deleteMode ? 'DELETE' : 'ARCHIVE'} ${totalDuplicates} duplicate contacts!`);
  console.log(`   Press Ctrl+C to cancel, or waiting 5 seconds to proceed...\n`);

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Apply changes
  console.log(`\n🔄 Processing ${totalDuplicates} duplicates...\n`);

  if (deleteMode) {
    // Permanently delete duplicates
    const result = await prisma.contact.deleteMany({
      where: {
        id: { in: removalList },
        tenantId,
      },
    });
    console.log(`✅ Deleted ${result.count} duplicate contacts.\n`);
  } else {
    // Archive duplicates
    const result = await prisma.contact.updateMany({
      where: {
        id: { in: removalList },
        tenantId,
      },
      data: {
        archived: true,
      },
    });
    console.log(`✅ Archived ${result.count} duplicate contacts.\n`);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let tenantId: number | null = null;
  let dryRun = true;
  let deleteMode = false;

  for (const arg of args) {
    if (arg.startsWith('--tenant-id=')) {
      tenantId = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--no-dry-run') {
      dryRun = false;
    } else if (arg === '--delete') {
      deleteMode = true;
      dryRun = false; // Delete implies no dry run
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: tsx scripts/clean-duplicate-contacts.ts --tenant-id=N [options]

Options:
  --tenant-id=N    Required: Tenant ID to clean duplicates for
  --dry-run        Show what would be changed (default: true)
  --no-dry-run     Actually apply changes (archives duplicates)
  --delete         Permanently delete duplicates (implies --no-dry-run)
  --help, -h       Show this help message

Examples:
  # Preview duplicates without making changes
  tsx scripts/clean-duplicate-contacts.ts --tenant-id=4

  # Archive duplicates (keeps them in database)
  tsx scripts/clean-duplicate-contacts.ts --tenant-id=4 --no-dry-run

  # Permanently delete duplicates
  tsx scripts/clean-duplicate-contacts.ts --tenant-id=4 --delete
`);
      process.exit(0);
    }
  }

  if (!tenantId || !Number.isInteger(tenantId)) {
    console.error('❌ Error: --tenant-id is required and must be a valid integer');
    console.error('   Example: tsx scripts/clean-duplicate-contacts.ts --tenant-id=4');
    process.exit(1);
  }

  return { tenantId, dryRun, deleteMode };
}

// Main execution
async function main() {
  const { tenantId, dryRun, deleteMode } = parseArgs();

  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   Clean Duplicate Contacts Script        ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`\nTenant ID: ${tenantId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview only)' : deleteMode ? 'DELETE (permanent)' : 'ARCHIVE (soft delete)'}`);

  try {
    await cleanDuplicates(tenantId, dryRun, deleteMode);
    console.log('✅ Script completed successfully.\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
