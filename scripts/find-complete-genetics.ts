import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findDogsWithCompleteGenetics() {
  const dogs = await prisma.$queryRaw<any[]>`
    SELECT
      a.id,
      a.name,
      a.breed,
      a.sex,
      ag."testProvider",
      ag."testDate",
      ag."coatColorData" IS NOT NULL AS has_coat_color,
      ag."healthGeneticsData" IS NOT NULL AS has_health,
      ag."coatTypeData" IS NOT NULL AS has_coat_type,
      ag."physicalTraitsData" IS NOT NULL AS has_physical,
      ag."eyeColorData" IS NOT NULL AS has_eye_color,
      ag."breedComposition" IS NOT NULL AS has_breed_comp,
      ag.coi IS NOT NULL AS has_coi,
      ag."mhcDiversity" IS NOT NULL AS has_mhc,
      ag.lineage IS NOT NULL AS has_lineage,
      (CASE WHEN ag."coatColorData" IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN ag."healthGeneticsData" IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN ag."coatTypeData" IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN ag."physicalTraitsData" IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN ag."eyeColorData" IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN ag."breedComposition" IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN ag.coi IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN ag."mhcDiversity" IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN ag.lineage IS NOT NULL THEN 1 ELSE 0 END) AS completeness_score
    FROM "Animal" a
    INNER JOIN "AnimalGenetics" ag ON a.id = ag."animalId"
    WHERE a."tenantId" = 4
      AND a.species = 'DOG'
    ORDER BY completeness_score DESC, a.name ASC
    LIMIT 20
  `;

  console.log('Dogs with most complete genetics in Tenant 4:\n');
  console.log('=' .repeat(60));

  dogs.forEach((dog, i) => {
    console.log(`${i+1}. ${dog.name} (ID: ${dog.id})`);
    console.log(`   Breed: ${dog.breed}, Sex: ${dog.sex}`);
    console.log(`   Test Provider: ${dog.testProvider || 'N/A'}`);
    console.log(`   Completeness Score: ${dog.completeness_score}/9`);
    const traits = [
      dog.has_coat_color && 'CoatColor',
      dog.has_health && 'Health',
      dog.has_coat_type && 'CoatType',
      dog.has_physical && 'Physical',
      dog.has_eye_color && 'EyeColor',
      dog.has_breed_comp && 'BreedComp',
      dog.has_coi && 'COI',
      dog.has_mhc && 'MHC',
      dog.has_lineage && 'Lineage'
    ].filter(Boolean).join(', ');
    console.log(`   Has: ${traits}`);
    console.log();
  });

  // Group by sex for pairing suggestions
  const males = dogs.filter(d => d.sex === 'MALE');
  const females = dogs.filter(d => d.sex === 'FEMALE');

  console.log('=' .repeat(60));
  console.log('\nSUGGESTED PAIRINGS FOR DEMO:');
  console.log('=' .repeat(60));

  if (males.length > 0 && females.length > 0) {
    // Best male + best female
    console.log(`\nPairing 1 (Highest Completeness):`);
    console.log(`  Sire: ${males[0].name} (ID: ${males[0].id}, Score: ${males[0].completeness_score}/9)`);
    console.log(`  Dam:  ${females[0].name} (ID: ${females[0].id}, Score: ${females[0].completeness_score}/9)`);

    if (males.length > 1 && females.length > 1) {
      console.log(`\nPairing 2 (Second Best):`);
      console.log(`  Sire: ${males[1]?.name || males[0].name} (ID: ${males[1]?.id || males[0].id}, Score: ${males[1]?.completeness_score || males[0].completeness_score}/9)`);
      console.log(`  Dam:  ${females[1]?.name || females[0].name} (ID: ${females[1]?.id || females[0].id}, Score: ${females[1]?.completeness_score || females[0].completeness_score}/9)`);
    }
  } else {
    console.log('\nNot enough males or females with genetics data to suggest pairings.');
    console.log(`Males found: ${males.length}, Females found: ${females.length}`);
  }

  await prisma.$disconnect();
}

findDogsWithCompleteGenetics().catch(e => {
  console.error(e);
  process.exit(1);
});
