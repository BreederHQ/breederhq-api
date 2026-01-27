import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkLatestThreads() {
  try {
    const tenantId = 33;

    // Find all message threads in tenant 33
    const threads = await prisma.messageThread.findMany({
      where: { tenantId },
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
            id: true,
            body: true,
            createdAt: true,
            senderPartyId: true,
          },
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 5,
    });

    console.log(`Found ${threads.length} message threads in tenant 33:\n`);

    threads.forEach((thread, idx) => {
      console.log(`[${idx + 1}] Thread ${thread.id}:`);
      console.log(`    Subject: ${thread.subject}`);
      console.log(`    Guest: ${thread.guestName} <${thread.guestEmail}>`);
      console.log(`    Last Message: ${thread.lastMessageAt}`);
      console.log(`    Participants:`);
      thread.participants.forEach((p) => {
        console.log(`      - ${p.party.name} <${p.party.email}> [${p.party.type}]`);
      });
      if (thread.messages[0]) {
        const msg = thread.messages[0];
        console.log(`    Latest Message:`);
        console.log(`      ID: ${msg.id}`);
        console.log(`      Sender Party: ${msg.senderPartyId}`);
        console.log(`      Created: ${msg.createdAt}`);
        console.log(`      Body: ${msg.body?.substring(0, 60)}...`);
      }
      console.log();
    });

    // Check for UnlinkedEmail records
    const unlinkedEmails = await prisma.unlinkedEmail.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        fromAddress: true,
        toAddresses: true,
        subject: true,
        createdAt: true,
        sentAt: true,
      },
    });

    console.log(`\nFound ${unlinkedEmails.length} unlinked emails in tenant 33:\n`);
    unlinkedEmails.forEach((email, idx) => {
      console.log(`[${idx + 1}] UnlinkedEmail ${email.id}:`);
      console.log(`    From: ${email.fromAddress}`);
      console.log(`    To: ${email.toAddresses.join(", ")}`);
      console.log(`    Subject: ${email.subject}`);
      console.log(`    Created: ${email.createdAt}`);
      console.log(`    Sent: ${email.sentAt}`);
      console.log();
    });
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatestThreads();
