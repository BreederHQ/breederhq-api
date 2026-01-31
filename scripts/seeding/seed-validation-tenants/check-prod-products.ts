import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const products = await prisma.product.findMany({ include: { entitlements: true } });
  console.log('PROD Products:', products.length);
  for (const p of products) {
    console.log(`\n${p.id}: ${p.name} (${p.type}) - $${p.priceUSD / 100}`);
    for (const e of p.entitlements) {
      console.log(`  - ${e.entitlementKey}: ${e.limitValue ?? 'unlimited'}`);
    }
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
