/**
 * Cleanup script for partial breeding program names
 *
 * Bug: The breeding program form was saving on every keystroke, creating
 * multiple database records for partial names (e.g., "O", "Ou", "Our", "Our ", etc.)
 *
 * This script:
 * 1. Finds all mktListingBreedingProgram records for the tenant
 * 2. Identifies partial-name duplicates (names that are prefixes of other names)
 * 3. Deletes the partial duplicates (keeps only the longest/full name)
 *
 * Usage:
 *   npx ts-node scripts/cleanup/cleanup-partial-breeding-programs.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Ted Lasso tenant slug - Richmond is the football club
const TENANT_SLUG = 'prod-richmond';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n========================================');
  console.log('Cleanup Partial Breeding Program Names');
  console.log('========================================\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Find the tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: TENANT_SLUG },
    select: { id: true, name: true, slug: true }
  });

  if (!tenant) {
    console.error(`❌ Tenant not found: ${TENANT_SLUG}`);
    console.log('\nAvailable tenants with mktListingBreedingProgram records:');
    const tenantsWithPrograms = await prisma.mktListingBreedingProgram.groupBy({
      by: ['tenantId'],
      _count: true
    });
    for (const t of tenantsWithPrograms) {
      const tenantInfo = await prisma.tenant.findUnique({
        where: { id: t.tenantId },
        select: { name: true, slug: true }
      });
      console.log(`  - Tenant ${t.tenantId}: ${tenantInfo?.name} (${tenantInfo?.slug}) - ${t._count} programs`);
    }
    await prisma.$disconnect();
    return;
  }

  console.log(`📍 Tenant: ${tenant.name} (ID: ${tenant.id}, slug: ${tenant.slug})\n`);

  // Get all breeding programs for this tenant
  const programs = await prisma.mktListingBreedingProgram.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true, species: true, createdAt: true }
  });

  console.log(`Found ${programs.length} breeding program(s):\n`);

  programs.forEach((p, i) => {
    console.log(`  ${i + 1}. [${p.id}] "${p.name}" (slug: ${p.slug}, species: ${p.species})`);
  });

  if (programs.length === 0) {
    console.log('\n✓ No programs found - nothing to clean up\n');
    await prisma.$disconnect();
    return;
  }

  // Find partial duplicates: names that are prefixes of other names
  const toDelete: typeof programs = [];
  const toKeep: typeof programs = [];

  for (const program of programs) {
    const name = program.name.toLowerCase();

    // Check if any other program's name starts with this program's name (and is longer)
    const isPrefix = programs.some(other => {
      const otherName = other.name.toLowerCase();
      return other.id !== program.id &&
             otherName.startsWith(name) &&
             otherName.length > name.length;
    });

    if (isPrefix) {
      toDelete.push(program);
    } else {
      toKeep.push(program);
    }
  }

  console.log('\n----------------------------------------');
  console.log('Analysis Results:');
  console.log('----------------------------------------\n');

  if (toDelete.length === 0) {
    console.log('✓ No partial-name duplicates found!\n');
    await prisma.$disconnect();
    return;
  }

  console.log(`🗑️  Programs to DELETE (${toDelete.length}):`);
  toDelete.forEach(p => {
    console.log(`     - [${p.id}] "${p.name}"`);
  });

  console.log(`\n✓ Programs to KEEP (${toKeep.length}):`);
  toKeep.forEach(p => {
    console.log(`     - [${p.id}] "${p.name}"`);
  });

  if (isDryRun) {
    console.log('\n🔍 DRY RUN - No changes made. Run without --dry-run to delete.\n');
    await prisma.$disconnect();
    return;
  }

  // Actually delete
  console.log('\n⏳ Deleting partial duplicates...\n');

  const deleteIds = toDelete.map(p => p.id);
  const result = await prisma.mktListingBreedingProgram.deleteMany({
    where: { id: { in: deleteIds } }
  });

  console.log(`✓ Deleted ${result.count} partial-name duplicate(s)\n`);

  // Show remaining
  const remaining = await prisma.mktListingBreedingProgram.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true, species: true }
  });

  console.log(`Remaining programs (${remaining.length}):`);
  remaining.forEach(p => {
    console.log(`  - [${p.id}] "${p.name}" (${p.species})`);
  });
  console.log('');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
