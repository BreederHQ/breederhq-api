import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      defaultTenantId: true,
      tenantMemberships: {
        select: { tenantId: true, role: true },
        orderBy: { tenantId: "asc" },
      },
    },
  });

  if (!user) {
    console.log(`User not found: ${userId}`);
    return;
  }

  console.log("User found:");
  console.log(JSON.stringify(user, null, 2));

  await prisma.$disconnect();
}

const userId = process.argv[2] || "cmk7sou1y0005gt34cueaw7s2";
checkUser(userId);
