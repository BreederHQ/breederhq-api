import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find admin user
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@bhq.local' }
  });

  if (!adminUser) {
    console.log('❌ admin@bhq.local not found');
    return;
  }

  // Find Tattooine tenant
  const tatooineTenant = await prisma.tenant.findFirst({
    where: { slug: 'tattooine' }
  });

  if (!tatooineTenant) {
    console.log('❌ Tattooine tenant not found');
    return;
  }

  console.log(`Setting Tattooine tenant as DEFAULT and PRIMARY for admin@bhq.local...\n`);

  // First, unset isDefault and isPrimary from all other memberships
  await prisma.tenantMembership.updateMany({
    where: {
      userId: adminUser.id
    },
    data: {
      isDefault: false,
      isPrimary: false
    }
  });

  console.log('✓ Cleared default/primary flags from other tenants');

  // Set Tattooine as default and primary
  await prisma.tenantMembership.update({
    where: {
      userId_tenantId: {
        userId: adminUser.id,
        tenantId: tatooineTenant.id
      }
    },
    data: {
      isDefault: true,
      isPrimary: true
    }
  });

  console.log('✓ Set Tattooine as DEFAULT and PRIMARY tenant');

  // Verify
  const memberships = await prisma.tenantMembership.findMany({
    where: { userId: adminUser.id },
    include: { tenant: true }
  });

  console.log('\nCurrent memberships for admin@bhq.local:');
  memberships.forEach(m => {
    const flags = [];
    if (m.isPrimary) flags.push('PRIMARY');
    if (m.isDefault) flags.push('DEFAULT');
    const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
    console.log(`  - ${m.tenant.name} (${m.tenant.slug}) - ${m.role}${flagStr}`);
  });

  console.log('\n✅ Done! Now logout and login again to get a fresh session with Tattooine as the active tenant.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
