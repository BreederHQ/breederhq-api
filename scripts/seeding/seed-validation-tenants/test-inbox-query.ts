// Quick script to test what the inbox query returns
import { PrismaClient } from '@prisma/client';
import '../../../prisma/seed/seed-env-bootstrap';

const prisma = new PrismaClient();

async function main() {
  // Test for Matrix tenant (ID: 93)
  const tenantId = 93;

  console.log(`\nTesting inbox query for tenant ID: ${tenantId}\n`);

  // Get the primary org party (this is what requireMessagingPartyScope returns for STAFF)
  const tenantOrg = await prisma.organization.findFirst({
    where: { tenantId },
    select: { partyId: true, name: true },
  });
  const orgPartyId = tenantOrg?.partyId;
  console.log(`Primary org party: partyId=${orgPartyId} (${tenantOrg?.name})`);

  // Now run the same query as the inbox endpoint
  const threadWhere: any = { tenantId };
  threadWhere.archived = false;

  const threads = await prisma.messageThread.findMany({
    where: threadWhere,
    include: {
      participants: {
        include: { party: { select: { id: true, name: true, type: true } } },
      },
      messages: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: { body: true, createdAt: true, senderPartyId: true },
      },
    },
    orderBy: { lastMessageAt: 'desc' as const },
  });

  console.log(`\nInbox query found ${threads.length} threads:\n`);

  for (const thread of threads) {
    console.log(`Thread ID: ${thread.id}`);
    console.log(`  Subject: ${thread.subject}`);
    console.log(`  Archived: ${thread.archived}`);
    console.log(`  Participants:`);
    for (const p of thread.participants) {
      console.log(`    - partyId=${p.partyId} | ${p.party.name} | type=${p.party.type}`);
    }

    // Check if org is a participant
    const orgParticipant = thread.participants.find(p => p.partyId === orgPartyId);
    console.log(`  Org is participant: ${!!orgParticipant}`);

    // Check for contact participant (type = CONTACT)
    const contactParticipant = thread.participants.find(p => p.party.type === 'CONTACT');
    console.log(`  Contact participant: ${contactParticipant ? contactParticipant.party.name : 'NONE'}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
