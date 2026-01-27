import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function checkPartyName() {
  try {
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
        type: true,
        tenantId: true,
      },
    });

    if (!party) {
      console.log("No party found with email aaron@breederhq.com in tenant 33");
      return;
    }

    console.log("Party found:");
    console.log(JSON.stringify(party, null, 2));

    // Check the message thread
    const thread = await prisma.messageThread.findFirst({
      where: { tenantId: 33 },
      orderBy: { lastMessageAt: "desc" },
      include: {
        participants: {
          include: {
            party: {
              select: {
                id: true,
                name: true,
                email: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (thread) {
      console.log("\nMost recent thread:");
      console.log("Thread ID:", thread.id);
      console.log("Subject:", thread.subject);
      console.log("\nParticipants:");
      thread.participants.forEach((p) => {
        console.log(`  - Party ${p.partyId}:`);
        console.log(`    Name: ${p.party.name}`);
        console.log(`    Email: ${p.party.email}`);
        console.log(`    Type: ${p.party.type}`);
      });
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

checkPartyName();
