// scripts/reset-test-passwords.mjs
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const password1 = 'Marketplace2026!';
const password2 = 'NoMarket2026!';

async function main() {
  console.log('🔐 Resetting test user passwords...\n');

  const hash1 = await bcrypt.hash(password1, 12);
  const hash2 = await bcrypt.hash(password2, 12);

  // Update marketplace-access
  await prisma.user.update({
    where: { email: 'marketplace-access@bhq.local' },
    data: {
      passwordHash: hash1,
      lastPasswordChangeAt: new Date(),
      passwordSetAt: new Date(),
    },
  });
  console.log('✅ Updated marketplace-access@bhq.local');

  // Update no-marketplace-access
  await prisma.user.update({
    where: { email: 'no-marketplace-access@bhq.local' },
    data: {
      passwordHash: hash2,
      lastPasswordChangeAt: new Date(),
      passwordSetAt: new Date(),
    },
  });
  console.log('✅ Updated no-marketplace-access@bhq.local');

  // Verify passwords
  console.log('\n🔍 Verifying passwords...');
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: ['marketplace-access@bhq.local', 'no-marketplace-access@bhq.local'],
      },
    },
    select: {
      email: true,
      passwordHash: true,
    },
    orderBy: { email: 'asc' },
  });

  for (const user of users) {
    const testPassword = user.email === 'marketplace-access@bhq.local' ? password1 : password2;
    const matches = await bcrypt.compare(testPassword, user.passwordHash);
    console.log(`  ${user.email}: ${matches ? '✓ Valid' : '✗ Invalid'}`);
  }

  console.log('\n✨ Password reset complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
