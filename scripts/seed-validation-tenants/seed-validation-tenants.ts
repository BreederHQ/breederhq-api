// scripts/seed-validation-tenants/seed-validation-tenants.ts
// Main orchestrator script for seeding validation testing tenants.
//
// Creates 4 themed tenants with:
// - 1 owner/admin user each with predictable passwords
// - 5 contacts without portal access
// - Multiple species with up to 4 animals each, 6 generations of lineage
// - Up to 4 breeding plans (PLANNING and COMMITTED phases)
// - Marketplace data with varying visibility states
// - Varying privacy settings for bloodlines and genetics
//
// Usage:
//   # For DEV environment:
//   npm run db:seed:validation:dev
//   # or directly:
//   SEED_ENV=dev npx tsx scripts/seed-validation-tenants/seed-validation-tenants.ts
//
//   # For PROD environment:
//   npm run db:seed:validation:prod
//   # or directly:
//   SEED_ENV=prod npx tsx scripts/seed-validation-tenants/seed-validation-tenants.ts

import '../../prisma/seed/seed-env-bootstrap';
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  TenantRole,
  TenantMembershipRole,
  TenantMembershipStatus,
  AnimalStatus,
  BreedingPlanStatus,
  ListingType,
  ListingStatus,
} from '@prisma/client';

import {
  Environment,
  ENV_PREFIX,
  getTenantDefinitions,
  getTenantUsers,
  getTenantContacts,
  getTenantOrganizations,
  getTenantAnimals,
  getTenantBreedingPlans,
  getTenantMarketplaceListings,
  getEnvName,
  getEnvSlug,
  getEnvEmail,
  generateCredentialsSummary,
  AnimalDefinition,
  TenantDefinition,
} from './seed-data-config';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getEnvironment(): Environment {
  const env = process.env.SEED_ENV?.toLowerCase();
  if (env === 'prod' || env === 'production') {
    return 'prod';
  }
  return 'dev';
}

// ═══════════════════════════════════════════════════════════════════════════════
// TENANT SEEDING
// ═══════════════════════════════════════════════════════════════════════════════

async function seedTenant(
  tenantSlug: string,
  env: Environment,
  tenantDefinitions: TenantDefinition[]
): Promise<number> {
  const definition = tenantDefinitions.find((t) => t.slug === tenantSlug);
  if (!definition) {
    throw new Error(`Tenant definition not found for slug: ${tenantSlug}`);
  }

  const envSlug = getEnvSlug(tenantSlug, env);
  const envName = getEnvName(definition.theme.name, env);

  // Check if tenant already exists
  let tenant = await prisma.tenant.findFirst({
    where: { slug: envSlug },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: envName,
        slug: envSlug,
      },
    });
    console.log(`  + Created tenant: ${tenant.name} (ID: ${tenant.id})`);
  } else {
    console.log(`  = Tenant exists: ${tenant.name} (ID: ${tenant.id})`);
  }

  // Create theme settings
  await prisma.tenantSetting.upsert({
    where: {
      tenantId_namespace: {
        tenantId: tenant.id,
        namespace: 'theme',
      },
    },
    update: {
      data: definition.theme,
      updatedBy: 'seed-script',
    },
    create: {
      tenantId: tenant.id,
      namespace: 'theme',
      data: definition.theme,
      updatedBy: 'seed-script',
    },
  });

  // Create lineage visibility settings
  await prisma.tenantSetting.upsert({
    where: {
      tenantId_namespace: {
        tenantId: tenant.id,
        namespace: 'lineage-visibility',
      },
    },
    update: {
      data: definition.lineageVisibility,
      updatedBy: 'seed-script',
    },
    create: {
      tenantId: tenant.id,
      namespace: 'lineage-visibility',
      data: definition.lineageVisibility,
      updatedBy: 'seed-script',
    },
  });

  return tenant.id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER SEEDING
// ═══════════════════════════════════════════════════════════════════════════════

async function seedUser(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  tenantUsers: Record<string, { emailBase: string; firstName: string; lastName: string; password: string; isSuperAdmin: boolean }>
): Promise<string> {
  const userDef = tenantUsers[tenantSlug];
  if (!userDef) {
    throw new Error(`User definition not found for tenant: ${tenantSlug}`);
  }

  const envEmail = getEnvEmail(userDef.emailBase, env);

  // Check if user already exists
  let user = await prisma.user.findUnique({
    where: { email: envEmail },
  });

  if (!user) {
    const passwordHash = await bcrypt.hash(userDef.password, 12);
    user = await prisma.user.create({
      data: {
        email: envEmail,
        firstName: userDef.firstName,
        lastName: userDef.lastName,
        passwordHash,
        isSuperAdmin: userDef.isSuperAdmin,
        emailVerifiedAt: new Date(),
        defaultTenantId: tenantId,
      },
    });
    console.log(`  + Created user: ${user.email} (ID: ${user.id})`);
  } else {
    console.log(`  = User exists: ${user.email} (ID: ${user.id})`);
    // Update default tenant if not set
    if (!user.defaultTenantId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { defaultTenantId: tenantId },
      });
    }
  }

  // Ensure tenant membership
  const existingMembership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId: user.id, tenantId } },
  });

  if (!existingMembership) {
    await prisma.tenantMembership.create({
      data: {
        userId: user.id,
        tenantId,
        role: TenantRole.OWNER,
        membershipRole: TenantMembershipRole.STAFF,
        membershipStatus: TenantMembershipStatus.ACTIVE,
      },
    });
    console.log(`    + Added OWNER membership`);
  }

  return user.id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZATION SEEDING
// ═══════════════════════════════════════════════════════════════════════════════

async function seedOrganizations(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  tenantOrganizations: Record<string, any[]>
): Promise<Map<string, number>> {
  const orgDefs = tenantOrganizations[tenantSlug] || [];
  const orgIdMap = new Map<string, number>();

  for (const orgDef of orgDefs) {
    const envEmail = getEnvEmail(orgDef.emailBase, env);
    const envName = getEnvName(orgDef.name, env);
    const envProgramSlug = orgDef.programSlug
      ? getEnvSlug(orgDef.programSlug, env)
      : undefined;

    // Check if organization already exists
    let org = await prisma.organization.findFirst({
      where: { tenantId, name: envName },
    });

    if (!org) {
      org = await prisma.$transaction(async (tx) => {
        // Create Party first
        const party = await tx.party.create({
          data: {
            tenantId,
            type: 'ORGANIZATION',
            name: envName,
            email: envEmail,
            phoneE164: orgDef.phone,
            city: orgDef.city,
            state: orgDef.state,
            country: orgDef.country,
            archived: false,
          },
        });

        // Create Organization
        const organization = await tx.organization.create({
          data: {
            tenantId,
            partyId: party.id,
            name: envName,
            email: envEmail,
            phone: orgDef.phone,
            website: orgDef.website,
            city: orgDef.city,
            state: orgDef.state,
            country: orgDef.country,
            programSlug: envProgramSlug,
            isPublicProgram: orgDef.isPublicProgram,
            programBio: orgDef.programBio,
            archived: false,
          },
        });

        return organization;
      });
      console.log(
        `  + Created org: ${org.name}${org.isPublicProgram ? ' (public)' : ''}`
      );
    } else {
      console.log(`  = Org exists: ${org.name}`);
    }

    orgIdMap.set(orgDef.name, org.id);
  }

  return orgIdMap;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT SEEDING (without portal access)
// ═══════════════════════════════════════════════════════════════════════════════

async function seedContacts(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  tenantContacts: Record<string, any[]>
): Promise<void> {
  const contactDefs = tenantContacts[tenantSlug] || [];

  for (const contactDef of contactDefs) {
    const envEmail = getEnvEmail(contactDef.emailBase, env);

    // Check if contact already exists
    let contact = await prisma.contact.findFirst({
      where: { tenantId, email: envEmail },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId,
          first_name: contactDef.firstName,
          last_name: contactDef.lastName,
          display_name: `${contactDef.firstName} ${contactDef.lastName}`,
          nickname: contactDef.nickname,
          email: envEmail,
          phoneE164: contactDef.phone,
          city: contactDef.city,
          state: contactDef.state,
          country: contactDef.country,
          archived: false,
        },
      });
      console.log(`  + Created contact: ${contact.display_name}`);
    } else {
      console.log(`  = Contact exists: ${contact.display_name}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMAL SEEDING (with genetics and lineage)
// ═══════════════════════════════════════════════════════════════════════════════

async function seedAnimals(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  defaultLineageVisibility: TenantDefinition['lineageVisibility'],
  tenantAnimals: Record<string, AnimalDefinition[]>
): Promise<Map<string, number>> {
  const animalDefs = tenantAnimals[tenantSlug] || [];
  const animalIdMap = new Map<string, number>();

  // Sort by generation to ensure parents exist before children
  const sortedAnimals = [...animalDefs].sort(
    (a, b) => a.generation - b.generation
  );

  for (const animalDef of sortedAnimals) {
    const envName = getEnvName(animalDef.name, env);

    // Check if animal already exists
    let animal = await prisma.animal.findFirst({
      where: { tenantId, name: envName, species: animalDef.species },
    });

    if (!animal) {
      // Look up parent IDs
      let sireId: number | null = null;
      let damId: number | null = null;

      if (animalDef.sireRef) {
        const sireEnvName = getEnvName(animalDef.sireRef, env);
        sireId = animalIdMap.get(sireEnvName) || null;
        if (!sireId) {
          const sire = await prisma.animal.findFirst({
            where: { tenantId, name: sireEnvName, species: animalDef.species },
          });
          sireId = sire?.id || null;
        }
      }

      if (animalDef.damRef) {
        const damEnvName = getEnvName(animalDef.damRef, env);
        damId = animalIdMap.get(damEnvName) || null;
        if (!damId) {
          const dam = await prisma.animal.findFirst({
            where: { tenantId, name: damEnvName, species: animalDef.species },
          });
          damId = dam?.id || null;
        }
      }

      const birthDate = new Date(`${animalDef.birthYear}-06-15`);

      animal = await prisma.$transaction(async (tx) => {
        // Create the animal
        const newAnimal = await tx.animal.create({
          data: {
            tenantId,
            name: envName,
            species: animalDef.species,
            sex: animalDef.sex,
            breed: animalDef.breed,
            birthDate,
            notes: animalDef.notes,
            status: AnimalStatus.ACTIVE,
            sireId,
            damId,
          },
        });

        // Create genetics record
        await tx.animalGenetics.create({
          data: {
            animalId: newAnimal.id,
            testProvider: animalDef.testProvider || null,
            testDate: animalDef.testProvider
              ? new Date(birthDate.getTime() + 180 * 24 * 60 * 60 * 1000)
              : null,
            coatColorData: animalDef.genetics.coatColor || [],
            coatTypeData: animalDef.genetics.coatType || [],
            physicalTraitsData: animalDef.genetics.physicalTraits || [],
            eyeColorData: animalDef.genetics.eyeColor || [],
            healthGeneticsData: animalDef.genetics.health || [],
          },
        });

        // Create privacy settings based on tenant defaults + overrides
        const privacySettings = {
          ...{
            showName: defaultLineageVisibility.defaultShowName,
            showPhoto: defaultLineageVisibility.defaultShowPhoto,
            showFullDob: defaultLineageVisibility.defaultShowFullDob,
            showRegistryFull: defaultLineageVisibility.defaultShowRegistryFull,
            showHealthResults: defaultLineageVisibility.defaultShowHealthResults,
            showGeneticData: defaultLineageVisibility.defaultShowGeneticData,
            showBreeder: defaultLineageVisibility.defaultShowBreeder,
            allowInfoRequests: defaultLineageVisibility.defaultAllowInfoRequests,
            allowDirectContact: defaultLineageVisibility.defaultAllowDirectContact,
            allowCrossTenantMatching: defaultLineageVisibility.allowCrossTenantMatching,
          },
          ...animalDef.privacyOverrides,
        };

        await tx.animalPrivacySettings.create({
          data: {
            animalId: newAnimal.id,
            ...privacySettings,
          },
        });

        return newAnimal;
      });

      const parentInfo = [];
      if (animalDef.sireRef) parentInfo.push(`Sire: ${animalDef.sireRef}`);
      if (animalDef.damRef) parentInfo.push(`Dam: ${animalDef.damRef}`);
      const parentStr =
        parentInfo.length > 0 ? ` [${parentInfo.join(', ')}]` : ' [Founder]';
      console.log(
        `  + Created: ${envName} (${animalDef.species} Gen ${animalDef.generation})${parentStr}`
      );
    } else {
      console.log(`  = Animal exists: ${envName}`);
    }

    animalIdMap.set(envName, animal.id);
  }

  return animalIdMap;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BREEDING PLAN SEEDING
// ═══════════════════════════════════════════════════════════════════════════════

async function seedBreedingPlans(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  animalIdMap: Map<string, number>,
  tenantBreedingPlans: Record<string, any[]>
): Promise<void> {
  const planDefs = tenantBreedingPlans[tenantSlug] || [];

  for (const planDef of planDefs) {
    const envName = getEnvName(planDef.name, env);

    // Check if plan already exists
    let plan = await prisma.breedingPlan.findFirst({
      where: { tenantId, name: envName },
    });

    if (!plan) {
      // Look up animal IDs
      const damEnvName = getEnvName(planDef.damRef, env);
      const sireEnvName = getEnvName(planDef.sireRef, env);

      let damId = animalIdMap.get(damEnvName) || null;
      let sireId = animalIdMap.get(sireEnvName) || null;

      if (!damId) {
        const dam = await prisma.animal.findFirst({
          where: { tenantId, name: damEnvName, species: planDef.species },
        });
        damId = dam?.id || null;
      }

      if (!sireId) {
        const sire = await prisma.animal.findFirst({
          where: { tenantId, name: sireEnvName, species: planDef.species },
        });
        sireId = sire?.id || null;
      }

      plan = await prisma.breedingPlan.create({
        data: {
          tenantId,
          name: envName,
          nickname: planDef.nickname,
          species: planDef.species,
          breedText: planDef.breedText,
          damId,
          sireId,
          status:
            planDef.status === 'COMMITTED'
              ? BreedingPlanStatus.COMMITTED
              : BreedingPlanStatus.PLANNING,
          notes: planDef.notes,
          expectedCycleStart: planDef.expectedCycleStart,
          committedAt:
            planDef.status === 'COMMITTED' ? new Date() : null,
        },
      });
      console.log(
        `  + Created plan: ${envName} (${planDef.status}) - Dam: ${planDef.damRef}, Sire: ${planDef.sireRef}`
      );
    } else {
      console.log(`  = Plan exists: ${envName}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE LISTING SEEDING
// ═══════════════════════════════════════════════════════════════════════════════

async function seedMarketplaceListings(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  tenantMarketplaceListings: Record<string, any[]>
): Promise<void> {
  const listingDefs = tenantMarketplaceListings[tenantSlug] || [];

  for (const listingDef of listingDefs) {
    const envTitle = getEnvName(listingDef.title, env);

    // Check if listing already exists
    let listing = await prisma.marketplaceListing.findFirst({
      where: { tenantId, title: envTitle },
    });

    if (!listing) {
      const status =
        listingDef.status === 'ACTIVE'
          ? ListingStatus.ACTIVE
          : listingDef.status === 'PAUSED'
          ? ListingStatus.PAUSED
          : ListingStatus.DRAFT;

      listing = await prisma.marketplaceListing.create({
        data: {
          tenantId,
          title: envTitle,
          description: listingDef.description,
          listingType:
            listingDef.listingType === 'BREEDING_PROGRAM'
              ? ListingType.BREEDING_PROGRAM
              : ListingType.STUD_SERVICE,
          status,
          priceCents: listingDef.priceCents,
          priceType: listingDef.priceType,
          city: listingDef.city,
          state: listingDef.state,
          country: listingDef.country,
          publishedAt: status === ListingStatus.ACTIVE ? new Date() : null,
        },
      });
      console.log(`  + Created listing: ${envTitle} (${listingDef.status})`);
    } else {
      console.log(`  = Listing exists: ${envTitle}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const env = getEnvironment();

  // Load all environment-specific data
  const tenantDefinitions = getTenantDefinitions(env);
  const tenantUsers = getTenantUsers(env);
  const tenantContacts = getTenantContacts(env);
  const tenantOrganizations = getTenantOrganizations(env);
  const tenantAnimals = getTenantAnimals(env);
  const tenantBreedingPlans = getTenantBreedingPlans(env);
  const tenantMarketplaceListings = getTenantMarketplaceListings(env);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  BREEDERHQ VALIDATION TENANT SEEDER - ${ENV_PREFIX[env]} ENVIRONMENT`);
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('');

  const stats = {
    tenants: 0,
    users: 0,
    organizations: 0,
    contacts: 0,
    animals: 0,
    breedingPlans: 0,
    marketplaceListings: 0,
  };

  for (const tenantDef of tenantDefinitions) {
    console.log('─────────────────────────────────────────────────────────────────────────────');
    console.log(`  TENANT: ${tenantDef.theme.name} (${tenantDef.slug})`);
    console.log('─────────────────────────────────────────────────────────────────────────────');

    // 1. Create tenant
    console.log('\n  [Tenant]');
    const tenantId = await seedTenant(tenantDef.slug, env, tenantDefinitions);
    stats.tenants++;

    // 2. Create owner/admin user
    console.log('\n  [User]');
    await seedUser(tenantDef.slug, tenantId, env, tenantUsers);
    stats.users++;

    // 3. Create organizations
    console.log('\n  [Organizations]');
    const orgIdMap = await seedOrganizations(tenantDef.slug, tenantId, env, tenantOrganizations);
    stats.organizations += orgIdMap.size;

    // 4. Create contacts (no portal access)
    console.log('\n  [Contacts]');
    await seedContacts(tenantDef.slug, tenantId, env, tenantContacts);
    stats.contacts += (tenantContacts[tenantDef.slug] || []).length;

    // 5. Create animals with genetics and lineage
    console.log('\n  [Animals]');
    const animalIdMap = await seedAnimals(
      tenantDef.slug,
      tenantId,
      env,
      tenantDef.lineageVisibility,
      tenantAnimals
    );
    stats.animals += animalIdMap.size;

    // 6. Create breeding plans
    console.log('\n  [Breeding Plans]');
    await seedBreedingPlans(tenantDef.slug, tenantId, env, animalIdMap, tenantBreedingPlans);
    stats.breedingPlans += (tenantBreedingPlans[tenantDef.slug] || []).length;

    // 7. Create marketplace listings
    console.log('\n  [Marketplace Listings]');
    await seedMarketplaceListings(tenantDef.slug, tenantId, env, tenantMarketplaceListings);
    stats.marketplaceListings += (
      tenantMarketplaceListings[tenantDef.slug] || []
    ).length;

    console.log('');
  }

  // Print summary
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  SEED COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  Tenants:              ${stats.tenants}`);
  console.log(`  Users:                ${stats.users}`);
  console.log(`  Organizations:        ${stats.organizations}`);
  console.log(`  Contacts:             ${stats.contacts}`);
  console.log(`  Animals:              ${stats.animals}`);
  console.log(`  Breeding Plans:       ${stats.breedingPlans}`);
  console.log(`  Marketplace Listings: ${stats.marketplaceListings}`);
  console.log('');

  // Print credentials summary
  console.log('');
  console.log(generateCredentialsSummary(env));
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
