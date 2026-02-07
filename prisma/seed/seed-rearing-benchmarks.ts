// prisma/seed/seed-rearing-benchmarks.ts
// Seeds industry benchmark rearing protocols (system-level, tenantId = null)
import "./seed-env-bootstrap.js";
import { PrismaClient, Species, ActivityCategory, ActivityFrequency } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Types for seeding
// ─────────────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  key: string;
  label: string;
  description: string | null;
  category: string;
  order: number;
}

interface ActivitySeed {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  category: ActivityCategory;
  frequency: ActivityFrequency;
  durationMinutes: number | null;
  isRequired: boolean;
  requiresEquipment: string[];
  order: number;
  checklistItems: ChecklistItem[] | null;
}

interface StageSeed {
  id: string;
  name: string;
  description: string | null;
  ageStartDays: number;
  ageEndDays: number;
  order: number;
  activities: ActivitySeed[];
}

interface ProtocolSeed {
  name: string;
  description: string | null;
  species: Species;
  targetAgeStart: number;
  targetAgeEnd: number;
  estimatedDailyMinutes: number | null;
  stages: StageSeed[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ENS Protocol - Early Neurological Stimulation (Dogs)
// ─────────────────────────────────────────────────────────────────────────────

const ensProtocol: ProtocolSeed = {
  name: "Early Neurological Stimulation (ENS)",
  description:
    "Bio Sensor program based on U.S. Military research for neurological development in neonatal puppies. Each exercise should be performed ONCE per day only during Day 3-16.",
  species: Species.DOG,
  targetAgeStart: 3,
  targetAgeEnd: 16,
  estimatedDailyMinutes: 5,
  stages: [
    {
      id: "stage-ens-001",
      name: "Early Neurological Stimulation",
      description:
        "Bio Sensor exercises based on U.S. Military research. Each exercise should be performed ONCE per day only during Day 3-16. Overdoing these exercises can be counterproductive.",
      ageStartDays: 3,
      ageEndDays: 16,
      order: 1,
      activities: [
        {
          id: "act-ens-tactile-001",
          name: "Tactile Stimulation",
          description: "Stimulate between toes using a Q-tip",
          instructions:
            "Using a Q-tip, gently stimulate between the toes on all four paws. Hold for 3-5 seconds per paw.",
          category: ActivityCategory.ENS,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 1,
          isRequired: true,
          requiresEquipment: ["Cotton swab", "Q-tip"],
          order: 1,
          checklistItems: null,
        },
        {
          id: "act-ens-head-erect-001",
          name: "Head Held Erect",
          description: "Hold puppy perpendicular to ground with head up",
          instructions:
            "Hold the puppy perpendicular to the ground with head directly up. Hold for 3-5 seconds.",
          category: ActivityCategory.ENS,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 1,
          isRequired: true,
          requiresEquipment: [],
          order: 2,
          checklistItems: null,
        },
        {
          id: "act-ens-head-down-001",
          name: "Head Pointed Down",
          description: "Hold puppy with head pointing directly down",
          instructions:
            "Hold the puppy with head pointing directly down toward the ground. Hold for 3-5 seconds.",
          category: ActivityCategory.ENS,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 1,
          isRequired: true,
          requiresEquipment: [],
          order: 3,
          checklistItems: null,
        },
        {
          id: "act-ens-supine-001",
          name: "Supine Position",
          description: "Place puppy on back with muzzle pointing at ceiling",
          instructions:
            "Place puppy on its back with muzzle pointing at the ceiling. Support gently. Hold for 3-5 seconds.",
          category: ActivityCategory.ENS,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 1,
          isRequired: true,
          requiresEquipment: [],
          order: 4,
          checklistItems: null,
        },
        {
          id: "act-ens-thermal-001",
          name: "Thermal Stimulation",
          description: "Place puppy's paws on cool, damp cloth",
          instructions:
            "Place puppy's paws on a cool, damp cloth (refrigerated towel works well). Hold for 3-5 seconds.",
          category: ActivityCategory.ENS,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 1,
          isRequired: true,
          requiresEquipment: ["Cool damp cloth", "Refrigerated towel"],
          order: 5,
          checklistItems: null,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ESI Protocol - Early Scent Introduction (Dogs)
// ─────────────────────────────────────────────────────────────────────────────

const esiScentChecklist: ChecklistItem[] = [
  { key: "scent_grass", label: "Grass clippings", description: null, category: "Environmental", order: 1 },
  { key: "scent_dirt", label: "Dirt/Earth", description: null, category: "Environmental", order: 2 },
  { key: "scent_leaves", label: "Leaves", description: null, category: "Environmental", order: 3 },
  { key: "scent_pine", label: "Pine", description: null, category: "Environmental", order: 4 },
  { key: "scent_feathers", label: "Feathers (bird)", description: null, category: "Animal", order: 5 },
  { key: "scent_rabbit_fur", label: "Rabbit fur", description: null, category: "Animal", order: 6 },
  { key: "scent_coffee", label: "Coffee grounds", description: null, category: "Household", order: 7 },
  { key: "scent_citrus", label: "Citrus (orange peel)", description: null, category: "Household", order: 8 },
  { key: "scent_leather", label: "Leather", description: null, category: "Household", order: 9 },
  { key: "scent_lavender", label: "Lavender", description: null, category: "Aromatic", order: 10 },
  { key: "scent_mint", label: "Mint", description: null, category: "Aromatic", order: 11 },
];

const esiProtocol: ProtocolSeed = {
  name: "Early Scent Introduction (ESI)",
  description:
    "Daily exposure to novel scents during the neonatal period to develop olfactory capabilities and confidence. Present each scent for 3-5 seconds.",
  species: Species.DOG,
  targetAgeStart: 3,
  targetAgeEnd: 16,
  estimatedDailyMinutes: 2,
  stages: [
    {
      id: "stage-esi-001",
      name: "Early Scent Introduction",
      description:
        "Daily exposure to novel scents during the neonatal period to develop olfactory capabilities and confidence.",
      ageStartDays: 3,
      ageEndDays: 16,
      order: 1,
      activities: [
        {
          id: "act-esi-scent-001",
          name: "Novel Scent Exposure",
          description: "Present a novel scent near the puppy's nose daily",
          instructions:
            "Present a novel scent near the puppy's nose for 3-5 seconds. Observe and record the reaction: Approach, Neutral, or Avoidance. Use a different scent each day.",
          category: ActivityCategory.ESI,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 1,
          isRequired: true,
          requiresEquipment: ["Scent samples"],
          order: 1,
          checklistItems: null,
        },
        {
          id: "act-esi-checklist-001",
          name: "Scent Exposure Checklist",
          description: "Track all scents introduced during the ESI period",
          instructions:
            "Work through this checklist of recommended scents during the Day 3-16 window. A neutral reaction is the goal - you are training tolerance, not attraction.",
          category: ActivityCategory.ESI,
          frequency: ActivityFrequency.CHECKLIST,
          durationMinutes: null,
          isRequired: false,
          requiresEquipment: [],
          order: 2,
          checklistItems: esiScentChecklist,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Rule of 7s Protocol - Socialization (Dogs)
// ─────────────────────────────────────────────────────────────────────────────

const surfacesChecklist: ChecklistItem[] = [
  { key: "surfaces_carpet", label: "Carpet", description: null, category: "surfaces", order: 1 },
  { key: "surfaces_concrete", label: "Concrete", description: null, category: "surfaces", order: 2 },
  { key: "surfaces_wood", label: "Wood/Hardwood", description: null, category: "surfaces", order: 3 },
  { key: "surfaces_grass", label: "Grass (wet and dry)", description: null, category: "surfaces", order: 4 },
  { key: "surfaces_dirt", label: "Dirt/Mud", description: null, category: "surfaces", order: 5 },
  { key: "surfaces_gravel", label: "Gravel/Rocks", description: null, category: "surfaces", order: 6 },
  { key: "surfaces_metal", label: "Metal (grate, cookie sheet)", description: null, category: "surfaces", order: 7 },
];

const peopleChecklist: ChecklistItem[] = [
  { key: "people_children", label: "Children", description: null, category: "people", order: 1 },
  { key: "people_elderly", label: "Elderly Person", description: null, category: "people", order: 2 },
  { key: "people_beard", label: "Person with Beard", description: null, category: "people", order: 3 },
  { key: "people_hat", label: "Person with Hat", description: null, category: "people", order: 4 },
  { key: "people_glasses", label: "Person with Glasses", description: null, category: "people", order: 5 },
  { key: "people_uniform", label: "Person in Uniform", description: null, category: "people", order: 6 },
  { key: "people_wheelchair", label: "Person with Wheelchair/Cane", description: null, category: "people", order: 7 },
];

const soundsChecklist: ChecklistItem[] = [
  { key: "sounds_vacuum", label: "Vacuum Cleaner", description: null, category: "sounds", order: 1 },
  { key: "sounds_doorbell", label: "Doorbell", description: null, category: "sounds", order: 2 },
  { key: "sounds_thunder", label: "Thunder Recording", description: null, category: "sounds", order: 3 },
  { key: "sounds_fireworks", label: "Fireworks Recording", description: null, category: "sounds", order: 4 },
  { key: "sounds_baby_crying", label: "Baby Crying", description: null, category: "sounds", order: 5 },
  { key: "sounds_dogs_barking", label: "Dogs Barking", description: null, category: "sounds", order: 6 },
  { key: "sounds_hair_dryer", label: "Hair Dryer", description: null, category: "sounds", order: 7 },
];

const ruleOf7sProtocol: ProtocolSeed = {
  name: "Rule of 7s Socialization",
  description:
    "By 7 weeks of age, puppies should have been exposed to 7 different surfaces, 7 different locations, 7 different people types, and more. This checklist-based protocol ensures comprehensive socialization.",
  species: Species.DOG,
  targetAgeStart: 21,
  targetAgeEnd: 49,
  estimatedDailyMinutes: 15,
  stages: [
    {
      id: "stage-7s-001",
      name: "Rule of 7s Socialization",
      description:
        "Comprehensive socialization checklist ensuring puppies experience a variety of surfaces, people, sounds, and environments.",
      ageStartDays: 21,
      ageEndDays: 49,
      order: 1,
      activities: [
        {
          id: "act-7s-surfaces-001",
          name: "7 Different Surfaces",
          description: "Expose puppy to at least 7 different surfaces",
          instructions:
            "Introduce puppy to various walking surfaces. Allow them to explore at their own pace. Pair new surfaces with treats and praise.",
          category: ActivityCategory.SOCIALIZATION,
          frequency: ActivityFrequency.CHECKLIST,
          durationMinutes: null,
          isRequired: true,
          requiresEquipment: [],
          order: 1,
          checklistItems: surfacesChecklist,
        },
        {
          id: "act-7s-people-001",
          name: "7 Different People Types",
          description: "Meet at least 7 different types of people",
          instructions:
            "Ensure puppy meets a variety of people. All interactions should be positive. Never force interaction - let the puppy approach.",
          category: ActivityCategory.SOCIALIZATION,
          frequency: ActivityFrequency.CHECKLIST,
          durationMinutes: null,
          isRequired: true,
          requiresEquipment: [],
          order: 2,
          checklistItems: peopleChecklist,
        },
        {
          id: "act-7s-sounds-001",
          name: "7 Different Sounds",
          description: "Expose to at least 7 different sounds",
          instructions:
            "Play sounds at low volume initially, gradually increasing. Pair sound exposure with treats. Stop if puppy shows fear.",
          category: ActivityCategory.SOCIALIZATION,
          frequency: ActivityFrequency.CHECKLIST,
          durationMinutes: null,
          isRequired: true,
          requiresEquipment: ["Sound recordings", "Speaker"],
          order: 3,
          checklistItems: soundsChecklist,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Cat Socialization Protocol
// ─────────────────────────────────────────────────────────────────────────────

const catSocializationProtocol: ProtocolSeed = {
  name: "Kitten Socialization Essentials",
  description:
    "Critical socialization window for kittens (weeks 2-7). Focuses on gentle handling, human interaction, and environmental exposure.",
  species: Species.CAT,
  targetAgeStart: 14,
  targetAgeEnd: 49,
  estimatedDailyMinutes: 15,
  stages: [
    {
      id: "stage-cat-soc-001",
      name: "Kitten Socialization",
      description:
        "During the critical socialization window, kittens should receive daily handling and exposure to various stimuli.",
      ageStartDays: 14,
      ageEndDays: 49,
      order: 1,
      activities: [
        {
          id: "act-cat-handling-001",
          name: "Gentle Handling Session",
          description: "Daily handling to build comfort with human touch",
          instructions:
            "Handle kittens gently for 5-10 minutes. Touch ears, paws, mouth, and tail. Keep sessions positive - stop if kitten shows stress.",
          category: ActivityCategory.HANDLING,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 10,
          isRequired: true,
          requiresEquipment: [],
          order: 1,
          checklistItems: null,
        },
        {
          id: "act-cat-socialization-001",
          name: "Human Interaction Variety",
          description: "Expose kittens to different people",
          instructions:
            "Have kittens meet different people - men, women, children (supervised). Encourage gentle petting and play. All interactions should be positive.",
          category: ActivityCategory.SOCIALIZATION,
          frequency: ActivityFrequency.WEEKLY,
          durationMinutes: 15,
          isRequired: true,
          requiresEquipment: [],
          order: 2,
          checklistItems: null,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Horse Imprint Training Protocol
// ─────────────────────────────────────────────────────────────────────────────

const horseImprintProtocol: ProtocolSeed = {
  name: "Foal Imprint Training",
  description:
    "First 48 hours imprint training protocol for newborn foals. Establishes trust and acceptance of human handling from birth.",
  species: Species.HORSE,
  targetAgeStart: 0,
  targetAgeEnd: 7,
  estimatedDailyMinutes: 20,
  stages: [
    {
      id: "stage-horse-imprint-001",
      name: "Imprint Training",
      description:
        "During the first hours and days after birth, foals are most receptive to imprinting. Handle all body parts systematically.",
      ageStartDays: 0,
      ageEndDays: 7,
      order: 1,
      activities: [
        {
          id: "act-horse-imprint-001",
          name: "Imprint Handling Session",
          description: "Systematic desensitization to touch and handling",
          instructions:
            "Within first 2 hours after birth and during the first week:\n- Touch and rub all body parts including ears, mouth, legs, hooves\n- Flex legs, pick up feet\n- Insert fingers in ears and mouth (gently)\n- Apply light pressure on girth and saddle areas\n- Work with foal while mare is present for security\n- Keep sessions short (10-15 min) and always end positively",
          category: ActivityCategory.HANDLING,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 15,
          isRequired: true,
          requiresEquipment: [],
          order: 1,
          checklistItems: null,
        },
        {
          id: "act-horse-daily-001",
          name: "Daily Halter Conditioning",
          description: "Get foal comfortable with halter presence",
          instructions:
            "By day 2-3, begin introducing halter:\n- Let foal sniff halter\n- Rub halter over face and neck\n- Eventually slip on loosely for brief periods\n- Never leave halter on unsupervised",
          category: ActivityCategory.TRAINING,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 5,
          isRequired: true,
          requiresEquipment: ["Foal halter"],
          order: 2,
          checklistItems: null,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Goat Handling Protocol
// ─────────────────────────────────────────────────────────────────────────────

const goatHandlingProtocol: ProtocolSeed = {
  name: "Kid Handling & Taming",
  description:
    "Essential handling protocol for goat kids to ensure they are comfortable with human interaction and basic husbandry procedures.",
  species: Species.GOAT,
  targetAgeStart: 0,
  targetAgeEnd: 56,
  estimatedDailyMinutes: 10,
  stages: [
    {
      id: "stage-goat-handling-001",
      name: "Kid Handling",
      description: "Daily handling to build comfort with human touch and husbandry procedures.",
      ageStartDays: 0,
      ageEndDays: 56,
      order: 1,
      activities: [
        {
          id: "act-goat-handling-001",
          name: "Daily Handling Session",
          description: "Handle kids daily to build trust",
          instructions:
            "Pick up and hold kids daily:\n- Support hindquarters and chest\n- Touch ears, legs, hooves, tail, and mouth\n- Practice holding in hoof trimming position\n- Keep sessions positive with treats\n- Gradually increase handling duration",
          category: ActivityCategory.HANDLING,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 10,
          isRequired: true,
          requiresEquipment: [],
          order: 1,
          checklistItems: null,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// All Benchmark Protocols
// ─────────────────────────────────────────────────────────────────────────────

const BENCHMARK_PROTOCOLS: ProtocolSeed[] = [
  // Dogs
  ensProtocol,
  esiProtocol,
  ruleOf7sProtocol,
  // Cats
  catSocializationProtocol,
  // Horses
  horseImprintProtocol,
  // Goats
  goatHandlingProtocol,
];

// ─────────────────────────────────────────────────────────────────────────────
// Seeding Function
// ─────────────────────────────────────────────────────────────────────────────

async function seedRearingBenchmarks() {
  console.log("🌱 Seeding rearing benchmark protocols...\n");

  for (const protocolData of BENCHMARK_PROTOCOLS) {
    // Check if protocol already exists
    const existing = await prisma.rearingProtocol.findFirst({
      where: {
        name: protocolData.name,
        isBenchmark: true,
        tenantId: null,
      },
    });

    if (existing) {
      console.log(`  ⏭️  Skipping: ${protocolData.name} (already exists)`);
      continue;
    }

    // Calculate total activities for the protocol
    const totalActivities = protocolData.stages.reduce(
      (sum, stage) => sum + stage.activities.length,
      0
    );

    // Create protocol with nested stages and activities
    const protocol = await prisma.rearingProtocol.create({
      data: {
        tenantId: null, // System benchmark
        isBenchmark: true,
        isPublic: true,
        isActive: true,
        name: protocolData.name,
        description: protocolData.description,
        species: protocolData.species,
        targetAgeStart: protocolData.targetAgeStart,
        targetAgeEnd: protocolData.targetAgeEnd,
        estimatedDailyMinutes: protocolData.estimatedDailyMinutes,
        stages: {
          create: protocolData.stages.map((stage) => ({
            id: stage.id || randomUUID(),
            name: stage.name,
            description: stage.description,
            ageStartDays: stage.ageStartDays,
            ageEndDays: stage.ageEndDays,
            order: stage.order,
            activities: {
              create: stage.activities.map((activity) => ({
                id: activity.id || randomUUID(),
                name: activity.name,
                description: activity.description,
                instructions: activity.instructions,
                category: activity.category,
                frequency: activity.frequency,
                durationMinutes: activity.durationMinutes,
                isRequired: activity.isRequired,
                requiresEquipment: activity.requiresEquipment,
                order: activity.order,
                checklistItems: activity.checklistItems
                  ? JSON.parse(JSON.stringify(activity.checklistItems))
                  : null,
              })),
            },
          })),
        },
      },
    });

    console.log(`  ✅ Created: ${protocol.name} (${totalActivities} activities)`);
  }

  console.log("\n✅ Rearing benchmark protocols seeding complete!");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

seedRearingBenchmarks()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("❌ Error seeding rearing benchmarks:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
