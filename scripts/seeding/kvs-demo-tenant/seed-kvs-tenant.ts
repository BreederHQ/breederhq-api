/**
 * KVS Demo Tenant — Main Orchestrator
 *
 * Seeds a fully-populated demo tenant for Katie Van Slyke / Running Springs
 * Quarter Horse & Cattle Company. Pre-populates with real animals, pedigrees,
 * show records, and 2025/2026 breeding plans so the demo video shows their
 * actual operation.
 *
 * Usage:
 *   npm run db:dev:seed:kvs
 *   # or with force-recreate:
 *   npm run db:dev:seed:kvs -- --force
 *
 * Reference: docs/demos/KATIE-VAN-SLYKE-DOSSIER.md
 */

import '../../../prisma/seed/seed-env-bootstrap';
import bcrypt from 'bcryptjs';
import { PrismaClient, SubscriptionStatus, BillingInterval } from '@prisma/client';

import {
  KVS_TENANT,
  KVS_USER,
  KVS_TAGS,
  KVS_CONTACTS,
  KVS_ORGANIZATIONS,
  KVS_ANCESTORS,
  KVS_OUTSIDE_STALLIONS,
  KVS_STALLIONS,
  KVS_BROODMARES,
  KVS_RECIPIENTS,
  KVS_FOALS,
  KVS_OTHER_HORSES,
  KVS_MINI_HORSES,
  KVS_GOATS,
  KVS_GENETICS,
  KVS_REGISTRATIONS,
  KVS_REGISTRY_PEDIGREES,
  KVS_COMPETITIONS,
  KVS_BREEDING_PROFILES,
  KVS_SEMEN_INVENTORY,
  KVS_PLANS_2025,
  KVS_PLANS_2026,
  KVS_BREEDING_ATTEMPTS,
  KVS_PREGNANCY_CHECKS,
  KVS_TEST_RESULTS,
  KVS_FOALING_OUTCOMES,
  KVS_OFFSPRING_GROUPS,
  KVS_MARE_HISTORY,
  KVS_TITLE_DEFS,
  KVS_ANIMAL_TITLES,
  type AnimalDef,
  type BreedingPlanDef,
} from './kvs-data';

const prisma = new PrismaClient();

const forceRecreate = process.argv.includes('--force');

// ── helpers ──────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`  ${msg}`);
}

function section(title: string) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
}

function mapBreedingMethod(method: string) {
  const map: Record<string, string> = {
    NATURAL: 'NATURAL',
    AI_TCI: 'AI_TCI',
    AI_SI: 'AI_SI',
    AI_FROZEN: 'AI_FROZEN',
    AI_VAGINAL: 'AI_VAGINAL',
    EMBRYO_TRANSFER: 'EMBRYO_TRANSFER',
  };
  return (map[method] ?? 'AI_FROZEN') as any;
}

function mapPregnancyCheckMethod(method: string) {
  const map: Record<string, string> = {
    PALPATION: 'PALPATION',
    ULTRASOUND: 'ULTRASOUND',
    RELAXIN_TEST: 'RELAXIN_TEST',
    XRAY: 'XRAY',
    OTHER: 'OTHER',
  };
  return (map[method] ?? 'ULTRASOUND') as any;
}

function mapMareCondition(condition?: string) {
  if (!condition) return undefined;
  return condition as any;
}

// ══════════════════════════════════════════════════════════════════════
// TIER 1 — TENANT + USER + MEMBERSHIP
// ══════════════════════════════════════════════════════════════════════

async function seedTenantAndUser(): Promise<{ tenantId: number; userId: string }> {
  section('Tier 1: Tenant + User');

  // Tear down if --force — must delete in FK dependency order
  if (forceRecreate) {
    const existing = await prisma.tenant.findFirst({ where: { slug: KVS_TENANT.slug } });
    if (existing) {
      const tid = existing.id;
      log(`⚠️  Force mode: deleting existing tenant "${KVS_TENANT.slug}" (id=${tid})`);

      // Models with no cascade from BreedingPlan or Animal — delete before them
      await prisma.testResult.deleteMany({ where: { tenantId: tid } });
      await prisma.breedingAttempt.deleteMany({ where: { tenantId: tid } });
      await prisma.semenInventory.deleteMany({ where: { tenantId: tid } });
      // RegistryPedigree.linkedAnimalId has no cascade — delete before Animal
      await prisma.registryPedigree.deleteMany({ where: { linkedAnimal: { tenantId: tid } } });
      // TagAssignment.taggedPartyId has no cascade — delete before Party
      await prisma.tagAssignment.deleteMany({ where: { tag: { tenantId: tid } } });

      // BreedingPlan cascades: PregnancyCheck, FoalingOutcome
      await prisma.breedingPlan.deleteMany({ where: { tenantId: tid } });

      // Animal dependents before Animal
      await prisma.animalGenetics.deleteMany({ where: { animal: { tenantId: tid } } });
      await prisma.animalTitle.deleteMany({ where: { animal: { tenantId: tid } } });
      await prisma.competitionEntry.deleteMany({ where: { animal: { tenantId: tid } } });
      await prisma.animalPrivacySettings.deleteMany({ where: { animal: { tenantId: tid } } });
      await prisma.animalTraitValue.deleteMany({ where: { tenantId: tid } });
      await prisma.vaccinationRecord.deleteMany({ where: { tenantId: tid } });
      await prisma.animal.deleteMany({ where: { tenantId: tid } });

      // Offspring cascades from BreedingPlan (onDelete: Cascade) — no explicit delete needed

      // Contacts / Parties
      await prisma.contact.deleteMany({ where: { tenantId: tid } });
      await prisma.party.deleteMany({ where: { tenantId: tid, type: 'CONTACT' } });
      await prisma.organization.deleteMany({ where: { tenantId: tid } });
      await prisma.party.deleteMany({ where: { tenantId: tid } });

      // Tags, settings, memberships
      await prisma.tag.deleteMany({ where: { tenantId: tid } });
      await prisma.tenantSetting.deleteMany({ where: { tenantId: tid } });
      await prisma.tenantMembership.deleteMany({ where: { tenantId: tid } });

      await prisma.tenant.delete({ where: { id: tid } });
      log(`  ✅ Tenant deleted`);
    }
  }

  // Tenant
  let tenant = await prisma.tenant.findFirst({ where: { slug: KVS_TENANT.slug } });
  if (!tenant) {
    // Need a unique inbound email slug — use a simple fallback since we don't want to import the full service
    const inboundEmailSlug = `running-springs-${Date.now()}`;
    tenant = await prisma.tenant.create({
      data: {
        name: KVS_TENANT.name,
        slug: KVS_TENANT.slug,
        inboundEmailSlug,
        isDemoTenant: KVS_TENANT.isDemoTenant,
      },
    });
    log(`✅ Created tenant: "${tenant.name}" (id=${tenant.id})`);
  } else {
    log(`⏭️  Tenant already exists (id=${tenant.id})`);
  }

  // Tenant settings (theme)
  await prisma.tenantSetting.upsert({
    where: { tenantId_namespace: { tenantId: tenant.id, namespace: 'theme' } },
    update: { data: KVS_TENANT.theme as any, updatedBy: 'kvs-seed' },
    create: { tenantId: tenant.id, namespace: 'theme', data: KVS_TENANT.theme as any, updatedBy: 'kvs-seed' },
  });

  // User
  let user = await prisma.user.findUnique({ where: { email: KVS_USER.email } });
  if (!user) {
    const passwordHash = await bcrypt.hash(KVS_USER.password, 12);
    user = await prisma.user.create({
      data: {
        email: KVS_USER.email,
        firstName: KVS_USER.firstName,
        lastName: KVS_USER.lastName,
        passwordHash,
        isSuperAdmin: false,
        emailVerifiedAt: new Date(),
        defaultTenantId: tenant.id,
      },
    });
    log(`✅ Created user: ${user.email}`);
  } else {
    // User already exists — always update defaultTenantId to point to the current tenant
    // (critical when --force recreates the tenant with a new ID but reuses the same user account)
    await prisma.user.update({
      where: { id: user.id },
      data: { defaultTenantId: tenant.id } as any,
    });
    log(`⏭️  User already exists: ${user.email} (updated defaultTenantId → ${tenant.id})`);
  }

  // Membership
  const existingMembership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
  });
  if (!existingMembership) {
    await prisma.tenantMembership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: 'OWNER' as any,
        membershipRole: 'STAFF' as any,
        membershipStatus: 'ACTIVE' as any,
      },
    });
    log(`✅ Created membership`);
  }

  return { tenantId: tenant.id, userId: user.id };
}

// ══════════════════════════════════════════════════════════════════════
// TIER 2 — TAGS
// ══════════════════════════════════════════════════════════════════════

async function seedTags(tenantId: number): Promise<Map<string, number>> {
  section('Tier 2: Tags');
  const tagMap = new Map<string, number>(); // "MODULE:name" → tagId

  let created = 0;
  for (const tagDef of KVS_TAGS) {
    let tag = await prisma.tag.findFirst({
      where: { tenantId, name: tagDef.name, module: tagDef.module as any },
    });
    if (!tag) {
      tag = await prisma.tag.create({
        data: { tenantId, name: tagDef.name, module: tagDef.module as any, color: tagDef.color },
      });
      created++;
    }
    tagMap.set(`${tagDef.module}:${tagDef.name}`, tag.id);
  }

  log(`✅ ${created} tags created, ${tagMap.size} total`);
  return tagMap;
}

// ══════════════════════════════════════════════════════════════════════
// TIER 3 — CONTACTS + ORGANIZATIONS
// ══════════════════════════════════════════════════════════════════════

async function seedContacts(tenantId: number, tagMap: Map<string, number>): Promise<void> {
  section('Tier 3: Contacts & Organizations');
  let contactsCreated = 0;
  let orgsCreated = 0;

  // Contacts
  for (const def of KVS_CONTACTS) {
    if (!def.firstName && !def.lastName) continue;
    const displayName = [def.firstName, def.lastName].filter(Boolean).join(' ');

    const existing = await prisma.contact.findFirst({ where: { tenantId, email: def.email } });
    if (!existing) {
      const party = await prisma.party.create({
        data: {
          tenantId,
          type: 'CONTACT' as any,
          name: displayName,
          email: def.email,
          phoneE164: def.phone,
          city: def.city,
          state: def.state,
          country: def.country ?? 'US',
          archived: false,
        },
      });
      const contact = await prisma.contact.create({
        data: {
          tenantId,
          partyId: party.id,
          first_name: def.firstName,
          last_name: def.lastName ?? '',
          display_name: displayName,
          email: def.email,
          phoneE164: def.phone,
          city: def.city,
          state: def.state,
          country: def.country ?? 'US',
          archived: false,
        },
      });

      // Tag assignments
      for (const tagName of def.tags ?? []) {
        const tagId = tagMap.get(`CONTACT:${tagName}`);
        if (tagId) {
          await prisma.tagAssignment.create({ data: { tagId, taggedPartyId: party.id } });
        }
      }

      // Notes
      if (def.notes) {
        await prisma.partyNote.create({
          data: { tenantId, partyId: party.id, content: def.notes },
        });
      }

      contactsCreated++;
    }
  }

  // Organizations
  for (const def of KVS_ORGANIZATIONS) {
    const existing = await prisma.organization.findFirst({ where: { tenantId, name: def.name } });
    if (!existing) {
      const party = await prisma.party.create({
        data: {
          tenantId,
          type: 'ORGANIZATION' as any,
          name: def.name,
          email: def.email,
          city: def.city,
          state: def.state,
          country: def.country ?? 'US',
          archived: false,
        },
      });
      await prisma.organization.create({
        data: { tenantId, partyId: party.id, name: def.name, email: def.email, city: def.city, state: def.state, country: def.country ?? 'US', archived: false },
      });

      for (const tagName of def.tags ?? []) {
        const tagId = tagMap.get(`CONTACT:${tagName}`);
        if (tagId) {
          await prisma.tagAssignment.create({ data: { tagId, taggedPartyId: party.id } });
        }
      }

      if (def.notes) {
        await prisma.partyNote.create({ data: { tenantId, partyId: party.id, content: def.notes } });
      }

      orgsCreated++;
    }
  }

  log(`✅ ${contactsCreated} contacts, ${orgsCreated} organizations`);
}

// ══════════════════════════════════════════════════════════════════════
// TIER 4 — ANIMALS
// ══════════════════════════════════════════════════════════════════════

async function seedAnimals(tenantId: number, tagMap: Map<string, number>): Promise<Map<string, number>> {
  section('Tier 4: Animals');
  const animalIdMap = new Map<string, number>();
  let created = 0;

  // Process all animals sorted by generation (ancestors first)
  const allAnimals: AnimalDef[] = [
    ...KVS_ANCESTORS,
    ...KVS_OUTSIDE_STALLIONS,
    ...KVS_STALLIONS,
    ...KVS_BROODMARES,
    ...KVS_RECIPIENTS,
    ...KVS_OTHER_HORSES,
    ...KVS_MINI_HORSES,
    ...KVS_GOATS,
    ...KVS_FOALS,     // Foals last so parents exist
  ].sort((a, b) => a.generation - b.generation);

  for (const def of allAnimals) {
    const displayName = def.barnName ?? def.name;

    // Find existing by registered name
    let animal = await prisma.animal.findFirst({
      where: { tenantId, name: def.name },
    });

    if (!animal) {
      // Resolve parent IDs from map
      let sireId: number | undefined = undefined;
      let damId: number | undefined = undefined;

      if (def.sireRef) {
        sireId = animalIdMap.get(def.sireRef) ?? undefined;
        if (!sireId) {
          const sire = await prisma.animal.findFirst({ where: { tenantId, name: def.sireRef } });
          if (sire) sireId = sire.id;
        }
      }
      if (def.damRef) {
        damId = animalIdMap.get(def.damRef) ?? undefined;
        if (!damId) {
          const dam = await prisma.animal.findFirst({ where: { tenantId, name: def.damRef } });
          if (dam) damId = dam.id;
        }
      }

      const birthDate = def.birthDate
        ? new Date(`${def.birthDate}T12:00:00Z`)
        : def.birthYear
          ? new Date(`${def.birthYear}-06-15T12:00:00Z`)
          : undefined;

      animal = await prisma.animal.create({
        data: {
          tenantId,
          name: def.name,
          nickname: def.barnName ?? undefined,
          species: def.species as any,
          sex: def.sex as any,
          breed: def.breed ?? undefined,
          birthDate: birthDate ?? undefined,
          status: def.status as any,
          sireId: sireId ?? undefined,
          damId: damId ?? undefined,
          notes: def.notes ?? undefined,
        },
      });

      // AnimalPrivacySettings (required for lineage views)
      await prisma.animalPrivacySettings.create({
        data: {
          animalId: animal.id,
          showName: true,
          showPhoto: true,
          showFullDob: true,
          showRegistryFull: true,
          enableHealthSharing: true,
          enableGeneticsSharing: true,
          showBreeder: true,
          allowCrossTenantMatching: false,
        },
      });

      // Tag assignments
      for (const tagName of def.tags ?? []) {
        const tagId = tagMap.get(`ANIMAL:${tagName}`);
        if (tagId) {
          const existingAssign = await prisma.tagAssignment.findFirst({ where: { tagId, animalId: animal.id } });
          if (!existingAssign) {
            await prisma.tagAssignment.create({ data: { tagId, animalId: animal.id } });
          }
        }
      }

      created++;
    }

    // Track in map by registered name AND barn name
    animalIdMap.set(def.name, animal.id);
    if (def.barnName) animalIdMap.set(def.barnName, animal.id);
  }

  log(`✅ ${created} animals created, ${animalIdMap.size} entries in ID map`);
  return animalIdMap;
}

// ══════════════════════════════════════════════════════════════════════
// TIER 5 — GENETICS
// ══════════════════════════════════════════════════════════════════════

async function seedGenetics(tenantId: number, animalIdMap: Map<string, number>): Promise<void> {
  section('Tier 5: Genetics');
  let created = 0;

  for (const def of KVS_GENETICS) {
    const animalId = animalIdMap.get(def.animalRef);
    if (!animalId) { log(`⚠️  Animal not found: ${def.animalRef}`); continue; }

    const existing = await prisma.animalGenetics.findUnique({ where: { animalId } });
    if (!existing) {
      const testDate = def.testDate
        ? new Date(`${def.testDate}T12:00:00Z`)
        : def.testProvider ? new Date('2024-01-01') : undefined;
      await prisma.animalGenetics.create({
        data: {
          animalId,
          testProvider: def.testProvider ?? undefined,
          testDate,
          coatColorData: def.coatColor as any ?? [],
          coatTypeData: [],
          physicalTraitsData: [],
          eyeColorData: [],
          healthGeneticsData: def.health as any ?? [],
        },
      });

      // AnimalLoci — health panel entries
      for (const locus of def.health ?? []) {
        await prisma.animalLoci.upsert({
          where: { animal_loci_animal_id_category_locus_key: { animalId, category: 'health', locus: locus.locus } },
          update: { locusName: locus.locusName, allele1: locus.allele1 ?? null, allele2: locus.allele2 ?? null, genotype: locus.genotype },
          create: { animalId, category: 'health', locus: locus.locus, locusName: locus.locusName, allele1: locus.allele1 ?? null, allele2: locus.allele2 ?? null, genotype: locus.genotype, networkVisible: true },
        });
      }

      // AnimalLoci — coat color entries
      for (const locus of def.coatColor ?? []) {
        await prisma.animalLoci.upsert({
          where: { animal_loci_animal_id_category_locus_key: { animalId, category: 'coatColor', locus: locus.locus } },
          update: { locusName: locus.locusName, allele1: locus.allele1 ?? null, allele2: locus.allele2 ?? null, genotype: locus.genotype },
          create: { animalId, category: 'coatColor', locus: locus.locus, locusName: locus.locusName, allele1: locus.allele1 ?? null, allele2: locus.allele2 ?? null, genotype: locus.genotype, networkVisible: false },
        });
      }

      created++;
    }
  }

  log(`✅ ${created} genetics records created`);
}

// ══════════════════════════════════════════════════════════════════════
// TIER 6 — REGISTRY IDENTIFIERS
// ══════════════════════════════════════════════════════════════════════

async function seedRegistryIdentifiers(tenantId: number, animalIdMap: Map<string, number>): Promise<Map<string, number>> {
  section('Tier 6: Registry Identifiers');
  const regIdMap = new Map<string, number>(); // "animalRef:registryName" → id
  let created = 0;

  for (const def of KVS_REGISTRATIONS) {
    const animalId = animalIdMap.get(def.animalRef);
    if (!animalId) { log(`⚠️  Animal not found: ${def.animalRef}`); continue; }

    const registry = await prisma.registry.findFirst({ where: { name: def.registryName } });
    if (!registry) { log(`⚠️  Registry not found: "${def.registryName}" — skipping`); continue; }

    const existing = await prisma.animalRegistryIdentifier.findFirst({
      where: { animalId, registryId: registry.id },
    });

    if (!existing) {
      const regId = await prisma.animalRegistryIdentifier.create({
        data: { animalId, registryId: registry.id, identifier: def.identifier },
      });
      regIdMap.set(`${def.animalRef}:${def.registryName}`, regId.id);
      created++;
    } else {
      regIdMap.set(`${def.animalRef}:${def.registryName}`, existing.id);
    }
  }

  log(`✅ ${created} registry identifiers created`);
  return regIdMap;
}

// ══════════════════════════════════════════════════════════════════════
// TIER 7 — REGISTRY PEDIGREES
// ══════════════════════════════════════════════════════════════════════

async function seedRegistryPedigrees(regIdMap: Map<string, number>): Promise<void> {
  section('Tier 7: Registry Pedigrees');
  let created = 0;

  for (const def of KVS_REGISTRY_PEDIGREES) {
    const regIdKey = `${def.animalRef}:${def.registryName}`;
    const animalRegistryIdentifierId = regIdMap.get(regIdKey);
    if (!animalRegistryIdentifierId) { log(`⚠️  No registry ID for ${regIdKey}`); continue; }

    for (const ancestor of def.ancestors) {
      const existing = await prisma.registryPedigree.findFirst({
        where: { animalRegistryIdentifierId, position: ancestor.position },
      });
      if (!existing) {
        await prisma.registryPedigree.create({
          data: {
            animalRegistryIdentifierId,
            generation: ancestor.generation,
            position: ancestor.position,
            name: ancestor.name,
            registrationNumber: ancestor.registrationNumber ?? undefined,
            color: ancestor.color ?? undefined,
            birthYear: ancestor.birthYear ?? undefined,
            sex: ancestor.sex,
          },
        });
        created++;
      }
    }
  }

  log(`✅ ${created} pedigree entries created`);
}

// ══════════════════════════════════════════════════════════════════════
// TIER 8 — COMPETITION ENTRIES
// ══════════════════════════════════════════════════════════════════════

async function seedCompetitions(tenantId: number, animalIdMap: Map<string, number>): Promise<void> {
  section('Tier 8: Competition Entries');
  let created = 0;

  for (const def of KVS_COMPETITIONS) {
    const animalId = animalIdMap.get(def.animalRef);
    if (!animalId) { log(`⚠️  Animal not found: ${def.animalRef}`); continue; }

    const eventDate = new Date(`${def.eventDate}T12:00:00Z`);
    const existing = await prisma.competitionEntry.findFirst({
      where: { tenantId, animalId, eventName: def.eventName, eventDate, className: def.className ?? null },
    });

    if (!existing) {
      await prisma.competitionEntry.create({
        data: {
          tenantId,
          animalId,
          eventName: def.eventName,
          eventDate,
          location: def.location ?? undefined,
          organization: def.organization ?? undefined,
          competitionType: 'CONFORMATION_SHOW' as any,
          className: def.className ?? undefined,
          placement: def.placement ?? undefined,
          placementLabel: def.placementLabel ?? undefined,
          pointsEarned: def.pointsEarned ?? undefined,
          isMajorWin: def.isMajorWin ?? false,
          qualifyingScore: false,
          isPublic: true,
          prizeMoneyCents: def.prizeMoneyCents ?? undefined,
        },
      });
      created++;
    }
  }

  log(`✅ ${created} competition entries created`);
}

// ══════════════════════════════════════════════════════════════════════
// TIER 9 — BREEDING PROFILES
// ══════════════════════════════════════════════════════════════════════

async function seedBreedingProfiles(tenantId: number, animalIdMap: Map<string, number>): Promise<void> {
  section('Tier 9: Breeding Profiles');
  let created = 0;

  for (const def of KVS_BREEDING_PROFILES) {
    const animalId = animalIdMap.get(def.animalRef);
    if (!animalId) { log(`⚠️  Animal not found: ${def.animalRef}`); continue; }

    const existing = await prisma.animalBreedingProfile.findUnique({ where: { animalId } });
    if (!existing) {
      await prisma.animalBreedingProfile.create({
        data: {
          tenantId,
          animalId,
          breedingStatus: def.breedingStatus,
          libido: def.libido ?? undefined,
          serviceType: def.serviceType ?? undefined,
          collectionTrained: def.collectionTrained ?? undefined,
          collectionNotes: def.collectionNotes ?? undefined,
          fertilityStatus: def.fertilityStatus ?? undefined,
          fertilityNotes: def.fertilityNotes ?? undefined,
          pregnancyComplications: def.pregnancyComplications ?? undefined,
          proneToComplications: def.proneToComplications ?? false,
          generalNotes: def.generalNotes ?? undefined,
        },
      });
      created++;
    }
  }

  log(`✅ ${created} breeding profiles created`);
}

// ══════════════════════════════════════════════════════════════════════
// TIER 10 — SEMEN INVENTORY
// ══════════════════════════════════════════════════════════════════════

async function seedSemenInventory(tenantId: number, animalIdMap: Map<string, number>): Promise<void> {
  section('Tier 10: Semen Inventory');
  let created = 0;

  for (const def of KVS_SEMEN_INVENTORY) {
    const stallionId = animalIdMap.get(def.stallionRef);
    if (!stallionId) { log(`⚠️  Stallion not found: ${def.stallionRef}`); continue; }

    const existing = await prisma.semenInventory.findFirst({
      where: { tenantId, batchNumber: def.batchNumber },
    });

    if (!existing) {
      await prisma.semenInventory.create({
        data: {
          tenantId,
          stallionId,
          batchNumber: def.batchNumber,
          collectionDate: new Date(`${def.collectionDate}T12:00:00Z`),
          collectionMethod: 'AV' as any,
          storageType: def.storageType as any,
          storageFacility: def.storageFacility ?? undefined,
          storageLocation: def.storageLocation ?? undefined,
          initialDoses: def.initialDoses,
          availableDoses: def.availableDoses,
          motility: def.motility ?? undefined,
          morphology: def.morphology ?? undefined,
          concentration: def.concentration ?? undefined,
          qualityGrade: def.qualityGrade as any ?? undefined,
          status: 'AVAILABLE' as any,
          notes: def.notes ?? undefined,
        },
      });
      created++;
    }
  }

  log(`✅ ${created} semen inventory batches created`);
}

// ══════════════════════════════════════════════════════════════════════
// TIER 11 — BREEDING PLANS
// ══════════════════════════════════════════════════════════════════════

async function seedBreedingPlans(
  tenantId: number,
  animalIdMap: Map<string, number>,
  tagMap: Map<string, number>,
): Promise<Map<string, number>> {
  section('Tier 11: Breeding Plans');
  const planIdMap = new Map<string, number>();
  let created = 0;

  const allPlans: BreedingPlanDef[] = [...KVS_PLANS_2025, ...KVS_PLANS_2026];

  for (const def of allPlans) {
    let plan = await prisma.breedingPlan.findFirst({ where: { tenantId, name: def.name } });

    if (!plan) {
      const damId = animalIdMap.get(def.damRef) ?? undefined;
      const sireId = animalIdMap.get(def.sireRef) ?? undefined;

      if (!damId) log(`⚠️  Dam not found: "${def.damRef}" for plan "${def.name}"`);
      if (!sireId) log(`⚠️  Sire not found: "${def.sireRef}" for plan "${def.name}"`);

      const data: any = {
        tenantId,
        name: def.name,
        nickname: def.nickname ?? undefined,
        species: def.species,
        breedText: def.breedText ?? undefined,
        damId: damId ?? undefined,
        sireId: sireId ?? undefined,
        status: def.status as any,
        notes: def.notes ?? undefined,
        isCommittedIntent: true,
        committedAt: new Date(),
      };

      if (def.expectedBirthDate) data.expectedBirthDate = new Date(`${def.expectedBirthDate}T12:00:00Z`);
      if (def.breedDateActual) data.breedDateActual = new Date(`${def.breedDateActual}T12:00:00Z`);
      if (def.birthDateActual) data.birthDateActual = new Date(`${def.birthDateActual}T12:00:00Z`);
      if (def.completedDateActual) data.completedDateActual = new Date(`${def.completedDateActual}T12:00:00Z`);

      // Anchor mode: if we have a breed date, anchor on that; otherwise CYCLE_START
      if (def.breedDateActual) {
        data.reproAnchorMode = 'BREEDING_DATE';
        data.primaryAnchor = 'BREEDING_DATE';
      } else {
        data.reproAnchorMode = 'CYCLE_START';
      }

      plan = await prisma.breedingPlan.create({ data });
      created++;

      // Tag assignments
      for (const tagName of def.tags ?? []) {
        const tagId = tagMap.get(`BREEDING_PLAN:${tagName}`);
        if (tagId) {
          await prisma.tagAssignment.create({ data: { tagId, breedingPlanId: plan.id } });
        }
      }

      // ET plans: donor dam is identified by plan name + notes; no separate FK field in schema
    }

    planIdMap.set(def.name, plan.id);
  }

  log(`✅ ${created} breeding plans created, ${planIdMap.size} total`);
  return planIdMap;
}

// ══════════════════════════════════════════════════════════════════════
// TIER 12a — TEST RESULTS
// ══════════════════════════════════════════════════════════════════════

async function seedTestResults(tenantId: number, planIdMap: Map<string, number>, animalIdMap: Map<string, number>): Promise<void> {
  section('Tier 12a: Test Results (Progesterone / Follicle)');
  let created = 0;

  for (const def of KVS_TEST_RESULTS) {
    const planId = planIdMap.get(def.planRef);
    if (!planId) { log(`⚠️  Plan not found: "${def.planRef}"`); continue; }

    const animalId = animalIdMap.get(def.animalRef) ?? undefined;
    const collectedAt = new Date(`${def.collectedAt}T12:00:00Z`);

    const existing = await prisma.testResult.findFirst({
      where: { tenantId, planId, kind: def.kind, collectedAt },
    });

    if (!existing) {
      await prisma.testResult.create({
        data: {
          tenantId,
          planId,
          animalId: animalId ?? undefined,
          kind: def.kind,
          method: def.method ?? undefined,
          collectedAt,
          valueNumber: def.valueNumber ?? undefined,
          valueText: def.valueText ?? undefined,
          units: def.units ?? undefined,
          notes: def.notes ?? undefined,
        },
      });
      created++;
    }
  }

  log(`✅ ${created} test results created`);
}

// ══════════════════════════════════════════════════════════════════════
// TIER 12b — BREEDING ATTEMPTS
// ══════════════════════════════════════════════════════════════════════

async function seedBreedingAttempts(tenantId: number, planIdMap: Map<string, number>, animalIdMap: Map<string, number>): Promise<void> {
  section('Tier 12b: Breeding Attempts');
  let created = 0;

  for (const def of KVS_BREEDING_ATTEMPTS) {
    const planId = planIdMap.get(def.planRef);
    if (!planId) { log(`⚠️  Plan not found: "${def.planRef}"`); continue; }

    const plan = await prisma.breedingPlan.findUnique({ where: { id: planId } });
    if (!plan) continue;

    const attemptAt = new Date(`${def.attemptAt}T12:00:00Z`);
    const existing = await prisma.breedingAttempt.findFirst({ where: { tenantId, planId, attemptAt } });

    if (!existing) {
      await prisma.breedingAttempt.create({
        data: {
          tenantId,
          planId,
          damId: plan.damId ?? undefined,
          sireId: plan.sireId ?? undefined,
          method: mapBreedingMethod(def.method),
          attemptAt,
          success: def.success ?? undefined,
          notes: def.notes ?? undefined,
        },
      });
      created++;
    }
  }

  log(`✅ ${created} breeding attempts created`);
}

// ══════════════════════════════════════════════════════════════════════
// TIER 12c — PREGNANCY CHECKS
// ══════════════════════════════════════════════════════════════════════

async function seedPregnancyChecks(tenantId: number, planIdMap: Map<string, number>): Promise<void> {
  section('Tier 12c: Pregnancy Checks');
  let created = 0;

  for (const def of KVS_PREGNANCY_CHECKS) {
    const planId = planIdMap.get(def.planRef);
    if (!planId) { log(`⚠️  Plan not found: "${def.planRef}"`); continue; }

    const checkedAt = new Date(`${def.checkedAt}T12:00:00Z`);
    const existing = await prisma.pregnancyCheck.findFirst({ where: { tenantId, planId, checkedAt } });

    if (!existing) {
      await prisma.pregnancyCheck.create({
        data: {
          tenantId,
          planId,
          method: mapPregnancyCheckMethod(def.method),
          result: def.result,
          checkedAt,
          notes: def.notes ?? undefined,
        },
      });
      created++;
    }
  }

  log(`✅ ${created} pregnancy checks created`);
}

// ══════════════════════════════════════════════════════════════════════
// TIER 13a — FOALING OUTCOMES
// ══════════════════════════════════════════════════════════════════════

async function seedFoalingOutcomes(tenantId: number, planIdMap: Map<string, number>): Promise<void> {
  section('Tier 13a: Foaling Outcomes');
  let created = 0;

  for (const def of KVS_FOALING_OUTCOMES) {
    const planId = planIdMap.get(def.planRef);
    if (!planId) { log(`⚠️  Plan not found: "${def.planRef}"`); continue; }

    const existing = await prisma.foalingOutcome.findUnique({ where: { breedingPlanId: planId } });
    if (!existing) {
      await prisma.foalingOutcome.create({
        data: {
          tenantId,
          breedingPlanId: planId,
          hadComplications: def.hadComplications,
          complicationDetails: def.complicationDetails ?? undefined,
          veterinarianCalled: def.veterinarianCalled ?? false,
          veterinarianName: def.veterinarianName ?? undefined,
          placentaPassed: def.placentaPassed ?? undefined,
          placentaPassedMinutes: def.placentaPassedMinutes ?? undefined,
          mareCondition: mapMareCondition(def.mareCondition),
          readyForRebreeding: def.readyForRebreeding ?? false,
        },
      });
      created++;
    }
  }

  log(`✅ ${created} foaling outcomes created`);
}

// ══════════════════════════════════════════════════════════════════════
// TIER 13b — OFFSPRING
// ══════════════════════════════════════════════════════════════════════

async function seedOffspring(tenantId: number, planIdMap: Map<string, number>, animalIdMap: Map<string, number>): Promise<void> {
  section('Tier 13b: Offspring');
  let created = 0;

  for (const def of KVS_OFFSPRING_GROUPS) {
    const planId = planIdMap.get(def.planRef);
    if (!planId) { log(`⚠️  Plan not found: "${def.planRef}"`); continue; }

    const damId = animalIdMap.get(def.damRef);
    const sireId = animalIdMap.get(def.sireRef);
    if (!damId || !sireId) { log(`⚠️  Missing dam/sire for "${def.name}"`); continue; }

    const bornAt = new Date(`${def.actualBirthOn}T12:00:00Z`);

    for (const offDef of def.offspring) {
      const existing = await prisma.offspring.findFirst({
        where: { tenantId, breedingPlanId: planId, name: offDef.name },
      });
      if (!existing) {
        const isDeceased = offDef.lifeState === 'DECEASED';
        await prisma.offspring.create({
          data: {
            tenantId,
            breedingPlanId: planId,
            name: offDef.name,
            species: 'HORSE' as any,
            sex: offDef.sex as any,
            bornAt,
            diedAt: offDef.diedAt ? new Date(`${offDef.diedAt}T12:00:00Z`) : undefined,
            damId,
            sireId,
            status: isDeceased ? 'DECEASED' as any : 'ALIVE' as any,
            lifeState: offDef.lifeState as any,
            healthStatus: isDeceased ? 'DECEASED' as any : 'HEALTHY' as any,
            placementState: 'UNASSIGNED' as any,
            keeperIntent: offDef.keeperIntent as any,
            financialState: 'NONE' as any,
            paperworkState: 'NONE' as any,
            notes: offDef.notes ?? undefined,
          },
        });
        created++;
      }
    }
  }

  log(`✅ ${created} offspring created`);
}

// ══════════════════════════════════════════════════════════════════════
// TIER 14 — MARE REPRODUCTIVE HISTORY
// ══════════════════════════════════════════════════════════════════════

async function seedMareHistory(tenantId: number, animalIdMap: Map<string, number>): Promise<void> {
  section('Tier 14: Mare Reproductive History');
  let created = 0;

  for (const def of KVS_MARE_HISTORY) {
    const mareId = animalIdMap.get(def.mareRef);
    if (!mareId) { log(`⚠️  Mare not found: "${def.mareRef}"`); continue; }

    const existing = await prisma.mareReproductiveHistory.findUnique({ where: { mareId } });
    if (!existing) {
      await prisma.mareReproductiveHistory.create({
        data: {
          tenantId,
          mareId,
          totalFoalings: def.totalFoalings,
          totalLiveFoals: def.totalLiveFoals,
          totalComplicatedFoalings: def.totalComplicatedFoalings,
          riskScore: def.riskScore,
          riskFactors: def.riskFactors ?? [],
          notes: def.notes ?? undefined,
        },
      });
      created++;
    }
  }

  log(`✅ ${created} mare reproductive history records created`);
}

// ══════════════════════════════════════════════════════════════════════
// TIER 15 — TITLE DEFINITIONS + ANIMAL TITLES
// ══════════════════════════════════════════════════════════════════════

async function seedTitles(tenantId: number, animalIdMap: Map<string, number>): Promise<void> {
  section('Animal Titles');

  // 1. Upsert TitleDefinitions (tenant-scoped, species HORSE)
  const titleDefIdMap = new Map<string, number>(); // abbreviation → id
  for (const def of KVS_TITLE_DEFS) {
    const existing = await (prisma as any).titleDefinition.findFirst({
      where: { tenantId, abbreviation: def.abbreviation },
    });
    let tdId: number;
    if (existing) {
      tdId = existing.id;
    } else {
      const created = await (prisma as any).titleDefinition.create({
        data: {
          tenantId,
          species: 'HORSE',
          abbreviation: def.abbreviation,
          fullName: def.fullName,
          category: def.category,
          ...(def.organization ? { organization: def.organization } : {}),
        },
      });
      tdId = created.id;
    }
    titleDefIdMap.set(def.abbreviation, tdId);
  }
  log(`  ✅ ${titleDefIdMap.size} title definitions ready`);

  // 2. Create AnimalTitle records (idempotent: skip if already exists with same notes/dateEarned)
  let created = 0;
  for (const at of KVS_ANIMAL_TITLES) {
    const animalId = animalIdMap.get(at.animalRef);
    if (!animalId) {
      log(`  ⚠️  Animal not found for title: ${at.animalRef}`);
      continue;
    }
    const titleDefinitionId = titleDefIdMap.get(at.titleAbbr);
    if (!titleDefinitionId) {
      log(`  ⚠️  TitleDefinition not found: ${at.titleAbbr}`);
      continue;
    }
    // Check for duplicate (unique constraint: animalId + titleDefinitionId)
    const existing = await (prisma as any).animalTitle.findFirst({
      where: { animalId, titleDefinitionId },
    });
    if (existing) continue;

    const dateEarned = at.dateEarned
      ? (at.dateEarned.length === 4
          ? new Date(`${at.dateEarned}-01-01`)
          : new Date(at.dateEarned))
      : null;

    await (prisma as any).animalTitle.create({
      data: {
        tenantId,
        animalId,
        titleDefinitionId,
        status: at.status,
        verified: at.verified,
        ...(dateEarned ? { dateEarned } : {}),
        ...(at.notes ? { notes: at.notes } : {}),
      },
    });
    created++;
  }
  log(`✅ ${created} animal title records created`);
}

// ══════════════════════════════════════════════════════════════════════
// SUBSCRIPTION — "Demo Enterprise" (full access, ACTIVE status)
// ══════════════════════════════════════════════════════════════════════

const DEMO_ENTERPRISE_PRODUCT_NAME = 'Demo Enterprise';

async function seedDemoSubscription(tenantId: number): Promise<void> {
  section('Subscription: Demo Enterprise');

  // Find or create the Demo Enterprise product
  let product = await prisma.product.findFirst({
    where: { name: DEMO_ENTERPRISE_PRODUCT_NAME },
  });

  if (!product) {
    product = await prisma.product.create({
      data: {
        name: DEMO_ENTERPRISE_PRODUCT_NAME,
        description: 'Full enterprise access for demo tenants — all features unlocked',
        type: 'SUBSCRIPTION' as any,
        billingInterval: 'MONTHLY' as any,
        priceUSD: 0,
        sortOrder: 99,
        active: true,
        features: ['Unlimited animals', 'Unlimited breeding plans', 'All enterprise features'],
      },
    });
    log(`✅ Created product: ${product.name}`);
  } else {
    log(`  = Product exists: ${product.name}`);
  }

  // Always upsert entitlements so re-runs stay in sync with the full enum
  const entitlementKeys = [
    'ANIMAL_QUOTA', 'CONTACT_QUOTA', 'PORTAL_USER_QUOTA', 'BREEDING_PLAN_QUOTA',
    'MARKETPLACE_LISTING_QUOTA', 'STORAGE_QUOTA_GB', 'SMS_QUOTA',
    'PLATFORM_ACCESS', 'MARKETPLACE_ACCESS', 'PORTAL_ACCESS',
    'BREEDING_PLANS', 'FINANCIAL_SUITE', 'DOCUMENT_MANAGEMENT',
    'HEALTH_RECORDS', 'WAITLIST_MANAGEMENT', 'ADVANCED_REPORTING',
    'API_ACCESS', 'MULTI_LOCATION', 'E_SIGNATURES', 'DATA_EXPORT',
    'GENETICS_STANDARD', 'GENETICS_PRO', 'AI_ASSISTANT',
  ] as const;

  for (const key of entitlementKeys) {
    await prisma.productEntitlement.upsert({
      where: { productId_entitlementKey: { productId: product.id, entitlementKey: key as any } },
      update: { limitValue: null },
      create: { productId: product.id, entitlementKey: key as any, limitValue: null },
    });
  }
  log(`  → ${entitlementKeys.length} entitlements configured (all unlimited)`);

  // Check if tenant already has an active subscription
  const existing = await prisma.subscription.findFirst({
    where: { tenantId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } },
  });

  if (existing) {
    log(`  = Subscription already active (id: ${existing.id})`);
    return;
  }

  await prisma.subscription.create({
    data: {
      tenantId,
      productId: product.id,
      status: SubscriptionStatus.ACTIVE,
      amountCents: 0,
      billingInterval: BillingInterval.MONTHLY,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 10), // 10 years
    },
  });
  log(`✅ Active Demo Enterprise subscription created for tenant ${tenantId}`);
}

// ══════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  KVS Demo Tenant Seeder — Running Springs QH & Cattle  ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  if (forceRecreate) console.log('\n⚠️  --force mode: existing tenant will be deleted and recreated\n');

  const { tenantId } = await seedTenantAndUser();
  await seedDemoSubscription(tenantId);
  const tagMap = await seedTags(tenantId);
  await seedContacts(tenantId, tagMap);
  const animalIdMap = await seedAnimals(tenantId, tagMap);
  await seedGenetics(tenantId, animalIdMap);
  const regIdMap = await seedRegistryIdentifiers(tenantId, animalIdMap);
  await seedRegistryPedigrees(regIdMap);
  await seedCompetitions(tenantId, animalIdMap);
  await seedBreedingProfiles(tenantId, animalIdMap);
  await seedSemenInventory(tenantId, animalIdMap);
  const planIdMap = await seedBreedingPlans(tenantId, animalIdMap, tagMap);
  await seedTestResults(tenantId, planIdMap, animalIdMap);
  await seedBreedingAttempts(tenantId, planIdMap, animalIdMap);
  await seedPregnancyChecks(tenantId, planIdMap);
  await seedFoalingOutcomes(tenantId, planIdMap);
  await seedOffspring(tenantId, planIdMap, animalIdMap);
  await seedMareHistory(tenantId, animalIdMap);
  await seedTitles(tenantId, animalIdMap);

  // ── Summary ─────────────────────────────────────────────────────────
  const [animals, plans, competitions, semen, contacts] = await Promise.all([
    prisma.animal.count({ where: { tenantId } }),
    prisma.breedingPlan.count({ where: { tenantId } }),
    prisma.competitionEntry.count({ where: { tenantId } }),
    prisma.semenInventory.count({ where: { tenantId } }),
    prisma.contact.count({ where: { tenantId } }),
  ]);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                      SEED COMPLETE                     ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  Tenant ID:     ${String(tenantId).padEnd(39)}║`);
  console.log(`║  Animals:       ${String(animals).padEnd(39)}║`);
  console.log(`║  Breeding Plans:${String(plans).padEnd(39)}║`);
  console.log(`║  Show Records:  ${String(competitions).padEnd(39)}║`);
  console.log(`║  Semen Batches: ${String(semen).padEnd(39)}║`);
  console.log(`║  Contacts:      ${String(contacts).padEnd(39)}║`);
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log('║  Login Credentials:                                    ║');
  console.log(`║  Email:    ${KVS_USER.email.padEnd(44)}║`);
  console.log(`║  Password: ${KVS_USER.password.padEnd(44)}║`);
  console.log('╚════════════════════════════════════════════════════════╝\n');
}

main()
  .catch((err) => {
    console.error('\n❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
