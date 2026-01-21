/**
 * Check specific group
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  const group = await prisma.offspringGroup.findUnique({
    where: { id: 410 },
    select: { id: true, name: true, planId: true },
  });

  console.log('Group 410:', group);
  console.log('Name type:', typeof group?.name);
  console.log('Name value:', JSON.stringify(group?.name));
  console.log('Name === null:', group?.name === null);
  console.log('Name === "null":', group?.name === "null");

  await prisma.$disconnect();
})();
