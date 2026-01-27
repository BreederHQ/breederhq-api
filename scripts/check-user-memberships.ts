import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkMemberships(email: string) {
  const user = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      email: true,
      defaultTenantId: true,
      tenantMemberships: {
        select: {
          tenantId: true,
          role: true,
        },
        orderBy: { tenantId: "asc" },
      },
    },
  });

  if (!user) {
    console.log(`User not found: ${email}`);
    return;
  }

  console.log("User:", user.email);
  console.log("ID:", user.id);
  console.log("defaultTenantId:", user.defaultTenantId);

  // Check super admin status
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isSuperAdmin: true },
  });
  console.log("isSuperAdmin:", fullUser?.isSuperAdmin ?? false);
  console.log("\nTenant Memberships:");

  if (!user.tenantMemberships || user.tenantMemberships.length === 0) {
    console.log("  (none)");
  } else {
    user.tenantMemberships.forEach((m) => {
      console.log(`  - Tenant ${m.tenantId}: ${m.role}`);
    });
  }

  // Check specifically for tenant 33
  const has33 = user.tenantMemberships?.some((m) => m.tenantId === 33);
  console.log(`\nHas membership to tenant 33? ${has33 ? "YES" : "NO"}`);

  await prisma.$disconnect();
}

const email = process.argv[2] || "ted.prod@afcrichmond.local";
checkMemberships(email);
