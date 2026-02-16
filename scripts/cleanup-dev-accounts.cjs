const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const users = await prisma.marketplaceUser.findMany({
    select: { id: true, email: true },
    orderBy: { email: "asc" },
  });

  // Find .dev accounts that have a .prod counterpart
  const devAccounts = users.filter((u) => u.email.includes(".dev@"));
  const prodEmails = new Set(users.filter((u) => u.email.includes(".prod@")).map((u) => u.email));

  const toDelete = devAccounts.filter((dev) => {
    const prodVersion = dev.email.replace(".dev@", ".prod@");
    return prodEmails.has(prodVersion);
  });

  console.log("Dev accounts to delete (have .prod counterparts):");
  console.log("─".repeat(50));
  toDelete.forEach((u) => console.log(`  ${u.id} | ${u.email}`));
  console.log(`\nTotal to delete: ${toDelete.length}`);

  if (toDelete.length === 0) {
    console.log("Nothing to delete.");
    await prisma.$disconnect();
    return;
  }

  const ids = toDelete.map((u) => u.id);

  // Delete related records first
  await prisma.marketplaceProviderTermsAcceptance.deleteMany({
    where: { userId: { in: ids } },
  });
  await prisma.marketplaceProvider.deleteMany({
    where: { userId: { in: ids } },
  });
  const deleted = await prisma.marketplaceUser.deleteMany({
    where: { id: { in: ids } },
  });

  console.log(`\nDeleted ${deleted.count} dev accounts.`);

  // Show remaining
  const remaining = await prisma.marketplaceUser.findMany({
    select: { id: true, email: true },
    orderBy: { email: "asc" },
  });
  console.log(`\nRemaining accounts (${remaining.length}):`);
  console.log("─".repeat(50));
  remaining.forEach((u) => console.log(`  ${u.id} | ${u.email}`));

  await prisma.$disconnect();
})();
