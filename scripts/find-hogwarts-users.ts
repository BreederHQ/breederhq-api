// scripts/find-hogwarts-users.ts
// Find all users with hogwarts in their email
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find users with hogwarts in email
  const users = await prisma.user.findMany({
    where: {
      email: { contains: "hogwarts", mode: "insensitive" },
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  console.log("\n📧 Users with 'hogwarts' in email:\n");
  users.forEach((u) => console.log(`  - ${u.email} (${u.firstName} ${u.lastName})`));

  // Also find any provider profiles
  console.log("\n🏪 Provider profiles:\n");
  const providers = await prisma.mktServiceProviderProfile.findMany({
    include: { user: { select: { email: true } } },
  });
  providers.forEach((p) => console.log(`  - [${p.id}] ${p.businessName} (user: ${p.user?.email || p.userId})`));

  // And listings
  console.log("\n📝 Service listings:\n");
  const listings = await prisma.mktListingBreederService.findMany({
    where: { sourceType: "PROVIDER" },
    select: { id: true, title: true, providerId: true, status: true },
  });
  listings.forEach((l) => console.log(`  - [${l.id}] ${l.title} (provider: ${l.providerId}, status: ${l.status})`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
