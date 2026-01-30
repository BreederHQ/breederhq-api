import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function checkMessages() {
  const tenantId = 33;

  // Get recent messages from tenant 33
  const recentThreads = await prisma.messageThread.findMany({
    where: { tenantId },
    orderBy: { lastMessageAt: "desc" },
    take: 5,
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          senderParty: {
            select: { id: true, name: true, email: true, type: true },
          },
        },
      },
    },
  });

  console.log(`\n=== Recent ${recentThreads.length} threads for tenant 33 ===\n`);

  recentThreads.forEach((thread, idx) => {
    console.log(`[${idx + 1}] Thread ${thread.id}:`);
    console.log(`    Subject: ${thread.subject}`);
    console.log(`    Type: ${thread.type || "CONVERSATION"}`);
    console.log(`    Guest: ${thread.guestName} <${thread.guestEmail}>`);
    console.log(`    Spam Score: ${thread.spamScore}`);
    console.log(`    Messages: ${thread.messages.length}`);
    
    thread.messages.forEach((msg, msgIdx) => {
      console.log(`      [${msgIdx + 1}] From: ${msg.senderParty?.name || msg.senderParty?.email} (${msg.senderParty?.type})`);
      console.log(`          Body length: ${msg.body?.length || 0}`);
      console.log(`          Body preview: ${msg.body?.substring(0, 100) || "(empty)"}`);
      console.log(`          Automated: ${msg.isAutomated}`);
    });
    console.log();
  });

  await prisma.$disconnect();
}

checkMessages();
