import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  // Find animals with parent references
  const animalsWithParents = await prisma.animal.findMany({
    where: {
      OR: [
        { damId: { not: null } },
        { sireId: { not: null } }
      ]
    },
    select: {
      id: true,
      name: true,
      species: true,
      sex: true,
      damId: true,
      sireId: true,
      dam: { select: { name: true } },
      sire: { select: { name: true } }
    }
  });

  console.log('Animals with lineage:', animalsWithParents.length);
  animalsWithParents.forEach(a => {
    console.log(`  ${a.name} (${a.species}/${a.sex}) - Dam: ${a.dam?.name || 'none'}, Sire: ${a.sire?.name || 'none'}`);
  });

  if (animalsWithParents.length === 0) {
    console.log('\n⚠️  No animals have lineage set - COI will always be 0%');
    console.log('   To test COI, you need animals with dam/sire relationships.');
  }

  await prisma.$disconnect();
}

check();
