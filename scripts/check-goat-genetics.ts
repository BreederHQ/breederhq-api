import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const luke = await prisma.user.findFirst({ where: { email: 'luke.skywalker@tester.local' } });
  if (!luke) { console.log('Luke not found'); process.exit(1); }

  const membership = await prisma.tenantMembership.findFirst({ where: { userId: luke.id } });
  if (!membership) { console.log('Membership not found'); process.exit(1); }

  const tenantId = membership.tenantId;

  const buttercup = await prisma.animal.findFirst({
    where: { tenantId, name: { contains: 'Buttercup' } },
    include: { genetics: true }
  });

  const thunder = await prisma.animal.findFirst({
    where: { tenantId, name: { contains: 'Thunder' } },
    include: { genetics: true }
  });

  console.log('=== Buttercup (Polled Doe) ===');
  console.log('coatColorData:', JSON.stringify(buttercup?.genetics?.coatColorData, null, 2));
  console.log('physicalTraitsData:', JSON.stringify(buttercup?.genetics?.physicalTraitsData, null, 2));

  console.log('\n=== Thunder (Polled Buck) ===');
  console.log('coatColorData:', JSON.stringify(thunder?.genetics?.coatColorData, null, 2));
  console.log('physicalTraitsData:', JSON.stringify(thunder?.genetics?.physicalTraitsData, null, 2));

  // Check SPECIES_WARNINGS for GOAT
  console.log('\n=== Frontend SPECIES_WARNINGS for GOAT ===');
  console.log('Expected: locus "P", genotype "P/P" for Polled × Polled warning');

  // Look for P locus
  const buttercupPhysical = buttercup?.genetics?.physicalTraitsData as any[];
  const thunderPhysical = thunder?.genetics?.physicalTraitsData as any[];

  const buttercupP = buttercupPhysical?.find((l: any) => l.locus === 'P');
  const thunderP = thunderPhysical?.find((l: any) => l.locus === 'P');

  console.log('\nButtercup P locus:', buttercupP);
  console.log('Thunder P locus:', thunderP);

  await prisma.$disconnect();
}

check();
