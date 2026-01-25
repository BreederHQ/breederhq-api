/**
 * Populate inboundEmailSlug for existing tenants
 * This script generates slugs from organization names and handles duplicates
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting to populate inbound email slugs...");

  // Step 1: Generate base slugs from organization names
  console.log("\nStep 1: Generating slugs from organization names...");
  const result1 = await prisma.$executeRaw`
    UPDATE "Tenant" t
    SET "inboundEmailSlug" = (
      SELECT LOWER(
        REGEXP_REPLACE(
          REGEXP_REPLACE(o.name, '[^a-zA-Z0-9]+', '-', 'g'),
          '(^-|-$)', '', 'g'
        )
      )
      FROM "Organization" o
      WHERE o."tenantId" = t.id
      LIMIT 1
    )
    WHERE "inboundEmailSlug" IS NULL
  `;
  console.log(`Updated ${result1} tenants with base slugs`);

  // Step 2: Resolve duplicates by appending sequence numbers
  console.log("\nStep 2: Resolving duplicate slugs...");
  const result2 = await prisma.$executeRaw`
    WITH ranked AS (
      SELECT id, "inboundEmailSlug",
             ROW_NUMBER() OVER (PARTITION BY "inboundEmailSlug" ORDER BY id) as rn
      FROM "Tenant"
      WHERE "inboundEmailSlug" IS NOT NULL
    )
    UPDATE "Tenant" t
    SET "inboundEmailSlug" = r."inboundEmailSlug" || '-' || r.rn
    FROM ranked r
    WHERE t.id = r.id AND r.rn > 1
  `;
  console.log(`Updated ${result2} tenants to resolve duplicates`);

  // Verify results
  console.log("\nVerifying results...");
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      inboundEmailSlug: true,
    },
    orderBy: { id: "asc" },
  });

  console.log(`\nTotal tenants: ${tenants.length}`);
  console.log(`Tenants with slugs: ${tenants.filter((t) => t.inboundEmailSlug).length}`);
  console.log(`Tenants without slugs: ${tenants.filter((t) => !t.inboundEmailSlug).length}`);

  // Show sample of results
  console.log("\nSample results:");
  tenants.slice(0, 10).forEach((t) => {
    console.log(`  ${t.id}: ${t.name || "No name"} → ${t.inboundEmailSlug || "NULL"}`);
  });

  // Check for any remaining duplicates
  const duplicateCheck = await prisma.$queryRaw<{ slug: string; count: bigint }[]>`
    SELECT "inboundEmailSlug" as slug, COUNT(*) as count
    FROM "Tenant"
    WHERE "inboundEmailSlug" IS NOT NULL
    GROUP BY "inboundEmailSlug"
    HAVING COUNT(*) > 1
  `;

  if (duplicateCheck.length > 0) {
    console.log("\n⚠️  WARNING: Still have duplicate slugs:");
    duplicateCheck.forEach((dup) => {
      console.log(`  ${dup.slug}: ${dup.count} tenants`);
    });
  } else {
    console.log("\n✅ All slugs are unique");
  }

  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
