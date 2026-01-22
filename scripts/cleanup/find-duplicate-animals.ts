/**
 * Find duplicate animals in tenant 4
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function findDuplicates() {
  console.log("🔍 Finding duplicate animals in tenant 4...\n");

  const tenantId = 4;

  // Find animals grouped by name with count > 1
  const duplicates = await prisma.$queryRaw<
    Array<{ name: string; count: bigint }>
  >`
    SELECT name, COUNT(*) as count
    FROM "Animal"
    WHERE "tenantId" = ${tenantId}
    GROUP BY name
    HAVING COUNT(*) > 1
    ORDER BY count DESC, name
  `;

  if (duplicates.length === 0) {
    console.log("✅ No duplicate animals found!");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${duplicates.length} duplicate name(s):\n`);

  for (const dup of duplicates) {
    console.log(`\n📋 "${dup.name}" (${dup.count} copies):`);

    const animals = await prisma.animal.findMany({
      where: { tenantId, name: dup.name },
      select: {
        id: true,
        name: true,
        sex: true,
        birthDate: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: "asc" },
    });

    animals.forEach((a, i) => {
      const marker = i === 0 ? "  [KEEP]" : "  [DELETE]";
      console.log(
        `${marker} ID ${a.id}: ${a.sex || "?"} | DOB: ${a.birthDate?.toISOString().split("T")[0] || "?"} | Created: ${a.createdAt.toISOString()} | Status: ${a.status}`
      );
    });
  }

  await prisma.$disconnect();
}

findDuplicates().catch((e) => {
  console.error(e);
  process.exit(1);
});
