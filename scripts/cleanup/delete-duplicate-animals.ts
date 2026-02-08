/**
 * Delete duplicate animals in tenant 4 (keeps the oldest, deletes newer duplicates)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function deleteDuplicates() {
  console.log("🗑️  Deleting duplicate animals in tenant 4...\n");

  const tenantId = 4;

  // IDs to delete (the newer duplicates)
  const idsToDelete = [478, 479, 474, 473, 475, 477, 467, 469, 470, 471, 476, 468, 472];

  console.log(`Will delete ${idsToDelete.length} duplicate animals: ${idsToDelete.join(", ")}\n`);

  // Clear sire/dam references first
  console.log("🔗 Clearing parent references...");
  const clearedSires = await prisma.animal.updateMany({
    where: { sireId: { in: idsToDelete } },
    data: { sireId: null },
  });
  const clearedDams = await prisma.animal.updateMany({
    where: { damId: { in: idsToDelete } },
    data: { damId: null },
  });
  console.log(`   Cleared ${clearedSires.count} sire refs, ${clearedDams.count} dam refs`);

  // Delete related records
  console.log("\n🗑️  Deleting related records...");

  const deletedOffspring = await prisma.offspring.deleteMany({
    where: { OR: [{ damId: { in: idsToDelete } }, { sireId: { in: idsToDelete } }] },
  });
  console.log(`   - Offspring: ${deletedOffspring.count}`);

  const deletedOwners = await prisma.animalOwner.deleteMany({
    where: { animalId: { in: idsToDelete } },
  });
  console.log(`   - Owners: ${deletedOwners.count}`);

  const deletedRegistries = await prisma.animalRegistryIdentifier.deleteMany({
    where: { animalId: { in: idsToDelete } },
  });
  console.log(`   - Registries: ${deletedRegistries.count}`);

  const deletedTags = await prisma.tagAssignment.deleteMany({
    where: { animalId: { in: idsToDelete } },
  });
  console.log(`   - Tags: ${deletedTags.count}`);

  const deletedGenetics = await prisma.animalGenetics.deleteMany({
    where: { animalId: { in: idsToDelete } },
  });
  console.log(`   - Genetics: ${deletedGenetics.count}`);

  const deletedBreeds = await prisma.animalBreed.deleteMany({
    where: { animalId: { in: idsToDelete } },
  });
  console.log(`   - Breeds: ${deletedBreeds.count}`);

  const deletedTraits = await prisma.animalTraitValue.deleteMany({
    where: { animalId: { in: idsToDelete } },
  });
  console.log(`   - Traits: ${deletedTraits.count}`);

  const deletedVaccinations = await prisma.vaccinationRecord.deleteMany({
    where: { animalId: { in: idsToDelete } },
  });
  console.log(`   - Vaccinations: ${deletedVaccinations.count}`);

  const deletedTestResults = await prisma.testResult.deleteMany({
    where: { animalId: { in: idsToDelete } },
  });
  console.log(`   - Test results: ${deletedTestResults.count}`);

  const deletedTitles = await prisma.animalTitle.deleteMany({
    where: { animalId: { in: idsToDelete } },
  });
  console.log(`   - Titles: ${deletedTitles.count}`);

  const deletedCompetitions = await prisma.competitionEntry.deleteMany({
    where: { animalId: { in: idsToDelete } },
  });
  console.log(`   - Competitions: ${deletedCompetitions.count}`);

  const deletedWaitlist = await prisma.waitlistEntry.deleteMany({
    where: { animalId: { in: idsToDelete } },
  });
  console.log(`   - Waitlist: ${deletedWaitlist.count}`);

  const deletedDocs = await prisma.document.deleteMany({
    where: { animalId: { in: idsToDelete } },
  });
  console.log(`   - Documents: ${deletedDocs.count}`);

  const deletedListings = await prisma.directAnimalListing.deleteMany({
    where: { animalId: { in: idsToDelete } },
  });
  console.log(`   - Direct listings: ${deletedListings.count}`);

  const deletedMktListings = await prisma.mktListingIndividualAnimal.deleteMany({
    where: { animalId: { in: idsToDelete } },
  });
  console.log(`   - Marketplace listings: ${deletedMktListings.count}`);

  const deletedAnimalLinks = await prisma.crossTenantAnimalLink.deleteMany({
    where: { OR: [{ childAnimalId: { in: idsToDelete } }, { parentAnimalId: { in: idsToDelete } }] },
  });
  console.log(`   - Cross-tenant links: ${deletedAnimalLinks.count}`);

  const deletedIdentityLinks = await prisma.animalIdentityLink.deleteMany({
    where: { animalId: { in: idsToDelete } },
  });
  console.log(`   - Identity links: ${deletedIdentityLinks.count}`);

  // Handle breeding plans where these animals are dam/sire
  const plansToDelete = await prisma.breedingPlan.findMany({
    where: {
      tenantId,
      OR: [{ damId: { in: idsToDelete } }, { sireId: { in: idsToDelete } }],
    },
    select: { id: true },
  });

  if (plansToDelete.length > 0) {
    const planIds = plansToDelete.map((p) => p.id);
    await prisma.offspringGroup.updateMany({
      where: { planId: { in: planIds } },
      data: { planId: null },
    });
    const deletedPlans = await prisma.breedingPlan.deleteMany({
      where: { id: { in: planIds } },
    });
    console.log(`   - Breeding plans: ${deletedPlans.count}`);
  }

  // Delete the animals
  console.log("\n🗑️  Deleting animals...");
  const deleted = await prisma.animal.deleteMany({
    where: { id: { in: idsToDelete } },
  });
  console.log(`   Deleted ${deleted.count} duplicate animals`);

  // Verify
  console.log("\n📊 Verifying...");
  const remainingDups = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM (
      SELECT name FROM "Animal" WHERE "tenantId" = ${tenantId}
      GROUP BY name HAVING COUNT(*) > 1
    ) dups
  `;
  const dupCount = Number(remainingDups[0]?.count ?? 0);

  if (dupCount === 0) {
    console.log("✅ No more duplicates in tenant 4!");
  } else {
    console.log(`⚠️  ${dupCount} duplicate names still remain`);
  }

  await prisma.$disconnect();
}

deleteDuplicates().catch((e) => {
  console.error(e);
  process.exit(1);
});
