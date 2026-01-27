import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkRecentMessages() {
  // Get the most recent message thread for tenant 33
  const thread = await prisma.messageThread.findFirst({
    where: { tenantId: 33 },
    orderBy: { lastMessageAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          senderParty: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      participants: {
        include: {
          party: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!thread) {
    console.log("No threads found for tenant 33");
    return;
  }

  console.log("Most Recent Thread:");
  console.log("  ID:", thread.id);
  console.log("  Subject:", thread.subject);
  console.log("  Last Message At:", thread.lastMessageAt);
  console.log("\nParticipants:");
  thread.participants.forEach((p) => {
    console.log(`  - Party ${p.partyId}:`, {
      name: p.party.name,
      email: p.party.email,
      firstName: p.party.firstName,
      lastName: p.party.lastName,
    });
  });

  console.log("\nMost Recent Message:");
  if (thread.messages[0]) {
    const msg = thread.messages[0];
    console.log("  Sender Party:", {
      id: msg.senderParty?.id,
      name: msg.senderParty?.name,
      email: msg.senderParty?.email,
      firstName: msg.senderParty?.firstName,
      lastName: msg.senderParty?.lastName,
    });
    console.log("  Body:", msg.body?.substring(0, 100));
  }

  await prisma.$disconnect();
}

checkRecentMessages();
