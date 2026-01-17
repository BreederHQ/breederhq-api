import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'luke.skywalker@tester.local' },
    select: { email: true, firstName: true, lastName: true, passwordHash: true }
  });
  
  console.log('User:', user.email);
  console.log('Password hash exists:', !!user.passwordHash);
  console.log('\nNOTE: You need to check the seed script to find the password, or reset it.');
}

main().finally(() => prisma.$disconnect());
