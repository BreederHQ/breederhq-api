import './seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding E2E test contacts...\n');

  const tenant = await prisma.tenant.findFirst({
    where: { name: "Test Breeder (Seed)" }
  });

  if (!tenant) {
    throw new Error("Test tenant not found. Run seed-test-users.ts first.");
  }

  console.log(`✓ Using tenant: ${tenant.name} (ID: ${tenant.id})\n`);

  const contacts = [
    { name: 'John Doe', email: 'john.doe@example.com' },
    { name: 'Jane Smith', email: 'jane.smith@example.com' },
    { name: 'Bob Johnson', email: 'bob.johnson@example.com' },
    { name: 'Test Contact No Contracts', email: 'nocontracts@example.com' }
  ];

  for (const contact of contacts) {
    const existing = await prisma.party.findFirst({
      where: { tenantId: tenant.id, email: contact.email }
    });

    if (!existing) {
      await prisma.party.create({
        data: {
          tenantId: tenant.id,
          type: 'CONTACT',
          name: contact.name,
          email: contact.email
        }
      });
      console.log(`✓ Created: ${contact.name}`);
    } else {
      console.log(`ℹ️  Exists: ${contact.name}`);
    }
  }

  console.log('\n✨ E2E contacts seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
