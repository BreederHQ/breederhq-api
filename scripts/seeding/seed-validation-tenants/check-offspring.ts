import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.offspringGroup.count();
  const offspring = await prisma.offspring.count();

  console.log('Offspring Groups:', groups);
  console.log('Offspring:', offspring);

  // Sample some offspring groups with dam/sire names
  const sampleGroups = await prisma.offspringGroup.findMany({
    take: 5,
    include: {
      dam: { select: { name: true } },
      sire: { select: { name: true } },
      Offspring: { select: { name: true, sex: true } },
    },
  });

  console.log('\nSample Offspring Groups:');
  sampleGroups.forEach((g) => {
    console.log(`  - ${g.name}`);
    console.log(`    Dam: ${g.dam?.name || 'N/A'} | Sire: ${g.sire?.name || 'N/A'}`);
    console.log(`    Offspring (${g.Offspring.length}):`, g.Offspring.map((o) => o.name).join(', '));
  });

  // Check if offspring properly have damId/sireId
  const offspringWithParents = await prisma.offspring.findMany({
    take: 10,
    include: {
      dam: { select: { name: true } },
      sire: { select: { name: true } },
      group: { select: { name: true } },
    },
  });

  console.log('\nSample Offspring with Parents:');
  offspringWithParents.forEach((o) => {
    console.log(`  - ${o.name} (${o.sex})`);
    console.log(`    Group: ${o.group?.name || 'N/A'}`);
    console.log(`    Dam: ${o.dam?.name || 'N/A'} | Sire: ${o.sire?.name || 'N/A'}`);
  });
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
