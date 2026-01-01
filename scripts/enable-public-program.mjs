#!/usr/bin/env node
/**
 * Enable Public Program
 *
 * Makes an Organization publicly discoverable on the Marketplace by setting:
 * - isPublicProgram = true
 * - programSlug (unique, slug-formatted)
 * - programBio (optional)
 * - publicContactEmail (optional)
 *
 * This script is idempotent and safe to run multiple times.
 *
 * Configuration (via environment variables):
 * - ORG_ID (optional, preferred) - numeric organization ID
 * - ORG_EMAIL (optional, fallback) - organization email to locate by
 * - PROGRAM_SLUG (required) - unique slug for the program (lowercase, digits, hyphens)
 * - PROGRAM_BIO (optional) - public bio/description
 * - PUBLIC_CONTACT_EMAIL (optional) - public contact email
 *
 * Usage:
 *   ORG_ID=123 PROGRAM_SLUG=my-farm npm run script:enable-public-program
 *   ORG_EMAIL=farm@example.com PROGRAM_SLUG=my-farm PROGRAM_BIO="..." npm run script:enable-public-program
 *
 * Or with dotenv:
 *   npx dotenv -e .env.dev -- node scripts/enable-public-program.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Slug validation regex: lowercase letters, digits, hyphens only
const SLUG_REGEX = /^[a-z0-9]+([a-z0-9-]*[a-z0-9]+)?$/;

function validateSlug(slug) {
  if (!slug || typeof slug !== 'string') return false;
  if (slug.length < 2 || slug.length > 50) return false;
  return SLUG_REGEX.test(slug);
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Enable Public Program');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Read configuration
  const orgId = process.env.ORG_ID ? parseInt(process.env.ORG_ID, 10) : null;
  const orgEmail = process.env.ORG_EMAIL?.trim();
  const programSlug = process.env.PROGRAM_SLUG?.trim();
  const programBio = process.env.PROGRAM_BIO?.trim() || null;
  const publicContactEmail = process.env.PUBLIC_CONTACT_EMAIL?.trim() || null;

  // Validate required inputs
  if (!programSlug) {
    console.error('❌ PROGRAM_SLUG is required');
    console.error('   Set PROGRAM_SLUG environment variable to a valid slug (lowercase, digits, hyphens)');
    console.error('   Example: PROGRAM_SLUG=my-breeding-farm');
    process.exit(1);
  }

  if (!validateSlug(programSlug)) {
    console.error(`❌ PROGRAM_SLUG '${programSlug}' is invalid`);
    console.error('   Slug must:');
    console.error('   - Be 2-50 characters long');
    console.error('   - Contain only lowercase letters, digits, and hyphens');
    console.error('   - Not start or end with a hyphen');
    console.error('   Example: my-breeding-farm');
    process.exit(1);
  }

  if (!orgId && !orgEmail) {
    console.error('❌ Either ORG_ID or ORG_EMAIL is required');
    console.error('   Set ORG_ID=<number> or ORG_EMAIL=<email> to identify the organization');
    process.exit(1);
  }

  // Locate organization
  console.log('Step 1: Locating organization...');

  let organization;

  if (orgId) {
    organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        email: true,
        programSlug: true,
        isPublicProgram: true,
        programBio: true,
        publicContactEmail: true,
      },
    });

    if (!organization) {
      console.error(`  ❌ Organization not found with ID: ${orgId}`);
      process.exit(1);
    }
  } else if (orgEmail) {
    organization = await prisma.organization.findFirst({
      where: { email: orgEmail },
      select: {
        id: true,
        name: true,
        email: true,
        programSlug: true,
        isPublicProgram: true,
        programBio: true,
        publicContactEmail: true,
      },
    });

    if (!organization) {
      console.error(`  ❌ Organization not found with email: ${orgEmail}`);
      process.exit(1);
    }
  }

  console.log(`  ✓ Found organization: ${organization.name} (id: ${organization.id})`);
  if (organization.email) {
    console.log(`    Email: ${organization.email}`);
  }

  // Check if programSlug is already in use by another organization
  console.log('\nStep 2: Validating program slug...');

  const existingSlug = await prisma.organization.findFirst({
    where: {
      programSlug: programSlug,
      id: { not: organization.id }, // Exclude current org
    },
    select: { id: true, name: true },
  });

  if (existingSlug) {
    console.error(`  ❌ Program slug '${programSlug}' is already in use by:`);
    console.error(`     Organization: ${existingSlug.name} (id: ${existingSlug.id})`);
    console.error('     Please choose a different PROGRAM_SLUG');
    process.exit(1);
  }

  if (organization.programSlug === programSlug) {
    console.log(`  ✓ Organization already has this slug: ${programSlug}`);
  } else if (organization.programSlug) {
    console.log(`  ⚠️  Organization currently has slug: ${organization.programSlug}`);
    console.log(`     Will update to: ${programSlug}`);
  } else {
    console.log(`  ✓ Slug '${programSlug}' is available`);
  }

  // Update organization
  console.log('\nStep 3: Updating organization...');

  const updateData = {
    isPublicProgram: true,
    programSlug: programSlug,
  };

  if (programBio !== null) {
    updateData.programBio = programBio;
  }

  if (publicContactEmail !== null) {
    updateData.publicContactEmail = publicContactEmail;
  }

  const updated = await prisma.organization.update({
    where: { id: organization.id },
    data: updateData,
    select: {
      id: true,
      name: true,
      programSlug: true,
      isPublicProgram: true,
      programBio: true,
      publicContactEmail: true,
    },
  });

  console.log('  ✓ Organization updated successfully');

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('Organization:');
  console.log(`  ID: ${updated.id}`);
  console.log(`  Name: ${updated.name}`);
  console.log(`  Program Slug: ${updated.programSlug}`);
  console.log(`  Is Public: ${updated.isPublicProgram}`);
  console.log(`  Bio: ${updated.programBio ? `${updated.programBio.substring(0, 60)}...` : '(none)'}`);
  console.log(`  Public Contact: ${updated.publicContactEmail || '(none)'}`);

  console.log('\nMarketplace URLs:');
  console.log(`  Profile: /programs/${updated.programSlug}`);
  console.log(`  Listings: /programs/${updated.programSlug}/offspring-groups`);

  console.log('\nVerification:');
  console.log('  Run: npm run script:verify-public-programs');
  console.log('  Or curl: GET /api/v1/public/marketplace/programs');

  console.log('\n✅ Public program enabled successfully!\n');
}

main()
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
