// Test marketplace schema permissions
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function testPermissions() {
  try {
    console.log('Testing marketplace schema access...');

    // Try to query marketplace.users table
    const count = await prisma.$queryRaw`SELECT COUNT(*) FROM marketplace.users`;
    console.log('✓ Successfully accessed marketplace.users table');
    console.log('Count:', count);

    // Try findUnique
    const user = await prisma.marketplaceUser.findUnique({
      where: { email: 'nonexistent@test.com' }
    });
    console.log('✓ Successfully used Prisma client for marketplace');

    process.exit(0);
  } catch (error: any) {
    console.error('✗ Permission test failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testPermissions();
