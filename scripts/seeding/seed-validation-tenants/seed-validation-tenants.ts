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

import '../../../prisma/seed/seed-env-bootstrap';
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  TenantRole,
  TenantMembershipRole,
  TenantMembershipStatus,
  AnimalStatus,
  BreedingPlanStatus,
  ReproAnchorMode,
  ConfidenceLevel,
  OvulationMethod,
  AnchorType,
  BreedingMethod,
  BreedingGuaranteeType,
  PregnancyCheckMethod,
  MilestoneType,
  MarePostFoalingCondition,
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
  OffspringLifeState,
  OffspringPlacementState,
  OffspringKeeperIntent,
  OffspringFinancialState,
  OffspringPaperworkState,
  TraitStatus,
  TraitSource,
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
  getTenantOffspringGroups,
  getTenantHealth,
  getTenantVaccinations,
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
  OffspringGroupDefinition,
  AnimalHealthDefinition,
  AnimalVaccinationsDefinition,
  MARKETPLACE_USERS,
  AnimalTitleDefinition,
  CompetitionEntryDefinition,
  getStorefronts,
  StorefrontDefinition,
  getBreedingAttempts,
  BreedingAttemptDefinition,
  getPregnancyChecks,
  PregnancyCheckDefinition,
  getTestResults,
  TestResultDefinition,
  getBreedingMilestones,
  BreedingMilestoneDefinition,
  getFoalingOutcomes,
  FoalingOutcomeDefinition,
  getMareHistory,
  MareReproductiveHistoryDefinition,
  getBreedingProgramListings,
  BreedingProgramListingDefinition,
  getStudServiceListings,
  StudServiceListingDefinition,
  getIndividualAnimalListings,
  IndividualAnimalListingDefinition,
  getCrossTenantLinks,
  CrossTenantLinkDefinition,
  SYSTEM_CONTRACT_TEMPLATES,
  ContractTemplateDefinition,
  getContractInstances,
  ContractInstanceDefinition,
  getMessageTemplates,
  MessageTemplateDefinition,
  getAutoReplyRules,
  AutoReplyRuleDefinition,
  getTenantSettings,
  TenantSettingDefinition,
  getEnhancedInvoices,
  EnhancedInvoiceDefinition,
  getPartyActivities,
  PartyActivityDefinition,
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

// Map string status to Prisma enum
function mapBreedingPlanStatus(status: string): BreedingPlanStatus {
  const statusMap: Record<string, BreedingPlanStatus> = {
    PLANNING: BreedingPlanStatus.PLANNING,
    CYCLE: BreedingPlanStatus.CYCLE,
    COMMITTED: BreedingPlanStatus.COMMITTED,
    CYCLE_EXPECTED: BreedingPlanStatus.CYCLE_EXPECTED,
    HORMONE_TESTING: BreedingPlanStatus.HORMONE_TESTING,
    BRED: BreedingPlanStatus.BRED,
    PREGNANT: BreedingPlanStatus.PREGNANT,
    BIRTHED: BreedingPlanStatus.BIRTHED,
    WEANED: BreedingPlanStatus.WEANED,
    PLACEMENT: BreedingPlanStatus.PLACEMENT,
    COMPLETE: BreedingPlanStatus.COMPLETE,
    CANCELED: BreedingPlanStatus.CANCELED,
    UNSUCCESSFUL: BreedingPlanStatus.UNSUCCESSFUL,
    ON_HOLD: BreedingPlanStatus.ON_HOLD,
  };
  return statusMap[status] || BreedingPlanStatus.PLANNING;
}

function mapReproAnchorMode(mode?: string): ReproAnchorMode | undefined {
  if (!mode) return undefined;
  const modeMap: Record<string, ReproAnchorMode> = {
    CYCLE_START: ReproAnchorMode.CYCLE_START,
    OVULATION: ReproAnchorMode.OVULATION,
    BREEDING_DATE: ReproAnchorMode.BREEDING_DATE,
  };
  return modeMap[mode];
}

function mapConfidenceLevel(level?: string): ConfidenceLevel | undefined {
  if (!level) return undefined;
  const levelMap: Record<string, ConfidenceLevel> = {
    HIGH: ConfidenceLevel.HIGH,
    MEDIUM: ConfidenceLevel.MEDIUM,
    LOW: ConfidenceLevel.LOW,
  };
  return levelMap[level];
}

function mapOvulationMethod(method?: string): OvulationMethod | undefined {
  if (!method) return undefined;
  const methodMap: Record<string, OvulationMethod> = {
    CALCULATED: OvulationMethod.CALCULATED,
    PROGESTERONE_TEST: OvulationMethod.PROGESTERONE_TEST,
    LH_TEST: OvulationMethod.LH_TEST,
    ULTRASOUND: OvulationMethod.ULTRASOUND,
    VAGINAL_CYTOLOGY: OvulationMethod.VAGINAL_CYTOLOGY,
    PALPATION: OvulationMethod.PALPATION,
    AT_HOME_TEST: OvulationMethod.AT_HOME_TEST,
    VETERINARY_EXAM: OvulationMethod.VETERINARY_EXAM,
    BREEDING_INDUCED: OvulationMethod.BREEDING_INDUCED,
  };
  return methodMap[method];
}

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

      // Build the data object with all lifecycle fields
      const planData: any = {
        tenantId,
        name: envName,
        nickname: planDef.nickname,
        species: planDef.species,
        breedText: planDef.breedText,
        damId,
        sireId,
        status: mapBreedingPlanStatus(planDef.status),
        notes: planDef.notes,

        // Anchor mode and cycle tracking
        reproAnchorMode: mapReproAnchorMode(planDef.reproAnchorMode),
        cycleStartObserved: planDef.cycleStartObserved,
        cycleStartConfidence: mapConfidenceLevel(planDef.cycleStartConfidence),
        ovulationConfirmed: planDef.ovulationConfirmed,
        ovulationConfirmedMethod: mapOvulationMethod(planDef.ovulationConfirmedMethod),
        ovulationConfidence: mapConfidenceLevel(planDef.ovulationConfidence),

        // Expected dates
        expectedCycleStart: planDef.expectedCycleStart,
        expectedHormoneTestingStart: planDef.expectedHormoneTestingStart,
        expectedBreedDate: planDef.expectedBreedDate,
        expectedBirthDate: planDef.expectedBirthDate,
        expectedWeaned: planDef.expectedWeaned,
        expectedPlacementStart: planDef.expectedPlacementStart,
        expectedPlacementCompleted: planDef.expectedPlacementCompleted,

        // Actual dates
        cycleStartDateActual: planDef.cycleStartDateActual,
        hormoneTestingStartDateActual: planDef.hormoneTestingStartDateActual,
        breedDateActual: planDef.breedDateActual,
        birthDateActual: planDef.birthDateActual,
        weanedDateActual: planDef.weanedDateActual,
        placementStartDateActual: planDef.placementStartDateActual,
        placementCompletedDateActual: planDef.placementCompletedDateActual,
        completedDateActual: planDef.completedDateActual,

        // Note: countBorn/countAlive are on OffspringGroup, not BreedingPlan

        // Committed intent
        isCommittedIntent: planDef.isCommittedIntent || false,
        committedAt: planDef.committedAt,
      };

      // Set primary anchor based on anchor mode
      if (planDef.reproAnchorMode === 'OVULATION' && planDef.ovulationConfirmed) {
        planData.primaryAnchor = AnchorType.OVULATION;
      } else if (planDef.reproAnchorMode === 'BREEDING_DATE' && planDef.breedDateActual) {
        planData.primaryAnchor = AnchorType.BREEDING_DATE;
      } else if (planDef.cycleStartObserved) {
        planData.primaryAnchor = AnchorType.CYCLE_START;
      }

      plan = await prisma.breedingPlan.create({
        data: planData,
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
// BREEDING ATTEMPTS, PREGNANCY CHECKS, AND TEST RESULTS SEEDING
// ═══════════════════════════════════════════════════════════════════════════════

function mapBreedingMethod(method: string): BreedingMethod {
  const methodMap: Record<string, BreedingMethod> = {
    NATURAL: BreedingMethod.NATURAL,
    AI_TCI: BreedingMethod.AI_TCI,
    AI_SI: BreedingMethod.AI_SI,
    AI_FROZEN: BreedingMethod.AI_FROZEN,
  };
  return methodMap[method] || BreedingMethod.NATURAL;
}

function mapBreedingGuaranteeType(type?: string): BreedingGuaranteeType | undefined {
  if (!type) return undefined;
  const typeMap: Record<string, BreedingGuaranteeType> = {
    NO_GUARANTEE: BreedingGuaranteeType.NO_GUARANTEE,
    LIVE_FOAL: BreedingGuaranteeType.LIVE_FOAL,
    STANDS_AND_NURSES: BreedingGuaranteeType.STANDS_AND_NURSES,
    SIXTY_DAY_PREGNANCY: BreedingGuaranteeType.SIXTY_DAY_PREGNANCY,
    CERTIFIED_PREGNANT: BreedingGuaranteeType.CERTIFIED_PREGNANT,
  };
  return typeMap[type];
}

function mapPregnancyCheckMethod(method: string): PregnancyCheckMethod {
  const methodMap: Record<string, PregnancyCheckMethod> = {
    PALPATION: PregnancyCheckMethod.PALPATION,
    ULTRASOUND: PregnancyCheckMethod.ULTRASOUND,
    RELAXIN_TEST: PregnancyCheckMethod.RELAXIN_TEST,
    XRAY: PregnancyCheckMethod.XRAY,
    OTHER: PregnancyCheckMethod.OTHER,
  };
  return methodMap[method] || PregnancyCheckMethod.OTHER;
}

async function seedBreedingAttempts(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  breedingAttempts: Record<string, BreedingAttemptDefinition[]>
): Promise<number> {
  const attemptDefs = breedingAttempts[tenantSlug] || [];
  let created = 0;

  for (const attemptDef of attemptDefs) {
    const planEnvName = getEnvName(attemptDef.planRef, env);

    // Find the plan
    const plan = await prisma.breedingPlan.findFirst({
      where: { tenantId, name: planEnvName },
    });

    if (!plan) {
      console.log(`  ! Plan not found for breeding attempt: ${planEnvName}`);
      continue;
    }

    // Check if attempt already exists for this plan at this time
    const existing = await prisma.breedingAttempt.findFirst({
      where: {
        tenantId,
        planId: plan.id,
        attemptAt: attemptDef.attemptAt,
      },
    });

    if (!existing) {
      await prisma.breedingAttempt.create({
        data: {
          tenantId,
          planId: plan.id,
          damId: plan.damId,
          sireId: plan.sireId,
          method: mapBreedingMethod(attemptDef.method),
          attemptAt: attemptDef.attemptAt,
          success: attemptDef.success,
          notes: attemptDef.notes,
          guaranteeType: mapBreedingGuaranteeType(attemptDef.guaranteeType),
          agreedFeeCents: attemptDef.agreedFeeCents,
          feePaidCents: attemptDef.feePaidCents,
        },
      });
      created++;
      console.log(`  + Created breeding attempt for: ${planEnvName} (${attemptDef.method})`);
    } else {
      console.log(`  = Breeding attempt exists for: ${planEnvName}`);
    }
  }

  return created;
}

async function seedPregnancyChecks(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  pregnancyChecks: Record<string, PregnancyCheckDefinition[]>
): Promise<number> {
  const checkDefs = pregnancyChecks[tenantSlug] || [];
  let created = 0;

  for (const checkDef of checkDefs) {
    const planEnvName = getEnvName(checkDef.planRef, env);

    // Find the plan
    const plan = await prisma.breedingPlan.findFirst({
      where: { tenantId, name: planEnvName },
    });

    if (!plan) {
      console.log(`  ! Plan not found for pregnancy check: ${planEnvName}`);
      continue;
    }

    // Check if pregnancy check already exists for this plan at this time
    const existing = await prisma.pregnancyCheck.findFirst({
      where: {
        tenantId,
        planId: plan.id,
        checkedAt: checkDef.checkedAt,
      },
    });

    if (!existing) {
      await prisma.pregnancyCheck.create({
        data: {
          tenantId,
          planId: plan.id,
          method: mapPregnancyCheckMethod(checkDef.method),
          result: checkDef.result,
          checkedAt: checkDef.checkedAt,
          notes: checkDef.notes,
        },
      });
      created++;
      console.log(`  + Created pregnancy check for: ${planEnvName} (${checkDef.method} - ${checkDef.result ? 'positive' : 'negative'})`);
    } else {
      console.log(`  = Pregnancy check exists for: ${planEnvName}`);
    }
  }

  return created;
}

async function seedTestResults(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  testResults: Record<string, TestResultDefinition[]>
): Promise<number> {
  const resultDefs = testResults[tenantSlug] || [];
  let created = 0;

  for (const resultDef of resultDefs) {
    const planEnvName = getEnvName(resultDef.planRef, env);
    const animalEnvName = getEnvName(resultDef.animalRef, env);

    // Find the plan
    const plan = await prisma.breedingPlan.findFirst({
      where: { tenantId, name: planEnvName },
    });

    if (!plan) {
      console.log(`  ! Plan not found for test result: ${planEnvName}`);
      continue;
    }

    // Find the animal (dam)
    const animal = await prisma.animal.findFirst({
      where: { tenantId, name: animalEnvName },
    });

    // Check if test result already exists for this plan/animal at this time
    const existing = await prisma.testResult.findFirst({
      where: {
        tenantId,
        planId: plan.id,
        collectedAt: resultDef.collectedAt,
        kind: resultDef.kind,
      },
    });

    if (!existing) {
      await prisma.testResult.create({
        data: {
          tenantId,
          planId: plan.id,
          animalId: animal?.id,
          kind: resultDef.kind,
          method: resultDef.method,
          collectedAt: resultDef.collectedAt,
          valueNumber: resultDef.valueNumber,
          valueText: resultDef.valueText,
          units: resultDef.units,
          indicatesOvulationDate: resultDef.indicatesOvulationDate,
          notes: resultDef.notes,
          data: resultDef.data,
        },
      });
      created++;
      console.log(`  + Created test result for: ${planEnvName} (${resultDef.kind})`);
    } else {
      console.log(`  = Test result exists for: ${planEnvName} (${resultDef.kind})`);
    }
  }

  return created;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BREEDING MILESTONES, FOALING OUTCOMES, MARE HISTORY SEEDING
// ═══════════════════════════════════════════════════════════════════════════════

function mapMilestoneType(type: string): MilestoneType {
  const typeMap: Record<string, MilestoneType> = {
    VET_PREGNANCY_CHECK_15D: MilestoneType.VET_PREGNANCY_CHECK_15D,
    VET_ULTRASOUND_45D: MilestoneType.VET_ULTRASOUND_45D,
    VET_ULTRASOUND_90D: MilestoneType.VET_ULTRASOUND_90D,
    BEGIN_MONITORING_300D: MilestoneType.BEGIN_MONITORING_300D,
    PREPARE_FOALING_AREA_320D: MilestoneType.PREPARE_FOALING_AREA_320D,
    DAILY_CHECKS_330D: MilestoneType.DAILY_CHECKS_330D,
    DUE_DATE_340D: MilestoneType.DUE_DATE_340D,
    OVERDUE_VET_CALL_350D: MilestoneType.OVERDUE_VET_CALL_350D,
    UDDER_DEVELOPMENT: MilestoneType.UDDER_DEVELOPMENT,
    UDDER_FULL: MilestoneType.UDDER_FULL,
    WAX_APPEARANCE: MilestoneType.WAX_APPEARANCE,
    VULVAR_RELAXATION: MilestoneType.VULVAR_RELAXATION,
    TAILHEAD_RELAXATION: MilestoneType.TAILHEAD_RELAXATION,
    MILK_CALCIUM_TEST: MilestoneType.MILK_CALCIUM_TEST,
  };
  return typeMap[type] || MilestoneType.VET_PREGNANCY_CHECK_15D;
}

function mapMareCondition(condition: string): MarePostFoalingCondition {
  const conditionMap: Record<string, MarePostFoalingCondition> = {
    EXCELLENT: MarePostFoalingCondition.EXCELLENT,
    GOOD: MarePostFoalingCondition.GOOD,
    FAIR: MarePostFoalingCondition.FAIR,
    POOR: MarePostFoalingCondition.POOR,
    VETERINARY_CARE_REQUIRED: MarePostFoalingCondition.VETERINARY_CARE_REQUIRED,
  };
  return conditionMap[condition] || MarePostFoalingCondition.GOOD;
}

async function seedBreedingMilestones(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  breedingMilestones: Record<string, BreedingMilestoneDefinition[]>
): Promise<number> {
  const milestoneDefs = breedingMilestones[tenantSlug] || [];
  let created = 0;

  for (const milestoneDef of milestoneDefs) {
    const planEnvName = getEnvName(milestoneDef.planRef, env);

    // Find the plan
    const plan = await prisma.breedingPlan.findFirst({
      where: { tenantId, name: planEnvName },
    });

    if (!plan) {
      console.log(`  ! Plan not found for milestone: ${planEnvName}`);
      continue;
    }

    // Check if milestone already exists
    const existing = await prisma.breedingMilestone.findFirst({
      where: {
        tenantId,
        breedingPlanId: plan.id,
        milestoneType: mapMilestoneType(milestoneDef.milestoneType),
      },
    });

    if (!existing) {
      await prisma.breedingMilestone.create({
        data: {
          tenantId,
          breedingPlanId: plan.id,
          milestoneType: mapMilestoneType(milestoneDef.milestoneType),
          scheduledDate: milestoneDef.scheduledDate,
          isCompleted: milestoneDef.isCompleted,
          completedDate: milestoneDef.completedDate,
          notes: milestoneDef.notes,
        },
      });
      created++;
      console.log(`  + Created milestone for: ${planEnvName} (${milestoneDef.milestoneType})`);
    } else {
      console.log(`  = Milestone exists for: ${planEnvName} (${milestoneDef.milestoneType})`);
    }
  }

  return created;
}

async function seedFoalingOutcomes(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  foalingOutcomes: Record<string, FoalingOutcomeDefinition[]>
): Promise<number> {
  const outcomeDefs = foalingOutcomes[tenantSlug] || [];
  let created = 0;

  for (const outcomeDef of outcomeDefs) {
    const planEnvName = getEnvName(outcomeDef.planRef, env);

    // Find the plan
    const plan = await prisma.breedingPlan.findFirst({
      where: { tenantId, name: planEnvName },
    });

    if (!plan) {
      console.log(`  ! Plan not found for foaling outcome: ${planEnvName}`);
      continue;
    }

    // Check if foaling outcome already exists (unique per plan)
    const existing = await prisma.foalingOutcome.findUnique({
      where: { breedingPlanId: plan.id },
    });

    if (!existing) {
      await prisma.foalingOutcome.create({
        data: {
          tenantId,
          breedingPlanId: plan.id,
          hadComplications: outcomeDef.hadComplications,
          complicationDetails: outcomeDef.complicationDetails,
          veterinarianCalled: outcomeDef.veterinarianCalled,
          veterinarianName: outcomeDef.veterinarianName,
          placentaPassed: outcomeDef.placentaPassed,
          placentaPassedMinutes: outcomeDef.placentaPassedMinutes,
          mareCondition: mapMareCondition(outcomeDef.mareCondition),
          postFoalingHeatDate: outcomeDef.postFoalingHeatDate,
          readyForRebreeding: outcomeDef.readyForRebreeding,
        },
      });
      created++;
      console.log(`  + Created foaling outcome for: ${planEnvName}`);
    } else {
      console.log(`  = Foaling outcome exists for: ${planEnvName}`);
    }
  }

  return created;
}

async function seedMareReproductiveHistory(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  mareHistory: Record<string, MareReproductiveHistoryDefinition[]>
): Promise<number> {
  const historyDefs = mareHistory[tenantSlug] || [];
  let created = 0;

  for (const historyDef of historyDefs) {
    const mareEnvName = getEnvName(historyDef.mareRef, env);

    // Find the mare
    const mare = await prisma.animal.findFirst({
      where: { tenantId, name: mareEnvName, sex: 'FEMALE' },
    });

    if (!mare) {
      console.log(`  ! Mare not found for reproductive history: ${mareEnvName}`);
      continue;
    }

    // Check if history already exists (unique per mare)
    const existing = await prisma.mareReproductiveHistory.findUnique({
      where: { mareId: mare.id },
    });

    if (!existing) {
      await prisma.mareReproductiveHistory.create({
        data: {
          tenantId,
          mareId: mare.id,
          totalFoalings: historyDef.totalFoalings,
          totalLiveFoals: historyDef.totalLiveFoals,
          totalComplicatedFoalings: historyDef.totalComplicatedFoalings,
          avgPostFoalingHeatDays: historyDef.avgPostFoalingHeatDays,
          riskScore: historyDef.riskScore,
          riskFactors: historyDef.riskFactors || [],
          notes: historyDef.notes,
        },
      });
      created++;
      console.log(`  + Created reproductive history for mare: ${mareEnvName}`);
    } else {
      console.log(`  = Reproductive history exists for mare: ${mareEnvName}`);
    }
  }

  return created;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OFFSPRING GROUP AND OFFSPRING SEEDING
// ═══════════════════════════════════════════════════════════════════════════════

async function seedOffspringGroups(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  tenantOffspringGroups: Record<string, OffspringGroupDefinition[]>
): Promise<{ groups: number; offspring: number }> {
  const groupDefs = tenantOffspringGroups[tenantSlug] || [];
  let groupsCreated = 0;
  let offspringCreated = 0;

  for (const groupDef of groupDefs) {
    const envGroupName = getEnvName(groupDef.name, env);

    // Check if group already exists
    let group = await prisma.offspringGroup.findFirst({
      where: { tenantId, name: envGroupName },
    });

    if (!group) {
      // Look up dam and sire by name
      const damEnvName = getEnvName(groupDef.damRef, env);
      const sireEnvName = getEnvName(groupDef.sireRef, env);

      const dam = await prisma.animal.findFirst({
        where: { tenantId, name: damEnvName, species: groupDef.species },
      });
      const sire = await prisma.animal.findFirst({
        where: { tenantId, name: sireEnvName, species: groupDef.species },
      });

      if (!dam) {
        console.log(`  ! Dam not found: ${damEnvName} - skipping group ${envGroupName}`);
        continue;
      }
      if (!sire) {
        console.log(`  ! Sire not found: ${sireEnvName} - skipping group ${envGroupName}`);
        continue;
      }

      // Create the offspring group
      group = await prisma.offspringGroup.create({
        data: {
          tenantId,
          name: envGroupName,
          species: groupDef.species,
          damId: dam.id,
          sireId: sire.id,
          actualBirthOn: new Date(groupDef.actualBirthOn),
          countBorn: groupDef.countBorn,
          countLive: groupDef.countLive,
          countStillborn: groupDef.countStillborn,
          countMale: groupDef.countMale,
          countFemale: groupDef.countFemale,
          countWeaned: groupDef.countWeaned,
          countPlaced: groupDef.countPlaced,
          weanedAt: groupDef.weanedAt ? new Date(groupDef.weanedAt) : null,
          placementCompletedAt: groupDef.placementCompletedAt ? new Date(groupDef.placementCompletedAt) : null,
          notes: groupDef.notes,
        },
      });
      groupsCreated++;

      console.log(`  + Created offspring group: ${envGroupName} (Dam: ${groupDef.damRef}, Sire: ${groupDef.sireRef})`);

      // Create offspring within this group
      for (const offspringDef of groupDef.offspring) {
        const envOffspringName = getEnvName(offspringDef.name, env);

        // Check if offspring already exists
        const existingOffspring = await prisma.offspring.findFirst({
          where: { tenantId, groupId: group.id, name: envOffspringName },
        });

        if (!existingOffspring) {
          const bornAt = new Date(groupDef.actualBirthOn);

          await prisma.offspring.create({
            data: {
              tenantId,
              groupId: group.id,
              name: envOffspringName,
              species: groupDef.species,
              breed: offspringDef.breed,
              sex: offspringDef.sex,
              bornAt,
              damId: dam.id,
              sireId: sire.id,
              lifeState: offspringDef.lifeState as OffspringLifeState,
              placementState: offspringDef.placementState as OffspringPlacementState,
              keeperIntent: offspringDef.keeperIntent as OffspringKeeperIntent,
              financialState: offspringDef.financialState as OffspringFinancialState,
              paperworkState: offspringDef.paperworkState as OffspringPaperworkState,
              collarColorName: offspringDef.collarColorName,
              collarColorHex: offspringDef.collarColorHex,
              collarAssignedAt: offspringDef.collarColorName ? bornAt : null,
              priceCents: offspringDef.priceCents,
              depositCents: offspringDef.depositCents,
              notes: offspringDef.notes,
              // If placed and paid, set placement date
              placedAt: offspringDef.placementState === 'PLACED' && groupDef.placementCompletedAt
                ? new Date(groupDef.placementCompletedAt)
                : null,
              paidInFullAt: offspringDef.financialState === 'PAID_IN_FULL' && groupDef.placementCompletedAt
                ? new Date(groupDef.placementCompletedAt)
                : null,
            },
          });
          offspringCreated++;
        }
      }

      console.log(`    + Created ${groupDef.offspring.length} offspring in group`);
    } else {
      console.log(`  = Offspring group exists: ${envGroupName}`);
    }
  }

  return { groups: groupsCreated, offspring: offspringCreated };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMAL HEALTH TRAITS SEEDING
// ═══════════════════════════════════════════════════════════════════════════════

async function seedAnimalHealthTraits(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  tenantHealth: Record<string, AnimalHealthDefinition[]>
): Promise<number> {
  const healthDefs = tenantHealth[tenantSlug] || [];
  let traitsCreated = 0;

  for (const healthDef of healthDefs) {
    // Look up animal by name (use env-prefixed name for DEV)
    const animalName = getEnvName(healthDef.animalRef, env);

    const animal = await prisma.animal.findFirst({
      where: { tenantId, name: animalName },
    });

    if (!animal) {
      // Try without prefix (some animal names don't get prefixed)
      const unprefixedAnimal = await prisma.animal.findFirst({
        where: { tenantId, name: healthDef.animalRef },
      });

      if (!unprefixedAnimal) {
        console.log(`  ! Animal not found: ${animalName} - skipping health traits`);
        continue;
      }

      // Use unprefixed animal
      for (const trait of healthDef.traits) {
        const created = await seedSingleHealthTrait(tenantId, unprefixedAnimal.id, trait);
        if (created) traitsCreated++;
      }
    } else {
      for (const trait of healthDef.traits) {
        const created = await seedSingleHealthTrait(tenantId, animal.id, trait);
        if (created) traitsCreated++;
      }
    }
  }

  return traitsCreated;
}

async function seedSingleHealthTrait(
  tenantId: number,
  animalId: number,
  trait: AnimalHealthDefinition['traits'][0]
): Promise<boolean> {
  // Look up the trait definition by key
  const traitDef = await prisma.traitDefinition.findFirst({
    where: {
      key: trait.traitKey,
      tenantId: null, // Global trait definitions
    },
  });

  if (!traitDef) {
    console.log(`    ! Trait definition not found: ${trait.traitKey}`);
    return false;
  }

  // Check if trait value already exists
  const existing = await prisma.animalTraitValue.findFirst({
    where: {
      tenantId,
      animalId,
      traitDefinitionId: traitDef.id,
    },
  });

  if (existing) {
    return false; // Already exists
  }

  // Create the trait value
  await prisma.animalTraitValue.create({
    data: {
      tenantId,
      animalId,
      traitDefinitionId: traitDef.id,
      valueBoolean: trait.valueBoolean ?? null,
      valueNumber: trait.valueNumber ?? null,
      valueText: trait.valueText ?? null,
      valueDate: trait.valueDate ? new Date(trait.valueDate) : null,
      valueJson: trait.valueJson ?? null,
      status: trait.status ? (trait.status as TraitStatus) : null,
      source: trait.source ? (trait.source as TraitSource) : null,
      performedAt: trait.performedAt ? new Date(trait.performedAt) : null,
      notes: trait.notes ?? null,
      verified: trait.verified ?? false,
      marketplaceVisible: trait.marketplaceVisible ?? null,
      networkVisible: trait.networkVisible ?? null,
    },
  });

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VACCINATION RECORD SEEDING
// ═══════════════════════════════════════════════════════════════════════════════

async function seedVaccinationRecords(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  tenantVaccinations: Record<string, AnimalVaccinationsDefinition[]>
): Promise<number> {
  const vaccinationDefs = tenantVaccinations[tenantSlug] || [];
  let recordsCreated = 0;

  for (const vacDef of vaccinationDefs) {
    // Skip animals with no vaccinations
    if (!vacDef.vaccinations || vacDef.vaccinations.length === 0) {
      continue;
    }

    // Look up animal by name (use env-prefixed name for DEV)
    const animalName = getEnvName(vacDef.animalRef, env);

    let animal = await prisma.animal.findFirst({
      where: { tenantId, name: animalName },
    });

    if (!animal) {
      // Try without prefix (some animal names don't get prefixed)
      animal = await prisma.animal.findFirst({
        where: { tenantId, name: vacDef.animalRef },
      });

      if (!animal) {
        console.log(`  ! Animal not found: ${vacDef.animalRef} - skipping vaccinations`);
        continue;
      }
    }

    // Create vaccination records for this animal
    for (const vac of vacDef.vaccinations) {
      // Check if vaccination record already exists for this animal + protocol
      const existing = await prisma.vaccinationRecord.findFirst({
        where: {
          tenantId,
          animalId: animal.id,
          protocolKey: vac.protocolKey,
        },
      });

      if (existing) {
        continue; // Already exists
      }

      // Create the vaccination record
      await prisma.vaccinationRecord.create({
        data: {
          tenantId,
          animalId: animal.id,
          protocolKey: vac.protocolKey,
          administeredAt: new Date(vac.administeredAt),
          expiresAt: vac.expiresAt ? new Date(vac.expiresAt) : null,
          veterinarian: vac.veterinarian ?? null,
          clinic: vac.clinic ?? null,
          batchLotNumber: vac.batchLotNumber ?? null,
          notes: vac.notes ?? null,
        },
      });

      recordsCreated++;
    }
  }

  return recordsCreated;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE LISTING SEEDING (LEGACY)
// NOTE: The old MarketplaceListing model was replaced with:
// - MktListingBreedingProgram
// - MktListingBreederService
// - MktListingAnimalProgram
// - MktListingIndividualAnimal
// These are now seeded via separate functions (seedStorefronts, seedBreedingProgramListings, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

async function seedMarketplaceListings(
  _tenantSlug: string,
  _tenantId: number,
  _env: Environment,
  _tenantMarketplaceListings: Record<string, any[]>
): Promise<void> {
  // Legacy function - marketplace listings are now seeded via:
  // - seedStorefronts()
  // - seedBreedingProgramListings()
  // - seedStudServiceListings()
  // - seedIndividualAnimalListings()
  console.log('  (Legacy function - new marketplace models seeded separately)');
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE STOREFRONT SEEDING (Business Profile, Breeds, Standards, Policies)
// ═══════════════════════════════════════════════════════════════════════════════

async function seedStorefronts(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  ownerUserId: number,
  storefronts: Record<string, StorefrontDefinition>
): Promise<{ storefronts: number; tenantProgramBreeds: number }> {
  const storefrontDef = storefronts[tenantSlug];
  if (!storefrontDef) {
    console.log(`  - No storefront definition for tenant: ${tenantSlug}`);
    return { storefronts: 0, tenantProgramBreeds: 0 };
  }

  let storefrontsCreated = 0;
  let tenantProgramBreedsCreated = 0;

  // Find or create the MarketplaceUser for this tenant's owner
  // The owner needs a MarketplaceUser record to be a provider
  const ownerUser = await prisma.user.findUnique({
    where: { id: ownerUserId },
  });

  if (!ownerUser) {
    console.log(`  ! Owner user not found: ${ownerUserId}`);
    return { storefronts: 0, tenantProgramBreeds: 0 };
  }

  // Check if a MarketplaceUser already exists for this email
  let marketplaceUser = await prisma.marketplaceUser.findUnique({
    where: { email: ownerUser.email },
  });

  if (!marketplaceUser) {
    // Create MarketplaceUser for the breeder
    const passwordHash = await bcrypt.hash('BHQ_Provider_2024!', 12);
    marketplaceUser = await prisma.marketplaceUser.create({
      data: {
        email: ownerUser.email,
        firstName: ownerUser.firstName || 'Breeder',
        lastName: ownerUser.lastName || 'Owner',
        passwordHash,
        emailVerified: true,
        userType: 'provider',
        status: 'active',
      },
    });
    console.log(`  + Created provider MarketplaceUser: ${ownerUser.email}`);
  }

  // Check if MarketplaceProvider already exists
  let provider = await prisma.marketplaceProvider.findUnique({
    where: { userId: marketplaceUser.id },
  });

  if (!provider) {
    // Create MarketplaceProvider (storefront)
    provider = await prisma.marketplaceProvider.create({
      data: {
        userId: marketplaceUser.id,
        tenantId,
        providerType: 'BREEDER',

        // Business info
        businessName: storefrontDef.businessName,
        businessDescription: storefrontDef.businessDescription,
        logoUrl: `https://placehold.co/400x400/005dc3/ffffff?text=${encodeURIComponent(storefrontDef.logoPlaceholderText)}`,
        coverImageUrl: `https://placehold.co/1200x400/f27517/ffffff?text=${encodeURIComponent(storefrontDef.bannerPlaceholderText)}`,

        // Contact
        publicEmail: storefrontDef.publicEmail,
        publicPhone: storefrontDef.publicPhone,
        website: storefrontDef.website,

        // Location
        city: storefrontDef.city,
        state: storefrontDef.state,
        country: storefrontDef.country,

        // Business hours & timezone
        businessHours: storefrontDef.businessHours,
        timeZone: storefrontDef.timezone,

        // Verification & Badges
        verificationTier: storefrontDef.verificationTier,
        verifiedProvider: storefrontDef.verificationTier === 'VERIFIED',
        quickResponder: storefrontDef.quickResponder,

        // Payment mode (manual for seed data)
        paymentMode: 'manual',
        stripeConnectOnboardingComplete: false,

        // Stats (initial values)
        totalListings: 0,
        activeListings: 0,
        averageRating: 4.5,
        totalReviews: 0,
      },
    });
    storefrontsCreated++;
    console.log(`  + Created storefront: ${storefrontDef.businessName}`);
  } else {
    console.log(`  = Storefront exists: ${storefrontDef.businessName}`);
  }

  // Seed TenantProgramBreed records (breeder's breeds)
  for (const breedDef of storefrontDef.breeds) {
    // Find the canonical breed by name
    const breed = await prisma.breed.findFirst({
      where: {
        name: breedDef.breedName,
        species: breedDef.species,
      },
    });

    if (!breed) {
      console.log(`  ! Breed not found: ${breedDef.breedName} (${breedDef.species})`);
      continue;
    }

    // Check if TenantProgramBreed already exists
    const existingProgramBreed = await prisma.tenantProgramBreed.findUnique({
      where: {
        tenantId_breedId: {
          tenantId,
          breedId: breed.id,
        },
      },
    });

    if (!existingProgramBreed) {
      await prisma.tenantProgramBreed.create({
        data: {
          tenantId,
          species: breedDef.species,
          breedId: breed.id,
          isPrimary: breedDef.isPrimary,
        },
      });
      tenantProgramBreedsCreated++;
      console.log(`    + Added program breed: ${breedDef.breedName} (${breedDef.species})${breedDef.isPrimary ? ' [PRIMARY]' : ''}`);
    } else {
      console.log(`    = Program breed exists: ${breedDef.breedName}`);
    }
  }

  // Store Standards & Credentials and Placement Policies in TenantSetting
  // Health Practices
  await upsertTenantSetting(tenantId, 'marketplace_health_practices', storefrontDef.healthPractices);

  // Breeding Practices
  await upsertTenantSetting(tenantId, 'marketplace_breeding_practices', storefrontDef.breedingPractices);

  // Care & Early Life
  await upsertTenantSetting(tenantId, 'marketplace_care_early_life', storefrontDef.careAndEarlyLife);

  // Placement Policies
  await upsertTenantSetting(tenantId, 'marketplace_placement_policies', storefrontDef.placementPolicies);

  // Registry Memberships
  await upsertTenantSetting(tenantId, 'marketplace_registry_memberships', storefrontDef.registryMemberships);

  console.log(`    + Saved Standards & Credentials settings`);
  console.log(`    + Saved Placement Policies settings`);

  return { storefronts: storefrontsCreated, tenantProgramBreeds: tenantProgramBreedsCreated };
}

async function upsertTenantSetting(tenantId: number, namespace: string, data: unknown): Promise<void> {
  const existing = await prisma.tenantSetting.findUnique({
    where: { tenantId_namespace: { tenantId, namespace } },
  });

  if (existing) {
    await prisma.tenantSetting.update({
      where: { tenantId_namespace: { tenantId, namespace } },
      data: { data: data as any },
    });
  } else {
    await prisma.tenantSetting.create({
      data: {
        tenantId,
        namespace,
        data: data as any,
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE BREEDING PROGRAM LISTINGS (MktListingBreedingProgram)
// ═══════════════════════════════════════════════════════════════════════════════

async function seedBreedingProgramListings(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  listings: Record<string, BreedingProgramListingDefinition[]>
): Promise<{ programs: number; media: number }> {
  const tenantListings = listings[tenantSlug];
  if (!tenantListings || tenantListings.length === 0) {
    console.log(`  - No breeding program listings for tenant: ${tenantSlug}`);
    return { programs: 0, media: 0 };
  }

  let programsCreated = 0;
  let mediaCreated = 0;

  for (const listing of tenantListings) {
    // Check if listing already exists
    const existing = await prisma.mktListingBreedingProgram.findUnique({
      where: {
        tenantId_slug: {
          tenantId,
          slug: listing.slug,
        },
      },
    });

    if (existing) {
      console.log(`  = Breeding program listing exists: ${listing.name}`);
      continue;
    }

    // Find the breed ID if we have one that matches
    const breed = await prisma.breed.findFirst({
      where: {
        name: listing.breedText,
        species: listing.species,
      },
    });

    // Map status
    const statusMap: Record<string, 'DRAFT' | 'LIVE' | 'PAUSED'> = {
      'DRAFT': 'DRAFT',
      'LIVE': 'LIVE',
      'PAUSED': 'PAUSED',
    };

    // Create the breeding program listing
    const program = await prisma.mktListingBreedingProgram.create({
      data: {
        tenantId,
        slug: listing.slug,
        name: listing.name,
        species: listing.species,
        breedText: listing.breedText,
        breedId: breed?.id,
        description: listing.description,
        programStory: listing.programStory,
        status: statusMap[listing.status] || 'DRAFT',
        acceptInquiries: listing.acceptInquiries,
        openWaitlist: listing.openWaitlist,
        acceptReservations: listing.acceptReservations,
        comingSoon: listing.comingSoon,
        pricingTiers: listing.pricingTiers || null,
        whatsIncluded: listing.whatsIncluded,
        showWhatsIncluded: listing.showWhatsIncluded ?? true,
        typicalWaitTime: listing.typicalWaitTime,
        showWaitTime: listing.showWaitTime ?? true,
        coverImageUrl: listing.coverImageText
          ? `https://placehold.co/1200x600/005dc3/ffffff?text=${encodeURIComponent(listing.coverImageText)}`
          : null,
        showCoverImage: true,
        publishedAt: listing.status === 'LIVE' ? new Date() : null,
      },
    });
    programsCreated++;
    console.log(`  + Created breeding program listing: ${listing.name} (${listing.status})`);

    // Create placeholder media for live programs
    if (listing.status === 'LIVE') {
      const mediaCount = 2; // 2 gallery images per program
      for (let i = 0; i < mediaCount; i++) {
        await prisma.breedingProgramMedia.create({
          data: {
            programId: program.id,
            tenantId,
            assetUrl: `https://placehold.co/800x600/f27517/ffffff?text=${encodeURIComponent(`${listing.name}+Gallery+${i + 1}`)}`,
            caption: `${listing.name} - Gallery Image ${i + 1}`,
            sortOrder: i,
            isPublic: true,
          },
        });
        mediaCreated++;
      }
      console.log(`    + Created ${mediaCount} media items for ${listing.name}`);
    }
  }

  return { programs: programsCreated, media: mediaCreated };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUD SERVICE LISTINGS (MktListingBreederService)
// ═══════════════════════════════════════════════════════════════════════════════

async function seedStudServiceListings(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  listings: Record<string, StudServiceListingDefinition[]>
): Promise<number> {
  const tenantListings = listings[tenantSlug];
  if (!tenantListings || tenantListings.length === 0) {
    console.log(`  - No stud service listings for tenant: ${tenantSlug}`);
    return 0;
  }

  let created = 0;

  for (const listing of tenantListings) {
    // Find the stallion by name
    const stallion = await prisma.animal.findFirst({
      where: {
        tenantId,
        name: listing.stallionRef,
        sex: 'MALE',
        species: 'HORSE',
      },
    });

    if (!stallion) {
      console.log(`  ! Stallion not found: ${listing.stallionRef}`);
      continue;
    }

    // Check if listing already exists
    const existing = await prisma.mktListingBreederService.findUnique({
      where: { slug: listing.slug },
    });

    if (existing) {
      console.log(`  = Stud service listing exists: ${listing.title}`);
      continue;
    }

    // Map guarantee type to Prisma enum
    const guaranteeMap: Record<string, 'NO_GUARANTEE' | 'LIVE_FOAL' | 'STANDS_AND_NURSES' | 'SIXTY_DAY_PREGNANCY' | 'CERTIFIED_PREGNANT'> = {
      'NO_GUARANTEE': 'NO_GUARANTEE',
      'LIVE_FOAL': 'LIVE_FOAL',
      'STANDS_AND_NURSES': 'STANDS_AND_NURSES',
      'SIXTY_DAY_PREGNANCY': 'SIXTY_DAY_PREGNANCY',
      'CERTIFIED_PREGNANT': 'CERTIFIED_PREGNANT',
    };

    await prisma.mktListingBreederService.create({
      data: {
        tenant: { connect: { id: tenantId } },
        listingType: 'STUD_SERVICE',
        title: listing.title,
        slug: listing.slug,
        description: listing.description,
        stallion: { connect: { id: stallion.id } },
        status: listing.status,
        priceCents: listing.priceCents,
        priceType: 'fixed',
        tier: 'PREMIUM',
        publishedAt: listing.status === 'LIVE' ? new Date() : null,
        // Stud service specific fields
        seasonName: listing.seasonName,
        seasonStart: listing.seasonStart,
        seasonEnd: listing.seasonEnd,
        breedingMethods: listing.breedingMethods,
        defaultGuarantee: guaranteeMap[listing.defaultGuarantee],
        maxBookings: listing.maxBookings,
        bookingsReceived: listing.bookingsReceived || 0,
        // Note: bookingFeeCents moved inside horseServiceData
        horseServiceData: {
          ...(listing.horseServiceData || {}),
          bookingFeeCents: listing.bookingFeeCents,
        },
      },
    });
    created++;
    console.log(`  + Created stud service listing: ${listing.title}`);
  }

  return created;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDIVIDUAL ANIMAL LISTINGS (MktListingIndividualAnimal)
// ═══════════════════════════════════════════════════════════════════════════════

async function seedIndividualAnimalListings(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  listings: Record<string, IndividualAnimalListingDefinition[]>
): Promise<number> {
  const tenantListings = listings[tenantSlug];
  if (!tenantListings || tenantListings.length === 0) {
    console.log(`  - No individual animal listings for tenant: ${tenantSlug}`);
    return 0;
  }

  let created = 0;

  for (const listing of tenantListings) {
    // Find the animal by name
    const animal = await prisma.animal.findFirst({
      where: {
        tenantId,
        name: listing.animalRef,
      },
    });

    if (!animal) {
      console.log(`  ! Animal not found: ${listing.animalRef}`);
      continue;
    }

    // Check if listing already exists
    const existing = await prisma.mktListingIndividualAnimal.findUnique({
      where: { slug: listing.slug },
    });

    if (existing) {
      console.log(`  = Individual animal listing exists: ${listing.headline}`);
      continue;
    }

    // Map guarantee type to Prisma enum (if present)
    const guaranteeMap: Record<string, 'NO_GUARANTEE' | 'LIVE_FOAL' | 'STANDS_AND_NURSES' | 'SIXTY_DAY_PREGNANCY' | 'CERTIFIED_PREGNANT' | undefined> = {
      'NO_GUARANTEE': 'NO_GUARANTEE',
      'LIVE_FOAL': 'LIVE_FOAL',
      'STANDS_AND_NURSES': 'STANDS_AND_NURSES',
      'SIXTY_DAY_PREGNANCY': 'SIXTY_DAY_PREGNANCY',
      'CERTIFIED_PREGNANT': 'CERTIFIED_PREGNANT',
    };

    await prisma.mktListingIndividualAnimal.create({
      data: {
        tenantId,
        animalId: animal.id,
        templateType: listing.templateType,
        slug: listing.slug,
        headline: listing.headline,
        summary: listing.summary,
        description: listing.description,
        priceModel: listing.priceModel,
        priceCents: listing.priceCents,
        priceMinCents: listing.priceMinCents,
        priceMaxCents: listing.priceMaxCents,
        status: listing.status,
        listed: listing.listed,
        publishedAt: listing.status === 'LIVE' ? new Date() : null,
        // Default data drawer config
        dataDrawerConfig: {
          identity: { showName: true, showSpecies: true, showBreed: true },
          media: { showPhotos: true },
          healthTesting: { showResults: true },
        },
        // Stud service fields (if templateType is STUD_SERVICES)
        seasonName: listing.seasonName,
        seasonStart: listing.seasonStart,
        seasonEnd: listing.seasonEnd,
        breedingMethods: listing.breedingMethods || [],
        defaultGuaranteeType: listing.defaultGuaranteeType ? guaranteeMap[listing.defaultGuaranteeType] : undefined,
        bookingFeeCents: listing.bookingFeeCents,
      },
    });
    created++;
    console.log(`  + Created individual animal listing: ${listing.headline}`);
  }

  return created;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-TENANT PEDIGREE LINKS
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT TEMPLATES AND INSTANCES
// ═══════════════════════════════════════════════════════════════════════════════

async function seedContractTemplates(
  templates: ContractTemplateDefinition[]
): Promise<number> {
  let created = 0;

  for (const template of templates) {
    // Check if template already exists
    const existing = await prisma.contractTemplate.findUnique({
      where: { slug: template.slug },
    });

    if (existing) {
      console.log(`  = Contract template exists: ${template.name}`);
      continue;
    }

    await prisma.contractTemplate.create({
      data: {
        tenantId: null,  // System templates have no tenant
        name: template.name,
        slug: template.slug,
        type: template.type === 'SYSTEM' ? 'SYSTEM' : 'CUSTOM',
        category: template.category,  // Already matches Prisma ContractTemplateCategory enum
        description: template.description,
        isActive: template.isActive,
        bodyHtml: `<p>This is a placeholder for the ${template.name} contract template.</p>`,
        mergeFields: [
          { key: 'buyer.name', label: 'Buyer Name', namespace: 'buyer', required: true },
          { key: 'animal.name', label: 'Animal Name', namespace: 'animal', required: true },
          { key: 'price', label: 'Price', namespace: 'sale', required: true },
          { key: 'date', label: 'Date', namespace: 'contract', required: true },
        ],
      },
    });
    created++;
    console.log(`  + Created contract template: ${template.name}`);
  }

  return created;
}

async function seedContractInstances(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  instances: Record<string, ContractInstanceDefinition[]>,
  tenantContacts: Record<string, any[]>
): Promise<number> {
  const tenantInstances = instances[tenantSlug] || [];
  const contactDefs = tenantContacts[tenantSlug] || [];
  let created = 0;

  for (const instance of tenantInstances) {
    if (instance.contactIndex >= contactDefs.length) continue;

    const contactDef = contactDefs[instance.contactIndex];
    const contactEmail = getEnvEmail(contactDef.emailBase, env);

    // Find the contact
    const contact = await prisma.contact.findFirst({
      where: { tenantId, email: contactEmail },
      include: { party: true },
    });

    if (!contact || !contact.partyId) {
      console.log(`  ! Contact not found: ${contactEmail}`);
      continue;
    }

    // Find the template
    const template = await prisma.contractTemplate.findUnique({
      where: { slug: instance.templateSlug },
    });

    if (!template) {
      console.log(`  ! Template not found: ${instance.templateSlug}`);
      continue;
    }

    // Check if contract already exists
    const existing = await prisma.contract.findFirst({
      where: {
        tenantId,
        title: instance.title,
      },
    });

    if (existing) {
      console.log(`  = Contract exists: ${instance.title}`);
      continue;
    }

    // Calculate dates based on status and daysAgo
    const createdAt = new Date(Date.now() - instance.daysAgo * 24 * 60 * 60 * 1000);
    const issuedAt = ['sent', 'viewed', 'signed', 'countersigned', 'completed', 'declined', 'expired'].includes(instance.status)
      ? new Date(createdAt.getTime() + 1 * 24 * 60 * 60 * 1000)  // 1 day after creation
      : null;
    const signedAt = ['signed', 'countersigned', 'completed'].includes(instance.status)
      ? new Date(createdAt.getTime() + 5 * 24 * 60 * 60 * 1000)  // 5 days after creation
      : null;
    const expiresAt = instance.status === 'expired'
      ? new Date(createdAt.getTime() - 1 * 24 * 60 * 60 * 1000)  // Already expired
      : new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);  // 30 days from creation

    // Map status (Prisma ContractStatus: draft, sent, viewed, signed, declined, voided, expired)
    const statusMap: Record<string, 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'voided' | 'expired'> = {
      'draft': 'draft',
      'pending': 'sent',  // pending -> sent
      'sent': 'sent',
      'viewed': 'viewed',
      'signed': 'signed',
      'countersigned': 'signed',  // countersigned -> signed
      'completed': 'signed',  // completed -> signed
      'declined': 'declined',
      'voided': 'voided',
      'expired': 'expired',
    };

    // Create the contract
    const contract = await prisma.contract.create({
      data: {
        tenantId,
        templateId: template.id,
        title: instance.title,
        status: statusMap[instance.status] || 'draft',
        issuedAt,
        signedAt,
        expiresAt,
        createdAt,
        provider: 'internal',
      },
    });

    // Create contract party (the buyer)
    await prisma.contractParty.create({
      data: {
        tenantId,
        contractId: contract.id,
        partyId: contact.partyId,
        role: 'BUYER',
        signer: true,
        status: signedAt ? 'signed' : 'pending',
        signedAt: signedAt,
        signatureData: signedAt ? { method: 'TYPED' } : null,
      },
    });

    created++;
    console.log(`  + Created contract: ${instance.title} (${instance.status})`);
  }

  return created;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 7: MESSAGE TEMPLATES & AUTO-REPLY RULES
// ═══════════════════════════════════════════════════════════════════════════════

async function seedMessageTemplates(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  templates: Record<string, MessageTemplateDefinition[]>
): Promise<number> {
  const tenantTemplates = templates[tenantSlug] || [];
  let created = 0;

  for (const tpl of tenantTemplates) {
    // Check if template already exists
    const existing = await prisma.template.findFirst({
      where: {
        tenantId,
        key: tpl.key,
      },
    });

    if (existing) {
      console.log(`  = Template exists: ${tpl.name}`);
      continue;
    }

    // Map status to Prisma TemplateStatus enum (draft, active, archived)
    const statusMap: Record<string, 'draft' | 'active' | 'archived'> = {
      'draft': 'draft',
      'active': 'active',
      'paused': 'draft',  // paused -> draft (no paused in Prisma enum)
      'archived': 'archived',
    };

    // Create the template
    const template = await prisma.template.create({
      data: {
        tenantId,
        name: tpl.name,
        key: tpl.key,
        channel: tpl.channel,
        category: tpl.category,
        status: statusMap[tpl.status] || 'draft',
        description: tpl.description,
      },
    });

    // Create template content
    await prisma.templateContent.create({
      data: {
        templateId: template.id,
        subject: tpl.subject,
        bodyText: tpl.bodyText,
        bodyHtml: tpl.bodyHtml,
      },
    });

    created++;
    console.log(`  + Created template: ${tpl.name} (${tpl.channel}/${tpl.status})`);
  }

  return created;
}

async function seedAutoReplyRules(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  rules: Record<string, AutoReplyRuleDefinition[]>
): Promise<number> {
  const tenantRules = rules[tenantSlug] || [];
  let created = 0;

  for (const rule of tenantRules) {
    // Find the template for this rule
    const template = await prisma.template.findFirst({
      where: {
        tenantId,
        key: rule.templateKey,
      },
    });

    if (!template) {
      console.log(`  ! Template not found for rule: ${rule.name} (key: ${rule.templateKey})`);
      continue;
    }

    // Check if rule already exists
    const existing = await prisma.autoReplyRule.findFirst({
      where: {
        tenantId,
        name: rule.name,
      },
    });

    if (existing) {
      console.log(`  = Auto-reply rule exists: ${rule.name}`);
      continue;
    }

    // Create the rule
    await prisma.autoReplyRule.create({
      data: {
        tenantId,
        name: rule.name,
        description: rule.description,
        channel: rule.channel,
        status: rule.status,
        templateId: template.id,
        triggerType: rule.triggerType,
        keywordConfigJson: rule.keywordConfig ? rule.keywordConfig : undefined,
        timeBasedConfigJson: rule.timeBasedConfig ? rule.timeBasedConfig : undefined,
        businessHoursJson: rule.businessHoursConfig ? rule.businessHoursConfig : undefined,
        cooldownMinutes: rule.cooldownMinutes || 60,
        enabled: rule.status === 'active',
      },
    });

    created++;
    console.log(`  + Created auto-reply rule: ${rule.name} (${rule.triggerType}/${rule.status})`);
  }

  return created;
}

async function seedTenantSettings(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  settings: Record<string, TenantSettingDefinition[]>
): Promise<number> {
  const tenantSettings = settings[tenantSlug] || [];
  let created = 0;

  for (const setting of tenantSettings) {
    // Check if setting already exists
    const existing = await prisma.tenantSetting.findUnique({
      where: {
        tenantId_namespace: {
          tenantId,
          namespace: setting.namespace,
        },
      },
    });

    if (existing) {
      console.log(`  = Setting exists: ${setting.namespace}`);
      continue;
    }

    // Create the setting
    await prisma.tenantSetting.create({
      data: {
        tenantId,
        namespace: setting.namespace,
        data: setting.data,
        version: 1,
      },
    });

    created++;
    console.log(`  + Created setting: ${setting.namespace}`);
  }

  return created;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 8: ENHANCED INVOICES, PAYMENTS, PARTY ACTIVITY
// ═══════════════════════════════════════════════════════════════════════════════

async function seedEnhancedInvoices(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  invoices: Record<string, EnhancedInvoiceDefinition[]>,
  tenantContacts: Record<string, any[]>
): Promise<{ invoices: number; lineItems: number; payments: number }> {
  const tenantInvoices = invoices[tenantSlug] || [];
  const contactDefs = tenantContacts[tenantSlug] || [];
  let invoiceCount = 0;
  let lineItemCount = 0;
  let paymentCount = 0;

  for (const inv of tenantInvoices) {
    if (inv.contactIndex >= contactDefs.length) continue;

    const contactDef = contactDefs[inv.contactIndex];
    const contactEmail = getEnvEmail(contactDef.emailBase, env);

    // Find the contact
    const contact = await prisma.contact.findFirst({
      where: { tenantId, email: contactEmail },
      include: { party: true },
    });

    if (!contact || !contact.partyId) {
      console.log(`  ! Contact not found: ${contactEmail}`);
      continue;
    }

    // Check if invoice already exists
    const existing = await prisma.invoice.findFirst({
      where: {
        tenantId,
        invoiceNumber: inv.invoiceNumber,
      },
    });

    if (existing) {
      console.log(`  = Invoice exists: ${inv.invoiceNumber}`);
      continue;
    }

    // Calculate totals
    const subtotalCents = inv.lineItems.reduce((sum, item) => {
      const itemTotal = item.qty * item.unitCents - (item.discountCents || 0);
      return sum + itemTotal;
    }, 0);

    const paidCents = inv.payments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amountCents, 0);

    // Calculate dates
    const createdAt = new Date(Date.now() - inv.daysAgo * 24 * 60 * 60 * 1000);
    const dueAt = inv.dueInDays
      ? new Date(createdAt.getTime() + inv.dueInDays * 24 * 60 * 60 * 1000)
      : new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Create the invoice (using schema fields: amountCents, balanceCents, clientPartyId)
    const balanceCents = subtotalCents - paidCents;
    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        clientPartyId: contact.partyId,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        category: inv.category,
        amountCents: BigInt(subtotalCents),
        balanceCents: BigInt(balanceCents),
        scope: FinanceScope.contact,
        notes: inv.notes,
        dueAt,
        createdAt,
        paidAt: paidCents >= subtotalCents ? new Date() : null,
      },
    });

    invoiceCount++;
    console.log(`  + Created invoice: ${inv.invoiceNumber} (${inv.status})`);

    // Create line items
    for (const item of inv.lineItems) {
      const totalCents = item.qty * item.unitCents - (item.discountCents || 0);
      await prisma.invoiceLineItem.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          kind: item.kind,
          description: item.description,
          qty: item.qty,
          unitCents: item.unitCents,
          discountCents: item.discountCents,
          taxRate: item.taxRate,
          totalCents,
        },
      });
      lineItemCount++;
    }

    // Create payments
    for (const payment of inv.payments) {
      const receivedAt = new Date(Date.now() - payment.daysAgo * 24 * 60 * 60 * 1000);
      await prisma.payment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          status: payment.status,
          amountCents: BigInt(payment.amountCents),
          receivedAt,
          methodType: payment.methodType,
          processor: payment.processor,
          notes: payment.notes,
        },
      });
      paymentCount++;
    }
  }

  return { invoices: invoiceCount, lineItems: lineItemCount, payments: paymentCount };
}

async function seedPartyActivities(
  tenantSlug: string,
  tenantId: number,
  env: Environment,
  activities: Record<string, PartyActivityDefinition[]>,
  tenantContacts: Record<string, any[]>
): Promise<number> {
  const tenantActivities = activities[tenantSlug] || [];
  const contactDefs = tenantContacts[tenantSlug] || [];
  let created = 0;

  for (const activity of tenantActivities) {
    if (activity.contactIndex >= contactDefs.length) continue;

    const contactDef = contactDefs[activity.contactIndex];
    const contactEmail = getEnvEmail(contactDef.emailBase, env);

    // Find the contact
    const contact = await prisma.contact.findFirst({
      where: { tenantId, email: contactEmail },
      include: { party: true },
    });

    if (!contact || !contact.partyId) continue;

    // Check if activity already exists (by title and approximate time)
    const createdAt = new Date(Date.now() - activity.daysAgo * 24 * 60 * 60 * 1000);
    const dayStart = new Date(createdAt.setHours(0, 0, 0, 0));
    const dayEnd = new Date(createdAt.setHours(23, 59, 59, 999));

    const existing = await prisma.partyActivity.findFirst({
      where: {
        tenantId,
        partyId: contact.partyId,
        title: activity.title,
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    if (existing) continue;

    // Create the activity
    await prisma.partyActivity.create({
      data: {
        tenantId,
        partyId: contact.partyId,
        kind: activity.kind,
        title: activity.title,
        detail: activity.detail,
        metadata: activity.metadata,
        createdAt: new Date(Date.now() - activity.daysAgo * 24 * 60 * 60 * 1000),
      },
    });

    created++;
  }

  if (created > 0) {
    console.log(`  + Created ${created} party activity records`);
  }

  return created;
}

async function seedCrossTenantLinks(
  env: Environment,
  linkDefs: CrossTenantLinkDefinition[]
): Promise<number> {
  if (!linkDefs || linkDefs.length === 0) {
    console.log('  - No cross-tenant links to seed');
    return 0;
  }

  let created = 0;

  for (const linkDef of linkDefs) {
    // Find the child tenant
    const childTenantSlug = getEnvSlug(linkDef.childTenantSlug, env);
    const childTenant = await prisma.tenant.findUnique({
      where: { slug: childTenantSlug },
    });

    if (!childTenant) {
      console.log(`  ! Child tenant not found: ${childTenantSlug}`);
      continue;
    }

    // Find the parent tenant
    const parentTenantSlug = getEnvSlug(linkDef.parentTenantSlug, env);
    const parentTenant = await prisma.tenant.findUnique({
      where: { slug: parentTenantSlug },
    });

    if (!parentTenant) {
      console.log(`  ! Parent tenant not found: ${parentTenantSlug}`);
      continue;
    }

    // Find the child animal
    const childAnimal = await prisma.animal.findFirst({
      where: {
        tenantId: childTenant.id,
        name: linkDef.childAnimalRef,
      },
    });

    if (!childAnimal) {
      console.log(`  ! Child animal not found: ${linkDef.childAnimalRef} in ${childTenantSlug}`);
      continue;
    }

    // Find the parent animal
    const parentAnimal = await prisma.animal.findFirst({
      where: {
        tenantId: parentTenant.id,
        name: linkDef.parentAnimalRef,
      },
    });

    if (!parentAnimal) {
      console.log(`  ! Parent animal not found: ${linkDef.parentAnimalRef} in ${parentTenantSlug}`);
      continue;
    }

    // Check if link already exists
    const existingLink = await prisma.crossTenantAnimalLink.findUnique({
      where: {
        childAnimalId_parentType: {
          childAnimalId: childAnimal.id,
          parentType: linkDef.parentType,
        },
      },
    });

    if (existingLink) {
      console.log(`  = Cross-tenant link exists: ${linkDef.childAnimalRef} <- ${linkDef.parentAnimalRef} (${linkDef.parentType})`);
      continue;
    }

    // Map link method
    const linkMethodMap: Record<string, 'SEARCH' | 'EXCHANGE_CODE' | 'MANUAL'> = {
      'SEARCH': 'SEARCH',
      'EXCHANGE_CODE': 'EXCHANGE_CODE',
      'MANUAL': 'MANUAL',
    };

    // Create the cross-tenant link
    await prisma.crossTenantAnimalLink.create({
      data: {
        childAnimalId: childAnimal.id,
        childTenantId: childTenant.id,
        parentAnimalId: parentAnimal.id,
        parentTenantId: parentTenant.id,
        parentType: linkDef.parentType,
        linkMethod: linkMethodMap[linkDef.linkMethod] || 'MANUAL',
        active: true,
      },
    });
    created++;
    console.log(`  + Created cross-tenant link: ${linkDef.childAnimalRef} (${childTenantSlug}) <- ${linkDef.parentAnimalRef} (${parentTenantSlug}) [${linkDef.parentType}]`);
  }

  return created;
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
// These users log in via the marketplace app (marketplace.breederhq.com)
// They need MarketplaceUser records, not regular User records
// ═══════════════════════════════════════════════════════════════════════════════

async function seedMarketplaceUsers(
  env: Environment,
  marketplaceUserDefs: MarketplaceUserDefinition[]
): Promise<number> {
  let createdCount = 0;

  for (const userDef of marketplaceUserDefs) {
    const envEmail = getEnvEmail(userDef.emailBase, env);

    // Check if marketplace user already exists
    let marketplaceUser = await prisma.marketplaceUser.findUnique({
      where: { email: envEmail },
    });

    if (!marketplaceUser) {
      const passwordHash = await bcrypt.hash(userDef.password, 12);
      marketplaceUser = await prisma.marketplaceUser.create({
        data: {
          email: envEmail,
          firstName: userDef.firstName,
          lastName: userDef.lastName,
          passwordHash,
          emailVerified: true,
          userType: 'buyer',
          status: 'active',
        },
      });
      console.log(`  + Created marketplace shopper: ${envEmail} (${userDef.description})`);
      createdCount++;
    } else {
      console.log(`  = Marketplace shopper exists: ${envEmail}`);
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
            // Map waitlist status to Prisma enum
            const waitlistStatusMap: Record<string, WaitlistStatus> = {
              'INQUIRY': WaitlistStatus.INQUIRY,
              'APPROVED': WaitlistStatus.APPROVED,
              'DEPOSIT_DUE': WaitlistStatus.DEPOSIT_DUE,
              'DEPOSIT_PAID': WaitlistStatus.DEPOSIT_PAID,
              'READY': WaitlistStatus.READY,
              'ALLOCATED': WaitlistStatus.ALLOCATED,
              'COMPLETED': WaitlistStatus.COMPLETED,
              'CANCELED': WaitlistStatus.CANCELED,
              'REJECTED': WaitlistStatus.REJECTED,
            };
            const waitlistStatus = waitlistStatusMap[metaDef.waitlistStatus || 'INQUIRY'] || WaitlistStatus.INQUIRY;

            // Determine dates based on status
            const approvedAt = ['APPROVED', 'DEPOSIT_DUE', 'DEPOSIT_PAID', 'READY', 'ALLOCATED', 'COMPLETED'].includes(metaDef.waitlistStatus || '')
              ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)  // 30 days ago
              : null;
            const depositPaidAt = ['DEPOSIT_PAID', 'READY', 'ALLOCATED', 'COMPLETED'].includes(metaDef.waitlistStatus || '')
              ? new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)  // 20 days ago
              : null;
            const rejectedAt = metaDef.waitlistStatus === 'REJECTED'
              ? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
              : null;

            await prisma.waitlistEntry.create({
              data: {
                tenantId,
                planId: breedingPlan.id,
                clientPartyId: contact.partyId,
                priority: metaDef.waitlistPosition,
                status: waitlistStatus,
                // Preferences
                speciesPref: metaDef.waitlistSpeciesPref || null,
                breedPrefs: metaDef.waitlistBreedPrefs ? { breeds: metaDef.waitlistBreedPrefs } : null,
                // Financial
                depositRequiredCents: metaDef.depositAmountCents || 50000,
                depositPaidCents: depositPaidAt ? (metaDef.depositAmountCents || 50000) : 0,
                depositPaidAt,
                // Status dates
                approvedAt,
                rejectedAt,
                rejectedReason: metaDef.waitlistStatus === 'REJECTED' ? 'Application did not meet requirements' : null,
                // Origin tracking
                originSource: metaDef.waitlistOriginSource || null,
                originPagePath: metaDef.waitlistOriginPagePath || null,
                notes: `Seeded waitlist entry - position ${metaDef.waitlistPosition}`,
              },
            });
            waitlistEntriesCreated++;
            console.log(`  + Created waitlist entry: ${contact.display_name} -> ${planEnvName} (#${metaDef.waitlistPosition}, ${metaDef.waitlistStatus || 'INQUIRY'})`);
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
        const tenantShort = tenantSlug.substring(0, 3).toUpperCase();
        const invoiceNum = `INV-${year}-${tenantShort}-DEP${String(metaDef.contactIndex + 1).padStart(4, '0')}`;
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
        const tenantShort = tenantSlug.substring(0, 3).toUpperCase();
        const invoiceNum = `INV-${year}-${tenantShort}-PUR${String(metaDef.contactIndex + 1).padStart(4, '0')}`;
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
  const tenantOffspringGroups = getTenantOffspringGroups(env);
  const tenantHealth = getTenantHealth(env);
  const tenantVaccinations = getTenantVaccinations(env);
  const tenantMarketplaceListings = getTenantMarketplaceListings(env);
  const portalAccessDefinitions = getPortalAccessDefinitions(env);
  const marketplaceUserDefs = getMarketplaceUsers();
  const contactMetaDefs = getContactMeta(env);
  const emailDefs = getEmails(env);
  const dmThreadDefs = getDMThreads(env);
  const draftDefs = getDrafts(env);
  const storefrontDefs = getStorefronts(env);
  const breedingAttemptDefs = getBreedingAttempts(env);
  const pregnancyCheckDefs = getPregnancyChecks(env);
  const testResultDefs = getTestResults(env);
  const breedingMilestoneDefs = getBreedingMilestones(env);
  const foalingOutcomeDefs = getFoalingOutcomes(env);
  const mareHistoryDefs = getMareHistory(env);

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
    offspringGroups: 0,
    offspring: 0,
    healthTraits: 0,
    vaccinations: 0,
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
    storefronts: 0,
    tenantProgramBreeds: 0,
    breedingAttempts: 0,
    pregnancyChecks: 0,
    testResults: 0,
    breedingMilestones: 0,
    foalingOutcomes: 0,
    mareHistory: 0,
    breedingProgramListings: 0,
    breedingProgramMedia: 0,
    studServiceListings: 0,
    individualAnimalListings: 0,
    crossTenantLinks: 0,
    contractTemplates: 0,
    contracts: 0,
    messageTemplates: 0,
    autoReplyRules: 0,
    tenantSettings: 0,
    enhancedInvoices: 0,
    invoiceLineItems: 0,
    payments: 0,
    partyActivities: 0,
  };

  // Seed global title definitions FIRST (before any tenant-specific titles)
  console.log('─────────────────────────────────────────────────────────────────────────────');
  console.log('  GLOBAL TITLE DEFINITIONS');
  console.log('─────────────────────────────────────────────────────────────────────────────');
  await seedTitleDefinitions();

  // Seed global contract templates
  console.log('─────────────────────────────────────────────────────────────────────────────');
  console.log('  CONTRACT TEMPLATES (System Templates)');
  console.log('─────────────────────────────────────────────────────────────────────────────');
  const contractTemplatesCreated = await seedContractTemplates(SYSTEM_CONTRACT_TEMPLATES);
  stats.contractTemplates = contractTemplatesCreated;

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

    // 6a. Create breeding attempts
    console.log('\n  [Breeding Attempts]');
    const attemptsCreated = await seedBreedingAttempts(tenantDef.slug, tenantId, env, breedingAttemptDefs);
    stats.breedingAttempts += attemptsCreated;

    // 6b. Create pregnancy checks
    console.log('\n  [Pregnancy Checks]');
    const checksCreated = await seedPregnancyChecks(tenantDef.slug, tenantId, env, pregnancyCheckDefs);
    stats.pregnancyChecks += checksCreated;

    // 6c. Create test results (progesterone, follicle exams, etc.)
    console.log('\n  [Test Results]');
    const resultsCreated = await seedTestResults(tenantDef.slug, tenantId, env, testResultDefs);
    stats.testResults += resultsCreated;

    // 6d. Create breeding milestones (for horse pregnancy plans)
    console.log('\n  [Breeding Milestones]');
    const milestonesCreated = await seedBreedingMilestones(tenantDef.slug, tenantId, env, breedingMilestoneDefs);
    stats.breedingMilestones += milestonesCreated;

    // 6e. Create foaling outcomes (for birthed/complete horse plans)
    console.log('\n  [Foaling Outcomes]');
    const outcomesCreated = await seedFoalingOutcomes(tenantDef.slug, tenantId, env, foalingOutcomeDefs);
    stats.foalingOutcomes += outcomesCreated;

    // 6f. Create mare reproductive history
    console.log('\n  [Mare Reproductive History]');
    const historyCreated = await seedMareReproductiveHistory(tenantDef.slug, tenantId, env, mareHistoryDefs);
    stats.mareHistory += historyCreated;

    // 6g. Create historical offspring groups and offspring
    console.log('\n  [Offspring Groups & Offspring]');
    const { groups: groupsCreated, offspring: offspringCreated } = await seedOffspringGroups(
      tenantDef.slug,
      tenantId,
      env,
      tenantOffspringGroups
    );
    stats.offspringGroups += groupsCreated;
    stats.offspring += offspringCreated;

    // 6c. Create animal health traits
    console.log('\n  [Animal Health Traits]');
    const healthTraitsCreated = await seedAnimalHealthTraits(
      tenantDef.slug,
      tenantId,
      env,
      tenantHealth
    );
    stats.healthTraits += healthTraitsCreated;
    if (healthTraitsCreated > 0) {
      console.log(`  + Created ${healthTraitsCreated} health trait values`);
    }

    // 6b. Create vaccination records
    console.log('\n  [Vaccination Records]');
    const vaccinationsCreated = await seedVaccinationRecords(
      tenantDef.slug,
      tenantId,
      env,
      tenantVaccinations
    );
    stats.vaccinations += vaccinationsCreated;
    if (vaccinationsCreated > 0) {
      console.log(`  + Created ${vaccinationsCreated} vaccination records`);
    }

    // 7. Create marketplace listings
    console.log('\n  [Marketplace Listings]');
    await seedMarketplaceListings(tenantDef.slug, tenantId, env, tenantMarketplaceListings);
    stats.marketplaceListings += (
      tenantMarketplaceListings[tenantDef.slug] || []
    ).length;

    // 7b. Create marketplace storefront (business profile, breeds, standards, policies)
    console.log('\n  [Marketplace Storefront]');
    const { storefronts: storefrontsCreated, tenantProgramBreeds: breedsCreated } = await seedStorefronts(
      tenantDef.slug,
      tenantId,
      env,
      ownerUserId,
      storefrontDefs
    );
    stats.storefronts += storefrontsCreated;
    stats.tenantProgramBreeds += breedsCreated;

    // 7c. Create breeding program listings (MktListingBreedingProgram)
    console.log('\n  [Breeding Program Listings]');
    const breedingProgramListingDefs = getBreedingProgramListings(env);
    const { programs: programsCreated, media: programMediaCreated } = await seedBreedingProgramListings(
      tenantDef.slug,
      tenantId,
      env,
      breedingProgramListingDefs
    );
    stats.breedingProgramListings += programsCreated;
    stats.breedingProgramMedia += programMediaCreated;

    // 7d. Create stud service listings (MktListingBreederService)
    console.log('\n  [Stud Service Listings]');
    const studServiceListingDefs = getStudServiceListings(env);
    const studServicesCreated = await seedStudServiceListings(
      tenantDef.slug,
      tenantId,
      env,
      studServiceListingDefs
    );
    stats.studServiceListings += studServicesCreated;

    // 7e. Create individual animal listings (MktListingIndividualAnimal)
    console.log('\n  [Individual Animal Listings]');
    const individualAnimalListingDefs = getIndividualAnimalListings(env);
    const individualListingsCreated = await seedIndividualAnimalListings(
      tenantDef.slug,
      tenantId,
      env,
      individualAnimalListingDefs
    );
    stats.individualAnimalListings += individualListingsCreated;

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

    // 14. Create contract instances
    console.log('\n  [Contracts]');
    const contractInstanceDefs = getContractInstances(env);
    const contractsCreated = await seedContractInstances(
      tenantDef.slug,
      tenantId,
      env,
      contractInstanceDefs,
      tenantContacts
    );
    stats.contracts += contractsCreated;

    // ───────────────────────────────────────────────────────────────────────────
    // PHASE 7: Message Templates & Auto-Reply Rules
    // ───────────────────────────────────────────────────────────────────────────

    // 15. Create message templates
    console.log('\n  [Message Templates]');
    const messageTemplateDefs = getMessageTemplates(env);
    const templatesCreated = await seedMessageTemplates(
      tenantDef.slug,
      tenantId,
      env,
      messageTemplateDefs
    );
    stats.messageTemplates += templatesCreated;

    // 16. Create auto-reply rules
    console.log('\n  [Auto-Reply Rules]');
    const autoReplyRuleDefs = getAutoReplyRules(env);
    const rulesCreated = await seedAutoReplyRules(
      tenantDef.slug,
      tenantId,
      env,
      autoReplyRuleDefs
    );
    stats.autoReplyRules += rulesCreated;

    // 17. Create tenant settings (business hours, auto-reply config)
    console.log('\n  [Tenant Settings]');
    const tenantSettingDefs = getTenantSettings(env);
    const settingsCreated = await seedTenantSettings(
      tenantDef.slug,
      tenantId,
      env,
      tenantSettingDefs
    );
    stats.tenantSettings += settingsCreated;

    // ───────────────────────────────────────────────────────────────────────────
    // PHASE 8: Enhanced Invoices & Party Activities
    // ───────────────────────────────────────────────────────────────────────────

    // 18. Create enhanced invoices with line items and payments
    console.log('\n  [Enhanced Invoices]');
    const enhancedInvoiceDefs = getEnhancedInvoices(env);
    const { invoices: enhancedInvCreated, lineItems: lineItemsCreated, payments: paymentsCreated } = await seedEnhancedInvoices(
      tenantDef.slug,
      tenantId,
      env,
      enhancedInvoiceDefs,
      tenantContacts
    );
    stats.enhancedInvoices += enhancedInvCreated;
    stats.invoiceLineItems += lineItemsCreated;
    stats.payments += paymentsCreated;

    // 19. Create party activity timeline
    console.log('\n  [Party Activities]');
    const partyActivityDefs = getPartyActivities(env);
    const activitiesCreated = await seedPartyActivities(
      tenantDef.slug,
      tenantId,
      env,
      partyActivityDefs,
      tenantContacts
    );
    stats.partyActivities += activitiesCreated;

    console.log('');
  }

  // Cross-tenant pedigree links (must be done after all tenants are seeded)
  console.log('─────────────────────────────────────────────────────────────────────────────');
  console.log('  [Cross-Tenant Pedigree Links]');
  const crossTenantLinkDefs = getCrossTenantLinks(env);
  const crossTenantLinksCreated = await seedCrossTenantLinks(env, crossTenantLinkDefs);
  stats.crossTenantLinks = crossTenantLinksCreated;

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
  console.log(`  Breeding Attempts:    ${stats.breedingAttempts}`);
  console.log(`  Pregnancy Checks:     ${stats.pregnancyChecks}`);
  console.log(`  Test Results:         ${stats.testResults}`);
  console.log(`  Breeding Milestones:  ${stats.breedingMilestones}`);
  console.log(`  Foaling Outcomes:     ${stats.foalingOutcomes}`);
  console.log(`  Mare History:         ${stats.mareHistory}`);
  console.log(`  Offspring Groups:     ${stats.offspringGroups}`);
  console.log(`  Offspring:            ${stats.offspring}`);
  console.log(`  Health Traits:        ${stats.healthTraits}`);
  console.log(`  Vaccinations:         ${stats.vaccinations}`);
  console.log(`  Marketplace Listings: ${stats.marketplaceListings}`);
  console.log(`  Storefronts:          ${stats.storefronts}`);
  console.log(`  Program Breeds:       ${stats.tenantProgramBreeds}`);
  console.log(`  Breeding Programs:    ${stats.breedingProgramListings}`);
  console.log(`  Program Media:        ${stats.breedingProgramMedia}`);
  console.log(`  Stud Services:        ${stats.studServiceListings}`);
  console.log(`  Individual Listings:  ${stats.individualAnimalListings}`);
  console.log(`  Cross-Tenant Links:   ${stats.crossTenantLinks}`);
  console.log(`  Contract Templates:   ${stats.contractTemplates}`);
  console.log(`  Contracts:            ${stats.contracts}`);
  console.log(`  Message Templates:    ${stats.messageTemplates}`);
  console.log(`  Auto-Reply Rules:     ${stats.autoReplyRules}`);
  console.log(`  Tenant Settings:      ${stats.tenantSettings}`);
  console.log(`  Tags:                 ${stats.tags}`);
  console.log(`  Tag Assignments:      ${stats.tagAssignments}`);
  console.log(`  Portal Users:         ${stats.portalUsers}`);
  console.log(`  Marketplace Users:    ${stats.marketplaceUsers}`);
  console.log(`  Waitlist Entries:     ${stats.waitlistEntries}`);
  console.log(`  Invoices (basic):     ${stats.invoices}`);
  console.log(`  Enhanced Invoices:    ${stats.enhancedInvoices}`);
  console.log(`  Invoice Line Items:   ${stats.invoiceLineItems}`);
  console.log(`  Payments:             ${stats.payments}`);
  console.log(`  Party Activities:     ${stats.partyActivities}`);
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
