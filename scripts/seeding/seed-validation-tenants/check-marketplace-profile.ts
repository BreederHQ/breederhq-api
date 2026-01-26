import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Check marketplace-profile settings for all tenants
  const settings = await prisma.tenantSetting.findMany({
    where: { namespace: 'marketplace-profile' },
    include: {
      tenant: { select: { slug: true, name: true } }
    }
  });

  console.log('TenantSettings with marketplace-profile namespace:', settings.length);
  for (const s of settings) {
    const data = s.data as any;
    const hasPublished = data && data.published;
    const businessName = hasPublished ? data.published.businessName : null;
    console.log(`  ${s.tenant.slug} | published: ${hasPublished ? 'YES' : 'NO'} | businessName: ${businessName || 'NONE'}`);
  }

  // Check validation tenants specifically
  console.log('\n--- Validation Tenants ---');
  const validationTenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { slug: { startsWith: 'dev-' } },
        { slug: { startsWith: 'prod-' } }
      ]
    },
    select: { id: true, slug: true }
  });

  for (const t of validationTenants) {
    const setting = await prisma.tenantSetting.findUnique({
      where: {
        tenantId_namespace: {
          tenantId: t.id,
          namespace: 'marketplace-profile'
        }
      }
    });
    console.log(`  ${t.slug} | has marketplace-profile: ${setting ? 'YES' : 'NO'}`);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
