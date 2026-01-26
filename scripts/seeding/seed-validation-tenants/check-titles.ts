import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const titles = await prisma.animalTitle.count();
  const competitions = await prisma.competitionEntry.count();
  const titleDefs = await prisma.titleDefinition.count();

  console.log('Title Definitions:', titleDefs);
  console.log('Animal Titles:', titles);
  console.log('Competition Entries:', competitions);

  // Sample some titles with animal names
  const sampleTitles = await prisma.animalTitle.findMany({
    take: 5,
    include: {
      animal: { select: { name: true } },
      titleDefinition: { select: { abbreviation: true, fullName: true } }
    }
  });

  console.log('\nSample Animal Titles:');
  sampleTitles.forEach(t => {
    console.log('  -', t.animal.name, '->', t.titleDefinition.abbreviation, '(' + t.titleDefinition.fullName + ')');
  });

  // Sample some competition entries
  const sampleComps = await prisma.competitionEntry.findMany({
    take: 5,
    include: {
      animal: { select: { name: true } }
    }
  });

  console.log('\nSample Competition Entries:');
  sampleComps.forEach(c => {
    console.log('  -', c.animal.name, '@', c.eventName, '(' + c.eventDate.toISOString().split('T')[0] + ')');
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
