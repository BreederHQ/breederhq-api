// Script to promote a user to admin
// Usage: npx tsx scripts/promote-admin.ts <email>

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: npx tsx scripts/promote-admin.ts <email>");
    process.exit(1);
  }

  const user = await prisma.marketplaceUser.findUnique({
    where: { email },
    select: { id: true, email: true, userType: true },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  if (user.userType === "admin") {
    console.log(`User ${email} is already an admin`);
    process.exit(0);
  }

  await prisma.marketplaceUser.update({
    where: { email },
    data: { userType: "admin" },
  });

  console.log(`User ${email} promoted to admin`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
