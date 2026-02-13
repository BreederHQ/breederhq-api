import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPaintedLady() {
  // Find Painted Lady
  const animal = await prisma.animal.findFirst({
    where: { name: { contains: 'Painted Lady' } }
  });

  if (!animal) {
    console.log('❌ Painted Lady not found');
    return;
  }

  console.log('🐴 Found:', animal.name, '(ID:', animal.id + ')');
  console.log('Species:', animal.species);
  console.log('');

  // Get genetics JSONB data
  const genetics = await prisma.animalGenetics.findUnique({
    where: { animalId: animal.id }
  });

  if (!genetics) {
    console.log('❌ No genetics record found');
    return;
  }

  console.log('📊 JSONB Source Data (AnimalGenetics table):');
  console.log('═══════════════════════════════════════════════════════');
  console.log('\ncoatColorData:');
  console.log(JSON.stringify(genetics.coatColorData, null, 2));
  console.log('\nhealthGeneticsData:');
  console.log(JSON.stringify(genetics.healthGeneticsData, null, 2));
  console.log('\ncoatTypeData:');
  console.log(JSON.stringify(genetics.coatTypeData, null, 2));
  console.log('\nphysicalTraitsData:');
  console.log(JSON.stringify(genetics.physicalTraitsData, null, 2));
  console.log('\neyeColorData:');
  console.log(JSON.stringify(genetics.eyeColorData, null, 2));
  console.log('\notherTraitsData:');
  console.log(JSON.stringify(genetics.otherTraitsData, null, 2));
  console.log('');

  // Get normalized search data
  const loci: any[] = await prisma.$queryRaw`
    SELECT * FROM animal_loci
    WHERE animal_id = ${animal.id}
    ORDER BY category, locus
  `;

  console.log('🔍 Normalized Search Data (animal_loci table):');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Total loci:', loci.length);
  console.log('');

  if (loci.length === 0) {
    console.log('⚠️  NO LOCI FOUND IN animal_loci TABLE!');
    console.log('This means the trigger did not sync this animal\'s data.');
  } else {
    const byCategory = loci.reduce((acc, locus) => {
      if (!acc[locus.category]) acc[locus.category] = [];
      acc[locus.category].push(locus);
      return acc;
    }, {} as Record<string, any[]>);

    for (const [category, categoryLoci] of Object.entries(byCategory)) {
      console.log(`\n${category}:`);
      categoryLoci.forEach(locus => {
        console.log(`  ${locus.locus} (${locus.locus_name})`);
        console.log(`    allele1: ${locus.allele1 || 'NULL'}`);
        console.log(`    allele2: ${locus.allele2 || 'NULL'}`);
        console.log(`    genotype: ${locus.genotype || 'NULL'}`);
        console.log(`    networkVisible: ${locus.network_visible}`);
      });
    }
  }

  // Check if trigger exists
  console.log('\n\n🔧 Checking Database Trigger:');
  console.log('═══════════════════════════════════════════════════════');
  const triggers: any[] = await prisma.$queryRaw`
    SELECT trigger_name, event_manipulation, event_object_table, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'AnimalGenetics'
  `;

  if (triggers.length === 0) {
    console.log('⚠️  NO TRIGGER FOUND on AnimalGenetics table!');
  } else {
    triggers.forEach(t => {
      console.log(`Trigger: ${t.trigger_name}`);
      console.log(`Events: ${t.event_manipulation}`);
      console.log(`Table: ${t.event_object_table}`);
    });
  }
}

checkPaintedLady()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
