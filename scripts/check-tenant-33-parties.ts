import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || undefined,
    },
  },
});

async function checkTenant33() {
  try {
    // Find all parties in tenant 33
    const parties = await prisma.party.findMany({
      where: { tenantId: 33 },
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`Found ${parties.length} parties in tenant 33:\n`);
    parties.forEach((p, idx) => {
      console.log(`[${idx + 1}] Party ${p.id}:`);
      console.log(`    Name: ${p.name}`);
      console.log(`    Email: ${p.email}`);
      console.log(`    Type: ${p.type}`);
      console.log();
    });

    // Find all message threads in tenant 33
    const threads = await prisma.messageThread.findMany({
      where: { tenantId: 33 },
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
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            body: true,
            createdAt: true,
            senderPartyId: true,
          },
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    console.log(`\nFound ${threads.length} message threads in tenant 33:\n`);
    threads.forEach((t, idx) => {
      console.log(`[${idx + 1}] Thread ${t.id}:`);
      console.log(`    Subject: ${t.subject}`);
      console.log(`    Last Message At: ${t.lastMessageAt}`);
      console.log(`    Participants:`);
      t.participants.forEach((p) => {
        console.log(`      - Party ${p.partyId}: ${p.party.name} (${p.party.email}) [${p.party.type}]`);
      });
      if (t.messages[0]) {
        console.log(`    Last Message:`);
        console.log(`      Sender: Party ${t.messages[0].senderPartyId}`);
        console.log(`      Body: ${t.messages[0].body?.substring(0, 50)}...`);
      }
      console.log();
    });
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

checkTenant33();
