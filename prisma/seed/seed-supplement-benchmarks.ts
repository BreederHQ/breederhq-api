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
    name: "Selenium/Vitamin E (Pre-Foaling)",
    description:
      "White muscle disease prevention for foals in selenium-deficient regions",
    species: [Species.HORSE],
    benchmarkSource: "AAEP Guidelines",
    benchmarkNotes:
      "Per veterinarian recommendation based on regional selenium levels. Typically 1ml per 200lbs IM.",
    dosageAmount: null,
    dosageUnit: null,
    administrationRoute: "intramuscular",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BIRTH_DATE,
    offsetDays: -30, // 30 days before expected foaling
    ageTriggerWeeks: null,
    durationDays: null,
    frequency: SupplementFrequency.ONCE,
    reminderDaysBefore: [7, 3, 1],
  },
  {
    name: "Rhinopneumonitis Vaccine (Month 5)",
    description: "EHV-1/4 vaccination to prevent abortion - first dose",
    species: [Species.HORSE],
    benchmarkSource: "AAEP Guidelines",
    benchmarkNotes:
      "2ml IM as directed by manufacturer. Follow up at months 7 and 9.",
    dosageAmount: "2ml",
    dosageUnit: "IM",
    administrationRoute: "intramuscular",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: 150, // Month 5 of gestation (~150 days)
    ageTriggerWeeks: null,
    durationDays: null,
    frequency: SupplementFrequency.ONCE,
    reminderDaysBefore: [7, 3, 1],
  },
  {
    name: "Rhinopneumonitis Vaccine (Month 7)",
    description: "EHV-1/4 vaccination to prevent abortion - second dose",
    species: [Species.HORSE],
    benchmarkSource: "AAEP Guidelines",
    benchmarkNotes: "2ml IM as directed by manufacturer",
    dosageAmount: "2ml",
    dosageUnit: "IM",
    administrationRoute: "intramuscular",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: 210, // Month 7 of gestation (~210 days)
    ageTriggerWeeks: null,
    durationDays: null,
    frequency: SupplementFrequency.ONCE,
    reminderDaysBefore: [7, 3, 1],
  },
  {
    name: "Rhinopneumonitis Vaccine (Month 9)",
    description: "EHV-1/4 vaccination to prevent abortion - third dose",
    species: [Species.HORSE],
    benchmarkSource: "AAEP Guidelines",
    benchmarkNotes: "2ml IM as directed by manufacturer",
    dosageAmount: "2ml",
    dosageUnit: "IM",
    administrationRoute: "intramuscular",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: 270, // Month 9 of gestation (~270 days)
    ageTriggerWeeks: null,
    durationDays: null,
    frequency: SupplementFrequency.ONCE,
    reminderDaysBefore: [7, 3, 1],
  },
  {
    name: "Folic Acid (Pregnancy) - Equine",
    description: "Folic acid for mares in pregnancy",
    species: [Species.HORSE],
    benchmarkSource: "AAEP Guidelines",
    benchmarkNotes: null,
    dosageAmount: "20-40mg",
    dosageUnit: "daily mixed with feed",
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: 30, // Start after pregnancy confirmed
    ageTriggerWeeks: null,
    durationDays: 300, // Through gestation
    frequency: SupplementFrequency.DAILY,
    reminderDaysBefore: [7, 3, 1],
  },
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

  // ─────────────────────────────────────────────────────────────────────────────
  // DOGS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Prenatal Folic Acid",
    description:
      "Folic acid supplementation to support fetal neural tube development and reduce birth defects",
    species: [Species.DOG],
    benchmarkSource: "Canine Reproduction Guidelines",
    benchmarkNotes:
      "400mcg daily, mixed with food. Adjust dosage based on dam weight.",
    dosageAmount: "400mcg",
    dosageUnit: "daily",
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: -14, // Start 14 days before breeding
    ageTriggerWeeks: null,
    durationDays: 77, // 14 days before + 63 days gestation
    frequency: SupplementFrequency.DAILY,
    reminderDaysBefore: [7, 3, 1],
  },
  {
    name: "Calcium Supplementation (Late Pregnancy)",
    description:
      "Calcium support for large litters in late pregnancy to prevent eclampsia",
    species: [Species.DOG],
    benchmarkSource: "Veterinary Practice",
    benchmarkNotes:
      "1000-2000mg daily based on dam weight. Do NOT supplement before day 42 of pregnancy.",
    dosageAmount: "1000-2000mg",
    dosageUnit: "daily based on dam weight",
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BIRTH_DATE,
    offsetDays: -21, // Start 3 weeks before expected birth
    ageTriggerWeeks: null,
    durationDays: 49, // 21 days before + 28 days nursing
    frequency: SupplementFrequency.DAILY,
    reminderDaysBefore: [7, 3, 1],
  },
  {
    name: "Puppy Iron Supplement",
    description:
      "Iron supplementation for newborn puppies to prevent iron deficiency anemia",
    species: [Species.DOG],
    benchmarkSource: "Veterinary Practice",
    benchmarkNotes:
      "50-100mg IM based on puppy weight. Single injection on day 3 of life.",
    dosageAmount: "50-100mg",
    dosageUnit: "IM based on puppy weight",
    administrationRoute: "intramuscular",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BIRTH_DATE,
    offsetDays: 3, // Day 3 of life
    ageTriggerWeeks: null,
    durationDays: null,
    frequency: SupplementFrequency.ONCE,
    reminderDaysBefore: [3, 1],
  },
  {
    name: "Prenatal Omega-3 (DHA/EPA)",
    description: "Omega-3 fatty acids for fetal brain and eye development",
    species: [Species.DOG],
    benchmarkSource: "Canine Reproduction Guidelines",
    benchmarkNotes:
      "1000-2000mg daily based on dam weight. Use purified fish oil.",
    dosageAmount: "1000-2000mg",
    dosageUnit: "daily based on dam weight",
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: -7, // Start 1 week before breeding
    ageTriggerWeeks: null,
    durationDays: 98, // 7 days before + 63 gestation + 28 nursing
    frequency: SupplementFrequency.DAILY,
    reminderDaysBefore: [7, 3, 1],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CATS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Prenatal Folic Acid (Feline)",
    description: "Folic acid for fetal development in queens",
    species: [Species.CAT],
    benchmarkSource: "Feline Reproduction Guidelines",
    benchmarkNotes: "200mcg daily, mixed with food",
    dosageAmount: "200mcg",
    dosageUnit: "daily",
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: -7, // Start 1 week before breeding
    ageTriggerWeeks: null,
    durationDays: 72, // 7 days before + 65 days gestation
    frequency: SupplementFrequency.DAILY,
    reminderDaysBefore: [7, 3, 1],
  },
  {
    name: "Taurine Supplementation",
    description: "Essential taurine for fetal heart and eye development",
    species: [Species.CAT],
    benchmarkSource: "Feline Reproduction Guidelines",
    benchmarkNotes: "250-500mg daily. Critical for feline reproduction.",
    dosageAmount: "250-500mg",
    dosageUnit: "daily",
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: -14, // Start 2 weeks before breeding
    ageTriggerWeeks: null,
    durationDays: 107, // 14 before + 65 gestation + 28 nursing
    frequency: SupplementFrequency.DAILY,
    reminderDaysBefore: [7, 3, 1],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GOATS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "BoSe Injection (Pre-Kidding)",
    description: "Selenium/Vitamin E for white muscle disease prevention",
    species: [Species.GOAT],
    benchmarkSource: "AASRP Guidelines",
    benchmarkNotes:
      "1ml per 40lbs body weight, given IM or SQ. Adjust for regional selenium status.",
    dosageAmount: "1ml per 40lbs",
    dosageUnit: "body weight",
    administrationRoute: "subcutaneous",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BIRTH_DATE,
    offsetDays: -30, // 30 days before expected birth
    ageTriggerWeeks: null,
    durationDays: null,
    frequency: SupplementFrequency.ONCE,
    reminderDaysBefore: [7, 3, 1],
  },
  {
    name: "CD&T Toxoid (Pre-Kidding)",
    description:
      "Clostridium perfringens/tetanus vaccination for passive immunity transfer",
    species: [Species.GOAT],
    benchmarkSource: "AASRP Guidelines",
    benchmarkNotes:
      "2ml SQ, given 4-6 weeks before kidding for colostral antibody transfer",
    dosageAmount: "2ml",
    dosageUnit: "SQ",
    administrationRoute: "subcutaneous",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BIRTH_DATE,
    offsetDays: -42, // 6 weeks before expected birth
    ageTriggerWeeks: null,
    durationDays: null,
    frequency: SupplementFrequency.ONCE,
    reminderDaysBefore: [7, 3, 1],
  },
  {
    name: "Copper Bolus (Goats Only)",
    description: "Copper supplementation for goats in copper-deficient regions",
    species: [Species.GOAT],
    benchmarkSource: "AASRP Guidelines",
    benchmarkNotes:
      "2g bolus for adults. WARNING: Do NOT administer copper bolus to sheep - copper is toxic to sheep!",
    dosageAmount: "2g",
    dosageUnit: "bolus for adults",
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: -30, // 30 days before breeding
    ageTriggerWeeks: null,
    durationDays: null,
    frequency: SupplementFrequency.ONCE,
    reminderDaysBefore: [7, 3, 1],
  },
  {
    name: "Kid BoSe (Newborn)",
    description: "Selenium/Vitamin E for newborn kids",
    species: [Species.GOAT],
    benchmarkSource: "AASRP Guidelines",
    benchmarkNotes: "0.25ml SQ within 24 hours of birth for selenium-deficient areas",
    dosageAmount: "0.25ml",
    dosageUnit: "SQ",
    administrationRoute: "subcutaneous",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BIRTH_DATE,
    offsetDays: 0, // Day of birth
    ageTriggerWeeks: null,
    durationDays: null,
    frequency: SupplementFrequency.ONCE,
    reminderDaysBefore: [3, 1],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SHEEP
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "BoSe Injection (Pre-Lambing)",
    description: "Selenium/Vitamin E for white muscle disease prevention",
    species: [Species.SHEEP],
    benchmarkSource: "AASRP Guidelines",
    benchmarkNotes:
      "1ml per 40lbs body weight, given IM or SQ. Adjust for regional selenium status.",
    dosageAmount: "1ml per 40lbs",
    dosageUnit: "body weight",
    administrationRoute: "subcutaneous",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BIRTH_DATE,
    offsetDays: -30, // 30 days before expected birth
    ageTriggerWeeks: null,
    durationDays: null,
    frequency: SupplementFrequency.ONCE,
    reminderDaysBefore: [7, 3, 1],
  },
  {
    name: "CD&T Toxoid (Pre-Lambing)",
    description:
      "Clostridium perfringens/tetanus vaccination for passive immunity transfer",
    species: [Species.SHEEP],
    benchmarkSource: "AASRP Guidelines",
    benchmarkNotes:
      "2ml SQ, given 4-6 weeks before lambing for colostral antibody transfer",
    dosageAmount: "2ml",
    dosageUnit: "SQ",
    administrationRoute: "subcutaneous",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BIRTH_DATE,
    offsetDays: -42, // 6 weeks before expected birth
    ageTriggerWeeks: null,
    durationDays: null,
    frequency: SupplementFrequency.ONCE,
    reminderDaysBefore: [7, 3, 1],
  },
  {
    name: "Lamb BoSe (Newborn)",
    description: "Selenium/Vitamin E for newborn lambs",
    species: [Species.SHEEP],
    benchmarkSource: "AASRP Guidelines",
    benchmarkNotes: "0.25ml SQ within 24 hours of birth for selenium-deficient areas",
    dosageAmount: "0.25ml",
    dosageUnit: "SQ",
    administrationRoute: "subcutaneous",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BIRTH_DATE,
    offsetDays: 0, // Day of birth
    ageTriggerWeeks: null,
    durationDays: null,
    frequency: SupplementFrequency.ONCE,
    reminderDaysBefore: [3, 1],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // RABBITS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Vitamin E (Pregnancy) - Rabbit",
    description: "Vitamin E supplementation for improved litter survival",
    species: [Species.RABBIT],
    benchmarkSource: "General Practice",
    benchmarkNotes: "50-100 IU daily in feed or water",
    dosageAmount: "50-100 IU",
    dosageUnit: "daily in feed or water",
    administrationRoute: "oral",
    triggerType: SupplementTriggerType.BREEDING_CYCLE_RELATIVE,
    anchorEvent: BreedingCycleAnchorEvent.BREED_DATE,
    offsetDays: 0, // Start at breeding
    ageTriggerWeeks: null,
    durationDays: 31, // Through gestation
    frequency: SupplementFrequency.DAILY,
    reminderDaysBefore: [7, 1],
  },

  // NOTE: PIG, CATTLE, ALPACA, LLAMA protocols omitted - Species enum only supports:
  // DOG, CAT, HORSE, GOAT, RABBIT, SHEEP
  // Add those species to Prisma schema to enable their protocols

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
