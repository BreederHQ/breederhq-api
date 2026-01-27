import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = 4;

  console.log(`\n=== Checking contacts for Tenant ID ${tenantId} ===\n`);

  // Get all contacts (including archived) for tenant 4
  const contacts = await prisma.contact.findMany({
    where: { tenantId },
    orderBy: [
      { display_name: 'asc' },
      { createdAt: 'desc' }
    ],
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          archived: true
        }
      },
      party: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  console.log(`Total contacts found: ${contacts.length}\n`);

  if (contacts.length === 0) {
    console.log('No contacts found for tenant 4');
    return;
  }

  // Group by display_name to find duplicates
  const byName = new Map<string, typeof contacts>();
  for (const c of contacts) {
    const name = c.display_name || '(no name)';
    if (!byName.has(name)) {
      byName.set(name, []);
    }
    byName.get(name)!.push(c);
  }

  // Print all contacts with duplicate indicators
  console.log('=== Full Contact List ===\n');
  console.log('ID\t| Name\t\t\t\t| Email\t\t\t\t| Org\t\t\t| Archived\t| Party ID\t| Created');
  console.log('-'.repeat(150));

  for (const c of contacts) {
    const name = (c.display_name || '(no name)').padEnd(24);
    const email = (c.email || '-').padEnd(28);
    const org = (c.organization?.name || '-').padEnd(16);
    const archived = c.archived ? 'Yes' : 'No';
    const partyId = c.partyId || '-';
    const created = c.createdAt.toISOString().split('T')[0];

    console.log(`${c.id}\t| ${name}\t| ${email}\t| ${org}\t| ${archived}\t\t| ${partyId}\t\t| ${created}`);
  }

  // Check for duplicates
  const duplicates = [...byName.entries()].filter(([_, list]) => list.length > 1);

  if (duplicates.length > 0) {
    console.log('\n\n=== DUPLICATE NAMES DETECTED ===\n');
    for (const [name, list] of duplicates) {
      console.log(`"${name}" appears ${list.length} times:`);
      for (const c of list) {
        console.log(`  - ID: ${c.id}, Email: ${c.email || '-'}, Org: ${c.organization?.name || '-'}, Archived: ${c.archived}, PartyId: ${c.partyId || '-'}`);
      }
      console.log('');
    }
  } else {
    console.log('\n✓ No duplicate names detected');
  }

  // Summary stats
  console.log('\n=== Summary ===');
  console.log(`Total contacts: ${contacts.length}`);
  console.log(`Unique names: ${byName.size}`);
  console.log(`Duplicate name groups: ${duplicates.length}`);
  console.log(`Archived contacts: ${contacts.filter(c => c.archived).length}`);
  console.log(`Active contacts: ${contacts.filter(c => !c.archived).length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
