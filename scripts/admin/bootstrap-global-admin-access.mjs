#!/usr/bin/env node
/**
 * Bootstrap Global Admin Access
 *
 * Ensures the global admin user has all necessary access across surfaces:
 * - PLATFORM: STAFF membership (ACTIVE)
 * - PORTAL: CLIENT membership (ACTIVE) for at least one tenant with a slug
 * - MARKETPLACE: UserEntitlement(MARKETPLACE_ACCESS, ACTIVE)
 *
 * This script is idempotent and safe to run multiple times.
 * It will not modify other users' data.
 *
 * Configuration (via environment variables):
 * - GLOBAL_ADMIN_EMAIL (required unless GLOBAL_ADMIN_USER_ID is set)
 * - GLOBAL_ADMIN_USER_ID (optional, overrides email lookup)
 * - GLOBAL_ADMIN_TENANT_SLUG (preferred) or GLOBAL_ADMIN_TENANT_ID
 *
 * Usage:
 *   npx dotenv -e .env.dev -- node scripts/bootstrap-global-admin-access.mjs
 *   npx dotenv -e .env.prod -- node scripts/bootstrap-global-admin-access.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const config = {
  adminEmail: process.env.GLOBAL_ADMIN_EMAIL,
  adminUserId: process.env.GLOBAL_ADMIN_USER_ID,
  tenantSlug: process.env.GLOBAL_ADMIN_TENANT_SLUG,
  tenantId: process.env.GLOBAL_ADMIN_TENANT_ID ? parseInt(process.env.GLOBAL_ADMIN_TENANT_ID, 10) : undefined,
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Bootstrap Logic
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Bootstrap Global Admin Access');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Locate the global admin user
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Step 1: Locating global admin user...');

  let adminUser;

  if (config.adminUserId) {
    adminUser = await prisma.user.findUnique({
      where: { id: config.adminUserId },
      select: { id: true, email: true, isSuperAdmin: true }
    });
    if (!adminUser) {
      console.error(`  ❌ User not found with ID: ${config.adminUserId}`);
      process.exit(1);
    }
  } else if (config.adminEmail) {
    adminUser = await prisma.user.findUnique({
      where: { email: config.adminEmail },
      select: { id: true, email: true, isSuperAdmin: true }
    });
    if (!adminUser) {
      console.error(`  ❌ User not found with email: ${config.adminEmail}`);
      process.exit(1);
    }
  } else {
    // Fallback: find any superadmin user
    adminUser = await prisma.user.findFirst({
      where: { isSuperAdmin: true },
      select: { id: true, email: true, isSuperAdmin: true }
    });
    if (!adminUser) {
      console.error('  ❌ No GLOBAL_ADMIN_EMAIL or GLOBAL_ADMIN_USER_ID set, and no superadmin found');
      console.error('     Set GLOBAL_ADMIN_EMAIL in your environment');
      process.exit(1);
    }
    console.log('  ⚠️  No GLOBAL_ADMIN_EMAIL set, using first superadmin found');
  }

  console.log(`  ✓ Found user: ${adminUser.email} (id: ${adminUser.id})`);
  console.log(`  ✓ isSuperAdmin: ${adminUser.isSuperAdmin}`);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Locate target tenant
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nStep 2: Locating target tenant...');

  let targetTenant;

  if (config.tenantSlug) {
    targetTenant = await prisma.tenant.findFirst({
      where: { slug: config.tenantSlug },
      select: { id: true, name: true, slug: true }
    });
    if (!targetTenant) {
      console.error(`  ❌ Tenant not found with slug: ${config.tenantSlug}`);
      process.exit(1);
    }
  } else if (config.tenantId) {
    targetTenant = await prisma.tenant.findUnique({
      where: { id: config.tenantId },
      select: { id: true, name: true, slug: true }
    });
    if (!targetTenant) {
      console.error(`  ❌ Tenant not found with ID: ${config.tenantId}`);
      process.exit(1);
    }
  } else {
    // Fallback: find first tenant (prefer one with a slug)
    targetTenant = await prisma.tenant.findFirst({
      where: { slug: { not: null } },
      select: { id: true, name: true, slug: true },
      orderBy: { id: 'asc' }
    });
    if (!targetTenant) {
      // Try any tenant
      targetTenant = await prisma.tenant.findFirst({
        select: { id: true, name: true, slug: true },
        orderBy: { id: 'asc' }
      });
    }
    if (!targetTenant) {
      console.error('  ❌ No tenants found in database');
      process.exit(1);
    }
    console.log('  ⚠️  No GLOBAL_ADMIN_TENANT_SLUG set, using first tenant');
  }

  console.log(`  ✓ Found tenant: ${targetTenant.name} (id: ${targetTenant.id})`);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: Ensure tenant has a slug (required for portal access)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nStep 3: Ensuring tenant has a slug for portal access...');

  let slugCreated = false;
  if (!targetTenant.slug) {
    // Generate a slug from tenant name
    const baseSlug = targetTenant.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    // Check for collision
    const existing = await prisma.tenant.findFirst({
      where: { slug: baseSlug }
    });

    if (existing) {
      // Append tenant ID to make unique
      const uniqueSlug = `${baseSlug}-${targetTenant.id}`;
      await prisma.tenant.update({
        where: { id: targetTenant.id },
        data: { slug: uniqueSlug }
      });
      targetTenant.slug = uniqueSlug;
      slugCreated = true;
      console.log(`  ✓ Created unique slug: ${uniqueSlug}`);
    } else {
      await prisma.tenant.update({
        where: { id: targetTenant.id },
        data: { slug: baseSlug }
      });
      targetTenant.slug = baseSlug;
      slugCreated = true;
      console.log(`  ✓ Created slug: ${baseSlug}`);
    }
  } else {
    console.log(`  ✓ Tenant already has slug: ${targetTenant.slug}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: Ensure STAFF membership for PLATFORM access
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nStep 4: Ensuring STAFF membership for PLATFORM access...');

  const existingStaffMembership = await prisma.tenantMembership.findFirst({
    where: {
      userId: adminUser.id,
      tenantId: targetTenant.id,
      membershipRole: 'STAFF'
    }
  });

  let staffMembershipCreated = false;
  let staffMembershipUpdated = false;

  if (existingStaffMembership) {
    if (existingStaffMembership.membershipStatus !== 'ACTIVE') {
      await prisma.tenantMembership.update({
        where: {
          userId_tenantId: {
            userId: adminUser.id,
            tenantId: targetTenant.id
          }
        },
        data: { membershipStatus: 'ACTIVE' }
      });
      staffMembershipUpdated = true;
      console.log(`  ✓ Updated STAFF membership status to ACTIVE`);
    } else {
      console.log(`  ✓ STAFF membership already exists and is ACTIVE`);
    }
  } else {
    // Check if any membership exists for this user/tenant
    const anyMembership = await prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId: adminUser.id,
          tenantId: targetTenant.id
        }
      }
    });

    if (anyMembership) {
      // Update existing membership to STAFF + ACTIVE
      await prisma.tenantMembership.update({
        where: {
          userId_tenantId: {
            userId: adminUser.id,
            tenantId: targetTenant.id
          }
        },
        data: {
          membershipRole: 'STAFF',
          membershipStatus: 'ACTIVE',
          role: 'OWNER' // Set legacy role to OWNER for full access
        }
      });
      staffMembershipUpdated = true;
      console.log(`  ✓ Updated existing membership to STAFF/ACTIVE`);
    } else {
      // Create new STAFF membership
      await prisma.tenantMembership.create({
        data: {
          userId: adminUser.id,
          tenantId: targetTenant.id,
          role: 'OWNER',
          membershipRole: 'STAFF',
          membershipStatus: 'ACTIVE'
        }
      });
      staffMembershipCreated = true;
      console.log(`  ✓ Created STAFF membership with OWNER role`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5: Ensure CLIENT membership for PORTAL access
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nStep 5: Ensuring CLIENT membership for PORTAL access...');

  // For portal, we need a CLIENT membership. Since a user can have multiple
  // memberships with different roles across tenants, we need to ensure at least
  // one CLIENT membership exists.

  const existingClientMembership = await prisma.tenantMembership.findFirst({
    where: {
      userId: adminUser.id,
      membershipRole: 'CLIENT',
      membershipStatus: 'ACTIVE'
    },
    include: {
      tenant: { select: { slug: true, name: true, id: true } }
    }
  });

  let clientMembershipCreated = false;
  let clientTenant = null;

  if (existingClientMembership && existingClientMembership.tenant.slug) {
    console.log(`  ✓ CLIENT membership already exists for tenant: ${existingClientMembership.tenant.name} (slug: ${existingClientMembership.tenant.slug})`);
    clientTenant = existingClientMembership.tenant;
  } else {
    // We need to create a CLIENT membership. Since the primary membership is STAFF,
    // we'll look for or create a second tenant for CLIENT access, or use a different
    // approach: find any other tenant that the admin can be a CLIENT of.

    // First, check if we can use a different tenant for CLIENT
    let clientTargetTenant = await prisma.tenant.findFirst({
      where: {
        id: { not: targetTenant.id },
        slug: { not: null }
      },
      select: { id: true, name: true, slug: true },
      orderBy: { id: 'asc' }
    });

    if (!clientTargetTenant) {
      // Use same tenant but note: a user can only have ONE membership per tenant
      // due to the @@id([userId, tenantId]) constraint.
      //
      // DESIGN DECISION: The same tenant membership can serve both purposes if
      // the user has STAFF role. For portal CLIENT access verification, we need
      // to ensure the portal auth allows STAFF members OR we need a separate tenant.
      //
      // For robustness, let's create a dedicated "admin-portal" tenant if none exists.

      const adminPortalTenant = await prisma.tenant.findFirst({
        where: { slug: 'admin-portal' }
      });

      if (adminPortalTenant) {
        clientTargetTenant = adminPortalTenant;
      } else {
        // Create a dedicated tenant for admin portal access
        clientTargetTenant = await prisma.tenant.create({
          data: {
            name: 'Admin Portal Access',
            slug: 'admin-portal'
          },
          select: { id: true, name: true, slug: true }
        });
        console.log(`  ⚠️  Created dedicated tenant for portal access: admin-portal`);
      }
    }

    // Check existing membership for this tenant
    const existingMembershipForClient = await prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId: adminUser.id,
          tenantId: clientTargetTenant.id
        }
      }
    });

    if (existingMembershipForClient) {
      if (existingMembershipForClient.membershipRole !== 'CLIENT' ||
          existingMembershipForClient.membershipStatus !== 'ACTIVE') {
        await prisma.tenantMembership.update({
          where: {
            userId_tenantId: {
              userId: adminUser.id,
              tenantId: clientTargetTenant.id
            }
          },
          data: {
            membershipRole: 'CLIENT',
            membershipStatus: 'ACTIVE'
          }
        });
        console.log(`  ✓ Updated membership to CLIENT/ACTIVE for tenant: ${clientTargetTenant.name}`);
      } else {
        console.log(`  ✓ CLIENT membership already exists for tenant: ${clientTargetTenant.name}`);
      }
    } else {
      await prisma.tenantMembership.create({
        data: {
          userId: adminUser.id,
          tenantId: clientTargetTenant.id,
          role: 'MEMBER', // Legacy role (less privileged for CLIENT)
          membershipRole: 'CLIENT',
          membershipStatus: 'ACTIVE'
        }
      });
      clientMembershipCreated = true;
      console.log(`  ✓ Created CLIENT membership for tenant: ${clientTargetTenant.name}`);
    }

    clientTenant = clientTargetTenant;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 6: Ensure MARKETPLACE_ACCESS entitlement
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nStep 6: Ensuring MARKETPLACE_ACCESS entitlement...');

  const existingEntitlement = await prisma.userEntitlement.findUnique({
    where: {
      userId_key: {
        userId: adminUser.id,
        key: 'MARKETPLACE_ACCESS'
      }
    }
  });

  let entitlementCreated = false;
  let entitlementUpdated = false;

  if (existingEntitlement) {
    if (existingEntitlement.status !== 'ACTIVE') {
      await prisma.userEntitlement.update({
        where: { id: existingEntitlement.id },
        data: {
          status: 'ACTIVE',
          revokedAt: null
        }
      });
      entitlementUpdated = true;
      console.log(`  ✓ Reactivated MARKETPLACE_ACCESS entitlement`);
    } else {
      console.log(`  ✓ MARKETPLACE_ACCESS entitlement already exists and is ACTIVE`);
    }
  } else {
    await prisma.userEntitlement.create({
      data: {
        userId: adminUser.id,
        key: 'MARKETPLACE_ACCESS',
        status: 'ACTIVE'
      }
    });
    entitlementCreated = true;
    console.log(`  ✓ Created MARKETPLACE_ACCESS entitlement`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('User:');
  console.log(`  Email: ${adminUser.email}`);
  console.log(`  ID: ${adminUser.id}`);
  console.log(`  isSuperAdmin: ${adminUser.isSuperAdmin}`);

  console.log('\nPLATFORM Access (STAFF):');
  console.log(`  Tenant: ${targetTenant.name} (id: ${targetTenant.id})`);
  console.log(`  Slug: ${targetTenant.slug}`);
  console.log(`  Status: ${staffMembershipCreated ? 'CREATED' : staffMembershipUpdated ? 'UPDATED' : 'EXISTED'}`);

  console.log('\nPORTAL Access (CLIENT):');
  console.log(`  Tenant: ${clientTenant.name} (id: ${clientTenant.id})`);
  console.log(`  Slug: ${clientTenant.slug}`);
  console.log(`  Portal URL: /t/${clientTenant.slug}/...`);
  console.log(`  Status: ${clientMembershipCreated ? 'CREATED' : 'EXISTED/UPDATED'}`);

  console.log('\nMARKETPLACE Access (Entitlement):');
  console.log(`  Key: MARKETPLACE_ACCESS`);
  console.log(`  Status: ${entitlementCreated ? 'CREATED' : entitlementUpdated ? 'REACTIVATED' : 'EXISTED'}`);

  // ─────────────────────────────────────────────────────────────────────────
  // Verification Queries
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Verification Queries');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Count memberships
  const staffCount = await prisma.tenantMembership.count({
    where: {
      userId: adminUser.id,
      membershipRole: 'STAFF',
      membershipStatus: 'ACTIVE'
    }
  });

  const clientCount = await prisma.tenantMembership.count({
    where: {
      userId: adminUser.id,
      membershipRole: 'CLIENT',
      membershipStatus: 'ACTIVE'
    }
  });

  const entitlementCount = await prisma.userEntitlement.count({
    where: {
      userId: adminUser.id,
      key: 'MARKETPLACE_ACCESS',
      status: 'ACTIVE'
    }
  });

  console.log(`STAFF memberships (ACTIVE): ${staffCount}`);
  console.log(`CLIENT memberships (ACTIVE): ${clientCount}`);
  console.log(`MARKETPLACE_ACCESS entitlements (ACTIVE): ${entitlementCount}`);

  // Verification checklist
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Verification Checklist');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('1. PLATFORM Login Test:');
  console.log('   URL: https://app.breederhq.com/login');
  console.log(`   Expected: Login succeeds, can access tenant data`);

  console.log('\n2. PORTAL Access Test:');
  console.log(`   URL: https://portal.breederhq.com/t/${clientTenant.slug}/dashboard`);
  console.log('   Expected: Access granted, dashboard loads');

  console.log('\n3. MARKETPLACE Access Test:');
  console.log('   URL: https://marketplace.breederhq.com/');
  console.log('   Expected: Access granted (no 403 for entitlement)');

  console.log('\n✅ Bootstrap completed successfully!\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Entry Point
// ═══════════════════════════════════════════════════════════════════════════

main()
  .catch((error) => {
    console.error('\n❌ Bootstrap failed:', error.message);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
