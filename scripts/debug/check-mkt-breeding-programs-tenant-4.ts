import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = 4;

  console.log('='.repeat(60));
  console.log(`Checking Marketplace Breeding Programs for Tenant ${tenantId}`);
  console.log('='.repeat(60));

  // 1. Check mktListingBreedingProgram table
  const mktListings = await prisma.mktListingBreedingProgram.findMany({
    where: { tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      species: true,
      breedText: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`\n1. mktListingBreedingProgram table: ${mktListings.length} records`);
  const liveListings = mktListings.filter(l => l.status === 'LIVE');
  console.log(`   - LIVE status: ${liveListings.length}`);
  console.log(`   - Other status: ${mktListings.length - liveListings.length}`);

  if (mktListings.length > 0) {
    console.log('\n   All records:');
    mktListings.forEach((l, idx) => {
      console.log(`   ${idx + 1}. ID: ${l.id}, Status: ${l.status}, Name: "${l.name || '(null)'}", Species: ${l.species}, Breed: ${l.breedText || '(null)'}`);
    });
  }

  // 2. Check MarketplaceProfile's listedPrograms
  const profile = await prisma.marketplaceProfile.findFirst({
    where: { tenantId },
    select: {
      id: true,
      draftData: true,
      publishedData: true,
    }
  });

  if (profile) {
    const draftData = profile.draftData as any;
    const publishedData = profile.publishedData as any;

    const draftPrograms = draftData?.listedPrograms || [];
    const publishedPrograms = publishedData?.listedPrograms || [];

    console.log(`\n2. MarketplaceProfile.listedPrograms:`);
    console.log(`   - Draft: ${draftPrograms.length} programs`);
    console.log(`   - Published: ${publishedPrograms.length} programs`);

    if (draftPrograms.length > 0) {
      console.log('\n   Draft programs:');
      draftPrograms.forEach((p: any, idx: number) => {
        console.log(`   ${idx + 1}. Name: ${p.name || '(null)'}, Species: ${p.species}, Breed: ${p.breedText || '(null)'}`);
      });
    }
  } else {
    console.log(`\n2. MarketplaceProfile: NOT FOUND`);
  }

  // 3. Check breedingProgram table for reference
  const programs = await prisma.breedingProgram.findMany({
    where: { tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      species: true,
      breedText: true,
    }
  });

  console.log(`\n3. breedingProgram table (core entity): ${programs.length} records`);
  if (programs.length > 0) {
    programs.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ID: ${p.id}, Slug: ${p.slug}, Name: ${p.name || '(null)'}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSIS:');
  console.log('='.repeat(60));
  console.log(`Dashboard shows: ${liveListings.length} (from mktListingBreedingProgram with LIVE status)`);
  const draftPrograms = (profile?.draftData as any)?.listedPrograms?.length || 0;
  console.log(`List shows: ${draftPrograms} (from MarketplaceProfile.draftData.listedPrograms)`);

  if (liveListings.length !== draftPrograms) {
    console.log('\n⚠️  MISMATCH DETECTED!');
    console.log('The mktListingBreedingProgram table has orphaned records that are');
    console.log('not in the profile\'s listedPrograms. These should be cleaned up.');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
