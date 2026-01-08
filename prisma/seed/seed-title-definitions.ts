// prisma/seed/seed-title-definitions.ts
// Seeds global title definitions for common registries (AKC, UKC, etc.)
import "./seed-env-bootstrap";
import { PrismaClient, Species, TitleCategory } from "@prisma/client";

const prisma = new PrismaClient();

type TitleDefinitionSeed = {
  species: Species;
  abbreviation: string;
  fullName: string;
  category: TitleCategory;
  organization: string;
  parentAbbreviation?: string; // For hierarchy (e.g., GCH requires CH)
  pointsRequired?: number;
  description?: string;
  isProducingTitle?: boolean;
  prefixTitle: boolean;
  suffixTitle: boolean;
  displayOrder: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// AKC Dog Titles
// ─────────────────────────────────────────────────────────────────────────────

const AKC_DOG_CONFORMATION: TitleDefinitionSeed[] = [
  {
    species: Species.DOG,
    abbreviation: "CH",
    fullName: "Champion",
    category: TitleCategory.CONFORMATION,
    organization: "AKC",
    pointsRequired: 15,
    description: "15 points including 2 major wins under different judges",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 100,
  },
  {
    species: Species.DOG,
    abbreviation: "GCH",
    fullName: "Grand Champion",
    category: TitleCategory.CONFORMATION,
    organization: "AKC",
    parentAbbreviation: "CH",
    pointsRequired: 25,
    description: "25 GCH points + 3 major wins + defeat other Champions at 3+ shows",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 90,
  },
  {
    species: Species.DOG,
    abbreviation: "GCHB",
    fullName: "Grand Champion Bronze",
    category: TitleCategory.CONFORMATION,
    organization: "AKC",
    parentAbbreviation: "GCH",
    pointsRequired: 100,
    description: "100 GCH points",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 80,
  },
  {
    species: Species.DOG,
    abbreviation: "GCHS",
    fullName: "Grand Champion Silver",
    category: TitleCategory.CONFORMATION,
    organization: "AKC",
    parentAbbreviation: "GCHB",
    pointsRequired: 200,
    description: "200 GCH points",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 70,
  },
  {
    species: Species.DOG,
    abbreviation: "GCHG",
    fullName: "Grand Champion Gold",
    category: TitleCategory.CONFORMATION,
    organization: "AKC",
    parentAbbreviation: "GCHS",
    pointsRequired: 400,
    description: "400 GCH points",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 60,
  },
  {
    species: Species.DOG,
    abbreviation: "GCHP",
    fullName: "Grand Champion Platinum",
    category: TitleCategory.CONFORMATION,
    organization: "AKC",
    parentAbbreviation: "GCHG",
    pointsRequired: 800,
    description: "800 GCH points",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 50,
  },
];

const AKC_DOG_OBEDIENCE: TitleDefinitionSeed[] = [
  {
    species: Species.DOG,
    abbreviation: "CD",
    fullName: "Companion Dog",
    category: TitleCategory.OBEDIENCE,
    organization: "AKC",
    description: "3 qualifying scores in Novice class",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 400,
  },
  {
    species: Species.DOG,
    abbreviation: "CDX",
    fullName: "Companion Dog Excellent",
    category: TitleCategory.OBEDIENCE,
    organization: "AKC",
    parentAbbreviation: "CD",
    description: "3 qualifying scores in Open class",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 390,
  },
  {
    species: Species.DOG,
    abbreviation: "UD",
    fullName: "Utility Dog",
    category: TitleCategory.OBEDIENCE,
    organization: "AKC",
    parentAbbreviation: "CDX",
    description: "3 qualifying scores in Utility class",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 380,
  },
  {
    species: Species.DOG,
    abbreviation: "UDX",
    fullName: "Utility Dog Excellent",
    category: TitleCategory.OBEDIENCE,
    organization: "AKC",
    parentAbbreviation: "UD",
    description: "10 qualifying scores in both Open B and Utility B on same day",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 370,
  },
  {
    species: Species.DOG,
    abbreviation: "OTCH",
    fullName: "Obedience Trial Champion",
    category: TitleCategory.OBEDIENCE,
    organization: "AKC",
    parentAbbreviation: "UD",
    pointsRequired: 100,
    description: "100 points + 3 first places in Open B or Utility B from 3 different judges",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 40,
  },
];

const AKC_DOG_AGILITY: TitleDefinitionSeed[] = [
  {
    species: Species.DOG,
    abbreviation: "NA",
    fullName: "Novice Agility",
    category: TitleCategory.AGILITY,
    organization: "AKC",
    description: "3 qualifying scores in Novice Standard",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 500,
  },
  {
    species: Species.DOG,
    abbreviation: "NAJ",
    fullName: "Novice Agility Jumper",
    category: TitleCategory.AGILITY,
    organization: "AKC",
    description: "3 qualifying scores in Novice JWW",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 495,
  },
  {
    species: Species.DOG,
    abbreviation: "OA",
    fullName: "Open Agility",
    category: TitleCategory.AGILITY,
    organization: "AKC",
    parentAbbreviation: "NA",
    description: "3 qualifying scores in Open Standard",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 490,
  },
  {
    species: Species.DOG,
    abbreviation: "OAJ",
    fullName: "Open Agility Jumper",
    category: TitleCategory.AGILITY,
    organization: "AKC",
    parentAbbreviation: "NAJ",
    description: "3 qualifying scores in Open JWW",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 485,
  },
  {
    species: Species.DOG,
    abbreviation: "AX",
    fullName: "Agility Excellent",
    category: TitleCategory.AGILITY,
    organization: "AKC",
    parentAbbreviation: "OA",
    description: "3 qualifying scores in Excellent Standard",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 480,
  },
  {
    species: Species.DOG,
    abbreviation: "AXJ",
    fullName: "Agility Excellent Jumper",
    category: TitleCategory.AGILITY,
    organization: "AKC",
    parentAbbreviation: "OAJ",
    description: "3 qualifying scores in Excellent JWW",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 475,
  },
  {
    species: Species.DOG,
    abbreviation: "MX",
    fullName: "Master Agility Excellent",
    category: TitleCategory.AGILITY,
    organization: "AKC",
    parentAbbreviation: "AX",
    description: "10 qualifying scores in Master Standard",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 470,
  },
  {
    species: Species.DOG,
    abbreviation: "MXJ",
    fullName: "Master Excellent Jumper",
    category: TitleCategory.AGILITY,
    organization: "AKC",
    parentAbbreviation: "AXJ",
    description: "10 qualifying scores in Master JWW",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 465,
  },
  {
    species: Species.DOG,
    abbreviation: "MACH",
    fullName: "Master Agility Champion",
    category: TitleCategory.AGILITY,
    organization: "AKC",
    pointsRequired: 750,
    description: "750 championship points + 20 double qualifying scores",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 30,
  },
];

const AKC_DOG_RALLY: TitleDefinitionSeed[] = [
  {
    species: Species.DOG,
    abbreviation: "RN",
    fullName: "Rally Novice",
    category: TitleCategory.RALLY,
    organization: "AKC",
    description: "3 qualifying scores in Rally Novice",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 600,
  },
  {
    species: Species.DOG,
    abbreviation: "RA",
    fullName: "Rally Advanced",
    category: TitleCategory.RALLY,
    organization: "AKC",
    parentAbbreviation: "RN",
    description: "3 qualifying scores in Rally Advanced",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 590,
  },
  {
    species: Species.DOG,
    abbreviation: "RE",
    fullName: "Rally Excellent",
    category: TitleCategory.RALLY,
    organization: "AKC",
    parentAbbreviation: "RA",
    description: "3 qualifying scores in Rally Excellent",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 580,
  },
  {
    species: Species.DOG,
    abbreviation: "RAE",
    fullName: "Rally Advanced Excellent",
    category: TitleCategory.RALLY,
    organization: "AKC",
    parentAbbreviation: "RE",
    description: "10 qualifying scores in both Advanced B and Excellent B on same day",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 570,
  },
  {
    species: Species.DOG,
    abbreviation: "RACH",
    fullName: "Rally Champion",
    category: TitleCategory.RALLY,
    organization: "AKC",
    pointsRequired: 300,
    description: "300 championship points + 20 triple qualifying scores",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 35,
  },
];

const AKC_DOG_FIELD: TitleDefinitionSeed[] = [
  {
    species: Species.DOG,
    abbreviation: "JH",
    fullName: "Junior Hunter",
    category: TitleCategory.FIELD,
    organization: "AKC",
    description: "4 qualifying scores in Junior Hunt Tests",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 700,
  },
  {
    species: Species.DOG,
    abbreviation: "SH",
    fullName: "Senior Hunter",
    category: TitleCategory.FIELD,
    organization: "AKC",
    parentAbbreviation: "JH",
    description: "4 qualifying scores in Senior Hunt Tests",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 690,
  },
  {
    species: Species.DOG,
    abbreviation: "MH",
    fullName: "Master Hunter",
    category: TitleCategory.FIELD,
    organization: "AKC",
    parentAbbreviation: "SH",
    description: "6 qualifying scores in Master Hunt Tests",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 680,
  },
  {
    species: Species.DOG,
    abbreviation: "FC",
    fullName: "Field Champion",
    category: TitleCategory.FIELD,
    organization: "AKC",
    description: "Points earned in licensed field trials",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 25,
  },
  {
    species: Species.DOG,
    abbreviation: "AFC",
    fullName: "Amateur Field Champion",
    category: TitleCategory.FIELD,
    organization: "AKC",
    description: "Points earned in amateur field trials",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 26,
  },
];

const AKC_DOG_HERDING: TitleDefinitionSeed[] = [
  {
    species: Species.DOG,
    abbreviation: "HT",
    fullName: "Herding Tested",
    category: TitleCategory.HERDING,
    organization: "AKC",
    description: "2 passing scores in Herding Instinct Test",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 800,
  },
  {
    species: Species.DOG,
    abbreviation: "PT",
    fullName: "Pre-Trial Tested",
    category: TitleCategory.HERDING,
    organization: "AKC",
    parentAbbreviation: "HT",
    description: "2 passing scores in Pre-Trial Test",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 790,
  },
  {
    species: Species.DOG,
    abbreviation: "HC",
    fullName: "Herding Champion",
    category: TitleCategory.HERDING,
    organization: "AKC",
    pointsRequired: 15,
    description: "15 championship points in Herding trials",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 27,
  },
];

const AKC_DOG_TRACKING: TitleDefinitionSeed[] = [
  {
    species: Species.DOG,
    abbreviation: "TD",
    fullName: "Tracking Dog",
    category: TitleCategory.TRACKING,
    organization: "AKC",
    description: "1 passing score in Tracking Dog test",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 900,
  },
  {
    species: Species.DOG,
    abbreviation: "TDX",
    fullName: "Tracking Dog Excellent",
    category: TitleCategory.TRACKING,
    organization: "AKC",
    parentAbbreviation: "TD",
    description: "1 passing score in Tracking Dog Excellent test",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 890,
  },
  {
    species: Species.DOG,
    abbreviation: "VST",
    fullName: "Variable Surface Tracker",
    category: TitleCategory.TRACKING,
    organization: "AKC",
    description: "1 passing score in Variable Surface Tracking test",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 880,
  },
  {
    species: Species.DOG,
    abbreviation: "CT",
    fullName: "Champion Tracker",
    category: TitleCategory.TRACKING,
    organization: "AKC",
    description: "TD + TDX + VST titles",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 28,
  },
];

const AKC_DOG_COMPANION: TitleDefinitionSeed[] = [
  {
    species: Species.DOG,
    abbreviation: "CGC",
    fullName: "Canine Good Citizen",
    category: TitleCategory.OTHER,
    organization: "AKC",
    description: "Pass the CGC evaluation",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 1000,
  },
  {
    species: Species.DOG,
    abbreviation: "CGCA",
    fullName: "Canine Good Citizen Advanced",
    category: TitleCategory.OTHER,
    organization: "AKC",
    parentAbbreviation: "CGC",
    description: "Pass the CGCA evaluation",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 990,
  },
  {
    species: Species.DOG,
    abbreviation: "CGCU",
    fullName: "Canine Good Citizen Urban",
    category: TitleCategory.OTHER,
    organization: "AKC",
    parentAbbreviation: "CGC",
    description: "Pass the CGCU evaluation",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 985,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UKC Dog Titles
// ─────────────────────────────────────────────────────────────────────────────

const UKC_DOG_CONFORMATION: TitleDefinitionSeed[] = [
  {
    species: Species.DOG,
    abbreviation: "CH",
    fullName: "Champion",
    category: TitleCategory.CONFORMATION,
    organization: "UKC",
    pointsRequired: 100,
    description: "100 points with competition",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 100,
  },
  {
    species: Species.DOG,
    abbreviation: "GRCH",
    fullName: "Grand Champion",
    category: TitleCategory.CONFORMATION,
    organization: "UKC",
    parentAbbreviation: "CH",
    pointsRequired: 100,
    description: "100 additional points after CH",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 90,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Producing Titles (Breed Club)
// ─────────────────────────────────────────────────────────────────────────────

const PRODUCING_TITLES: TitleDefinitionSeed[] = [
  {
    species: Species.DOG,
    abbreviation: "ROM",
    fullName: "Register of Merit",
    category: TitleCategory.PRODUCING,
    organization: "Breed Club",
    description: "Produced required number of champion offspring",
    isProducingTitle: true,
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 1100,
  },
  {
    species: Species.DOG,
    abbreviation: "ROMX",
    fullName: "Register of Merit Excellent",
    category: TitleCategory.PRODUCING,
    organization: "Breed Club",
    parentAbbreviation: "ROM",
    description: "Produced exceptional number of champion offspring",
    isProducingTitle: true,
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 1090,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Horse Titles - AQHA (American Quarter Horse Association)
// ─────────────────────────────────────────────────────────────────────────────

const AQHA_HORSE_CONFORMATION: TitleDefinitionSeed[] = [
  {
    species: Species.HORSE,
    abbreviation: "WCH",
    fullName: "World Champion",
    category: TitleCategory.CONFORMATION,
    organization: "AQHA",
    description: "AQHA World Show Champion",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 50,
  },
  {
    species: Species.HORSE,
    abbreviation: "RWCH",
    fullName: "Reserve World Champion",
    category: TitleCategory.CONFORMATION,
    organization: "AQHA",
    description: "AQHA World Show Reserve Champion",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 55,
  },
  {
    species: Species.HORSE,
    abbreviation: "Superior Halter",
    fullName: "Superior Halter",
    category: TitleCategory.CONFORMATION,
    organization: "AQHA",
    pointsRequired: 50,
    description: "50 halter points in a single division",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 180,
  },
];

const AQHA_HORSE_PERFORMANCE: TitleDefinitionSeed[] = [
  {
    species: Species.HORSE,
    abbreviation: "ROM",
    fullName: "Register of Merit",
    category: TitleCategory.PERFORMANCE,
    organization: "AQHA",
    pointsRequired: 10,
    description: "10 points in AQHA approved events",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 200,
  },
  {
    species: Species.HORSE,
    abbreviation: "Superior",
    fullName: "Superior Performance",
    category: TitleCategory.PERFORMANCE,
    organization: "AQHA",
    parentAbbreviation: "ROM",
    pointsRequired: 50,
    description: "50 points in a single event",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 190,
  },
  {
    species: Species.HORSE,
    abbreviation: "AQHA CH",
    fullName: "AQHA Champion",
    category: TitleCategory.PERFORMANCE,
    organization: "AQHA",
    pointsRequired: 30,
    description: "30 halter points + 30 performance points in 3 different areas",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 60,
  },
  {
    species: Species.HORSE,
    abbreviation: "Supreme CH",
    fullName: "Supreme Champion",
    category: TitleCategory.PERFORMANCE,
    organization: "AQHA",
    parentAbbreviation: "AQHA CH",
    description: "AQHA Champion + Superior Halter + Superior Performance in 3 events",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 45,
  },
];

const AQHA_HORSE_VERSATILITY: TitleDefinitionSeed[] = [
  {
    species: Species.HORSE,
    abbreviation: "VCH",
    fullName: "Versatility Champion",
    category: TitleCategory.PERFORMANCE,
    organization: "AQHA",
    description: "Points in 6 different events from at least 3 divisions",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 65,
  },
  {
    species: Species.HORSE,
    abbreviation: "SVCH",
    fullName: "Supreme Versatility Champion",
    category: TitleCategory.PERFORMANCE,
    organization: "AQHA",
    parentAbbreviation: "VCH",
    description: "ROM in at least 6 events from at least 3 divisions",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 48,
  },
];

const AQHA_HORSE_AMATEUR: TitleDefinitionSeed[] = [
  {
    species: Species.HORSE,
    abbreviation: "Amateur WCH",
    fullName: "Amateur World Champion",
    category: TitleCategory.PERFORMANCE,
    organization: "AQHA",
    description: "AQHA World Show Amateur Champion",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 52,
  },
  {
    species: Species.HORSE,
    abbreviation: "Amateur Superior",
    fullName: "Amateur Superior",
    category: TitleCategory.PERFORMANCE,
    organization: "AQHA",
    pointsRequired: 50,
    description: "50 amateur points in a single event",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 185,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Horse Titles - APHA (American Paint Horse Association)
// ─────────────────────────────────────────────────────────────────────────────

const APHA_HORSE_TITLES: TitleDefinitionSeed[] = [
  {
    species: Species.HORSE,
    abbreviation: "ROM",
    fullName: "Register of Merit",
    category: TitleCategory.PERFORMANCE,
    organization: "APHA",
    pointsRequired: 10,
    description: "10 points in APHA approved events",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 200,
  },
  {
    species: Species.HORSE,
    abbreviation: "Superior",
    fullName: "Superior Event Horse",
    category: TitleCategory.PERFORMANCE,
    organization: "APHA",
    parentAbbreviation: "ROM",
    pointsRequired: 50,
    description: "50 points in a single event",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 190,
  },
  {
    species: Species.HORSE,
    abbreviation: "WCH",
    fullName: "World Champion",
    category: TitleCategory.CONFORMATION,
    organization: "APHA",
    description: "APHA World Show Champion",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 50,
  },
  {
    species: Species.HORSE,
    abbreviation: "RWCH",
    fullName: "Reserve World Champion",
    category: TitleCategory.CONFORMATION,
    organization: "APHA",
    description: "APHA World Show Reserve Champion",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 55,
  },
  {
    species: Species.HORSE,
    abbreviation: "Supreme CH",
    fullName: "Supreme Champion",
    category: TitleCategory.PERFORMANCE,
    organization: "APHA",
    description: "Highest level of achievement in APHA",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 45,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Horse Titles - USEF/USDF (Dressage)
// ─────────────────────────────────────────────────────────────────────────────

const USDF_DRESSAGE_TITLES: TitleDefinitionSeed[] = [
  {
    species: Species.HORSE,
    abbreviation: "Bronze",
    fullName: "USDF Bronze Medal",
    category: TitleCategory.PERFORMANCE,
    organization: "USDF",
    description: "Scores of 60%+ at Training, First, and Second Level",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 300,
  },
  {
    species: Species.HORSE,
    abbreviation: "Silver",
    fullName: "USDF Silver Medal",
    category: TitleCategory.PERFORMANCE,
    organization: "USDF",
    parentAbbreviation: "Bronze",
    description: "Scores of 60%+ at Third and Fourth Level",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 290,
  },
  {
    species: Species.HORSE,
    abbreviation: "Gold",
    fullName: "USDF Gold Medal",
    category: TitleCategory.PERFORMANCE,
    organization: "USDF",
    parentAbbreviation: "Silver",
    description: "Scores of 60%+ at Prix St. Georges, Intermediate I, and Grand Prix",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 280,
  },
  {
    species: Species.HORSE,
    abbreviation: "HOY",
    fullName: "Horse of the Year",
    category: TitleCategory.PERFORMANCE,
    organization: "USDF",
    description: "USDF Horse of the Year at any level",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 100,
  },
  {
    species: Species.HORSE,
    abbreviation: "All-Breeds HOY",
    fullName: "All-Breeds Horse of the Year",
    category: TitleCategory.PERFORMANCE,
    organization: "USDF",
    description: "USDF All-Breeds Horse of the Year",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 105,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Horse Titles - USEA (Eventing)
// ─────────────────────────────────────────────────────────────────────────────

const USEA_EVENTING_TITLES: TitleDefinitionSeed[] = [
  {
    species: Species.HORSE,
    abbreviation: "BN",
    fullName: "Beginner Novice Complete",
    category: TitleCategory.PERFORMANCE,
    organization: "USEA",
    description: "Completed Beginner Novice level eventing",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 400,
  },
  {
    species: Species.HORSE,
    abbreviation: "N",
    fullName: "Novice Complete",
    category: TitleCategory.PERFORMANCE,
    organization: "USEA",
    parentAbbreviation: "BN",
    description: "Completed Novice level eventing",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 390,
  },
  {
    species: Species.HORSE,
    abbreviation: "T",
    fullName: "Training Complete",
    category: TitleCategory.PERFORMANCE,
    organization: "USEA",
    parentAbbreviation: "N",
    description: "Completed Training level eventing",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 380,
  },
  {
    species: Species.HORSE,
    abbreviation: "P",
    fullName: "Preliminary Complete",
    category: TitleCategory.PERFORMANCE,
    organization: "USEA",
    parentAbbreviation: "T",
    description: "Completed Preliminary level eventing",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 370,
  },
  {
    species: Species.HORSE,
    abbreviation: "I",
    fullName: "Intermediate Complete",
    category: TitleCategory.PERFORMANCE,
    organization: "USEA",
    parentAbbreviation: "P",
    description: "Completed Intermediate level eventing",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 360,
  },
  {
    species: Species.HORSE,
    abbreviation: "A",
    fullName: "Advanced Complete",
    category: TitleCategory.PERFORMANCE,
    organization: "USEA",
    parentAbbreviation: "I",
    description: "Completed Advanced level eventing",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 350,
  },
  {
    species: Species.HORSE,
    abbreviation: "HOY",
    fullName: "Horse of the Year",
    category: TitleCategory.PERFORMANCE,
    organization: "USEA",
    description: "USEA Horse of the Year at any level",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 100,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Horse Titles - USHJA (Hunter/Jumper)
// ─────────────────────────────────────────────────────────────────────────────

const USHJA_HUNTER_JUMPER_TITLES: TitleDefinitionSeed[] = [
  {
    species: Species.HORSE,
    abbreviation: "Zone CH",
    fullName: "Zone Champion",
    category: TitleCategory.PERFORMANCE,
    organization: "USHJA",
    description: "USHJA Zone Champion",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 150,
  },
  {
    species: Species.HORSE,
    abbreviation: "National CH",
    fullName: "National Champion",
    category: TitleCategory.PERFORMANCE,
    organization: "USHJA",
    description: "USHJA National Champion",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 55,
  },
  {
    species: Species.HORSE,
    abbreviation: "HOY",
    fullName: "Horse of the Year",
    category: TitleCategory.PERFORMANCE,
    organization: "USHJA",
    description: "USHJA Horse of the Year",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 100,
  },
  {
    species: Species.HORSE,
    abbreviation: "Int'l Hunter Derby CH",
    fullName: "International Hunter Derby Champion",
    category: TitleCategory.PERFORMANCE,
    organization: "USHJA",
    description: "USHJA International Hunter Derby Finals Champion",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 60,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Horse Titles - Jockey Club (Thoroughbred Racing & Producing)
// ─────────────────────────────────────────────────────────────────────────────

const JOCKEY_CLUB_TITLES: TitleDefinitionSeed[] = [
  // Racing Performance
  {
    species: Species.HORSE,
    abbreviation: "HOY",
    fullName: "Horse of the Year",
    category: TitleCategory.PERFORMANCE,
    organization: "Jockey Club",
    description: "Eclipse Award Horse of the Year",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 5,
  },
  {
    species: Species.HORSE,
    abbreviation: "Champion",
    fullName: "Eclipse Award Champion",
    category: TitleCategory.PERFORMANCE,
    organization: "Jockey Club",
    description: "Eclipse Award Champion (Horse of the Year, divisional)",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 10,
  },
  {
    species: Species.HORSE,
    abbreviation: "MGSW",
    fullName: "Multiple Graded Stakes Winner",
    category: TitleCategory.PERFORMANCE,
    organization: "Jockey Club",
    description: "Winner of multiple graded stakes races",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 15,
  },
  {
    species: Species.HORSE,
    abbreviation: "G1W",
    fullName: "Grade 1 Winner",
    category: TitleCategory.PERFORMANCE,
    organization: "Jockey Club",
    description: "Winner of a Grade 1 stakes race",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 20,
  },
  {
    species: Species.HORSE,
    abbreviation: "G2W",
    fullName: "Grade 2 Winner",
    category: TitleCategory.PERFORMANCE,
    organization: "Jockey Club",
    description: "Winner of a Grade 2 stakes race",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 25,
  },
  {
    species: Species.HORSE,
    abbreviation: "G3W",
    fullName: "Grade 3 Winner",
    category: TitleCategory.PERFORMANCE,
    organization: "Jockey Club",
    description: "Winner of a Grade 3 stakes race",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 30,
  },
  {
    species: Species.HORSE,
    abbreviation: "MSW",
    fullName: "Multiple Stakes Winner",
    category: TitleCategory.PERFORMANCE,
    organization: "Jockey Club",
    parentAbbreviation: "SW",
    description: "Winner of multiple stakes races",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 110,
  },
  {
    species: Species.HORSE,
    abbreviation: "SW",
    fullName: "Stakes Winner",
    category: TitleCategory.PERFORMANCE,
    organization: "Jockey Club",
    description: "Winner of any stakes race",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 120,
  },
  {
    species: Species.HORSE,
    abbreviation: "SP",
    fullName: "Stakes Placed",
    category: TitleCategory.PERFORMANCE,
    organization: "Jockey Club",
    description: "Placed (2nd or 3rd) in a stakes race",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 130,
  },
  // Producing Titles
  {
    species: Species.HORSE,
    abbreviation: "Leading Sire",
    fullName: "Leading Sire",
    category: TitleCategory.PRODUCING,
    organization: "Jockey Club",
    description: "Leading sire by progeny earnings",
    isProducingTitle: true,
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 1100,
  },
  {
    species: Species.HORSE,
    abbreviation: "Leading Broodmare Sire",
    fullName: "Leading Broodmare Sire",
    category: TitleCategory.PRODUCING,
    organization: "Jockey Club",
    description: "Leading broodmare sire by progeny earnings",
    isProducingTitle: true,
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 1105,
  },
  {
    species: Species.HORSE,
    abbreviation: "Dam of Winners",
    fullName: "Dam of Stakes Winners",
    category: TitleCategory.PRODUCING,
    organization: "Jockey Club",
    description: "Dam who has produced stakes winners",
    isProducingTitle: true,
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 1110,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Horse Titles - AQHA Racing (Quarter Horse Racing)
// ─────────────────────────────────────────────────────────────────────────────

const AQHA_RACING_TITLES: TitleDefinitionSeed[] = [
  {
    species: Species.HORSE,
    abbreviation: "G1W",
    fullName: "Grade 1 Winner",
    category: TitleCategory.PERFORMANCE,
    organization: "AQHA Racing",
    description: "Winner of a Grade 1 Quarter Horse stakes race",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 20,
  },
  {
    species: Species.HORSE,
    abbreviation: "G2W",
    fullName: "Grade 2 Winner",
    category: TitleCategory.PERFORMANCE,
    organization: "AQHA Racing",
    description: "Winner of a Grade 2 Quarter Horse stakes race",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 25,
  },
  {
    species: Species.HORSE,
    abbreviation: "G3W",
    fullName: "Grade 3 Winner",
    category: TitleCategory.PERFORMANCE,
    organization: "AQHA Racing",
    description: "Winner of a Grade 3 Quarter Horse stakes race",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 30,
  },
  {
    species: Species.HORSE,
    abbreviation: "SW",
    fullName: "Stakes Winner",
    category: TitleCategory.PERFORMANCE,
    organization: "AQHA Racing",
    description: "Winner of any Quarter Horse stakes race",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 120,
  },
  {
    species: Species.HORSE,
    abbreviation: "Racing ROM",
    fullName: "Racing Register of Merit",
    category: TitleCategory.PERFORMANCE,
    organization: "AQHA Racing",
    description: "Speed Index of 80 or higher",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 200,
  },
  {
    species: Species.HORSE,
    abbreviation: "Racing Superior",
    fullName: "Superior Race Horse",
    category: TitleCategory.PERFORMANCE,
    organization: "AQHA Racing",
    parentAbbreviation: "Racing ROM",
    description: "Speed Index of 90 or higher in multiple races",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 190,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Horse Titles - Arabian (AHA)
// ─────────────────────────────────────────────────────────────────────────────

const AHA_ARABIAN_TITLES: TitleDefinitionSeed[] = [
  {
    species: Species.HORSE,
    abbreviation: "National CH",
    fullName: "National Champion",
    category: TitleCategory.CONFORMATION,
    organization: "AHA",
    description: "U.S. National Arabian Champion",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 50,
  },
  {
    species: Species.HORSE,
    abbreviation: "Reserve National CH",
    fullName: "Reserve National Champion",
    category: TitleCategory.CONFORMATION,
    organization: "AHA",
    description: "U.S. National Arabian Reserve Champion",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 55,
  },
  {
    species: Species.HORSE,
    abbreviation: "Top Ten",
    fullName: "National Top Ten",
    category: TitleCategory.CONFORMATION,
    organization: "AHA",
    description: "U.S. National Arabian Top Ten",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 150,
  },
  {
    species: Species.HORSE,
    abbreviation: "Legion of Honor",
    fullName: "Legion of Honor",
    category: TitleCategory.PERFORMANCE,
    organization: "AHA",
    pointsRequired: 150,
    description: "150 or more points in AHA competition",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 200,
  },
  {
    species: Species.HORSE,
    abbreviation: "Legion Supreme",
    fullName: "Legion of Supreme Honor",
    category: TitleCategory.PERFORMANCE,
    organization: "AHA",
    parentAbbreviation: "Legion of Honor",
    pointsRequired: 500,
    description: "500 or more points in AHA competition",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 180,
  },
  {
    species: Species.HORSE,
    abbreviation: "Legion Masters",
    fullName: "Legion of Masters",
    category: TitleCategory.PERFORMANCE,
    organization: "AHA",
    parentAbbreviation: "Legion Supreme",
    pointsRequired: 1000,
    description: "1000 or more points in AHA competition",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 160,
  },
  {
    species: Species.HORSE,
    abbreviation: "Legion Excellence",
    fullName: "Legion of Excellence",
    category: TitleCategory.PERFORMANCE,
    organization: "AHA",
    parentAbbreviation: "Legion Masters",
    pointsRequired: 2500,
    description: "2500 or more points in AHA competition",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 140,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Horse Titles - Morgan (AMHA)
// ─────────────────────────────────────────────────────────────────────────────

const AMHA_MORGAN_TITLES: TitleDefinitionSeed[] = [
  {
    species: Species.HORSE,
    abbreviation: "Grand National CH",
    fullName: "Grand National Champion",
    category: TitleCategory.CONFORMATION,
    organization: "AMHA",
    description: "Morgan Grand National Champion",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 50,
  },
  {
    species: Species.HORSE,
    abbreviation: "World CH",
    fullName: "World Champion",
    category: TitleCategory.CONFORMATION,
    organization: "AMHA",
    description: "Morgan World Champion",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 48,
  },
  {
    species: Species.HORSE,
    abbreviation: "AOH",
    fullName: "Award of Honor",
    category: TitleCategory.PERFORMANCE,
    organization: "AMHA",
    pointsRequired: 25,
    description: "25 points in AMHA competition",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 250,
  },
  {
    species: Species.HORSE,
    abbreviation: "AOM",
    fullName: "Award of Merit",
    category: TitleCategory.PERFORMANCE,
    organization: "AMHA",
    parentAbbreviation: "AOH",
    pointsRequired: 50,
    description: "50 points in AMHA competition",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 240,
  },
  {
    species: Species.HORSE,
    abbreviation: "AOE",
    fullName: "Award of Excellence",
    category: TitleCategory.PERFORMANCE,
    organization: "AMHA",
    parentAbbreviation: "AOM",
    pointsRequired: 100,
    description: "100 points in AMHA competition",
    prefixTitle: false,
    suffixTitle: true,
    displayOrder: 230,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Cat Titles (TICA, CFA)
// ─────────────────────────────────────────────────────────────────────────────

const TICA_CAT_TITLES: TitleDefinitionSeed[] = [
  {
    species: Species.CAT,
    abbreviation: "CH",
    fullName: "Champion",
    category: TitleCategory.CONFORMATION,
    organization: "TICA",
    pointsRequired: 200,
    description: "200 points in championship class",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 100,
  },
  {
    species: Species.CAT,
    abbreviation: "GC",
    fullName: "Grand Champion",
    category: TitleCategory.CONFORMATION,
    organization: "TICA",
    parentAbbreviation: "CH",
    pointsRequired: 1000,
    description: "1000 points in championship class",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 90,
  },
  {
    species: Species.CAT,
    abbreviation: "DGC",
    fullName: "Double Grand Champion",
    category: TitleCategory.CONFORMATION,
    organization: "TICA",
    parentAbbreviation: "GC",
    pointsRequired: 2000,
    description: "2000 points in championship class",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 80,
  },
  {
    species: Species.CAT,
    abbreviation: "TGC",
    fullName: "Triple Grand Champion",
    category: TitleCategory.CONFORMATION,
    organization: "TICA",
    parentAbbreviation: "DGC",
    pointsRequired: 3000,
    description: "3000 points in championship class",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 70,
  },
  {
    species: Species.CAT,
    abbreviation: "QGC",
    fullName: "Quadruple Grand Champion",
    category: TitleCategory.CONFORMATION,
    organization: "TICA",
    parentAbbreviation: "TGC",
    pointsRequired: 4000,
    description: "4000 points in championship class",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 60,
  },
  {
    species: Species.CAT,
    abbreviation: "SGC",
    fullName: "Supreme Grand Champion",
    category: TitleCategory.CONFORMATION,
    organization: "TICA",
    parentAbbreviation: "QGC",
    pointsRequired: 6000,
    description: "6000 points in championship class",
    prefixTitle: true,
    suffixTitle: false,
    displayOrder: 50,
  },
];

// Combine all definitions
const ALL_TITLE_DEFINITIONS: TitleDefinitionSeed[] = [
  // ─── Dogs - AKC ───
  ...AKC_DOG_CONFORMATION,
  ...AKC_DOG_OBEDIENCE,
  ...AKC_DOG_AGILITY,
  ...AKC_DOG_RALLY,
  ...AKC_DOG_FIELD,
  ...AKC_DOG_HERDING,
  ...AKC_DOG_TRACKING,
  ...AKC_DOG_COMPANION,
  // ─── Dogs - UKC ───
  ...UKC_DOG_CONFORMATION,
  // ─── Dogs - Breed Club ───
  ...PRODUCING_TITLES,

  // ─── Horses - AQHA (show + racing) ───
  ...AQHA_HORSE_CONFORMATION,
  ...AQHA_HORSE_PERFORMANCE,
  ...AQHA_HORSE_VERSATILITY,
  ...AQHA_HORSE_AMATEUR,
  ...AQHA_RACING_TITLES,
  // ─── Horses - APHA ───
  ...APHA_HORSE_TITLES,
  // ─── Horses - Jockey Club (TB racing + producing) ───
  ...JOCKEY_CLUB_TITLES,
  // ─── Horses - USDF (Dressage) ───
  ...USDF_DRESSAGE_TITLES,
  // ─── Horses - USEA (Eventing) ───
  ...USEA_EVENTING_TITLES,
  // ─── Horses - USHJA (Hunter/Jumper) ───
  ...USHJA_HUNTER_JUMPER_TITLES,
  // ─── Horses - AHA (Arabian) ───
  ...AHA_ARABIAN_TITLES,
  // ─── Horses - AMHA (Morgan) ───
  ...AMHA_MORGAN_TITLES,

  // ─── Cats - TICA ───
  ...TICA_CAT_TITLES,
];

async function main() {
  console.log("Seeding title definitions...");

  // First pass: Create all titles without parent relationships
  const createdTitles = new Map<string, number>(); // key: species_abbreviation_org -> id

  for (const def of ALL_TITLE_DEFINITIONS) {
    const key = `${def.species}_${def.abbreviation}_${def.organization}`;

    const existing = await prisma.titleDefinition.findFirst({
      where: {
        species: def.species,
        abbreviation: def.abbreviation,
        organization: def.organization,
        tenantId: null, // Global definitions only
      },
    });

    if (existing) {
      console.log(`  Skipping ${def.abbreviation} (${def.organization}) - already exists`);
      createdTitles.set(key, existing.id);
      continue;
    }

    const created = await prisma.titleDefinition.create({
      data: {
        tenantId: null, // Global definition
        species: def.species,
        abbreviation: def.abbreviation,
        fullName: def.fullName,
        category: def.category,
        organization: def.organization,
        pointsRequired: def.pointsRequired,
        description: def.description,
        isProducingTitle: def.isProducingTitle ?? false,
        prefixTitle: def.prefixTitle,
        suffixTitle: def.suffixTitle,
        displayOrder: def.displayOrder,
      },
    });

    console.log(`  Created ${def.abbreviation} (${def.organization}) for ${def.species}`);
    createdTitles.set(key, created.id);
  }

  // Second pass: Set up parent relationships
  console.log("\nSetting up title hierarchies...");

  for (const def of ALL_TITLE_DEFINITIONS) {
    if (!def.parentAbbreviation) continue;

    const childKey = `${def.species}_${def.abbreviation}_${def.organization}`;
    const parentKey = `${def.species}_${def.parentAbbreviation}_${def.organization}`;

    const childId = createdTitles.get(childKey);
    const parentId = createdTitles.get(parentKey);

    if (!childId || !parentId) {
      console.log(`  Warning: Could not find parent/child for ${def.abbreviation} -> ${def.parentAbbreviation}`);
      continue;
    }

    // Check if already set
    const child = await prisma.titleDefinition.findUnique({ where: { id: childId } });
    if (child?.parentTitleId === parentId) {
      continue;
    }

    await prisma.titleDefinition.update({
      where: { id: childId },
      data: { parentTitleId: parentId },
    });

    console.log(`  ${def.abbreviation} -> ${def.parentAbbreviation} (${def.organization})`);
  }

  const count = await prisma.titleDefinition.count({ where: { tenantId: null } });
  console.log(`\nDone! ${count} global title definitions in database.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
