// scripts/check-enum-traits.ts
// Check all ENUM traits across species

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const enumTraits = await prisma.traitDefinition.findMany({
    where: {
      valueType: "ENUM",
      tenantId: null,
    },
    select: {
      key: true,
      displayName: true,
      category: true,
      enumValues: true,
      supportsHistory: true,
    },
    orderBy: [{ key: "asc" }],
  });

  console.log("ENUM Traits across all species:\n");
  console.log("=".repeat(80));

  let missingValues: string[] = [];
  let noHistory: string[] = [];

  for (const t of enumTraits) {
    const vals = (t.enumValues as string[]) || [];
    const historyFlag = t.supportsHistory ? "✓ history" : "✗ no history";

    console.log(`${t.key}`);
    console.log(`  Category: ${t.category}`);
    console.log(`  Display: ${t.displayName}`);
    console.log(`  Values: ${JSON.stringify(vals)}`);
    console.log(`  History: ${historyFlag}`);
    console.log("");

    if (vals.length === 0) {
      missingValues.push(t.key);
    }
    if (!t.supportsHistory) {
      noHistory.push(t.key);
    }
  }

  console.log("=".repeat(80));
  console.log(`\nTotal ENUM traits: ${enumTraits.length}`);

  if (missingValues.length > 0) {
    console.log(`\n⚠️  ENUM traits with NO enumValues defined (${missingValues.length}):`);
    missingValues.forEach((k) => console.log(`  - ${k}`));
  }

  if (noHistory.length > 0) {
    console.log(`\n📋 ENUM traits without history support (${noHistory.length}):`);
    noHistory.forEach((k) => console.log(`  - ${k}`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
