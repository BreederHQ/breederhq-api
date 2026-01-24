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

  console.log(`Current admin user:`);
  console.log(`  ID: ${adminUser.id}`);
  console.log(`  Email: ${adminUser.email}`);
  console.log(`  Default Tenant ID: ${(adminUser as any).defaultTenantId || 'NOT SET'}`);

  // Find Tattooine tenant
  const tatooineTenant = await prisma.tenant.findFirst({
    where: { slug: 'tattooine' }
  });

  if (!tatooineTenant) {
    console.log('❌ Tattooine tenant not found');
    return;
  }

  console.log(`\nTattooine tenant ID: ${tatooineTenant.id}`);

  // Update user's default tenant
  console.log(`\nSetting defaultTenantId to ${tatooineTenant.id}...`);

  try {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        // @ts-ignore - defaultTenantId might not be in types
        defaultTenantId: tatooineTenant.id
      } as any
    });

    console.log('✅ Updated successfully!');

    // Verify
    const updated = await prisma.user.findFirst({
      where: { id: adminUser.id }
    });

    console.log(`\nVerification:`);
    console.log(`  Default Tenant ID: ${(updated as any).defaultTenantId}`);

    console.log(`\n💡 Now logout and login again as admin@bhq.local`);
    console.log(`   The session will automatically use Tattooine tenant (ID: ${tatooineTenant.id})`);
  } catch (error: any) {
    if (error.code === 'P2025') {
      console.log('⚠️  defaultTenantId column does not exist in the User table');
      console.log('   The system will use the first membership (ordered by tenantId)');
    } else {
      throw error;
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
