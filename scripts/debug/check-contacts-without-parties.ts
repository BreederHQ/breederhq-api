/**
 * Diagnostic script: Find contacts and organizations missing Party records.
 *
 * Usage:
 *   ENV_FILE=.env.dev npx tsx scripts/debug/check-contacts-without-parties.ts
 *   ENV_FILE=.env.prod npx tsx scripts/debug/check-contacts-without-parties.ts
 */
import '../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Contacts & Organizations Without Party Records ===\n');

  // 1. Contacts with NULL partyId
  const orphanContacts = await prisma.contact.findMany({
    where: { partyId: null, deletedAt: null },
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
      organization: { select: { id: true, name: true } },
    },
    orderBy: [{ tenantId: 'asc' }, { display_name: 'asc' }],
  });

  if (orphanContacts.length === 0) {
    console.log('✅ All contacts have a linked Party record.\n');
  } else {
    console.log(`❌ Found ${orphanContacts.length} contacts WITHOUT a Party:\n`);
    console.log(
      'ID\t| Tenant\t\t\t\t| Name\t\t\t\t| Email\t\t\t\t\t| Org'
    );
    console.log('-'.repeat(130));

    for (const c of orphanContacts) {
      const tenant = `${c.tenant.name} (${c.tenant.slug})`.padEnd(24);
      const name = (c.display_name || '(no name)').padEnd(24);
      const email = (c.email || '-').padEnd(32);
      const org = c.organization?.name || '-';
      console.log(`${c.id}\t| ${tenant}\t| ${name}\t| ${email}\t| ${org}`);
    }
  }

  // 2. Organizations — partyId is required (NOT NULL) in schema, so no orphans possible
  console.log('✅ Organization.partyId is NOT NULL in schema — no orphans possible.\n');

  // 3. Summary by tenant
  console.log('\n=== Summary by Tenant ===\n');

  const tenantContactCounts = await prisma.contact.groupBy({
    by: ['tenantId'],
    where: { deletedAt: null },
    _count: { id: true },
  });

  const tenantOrphanCounts = await prisma.contact.groupBy({
    by: ['tenantId'],
    where: { partyId: null, deletedAt: null },
    _count: { id: true },
  });

  const orphanMap = new Map(
    tenantOrphanCounts.map((r) => [r.tenantId, r._count.id])
  );

  const tenants = await prisma.tenant.findMany({
    where: {
      id: { in: tenantContactCounts.map((t) => t.tenantId) },
    },
    select: { id: true, name: true, slug: true },
  });

  const tenantNameMap = new Map(tenants.map((t) => [t.id, `${t.name} (${t.slug})`]));

  for (const row of tenantContactCounts) {
    const orphans = orphanMap.get(row.tenantId) || 0;
    const total = row._count.id;
    const status = orphans === 0 ? '✅' : '❌';
    const name = tenantNameMap.get(row.tenantId) || `Tenant ${row.tenantId}`;
    console.log(
      `  ${status} ${name}: ${total} contacts, ${orphans} missing party`
    );
  }

  // 4. Check for Party records orphaned from contacts (Party exists with type CONTACT but no Contact links to it)
  const orphanParties = await prisma.party.findMany({
    where: {
      type: 'CONTACT',
      contact: { is: null },
    },
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ tenantId: 'asc' }, { name: 'asc' }],
  });

  if (orphanParties.length === 0) {
    console.log('\n✅ No orphaned CONTACT-type Party records (all linked).\n');
  } else {
    console.log(
      `\n⚠️  Found ${orphanParties.length} CONTACT-type Party records not linked to any Contact:\n`
    );
    for (const p of orphanParties) {
      console.log(
        `  Party ID: ${p.id}, Tenant: ${p.tenant.name} (${p.tenant.slug}), Name: ${p.name}, Email: ${p.email || '-'}`
      );
    }
  }

  console.log('\n=== Done ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
