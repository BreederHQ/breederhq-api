/**
 * Purge all E2E test animals from tenant 4
 * Run from breederhq-api directory:
 * npx tsx scripts/cleanup/purge-e2e-animals-tenant-4.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function purgeE2EAnimals() {
  console.log("🧹 Purging E2E test animals from tenant 4...\n");

  const tenantId = 4;

  try {
    // 1. Find all animals with "e2e" in name (case insensitive)
    const e2eAnimals = await prisma.animal.findMany({
      where: {
        tenantId,
        name: { contains: "e2e", mode: "insensitive" },
      },
      select: { id: true, name: true },
    });

    console.log(`Found ${e2eAnimals.length} E2E animals to delete\n`);

    if (e2eAnimals.length === 0) {
      console.log("✅ No E2E animals found - nothing to clean up!");
      return;
    }

    // Show first 10 for confirmation
    console.log("Sample of animals to delete:");
    e2eAnimals.slice(0, 10).forEach((a) => {
      console.log(`  - ID ${a.id}: "${a.name}"`);
    });
    if (e2eAnimals.length > 10) {
      console.log(`  ... and ${e2eAnimals.length - 10} more\n`);
    }

    const animalIds = e2eAnimals.map((a) => a.id);

    // 2. Clear sireId/damId references from other animals pointing to these
    console.log("\n🔗 Clearing parent references from other animals...");
    const clearedSires = await prisma.animal.updateMany({
      where: { sireId: { in: animalIds } },
      data: { sireId: null },
    });
    const clearedDams = await prisma.animal.updateMany({
      where: { damId: { in: animalIds } },
      data: { damId: null },
    });
    console.log(`   Cleared ${clearedSires.count} sire refs, ${clearedDams.count} dam refs`);

    // 3. Delete related records in dependency order
    console.log("\n🗑️  Deleting related records...");

    // Offspring records where animal is dam/sire
    const deletedOffspring = await prisma.offspring.deleteMany({
      where: {
        OR: [{ damId: { in: animalIds } }, { sireId: { in: animalIds } }],
      },
    });
    console.log(`   - Offspring records: ${deletedOffspring.count}`);

    // Animal owners
    const deletedOwners = await prisma.animalOwner.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Owner records: ${deletedOwners.count}`);

    // Registry identifiers
    const deletedRegistries = await prisma.animalRegistryIdentifier.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Registry identifiers: ${deletedRegistries.count}`);

    // Tag assignments
    const deletedTags = await prisma.tagAssignment.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Tag assignments: ${deletedTags.count}`);

    // Animal genetics
    const deletedGenetics = await prisma.animalGenetics.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Genetics records: ${deletedGenetics.count}`);

    // Animal breeds
    const deletedBreeds = await prisma.animalBreed.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Breed records: ${deletedBreeds.count}`);

    // Animal shares
    const deletedShares = await prisma.animalShare.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Share records: ${deletedShares.count}`);

    // Animal trait values
    const deletedTraits = await prisma.animalTraitValue.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Trait values: ${deletedTraits.count}`);

    // Health/vaccination records
    const deletedVaccinations = await prisma.vaccinationRecord.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Vaccination records: ${deletedVaccinations.count}`);

    // Test results (breeding plan test results where animal is involved)
    const deletedTestResults = await prisma.testResult.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Test results: ${deletedTestResults.count}`);

    // Titles
    const deletedTitles = await prisma.animalTitle.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Titles: ${deletedTitles.count}`);

    // Competition entries
    const deletedCompetitions = await prisma.competitionEntry.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Competition entries: ${deletedCompetitions.count}`);

    // Waitlist entries
    const deletedWaitlist = await prisma.waitlistEntry.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Waitlist entries: ${deletedWaitlist.count}`);

    // Breeding plans where animal is dam/sire
    const plansToDelete = await prisma.breedingPlan.findMany({
      where: {
        tenantId,
        OR: [{ damId: { in: animalIds } }, { sireId: { in: animalIds } }],
      },
      select: { id: true },
    });

    if (plansToDelete.length > 0) {
      const planIds = plansToDelete.map((p) => p.id);

      // Unlink offspring groups first
      await prisma.offspringGroup.updateMany({
        where: { planId: { in: planIds } },
        data: { planId: null },
      });

      const deletedPlans = await prisma.breedingPlan.deleteMany({
        where: { id: { in: planIds } },
      });
      console.log(`   - Breeding plans: ${deletedPlans.count}`);
    }

    // Documents linked to animals
    const deletedDocs = await prisma.document.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Documents: ${deletedDocs.count}`);

    // Direct animal listings
    const deletedListings = await prisma.directAnimalListing.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Direct listings: ${deletedListings.count}`);

    // Marketplace individual animal listings
    const deletedMktListings = await prisma.mktListingIndividualAnimal.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Marketplace listings: ${deletedMktListings.count}`);

    // Cross-tenant animal links
    const deletedAnimalLinks = await prisma.crossTenantAnimalLink.deleteMany({
      where: {
        OR: [{ sourceAnimalId: { in: animalIds } }, { targetAnimalId: { in: animalIds } }],
      },
    });
    console.log(`   - Cross-tenant links: ${deletedAnimalLinks.count}`);

    // Animal identity links
    const deletedIdentityLinks = await prisma.animalIdentityLink.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    console.log(`   - Identity links: ${deletedIdentityLinks.count}`);

    // 4. Finally delete the animals themselves
    console.log("\n🗑️  Deleting animals...");
    const deletedAnimals = await prisma.animal.deleteMany({
      where: { id: { in: animalIds } },
    });
    console.log(`   Deleted ${deletedAnimals.count} animals`);

    // 5. Verify cleanup
    console.log("\n📊 Verifying cleanup...");
    const remaining = await prisma.animal.count({
      where: {
        tenantId,
        name: { contains: "e2e", mode: "insensitive" },
      },
    });

    if (remaining === 0) {
      console.log("✅ All E2E test animals have been purged from tenant 4!");
    } else {
      console.log(`⚠️  ${remaining} E2E animals still remain (may have blocking refs)`);
    }
  } catch (error) {
    console.error("❌ Purge failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

purgeE2EAnimals().catch((e) => {
  console.error(e);
  process.exit(1);
});
