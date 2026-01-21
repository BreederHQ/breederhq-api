// Simulates exactly what /api/v1/communications/inbox returns for tenant 93
import { PrismaClient } from '@prisma/client';
import '../../prisma/seed/seed-env-bootstrap';

const prisma = new PrismaClient();

type CommunicationItem = {
  id: string;
  type: 'email' | 'dm' | 'draft';
  partyId: number | null;
  partyName: string | null;
  toEmail?: string | null;
  subject: string | null;
  preview: string;
  isRead: boolean;
  flagged: boolean;
  archived: boolean;
  channel: 'email' | 'dm';
  direction?: 'inbound' | 'outbound';
  createdAt: string;
  updatedAt: string;
};

async function main() {
  const tenantId = 93; // Matrix
  const status = 'all';
  const channel = 'all';

  const items: CommunicationItem[] = [];

  // Get the org party for determining read status on threads
  const tenantOrg = await prisma.organization.findFirst({
    where: { tenantId },
    select: { partyId: true, name: true },
  });
  const orgPartyId = tenantOrg?.partyId;

  console.log(`\nTenant ID: ${tenantId}`);
  console.log(`Org Party: ${orgPartyId} (${tenantOrg?.name})`);
  console.log(`Status filter: ${status}`);
  console.log(`Channel filter: ${channel}\n`);

  // === Fetch DM Threads ===
  console.log('=== Fetching DM Threads ===');
  if ((channel === 'all' || channel === 'dm') && status !== 'draft') {
    const threadWhere: any = { tenantId };
    if (status === 'archived') {
      threadWhere.archived = true;
    } else if (status !== 'all') {
      threadWhere.archived = false;
    }

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

    console.log(`Found ${threads.length} threads`);

    for (const thread of threads) {
      const contactParticipant = thread.participants.find(
        (p) => p.party.type === 'CONTACT'
      );
      const orgParticipant = thread.participants.find(
        (p) => p.partyId === orgPartyId
      );

      const lastMessage = thread.messages[0];
      const lastReadAt = orgParticipant?.lastReadAt;
      const isRead =
        !lastMessage ||
        !lastReadAt
          ? false
          : new Date(lastMessage.createdAt) <= new Date(lastReadAt);

      const item: CommunicationItem = {
        id: `thread:${thread.id}`,
        type: 'dm',
        partyId: contactParticipant?.partyId || null,
        partyName: contactParticipant?.party.name || thread.guestName || 'Unknown',
        subject: thread.subject,
        preview: lastMessage?.body?.substring(0, 100) || '',
        isRead,
        flagged: thread.flagged,
        archived: thread.archived,
        channel: 'dm',
        createdAt: thread.createdAt.toISOString(),
        updatedAt: (thread.lastMessageAt || thread.updatedAt).toISOString(),
      };

      items.push(item);
      console.log(`  - ${item.id}: "${item.subject}" from ${item.partyName}`);
    }
  }

  // === Fetch PartyEmails (sent) ===
  console.log('\n=== Fetching PartyEmails (sent) ===');
  if ((channel === 'all' || channel === 'email') && (status === 'all' || status === 'sent')) {
    const partyEmailWhere: any = { tenantId, status: 'sent' };

    const partyEmails = await prisma.partyEmail.findMany({
      where: partyEmailWhere,
      include: {
        party: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' as const },
    });

    console.log(`Found ${partyEmails.length} party emails`);

    for (const email of partyEmails) {
      const item: CommunicationItem = {
        id: `partyEmail:${email.id}`,
        type: 'email',
        partyId: email.partyId,
        partyName: email.party?.name || null,
        toEmail: email.toEmail,
        subject: email.subject,
        preview: email.body?.substring(0, 100) || '',
        isRead: email.isRead ?? false,
        flagged: false,
        archived: false,
        channel: 'email',
        direction: 'outbound',
        createdAt: email.createdAt.toISOString(),
        updatedAt: email.createdAt.toISOString(),
      };

      items.push(item);
      console.log(`  - ${item.id}: "${item.subject}" to ${item.partyName}`);
    }
  }

  // === Fetch Drafts ===
  console.log('\n=== Fetching Drafts ===');
  if (status === 'draft') {
    const drafts = await prisma.draft.findMany({
      where: { tenantId },
      include: {
        party: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' as const },
    });

    console.log(`Found ${drafts.length} drafts`);
    for (const draft of drafts) {
      const item: CommunicationItem = {
        id: `draft:${draft.id}`,
        type: 'draft',
        partyId: draft.partyId,
        partyName: draft.party?.name || (draft.toAddresses[0] ?? null),
        subject: draft.subject,
        preview: draft.bodyText.substring(0, 100),
        isRead: true,
        flagged: false,
        archived: false,
        channel: draft.channel,
        createdAt: draft.createdAt.toISOString(),
        updatedAt: draft.updatedAt.toISOString(),
      };

      items.push(item);
      console.log(`  - ${item.id}: "${item.subject}"`);
    }
  }

  console.log('\n=== Final Response ===');
  console.log(`Total items: ${items.length}`);
  console.log('Items:');
  items.forEach(item => {
    console.log(`  - ${item.id} | ${item.type} | ${item.channel} | ${item.partyName}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
