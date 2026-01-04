import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== USER & TENANT MEMBERSHIPS ===\n');

  // Get all users
  const users = await prisma.user.findMany({
    include: {
      tenantMemberships: {
        include: {
          tenant: true
        }
      }
    }
  });

  for (const user of users) {
    console.log(`\n📧 ${user.email} (ID: ${user.id})`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);

    if (user.tenantMemberships.length === 0) {
      console.log('   ⚠️  NO TENANT ACCESS');
    } else {
      console.log(`   Tenant Access (${user.tenantMemberships.length}):`);
      user.tenantMemberships.forEach(m => {
        const marker = m.tenant.slug === 'tattooine' ? '⭐' : '  ';
        console.log(`   ${marker} ${m.tenant.name} (${m.tenant.slug}) - Role: ${m.role}${m.isPrimary ? ' [PRIMARY]' : ''}${m.isDefault ? ' [DEFAULT]' : ''}`);
      });
    }
  }

  console.log('\n\n=== TATTOOINE TENANT ACCESS ===\n');

  const tatooineTenant = await prisma.tenant.findFirst({
    where: { slug: 'tattooine' },
    include: {
      memberships: {
        include: {
          user: true
        }
      }
    }
  });

  if (!tatooineTenant) {
    console.log('❌ Tattooine tenant not found');
    return;
  }

  console.log(`Tenant: ${tatooineTenant.name} (ID: ${tatooineTenant.id})`);
  console.log(`Users with access: ${tatooineTenant.memberships.length}\n`);

  if (tatooineTenant.memberships.length === 0) {
    console.log('⚠️  NO USERS can access Tattooine tenant!');
  } else {
    tatooineTenant.memberships.forEach(m => {
      console.log(`  ✓ ${m.user.email} - ${m.role}${m.isPrimary ? ' [PRIMARY]' : ''}${m.isDefault ? ' [DEFAULT]' : ''}`);
    });
  }

  console.log('\n\n💡 TIPS:');
  console.log('   1. Login as a user who has Tattooine tenant access');
  console.log('   2. If multiple tenants, make sure you switch to Tattooine');
  console.log('   3. Check browser DevTools > Application > Cookies > bhq_s');
  console.log('   4. The JWT in the cookie should contain tenantId: 78');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
