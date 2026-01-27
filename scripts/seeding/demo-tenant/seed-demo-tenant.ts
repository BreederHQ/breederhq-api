// scripts/demo-tenant/seed-demo-tenant.ts
// Seeds a demo tenant with fresh or lived-in data.
//
// Usage:
//   # Seed fresh demo tenant:
//   npx tsx scripts/demo-tenant/seed-demo-tenant.ts --tenant=demo-fresh --type=fresh
//
//   # Seed lived-in demo tenant:
//   npx tsx scripts/demo-tenant/seed-demo-tenant.ts --tenant=demo-lived-in --type=lived-in
//
// The script will:
// 1. Find or create the demo tenant
// 2. Mark it as isDemoTenant=true with the appropriate demoResetType
// 3. Seed it with appropriate data based on type

import '../../prisma/seed/seed-env-bootstrap';
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  TenantRole,
  TenantMembershipRole,
  TenantMembershipStatus,
  AnimalStatus,
  Species,
} from '@prisma/client';

const prisma = new PrismaClient();

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let tenantSlug = 'demo-fresh';
  let resetType: 'fresh' | 'lived-in' = 'fresh';

  for (const arg of args) {
    if (arg.startsWith('--tenant=')) {
      tenantSlug = arg.replace('--tenant=', '');
    }
    if (arg.startsWith('--type=')) {
      const type = arg.replace('--type=', '');
      if (type === 'fresh' || type === 'lived-in') {
        resetType = type;
      }
    }
  }

  return { tenantSlug, resetType };
}

// Demo tenant configurations
const DEMO_TENANTS = {
  'demo-fresh': {
    name: 'Demo - Fresh Start',
    resetType: 'fresh' as const,
    description: 'A pristine tenant like a new subscriber would see',
  },
  'demo-lived-in': {
    name: 'Demo - Established Breeder',
    resetType: 'lived-in' as const,
    description: 'A tenant with 2-3 years of realistic breeding data',
  },
};

// Demo user credentials (for training purposes - use predictable password)
const DEMO_USER = {
  email: 'demo@breederhq.com',
  password: 'DemoPassword123!',
  firstName: 'Demo',
  lastName: 'User',
};

async function ensureTenant(slug: string, name: string, resetType: 'fresh' | 'lived-in') {
  let tenant = await prisma.tenant.findFirst({
    where: { slug },
  });

  if (!tenant) {
    // Import the assignUniqueSlug helper
    const { assignUniqueSlug } = await import('../../../src/services/inbound-email-service.js');
    const inboundEmailSlug = await assignUniqueSlug(name, prisma);

    tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        isDemoTenant: true,
        demoResetType: resetType,
        inboundEmailSlug,
      },
    });
    console.log(`Created demo tenant: ${name} (ID: ${tenant.id}, email: ${inboundEmailSlug}@mail.breederhq.com)`);
  } else {
    // Update to ensure it's marked as demo
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name,
        isDemoTenant: true,
        demoResetType: resetType,
      },
    });
    console.log(`Updated existing tenant: ${name} (ID: ${tenant.id})`);
  }

  return tenant;
}

async function ensureDemoUser(tenantId: number) {
  let user = await prisma.user.findUnique({
    where: { email: DEMO_USER.email },
  });

  const passwordHash = await bcrypt.hash(DEMO_USER.password, 12);

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: DEMO_USER.email,
        passwordHash,
        firstName: DEMO_USER.firstName,
        lastName: DEMO_USER.lastName,
        emailVerifiedAt: new Date(),
        isSuperAdmin: true, // Demo user is super admin to test all features
        defaultTenantId: tenantId,
      },
    });
    console.log(`Created demo user: ${DEMO_USER.email}`);
  } else {
    // Update password and ensure super admin
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isSuperAdmin: true,
        defaultTenantId: tenantId,
      },
    });
    console.log(`Updated demo user: ${DEMO_USER.email}`);
  }

  // Ensure membership exists
  const membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId: user.id, tenantId } },
  });

  if (!membership) {
    await prisma.tenantMembership.create({
      data: {
        userId: user.id,
        tenantId,
        role: TenantRole.OWNER,
        membershipRole: TenantMembershipRole.STAFF,
        membershipStatus: TenantMembershipStatus.ACTIVE,
      },
    });
    console.log(`Added demo user to tenant as OWNER`);
  }

  return user;
}

async function seedFreshTenant(tenantId: number) {
  console.log('\n--- Seeding FRESH demo tenant (minimal data) ---');
  // Fresh tenant has almost no data - just the user/tenant
  // This represents what a new subscriber sees on first login
  console.log('Fresh tenant ready - no additional data seeded');
}

async function seedLivedInTenant(tenantId: number) {
  console.log('\n--- Seeding LIVED-IN demo tenant (rich data) ---');

  // TODO: Import and reuse seed functions from seed-validation-tenants
  // For now, create basic realistic data

  // Create some sample contacts
  const contacts = [
    { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.j@example.com' },
    { firstName: 'Michael', lastName: 'Smith', email: 'mike.smith@example.com' },
    { firstName: 'Emily', lastName: 'Davis', email: 'emily.d@example.com' },
    { firstName: 'James', lastName: 'Wilson', email: 'james.w@example.com' },
    { firstName: 'Jennifer', lastName: 'Brown', email: 'jen.brown@example.com' },
  ];

  let contactsCreated = 0;
  for (const contact of contacts) {
    // Check if contact already exists
    const existing = await prisma.contact.findFirst({
      where: { tenantId, email: contact.email },
    });
    if (existing) continue;

    const party = await prisma.party.create({
      data: {
        tenantId,
        type: 'CONTACT',
        name: `${contact.firstName} ${contact.lastName}`,
        email: contact.email,
      },
    });

    await prisma.contact.create({
      data: {
        tenantId,
        partyId: party.id,
        first_name: contact.firstName,
        last_name: contact.lastName,
        email: contact.email,
        display_name: `${contact.firstName} ${contact.lastName}`,
      },
    });
    contactsCreated++;
  }
  console.log(`Created ${contactsCreated} sample contacts (${contacts.length - contactsCreated} already existed)`);

  // Create some sample animals
  const animals = [
    { name: 'Luna', species: Species.DOG, sex: 'FEMALE', status: AnimalStatus.ACTIVE },
    { name: 'Max', species: Species.DOG, sex: 'MALE', status: AnimalStatus.ACTIVE },
    { name: 'Bella', species: Species.DOG, sex: 'FEMALE', status: AnimalStatus.ACTIVE },
    { name: 'Charlie', species: Species.DOG, sex: 'MALE', status: AnimalStatus.ACTIVE },
    { name: 'Daisy', species: Species.DOG, sex: 'FEMALE', status: AnimalStatus.BREEDING },
    { name: 'Cooper', species: Species.DOG, sex: 'MALE', status: AnimalStatus.BREEDING },
  ];

  let animalsCreated = 0;
  for (const animal of animals) {
    // Check if animal already exists
    const existing = await prisma.animal.findFirst({
      where: { tenantId, name: animal.name },
    });
    if (existing) continue;

    await prisma.animal.create({
      data: {
        tenantId,
        name: animal.name,
        species: animal.species,
        sex: animal.sex as any,
        status: animal.status,
        birthDate: new Date(Date.now() - Math.random() * 5 * 365 * 24 * 60 * 60 * 1000), // Random age 0-5 years
      },
    });
    animalsCreated++;
  }
  console.log(`Created ${animalsCreated} sample animals (${animals.length - animalsCreated} already existed)`);

  // Create some tags
  const tags = [
    { name: 'VIP', color: '#f59e0b', module: 'CONTACT' },
    { name: 'Champion Bloodline', color: '#3b82f6', module: 'ANIMAL' },
    { name: 'Health Tested', color: '#10b981', module: 'ANIMAL' },
    { name: 'Priority', color: '#ef4444', module: 'BREEDING_PLAN' },
  ];

  let tagsCreated = 0;
  for (const tag of tags) {
    // Check if tag already exists
    const existing = await prisma.tag.findFirst({
      where: { tenantId, name: tag.name, module: tag.module as any },
    });
    if (existing) continue;

    await prisma.tag.create({
      data: {
        tenantId,
        name: tag.name,
        color: tag.color,
        module: tag.module as any,
      },
    });
    tagsCreated++;
  }
  console.log(`Created ${tagsCreated} sample tags (${tags.length - tagsCreated} already existed)`);

  console.log('Lived-in tenant seeded with sample data');
  console.log('\nNote: For full realistic data, run the validation tenant seeder');
}

async function main() {
  const { tenantSlug, resetType } = parseArgs();

  console.log('='.repeat(60));
  console.log(`Demo Tenant Seeder`);
  console.log(`Tenant: ${tenantSlug}`);
  console.log(`Type: ${resetType}`);
  console.log('='.repeat(60));

  const config = DEMO_TENANTS[tenantSlug as keyof typeof DEMO_TENANTS] ?? {
    name: tenantSlug,
    resetType,
    description: 'Custom demo tenant',
  };

  // Create/update tenant
  const tenant = await ensureTenant(tenantSlug, config.name, resetType);

  // Ensure demo user exists and is member
  await ensureDemoUser(tenant.id);

  // Seed based on type
  if (resetType === 'fresh') {
    await seedFreshTenant(tenant.id);
  } else {
    await seedLivedInTenant(tenant.id);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Demo tenant setup complete!');
  console.log(`\nLogin credentials:`);
  console.log(`  Email: ${DEMO_USER.email}`);
  console.log(`  Password: ${DEMO_USER.password}`);
  console.log('='.repeat(60));
}

main()
  .catch((err) => {
    console.error('Error seeding demo tenant:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
