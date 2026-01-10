// Quick script to check communications data
import { PrismaClient } from '@prisma/client';
import '../../prisma/seed/seed-env-bootstrap';

const prisma = new PrismaClient();

async function main() {
  // Check all PROD tenants
  const tenants = await prisma.tenant.findMany({
    where: { slug: { startsWith: 'prod-' } },
    orderBy: { id: 'asc' }
  });

  for (const tenant of tenants) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TENANT: ${tenant.name} (ID: ${tenant.id})`);
    console.log('='.repeat(60));

    // Get the PRIMARY organization party for this tenant (what STAFF users message as)
    const primaryOrg = await prisma.organization.findFirst({
      where: { tenantId: tenant.id },
      include: { party: true },
      orderBy: { id: 'asc' }  // Get first/primary org
    });
    console.log(`\nPrimary Org Party: ID=${primaryOrg?.partyId} | ${primaryOrg?.name} | ${primaryOrg?.party?.email}`);

    // List all org parties for context
    const allOrgs = await prisma.organization.findMany({
      where: { tenantId: tenant.id },
      include: { party: true }
    });
    console.log(`All Organizations: ${allOrgs.length}`);
    allOrgs.forEach(o => console.log(`  - partyId=${o.partyId} | ${o.name}`));

    // Check PartyEmails
    const emails = await prisma.partyEmail.findMany({
      where: { tenantId: tenant.id },
      include: { party: true }
    });
    console.log(`\nPartyEmails: ${emails.length}`);
    emails.forEach(e => console.log(`  - ${e.subject} | party: ${e.party?.name}`));

    // Check MessageThreads
    const threads = await prisma.messageThread.findMany({
      where: { tenantId: tenant.id },
      include: {
        participants: { include: { party: true } },
        messages: true
      }
    });
    console.log(`\nMessageThreads: ${threads.length}`);
    threads.forEach(t => {
      console.log(`  - "${t.subject}" | messages: ${t.messages.length}`);
      t.participants.forEach(p => console.log(`      participant: partyId=${p.partyId} | ${p.party?.name} (${p.party?.email})`));
    });

    // Check if primary org is participant in any thread
    if (primaryOrg?.partyId) {
      const primaryOrgThreads = await prisma.messageParticipant.findMany({
        where: { partyId: primaryOrg.partyId }
      });
      console.log(`\nThreads where primary org (partyId=${primaryOrg.partyId}) is participant: ${primaryOrgThreads.length}`);
    }

    // Check Drafts
    const drafts = await prisma.draft.findMany({
      where: { tenantId: tenant.id }
    });
    console.log(`\nDrafts: ${drafts.length}`);
    drafts.forEach(d => console.log(`  - ${d.subject || '(no subject)'} | channel: ${d.channel}`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
