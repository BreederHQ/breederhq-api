// prisma/seed/seed-test-users.ts
// Creates test users for development after a database wipe.
// This script is idempotent - it can be run multiple times safely.
//
// Usage:
//   npm run db:dev:seed:users
//
// Or directly:
//   node scripts/run-with-env.js .env.dev.migrate npx tsx prisma/seed/seed-test-users.ts

import "./seed-env-bootstrap";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  PortalAccessStatus,
  TenantRole,
  TenantMembershipRole,
  TenantMembershipStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isSuperAdmin?: boolean;
  marketplaceAccess?: boolean;
  portalAccess?: boolean;
}

const TEST_USERS: TestUser[] = [
  {
    email: "admin@bhq.local",
    password: "AdminReset987!",
    firstName: "Admin",
    lastName: "User",
    isSuperAdmin: true,
  },
  {
    email: "portal-access@bhq.local",
    password: "TestPassword123!",
    firstName: "Portal",
    lastName: "Access",
    portalAccess: true,
  },
  {
    email: "no-portal-access@bhq.local",
    password: "TestPassword123!",
    firstName: "No Portal",
    lastName: "Access",
    portalAccess: false,
  },
  {
    email: "marketplace-access@bhq.local",
    password: "password123",
    firstName: "Marketplace",
    lastName: "Access",
    marketplaceAccess: true,
  },
  {
    email: "no-marketplace-access@bhq.local",
    password: "password123",
    firstName: "No Marketplace",
    lastName: "Access",
    marketplaceAccess: false,
  },
];

async function ensureUser(testUser: TestUser, testTenantId: number) {
  // Check if user already exists
  let user = await prisma.user.findUnique({
    where: { email: testUser.email },
  });

  if (!user) {
    // Hash password and create user
    const passwordHash = await bcrypt.hash(testUser.password, 12);
    user = await prisma.user.create({
      data: {
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        passwordHash,
        isSuperAdmin: testUser.isSuperAdmin ?? false,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✅ Created user: ${user.email} (id: ${user.id})`);
  } else {
    console.log(`ℹ️  User exists: ${user.email} (id: ${user.id})`);
  }

  // Ensure super admin has tenant access (OWNER role + defaultTenantId)
  if (testUser.isSuperAdmin) {
    const existingMembership = await prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId: testTenantId } },
    });
    if (!existingMembership) {
      await prisma.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId: testTenantId,
          role: TenantRole.OWNER,
          membershipRole: TenantMembershipRole.STAFF,
          membershipStatus: TenantMembershipStatus.ACTIVE,
        },
      });
      console.log(`   └─ Added OWNER membership to test tenant`);
    } else {
      console.log(`   └─ Tenant membership already exists`);
    }
    // Set defaultTenantId if not set
    if (!user.defaultTenantId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { defaultTenantId: testTenantId },
      });
      console.log(`   └─ Set defaultTenantId to ${testTenantId}`);
    }
  }

  // Ensure marketplace entitlement if specified
  if (testUser.marketplaceAccess) {
    const existingEntitlement = await prisma.userEntitlement.findUnique({
      where: { userId_key: { userId: user.id, key: "MARKETPLACE_ACCESS" } },
    });
    if (!existingEntitlement) {
      await prisma.userEntitlement.create({
        data: {
          userId: user.id,
          key: "MARKETPLACE_ACCESS",
          status: "ACTIVE",
        },
      });
      console.log(`   └─ Added MARKETPLACE_ACCESS entitlement`);
    } else {
      console.log(`   └─ MARKETPLACE_ACCESS entitlement already exists`);
    }
  }

  // Ensure portal access if specified
  if (testUser.portalAccess) {
    // Check if portal access already exists for this user
    const existingPortalAccess = await prisma.portalAccess.findFirst({
      where: { userId: user.id, tenantId: testTenantId },
    });

    if (!existingPortalAccess) {
      // Create a party for this user (CONTACT type for individual buyers)
      const partyData = {
        tenantId: testTenantId,
        type: "CONTACT" as const,
        name: `${testUser.firstName} ${testUser.lastName}`,
        email: testUser.email,
      };
      const party = await prisma.party.create({ data: partyData });

      // Create tenant membership (as CLIENT role)
      await prisma.tenantMembership.create({
        data: {
          tenantId: testTenantId,
          userId: user.id,
          role: TenantRole.VIEWER,
          membershipRole: TenantMembershipRole.CLIENT,
          membershipStatus: TenantMembershipStatus.ACTIVE,
          partyId: party.id,
        },
      });

      // Create portal access record
      await prisma.portalAccess.create({
        data: {
          tenantId: testTenantId,
          partyId: party.id,
          userId: user.id,
          status: PortalAccessStatus.ACTIVE,
          activatedAt: new Date(),
        },
      });

      // Link user to party
      await prisma.user.update({
        where: { id: user.id },
        data: { partyId: party.id },
      });

      console.log(`   └─ Added portal access to tenant (id: ${testTenantId})`);
    } else {
      console.log(`   └─ Portal access already exists`);
    }
  }
}

async function main() {
  console.log("🌱 Seeding test users...\n");

  // Create or get a test tenant for portal access testing
  let testTenant = await prisma.tenant.findFirst({
    where: { name: "Test Breeder (Seed)" },
  });

  if (!testTenant) {
    testTenant = await prisma.tenant.create({
      data: {
        name: "Test Breeder (Seed)",
        slug: "test-breeder-seed",
        primaryEmail: TEST_USERS[0].email,
      },
    });
    console.log(`✅ Created test tenant: ${testTenant.name} (id: ${testTenant.id})`);
  } else {
    if (!testTenant.primaryEmail) {
      testTenant = await prisma.tenant.update({
        where: { id: testTenant.id },
        data: { primaryEmail: TEST_USERS[0].email },
      });
      console.log(`ℹ️  Set primaryEmail on existing tenant: ${TEST_USERS[0].email}`);
    }
    console.log(`ℹ️  Using existing test tenant: ${testTenant.name} (id: ${testTenant.id})`);
  }

  for (const testUser of TEST_USERS) {
    await ensureUser(testUser, testTenant.id);
  }

  console.log("\n✨ Test user seeding complete!\n");
  console.log("Test accounts:");
  console.log("─".repeat(70));
  for (const u of TEST_USERS) {
    const flags = [
      u.isSuperAdmin && "super-admin",
      u.portalAccess && "portal",
      u.marketplaceAccess && "marketplace",
    ]
      .filter(Boolean)
      .join(", ");
    console.log(`  ${u.email.padEnd(35)} ${u.password.padEnd(20)} ${flags || "(basic user)"}`);
  }
  console.log("─".repeat(70));
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
