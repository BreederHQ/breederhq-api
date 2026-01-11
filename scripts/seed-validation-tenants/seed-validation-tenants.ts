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
  TagModule,
  PortalAccessStatus,
  WaitlistStatus,
  InvoiceStatus,
  PartyActivityKind,
  FinanceScope,
  TitleStatus,
  CompetitionType,
} from '@prisma/client';

import { seedTitleDefinitions } from './seed-title-definitions';

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
  getPortalAccessDefinitions,
  getMarketplaceUsers,
  getContactMeta,
  getEmails,
  getDMThreads,
  getDrafts,
  getEnvName,
  getEnvSlug,
  getEnvEmail,
  generateCredentialsSummary,
  AnimalDefinition,
  TenantDefinition,
  PortalAccessDefinition,
  MarketplaceUserDefinition,
  ContactMetaDefinition,
  EmailDefinition,
  DMThreadDefinition,
  DraftDefinition,
  MARKETPLACE_USERS,
  AnimalTitleDefinition,
  CompetitionEntryDefinition,
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

    // Check if organization already exists (by name or by programSlug)
    let org = await prisma.organization.findFirst({
      where: {
        tenantId,
        OR: [
          { name: envName },
          ...(envProgramSlug ? [{ programSlug: envProgramSlug }] : []),
        ],
      },
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
    const displayName = `${contactDef.firstName} ${contactDef.lastName}`;

    // Check if contact already exists
    let contact = await prisma.contact.findFirst({
      where: { tenantId, email: envEmail },
    });

    if (!contact) {
      contact = await prisma.$transaction(async (tx) => {
        // Create Party first for tag assignment support
        const party = await tx.party.create({
          data: {
            tenantId,
            type: 'CONTACT',
            name: displayName,
            email: envEmail,
            phoneE164: contactDef.phone,
            city: contactDef.city,
            state: contactDef.state,
            country: contactDef.country,
            archived: false,
          },
        });

        // Create Contact linked to Party
        const newContact = await tx.contact.create({
          data: {
            tenantId,
            partyId: party.id,
            first_name: contactDef.firstName,
            last_name: contactDef.lastName,
            display_name: displayName,
            nickname: contactDef.nickname,
            email: envEmail,
            phoneE164: contactDef.phone,
            city: contactDef.city,
            state: contactDef.state,
            country: contactDef.country,
            archived: false,
          },
        });

        return newContact;
      });
      console.log(`  + Created contact: ${contact.display_name}`);
    } else {
      // Ensure existing contact has a party for tag assignment
      if (!contact.partyId) {
        const party = await prisma.party.create({
          data: {
            tenantId,
            type: 'CONTACT',
            name: displayName,
            email: envEmail,
            phoneE164: contactDef.phone,
            city: contactDef.city,
            state: contactDef.state,
            country: contactDef.country,
            archived: false,
          },
        });
        await prisma.contact.update({
          where: { id: contact.id },
          data: { partyId: party.id },
        });
        console.log(`  = Contact exists: ${contact.display_name} (added Party)`);
      } else {
        console.log(`  = Contact exists: ${contact.display_name}`);
      }
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
        // Map old config field names to new schema field names
        const privacySettings = {
          showName: defaultLineageVisibility.defaultShowName,
          showPhoto: defaultLineageVisibility.defaultShowPhoto,
          showFullDob: defaultLineageVisibility.defaultShowFullDob,
          showRegistryFull: defaultLineageVisibility.defaultShowRegistryFull,
          enableHealthSharing: defaultLineageVisibility.defaultShowHealthResults,
          enableGeneticsSharing: defaultLineageVisibility.defaultShowGeneticData,
          showBreeder: defaultLineageVisibility.defaultShowBreeder,
          allowCrossTenantMatching: defaultLineageVisibility.allowCrossTenantMatching,
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
// ANIMAL TITLES AND COMPETITIONS SEEDING
// ═══════════════════════════════════════════════════════════════════════════════

async function seedAnimalTitlesAndCompetitions(
  tenantId: number,
  env: Environment,
  tenantAnimals: Record<string, AnimalDefinition[]>,
  tenantSlug: string
): Promise<{ titles: number; competitions: number }> {
  const animalDefs = tenantAnimals[tenantSlug] || [];
  let titlesCreated = 0;
  let competitionsCreated = 0;

  for (const animalDef of animalDefs) {
    const envName = getEnvName(animalDef.name, env);

    // Find the animal
    const animal = await prisma.animal.findFirst({
      where: { tenantId, name: envName, species: animalDef.species },
    });

    if (!animal) {
      continue;
    }

    // Seed titles for this animal
    if (animalDef.titles && animalDef.titles.length > 0) {
      for (const titleDef of animalDef.titles) {
        // Find the title definition
        const titleDefinition = await prisma.titleDefinition.findFirst({
          where: {
            species: animalDef.species,
            abbreviation: titleDef.titleAbbreviation,
            tenantId: null, // Global definitions only
          },
        });

        if (!titleDefinition) {
          console.log(`  ! Title definition not found: ${titleDef.titleAbbreviation} for ${animalDef.species}`);
          continue;
        }

        // Check if this animal already has this title
        const existingTitle = await prisma.animalTitle.findFirst({
          where: {
            animalId: animal.id,
            titleDefinitionId: titleDefinition.id,
          },
        });

        if (!existingTitle) {
          await prisma.animalTitle.create({
            data: {
              tenantId,
              animalId: animal.id,
              titleDefinitionId: titleDefinition.id,
              dateEarned: titleDef.dateEarned ? new Date(titleDef.dateEarned) : null,
              status: TitleStatus.VERIFIED,
              pointsEarned: titleDef.pointsEarned || null,
              majorWins: titleDef.majorWins || null,
              eventName: titleDef.eventName || null,
              eventLocation: titleDef.eventLocation || null,
              handlerName: titleDef.handlerName || null,
              verified: true,
              verifiedAt: new Date(),
              verifiedBy: 'Seed Data',
              isPublic: true,
            },
          });
          titlesCreated++;
        }
      }
    }

    // Seed competition entries for this animal
    if (animalDef.competitions && animalDef.competitions.length > 0) {
      for (const compDef of animalDef.competitions) {
        // Check if this competition entry already exists
        const existingComp = await prisma.competitionEntry.findFirst({
          where: {
            animalId: animal.id,
            eventName: compDef.eventName,
            eventDate: new Date(compDef.eventDate),
          },
        });

        if (!existingComp) {
          await prisma.competitionEntry.create({
            data: {
              tenantId,
              animalId: animal.id,
              eventName: compDef.eventName,
              eventDate: new Date(compDef.eventDate),
              location: compDef.location || null,
              organization: compDef.organization || null,
              competitionType: compDef.competitionType as CompetitionType,
              className: compDef.className || null,
              placement: compDef.placement || null,
              placementLabel: compDef.placementLabel || null,
              pointsEarned: compDef.pointsEarned || null,
              isMajorWin: compDef.isMajorWin || false,
              qualifyingScore: false,
              judgeName: compDef.judgeName || null,
              // Racing-specific fields
              prizeMoneyCents: compDef.prizeMoneyCents || null,
              trackName: compDef.trackName || null,
              trackSurface: compDef.trackSurface || null,
              distanceFurlongs: compDef.distanceFurlongs || null,
              raceGrade: compDef.raceGrade || null,
              finishTime: compDef.finishTime || null,
              speedFigure: compDef.speedFigure || null,
              handlerName: compDef.handlerName || null,
              isPublic: true,
            },
          });
          competitionsCreated++;
        }
      }
    }
  }

  return { titles: titlesCreated, competitions: competitionsCreated };
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
// TAG DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface TagDefinition {
  name: string;
  module: TagModule;
  color: string;
}

// Tags to create for each tenant - same tags across all tenants for consistency
const TAG_DEFINITIONS: TagDefinition[] = [
  // Contact tags
  { name: 'VIP', module: TagModule.CONTACT, color: '#FFD700' },
  { name: 'Repeat Buyer', module: TagModule.CONTACT, color: '#4CAF50' },
  { name: 'Breeder', module: TagModule.CONTACT, color: '#2196F3' },
  { name: 'Vet', module: TagModule.CONTACT, color: '#9C27B0' },
  { name: 'Pending Follow-up', module: TagModule.CONTACT, color: '#FF9800' },

  // Organization tags
  { name: 'Partner', module: TagModule.ORGANIZATION, color: '#3F51B5' },
  { name: 'Supplier', module: TagModule.ORGANIZATION, color: '#607D8B' },
  { name: 'Show Club', module: TagModule.ORGANIZATION, color: '#E91E63' },
  { name: 'Rescue', module: TagModule.ORGANIZATION, color: '#00BCD4' },

  // Animal tags
  { name: 'Show Prospect', module: TagModule.ANIMAL, color: '#9C27B0' },
  { name: 'Pet Quality', module: TagModule.ANIMAL, color: '#8BC34A' },
  { name: 'Breeding Stock', module: TagModule.ANIMAL, color: '#FF5722' },
  { name: 'Retired', module: TagModule.ANIMAL, color: '#795548' },
  { name: 'Health Watch', module: TagModule.ANIMAL, color: '#F44336' },
  { name: 'Champion Bloodline', module: TagModule.ANIMAL, color: '#FFD700' },

  // Breeding Plan tags
  { name: 'High Priority', module: TagModule.BREEDING_PLAN, color: '#F44336' },
  { name: 'Waitlist Interest', module: TagModule.BREEDING_PLAN, color: '#4CAF50' },
  { name: 'First Litter', module: TagModule.BREEDING_PLAN, color: '#2196F3' },
  { name: 'Repeat Pairing', module: TagModule.BREEDING_PLAN, color: '#9C27B0' },

  // Waitlist Entry tags
  { name: 'Deposit Paid', module: TagModule.WAITLIST_ENTRY, color: '#4CAF50' },
  { name: 'First Pick', module: TagModule.WAITLIST_ENTRY, color: '#FFD700' },
  { name: 'Flexible', module: TagModule.WAITLIST_ENTRY, color: '#03A9F4' },
  { name: 'Specific Request', module: TagModule.WAITLIST_ENTRY, color: '#FF9800' },

  // Offspring Group tags
  { name: 'All Reserved', module: TagModule.OFFSPRING_GROUP, color: '#4CAF50' },
  { name: 'Available', module: TagModule.OFFSPRING_GROUP, color: '#2196F3' },
  { name: 'Photos Needed', module: TagModule.OFFSPRING_GROUP, color: '#FF9800' },

  // Offspring tags
  { name: 'Reserved', module: TagModule.OFFSPRING, color: '#4CAF50' },
  { name: 'Available', module: TagModule.OFFSPRING, color: '#2196F3' },
  { name: 'Keeper', module: TagModule.OFFSPRING, color: '#9C27B0' },
  { name: 'Co-own', module: TagModule.OFFSPRING, color: '#FF5722' },
];

// Which entities should get which tags (by index pattern for variety)
const TAG_ASSIGNMENT_RULES = {
  // Assign to first 2-3 contacts: VIP, Repeat Buyer, Breeder
  contacts: ['VIP', 'Repeat Buyer', 'Breeder'],
  // Assign to first organization: Partner, Show Club
  organizations: ['Partner', 'Show Club'],
  // Assign to founder animals: Show Prospect, Breeding Stock, Champion Bloodline
  animals: ['Show Prospect', 'Breeding Stock', 'Champion Bloodline', 'Health Watch'],
  // Assign to breeding plans: High Priority, Waitlist Interest
  breedingPlans: ['High Priority', 'Waitlist Interest', 'First Litter'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAG SEEDING
// ═══════════════════════════════════════════════════════════════════════════════

async function seedTags(tenantId: number): Promise<Map<string, number>> {
  const tagIdMap = new Map<string, number>();

  for (const tagDef of TAG_DEFINITIONS) {
    // Check if tag already exists
    let tag = await prisma.tag.findFirst({
      where: { tenantId, module: tagDef.module, name: tagDef.name },
    });

    if (!tag) {
      tag = await prisma.tag.create({
        data: {
          tenantId,
          name: tagDef.name,
          module: tagDef.module,
          color: tagDef.color,
        },
      });
      console.log(`  + Created tag: ${tagDef.name} (${tagDef.module})`);
    } else {
      console.log(`  = Tag exists: ${tagDef.name} (${tagDef.module})`);
    }

    // Store with module prefix to handle same name across modules
    tagIdMap.set(`${tagDef.module}:${tagDef.name}`, tag.id);
  }

  return tagIdMap;
}

async function seedTagAssignments(
  tenantId: number,
  tagIdMap: Map<string, number>
): Promise<void> {
  // Get contacts for tag assignment (contacts don't use partyId for tags)
  const contacts = await prisma.contact.findMany({
    where: { tenantId },
    take: 3,
    orderBy: { id: 'asc' },
  });

  // Assign contact tags
  for (let i = 0; i < contacts.length && i < TAG_ASSIGNMENT_RULES.contacts.length; i++) {
    const contact = contacts[i];
    const tagName = TAG_ASSIGNMENT_RULES.contacts[i];
    const tagId = tagIdMap.get(`${TagModule.CONTACT}:${tagName}`);

    if (tagId && contact.partyId) {
      const existing = await prisma.tagAssignment.findFirst({
        where: { tagId, taggedPartyId: contact.partyId },
      });
      if (!existing) {
        await prisma.tagAssignment.create({
          data: { tagId, taggedPartyId: contact.partyId },
        });
        console.log(`  + Tagged contact "${contact.display_name}" with "${tagName}"`);
      }
    }
  }

  // Get organizations for tag assignment
  const organizations = await prisma.organization.findMany({
    where: { tenantId },
    take: 2,
    orderBy: { id: 'asc' },
  });

  // Assign organization tags
  for (let i = 0; i < organizations.length && i < TAG_ASSIGNMENT_RULES.organizations.length; i++) {
    const org = organizations[i];
    const tagName = TAG_ASSIGNMENT_RULES.organizations[i];
    const tagId = tagIdMap.get(`${TagModule.ORGANIZATION}:${tagName}`);

    if (tagId && org.partyId) {
      const existing = await prisma.tagAssignment.findFirst({
        where: { tagId, taggedPartyId: org.partyId },
      });
      if (!existing) {
        await prisma.tagAssignment.create({
          data: { tagId, taggedPartyId: org.partyId },
        });
        console.log(`  + Tagged org "${org.name}" with "${tagName}"`);
      }
    }
  }

  // Get founder animals (generation 0, via notes field or just first few)
  const animals = await prisma.animal.findMany({
    where: { tenantId },
    take: 4,
    orderBy: { id: 'asc' },
  });

  // Assign animal tags
  for (let i = 0; i < animals.length && i < TAG_ASSIGNMENT_RULES.animals.length; i++) {
    const animal = animals[i];
    const tagName = TAG_ASSIGNMENT_RULES.animals[i];
    const tagId = tagIdMap.get(`${TagModule.ANIMAL}:${tagName}`);

    if (tagId) {
      const existing = await prisma.tagAssignment.findFirst({
        where: { tagId, animalId: animal.id },
      });
      if (!existing) {
        await prisma.tagAssignment.create({
          data: { tagId, animalId: animal.id },
        });
        console.log(`  + Tagged animal "${animal.name}" with "${tagName}"`);
      }
    }
  }

  // Get breeding plans
  const breedingPlans = await prisma.breedingPlan.findMany({
    where: { tenantId },
    take: 3,
    orderBy: { id: 'asc' },
  });

  // Assign breeding plan tags
  for (let i = 0; i < breedingPlans.length && i < TAG_ASSIGNMENT_RULES.breedingPlans.length; i++) {
    const plan = breedingPlans[i];
    const tagName = TAG_ASSIGNMENT_RULES.breedingPlans[i];
    const tagId = tagIdMap.get(`${TagModule.BREEDING_PLAN}:${tagName}`);

    if (tagId) {
      const existing = await prisma.tagAssignment.findFirst({
        where: { tagId, breedingPlanId: plan.id },
      });
      if (!existing) {
        await prisma.tagAssignment.create({
          data: { tagId, breedingPlanId: plan.id },
        });
        console.log(`  + Tagged breeding plan "${plan.name}" with "${tagName}"`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL ACCESS SEEDING
// ═══════════════════════════════════════════════════════════════════════════════

async function seedPortalAccess(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  portalAccessDef: PortalAccessDefinition,
  tenantContacts: Record<string, any[]>,
  tenantOrganizations: Record<string, any[]>
): Promise<{ contactPortalUserId: string | null; orgPortalUserId: string | null }> {
  const contactDefs = tenantContacts[tenantSlug] || [];
  const orgDefs = tenantOrganizations[tenantSlug] || [];

  let contactPortalUserId: string | null = null;
  let orgPortalUserId: string | null = null;

  // 1. Create portal access for contact
  if (portalAccessDef.contactIndex < contactDefs.length) {
    const contactDef = contactDefs[portalAccessDef.contactIndex];
    const contactEmail = getEnvEmail(contactDef.emailBase, env);

    // Find the contact
    const contact = await prisma.contact.findFirst({
      where: { tenantId, email: contactEmail },
    });

    if (contact && contact.partyId) {
      const portalUserDef = portalAccessDef.contactPortalUser;
      const portalEmail = getEnvEmail(portalUserDef.emailBase, env);

      // Check if portal user already exists
      let portalUser = await prisma.user.findUnique({
        where: { email: portalEmail },
      });

      if (!portalUser) {
        const passwordHash = await bcrypt.hash(portalUserDef.password, 12);
        portalUser = await prisma.user.create({
          data: {
            email: portalEmail,
            firstName: portalUserDef.firstName,
            lastName: portalUserDef.lastName,
            passwordHash,
            emailVerifiedAt: new Date(),
            defaultTenantId: tenantId,
          },
        });
        console.log(`  + Created portal user: ${portalEmail}`);
      } else {
        console.log(`  = Portal user exists: ${portalEmail}`);
      }

      contactPortalUserId = portalUser.id;

      // Check if PortalAccess record exists
      let portalAccess = await prisma.portalAccess.findUnique({
        where: { partyId: contact.partyId },
      });

      if (!portalAccess) {
        portalAccess = await prisma.portalAccess.create({
          data: {
            tenantId,
            partyId: contact.partyId,
            status: PortalAccessStatus.ACTIVE,
            userId: portalUser.id,
            invitedAt: new Date(),
            activatedAt: new Date(),
          },
        });
        console.log(`  + Created portal access for contact: ${contact.display_name}`);
      } else {
        // Update to link user if not already linked
        if (!portalAccess.userId) {
          await prisma.portalAccess.update({
            where: { id: portalAccess.id },
            data: {
              userId: portalUser.id,
              status: PortalAccessStatus.ACTIVE,
              activatedAt: new Date(),
            },
          });
          console.log(`  = Updated portal access for contact: ${contact.display_name}`);
        } else {
          console.log(`  = Portal access exists for contact: ${contact.display_name}`);
        }
      }

      // Ensure tenant membership for portal user
      const existingMembership = await prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId: portalUser.id, tenantId } },
      });

      if (!existingMembership) {
        await prisma.tenantMembership.create({
          data: {
            userId: portalUser.id,
            tenantId,
            role: TenantRole.VIEWER,
            membershipRole: TenantMembershipRole.CLIENT,
            membershipStatus: TenantMembershipStatus.ACTIVE,
          },
        });
        console.log(`    + Added CLIENT membership for portal user`);
      }
    }
  }

  // 2. Create portal access for organization
  if (portalAccessDef.organizationIndex < orgDefs.length) {
    const orgDef = orgDefs[portalAccessDef.organizationIndex];
    const orgName = getEnvName(orgDef.name, env);
    const envProgramSlug = orgDef.programSlug
      ? getEnvSlug(orgDef.programSlug, env)
      : undefined;

    // Find the organization - check by name (with or without prefix) or programSlug
    // Some orgs may have been created with the old naming convention that included [DEV]/[PROD] prefix
    const organization = await prisma.organization.findFirst({
      where: {
        tenantId,
        OR: [
          { name: orgName },
          { name: { contains: orgDef.name } },
          ...(envProgramSlug ? [{ programSlug: envProgramSlug }] : []),
        ],
      },
    });

    if (organization && organization.partyId) {
      const portalUserDef = portalAccessDef.organizationPortalUser;
      const portalEmail = getEnvEmail(portalUserDef.emailBase, env);

      // Check if portal user already exists
      let portalUser = await prisma.user.findUnique({
        where: { email: portalEmail },
      });

      if (!portalUser) {
        const passwordHash = await bcrypt.hash(portalUserDef.password, 12);
        portalUser = await prisma.user.create({
          data: {
            email: portalEmail,
            firstName: portalUserDef.firstName,
            lastName: portalUserDef.lastName,
            passwordHash,
            emailVerifiedAt: new Date(),
            defaultTenantId: tenantId,
          },
        });
        console.log(`  + Created portal user: ${portalEmail}`);
      } else {
        console.log(`  = Portal user exists: ${portalEmail}`);
      }

      orgPortalUserId = portalUser.id;

      // Check if PortalAccess record exists
      let portalAccess = await prisma.portalAccess.findUnique({
        where: { partyId: organization.partyId },
      });

      if (!portalAccess) {
        portalAccess = await prisma.portalAccess.create({
          data: {
            tenantId,
            partyId: organization.partyId,
            status: PortalAccessStatus.ACTIVE,
            userId: portalUser.id,
            invitedAt: new Date(),
            activatedAt: new Date(),
          },
        });
        console.log(`  + Created portal access for org: ${organization.name}`);
      } else {
        // Update to link user if not already linked
        if (!portalAccess.userId) {
          await prisma.portalAccess.update({
            where: { id: portalAccess.id },
            data: {
              userId: portalUser.id,
              status: PortalAccessStatus.ACTIVE,
              activatedAt: new Date(),
            },
          });
          console.log(`  = Updated portal access for org: ${organization.name}`);
        } else {
          console.log(`  = Portal access exists for org: ${organization.name}`);
        }
      }

      // Ensure tenant membership for portal user
      const existingMembership = await prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId: portalUser.id, tenantId } },
      });

      if (!existingMembership) {
        await prisma.tenantMembership.create({
          data: {
            userId: portalUser.id,
            tenantId,
            role: TenantRole.VIEWER,
            membershipRole: TenantMembershipRole.CLIENT,
            membershipStatus: TenantMembershipStatus.ACTIVE,
          },
        });
        console.log(`    + Added CLIENT membership for portal user`);
      }
    }
  }

  return { contactPortalUserId, orgPortalUserId };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE USER SEEDING (standalone shoppers with no tenant membership)
// ═══════════════════════════════════════════════════════════════════════════════

async function seedMarketplaceUsers(
  env: Environment,
  marketplaceUserDefs: MarketplaceUserDefinition[]
): Promise<number> {
  let createdCount = 0;

  for (const userDef of marketplaceUserDefs) {
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
          emailVerifiedAt: new Date(),
          // No defaultTenantId - these are marketplace-only users
        },
      });
      console.log(`  + Created marketplace user: ${envEmail} (${userDef.description})`);
      createdCount++;
    } else {
      console.log(`  = Marketplace user exists: ${envEmail}`);
    }
  }

  return createdCount;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT META SEEDING (leadStatus, waitlist, invoices, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

async function seedContactMeta(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  contactMetaDefs: Record<string, ContactMetaDefinition[]>,
  tenantContacts: Record<string, any[]>,
  tenantBreedingPlans: Record<string, any[]>
): Promise<{ waitlistEntries: number; invoices: number }> {
  const metaDefs = contactMetaDefs[tenantSlug] || [];
  const contactDefs = tenantContacts[tenantSlug] || [];
  const planDefs = tenantBreedingPlans[tenantSlug] || [];
  let waitlistEntriesCreated = 0;
  let invoicesCreated = 0;

  for (const metaDef of metaDefs) {
    if (metaDef.contactIndex >= contactDefs.length) continue;

    const contactDef = contactDefs[metaDef.contactIndex];
    const contactEmail = getEnvEmail(contactDef.emailBase, env);

    // Find the contact
    const contact = await prisma.contact.findFirst({
      where: { tenantId, email: contactEmail },
      include: { party: true },
    });

    if (!contact || !contact.partyId) {
      console.log(`  ! Contact not found or no partyId: ${contactEmail}`);
      continue;
    }

    // Update Party with leadStatus
    await prisma.party.update({
      where: { id: contact.partyId },
      data: {
        // We'll store leadStatus in metadata since it's not a native field
        // For now, we'll create the waitlist/invoice data which is more important
      },
    });

    // Create waitlist entry if specified
    if (metaDef.waitlistPlanIndex !== undefined && metaDef.waitlistPosition !== undefined) {
      const planDef = planDefs[metaDef.waitlistPlanIndex];
      if (planDef) {
        const planEnvName = getEnvName(planDef.name, env);
        const breedingPlan = await prisma.breedingPlan.findFirst({
          where: { tenantId, name: planEnvName },
        });

        if (breedingPlan) {
          // Check if waitlist entry already exists
          const existingEntry = await prisma.waitlistEntry.findFirst({
            where: { tenantId, clientPartyId: contact.partyId, planId: breedingPlan.id },
          });

          if (!existingEntry) {
            const waitlistStatus = metaDef.waitlistStatus === 'DEPOSIT_PAID'
              ? WaitlistStatus.DEPOSIT_PAID
              : metaDef.waitlistStatus === 'APPROVED'
              ? WaitlistStatus.APPROVED
              : metaDef.waitlistStatus === 'ALLOCATED'
              ? WaitlistStatus.ALLOCATED
              : WaitlistStatus.INQUIRY;

            await prisma.waitlistEntry.create({
              data: {
                tenantId,
                planId: breedingPlan.id,
                clientPartyId: contact.partyId,
                priority: metaDef.waitlistPosition,
                status: waitlistStatus,
                depositRequiredCents: metaDef.depositAmountCents || 50000,
                depositPaidCents: metaDef.waitlistStatus === 'DEPOSIT_PAID' ? (metaDef.depositAmountCents || 50000) : 0,
                depositPaidAt: metaDef.waitlistStatus === 'DEPOSIT_PAID' ? new Date() : null,
                notes: `Seeded waitlist entry - position ${metaDef.waitlistPosition}`,
              },
            });
            waitlistEntriesCreated++;
            console.log(`  + Created waitlist entry: ${contact.display_name} -> ${planEnvName} (#${metaDef.waitlistPosition})`);
          } else {
            console.log(`  = Waitlist entry exists: ${contact.display_name} -> ${planEnvName}`);
          }
        }
      }
    }

    // Create invoice for deposit if specified
    if (metaDef.hasActiveDeposit && metaDef.depositAmountCents) {
      const existingDepositInvoice = await prisma.invoice.findFirst({
        where: {
          tenantId,
          clientPartyId: contact.partyId,
          category: 'DEPOSIT',
          status: 'paid',
        },
      });

      if (!existingDepositInvoice) {
        const year = new Date().getFullYear();
        const invoiceNum = `INV-${year}-DEP${String(metaDef.contactIndex + 1).padStart(4, '0')}`;
        await prisma.invoice.create({
          data: {
            tenantId,
            clientPartyId: contact.partyId,
            invoiceNumber: invoiceNum,
            number: `DEP-${tenantSlug.toUpperCase()}-${metaDef.contactIndex + 1}`,
            status: 'paid',
            category: 'DEPOSIT',
            scope: FinanceScope.waitlist,
            amountCents: metaDef.depositAmountCents,
            balanceCents: 0,
            depositCents: metaDef.depositAmountCents,
            issuedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            dueAt: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000), // 23 days ago
            paidAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
            notes: 'Deposit for upcoming litter',
          },
        });
        invoicesCreated++;
        console.log(`  + Created deposit invoice: ${contact.display_name} ($${(metaDef.depositAmountCents / 100).toFixed(2)})`);
      }
    }

    // Create past purchase invoices if totalPurchasesCents > 0
    if (metaDef.totalPurchasesCents > 0 && metaDef.animalsOwned > 0) {
      const existingPurchaseInvoice = await prisma.invoice.findFirst({
        where: {
          tenantId,
          clientPartyId: contact.partyId,
          category: 'GOODS',
          status: 'paid',
        },
      });

      if (!existingPurchaseInvoice) {
        // Create a single invoice representing lifetime purchases
        const year = new Date().getFullYear();
        const invoiceNum = `INV-${year}-PUR${String(metaDef.contactIndex + 1).padStart(4, '0')}`;
        await prisma.invoice.create({
          data: {
            tenantId,
            clientPartyId: contact.partyId,
            invoiceNumber: invoiceNum,
            number: `PUR-${tenantSlug.toUpperCase()}-${metaDef.contactIndex + 1}`,
            status: 'paid',
            category: 'GOODS',
            scope: FinanceScope.contact,
            amountCents: metaDef.totalPurchasesCents,
            balanceCents: 0,
            issuedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
            dueAt: new Date(Date.now() - 173 * 24 * 60 * 60 * 1000),
            paidAt: new Date(Date.now() - 175 * 24 * 60 * 60 * 1000),
            notes: `Purchase of ${metaDef.animalsOwned} animal(s)`,
          },
        });
        invoicesCreated++;
        console.log(`  + Created purchase invoice: ${contact.display_name} ($${(metaDef.totalPurchasesCents / 100).toFixed(2)})`);
      }
    }
  }

  return { waitlistEntries: waitlistEntriesCreated, invoices: invoicesCreated };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNICATIONS SEEDING (emails, DMs, drafts)
// ═══════════════════════════════════════════════════════════════════════════════

async function seedEmails(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  emailDefs: Record<string, EmailDefinition[]>,
  tenantContacts: Record<string, any[]>,
  ownerUserId: string
): Promise<number> {
  const emails = emailDefs[tenantSlug] || [];
  const contactDefs = tenantContacts[tenantSlug] || [];
  let emailsCreated = 0;

  for (const emailDef of emails) {
    if (emailDef.contactIndex >= contactDefs.length) continue;

    const contactDef = contactDefs[emailDef.contactIndex];
    const contactEmail = getEnvEmail(contactDef.emailBase, env);

    // Find the contact
    const contact = await prisma.contact.findFirst({
      where: { tenantId, email: contactEmail },
    });

    if (!contact || !contact.partyId) continue;

    // Calculate the sent date
    const sentAt = new Date(Date.now() - emailDef.daysAgo * 24 * 60 * 60 * 1000);

    // Check if email already exists (by subject and party)
    const existingEmail = await prisma.partyEmail.findFirst({
      where: {
        tenantId,
        partyId: contact.partyId,
        subject: emailDef.subject,
      },
    });

    if (!existingEmail) {
      await prisma.partyEmail.create({
        data: {
          tenantId,
          partyId: contact.partyId,
          subject: emailDef.subject,
          body: emailDef.body,
          toEmail: emailDef.direction === 'outbound' ? contactEmail : 'breeder@tenant.local',
          sentAt,
          status: emailDef.status === 'unread' ? 'sent' : emailDef.status,
          isRead: emailDef.isRead,
          createdBy: emailDef.direction === 'outbound' ? parseInt(ownerUserId) || null : null,
        },
      });

      // Also create a PartyActivity record for tracking
      await prisma.partyActivity.create({
        data: {
          tenantId,
          partyId: contact.partyId,
          kind: emailDef.direction === 'outbound' ? PartyActivityKind.EMAIL_SENT : PartyActivityKind.EMAIL_SENT, // Use EMAIL_SENT for both since EMAIL_RECEIVED doesn't exist
          title: emailDef.direction === 'outbound' ? `Sent: ${emailDef.subject}` : `Received: ${emailDef.subject}`,
          detail: emailDef.body.substring(0, 200),
          createdAt: sentAt,
        },
      });

      emailsCreated++;
      const direction = emailDef.direction === 'outbound' ? '→' : '←';
      console.log(`  + Created email: ${direction} ${contact.display_name}: "${emailDef.subject.substring(0, 40)}..."`);
    }
  }

  return emailsCreated;
}

async function seedDMThreads(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  dmThreadDefs: Record<string, DMThreadDefinition[]>,
  tenantContacts: Record<string, any[]>
): Promise<{ threads: number; messages: number }> {
  const threads = dmThreadDefs[tenantSlug] || [];
  const contactDefs = tenantContacts[tenantSlug] || [];
  let threadsCreated = 0;
  let messagesCreated = 0;

  // Get the tenant's organization party (breeder) for outbound messages
  const tenantOrg = await prisma.organization.findFirst({
    where: { tenantId },
    include: { party: true },
  });

  if (!tenantOrg || !tenantOrg.partyId) {
    console.log('  ! No organization found for DM threads');
    return { threads: 0, messages: 0 };
  }

  for (const threadDef of threads) {
    let clientPartyId: number | null = null;
    let clientName: string = '';

    // Determine the client party (either marketplace user or contact)
    if (threadDef.marketplaceUserIndex !== undefined) {
      // Get marketplace user's party
      const marketplaceUser = MARKETPLACE_USERS[threadDef.marketplaceUserIndex];
      if (marketplaceUser) {
        const userEmail = getEnvEmail(marketplaceUser.emailBase, env);
        const user = await prisma.user.findUnique({ where: { email: userEmail } });

        if (user) {
          // Check if this user has a party
          let party = await prisma.party.findFirst({
            where: { tenantId, email: userEmail },
          });

          if (!party) {
            // Create a party for the marketplace user
            party = await prisma.party.create({
              data: {
                tenantId,
                type: 'CONTACT',
                name: `${marketplaceUser.firstName} ${marketplaceUser.lastName}`,
                email: userEmail,
              },
            });
          }

          clientPartyId = party.id;
          clientName = `${marketplaceUser.firstName} ${marketplaceUser.lastName}`;
        }
      }
    } else if (threadDef.contactIndex !== undefined && threadDef.contactIndex < contactDefs.length) {
      const contactDef = contactDefs[threadDef.contactIndex];
      const contactEmail = getEnvEmail(contactDef.emailBase, env);
      const contact = await prisma.contact.findFirst({
        where: { tenantId, email: contactEmail },
      });

      if (contact) {
        clientPartyId = contact.partyId;
        clientName = contact.display_name || `${contactDef.firstName} ${contactDef.lastName}`;
      }
    }

    if (!clientPartyId) continue;

    // Check if thread already exists
    const existingThread = await prisma.messageThread.findFirst({
      where: {
        tenantId,
        subject: threadDef.subject,
        participants: { some: { partyId: clientPartyId } },
      },
    });

    if (!existingThread) {
      // Create the thread
      const lastMessageDef = threadDef.messages[threadDef.messages.length - 1];
      const lastMessageAt = new Date(
        Date.now() - lastMessageDef.daysAgo * 24 * 60 * 60 * 1000 - (lastMessageDef.hoursAgo || 0) * 60 * 60 * 1000
      );

      const thread = await prisma.messageThread.create({
        data: {
          tenantId,
          subject: threadDef.subject,
          inquiryType: threadDef.inquiryType,
          flagged: threadDef.flagged,
          flaggedAt: threadDef.flagged ? new Date() : null,
          archived: threadDef.archived,
          lastMessageAt,
        },
      });

      // Add participants
      await prisma.messageParticipant.createMany({
        data: [
          { threadId: thread.id, partyId: clientPartyId },
          { threadId: thread.id, partyId: tenantOrg.partyId },
        ],
      });

      threadsCreated++;

      // Create messages
      for (const msgDef of threadDef.messages) {
        const createdAt = new Date(
          Date.now() - msgDef.daysAgo * 24 * 60 * 60 * 1000 - (msgDef.hoursAgo || 0) * 60 * 60 * 1000
        );

        const senderPartyId = msgDef.direction === 'inbound' ? clientPartyId : tenantOrg.partyId;

        await prisma.message.create({
          data: {
            threadId: thread.id,
            senderPartyId,
            body: msgDef.body,
            createdAt,
          },
        });
        messagesCreated++;
      }

      console.log(`  + Created DM thread: "${threadDef.subject}" with ${clientName} (${threadDef.messages.length} messages)`);
    }
  }

  return { threads: threadsCreated, messages: messagesCreated };
}

async function seedDrafts(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  draftDefs: Record<string, DraftDefinition[]>,
  tenantContacts: Record<string, any[]>,
  ownerUserId: string
): Promise<number> {
  const drafts = draftDefs[tenantSlug] || [];
  const contactDefs = tenantContacts[tenantSlug] || [];
  let draftsCreated = 0;

  for (const draftDef of drafts) {
    let partyId: number | null = null;
    let toAddresses: string[] = [];

    if (draftDef.contactIndex !== undefined && draftDef.contactIndex < contactDefs.length) {
      const contactDef = contactDefs[draftDef.contactIndex];
      const contactEmail = getEnvEmail(contactDef.emailBase, env);

      const contact = await prisma.contact.findFirst({
        where: { tenantId, email: contactEmail },
      });

      if (contact) {
        partyId = contact.partyId;
        toAddresses = [contactEmail];
      }
    }

    // Check if draft already exists
    const existingDraft = await prisma.draft.findFirst({
      where: {
        tenantId,
        subject: draftDef.subject || null,
        bodyText: draftDef.body,
      },
    });

    if (!existingDraft) {
      await prisma.draft.create({
        data: {
          tenantId,
          partyId,
          channel: draftDef.channel,
          subject: draftDef.subject || null,
          toAddresses: toAddresses.length > 0 ? toAddresses : [],
          bodyText: draftDef.body,
          createdByUserId: ownerUserId,
          createdAt: new Date(Date.now() - draftDef.daysAgo * 24 * 60 * 60 * 1000),
        },
      });
      draftsCreated++;
      console.log(`  + Created draft: "${draftDef.subject || '(DM draft)'}"`);
    }
  }

  return draftsCreated;
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
  const portalAccessDefinitions = getPortalAccessDefinitions(env);
  const marketplaceUserDefs = getMarketplaceUsers();
  const contactMetaDefs = getContactMeta(env);
  const emailDefs = getEmails(env);
  const dmThreadDefs = getDMThreads(env);
  const draftDefs = getDrafts(env);

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
    animalTitles: 0,
    competitionEntries: 0,
    breedingPlans: 0,
    marketplaceListings: 0,
    tags: 0,
    tagAssignments: 0,
    portalUsers: 0,
    marketplaceUsers: 0,
    waitlistEntries: 0,
    invoices: 0,
    emails: 0,
    dmThreads: 0,
    dmMessages: 0,
    drafts: 0,
  };

  // Seed global title definitions FIRST (before any tenant-specific titles)
  console.log('─────────────────────────────────────────────────────────────────────────────');
  console.log('  GLOBAL TITLE DEFINITIONS');
  console.log('─────────────────────────────────────────────────────────────────────────────');
  await seedTitleDefinitions();

  // Seed marketplace shoppers FIRST so they exist for DM threads
  console.log('─────────────────────────────────────────────────────────────────────────────');
  console.log('  MARKETPLACE SHOPPERS (seeding first for DM conversations)');
  console.log('─────────────────────────────────────────────────────────────────────────────');
  console.log('\n  [Marketplace Users]');
  await seedMarketplaceUsers(env, marketplaceUserDefs);
  stats.marketplaceUsers = marketplaceUserDefs.length;
  console.log('');

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
    const ownerUserId = await seedUser(tenantDef.slug, tenantId, env, tenantUsers);
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

    // 5b. Create animal titles and competition entries
    console.log('\n  [Animal Titles & Competitions]');
    const { titles, competitions } = await seedAnimalTitlesAndCompetitions(
      tenantId,
      env,
      tenantAnimals,
      tenantDef.slug
    );
    stats.animalTitles += titles;
    stats.competitionEntries += competitions;
    if (titles > 0 || competitions > 0) {
      console.log(`  + Created ${titles} titles and ${competitions} competition entries`);
    }

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

    // 8. Create tags and tag assignments
    console.log('\n  [Tags]');
    const tagIdMap = await seedTags(tenantId);
    stats.tags += tagIdMap.size;

    console.log('\n  [Tag Assignments]');
    const assignmentCountBefore = await prisma.tagAssignment.count({
      where: {
        tag: { tenantId },
      },
    });
    await seedTagAssignments(tenantId, tagIdMap);
    const assignmentCountAfter = await prisma.tagAssignment.count({
      where: {
        tag: { tenantId },
      },
    });
    stats.tagAssignments += assignmentCountAfter - assignmentCountBefore;

    // 9. Create portal access for first contact and first organization
    const portalAccessDef = portalAccessDefinitions[tenantDef.slug];
    if (portalAccessDef) {
      console.log('\n  [Portal Access]');
      const { contactPortalUserId, orgPortalUserId } = await seedPortalAccess(
        tenantDef.slug,
        tenantId,
        env,
        portalAccessDef,
        tenantContacts,
        tenantOrganizations
      );
      if (contactPortalUserId) stats.portalUsers++;
      if (orgPortalUserId) stats.portalUsers++;
    }

    // 10. Create contact meta (waitlist entries, invoices)
    console.log('\n  [Contact Meta]');
    const { waitlistEntries, invoices } = await seedContactMeta(
      tenantDef.slug,
      tenantId,
      env,
      contactMetaDefs,
      tenantContacts,
      tenantBreedingPlans
    );
    stats.waitlistEntries += waitlistEntries;
    stats.invoices += invoices;

    // 11. Create emails
    console.log('\n  [Emails]');
    const emailsCreated = await seedEmails(
      tenantDef.slug,
      tenantId,
      env,
      emailDefs,
      tenantContacts,
      ownerUserId
    );
    stats.emails += emailsCreated;

    // 12. Create DM threads and messages
    console.log('\n  [DM Threads]');
    const { threads, messages } = await seedDMThreads(
      tenantDef.slug,
      tenantId,
      env,
      dmThreadDefs,
      tenantContacts
    );
    stats.dmThreads += threads;
    stats.dmMessages += messages;

    // 13. Create drafts
    console.log('\n  [Drafts]');
    const draftsCreated = await seedDrafts(
      tenantDef.slug,
      tenantId,
      env,
      draftDefs,
      tenantContacts,
      ownerUserId
    );
    stats.drafts += draftsCreated;

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
  console.log(`  Animal Titles:        ${stats.animalTitles}`);
  console.log(`  Competition Entries:  ${stats.competitionEntries}`);
  console.log(`  Breeding Plans:       ${stats.breedingPlans}`);
  console.log(`  Marketplace Listings: ${stats.marketplaceListings}`);
  console.log(`  Tags:                 ${stats.tags}`);
  console.log(`  Tag Assignments:      ${stats.tagAssignments}`);
  console.log(`  Portal Users:         ${stats.portalUsers}`);
  console.log(`  Marketplace Users:    ${stats.marketplaceUsers}`);
  console.log(`  Waitlist Entries:     ${stats.waitlistEntries}`);
  console.log(`  Invoices:             ${stats.invoices}`);
  console.log(`  Emails:               ${stats.emails}`);
  console.log(`  DM Threads:           ${stats.dmThreads}`);
  console.log(`  DM Messages:          ${stats.dmMessages}`);
  console.log(`  Drafts:               ${stats.drafts}`);
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
