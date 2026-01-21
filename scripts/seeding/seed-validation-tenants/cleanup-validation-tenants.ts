// scripts/seed-validation-tenants/cleanup-validation-tenants.ts
// Deletes all data for validation tenants to allow re-seeding.
//
// Usage:
//   # For DEV environment:
//   SEED_ENV=dev npx tsx scripts/seed-validation-tenants/cleanup-validation-tenants.ts
//
//   # For PROD environment:
//   npx dotenv -e .env.prod -- npx tsx scripts/seed-validation-tenants/cleanup-validation-tenants.ts

import '../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Environment = 'dev' | 'prod';

function getEnvironment(): Environment {
  const env = process.env.SEED_ENV?.toLowerCase();
  if (env === 'prod' || env === 'production') {
    return 'prod';
  }
  return 'dev';
}

const TENANT_SLUGS: Record<Environment, string[]> = {
  dev: ['dev-rivendell', 'dev-hogwarts', 'dev-winterfell', 'dev-stark-tower'],
  prod: ['prod-arrakis', 'prod-starfleet', 'prod-richmond', 'prod-zion'],
};

async function cleanupTenant(slug: string): Promise<void> {
  console.log(`\nCleaning up tenant: ${slug}`);

  const tenant = await prisma.tenant.findFirst({
    where: { slug },
  });

  if (!tenant) {
    console.log(`  - Tenant not found, skipping`);
    return;
  }

  console.log(`  Found tenant ID: ${tenant.id}`);

  // Delete in order of dependencies (most dependent first)

  // 1. Delete breeding plans
  const breedingPlans = await prisma.breedingPlan.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${breedingPlans.count} breeding plans`);

  // 2. Delete animal genetics
  const genetics = await prisma.animalGenetics.deleteMany({
    where: { animal: { tenantId: tenant.id } },
  });
  console.log(`  - Deleted ${genetics.count} animal genetics records`);

  // 3. Delete animal titles
  const titles = await prisma.animalTitle.deleteMany({
    where: { animal: { tenantId: tenant.id } },
  });
  console.log(`  - Deleted ${titles.count} animal titles`);

  // 4. Delete competition entries
  const competitions = await prisma.competitionEntry.deleteMany({
    where: { animal: { tenantId: tenant.id } },
  });
  console.log(`  - Deleted ${competitions.count} competition entries`);

  // 5. Delete animal privacy settings
  const privacySettings = await prisma.animalPrivacySettings.deleteMany({
    where: { animal: { tenantId: tenant.id } },
  });
  console.log(`  - Deleted ${privacySettings.count} animal privacy settings`);

  // 5b. Delete animal trait values (health traits)
  const traitValues = await prisma.animalTraitValue.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${traitValues.count} animal trait values`);

  // 5c. Delete vaccination records
  const vaccinations = await prisma.vaccinationRecord.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${vaccinations.count} vaccination records`);

  // 6. Delete animals
  const animals = await prisma.animal.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${animals.count} animals`);

  // 7. Delete marketplace listings
  const listings = await prisma.marketplaceListing.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${listings.count} marketplace listings`);

  // 8. Delete invoices
  const invoices = await prisma.invoice.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${invoices.count} invoices`);

  // 9. Delete waitlist entries
  const waitlist = await prisma.waitlistEntry.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${waitlist.count} waitlist entries`);

  // 10. Delete offspring (individual offspring records)
  const offspring = await prisma.offspring.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${offspring.count} offspring`);

  // 10b. Delete offspring groups (must be after offspring due to FK)
  const offspringGroups = await prisma.offspringGroup.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${offspringGroups.count} offspring groups`);

  // 11. Delete drafts
  const drafts = await prisma.draft.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${drafts.count} drafts`);

  // 12. Delete message participants
  const threadParticipants = await prisma.messageParticipant.deleteMany({
    where: { thread: { tenantId: tenant.id } },
  });
  console.log(`  - Deleted ${threadParticipants.count} message participants`);

  // 13. Delete messages
  const messages = await prisma.message.deleteMany({
    where: { thread: { tenantId: tenant.id } },
  });
  console.log(`  - Deleted ${messages.count} messages`);

  // 14. Delete message threads
  const threads = await prisma.messageThread.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${threads.count} message threads`);

  // 15. Delete party emails
  const partyEmails = await prisma.partyEmail.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${partyEmails.count} party emails`);

  // 16. Delete party activities
  const activities = await prisma.partyActivity.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${activities.count} party activities`);

  // 17. Delete portal accesses
  const portalAccess = await prisma.portalAccess.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${portalAccess.count} portal accesses`);

  // 18. Delete Contact records (separate model from Party)
  const contactRecords = await prisma.contact.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${contactRecords.count} contact records`);

  // 18b. Delete contact parties (parties of type CONTACT)
  const contactParties = await prisma.party.deleteMany({
    where: { tenantId: tenant.id, type: 'CONTACT' },
  });
  console.log(`  - Deleted ${contactParties.count} contact parties`);

  // 19. Delete organization (party of type ORGANIZATION)
  const orgs = await prisma.organization.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${orgs.count} organizations`);

  // 20. Delete remaining parties
  const parties = await prisma.party.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${parties.count} remaining parties`);

  // 21. Delete tags
  const tags = await prisma.tag.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${tags.count} tags`);

  // 22. Delete tenant settings
  const settings = await prisma.tenantSetting.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${settings.count} tenant settings`);

  // 23. Delete tenant memberships
  const memberships = await prisma.tenantMembership.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  - Deleted ${memberships.count} tenant memberships`);

  // 24. Delete the tenant itself
  await prisma.tenant.delete({
    where: { id: tenant.id },
  });
  console.log(`  - Deleted tenant: ${slug}`);
}

async function main() {
  const env = getEnvironment();
  console.log(`\n========================================`);
  console.log(`CLEANUP VALIDATION TENANTS - ${env.toUpperCase()}`);
  console.log(`========================================`);

  const slugs = TENANT_SLUGS[env];
  console.log(`\nWill clean up ${slugs.length} tenants: ${slugs.join(', ')}`);

  for (const slug of slugs) {
    await cleanupTenant(slug);
  }

  console.log(`\n========================================`);
  console.log(`CLEANUP COMPLETE`);
  console.log(`========================================\n`);
}

main()
  .catch((e) => {
    console.error('Cleanup failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
