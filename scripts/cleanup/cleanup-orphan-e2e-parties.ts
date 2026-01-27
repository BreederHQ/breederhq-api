import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = 4;
  const dryRun = process.argv.includes('--dry-run');

  console.log(`\n=== Cleanup Orphan E2E Test Parties for Tenant ${tenantId} ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE - will delete records'}\n`);

  // Find orphan parties that:
  // 1. Have no linked Contact (contactId is null via the relation)
  // 2. Have no linked Organization
  // 3. Have E2E test email patterns
  const orphanParties = await prisma.party.findMany({
    where: {
      tenantId,
      contact: null,  // No linked contact
      organization: null,  // No linked organization
      OR: [
        { email: { contains: 'e2e_' } },
        { email: { contains: '@test.example.com' } },
      ]
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Found ${orphanParties.length} orphan E2E test parties to delete:\n`);

  if (orphanParties.length === 0) {
    console.log('✓ No orphan E2E test parties found. Database is clean.');
    return;
  }

  // Group by name for summary
  const byName = new Map<string, typeof orphanParties>();
  for (const p of orphanParties) {
    const name = p.name || '(no name)';
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name)!.push(p);
  }

  console.log('Summary by name:');
  for (const [name, list] of byName) {
    console.log(`  - "${name}": ${list.length} orphan parties`);
  }

  console.log('\nParty IDs to delete:');
  const ids = orphanParties.map(p => p.id);
  console.log(`  [${ids.join(', ')}]`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No records deleted.');
    console.log('   Run without --dry-run to actually delete these records.');
    return;
  }

  // These are orphan E2E test parties with no linked contact/organization
  // If there are foreign key constraints, the delete will fail safely
  console.log('\nProceeding with deletion (orphan records with no linked contacts)...\n');

  // Delete the orphan parties
  console.log('Deleting orphan parties...');
  const result = await prisma.party.deleteMany({
    where: { id: { in: ids } }
  });

  console.log(`\n✓ Deleted ${result.count} orphan E2E test parties.`);

  // Verify cleanup
  const remaining = await prisma.party.count({
    where: {
      tenantId,
      contact: null,
      organization: null,
      OR: [
        { email: { contains: 'e2e_' } },
        { email: { contains: '@test.example.com' } },
      ]
    }
  });

  console.log(`\nVerification: ${remaining} orphan E2E test parties remaining.`);

  // Final count
  const totalParties = await prisma.party.count({ where: { tenantId } });
  console.log(`Total parties for tenant ${tenantId}: ${totalParties}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
