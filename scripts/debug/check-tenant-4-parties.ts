import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = 4;

  console.log(`\n=== Checking ALL parties for Tenant ID ${tenantId} ===\n`);

  // Get all parties for tenant 4
  const parties = await prisma.party.findMany({
    where: { tenantId },
    orderBy: [
      { name: 'asc' },
      { createdAt: 'desc' }
    ],
    include: {
      contact: {
        select: {
          id: true,
          display_name: true
        }
      },
      organization: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  console.log(`Total parties found: ${parties.length}\n`);

  if (parties.length === 0) {
    console.log('No parties found for tenant 4');
    return;
  }

  // Print all parties
  console.log('=== Full Party List ===\n');
  console.log('ID\t| Name\t\t\t\t| Type\t\t| Email\t\t\t\t\t| Archived\t| Contact ID\t| Org ID');
  console.log('-'.repeat(150));

  for (const p of parties) {
    const name = (p.name || '(no name)').padEnd(24);
    const type = (p.type || '-').padEnd(10);
    const email = (p.email || '-').padEnd(36);
    const archived = p.archived ? 'Yes' : 'No';
    const contactId = p.contact?.id || '-';
    const orgId = p.organization?.id || '-';

    console.log(`${p.id}\t| ${name}\t| ${type}\t| ${email}\t| ${archived}\t\t| ${contactId}\t\t| ${orgId}`);
  }

  // Group by name to find duplicates
  const byName = new Map<string, typeof parties>();
  for (const p of parties) {
    const name = p.name || '(no name)';
    if (!byName.has(name)) {
      byName.set(name, []);
    }
    byName.get(name)!.push(p);
  }

  const duplicates = [...byName.entries()].filter(([_, list]) => list.length > 1);

  if (duplicates.length > 0) {
    console.log('\n\n=== DUPLICATE PARTY NAMES DETECTED ===\n');
    for (const [name, list] of duplicates) {
      console.log(`"${name}" appears ${list.length} times:`);
      for (const p of list) {
        console.log(`  - ID: ${p.id}, Type: ${p.type}, Email: ${p.email || '-'}, Archived: ${p.archived}, ContactId: ${p.contact?.id || '-'}, OrgId: ${p.organization?.id || '-'}`);
      }
      console.log('');
    }
  } else {
    console.log('\n✓ No duplicate party names detected');
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Total parties: ${parties.length}`);
  console.log(`Unique names: ${byName.size}`);
  console.log(`Duplicate name groups: ${duplicates.length}`);
  console.log(`Archived: ${parties.filter(p => p.archived).length}`);
  console.log(`Active: ${parties.filter(p => !p.archived).length}`);

  // Check specifically for "Alice Smith"
  const aliceParties = parties.filter(p => p.name?.toLowerCase().includes('alice'));
  if (aliceParties.length > 0) {
    console.log('\n=== Parties with "Alice" in name ===');
    for (const p of aliceParties) {
      console.log(`  ID: ${p.id}, Name: "${p.name}", Type: ${p.type}, Email: ${p.email}, Archived: ${p.archived}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
