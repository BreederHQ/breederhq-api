import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function findTenant() {
  // Find Aaron's user account
  const user = await prisma.user.findFirst({
    where: { email: "aaron@breederhq.com" },
    include: {
      defaultTenant: true,
      tenantMemberships: {
        include: { tenant: true },
      },
    },
  });

  if (!user) {
    console.log("❌ No user found for aaron@breederhq.com");
    return;
  }

  console.log(`\n✓ Found user: ${user.email} (ID: ${user.id})`);
  console.log(`  Default Tenant ID: ${user.defaultTenantId}`);
  if (user.defaultTenant) {
    console.log(`  Default Tenant Name: ${user.defaultTenant.name}`);
    console.log(`  Inbound Email Slug: ${user.defaultTenant.inboundEmailSlug || "(none)"}`);
  }
  
  if (user.tenantMemberships.length > 0) {
    console.log(`\n  Tenant Memberships:`);
    user.tenantMemberships.forEach((m) => {
      console.log(`    - Tenant ${m.tenantId}: ${m.tenant.name} (Role: ${m.role})`);
    });
  }

  if (user.defaultTenantId) {
    // Check for threads in this tenant
    const threadCount = await prisma.messageThread.count({
      where: { tenantId: user.defaultTenantId },
    });

    console.log(`\n  Message Threads in Default Tenant: ${threadCount}`);

    if (threadCount > 0) {
      const recentThreads = await prisma.messageThread.findMany({
        where: { tenantId: user.defaultTenantId },
        orderBy: { lastMessageAt: "desc" },
        take: 5,
        select: {
          id: true,
          subject: true,
          type: true,
          lastMessageAt: true,
          messages: { take: 1 },
        },
      });

      console.log(`\n  Recent Threads:`);
      recentThreads.forEach((t) => {
        console.log(`    - Thread ${t.id}: ${t.subject} (Type: ${t.type || "CONVERSATION"})`);
        console.log(`      Messages: ${t.messages.length}, Last: ${t.lastMessageAt}`);
      });
    }
  }

  await prisma.$disconnect();
}

findTenant();
