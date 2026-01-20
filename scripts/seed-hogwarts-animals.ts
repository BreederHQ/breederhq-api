/**
 * Seed HORSE and GOAT animals for Hogwarts tenant (ID 87) for E2E testing
 *
 * Usage:
 *   npx tsx scripts/seed-hogwarts-animals.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HOGWARTS_TENANT_ID = 87;

async function main() {
  console.log("═".repeat(60));
  console.log("Seeding HORSE and GOAT Animals for Hogwarts Tenant");
  console.log("═".repeat(60));
  console.log(`\nTarget tenant: ${HOGWARTS_TENANT_ID}\n`);

  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: HOGWARTS_TENANT_ID },
  });

  if (!tenant) {
    console.error(`❌ Tenant ${HOGWARTS_TENANT_ID} not found!`);
    process.exit(1);
  }

  console.log(`✓ Tenant found: ${tenant.name}\n`);

  // Define animals to create
  const animalsToCreate = [
    // HORSE animals
    {
      name: "E2E Test Mare (Horse Dam)",
      species: "HORSE" as const,
      sex: "FEMALE" as const,
      breed: "Thoroughbred",
      birthDate: new Date("2018-04-15"),
      notes: "Test mare for E2E breeding tests",
    },
    {
      name: "E2E Test Stallion (Horse Sire)",
      species: "HORSE" as const,
      sex: "MALE" as const,
      breed: "Thoroughbred",
      birthDate: new Date("2017-03-20"),
      notes: "Test stallion for E2E breeding tests",
    },
    // GOAT animals
    {
      name: "E2E Test Doe (Goat Dam)",
      species: "GOAT" as const,
      sex: "FEMALE" as const,
      breed: "Nubian",
      birthDate: new Date("2021-02-10"),
      notes: "Test doe for E2E breeding tests",
    },
    {
      name: "E2E Test Buck (Goat Sire)",
      species: "GOAT" as const,
      sex: "MALE" as const,
      breed: "Nubian",
      birthDate: new Date("2020-05-15"),
      notes: "Test buck for E2E breeding tests",
    },
  ];

  console.log("Creating/updating test animals...\n");

  for (const animalData of animalsToCreate) {
    // Check if animal already exists
    const existing = await prisma.animal.findFirst({
      where: {
        tenantId: HOGWARTS_TENANT_ID,
        name: animalData.name,
        species: animalData.species,
      },
    });

    if (existing) {
      console.log(`  ℹ ${animalData.species} ${animalData.sex}: Already exists (ID: ${existing.id}) - ${animalData.name}`);
    } else {
      const created = await prisma.animal.create({
        data: {
          tenantId: HOGWARTS_TENANT_ID,
          name: animalData.name,
          species: animalData.species,
          sex: animalData.sex,
          breed: animalData.breed,
          birthDate: animalData.birthDate,
          notes: animalData.notes,
          status: "ACTIVE",
        },
      });
      console.log(`  ✓ ${animalData.species} ${animalData.sex}: Created (ID: ${created.id}) - ${animalData.name}`);
    }
  }

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("Summary of E2E Test Animals");
  console.log("═".repeat(60));

  const allAnimals = await prisma.animal.findMany({
    where: {
      tenantId: HOGWARTS_TENANT_ID,
      name: { startsWith: "E2E Test" },
    },
    select: {
      id: true,
      name: true,
      species: true,
      sex: true,
    },
    orderBy: [{ species: "asc" }, { sex: "asc" }],
  });

  console.log("\nE2E Test Animals:");
  for (const animal of allAnimals) {
    console.log(`  ${animal.species} ${animal.sex}: ID ${animal.id} - ${animal.name}`);
  }

  console.log("\n" + "═".repeat(60));
  console.log("DONE - Animals ready for E2E testing");
  console.log("═".repeat(60));
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
