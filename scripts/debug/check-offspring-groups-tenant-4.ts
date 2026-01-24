/**
 * Check what offspring groups exist in tenant 4
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  const groups = await prisma.offspringGroup.findMany({
    where: { tenantId: 4 },
    select: { id: true, name: true, planId: true },
    orderBy: { id: 'asc' },
  });

  console.log(`Total offspring groups in tenant 4: ${groups.length}\n`);
  groups.forEach(g => console.log(`  ID ${g.id}: "${g.name}" (planId: ${g.planId})`));

  await prisma.$disconnect();
})();
