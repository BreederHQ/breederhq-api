// prisma/seed/seed-microchip-registries.ts
// Seeds the MicrochipRegistry lookup table with known microchip registries
import "./seed-env-bootstrap";
import { PrismaClient, MicrochipRenewalType } from "@prisma/client";

const prisma = new PrismaClient();

type MicrochipRegistrySeed = {
  name: string;
  slug: string;
  website: string | null;
  renewalType: MicrochipRenewalType;
  species: string[];
  sortOrder: number;
};

const MICROCHIP_REGISTRIES: MicrochipRegistrySeed[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // Pet Registries - Lifetime (no renewal needed)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "FreePetChipRegistry",
    slug: "freepetchipregistry",
    website: "https://www.freepetchipregistry.com",
    renewalType: MicrochipRenewalType.LIFETIME,
    species: ["DOG", "CAT", "ALL"],
    sortOrder: 1,
  },
  {
    name: "Michelson Found Animals",
    slug: "michelson-found-animals",
    website: "https://www.found.org",
    renewalType: MicrochipRenewalType.LIFETIME,
    species: ["DOG", "CAT", "ALL"],
    sortOrder: 2,
  },
  {
    name: "Furreka",
    slug: "furreka",
    website: "https://www.furreka.com",
    renewalType: MicrochipRenewalType.LIFETIME,
    species: ["DOG", "CAT", "ALL"],
    sortOrder: 3,
  },
  {
    name: "AKC Reunite",
    slug: "akc-reunite",
    website: "https://www.akcreunite.org",
    renewalType: MicrochipRenewalType.LIFETIME,
    species: ["DOG", "CAT"],
    sortOrder: 4,
  },
  {
    name: "ACA MARRS",
    slug: "aca-marrs",
    website: "https://www.acamarrs.com",
    renewalType: MicrochipRenewalType.LIFETIME,
    species: ["DOG", "CAT", "ALL"],
    sortOrder: 5,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Pet Registries - Annual (renewal required)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "HomeAgain",
    slug: "homeagain",
    website: "https://www.homeagain.com",
    renewalType: MicrochipRenewalType.ANNUAL,
    species: ["DOG", "CAT", "ALL"],
    sortOrder: 10,
  },
  {
    name: "24PetWatch",
    slug: "24petwatch",
    website: "https://www.24petwatch.com",
    renewalType: MicrochipRenewalType.ANNUAL,
    species: ["DOG", "CAT", "ALL"],
    sortOrder: 11,
  },
  {
    name: "AVID PETtrac",
    slug: "avid-pettrac",
    website: "https://www.avidid.com",
    renewalType: MicrochipRenewalType.ANNUAL,
    species: ["DOG", "CAT", "ALL"],
    sortOrder: 12,
  },
  {
    name: "Peeva",
    slug: "peeva",
    website: "https://peeva.co",
    renewalType: MicrochipRenewalType.ANNUAL,
    species: ["DOG", "CAT", "ALL"],
    sortOrder: 13,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Pet Registries - Unknown/Varies
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "PetLink",
    slug: "petlink",
    website: "https://www.petlink.net",
    renewalType: MicrochipRenewalType.UNKNOWN,
    species: ["DOG", "CAT", "ALL"],
    sortOrder: 20,
  },
  {
    name: "Petkey",
    slug: "petkey",
    website: "https://www.petkey.org",
    renewalType: MicrochipRenewalType.UNKNOWN,
    species: ["DOG", "CAT", "ALL"],
    sortOrder: 21,
  },
  {
    name: "Pet Microchip Lookup",
    slug: "pet-microchip-lookup",
    website: "https://www.petmicrochiplookup.org",
    renewalType: MicrochipRenewalType.UNKNOWN,
    species: ["DOG", "CAT", "ALL"],
    sortOrder: 22,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Equine Registries
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Equine Protection Registry",
    slug: "equine-protection-registry",
    website: "https://microchipidequine.com",
    renewalType: MicrochipRenewalType.LIFETIME,
    species: ["HORSE"],
    sortOrder: 30,
  },
  {
    name: "BuddyID",
    slug: "buddyid",
    website: "https://www.buddyid.com",
    renewalType: MicrochipRenewalType.LIFETIME,
    species: ["HORSE", "DOG", "CAT", "ALL"],
    sortOrder: 31,
  },
  {
    name: "NetPosse",
    slug: "netposse",
    website: "https://www.netposse.com",
    renewalType: MicrochipRenewalType.LIFETIME,
    species: ["HORSE"],
    sortOrder: 32,
  },
  {
    name: "USEF Microchip Registry",
    slug: "usef-microchip",
    website: "https://www.usef.org",
    renewalType: MicrochipRenewalType.UNKNOWN,
    species: ["HORSE"],
    sortOrder: 33,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Livestock (USDA Regulated)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "USDA 840 Official",
    slug: "usda-840",
    website: "https://www.aphis.usda.gov/aphis/ourfocus/animalhealth/traceability",
    renewalType: MicrochipRenewalType.LIFETIME,
    species: ["CATTLE", "SHEEP", "GOAT", "PIG", "LIVESTOCK"],
    sortOrder: 40,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Generic Fallback
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Other Registry",
    slug: "other",
    website: null,
    renewalType: MicrochipRenewalType.UNKNOWN,
    species: ["ALL"],
    sortOrder: 99,
  },
];

async function main() {
  console.log("Seeding microchip registries...");

  for (const registry of MICROCHIP_REGISTRIES) {
    const result = await prisma.microchipRegistry.upsert({
      where: { slug: registry.slug },
      update: {
        name: registry.name,
        website: registry.website,
        renewalType: registry.renewalType,
        species: registry.species,
        sortOrder: registry.sortOrder,
        isActive: true,
      },
      create: {
        name: registry.name,
        slug: registry.slug,
        website: registry.website,
        renewalType: registry.renewalType,
        species: registry.species,
        sortOrder: registry.sortOrder,
        isActive: true,
      },
    });

    console.log(`Upserted microchip registry: ${result.name} (${result.slug})`);
  }

  const count = await prisma.microchipRegistry.count();
  console.log(`\nDone. Total microchip registries: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
