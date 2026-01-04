import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get Tattooine tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'tattooine' }
  });

  if (!tenant) {
    console.log('❌ Tattooine tenant not found');
    return;
  }

  console.log(`✓ Tattooine Tenant ID: ${tenant.id}`);

  // Simulate what the API route does
  const tenantId = tenant.id;
  const includeArchived = false;

  const where: any = { tenantId };
  if (!includeArchived) where.archived = false;

  console.log('\nQuery where clause:', JSON.stringify(where, null, 2));

  // Get contacts (exactly as API does)
  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          archived: true,
          party: { select: { name: true, archived: true } }
        }
      },
      party: {
        select: {
          name: true,
          email: true,
          phoneE164: true,
          whatsappE164: true,
          street: true,
          street2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true
        }
      }
    }
  });

  console.log(`\n✓ Found ${contacts.length} contacts`);

  if (contacts.length === 0) {
    console.log('\n⚠️  No contacts found! This suggests:');
    console.log('   1. Contacts were not created');
    console.log('   2. Contacts have wrong tenantId');
    console.log('   3. All contacts are archived');
  } else {
    console.log('\nContacts:');
    contacts.forEach(c => {
      console.log(`  - ${c.display_name} (ID: ${c.id}, tenantId: ${c.tenantId}, archived: ${c.archived})`);
      console.log(`    Email: ${c.email}`);
      console.log(`    Org: ${c.organization?.name || 'none'}`);
      console.log(`    Has Party: ${c.partyId ? 'yes' : 'no'}`);
    });
  }

  // Check organizations too
  const orgs = await prisma.organization.findMany({
    where: { tenantId, archived: false },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`\n✓ Found ${orgs.length} organizations`);
  orgs.forEach(o => {
    console.log(`  - ${o.name} (ID: ${o.id})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
