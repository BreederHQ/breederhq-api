import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testPickTenantIdForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      defaultTenantId: true,
      tenantMemberships: {
        select: { tenantId: true },
        orderBy: { tenantId: "asc" }
      },
    },
  });

  console.log("User query result:");
  console.log(JSON.stringify(user, null, 2));

  if (!user) {
    console.log("\n❌ User not found");
    return;
  }

  // Simulate pickTenantIdForUser logic
  if (typeof user.defaultTenantId === "number" && user.defaultTenantId > 0) {
    console.log(`\n✅ Would return defaultTenantId: ${user.defaultTenantId}`);
    return user.defaultTenantId;
  }

  const first = Array.isArray(user.tenantMemberships)
    ? user.tenantMemberships[0]?.tenantId
    : undefined;

  console.log(`\n✅ Would return first membership: ${first ?? "undefined"}`);
  return first ?? undefined;
}

const email = process.argv[2] || "ted.prod@afcrichmond.local";

async function main() {
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    console.log(`User not found: ${email}`);
    return;
  }

  console.log(`Testing pickTenantIdForUser for: ${user.email} (${user.id})\n`);
  await testPickTenantIdForUser(user.id);
  await prisma.$disconnect();
}

main();
