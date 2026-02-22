/**
 * Backfill script: Create Party records for contacts that are missing them.
 *
 * Usage:
 *   ENV_FILE=.env.dev npx tsx scripts/debug/fix-contacts-without-parties.ts
 *   ENV_FILE=.env.prod npx tsx scripts/debug/fix-contacts-without-parties.ts
 *
 * Add --dry-run to preview without making changes:
 *   ENV_FILE=.env.dev npx tsx scripts/debug/fix-contacts-without-parties.ts --dry-run
 */
import '../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`=== Backfill Party Records for Orphaned Contacts ===${dryRun ? ' [DRY RUN]' : ''}\n`);

  const orphanContacts = await prisma.contact.findMany({
    where: { partyId: null, deletedAt: null },
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ tenantId: 'asc' }, { display_name: 'asc' }],
  });

  if (orphanContacts.length === 0) {
    console.log('✅ No orphaned contacts found. Nothing to fix.');
    return;
  }

  console.log(`Found ${orphanContacts.length} contacts without Party records.\n`);

  let fixed = 0;
  let errors = 0;

  for (const contact of orphanContacts) {
    const displayName = contact.display_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || '(unknown)';

    console.log(`  Processing: ${displayName} (Contact ID: ${contact.id}, Tenant: ${contact.tenant.name})`);

    if (dryRun) {
      console.log(`    [DRY RUN] Would create Party with name="${displayName}", email="${contact.email || '-'}"`);
      fixed++;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const party = await tx.party.create({
          data: {
            tenantId: contact.tenantId,
            type: 'CONTACT',
            name: displayName,
            email: contact.email,
            phoneE164: contact.phoneE164,
            whatsappE164: contact.whatsappE164,
            street: contact.street,
            street2: contact.street2,
            city: contact.city,
            state: contact.state,
            postalCode: contact.zip,
            country: contact.country,
            archived: contact.archived,
          },
        });

        await tx.contact.update({
          where: { id: contact.id },
          data: { partyId: party.id },
        });

        console.log(`    ✅ Created Party ID: ${party.id} and linked to Contact ID: ${contact.id}`);
      });
      fixed++;
    } catch (err) {
      console.error(`    ❌ Failed for Contact ID: ${contact.id}:`, (err as Error).message);
      errors++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Fixed: ${fixed}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total: ${orphanContacts.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
