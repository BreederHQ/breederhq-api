import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== DEBUGGING TENANT SESSION ISSUE ===\n');

  // Check admin user
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@bhq.local' },
    include: {
      tenantMemberships: {
        include: { tenant: true },
        orderBy: { tenantId: 'asc' }
      }
    }
  });

  if (!admin) {
    console.log('❌ admin@bhq.local not found');
    return;
  }

  console.log('Admin User:');
  console.log(`  ID: ${admin.id}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Default Tenant ID: ${(admin as any).defaultTenantId || 'NOT SET'}`);

  console.log('\nTenant Memberships (ordered by tenantId ASC):');
  admin.tenantMemberships.forEach((m, idx) => {
    const isFirst = idx === 0;
    const isTattooine = m.tenant.slug === 'tattooine';
    const marker = isTattooine ? '⭐' : (isFirst ? '👈 FIRST' : '  ');
    console.log(`  ${marker} [${m.tenantId}] ${m.tenant.name} (${m.tenant.slug}) - ${m.role}`);
  });

  // Check Tattooine tenant data
  console.log('\n=== TATTOOINE TENANT DATA ===');
  const tattooine = await prisma.tenant.findFirst({
    where: { slug: 'tattooine' }
  });

  if (!tattooine) {
    console.log('❌ Tattooine tenant not found!');
    return;
  }

  console.log(`\nTattooine Tenant ID: ${tattooine.id}`);

  const contactCount = await prisma.contact.count({
    where: { tenantId: tattooine.id, archived: false }
  });

  const orgCount = await prisma.organization.count({
    where: { tenantId: tattooine.id, archived: false }
  });

  console.log(`Contacts (not archived): ${contactCount}`);
  console.log(`Organizations (not archived): ${orgCount}`);

  // Check all tenants
  console.log('\n=== ALL TENANTS ===');
  const allTenants = await prisma.tenant.findMany({
    orderBy: { id: 'asc' }
  });

  for (const t of allTenants) {
    const contacts = await prisma.contact.count({ where: { tenantId: t.id, archived: false } });
    const orgs = await prisma.organization.count({ where: { tenantId: t.id, archived: false } });
    console.log(`[${t.id}] ${t.name} (${t.slug || 'no-slug'}): ${contacts} contacts, ${orgs} orgs`);
  }

  console.log('\n=== EXPECTED BEHAVIOR ===');
  console.log(`When admin@bhq.local logs in:`);
  console.log(`1. System checks defaultTenantId: ${(admin as any).defaultTenantId}`);
  console.log(`2. If not set, uses first membership by tenantId ASC: ${admin.tenantMemberships[0]?.tenantId}`);
  console.log(`3. Session cookie (bhq_s) should contain: tenantId: ${(admin as any).defaultTenantId || admin.tenantMemberships[0]?.tenantId}`);
  console.log(`4. All API calls include header: x-tenant-id: ${(admin as any).defaultTenantId || admin.tenantMemberships[0]?.tenantId}`);

  if ((admin as any).defaultTenantId === tattooine.id) {
    console.log('\n✅ defaultTenantId is set correctly to Tattooine');
  } else {
    console.log('\n⚠️  defaultTenantId is NOT set to Tattooine!');
    console.log(`   Expected: ${tattooine.id}`);
    console.log(`   Actual: ${(admin as any).defaultTenantId}`);
  }

  console.log('\n💡 NEXT STEPS:');
  console.log('1. Did you logout and login again after the fix?');
  console.log('2. Check browser DevTools > Network tab > /api/v1/contacts request');
  console.log('3. Look at Request Headers - what is x-tenant-id value?');
  console.log('4. Check browser DevTools > Application > Cookies > bhq_s');
  console.log('5. Decode the JWT - does it contain tenantId: 78?');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
