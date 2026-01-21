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

  // Check for tenant memberships
  const memberships = await prisma.tenantMembership.findMany({
    where: { tenantId: tenant.id },
    include: { user: true }
  });

  console.log('\nTenant Memberships:', memberships.length);
  if (memberships.length === 0) {
    console.log('⚠️  NO USERS have access to the Tattooine tenant!');
    console.log('You need to create a user and grant them access to this tenant.');
  } else {
    memberships.forEach(m => {
      console.log(`- ${m.user.email} (role: ${m.role})`);
    });
  }

  // Check all users to see who could be added
  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true }
  });

  console.log('\nAll users in database:', allUsers.length);
  allUsers.forEach(u => {
    console.log(`- ${u.email} (${u.firstName} ${u.lastName})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
