// prisma/seed/seed-rearing-benchmarks.ts
// Seeds ALL 14 industry benchmark rearing protocols (system-level, tenantId = null)
//
// IMPORTANT: Protocol names here MUST exactly match:
//   - Frontend config: apps/offspring/src/features/rearing-protocols/rearing-protocols.config.ts
//   - Backend mapping: src/routes/rearing-assignments.ts → BENCHMARK_STRING_ID_TO_NAME
//
// If you change a name here, you MUST update both of those files too.
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
  isPublic?: boolean;
  targetAgeStart: number;
  targetAgeEnd: number;
  estimatedDailyMinutes: number | null;
  stages: StageSeed[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Old name → new name renames (for databases seeded with previous versions)
// ─────────────────────────────────────────────────────────────────────────────

const NAME_RENAMES: [string, string][] = [
  // Seed script v1 names → canonical names
  ["Kitten Socialization Essentials", "Kitten Socialization"],
  ["Kid Handling & Taming", "Kid/Lamb Handling"],
  // Backend mapping v1 names (in case someone manually seeded with these)
  ["Kitten Socialization Program", "Kitten Socialization"],
  ["Foal Imprinting Protocol", "Foal Imprint Training"],
  ["Kid Handling Protocol", "Kid/Lamb Handling"],
  ["Handling Protocol", "Handling Habituation"],
  ["Crate Training Introduction", "Crate Introduction"],
  ["Litter Training Basics", "Litter Training"],
  ["Halter Training Basics", "Early Halter Training"],
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. ENS Protocol - Early Neurological Stimulation (Dogs, Day 3-16)
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
// 2. ESI Protocol - Early Scent Introduction (Dogs, Day 3-16)
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
// 3. Rule of 7s Protocol - Socialization (Dogs, Week 3-7)
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
// 4. Handling Habituation Protocol (Dogs, Week 1-8)
// ─────────────────────────────────────────────────────────────────────────────

const bodyPartHandlingChecklist: ChecklistItem[] = [
  { key: "handling_ears_look", label: "Ears examined (look inside)", description: null, category: "Body Parts", order: 1 },
  { key: "handling_ears_touch", label: "Ears touched gently", description: null, category: "Body Parts", order: 2 },
  { key: "handling_eyes", label: "Eyes examined (gentle, check corners)", description: null, category: "Body Parts", order: 3 },
  { key: "handling_mouth", label: "Mouth opened (touch gums, teeth)", description: null, category: "Body Parts", order: 4 },
  { key: "handling_paws_spread", label: "Paws handled (spread toes)", description: null, category: "Body Parts", order: 5 },
  { key: "handling_paws_nails", label: "Paws handled (touch nails)", description: null, category: "Body Parts", order: 6 },
  { key: "handling_tail", label: "Tail touched", description: null, category: "Body Parts", order: 7 },
  { key: "handling_belly", label: "Belly rubbed", description: null, category: "Body Parts", order: 8 },
  { key: "handling_chin", label: "Under chin scratched", description: null, category: "Body Parts", order: 9 },
];

const restraintChecklist: ChecklistItem[] = [
  { key: "restraint_body_hold", label: "Gentle body restraint (3-5 sec)", description: null, category: "Restraint", order: 1 },
  { key: "restraint_exam", label: "Hold still for 'exam'", description: null, category: "Restraint", order: 2 },
  { key: "restraint_towel", label: "Towel wrap (brief)", description: null, category: "Restraint", order: 3 },
];

const groomingToolsChecklist: ChecklistItem[] = [
  { key: "grooming_brush", label: "Brush introduction", description: null, category: "Grooming Tools", order: 1 },
  { key: "grooming_clipper_touch", label: "Nail clipper touch", description: null, category: "Grooming Tools", order: 2 },
  { key: "grooming_ear_tool", label: "Ear cleaning tool exposure", description: null, category: "Grooming Tools", order: 3 },
];

const handlingProtocol: ProtocolSeed = {
  name: "Handling Habituation",
  description:
    "Systematic body handling and grooming tool introduction. Daily brief sessions prepare puppies for veterinary care and grooming throughout their lives.",
  species: Species.DOG,
  targetAgeStart: 7,
  targetAgeEnd: 56,
  estimatedDailyMinutes: 7,
  stages: [
    {
      id: "stage-handling-001",
      name: "Handling Habituation",
      description:
        "Systematic body handling and grooming tool introduction to prepare puppies for lifetime of veterinary care and grooming. Daily brief sessions build confidence and trust.",
      ageStartDays: 7,
      ageEndDays: 56,
      order: 1,
      activities: [
        {
          id: "act-handling-body-001",
          name: "Body Part Handling",
          description: "Systematic handling of all body parts to prepare for vet exams and grooming",
          instructions:
            "Handle each body part gently for 3-5 seconds. Pair with treats and positive reinforcement. Keep sessions short (2-3 minutes) and positive. End before puppy shows stress.",
          category: ActivityCategory.HANDLING,
          frequency: ActivityFrequency.CHECKLIST,
          durationMinutes: 3,
          isRequired: true,
          requiresEquipment: [],
          order: 1,
          checklistItems: bodyPartHandlingChecklist,
        },
        {
          id: "act-handling-restraint-001",
          name: "Restraint Exercises",
          description: "Brief, gentle restraint to prepare for vet handling",
          instructions:
            "Practice gentle restraint with immediate release and reward. Never force. Build duration gradually from 3 seconds to 10 seconds over weeks.",
          category: ActivityCategory.HANDLING,
          frequency: ActivityFrequency.CHECKLIST,
          durationMinutes: 2,
          isRequired: true,
          requiresEquipment: ["Towel"],
          order: 2,
          checklistItems: restraintChecklist,
        },
        {
          id: "act-handling-grooming-001",
          name: "Grooming Tool Introduction",
          description: "Familiarization with grooming tools before actual use",
          instructions:
            "Show tool, let puppy sniff, touch puppy briefly with tool, treat. Start with tools off (no buzzing). Build positive association before any actual grooming.",
          category: ActivityCategory.HANDLING,
          frequency: ActivityFrequency.CHECKLIST,
          durationMinutes: 2,
          isRequired: true,
          requiresEquipment: ["Brush", "Nail clippers", "Ear cleaning supplies"],
          order: 3,
          checklistItems: groomingToolsChecklist,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Sound Desensitization Protocol (Dogs, Week 3-12)
// ─────────────────────────────────────────────────────────────────────────────

const soundCategoriesChecklist: ChecklistItem[] = [
  { key: "sound_household_vacuum", label: "Vacuum cleaner", description: null, category: "Household", order: 1 },
  { key: "sound_household_doorbell", label: "Doorbell", description: null, category: "Household", order: 2 },
  { key: "sound_household_appliances", label: "Appliances (blender, mixer)", description: null, category: "Household", order: 3 },
  { key: "sound_weather_thunder", label: "Thunder", description: null, category: "Weather", order: 4 },
  { key: "sound_weather_rain", label: "Heavy rain", description: null, category: "Weather", order: 5 },
  { key: "sound_celebration_fireworks", label: "Fireworks", description: null, category: "Celebrations", order: 6 },
  { key: "sound_celebration_party", label: "Party sounds", description: null, category: "Celebrations", order: 7 },
  { key: "sound_urban_traffic", label: "Traffic", description: null, category: "Urban", order: 8 },
  { key: "sound_urban_sirens", label: "Sirens", description: null, category: "Urban", order: 9 },
  { key: "sound_urban_construction", label: "Construction", description: null, category: "Urban", order: 10 },
  { key: "sound_animals_dogs", label: "Dogs barking", description: null, category: "Animals", order: 11 },
  { key: "sound_animals_cats", label: "Cats meowing/hissing", description: null, category: "Animals", order: 12 },
  { key: "sound_human_babies", label: "Babies crying", description: null, category: "Human", order: 13 },
  { key: "sound_human_children", label: "Children playing", description: null, category: "Human", order: 14 },
  { key: "sound_human_crowds", label: "Crowd noise", description: null, category: "Human", order: 15 },
];

const soundProtocol: ProtocolSeed = {
  name: "Sound Desensitization",
  description:
    "Progressive exposure to household and environmental sounds. Gradual volume increase from 20% to 80% paired with meals creates positive associations and prevents noise phobias.",
  species: Species.DOG,
  targetAgeStart: 21,
  targetAgeEnd: 84,
  estimatedDailyMinutes: 10,
  stages: [
    {
      id: "stage-sound-001",
      name: "Volume Level 20%",
      description: "Week 3-4: Play sounds at 20% volume during feeding. Associate sounds with positive experiences.",
      ageStartDays: 21,
      ageEndDays: 28,
      order: 1,
      activities: [
        {
          id: "act-sound-20-001",
          name: "Sound Exposure at 20% Volume",
          description: "Play sounds at very low volume during meals",
          instructions:
            "During feeding, play sound recordings at 20% volume. Rotate through categories (Household, Weather, Celebrations, Urban, Animals, Human). Watch for signs of stress. If puppy shows concern, lower volume or stop. Goal is neutral reaction.",
          category: ActivityCategory.SOCIALIZATION,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 10,
          isRequired: true,
          requiresEquipment: ["Sound recordings or app", "Speaker"],
          order: 1,
          checklistItems: soundCategoriesChecklist,
        },
      ],
    },
    {
      id: "stage-sound-002",
      name: "Volume Level 40%",
      description: "Week 5-6: Increase to 40% volume during feeding. Continue positive association.",
      ageStartDays: 35,
      ageEndDays: 42,
      order: 2,
      activities: [
        {
          id: "act-sound-40-001",
          name: "Sound Exposure at 40% Volume",
          description: "Play sounds at moderate-low volume during meals",
          instructions:
            "During feeding, play sound recordings at 40% volume. Continue rotating through all categories. Pair with high-value treats if needed. Monitor for any stress responses.",
          category: ActivityCategory.SOCIALIZATION,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 10,
          isRequired: true,
          requiresEquipment: ["Sound recordings or app", "Speaker"],
          order: 1,
          checklistItems: null,
        },
      ],
    },
    {
      id: "stage-sound-003",
      name: "Volume Level 60%",
      description: "Week 7-8: Increase to 60% volume during feeding. Build confidence with louder sounds.",
      ageStartDays: 49,
      ageEndDays: 56,
      order: 3,
      activities: [
        {
          id: "act-sound-60-001",
          name: "Sound Exposure at 60% Volume",
          description: "Play sounds at moderate volume during meals",
          instructions:
            "During feeding, play sound recordings at 60% volume. Include sudden sounds (doorbell, thunder bursts). Always ensure puppy can retreat if stressed. End session if prolonged stress.",
          category: ActivityCategory.SOCIALIZATION,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 10,
          isRequired: true,
          requiresEquipment: ["Sound recordings or app", "Speaker"],
          order: 1,
          checklistItems: null,
        },
      ],
    },
    {
      id: "stage-sound-004",
      name: "Volume Level 80%",
      description: "Week 9-12: Full volume exposure during play and feeding. Solidify sound confidence.",
      ageStartDays: 63,
      ageEndDays: 84,
      order: 4,
      activities: [
        {
          id: "act-sound-80-001",
          name: "Sound Exposure at 80% Volume",
          description: "Play sounds at near-full volume during meals and play",
          instructions:
            "During feeding and play, play sound recordings at 80% volume. Include varied sequences and sudden sounds. By now, puppy should show neutral or curious response. Continue through week 12.",
          category: ActivityCategory.SOCIALIZATION,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 15,
          isRequired: true,
          requiresEquipment: ["Sound recordings or app", "Speaker"],
          order: 1,
          checklistItems: null,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Crate Introduction Protocol (Dogs, Week 5-8)
// ─────────────────────────────────────────────────────────────────────────────

const crateActivitiesChecklist: ChecklistItem[] = [
  { key: "crate_explore", label: "Crate exploration (door open)", description: null, category: "Exploration", order: 1 },
  { key: "crate_treats_inside", label: "Treats scattered inside", description: null, category: "Exploration", order: 2 },
  { key: "crate_voluntary_entry", label: "Voluntary entry achieved", description: null, category: "Exploration", order: 3 },
  { key: "crate_meal_door_open", label: "Meal in crate (door open)", description: null, category: "Meals", order: 4 },
  { key: "crate_meal_door_closed", label: "Meal in crate (door closed)", description: null, category: "Meals", order: 5 },
  { key: "crate_treat_delivery", label: "Random treat 'magically appears'", description: null, category: "Treat Delivery", order: 6 },
  { key: "crate_kong_time", label: "Frozen Kong in crate", description: null, category: "Kong Time", order: 7 },
  { key: "crate_brief_close", label: "Brief door closure (seconds)", description: null, category: "Door Closure", order: 8 },
  { key: "crate_1min_alone", label: "1 minute alone time", description: null, category: "Quiet Time", order: 9 },
  { key: "crate_5min_alone", label: "5 minutes alone time", description: null, category: "Quiet Time", order: 10 },
];

const crateProtocol: ProtocolSeed = {
  name: "Crate Introduction",
  description:
    "Positive crate training foundation. Progressive approach from voluntary exploration to comfortable alone time. Sets foundation for safe confinement and travel.",
  species: Species.DOG,
  targetAgeStart: 35,
  targetAgeEnd: 56,
  estimatedDailyMinutes: 30,
  stages: [
    {
      id: "stage-crate-001",
      name: "Crate Introduction",
      description:
        "Positive crate training foundation. Progression from voluntary exploration to brief alone time. Multiple short sessions daily build confidence.",
      ageStartDays: 35,
      ageEndDays: 56,
      order: 1,
      activities: [
        {
          id: "act-crate-explore-001",
          name: "Crate Exploration",
          description: "Week 5: Door open, treats inside, voluntary exploration",
          instructions:
            "Place crate in living area with door secured open. Scatter treats inside. Let puppy discover treats and explore at their own pace. Never force puppy into crate. Praise calm exploration.",
          category: ActivityCategory.TRANSITION,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 5,
          isRequired: true,
          requiresEquipment: ["Appropriately sized crate", "Treats"],
          order: 1,
          checklistItems: null,
        },
        {
          id: "act-crate-brief-001",
          name: "Brief Door Closure",
          description: "Week 6: Practice brief door closures with immediate release",
          instructions:
            "Once puppy enters willingly, gently close door for 2-3 seconds, then immediately open and treat. Gradually increase duration. If puppy shows distress, reduce duration. Build up slowly.",
          category: ActivityCategory.TRANSITION,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 5,
          isRequired: true,
          requiresEquipment: ["Crate", "Treats"],
          order: 2,
          checklistItems: null,
        },
        {
          id: "act-crate-meals-001",
          name: "Meals in Crate",
          description: "Week 6-7: Feed meals inside crate",
          instructions:
            "Start feeding all meals inside the crate. Begin with door open, then progress to door closed while eating. Puppy learns crate = good things happen. Release after eating.",
          category: ActivityCategory.TRANSITION,
          frequency: ActivityFrequency.TWICE_DAILY,
          durationMinutes: 10,
          isRequired: true,
          requiresEquipment: ["Crate", "Food bowl"],
          order: 3,
          checklistItems: null,
        },
        {
          id: "act-crate-treat-001",
          name: "Treat Delivery",
          description: "Random treats appearing in crate throughout day",
          instructions:
            "Periodically drop treats into crate when puppy isn't looking. Puppy learns to check crate for 'surprise treats'. Builds positive association independent of meals.",
          category: ActivityCategory.TRANSITION,
          frequency: ActivityFrequency.AS_AVAILABLE,
          durationMinutes: null,
          isRequired: false,
          requiresEquipment: ["Crate", "Treats"],
          order: 4,
          checklistItems: null,
        },
        {
          id: "act-crate-kong-001",
          name: "Kong Time",
          description: "Frozen Kong or long-lasting chew in crate",
          instructions:
            "Provide a frozen Kong or safe chew in crate. Door can be open or closed. Extends positive crate time. Great for building longer duration comfort.",
          category: ActivityCategory.TRANSITION,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 15,
          isRequired: true,
          requiresEquipment: ["Crate", "Kong", "Kong stuffing (peanut butter, treats)"],
          order: 5,
          checklistItems: null,
        },
        {
          id: "act-crate-quiet-001",
          name: "Quiet Time",
          description: "Week 7-8: Brief alone time in crate (1-5 min), gradual increase",
          instructions:
            "Practice leaving puppy alone in crate for short periods. Start with 1 minute, build to 5 minutes. Leave calmly, return before puppy shows distress. Build independence gradually.",
          category: ActivityCategory.TRANSITION,
          frequency: ActivityFrequency.CHECKLIST,
          durationMinutes: 5,
          isRequired: true,
          requiresEquipment: ["Crate"],
          order: 6,
          checklistItems: crateActivitiesChecklist,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. Kitten Socialization Protocol (Cats, Week 2-7)
// ─────────────────────────────────────────────────────────────────────────────

const catHandlingChecklist: ChecklistItem[] = [
  { key: "cat_handling_pickup", label: "Picking up and holding", description: null, category: "Handling", order: 1 },
  { key: "cat_handling_ears", label: "Touch ears", description: null, category: "Handling", order: 2 },
  { key: "cat_handling_paws", label: "Touch paws", description: null, category: "Handling", order: 3 },
  { key: "cat_handling_mouth", label: "Touch mouth", description: null, category: "Handling", order: 4 },
  { key: "cat_handling_tail", label: "Touch tail", description: null, category: "Handling", order: 5 },
  { key: "cat_handling_restraint", label: "Brief restraint", description: null, category: "Handling", order: 6 },
  { key: "cat_handling_nails", label: "Nail handling", description: null, category: "Handling", order: 7 },
];

const catExposureChecklist: ChecklistItem[] = [
  { key: "cat_exposure_multiple_people", label: "Multiple people (ages, appearances)", description: null, category: "People", order: 1 },
  { key: "cat_exposure_children", label: "Children (supervised)", description: null, category: "People", order: 2 },
  { key: "cat_exposure_gentle_dog", label: "Gentle dog (supervised)", description: null, category: "Animals", order: 3 },
  { key: "cat_exposure_household_sounds", label: "Household sounds", description: null, category: "Sounds", order: 4 },
  { key: "cat_exposure_vacuum", label: "Vacuum cleaner", description: null, category: "Sounds", order: 5 },
  { key: "cat_exposure_doorbell", label: "Doorbell", description: null, category: "Sounds", order: 6 },
  { key: "cat_exposure_carrier", label: "Carrier introduction", description: null, category: "Environment", order: 7 },
  { key: "cat_exposure_car", label: "Car rides (in carrier)", description: null, category: "Environment", order: 8 },
  { key: "cat_exposure_grooming", label: "Grooming tools", description: null, category: "Grooming", order: 9 },
];

const catSocializationProtocol: ProtocolSeed = {
  name: "Kitten Socialization",
  description:
    "Comprehensive socialization for kittens during the critical window (Week 2-7). Includes handling habituation and exposure to people, sounds, and environments.",
  species: Species.CAT,
  targetAgeStart: 14,
  targetAgeEnd: 49,
  estimatedDailyMinutes: 15,
  stages: [
    {
      id: "stage-cat-soc-001",
      name: "Kitten Socialization Window",
      description:
        "The critical socialization period for kittens (Week 2-7). Early positive experiences during this window shape lifelong temperament and behavior.",
      ageStartDays: 14,
      ageEndDays: 49,
      order: 1,
      activities: [
        {
          id: "act-cat-handling-001",
          name: "Kitten Handling",
          description: "Daily handling of all body parts to prepare for lifetime care",
          instructions:
            "Handle kitten gently multiple times daily. Touch all body parts for 3-5 seconds each. Keep sessions short and positive. End before kitten shows stress.",
          category: ActivityCategory.HANDLING,
          frequency: ActivityFrequency.CHECKLIST,
          durationMinutes: 5,
          isRequired: true,
          requiresEquipment: [],
          order: 1,
          checklistItems: catHandlingChecklist,
        },
        {
          id: "act-cat-socialization-001",
          name: "Kitten Socialization Exposures",
          description: "Systematic exposure to people, animals, sounds, and environments",
          instructions:
            "Introduce kitten to various stimuli during the critical socialization window (Week 2-7). All exposures should be positive. Allow kitten to approach at their own pace.",
          category: ActivityCategory.SOCIALIZATION,
          frequency: ActivityFrequency.CHECKLIST,
          durationMinutes: null,
          isRequired: true,
          requiresEquipment: ["Carrier"],
          order: 2,
          checklistItems: catExposureChecklist,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. Litter Training Protocol (Cats, Week 3-6)
// ─────────────────────────────────────────────────────────────────────────────

const catLitterChecklist: ChecklistItem[] = [
  { key: "cat_litter_intro", label: "Low-sided starter box introduction", description: null, category: "Setup", order: 1 },
  { key: "cat_litter_post_meal", label: "Placement after meals", description: null, category: "Training", order: 2 },
  { key: "cat_litter_post_sleep", label: "Placement after sleep", description: null, category: "Training", order: 3 },
  { key: "cat_litter_multiple", label: "Multiple boxes for large spaces", description: null, category: "Setup", order: 4 },
  { key: "cat_litter_substrate", label: "Substrate preference established", description: null, category: "Training", order: 5 },
];

const catLitterProtocol: ProtocolSeed = {
  name: "Litter Training",
  description:
    "Systematic litter box training for kittens. Establishes proper substrate preference and consistent elimination habits.",
  species: Species.CAT,
  targetAgeStart: 21,
  targetAgeEnd: 42,
  estimatedDailyMinutes: 5,
  stages: [
    {
      id: "stage-cat-litter-001",
      name: "Litter Training",
      description:
        "Introduction to litter box use. Kittens typically begin using litter at 3-4 weeks with gentle guidance.",
      ageStartDays: 21,
      ageEndDays: 42,
      order: 1,
      activities: [
        {
          id: "act-cat-litter-001",
          name: "Litter Training",
          description: "Progressive litter box introduction and training",
          instructions:
            "Use a low-sided box initially. Place kitten in box after meals and naps. Use unscented clumping litter. Never punish accidents - simply clean and redirect.",
          category: ActivityCategory.TRAINING,
          frequency: ActivityFrequency.CHECKLIST,
          durationMinutes: null,
          isRequired: true,
          requiresEquipment: ["Low-sided litter box", "Unscented clumping litter"],
          order: 1,
          checklistItems: catLitterChecklist,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. Foal Imprint Training Protocol (Horses, Birth-Day 7)
// ─────────────────────────────────────────────────────────────────────────────

const horseImprintChecklist: ChecklistItem[] = [
  { key: "horse_imprint_mare_bond", label: "Allow mare bonding first (1-2 hrs)", description: null, category: "Immediate Post-Birth", order: 1 },
  { key: "horse_imprint_all_body", label: "Touch all body parts", description: null, category: "Immediate Post-Birth", order: 2 },
  { key: "horse_imprint_mouth", label: "Insert finger in mouth (gently)", description: null, category: "Immediate Post-Birth", order: 3 },
  { key: "horse_imprint_ears", label: "Insert finger in ears (gently)", description: null, category: "Immediate Post-Birth", order: 4 },
  { key: "horse_imprint_nostrils", label: "Touch nostrils (gently)", description: null, category: "Immediate Post-Birth", order: 5 },
  { key: "horse_imprint_feet", label: "Pick up each foot", description: null, category: "Immediate Post-Birth", order: 6 },
  { key: "horse_imprint_hooves", label: "Tap on hooves", description: null, category: "Immediate Post-Birth", order: 7 },
  { key: "horse_imprint_halter_exposure", label: "Halter exposure (not tied)", description: null, category: "Days 1-7", order: 8 },
  { key: "horse_imprint_leading_mare", label: "Leading alongside mare", description: null, category: "Days 1-7", order: 9 },
  { key: "horse_imprint_spray_bottle", label: "Spray bottle desensitization", description: null, category: "Days 1-7", order: 10 },
  { key: "horse_imprint_clipper_sound", label: "Clipper sound exposure", description: null, category: "Days 1-7", order: 11 },
];

const horseImprintProtocol: ProtocolSeed = {
  name: "Foal Imprint Training",
  description:
    "Immediate post-birth handling and desensitization program for foals. Establishes trust and acceptance of handling that lasts a lifetime.",
  species: Species.HORSE,
  targetAgeStart: 0,
  targetAgeEnd: 7,
  estimatedDailyMinutes: 15,
  stages: [
    {
      id: "stage-horse-imprint-001",
      name: "Foal Imprint Training",
      description:
        "Critical first week handling. Immediate post-birth desensitization creates lasting acceptance of human touch, halters, and veterinary procedures.",
      ageStartDays: 0,
      ageEndDays: 7,
      order: 1,
      activities: [
        {
          id: "act-horse-imprint-001",
          name: "Foal Imprint Training",
          description: "Immediate post-birth handling and desensitization",
          instructions:
            "Begin handling after mare has bonded (1-2 hours post-birth). Touch all body parts gently. Sessions should be 10-15 minutes for days 1-7. Always allow foal to retreat to mare if stressed.",
          category: ActivityCategory.HANDLING,
          frequency: ActivityFrequency.CHECKLIST,
          durationMinutes: 15,
          isRequired: true,
          requiresEquipment: ["Foal halter", "Spray bottle"],
          order: 1,
          checklistItems: horseImprintChecklist,
        },
        {
          id: "act-horse-daily-001",
          name: "Daily Handling Session",
          description: "Daily 10-15 minute handling and desensitization",
          instructions:
            "Handle foal daily. Touch all body parts. Pick up all feet. Introduce new objects and sounds gradually. Always end on a positive note.",
          category: ActivityCategory.HANDLING,
          frequency: ActivityFrequency.DAILY,
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
// 10. Early Halter Training Protocol (Horses, Week 1-4)
// ─────────────────────────────────────────────────────────────────────────────

const horseHalterChecklist: ChecklistItem[] = [
  { key: "horse_halter_on_off", label: "Halter on/off without fuss", description: null, category: "Basic", order: 1 },
  { key: "horse_halter_pressure_release", label: "Light pressure/release", description: null, category: "Basic", order: 2 },
  { key: "horse_halter_leading_mare", label: "Leading alongside mare", description: null, category: "Leading", order: 3 },
  { key: "horse_halter_leading_away", label: "Brief leading away from mare", description: null, category: "Leading", order: 4 },
  { key: "horse_halter_standing_tied", label: "Standing tied (brief, supervised)", description: null, category: "Advanced", order: 5 },
];

const horseHalterProtocol: ProtocolSeed = {
  name: "Early Halter Training",
  description:
    "Progressive halter training for foals. Teaches acceptance of halter, leading, and basic restraint in a positive manner.",
  species: Species.HORSE,
  targetAgeStart: 7,
  targetAgeEnd: 28,
  estimatedDailyMinutes: 15,
  stages: [
    {
      id: "stage-horse-halter-001",
      name: "Early Halter Training",
      description:
        "Progressive introduction to halter and leading. Builds on imprint training foundation with focus on pressure/release learning.",
      ageStartDays: 7,
      ageEndDays: 28,
      order: 1,
      activities: [
        {
          id: "act-horse-halter-001",
          name: "Early Halter Training",
          description: "Progressive halter introduction and leading",
          instructions:
            "Start with halter exposure only. Progress to light pressure/release. Lead alongside mare first, then gradually away. Keep sessions short and positive.",
          category: ActivityCategory.TRAINING,
          frequency: ActivityFrequency.CHECKLIST,
          durationMinutes: 15,
          isRequired: true,
          requiresEquipment: ["Foal halter", "Lead rope"],
          order: 1,
          checklistItems: horseHalterChecklist,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 11. Kid/Lamb Handling Protocol (Goats/Sheep, Week 1-8)
// ─────────────────────────────────────────────────────────────────────────────

const goatHandlingChecklist: ChecklistItem[] = [
  { key: "goat_handling_daily", label: "Daily handling from birth", description: null, category: "Handling", order: 1 },
  { key: "goat_handling_hooves", label: "Hoof handling", description: null, category: "Handling", order: 2 },
  { key: "goat_handling_trim_prep", label: "Hoof trimming preparation", description: null, category: "Handling", order: 3 },
  { key: "goat_handling_collar", label: "Leading on collar/halter", description: null, category: "Leading", order: 4 },
  { key: "goat_handling_exam", label: "Standing for examination", description: null, category: "Health", order: 5 },
];

const goatHandlingProtocol: ProtocolSeed = {
  name: "Kid/Lamb Handling",
  description:
    "Daily handling protocol for goat kids and lambs. Establishes trust, teaches basic handling skills, and prepares for shows and veterinary care.",
  species: Species.GOAT,
  targetAgeStart: 7,
  targetAgeEnd: 56,
  estimatedDailyMinutes: 10,
  stages: [
    {
      id: "stage-goat-handling-001",
      name: "Kid/Lamb Handling",
      description:
        "Daily handling and training to prepare kids/lambs for shows, veterinary care, and general management.",
      ageStartDays: 7,
      ageEndDays: 56,
      order: 1,
      activities: [
        {
          id: "act-goat-handling-001",
          name: "Kid/Lamb Handling Protocol",
          description: "Daily handling and training for goats and sheep",
          instructions:
            "Handle kid/lamb daily from birth. Practice hoof handling and examination positions. Introduce collar/halter early. Keep sessions positive and brief.",
          category: ActivityCategory.HANDLING,
          frequency: ActivityFrequency.CHECKLIST,
          durationMinutes: 10,
          isRequired: true,
          requiresEquipment: ["Kid collar", "Small halter"],
          order: 1,
          checklistItems: goatHandlingChecklist,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 12. Bottle Feeding Protocol (Goats/Sheep, Birth-Week 8)
// ─────────────────────────────────────────────────────────────────────────────

const goatBottleChecklist: ChecklistItem[] = [
  { key: "goat_bottle_colostrum", label: "Colostrum within 24 hours", description: "Critical for immune protection", category: "Critical", order: 1 },
  { key: "goat_bottle_schedule_week1", label: "Feeding schedule (Week 1): 4-6 times/day", description: null, category: "Schedule", order: 2 },
  { key: "goat_bottle_schedule_week2", label: "Feeding schedule (Week 2-4): 3-4 times/day", description: null, category: "Schedule", order: 3 },
  { key: "goat_bottle_solid_intro", label: "Solid food introduction", description: null, category: "Transition", order: 4 },
  { key: "goat_bottle_weaning", label: "Weaning progression", description: null, category: "Transition", order: 5 },
];

const goatBottleProtocol: ProtocolSeed = {
  name: "Bottle Feeding Protocol",
  description:
    "Complete guide for bottle-raising dam-rejected or orphaned goat kids and lambs. Covers colostrum, feeding schedules, and weaning progression.",
  species: Species.GOAT,
  targetAgeStart: 0,
  targetAgeEnd: 56,
  estimatedDailyMinutes: 30,
  stages: [
    {
      id: "stage-goat-bottle-001",
      name: "Bottle Feeding",
      description:
        "Complete feeding schedule for bottle-raised kids/lambs from colostrum through weaning.",
      ageStartDays: 0,
      ageEndDays: 56,
      order: 1,
      activities: [
        {
          id: "act-goat-bottle-001",
          name: "Bottle Feeding Protocol",
          description: "Dam-rejected kid/lamb feeding schedule",
          instructions:
            "For dam-rejected or orphaned kids/lambs. Ensure colostrum within first 24 hours is critical. Follow age-appropriate feeding schedule. Transition gradually to solid food.",
          category: ActivityCategory.HEALTH,
          frequency: ActivityFrequency.CHECKLIST,
          durationMinutes: null,
          isRequired: true,
          requiresEquipment: ["Bottles", "Nipples", "Milk replacer", "Colostrum supplement"],
          order: 1,
          checklistItems: goatBottleChecklist,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 13. Gun Conditioning for Hunting Dogs (Dogs, Week 5-24)
// ─────────────────────────────────────────────────────────────────────────────

const gunConditioningProtocol: ProtocolSeed = {
  name: "Gun Conditioning for Hunting Dogs",
  description:
    "Systematic gunfire exposure protocol for hunting dog puppies. Progresses from cap guns through starter pistols to full shotgun report. Always pairs gunfire with positive experiences (food, birds, play). Based on established gun dog training methodologies.",
  species: Species.DOG,
  targetAgeStart: 35,
  targetAgeEnd: 168,
  estimatedDailyMinutes: 15,
  stages: [
    {
      id: "stage-gun-001",
      name: "Stage 1: Cap Gun Foundation",
      description:
        "Build positive associations with quiet popping sounds. Always pair with food or play. Goal: puppy ignores cap gun at 10 feet while eating.",
      ageStartDays: 35,
      ageEndDays: 49,
      order: 1,
      activities: [
        {
          id: "act-gun-cap-001",
          name: "Cap Gun Introduction",
          description: "Introduce quiet popping sounds during positive experiences",
          instructions:
            "During feeding or play, pop a cap gun at 50+ feet distance. Observe puppy's reaction. Ideal response: briefly notices, returns to activity. Move closer over days as puppy shows confidence. If puppy shows fear, increase distance and pair with high-value treats.",
          category: ActivityCategory.TRAINING,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 5,
          isRequired: true,
          requiresEquipment: ["Cap gun", "High-value treats"],
          order: 1,
          checklistItems: null,
        },
      ],
    },
    {
      id: "stage-gun-002",
      name: "Stage 2: Starter Pistol",
      description:
        "Progress to louder starter pistol. Always during positive activities. Goal: dog continues working/eating with starter pistol at 20 yards.",
      ageStartDays: 49,
      ageEndDays: 63,
      order: 2,
      activities: [
        {
          id: "act-gun-starter-001",
          name: "Starter Pistol (.22 crimps)",
          description: "Progress to starter pistol sounds during positive activities",
          instructions:
            "Use a starter pistol or .22 crimp blanks at 100+ yards during feeding or bird introduction. Pair every shot with something positive (food, birds, play). Gradually decrease distance over sessions. Watch for signs of stress.",
          category: ActivityCategory.TRAINING,
          frequency: ActivityFrequency.TWICE_DAILY,
          durationMinutes: 10,
          isRequired: true,
          requiresEquipment: ["Starter pistol", ".22 crimp blanks", "Birds or bumpers"],
          order: 1,
          checklistItems: null,
        },
      ],
    },
    {
      id: "stage-gun-003",
      name: "Stage 3: Popper/Primers",
      description:
        "209 primer poppers during bird work. Dog learns gunfire = birds. Goal: dog shows excitement when popper fires.",
      ageStartDays: 63,
      ageEndDays: 84,
      order: 3,
      activities: [
        {
          id: "act-gun-popper-001",
          name: "Popper/209 Primers",
          description: "Introduce louder primer-based noise makers",
          instructions:
            "Use 209 primer poppers during bird work or retrieving drills. Fire when puppy is focused on birds/bumpers. Start at 50+ yards. Dog should be completely focused on birds, not the gun.",
          category: ActivityCategory.TRAINING,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 15,
          isRequired: true,
          requiresEquipment: ["209 primer popper", "Training birds", "Bumpers"],
          order: 1,
          checklistItems: null,
        },
      ],
    },
    {
      id: "stage-gun-004",
      name: "Stage 4: Full Gunfire",
      description:
        "Progress to blank pistol and light shotgun loads. Goal: dog is gun-conditioned and associates gunfire with birds.",
      ageStartDays: 84,
      ageEndDays: 168,
      order: 4,
      activities: [
        {
          id: "act-gun-blank-001",
          name: "Blank Pistol / Light Loads",
          description: "Final progression to field-level gunfire",
          instructions:
            "Use blank pistol or light shotgun loads during simulated hunting scenarios. Always fire when dog is engaged with birds. Dog should associate gunfire with birds falling. If any concern, return to previous stage.",
          category: ActivityCategory.TRAINING,
          frequency: ActivityFrequency.DAILY,
          durationMinutes: 20,
          isRequired: true,
          requiresEquipment: ["Blank pistol or shotgun", "Light loads", "Training birds"],
          order: 1,
          checklistItems: null,
        },
        {
          id: "act-gun-shotgun-001",
          name: "Full Shotgun Report",
          description: "Exposure to full shotgun at hunting distances",
          instructions:
            "Fire shotgun at hunting distances (20-40 yards) during bird work. Dog should be fully engaged with birds. Gunfire = birds falling = excitement. Mark as complete when dog shows eager anticipation at gunfire.",
          category: ActivityCategory.TRAINING,
          frequency: ActivityFrequency.AS_AVAILABLE,
          durationMinutes: 30,
          isRequired: false,
          requiresEquipment: ["Shotgun", "Shells", "Training birds"],
          order: 2,
          checklistItems: null,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 14. BreederHQ Gun Dog Development Protocol (Dogs, Day 3-Week 52)
// Comprehensive 52-week breeder-to-field program with 8 stages
// ─────────────────────────────────────────────────────────────────────────────

const kvsGameBirdScentChecklist: ChecklistItem[] = [
  { key: "quail_feathers", label: "Quail feathers/wing", description: null, category: "Upland", order: 1 },
  { key: "dove_feathers", label: "Dove feathers/wing", description: null, category: "Upland", order: 2 },
  { key: "pheasant_feathers", label: "Pheasant feathers/wing", description: null, category: "Upland", order: 3 },
  { key: "chukar_feathers", label: "Chukar feathers/wing", description: null, category: "Upland", order: 4 },
  { key: "duck_feathers", label: "Duck feathers/wing", description: null, category: "Waterfowl", order: 5 },
  { key: "goose_feathers", label: "Goose feathers/wing", description: null, category: "Waterfowl", order: 6 },
  { key: "turkey_feathers", label: "Turkey feathers", description: null, category: "Wild Game", order: 7 },
  { key: "rabbit_fur", label: "Rabbit fur", description: null, category: "Wild Game", order: 8 },
];

const kvsRuleOf7sHuntingChecklist: ChecklistItem[] = [
  { key: "walked_grass", label: "Walked on grass", description: null, category: "Surfaces", order: 1 },
  { key: "walked_gravel", label: "Walked on gravel", description: null, category: "Surfaces", order: 2 },
  { key: "walked_dirt_mud", label: "Walked on dirt/mud", description: null, category: "Surfaces", order: 3 },
  { key: "walked_kennel", label: "Walked on kennel flooring", description: null, category: "Surfaces", order: 4 },
  { key: "tall_grass_cover", label: "Experienced tall grass/cover", description: null, category: "Surfaces", order: 5 },
  { key: "heard_clapping", label: "Heard clapping (distant)", description: null, category: "Sounds", order: 6 },
  { key: "heard_pot_banging", label: "Heard pot banging", description: null, category: "Sounds", order: 7 },
  { key: "heard_gunshot_recording", label: "Heard gunshot recording (low)", description: null, category: "Sounds", order: 8 },
  { key: "heard_hunting_calls", label: "Heard hunting calls (duck, turkey)", description: null, category: "Sounds", order: 9 },
  { key: "met_adult_men", label: "Met adult men", description: null, category: "People", order: 10 },
  { key: "met_adult_women", label: "Met adult women", description: null, category: "People", order: 11 },
  { key: "met_children", label: "Met children", description: null, category: "People", order: 12 },
  { key: "met_hunting_gear", label: "Met person in hunting gear/camo", description: null, category: "People", order: 13 },
  { key: "rode_vehicle_crate", label: "Rode in vehicle crate", description: null, category: "Experiences", order: 14 },
  { key: "experienced_rain", label: "Experienced rain", description: null, category: "Experiences", order: 15 },
  { key: "experienced_wind", label: "Experienced wind", description: null, category: "Experiences", order: 16 },
  { key: "played_littermates", label: "Played with littermates", description: null, category: "Experiences", order: 17 },
];

const kvsGunConditioningChecklist: ChecklistItem[] = [
  { key: "cap_gun_100_yards", label: "Cap gun at 100+ yards", description: null, category: "Distance", order: 1 },
  { key: "cap_gun_50_yards", label: "Cap gun at 50 yards", description: null, category: "Distance", order: 2 },
  { key: "cap_gun_25_yards", label: "Cap gun at 25 yards", description: null, category: "Distance", order: 3 },
  { key: "22_blank_100_yards", label: ".22 blank at 100+ yards", description: null, category: "Progression", order: 4 },
  { key: "22_blank_50_yards", label: ".22 blank at 50 yards", description: null, category: "Progression", order: 5 },
  { key: "22_blank_25_yards", label: ".22 blank at 25 yards", description: null, category: "Progression", order: 6 },
  { key: "20_gauge_100_yards", label: "20-gauge at 100+ yards", description: null, category: "Live Fire", order: 7 },
  { key: "20_gauge_50_yards", label: "20-gauge at 50 yards", description: null, category: "Live Fire", order: 8 },
  { key: "12_gauge_100_yards", label: "12-gauge at 100+ yards", description: null, category: "Live Fire", order: 9 },
  { key: "12_gauge_50_yards", label: "12-gauge at 50 yards", description: null, category: "Live Fire", order: 10 },
  { key: "shot_during_retrieve", label: "Shot fired during retrieve", description: null, category: "Association", order: 11 },
  { key: "shot_over_point_flush", label: "Shot fired over point/flush", description: null, category: "Association", order: 12 },
];

const kvsHuntReadinessChecklist: ChecklistItem[] = [
  { key: "recalls_off_birds", label: "Recalls reliably off birds", description: null, category: "Assessment", order: 1 },
  { key: "steady_to_shot", label: "Steady to shot", description: null, category: "Assessment", order: 2 },
  { key: "retrieves_to_hand", label: "Retrieves to hand", description: null, category: "Assessment", order: 3 },
  { key: "loads_unloads_vehicle", label: "Loads/unloads from vehicle", description: null, category: "Assessment", order: 4 },
  { key: "honors_other_dogs", label: "Honors other dogs", description: null, category: "Assessment", order: 5 },
  { key: "gun_conditioned", label: "Gun-conditioned", description: null, category: "Assessment", order: 6 },
];

const kvsSeasonReadinessChecklist: ChecklistItem[] = [
  { key: "100_yard_marked", label: "Completes 100+ yard marked retrieves", description: null, category: "Retrieves", order: 1 },
  { key: "basic_blind_retrieves", label: "Completes basic blind retrieves", description: null, category: "Retrieves", order: 2 },
  { key: "steady_through_shot", label: "Steady through shot", description: null, category: "Steadiness", order: 3 },
  { key: "honors_another_dog", label: "Honors another dog's point/retrieve", description: null, category: "Steadiness", order: 4 },
  { key: "handles_heavy_cover", label: "Handles in heavy cover", description: null, category: "Terrain", order: 5 },
  { key: "handles_water", label: "Handles water entries/exits", description: null, category: "Terrain", order: 6 },
  { key: "adverse_weather", label: "Works in adverse weather", description: null, category: "Conditions", order: 7 },
  { key: "stamina_4_hours", label: "Maintains stamina 4+ hours", description: null, category: "Conditioning", order: 8 },
  { key: "rides_calmly", label: "Rides calmly in hunting vehicle", description: null, category: "Transport", order: 9 },
  { key: "settles_in_blind", label: "Settles in blind/at heel", description: null, category: "Patience", order: 10 },
];

const kvsGunDogProtocol: ProtocolSeed = {
  name: "BreederHQ Gun Dog Development Protocol",
  description:
    "A comprehensive, breeder-to-field gun dog development program designed for upland and waterfowl hunting breeds. Covers neurological foundations, scent imprinting, bird exposure, gun conditioning, retrieve training, and field readiness. Based on industry best practices and proven methodologies from leading gun dog training sources. Spans 52 weeks from Day 3 through first hunting season.",
  species: Species.DOG,
  isPublic: true,
  targetAgeStart: 3,
  targetAgeEnd: 364,
  estimatedDailyMinutes: 30,
  stages: [
    // Stage 1: Neonatal Foundations (Day 3-16)
    {
      id: "stage-kvs-neonatal-001",
      name: "Stage 1: Neonatal Foundations",
      description: "Building the neurological foundation before their eyes even open. Includes ENS, ESI, and game bird scent imprinting during the critical neonatal period.",
      ageStartDays: 3, ageEndDays: 16, order: 1,
      activities: [
        { id: "act-kvs-ens-tactile-001", name: "ENS - Tactile Stimulation", description: "Stimulate between toes using a Q-tip", instructions: "Using a Q-tip, gently stimulate between the toes on all four paws. Hold for 3-5 seconds per paw. Perform once daily only - more is not better with ENS.", category: ActivityCategory.ENS, frequency: ActivityFrequency.DAILY, durationMinutes: 1, isRequired: true, requiresEquipment: ["Cotton swab"], order: 1, checklistItems: null },
        { id: "act-kvs-ens-head-up-001", name: "ENS - Head Up Position", description: "Hold puppy perpendicular to ground with head up", instructions: "Hold the puppy perpendicular to the ground with head directly up. Support the body firmly. Hold for 3-5 seconds. Perform once daily.", category: ActivityCategory.ENS, frequency: ActivityFrequency.DAILY, durationMinutes: 1, isRequired: true, requiresEquipment: [], order: 2, checklistItems: null },
        { id: "act-kvs-ens-head-down-001", name: "ENS - Head Down Position", description: "Hold puppy with head pointing directly down", instructions: "Hold the puppy with head pointing directly down toward the ground. Support firmly. Hold for 3-5 seconds. Perform once daily.", category: ActivityCategory.ENS, frequency: ActivityFrequency.DAILY, durationMinutes: 1, isRequired: true, requiresEquipment: [], order: 3, checklistItems: null },
        { id: "act-kvs-ens-supine-001", name: "ENS - Supine Position", description: "Place puppy on back with muzzle pointing at ceiling", instructions: "Place puppy on its back with muzzle pointing at the ceiling. Support gently but don't restrain. Hold for 3-5 seconds. Perform once daily.", category: ActivityCategory.ENS, frequency: ActivityFrequency.DAILY, durationMinutes: 1, isRequired: true, requiresEquipment: [], order: 4, checklistItems: null },
        { id: "act-kvs-ens-thermal-001", name: "ENS - Thermal Stimulation", description: "Place puppy's paws on cool, damp cloth", instructions: "Place puppy's paws on a cool, damp cloth (refrigerated towel works well). Hold for 3-5 seconds. Do not use ice-cold materials. Perform once daily.", category: ActivityCategory.ENS, frequency: ActivityFrequency.DAILY, durationMinutes: 1, isRequired: true, requiresEquipment: ["Cool damp cloth"], order: 5, checklistItems: null },
        { id: "act-kvs-esi-scent-001", name: "Early Scent Introduction", description: "Present a novel scent near the puppy's nose daily", instructions: "Present a novel scent near the puppy's nose for 3-5 seconds. Use a different scent each day. Rotate through environmental and aromatic scents.", category: ActivityCategory.ESI, frequency: ActivityFrequency.DAILY, durationMinutes: 2, isRequired: true, requiresEquipment: ["Scent samples"], order: 6, checklistItems: null },
        { id: "act-kvs-game-bird-scent-001", name: "Game Bird Scent Imprint", description: "Daily exposure to game bird scents using frozen wings", instructions: "Present frozen bird wing scents (quail, dove, pheasant, duck) near the puppy's nose. Hold for 2-3 seconds. Rotate through different game birds throughout the window. This early imprinting creates lasting associations with hunting scents.", category: ActivityCategory.ESI, frequency: ActivityFrequency.CHECKLIST, durationMinutes: 2, isRequired: true, requiresEquipment: ["Frozen bird wings", "Scent samples"], order: 7, checklistItems: kvsGameBirdScentChecklist },
      ],
    },
    // Stage 2: Transition Period (Day 17-28)
    {
      id: "stage-kvs-transition-001",
      name: "Stage 2: Transition Period",
      description: "Eyes and ears open — time to explore. Focus on gentle handling, texture exposure, and startle recovery observation to identify confident hunting prospects.",
      ageStartDays: 17, ageEndDays: 28, order: 2,
      activities: [
        { id: "act-kvs-gentle-handling-001", name: "Gentle Handling Sessions", description: "Twice daily handling to build confidence", instructions: "Handle puppies gently but thoroughly twice daily. Touch ears, paws, tail, mouth. Build positive associations with human touch. 5 minutes per puppy.", category: ActivityCategory.HANDLING, frequency: ActivityFrequency.TWICE_DAILY, durationMinutes: 5, isRequired: true, requiresEquipment: [], order: 1, checklistItems: null },
        { id: "act-kvs-novel-texture-001", name: "Novel Texture Exposure", description: "Expose puppies to various surfaces daily", instructions: "Place puppies on different textures: carpet, tile, rubber mat, grass (if warm), towels. Let them explore for 3 minutes. Build confidence on varied surfaces.", category: ActivityCategory.SOCIALIZATION, frequency: ActivityFrequency.DAILY, durationMinutes: 3, isRequired: true, requiresEquipment: ["Various surfaces"], order: 2, checklistItems: null },
        { id: "act-kvs-continued-scent-001", name: "Continued Scent Work", description: "Continue ESI and game bird scent exposure", instructions: "Continue rotating through scent samples including game bird scents. Present scent for 2-3 seconds. Note any approach or avoidance responses.", category: ActivityCategory.ESI, frequency: ActivityFrequency.DAILY, durationMinutes: 2, isRequired: true, requiresEquipment: ["Scent samples", "Bird wings"], order: 3, checklistItems: null },
        { id: "act-kvs-manding-001", name: "Manding/Communication", description: "Begin teaching puppies to communicate for resources", instructions: "Encourage puppies to make eye contact and offer calm behavior for attention and food. This early communication foundation builds focus later in training.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 2, isRequired: false, requiresEquipment: [], order: 4, checklistItems: null },
        { id: "act-kvs-startle-recovery-001", name: "Startle Recovery Observation", description: "Weekly assessment of recovery from startling sounds", instructions: "Create a brief startling sound (clap, drop book) and observe recovery time. Note which puppies recover quickly vs. slowly. Quick recovery indicates confidence. This helps identify puppies suited for hunting work.", category: ActivityCategory.ASSESSMENT, frequency: ActivityFrequency.WEEKLY, durationMinutes: 5, isRequired: true, requiresEquipment: ["Noise makers"], order: 5, checklistItems: null },
      ],
    },
    // Stage 3: Early Socialization & Bird Exposure (Week 4-7)
    {
      id: "stage-kvs-early-bird-001",
      name: "Stage 3: Early Socialization & Bird Exposure",
      description: "The critical window — everything they experience now shapes who they become. First bird exposure, wing chase games, sound conditioning, and hunting-specific socialization.",
      ageStartDays: 28, ageEndDays: 49, order: 3,
      activities: [
        { id: "act-kvs-first-bird-001", name: "First Bird Exposure", description: "Critical first introduction to live bird stimulus", instructions: "Use a quail wing on a string (fishing rod setup). Let puppy see and chase the wing. This is a MILESTONE moment - record their reaction. Looking for prey drive and interest. One positive experience only - don't overdo it.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.ONCE, durationMinutes: 10, isRequired: true, requiresEquipment: ["Quail wing on string", "Fishing rod or pole"], order: 1, checklistItems: null },
        { id: "act-kvs-wing-chase-001", name: "Wing Chase Games", description: "Daily wing chase to build prey drive", instructions: "Using a bird wing on fishing rod, encourage chase behavior. Keep sessions short (5 min max). Let puppy catch the wing occasionally to build confidence. End on a positive note.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 5, isRequired: true, requiresEquipment: ["Bird wing", "Fishing rod"], order: 2, checklistItems: null },
        { id: "act-kvs-novel-environment-001", name: "Novel Environment Exploration", description: "Daily exposure to new environments", instructions: "Take puppies to new areas within safe, controlled environments. Front yard, garage, different rooms, outdoor pen in new location. Build confidence through exploration.", category: ActivityCategory.SOCIALIZATION, frequency: ActivityFrequency.DAILY, durationMinutes: 10, isRequired: true, requiresEquipment: [], order: 3, checklistItems: null },
        { id: "act-kvs-sound-conditioning-001", name: "Sound Conditioning (low volume)", description: "Begin desensitization to hunting-related sounds", instructions: "Play recordings of gunshots, hunting calls (duck, turkey), outdoor sounds at LOW volume. Pair with feeding or play. Gradually increase volume over days as puppies remain relaxed. Never force exposure if showing fear.", category: ActivityCategory.SOCIALIZATION, frequency: ActivityFrequency.DAILY, durationMinutes: 5, isRequired: true, requiresEquipment: ["Speaker", "Sound recordings"], order: 4, checklistItems: null },
        { id: "act-kvs-puppy-retrieve-001", name: "Puppy Retrieve Foundation", description: "Build foundational retrieve instincts", instructions: "In a hallway or small pen, toss small bumper or puppy dummy. Encourage puppy to chase and pick up. Call puppy back with excitement. Take item gently with praise. Keep it fun - no corrections. Building natural retrieve desire, not formal training.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 5, isRequired: true, requiresEquipment: ["Small bumper", "Puppy dummy"], order: 5, checklistItems: null },
        { id: "act-kvs-human-socialization-001", name: "Human Socialization", description: "Meet various types of people", instructions: "Expose puppies to different people: men, women, children, people in hats, sunglasses, camo gear. All interactions should be positive. Let puppies approach at their own pace.", category: ActivityCategory.SOCIALIZATION, frequency: ActivityFrequency.DAILY, durationMinutes: 10, isRequired: true, requiresEquipment: [], order: 6, checklistItems: null },
        { id: "act-kvs-vehicle-intro-001", name: "Vehicle Introduction", description: "Weekly introduction to vehicles and crates", instructions: "Place crate in vehicle. Let puppies explore while stationary. Use treats to build positive association. Progress to short drives when comfortable. This is foundation for future hunting trips.", category: ActivityCategory.SOCIALIZATION, frequency: ActivityFrequency.WEEKLY, durationMinutes: 5, isRequired: false, requiresEquipment: ["Vehicle", "Crate"], order: 7, checklistItems: null },
        { id: "act-kvs-rule-7s-hunting-001", name: "Rule of 7s - Hunting Edition", description: "Hunting-specific socialization checklist", instructions: "Work through this hunting-focused Rule of 7s checklist during the critical socialization window. Check off each experience as puppies are exposed. Multiple exposures per item are ideal.", category: ActivityCategory.SOCIALIZATION, frequency: ActivityFrequency.CHECKLIST, durationMinutes: null, isRequired: true, requiresEquipment: [], order: 8, checklistItems: kvsRuleOf7sHuntingChecklist },
      ],
    },
    // Stage 4: Socialization Intensive (Week 8-12)
    {
      id: "stage-kvs-socialization-001",
      name: "Stage 4: Socialization Intensive",
      description: "Welcome home — building confidence and drive. Crate training, leash introduction, retrieve drive building, and foundation recall work. Note: vaccination window affects outings.",
      ageStartDays: 56, ageEndDays: 84, order: 4,
      activities: [
        { id: "act-kvs-crate-training-001", name: "Crate Training", description: "Establish crate as safe space", instructions: "Make crate a positive place with treats, meals, and comfort items. Start with door open, progress to closed. Never use crate as punishment. Hunting dogs need to crate quietly for transport and waiting periods.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: null, isRequired: true, requiresEquipment: ["Appropriately sized crate"], order: 1, checklistItems: null },
        { id: "act-kvs-house-training-001", name: "House Training", description: "Establish potty training routine", instructions: "Consistent schedule: out after waking, eating, playing. Reward outdoor eliminations. Clean accidents without punishment. Building reliability and communication.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: null, isRequired: true, requiresEquipment: [], order: 2, checklistItems: null },
        { id: "act-kvs-name-recognition-001", name: "Name Recognition", description: "Teach puppy to respond to name", instructions: "Say name, reward eye contact. Practice throughout day. Name should mean 'look at me' - foundation for all future commands.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 5, isRequired: true, requiresEquipment: ["Treats"], order: 3, checklistItems: null },
        { id: "act-kvs-retrieve-drive-001", name: "Retrieve Drive Building", description: "Build and reinforce retrieve instincts", instructions: "Continue hallway retrieves with puppy bumpers and bird wings. Increase distance gradually. Build excitement and desire. Still no formal force - all play-based. Natural retrieve drive is the goal.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.TWICE_DAILY, durationMinutes: 5, isRequired: true, requiresEquipment: ["Puppy bumpers", "Bird wings"], order: 4, checklistItems: null },
        { id: "act-kvs-leash-intro-001", name: "Leash Introduction", description: "Introduce collar and leash walking", instructions: "Start with collar only, then add light leash. Let puppy drag leash supervised. Pick up leash and follow puppy first. Gradually guide direction. Keep positive.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 10, isRequired: true, requiresEquipment: ["Light leash", "Collar"], order: 5, checklistItems: null },
        { id: "act-kvs-recall-foundation-001", name: "Recall Foundation (Here)", description: "Build reliable recall foundation", instructions: "Use long line in safe area. Say 'Here' with excitement, reward heavily when puppy comes. Never call to punish. Recall is the most important hunting command - must be reliable.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 5, isRequired: true, requiresEquipment: ["Long line", "Treats"], order: 6, checklistItems: null },
        { id: "act-kvs-bird-wing-drag-001", name: "Bird Wing Drag", description: "Introduce scent trailing with bird wing drag", instructions: "Drag bird wing to create scent trail. Let puppy follow trail to wing at end. Building scent trailing instinct. Start with short trails, increase length.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 10, isRequired: true, requiresEquipment: ["Bird wing", "Scent drag"], order: 7, checklistItems: null },
        { id: "act-kvs-novel-outings-001", name: "Novel Environment Outings", description: "Weekly outings to new locations", instructions: "Take puppy to new safe locations: parks (carried before vaccinations complete), friend's yards, farm fields. Building confidence in new environments. Vaccination window note: limit unknown environment exposure until 16 weeks.", category: ActivityCategory.SOCIALIZATION, frequency: ActivityFrequency.WEEKLY, durationMinutes: 20, isRequired: true, requiresEquipment: ["Leash", "Treats"], order: 8, checklistItems: null },
        { id: "act-kvs-water-intro-001", name: "Water Introduction (shallow)", description: "Begin water confidence building", instructions: "Use kiddie pool or very shallow water. Let puppy explore voluntarily. Toss treats into water. Never force puppy into water. Build positive associations.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 10, isRequired: false, requiresEquipment: ["Kiddie pool", "Shallow water access"], order: 9, checklistItems: null },
      ],
    },
    // Stage 5: Foundation Training (Week 12-20)
    {
      id: "stage-kvs-foundation-001",
      name: "Stage 5: Foundation Training",
      description: "Building blocks for the field. Sit command, retrieve to hand, gun conditioning, dead bird introduction, and water confidence building. Critical gun conditioning phase.",
      ageStartDays: 84, ageEndDays: 140, order: 5,
      activities: [
        { id: "act-kvs-sit-command-001", name: "Sit Command", description: "Establish reliable sit command", instructions: "Lure sit with treat, mark and reward. Progress to verbal cue only. Practice in various locations. Sit is foundation for sit-to-flush steadiness.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 10, isRequired: true, requiresEquipment: ["Treats", "Clicker (optional)"], order: 1, checklistItems: null },
        { id: "act-kvs-sit-to-flush-001", name: "Sit to Flush Concept", description: "Begin teaching steadiness to bird movement", instructions: "With dog sitting, move bird wing excitingly. Dog must maintain sit. Reward for staying seated while wing moves. Building impulse control for field steadiness.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 5, isRequired: true, requiresEquipment: ["Wing on string"], order: 2, checklistItems: null },
        { id: "act-kvs-retrieve-to-hand-001", name: "Retrieve to Hand", description: "Shape complete retrieve delivery", instructions: "Encourage puppy to bring bumper all the way to hand. Use 'Give' or 'Drop' command. Start using frozen birds as retrieving objects. Building proper delivery habit.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 10, isRequired: true, requiresEquipment: ["Bumpers", "Frozen birds"], order: 3, checklistItems: null },
        { id: "act-kvs-hold-command-001", name: "Hold Command Introduction", description: "Teach reliable hold and carry", instructions: "Place soft dummy in dog's mouth, say 'Hold'. Gently keep mouth closed. Mark and reward for holding. Foundation for force fetch if needed later.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 5, isRequired: true, requiresEquipment: ["Soft dummy"], order: 4, checklistItems: null },
        { id: "act-kvs-gun-conditioning-p1-001", name: "Gun Conditioning - Phase 1", description: "Begin systematic gun conditioning", instructions: "Start with cap gun at 100+ yards during feeding or play. Progress closer only when dog shows no concern. Always pair gunfire with positive experiences. Progress to .22 blanks at distance. This is CRITICAL - go slowly. One bad experience can ruin a dog.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 15, isRequired: true, requiresEquipment: ["Cap gun", ".22 blanks (distant)"], order: 5, checklistItems: null },
        { id: "act-kvs-dead-bird-intro-001", name: "Dead Bird Introduction", description: "Introduce retrieving dead birds", instructions: "Start with frozen quail or pigeons for retrieving. Teaches proper hold and carry of birds. Progress to freshly thawed birds. Building comfort with real game.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 10, isRequired: true, requiresEquipment: ["Frozen quail", "Pigeons"], order: 6, checklistItems: null },
        { id: "act-kvs-extended-recall-001", name: "Extended Recall Practice", description: "Build recall at increasing distances", instructions: "Use long line in fields. Add whistle recall alongside verbal. Practice with distractions. Recall must be reliable before field work.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 10, isRequired: true, requiresEquipment: ["Long line", "Whistle"], order: 7, checklistItems: null },
        { id: "act-kvs-place-command-001", name: "Place/Kennel Command", description: "Teach place board and crate commands", instructions: "Teach dog to go to place board and stay. Transfer to kennel/crate command. Essential for blind work and vehicle loading later.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 5, isRequired: true, requiresEquipment: ["Place board", "Crate"], order: 8, checklistItems: null },
        { id: "act-kvs-water-confidence-001", name: "Water Confidence Building", description: "Progress water work for retriever breeds", instructions: "Progress from shallow water to swimming depth. Toss bumpers into water. Let dog follow you or confident dog into water. Never force - build confidence.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 15, isRequired: false, requiresEquipment: ["Pond access", "Bumpers"], order: 9, checklistItems: null },
        { id: "act-kvs-heel-intro-001", name: "Heel Introduction", description: "Begin heel position training", instructions: "Teach dog to walk at heel position on left side. Use treats to lure position. Important for controlled movement in the field.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 10, isRequired: false, requiresEquipment: ["Leash"], order: 10, checklistItems: null },
        { id: "act-kvs-gun-checklist-001", name: "Gun Conditioning Progression", description: "Track systematic gun conditioning progress", instructions: "Work through gun conditioning checklist systematically. Never skip steps. Only progress when dog shows excitement or no concern at current level. If any concern shown, return to previous level.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.CHECKLIST, durationMinutes: null, isRequired: true, requiresEquipment: [], order: 11, checklistItems: kvsGunConditioningChecklist },
      ],
    },
    // Stage 6: Rookie Field Work (Week 20-32)
    {
      id: "stage-kvs-rookie-001",
      name: "Stage 6: Rookie Field Work",
      description: "Time to put it all together in the field. Live bird introduction, pointing/flushing development, marked retrieves, steadiness training, and first hunt simulations.",
      ageStartDays: 140, ageEndDays: 224, order: 6,
      activities: [
        { id: "act-kvs-live-bird-intro-001", name: "Live Bird Introduction", description: "First exposure to flight-conditioned live birds", instructions: "Use flight-conditioned quail or pigeons in controlled setting. Let dog find and chase birds. Build excitement and prey drive on live birds. Looking for pointing behavior in pointing breeds, flush response in flushers.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 30, isRequired: true, requiresEquipment: ["Flight-conditioned quail/pigeons"], order: 1, checklistItems: null },
        { id: "act-kvs-pointing-flushing-001", name: "Pointing/Flushing Development", description: "Develop breed-appropriate bird work", instructions: "For pointing breeds: encourage pointing stance, steady on birds. For flushing breeds: develop quartering pattern and flush on command. For retrievers: steady marking of falls. Use launcher if available.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.TWICE_DAILY, durationMinutes: 30, isRequired: true, requiresEquipment: ["Live birds", "Launcher (optional)"], order: 2, checklistItems: null },
        { id: "act-kvs-marked-retrieves-001", name: "Marked Retrieves", description: "Train on single and double marked retrieves", instructions: "Throw bumpers or birds where dog can see fall. Increase distance progressively. Add second mark when single marks are reliable. Building marking ability.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 15, isRequired: true, requiresEquipment: ["Bumpers", "Dead birds"], order: 3, checklistItems: null },
        { id: "act-kvs-water-retrieves-001", name: "Water Retrieves", description: "Train water retrieving for waterfowl breeds", instructions: "Progress to longer water retrieves. Introduce water bumpers, dead ducks. Build confidence on water entries and exits. Essential for waterfowl work.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 20, isRequired: true, requiresEquipment: ["Water bumpers", "Dead ducks"], order: 4, checklistItems: null },
        { id: "act-kvs-quartering-001", name: "Quartering Pattern (Spaniels)", description: "Develop quartering pattern for flushing breeds", instructions: "Use whistle and hand signals to develop side-to-side quartering pattern. Plant birds to reward quartering. Keep dog within gun range. For pointing breeds: focus on range management instead.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 20, isRequired: false, requiresEquipment: ["Whistle", "Planted birds"], order: 5, checklistItems: null },
        { id: "act-kvs-steadiness-flush-001", name: "Steadiness to Flush", description: "Train dog to remain steady at flush and shot", instructions: "Use check cord to enforce steadiness when bird flushes. Dog should sit or stand steady. No chase until released. Building control for hunting situations.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 20, isRequired: true, requiresEquipment: ["Check cord", "Birds"], order: 6, checklistItems: null },
        { id: "act-kvs-stop-to-whistle-001", name: "Stop to Whistle", description: "Establish reliable stop whistle response", instructions: "Teach dog to stop and look at handler on whistle command. Foundation for handling on blinds and directing to birds. Use sit whistle consistently.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 10, isRequired: true, requiresEquipment: ["Whistle"], order: 7, checklistItems: null },
        { id: "act-kvs-first-hunt-sim-001", name: "First Hunt Simulation", description: "Full hunt simulation (monthly recommended)", instructions: "Set up complete hunting scenario: birds, gunfire, retrieves, multiple locations. Evaluate dog's readiness for actual hunting. Note areas needing more work. Recommended: perform at least once per month during this stage.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.AS_AVAILABLE, durationMinutes: 60, isRequired: true, requiresEquipment: ["Full field setup"], order: 8, checklistItems: null },
        { id: "act-kvs-other-dogs-001", name: "Exposure to Other Dogs", description: "Train alongside stable, trained dogs", instructions: "Work alongside experienced hunting dogs. Dog learns to work with others, honor points/retrieves. Choose calm, trained dogs as examples.", category: ActivityCategory.SOCIALIZATION, frequency: ActivityFrequency.WEEKLY, durationMinutes: 30, isRequired: true, requiresEquipment: ["Stable trained dog"], order: 9, checklistItems: null },
        { id: "act-kvs-hunt-readiness-001", name: "First Hunt Readiness Assessment", description: "Evaluate readiness for first real hunt", instructions: "Assess all criteria for first hunt readiness. Dog should pass all items before hunting. Be honest - an unprepared dog is a safety concern and poor experience for everyone.", category: ActivityCategory.ASSESSMENT, frequency: ActivityFrequency.ONCE, durationMinutes: null, isRequired: true, requiresEquipment: [], order: 10, checklistItems: kvsHuntReadinessChecklist },
      ],
    },
    // Stage 7: Intermediate Field Training (Week 32-44)
    {
      id: "stage-kvs-intermediate-001",
      name: "Stage 7: Intermediate Field Training",
      description: "Polishing skills for real-world hunting. Blind retrieves, hand signals, multiple marks, honoring other dogs, and realistic hunting scenarios.",
      ageStartDays: 224, ageEndDays: 308, order: 7,
      activities: [
        { id: "act-kvs-blind-retrieves-001", name: "Blind Retrieves Introduction", description: "Teach handling to unseen birds", instructions: "Introduce blind retrieves where dog didn't see fall. Use white stake markers initially. Teach dog to follow hand signals and whistle to bird. Foundation for advanced field work.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 30, isRequired: true, requiresEquipment: ["Bumpers", "White stake markers"], order: 1, checklistItems: null },
        { id: "act-kvs-hand-signals-001", name: "Hand Signal Basics", description: "Establish directional hand signals", instructions: "Teach back, left, and right hand signals. Start at short distances with pile work. Progress to sending dog on blind retrieves using hand signals.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.DAILY, durationMinutes: 15, isRequired: true, requiresEquipment: ["Bumpers", "Distance"], order: 2, checklistItems: null },
        { id: "act-kvs-multiple-marks-001", name: "Multiple Bird Marks", description: "Train on double and triple marks", instructions: "Set up multiple falls for dog to remember and retrieve. Start with simple doubles, progress to triples and challenging angles. Building memory and marking ability.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 30, isRequired: true, requiresEquipment: ["Multiple throwers", "Birds"], order: 3, checklistItems: null },
        { id: "act-kvs-honoring-001", name: "Honoring (Backing)", description: "Teach honoring another dog's point or retrieve", instructions: "Work with second trained dog. Your dog must remain steady when other dog points or retrieves. Essential for brace work and hunting with others.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 20, isRequired: true, requiresEquipment: ["Second trained dog"], order: 4, checklistItems: null },
        { id: "act-kvs-hunt-test-sim-001", name: "Hunt Test/Trial Simulation", description: "Practice hunt test scenarios (monthly recommended)", instructions: "Set up scenarios matching local hunt test format (AKC, NAVHDA, etc.). Evaluate performance against test standards. Optional for non-competition hunters. Recommended: perform at least once per month during this stage.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.AS_AVAILABLE, durationMinutes: 90, isRequired: false, requiresEquipment: ["Full setup"], order: 5, checklistItems: null },
        { id: "act-kvs-upland-sessions-001", name: "Upland Field Sessions", description: "Practice in upland hunting scenarios", instructions: "Hunt wild or planted birds in upland cover. Practice reading dog, shot opportunities, retrieves. Build stamina and realistic field experience.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 45, isRequired: true, requiresEquipment: ["Wild or planted birds"], order: 6, checklistItems: null },
        { id: "act-kvs-waterfowl-sessions-001", name: "Waterfowl Sessions", description: "Practice waterfowl hunting scenarios", instructions: "Set up duck blind with decoys. Practice steadiness in blind, marking falls, water retrieves. Build experience with waterfowl hunting rhythm.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 45, isRequired: false, requiresEquipment: ["Decoys", "Blind", "Ducks"], order: 7, checklistItems: null },
      ],
    },
    // Stage 8: Advanced & First Season Prep (Week 44-52)
    {
      id: "stage-kvs-advanced-001",
      name: "Stage 8: Advanced & First Season Prep",
      description: "The home stretch — ready for opening day. Extended blind retrieves, complex marking scenarios, all-day conditioning, and the milestone first hunt experience.",
      ageStartDays: 308, ageEndDays: 364, order: 8,
      activities: [
        { id: "act-kvs-extended-blinds-001", name: "Extended Blind Retrieves", description: "Long-distance blind retrieves", instructions: "Increase blind retrieve distances. Add challenging terrain, cover, water. Dog should handle confidently to birds at 100+ yards.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 45, isRequired: true, requiresEquipment: ["All equipment"], order: 1, checklistItems: null },
        { id: "act-kvs-complex-marks-001", name: "Complex Marking Scenarios", description: "Advanced multiple marking drills", instructions: "Set up challenging marking scenarios: retired guns, long falls, tight angles, mixed land/water. Building problem-solving ability for real hunting situations.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 45, isRequired: true, requiresEquipment: ["Multiple throwers"], order: 2, checklistItems: null },
        { id: "act-kvs-real-conditions-001", name: "Real Hunting Conditions", description: "Train in realistic hunting environments", instructions: "Practice in actual hunting locations. Simulate opening day conditions. Work in early morning, evening, various weather. Build experience before season.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 60, isRequired: true, requiresEquipment: ["Field access"], order: 3, checklistItems: null },
        { id: "act-kvs-decoy-work-001", name: "Decoy Spread Work", description: "Train with full decoy spreads", instructions: "Set up realistic decoy spreads. Dog learns to work around decoys without disturbing. Practice retrieves through decoys. For waterfowl hunters.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 30, isRequired: false, requiresEquipment: ["Decoys", "Blind"], order: 4, checklistItems: null },
        { id: "act-kvs-all-day-conditioning-001", name: "All-Day Conditioning", description: "Build stamina for full hunting days", instructions: "Practice extended field sessions (4+ hours). Manage hydration, pacing, rest breaks. Dog should maintain performance throughout a full hunting day.", category: ActivityCategory.TRAINING, frequency: ActivityFrequency.WEEKLY, durationMinutes: 240, isRequired: true, requiresEquipment: ["Hydration", "Pacing"], order: 5, checklistItems: null },
        { id: "act-kvs-first-hunt-001", name: "First Hunt Experience", description: "First actual hunting experience", instructions: "Take dog on first real hunt with experienced mentor. Keep expectations reasonable. Focus on positive experience over productivity. Celebrate any successes. MILESTONE: This is the culmination of the 52-week program.", category: ActivityCategory.TRANSITION, frequency: ActivityFrequency.ONCE, durationMinutes: null, isRequired: true, requiresEquipment: ["All gear", "Mentor"], order: 6, checklistItems: null },
        { id: "act-kvs-season-readiness-001", name: "First Season Readiness Checklist", description: "Final readiness assessment for hunting season", instructions: "Complete final readiness checklist before hunting season. Dog should meet all criteria. If gaps exist, continue training - there's no shame in waiting another season.", category: ActivityCategory.ASSESSMENT, frequency: ActivityFrequency.CHECKLIST, durationMinutes: null, isRequired: true, requiresEquipment: [], order: 7, checklistItems: kvsSeasonReadinessChecklist },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// All Benchmark Protocols (14 total)
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: Volhard PAT was removed — temperament assessments are now a first-class
// offspring feature (decoupled from rearing protocols). See AssessmentResult table.

const BENCHMARK_PROTOCOLS: ProtocolSeed[] = [
  // Dogs (8)
  ensProtocol,
  esiProtocol,
  ruleOf7sProtocol,
  handlingProtocol,
  soundProtocol,
  crateProtocol,
  gunConditioningProtocol,
  kvsGunDogProtocol,
  // Cats (2)
  catSocializationProtocol,
  catLitterProtocol,
  // Horses (2)
  horseImprintProtocol,
  horseHalterProtocol,
  // Goats/Sheep (2)
  goatHandlingProtocol,
  goatBottleProtocol,
];

// ─────────────────────────────────────────────────────────────────────────────
// Seeding Function
// ─────────────────────────────────────────────────────────────────────────────

async function seedRearingBenchmarks() {
  console.log("🌱 Seeding rearing benchmark protocols (14 total)...\n");

  // Step 1: Rename any protocols that were seeded with old names
  console.log("  📝 Checking for protocols with outdated names...");
  for (const [oldName, newName] of NAME_RENAMES) {
    const existing = await prisma.rearingProtocol.findFirst({
      where: { name: oldName, isBenchmark: true, tenantId: null },
    });
    if (existing) {
      await prisma.rearingProtocol.update({
        where: { id: existing.id },
        data: { name: newName },
      });
      console.log(`  🔄 Renamed: "${oldName}" → "${newName}"`);
    }
  }

  // Step 2: Create any missing protocols
  console.log("\n  📦 Creating missing protocols...");
  let created = 0;
  let skipped = 0;

  for (const protocolData of BENCHMARK_PROTOCOLS) {
    // Check if protocol already exists (by canonical name)
    const existing = await prisma.rearingProtocol.findFirst({
      where: {
        name: protocolData.name,
        isBenchmark: true,
        tenantId: null,
      },
    });

    if (existing) {
      console.log(`  ⏭️  Skipping: ${protocolData.name} (already exists)`);
      skipped++;
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
        isPublic: protocolData.isPublic ?? true,
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
    created++;
  }

  console.log(`\n✅ Rearing benchmark protocols seeding complete! (${created} created, ${skipped} skipped)`);
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
