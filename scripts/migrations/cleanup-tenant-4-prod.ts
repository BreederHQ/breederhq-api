/**
 * Clean up tenant #4 from PROD database
 * Use this to reset before re-running the duplication script
 */
import { PrismaClient } from '@prisma/client';

const prodDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL || '',
    },
  },
});

async function cleanup() {
  console.log('🧹 Cleaning up tenant #4 from PROD...\n');

  const tenantId = 4;

  try {
    // Delete in reverse dependency order
    console.log('Deleting marketplace listings...');
    await prodDb.mktListingIndividualAnimal.deleteMany({ where: { tenantId } });

    console.log('Deleting invoices...');
    await prodDb.invoice.deleteMany({ where: { tenantId } });

    console.log('Deleting contracts...');
    await prodDb.contract.deleteMany({ where: { tenantId } });

    console.log('Deleting document bundles...');
    await prodDb.documentBundle.deleteMany({ where: { tenantId } });

    console.log('Deleting documents...');
    await prodDb.document.deleteMany({ where: { tenantId } });

    console.log('Deleting attachments...');
    await prodDb.attachment.deleteMany({ where: { tenantId } });

    console.log('Deleting tags...');
    await prodDb.tag.deleteMany({ where: { tenantId } });

    console.log('Deleting offspring...');
    await prodDb.offspring.deleteMany({ where: { tenantId } });

    console.log('Deleting offspring group buyers...');
    await prodDb.offspringGroupBuyer.deleteMany({ where: { tenantId } });

    console.log('Deleting offspring groups...');
    await prodDb.offspringGroup.deleteMany({ where: { tenantId } });

    console.log('Deleting pregnancy checks...');
    await prodDb.pregnancyCheck.deleteMany({ where: { tenantId } });

    console.log('Deleting breeding attempts...');
    await prodDb.breedingAttempt.deleteMany({ where: { tenantId } });

    console.log('Deleting reproductive cycles...');
    await prodDb.reproductiveCycle.deleteMany({ where: { tenantId } });

    console.log('Deleting breeding plan events...');
    await prodDb.breedingPlanEvent.deleteMany({ where: { tenantId } });

    console.log('Deleting breeding plan buyers...');
    await prodDb.breedingPlanBuyer.deleteMany({ where: { tenantId } });

    console.log('Deleting breeding plans...');
    await prodDb.breedingPlan.deleteMany({ where: { tenantId } });

    console.log('Deleting competition entries...');
    await prodDb.competitionEntry.deleteMany({ where: { tenantId } });

    console.log('Deleting animal titles...');
    await prodDb.animalTitle.deleteMany({ where: { tenantId } });

    console.log('Deleting health events...');
    await prodDb.healthEvent.deleteMany({ where: { tenantId } });

    console.log('Deleting vaccination records...');
    await prodDb.vaccinationRecord.deleteMany({ where: { tenantId } });

    console.log('Deleting animal trait entries...');
    await prodDb.animalTraitEntry.deleteMany({ where: { tenantId } });

    console.log('Deleting animal trait values...');
    await prodDb.animalTraitValue.deleteMany({ where: { tenantId } });

    console.log('Deleting animals...');
    await prodDb.animal.deleteMany({ where: { tenantId } });

    console.log('Deleting contacts...');
    await prodDb.contact.deleteMany({ where: { tenantId } });

    console.log('Deleting organizations...');
    await prodDb.organization.deleteMany({ where: { tenantId } });

    console.log('Deleting parties...');
    await prodDb.party.deleteMany({ where: { tenantId } });

    console.log('Deleting tenant membership...');
    await prodDb.tenantMembership.deleteMany({ where: { tenantId } });

    console.log('Deleting tenant...');
    await prodDb.tenant.delete({ where: { id: tenantId } });

    console.log('Deleting user (if no other memberships)...');
    const user = await prodDb.user.findUnique({
      where: { email: 'luke.skywalker@tester.local' },
      include: { tenantMemberships: true },
    });

    if (user && user.tenantMemberships.length === 0) {
      await prodDb.user.delete({ where: { id: user.id } });
      console.log('✅ Deleted user luke.skywalker@tester.local');
    } else if (user) {
      console.log('⚠️ User has other memberships, not deleting');
    }

    console.log('\n✅ Cleanup complete! You can now re-run the duplication script.\n');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prodDb.$disconnect();
  }
}

cleanup();
