// prisma/seed/seed-supplement-benchmarks.ts
// Seeds industry benchmark supplement protocols (system-level, tenantId = null)
import "./seed-env-bootstrap";
import {
  PrismaClient,
  Species,
  SupplementTriggerType,
  BreedingCycleAnchorEvent,
  SupplementFrequency,
} from "@prisma/client";

const prisma = new PrismaClient();

type SupplementBenchmarkSeed = {
  name: string;
  description: string | null;
  species: Species[];
  benchmarkSource: string | null;
  benchmarkNotes: string | null;
  dosageAmount: string | null;
  dosageUnit: string | null;
  administrationRoute: string | null;
  triggerType: SupplementTriggerType;
  anchorEvent: BreedingCycleAnchorEvent | null;
  offsetDays: number | null;
  ageTriggerWeeks: number | null;
  durationDays: number | null;
  frequency: SupplementFrequency;
  reminderDaysBefore: number[];
};

const SUPPLEMENT_BENCHMARKS: SupplementBenchmarkSeed[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // HORSES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Regumate (Altrenogest) - Estrus Suppression",
    description:
      "Synthetic progestin to suppress estrus in mares. Commonly used before planned breeding.",
    species: [Species.HORSE],
    benchmarkSource: "AAEP Guidelines",
    benchmarkNotes:
      "Requires veterinary prescription. Handler safety precautions required - wear gloves.",
    dosageAmount: "0.044 mg/kg",
    dosageUnit: "mg/kg (oral)",
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: -21, // Start 21 days before breeding
    ageTriggerWeeks: null,
    durationDays: 21,
    frequency: SupplementFrequency.DAILY,
    reminderDaysBefore: [7, 3, 1],
  },
  {
    name: "Mare Prenatal Vitamin",
    description: "Daily vitamin supplement during pregnancy for mares.",
    species: [Species.HORSE],
    benchmarkSource: "General Practice",
    benchmarkNotes: null,
    dosageAmount: null,
    dosageUnit: null,
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: 1, // Start day after breeding
    ageTriggerWeeks: null,
    durationDays: null, // Ongoing through pregnancy
    frequency: SupplementFrequency.ONGOING,
    reminderDaysBefore: [7, 1],
  },
  {
    name: "Mare Selenium/Vitamin E",
    description:
      "Selenium and Vitamin E supplementation for mares in selenium-deficient areas during late gestation.",
    species: [Species.HORSE],
    benchmarkSource: "AAEP Guidelines",
    benchmarkNotes:
      "Important in selenium-deficient regions. Helps prevent white muscle disease in foals.",
    dosageAmount: null,
    dosageUnit: null,
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BIRTH_DATE,
    offsetDays: -90, // Start 90 days before expected foaling
    ageTriggerWeeks: null,
    durationDays: 90,
    frequency: SupplementFrequency.DAILY,
    reminderDaysBefore: [7, 3, 1],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // DOGS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Folic Acid Supplement - Pre-breeding",
    description:
      "Folic acid supplementation starting before breeding to support neural tube development.",
    species: [Species.DOG],
    benchmarkSource: "Canine Reproduction Guidelines",
    benchmarkNotes:
      "Research suggests folic acid may reduce risk of cleft palate and other developmental issues.",
    dosageAmount: null,
    dosageUnit: null,
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: -63, // Start 63 days before breeding
    ageTriggerWeeks: null,
    durationDays: 63,
    frequency: SupplementFrequency.DAILY,
    reminderDaysBefore: [7, 3, 1],
  },
  {
    name: "Prenatal Vitamin - Canine",
    description: "Daily prenatal supplement during canine pregnancy.",
    species: [Species.DOG],
    benchmarkSource: "General Practice",
    benchmarkNotes: null,
    dosageAmount: null,
    dosageUnit: null,
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: 1,
    ageTriggerWeeks: null,
    durationDays: null, // Through pregnancy
    frequency: SupplementFrequency.ONGOING,
    reminderDaysBefore: [7, 1],
  },
  {
    name: "Puppy Dewormer (Pyrantel)",
    description:
      "Deworming protocol for puppies starting at 2 weeks of age, continuing every 2 weeks until 12 weeks.",
    species: [Species.DOG],
    benchmarkSource: "CDC/CAPC Guidelines",
    benchmarkNotes:
      "Standard protocol: 2, 4, 6, 8, 10, 12 weeks. Then monthly until 6 months.",
    dosageAmount: "1ml per 10 lbs",
    dosageUnit: "ml",
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.AGE_BASED,
    anchorEvent: null,
    offsetDays: null,
    ageTriggerWeeks: 2, // Start at 2 weeks old
    durationDays: 70, // 10 weeks of treatment (2-12 weeks)
    frequency: SupplementFrequency.WEEKLY, // Approximation - actually every 2 weeks
    reminderDaysBefore: [3, 1],
  },
  {
    name: "Calcium Supplementation - Late Pregnancy",
    description:
      "Calcium supplementation for bitches prone to eclampsia, starting late pregnancy.",
    species: [Species.DOG],
    benchmarkSource: "Veterinary Practice",
    benchmarkNotes:
      "Controversial - some vets recommend, others advise against pre-whelping calcium. Consult your vet.",
    dosageAmount: null,
    dosageUnit: null,
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BIRTH_DATE,
    offsetDays: -14, // Start 2 weeks before expected whelping
    ageTriggerWeeks: null,
    durationDays: 28, // Through 2 weeks post-whelping
    frequency: SupplementFrequency.DAILY,
    reminderDaysBefore: [7, 3, 1],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CATS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Prenatal Vitamin - Feline",
    description: "Daily prenatal supplement during feline pregnancy.",
    species: [Species.CAT],
    benchmarkSource: "General Practice",
    benchmarkNotes: null,
    dosageAmount: null,
    dosageUnit: null,
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: 1,
    ageTriggerWeeks: null,
    durationDays: null,
    frequency: SupplementFrequency.ONGOING,
    reminderDaysBefore: [7, 1],
  },
  {
    name: "Kitten Dewormer",
    description:
      "Deworming protocol for kittens starting at 3 weeks of age.",
    species: [Species.CAT],
    benchmarkSource: "CAPC Guidelines",
    benchmarkNotes: "Standard protocol: 3, 5, 7, 9 weeks, then monthly.",
    dosageAmount: null,
    dosageUnit: null,
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.AGE_BASED,
    anchorEvent: null,
    offsetDays: null,
    ageTriggerWeeks: 3,
    durationDays: 42, // 6 weeks of treatment
    frequency: SupplementFrequency.WEEKLY,
    reminderDaysBefore: [3, 1],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GOATS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Selenium/Vitamin E - Pre-Kidding",
    description:
      "Selenium and Vitamin E injection for does 4-6 weeks before kidding.",
    species: [Species.GOAT],
    benchmarkSource: "AASRP Guidelines",
    benchmarkNotes:
      "Critical in selenium-deficient areas to prevent white muscle disease in kids.",
    dosageAmount: null,
    dosageUnit: null,
    administrationRoute: "injection",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BIRTH_DATE,
    offsetDays: -35, // 5 weeks before kidding
    ageTriggerWeeks: null,
    durationDays: 1,
    frequency: SupplementFrequency.ONCE,
    reminderDaysBefore: [7, 3, 1],
  },
  {
    name: "CDT Vaccine Booster - Pre-Kidding",
    description:
      "CDT vaccine booster for does 4 weeks before kidding to provide colostral immunity.",
    species: [Species.GOAT],
    benchmarkSource: "AASRP Guidelines",
    benchmarkNotes: null,
    dosageAmount: null,
    dosageUnit: null,
    administrationRoute: "injection",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BIRTH_DATE,
    offsetDays: -28, // 4 weeks before kidding
    ageTriggerWeeks: null,
    durationDays: 1,
    frequency: SupplementFrequency.ONCE,
    reminderDaysBefore: [7, 3, 1],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SHEEP
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Selenium/Vitamin E - Pre-Lambing",
    description:
      "Selenium and Vitamin E supplementation for ewes before lambing.",
    species: [Species.SHEEP],
    benchmarkSource: "AASRP Guidelines",
    benchmarkNotes: "Prevents white muscle disease in lambs.",
    dosageAmount: null,
    dosageUnit: null,
    administrationRoute: "injection",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BIRTH_DATE,
    offsetDays: -35,
    ageTriggerWeeks: null,
    durationDays: 1,
    frequency: SupplementFrequency.ONCE,
    reminderDaysBefore: [7, 3, 1],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // RABBITS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Prenatal Supplement - Rabbit",
    description: "Nutritional supplementation during rabbit pregnancy.",
    species: [Species.RABBIT],
    benchmarkSource: "General Practice",
    benchmarkNotes: null,
    dosageAmount: null,
    dosageUnit: null,
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: 1,
    ageTriggerWeeks: null,
    durationDays: 31, // Rabbit gestation ~31 days
    frequency: SupplementFrequency.DAILY,
    reminderDaysBefore: [7, 1],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // ALL SPECIES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Probiotics - Post-Antibiotic",
    description:
      "Probiotic supplementation after antibiotic treatment to restore gut flora.",
    species: [
      Species.DOG,
      Species.CAT,
      Species.HORSE,
      Species.GOAT,
      Species.SHEEP,
      Species.RABBIT,
    ],
    benchmarkSource: "General Practice",
    benchmarkNotes: null,
    dosageAmount: null,
    dosageUnit: null,
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.MANUAL,
    anchorEvent: null,
    offsetDays: null,
    ageTriggerWeeks: null,
    durationDays: 14,
    frequency: SupplementFrequency.DAILY,
    reminderDaysBefore: [1],
  },
  {
    name: "Electrolytes - Post-Birth Recovery",
    description:
      "Electrolyte supplementation for dams immediately after giving birth.",
    species: [
      Species.DOG,
      Species.CAT,
      Species.HORSE,
      Species.GOAT,
      Species.SHEEP,
    ],
    benchmarkSource: "General Practice",
    benchmarkNotes: null,
    dosageAmount: null,
    dosageUnit: null,
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BIRTH_DATE,
    offsetDays: 0, // Day of birth
    ageTriggerWeeks: null,
    durationDays: 3,
    frequency: SupplementFrequency.DAILY,
    reminderDaysBefore: [7, 1],
  },
];

async function main() {
  console.log("Seeding supplement benchmark protocols...");

  for (const benchmark of SUPPLEMENT_BENCHMARKS) {
    // Check if benchmark already exists by name (since tenantId is null for benchmarks)
    const existing = await prisma.supplementProtocol.findFirst({
      where: {
        name: benchmark.name,
        isBenchmark: true,
        tenantId: null,
      },
    });

    if (existing) {
      // Update existing
      await prisma.supplementProtocol.update({
        where: { id: existing.id },
        data: {
          description: benchmark.description,
          species: benchmark.species,
          benchmarkSource: benchmark.benchmarkSource,
          benchmarkNotes: benchmark.benchmarkNotes,
          dosageAmount: benchmark.dosageAmount,
          dosageUnit: benchmark.dosageUnit,
          administrationRoute: benchmark.administrationRoute,
          triggerType: benchmark.triggerType,
          anchorEvent: benchmark.anchorEvent,
          offsetDays: benchmark.offsetDays,
          ageTriggerWeeks: benchmark.ageTriggerWeeks,
          durationDays: benchmark.durationDays,
          frequency: benchmark.frequency,
          reminderDaysBefore: benchmark.reminderDaysBefore,
        },
      });
      console.log(`Updated benchmark: ${benchmark.name}`);
    } else {
      // Create new
      await prisma.supplementProtocol.create({
        data: {
          tenantId: null, // System benchmark
          name: benchmark.name,
          description: benchmark.description,
          species: benchmark.species,
          isBenchmark: true,
          benchmarkSource: benchmark.benchmarkSource,
          benchmarkNotes: benchmark.benchmarkNotes,
          dosageAmount: benchmark.dosageAmount,
          dosageUnit: benchmark.dosageUnit,
          administrationRoute: benchmark.administrationRoute,
          triggerType: benchmark.triggerType,
          anchorEvent: benchmark.anchorEvent,
          offsetDays: benchmark.offsetDays,
          ageTriggerWeeks: benchmark.ageTriggerWeeks,
          durationDays: benchmark.durationDays,
          frequency: benchmark.frequency,
          reminderDaysBefore: benchmark.reminderDaysBefore,
        },
      });
      console.log(`Created benchmark: ${benchmark.name}`);
    }
  }

  const count = await prisma.supplementProtocol.count({
    where: { isBenchmark: true },
  });
  console.log(`\nDone. Total benchmark protocols: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
