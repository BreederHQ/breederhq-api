import prisma from "./src/prisma.js";

async function main() {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  console.log(`Found ${notifications.length} notifications:\n`);

  notifications.forEach((n, idx) => {
    console.log(`${idx + 1}. [${n.priority}] ${n.type}`);
    console.log(`   Title: ${n.title}`);
    console.log(`   Status: ${n.status}`);
    console.log(`   Tenant: ${n.tenantId}`);
    console.log(`   Created: ${n.createdAt}`);
    console.log(`   Idempotency Key: ${n.idempotencyKey}`);
    console.log();
  });
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
