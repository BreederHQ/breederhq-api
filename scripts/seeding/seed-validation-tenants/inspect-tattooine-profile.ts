import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const setting = await prisma.tenantSetting.findFirst({
    where: {
      namespace: 'marketplace-profile',
      tenant: { slug: 'tattoine-cuddly-buggers' }
    }
  });

  if (setting) {
    console.log('Tattooine marketplace-profile data:');
    console.log(JSON.stringify(setting.data, null, 2));
  } else {
    console.log('No marketplace-profile found for Tattooine');
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
