/**
 * ONE-TIME: Set primaryEmail on tenants missing it, using the OWNER user's email.
 *
 * Usage:
 *   npx dotenv -e .env.prod.migrate -- tsx scripts/fix-tenant-emails.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { primaryEmail: null },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

  if (tenants.length === 0) {
    console.log("All tenants already have primaryEmail set.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${tenants.length} tenant(s) missing primaryEmail:\n`);

  for (const t of tenants) {
    // Find the OWNER membership for this tenant
    const ownerMembership = await prisma.tenantMembership.findFirst({
      where: { tenantId: t.id, role: "OWNER" },
      select: { userId: true },
    });

    if (!ownerMembership) {
      console.log(`  ⏭️  Tenant ${t.id} ("${t.name}"): no OWNER found — skipping`);
      continue;
    }

    const user = await prisma.user.findUnique({
      where: { id: ownerMembership.userId },
      select: { email: true },
    });

    if (!user?.email) {
      console.log(`  ⏭️  Tenant ${t.id} ("${t.name}"): OWNER has no email — skipping`);
      continue;
    }

    await prisma.tenant.update({
      where: { id: t.id },
      data: { primaryEmail: user.email },
    });
    console.log(`  ✅ Tenant ${t.id} ("${t.name}"): set primaryEmail = ${user.email}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
