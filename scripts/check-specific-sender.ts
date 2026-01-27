import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkSender() {
  // Find party with email aaron@breederhq.com in tenant 33
  const party = await prisma.party.findFirst({
    where: {
      tenantId: 33,
      email: { equals: "aaron@breederhq.com", mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      email: true,
      tenantId: true,
    },
  });

  if (!party) {
    console.log("No party found with email aaron@breederhq.com");
    return;
  }

  console.log("Party found:");
  console.log(JSON.stringify(party, null, 2));

  // Find recent messages from this party
  const messages = await prisma.message.findMany({
    where: { senderPartyId: party.id },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: {
      thread: {
        select: { id: true, subject: true },
      },
    },
  });

  console.log(`\nRecent messages (${messages.length}):`);
  messages.forEach((m) => {
    console.log(`  - Thread ${m.threadId}: ${m.body?.substring(0, 50)}...`);
    console.log(`    Created: ${m.createdAt}`);
  });

  await prisma.$disconnect();
}

checkSender();
