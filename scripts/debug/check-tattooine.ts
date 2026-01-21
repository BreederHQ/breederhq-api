import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'tattooine' }
  });

  console.log('Tenant:', tenant);

  if (!tenant) {
    console.log('No Tattooine tenant found');
    return;
  }

  const contacts = await prisma.contact.findMany({
    where: { tenantId: tenant.id },
    include: { organization: true }
  });

  console.log('\nContacts found:', contacts.length);
  contacts.forEach(c => {
    console.log(`- ${c.display_name} (ID: ${c.id}, tenantId: ${c.tenantId}, org: ${c.organization?.name || 'none'})`);
  });

  const orgs = await prisma.organization.findMany({
    where: { tenantId: tenant.id }
  });

  console.log('\nOrganizations found:', orgs.length);
  orgs.forEach(o => {
    console.log(`- ${o.name} (ID: ${o.id}, tenantId: ${o.tenantId})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
