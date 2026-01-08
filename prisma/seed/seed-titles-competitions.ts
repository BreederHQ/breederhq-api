// prisma/seed/seed-titles-competitions.ts
// Creates sample titles and competition entries for the test animals.
// This uses existing animals from seed-genetics-test-animals.ts and assigns
// realistic show records to demonstrate the Bloodlines module functionality.
//
// Usage:
//   npm run db:dev:seed:titles-competitions
//
// Or directly:
//   node scripts/run-with-env.js .env.dev.migrate npx tsx prisma/seed/seed-titles-competitions.ts

import "./seed-env-bootstrap";
import {
  PrismaClient,
  Species,
  TitleStatus,
  CompetitionType,
} from "@prisma/client";

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface TitleSeed {
  animalName: string;
  species: Species;
  titleAbbreviation: string;
  organization: string;
  dateEarned: Date;
  status?: TitleStatus;
  pointsEarned?: number;
  majorWins?: number;
  eventName?: string;
  eventLocation?: string;
  handlerName?: string;
  verified?: boolean;
  registryRef?: string;
  notes?: string;
}

interface CompetitionSeed {
  animalName: string;
  species: Species;
  eventName: string;
  eventDate: Date;
  location: string;
  organization: string;
  competitionType: CompetitionType;
  className?: string;
  placement?: number;
  placementLabel?: string;
  pointsEarned?: number;
  isMajorWin?: boolean;
  qualifyingScore?: boolean;
  score?: number;
  scoreMax?: number;
  handlerName?: string;
  judgeName?: string;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAMPLE TITLES
// ═══════════════════════════════════════════════════════════════════════════════

const DOG_TITLES: TitleSeed[] = [
  // Luna - Australian Shepherd (already has Champion)
  {
    animalName: "Luna (Merle Carrier Female)",
    species: Species.DOG,
    titleAbbreviation: "CH",
    organization: "AKC",
    dateEarned: new Date("2024-03-15"),
    status: TitleStatus.VERIFIED,
    pointsEarned: 17,
    majorWins: 3,
    eventName: "Tidewater Kennel Club",
    eventLocation: "Virginia Beach, VA",
    handlerName: "Sarah Mitchell",
    verified: true,
    registryRef: "AKC-2024-CH-45892",
    notes: "Finished championship with a 5-point major!",
  },
  {
    animalName: "Luna (Merle Carrier Female)",
    species: Species.DOG,
    titleAbbreviation: "RN",
    organization: "AKC",
    dateEarned: new Date("2024-06-22"),
    status: TitleStatus.EARNED,
    eventName: "Hampton Roads Obedience Club",
    eventLocation: "Norfolk, VA",
    handlerName: "Luke Skywalker",
  },

  // Maverick - Australian Shepherd
  {
    animalName: "Maverick (Merle Carrier Male)",
    species: Species.DOG,
    titleAbbreviation: "CH",
    organization: "AKC",
    dateEarned: new Date("2023-09-10"),
    status: TitleStatus.VERIFIED,
    pointsEarned: 18,
    majorWins: 2,
    eventName: "Blue Ridge Aussie Specialty",
    eventLocation: "Asheville, NC",
    handlerName: "Sarah Mitchell",
    verified: true,
    registryRef: "AKC-2023-CH-38291",
  },
  {
    animalName: "Maverick (Merle Carrier Male)",
    species: Species.DOG,
    titleAbbreviation: "GCH",
    organization: "AKC",
    dateEarned: new Date("2024-08-05"),
    status: TitleStatus.EARNED,
    pointsEarned: 32,
    eventName: "National Owner-Handled Series Finals",
    eventLocation: "Orlando, FL",
    handlerName: "Luke Skywalker",
    notes: "Owner-handled to Grand Championship!",
  },

  // Bella - Goldendoodle
  {
    animalName: "Bella (Furnished Goldendoodle Dam)",
    species: Species.DOG,
    titleAbbreviation: "CGC",
    organization: "AKC",
    dateEarned: new Date("2022-11-15"),
    status: TitleStatus.VERIFIED,
    eventName: "PetSmart Training",
    eventLocation: "Richmond, VA",
    verified: true,
    registryRef: "AKC-CGC-2022-91823",
  },

  // Max - Labrador
  {
    animalName: "Max (EIC Carrier Lab)",
    species: Species.DOG,
    titleAbbreviation: "CH",
    organization: "AKC",
    dateEarned: new Date("2023-04-20"),
    status: TitleStatus.VERIFIED,
    pointsEarned: 15,
    majorWins: 2,
    eventName: "Labrador Retriever Club Specialty",
    eventLocation: "Gettysburg, PA",
    handlerName: "Tom Henderson",
    verified: true,
    registryRef: "AKC-2023-CH-29384",
  },
  {
    animalName: "Max (EIC Carrier Lab)",
    species: Species.DOG,
    titleAbbreviation: "CD",
    organization: "AKC",
    dateEarned: new Date("2024-02-18"),
    status: TitleStatus.EARNED,
    eventName: "Mid-Atlantic Obedience Trial",
    eventLocation: "Baltimore, MD",
    handlerName: "Luke Skywalker",
    notes: "First obedience title - very proud moment!",
  },

  // Duke - Silver Lab
  {
    animalName: "Duke (Clear Lab Male)",
    species: Species.DOG,
    titleAbbreviation: "GCH",
    organization: "AKC",
    dateEarned: new Date("2022-06-12"),
    status: TitleStatus.VERIFIED,
    pointsEarned: 45,
    eventName: "Westminster Kennel Club",
    eventLocation: "New York, NY",
    handlerName: "Professional Handler - James Worth",
    verified: true,
    registryRef: "AKC-2022-GCH-12093",
    notes: "Select Dog at Westminster!",
  },
  {
    animalName: "Duke (Clear Lab Male)",
    species: Species.DOG,
    titleAbbreviation: "GCHB",
    organization: "AKC",
    dateEarned: new Date("2023-11-08"),
    status: TitleStatus.EARNED,
    pointsEarned: 125,
    eventName: "AKC National Championship",
    eventLocation: "Orlando, FL",
    handlerName: "Professional Handler - James Worth",
  },
];

const HORSE_TITLES: TitleSeed[] = [
  // Painted Lady - Paint Horse
  {
    animalName: "Painted Lady (Frame Overo Mare)",
    species: Species.HORSE,
    titleAbbreviation: "WCH",
    organization: "APHA",
    dateEarned: new Date("2023-10-15"),
    status: TitleStatus.VERIFIED,
    eventName: "APHA World Championship Show",
    eventLocation: "Fort Worth, TX",
    handlerName: "Maria Garcia",
    verified: true,
    registryRef: "APHA-WCH-2023-4521",
    notes: "World Champion Amateur Trail!",
  },
  {
    animalName: "Painted Lady (Frame Overo Mare)",
    species: Species.HORSE,
    titleAbbreviation: "ROM",
    organization: "APHA",
    dateEarned: new Date("2022-08-20"),
    status: TitleStatus.VERIFIED,
    pointsEarned: 18,
    eventName: "Region 1 Championship",
    eventLocation: "Columbus, OH",
    verified: true,
    registryRef: "APHA-ROM-2022-8912",
  },

  // Storm Chaser - Paint Horse
  {
    animalName: "Storm Chaser (Frame Overo Stallion)",
    species: Species.HORSE,
    titleAbbreviation: "Superior",
    organization: "APHA",
    dateEarned: new Date("2022-05-10"),
    status: TitleStatus.VERIFIED,
    pointsEarned: 65,
    eventName: "Various APHA Shows",
    eventLocation: "Nationwide",
    handlerName: "Maria Garcia",
    verified: true,
    registryRef: "APHA-SUP-2022-3892",
    notes: "Superior in Western Pleasure",
  },

  // Impressive Legacy - Quarter Horse
  {
    animalName: "Impressive Legacy (HYPP Carrier QH)",
    species: Species.HORSE,
    titleAbbreviation: "WCH",
    organization: "AQHA",
    dateEarned: new Date("2020-11-18"),
    status: TitleStatus.VERIFIED,
    eventName: "AQHA World Show",
    eventLocation: "Oklahoma City, OK",
    handlerName: "Jessica Williams",
    verified: true,
    registryRef: "AQHA-WCH-2020-12845",
    notes: "World Champion Halter Stallion",
  },
  {
    animalName: "Impressive Legacy (HYPP Carrier QH)",
    species: Species.HORSE,
    titleAbbreviation: "Superior Halter",
    organization: "AQHA",
    dateEarned: new Date("2019-09-05"),
    status: TitleStatus.VERIFIED,
    pointsEarned: 85,
    eventName: "Various AQHA Shows",
    eventLocation: "Nationwide",
    verified: true,
    registryRef: "AQHA-SUP-2019-9128",
  },
];

const CAT_TITLES: TitleSeed[] = [
  // Whiskers - Ragdoll
  {
    animalName: "Whiskers (Pointed Carrier)",
    species: Species.CAT,
    titleAbbreviation: "CH",
    organization: "TICA",
    dateEarned: new Date("2024-01-20"),
    status: TitleStatus.VERIFIED,
    eventName: "TICA Southeast Regional",
    eventLocation: "Atlanta, GA",
    handlerName: "Luke Skywalker",
    verified: true,
    registryRef: "TICA-CH-2024-5891",
  },
  {
    animalName: "Whiskers (Pointed Carrier)",
    species: Species.CAT,
    titleAbbreviation: "GC",
    organization: "TICA",
    dateEarned: new Date("2024-09-14"),
    status: TitleStatus.EARNED,
    eventName: "TICA International Cat Show",
    eventLocation: "Houston, TX",
    handlerName: "Luke Skywalker",
    notes: "Working toward Supreme!",
  },

  // Shadow - Siamese
  {
    animalName: "Shadow (Seal Point Male)",
    species: Species.CAT,
    titleAbbreviation: "CH",
    organization: "TICA",
    dateEarned: new Date("2023-05-12"),
    status: TitleStatus.VERIFIED,
    eventName: "Siamese Cat Club Specialty",
    eventLocation: "Dallas, TX",
    verified: true,
    registryRef: "TICA-CH-2023-4201",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SAMPLE COMPETITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const DOG_COMPETITIONS: CompetitionSeed[] = [
  // Luna's show career
  {
    animalName: "Luna (Merle Carrier Female)",
    species: Species.DOG,
    eventName: "Tidewater Kennel Club",
    eventDate: new Date("2024-03-15"),
    location: "Virginia Beach, VA",
    organization: "AKC",
    competitionType: CompetitionType.CONFORMATION_SHOW,
    className: "Open Bitches",
    placement: 1,
    placementLabel: "Winners Bitch",
    pointsEarned: 5,
    isMajorWin: true,
    handlerName: "Sarah Mitchell",
    judgeName: "Dr. Robert Cole",
    notes: "Championship-finishing win!",
  },
  {
    animalName: "Luna (Merle Carrier Female)",
    species: Species.DOG,
    eventName: "Norfolk Kennel Club",
    eventDate: new Date("2024-02-20"),
    location: "Norfolk, VA",
    organization: "AKC",
    competitionType: CompetitionType.CONFORMATION_SHOW,
    className: "Open Bitches",
    placement: 1,
    placementLabel: "Winners Bitch",
    pointsEarned: 4,
    isMajorWin: true,
    handlerName: "Sarah Mitchell",
    judgeName: "Patricia Hastings",
  },
  {
    animalName: "Luna (Merle Carrier Female)",
    species: Species.DOG,
    eventName: "Hampton Roads Obedience Club",
    eventDate: new Date("2024-06-22"),
    location: "Norfolk, VA",
    organization: "AKC",
    competitionType: CompetitionType.RALLY_TRIAL,
    className: "Rally Novice",
    placement: 1,
    score: 98,
    scoreMax: 100,
    qualifyingScore: true,
    handlerName: "Luke Skywalker",
    judgeName: "Karen Smith",
    notes: "Third leg for RN title!",
  },
  {
    animalName: "Luna (Merle Carrier Female)",
    species: Species.DOG,
    eventName: "Chesapeake Agility Club",
    eventDate: new Date("2024-07-15"),
    location: "Richmond, VA",
    organization: "AKC",
    competitionType: CompetitionType.AGILITY_TRIAL,
    className: "Novice Standard",
    qualifyingScore: true,
    score: 32.5, // time in seconds
    handlerName: "Luke Skywalker",
    judgeName: "Michael Brown",
    notes: "Clean run! Starting agility journey.",
  },

  // Maverick's show career
  {
    animalName: "Maverick (Merle Carrier Male)",
    species: Species.DOG,
    eventName: "Blue Ridge Aussie Specialty",
    eventDate: new Date("2023-09-10"),
    location: "Asheville, NC",
    organization: "AKC",
    competitionType: CompetitionType.BREED_SPECIALTY,
    className: "Open Dogs",
    placement: 1,
    placementLabel: "Winners Dog / Best of Winners",
    pointsEarned: 5,
    isMajorWin: true,
    handlerName: "Sarah Mitchell",
    judgeName: "Breed Specialist - Linda Davis",
    notes: "Specialty win finished his championship!",
  },
  {
    animalName: "Maverick (Merle Carrier Male)",
    species: Species.DOG,
    eventName: "Greensboro Kennel Club",
    eventDate: new Date("2024-04-12"),
    location: "Greensboro, NC",
    organization: "AKC",
    competitionType: CompetitionType.CONFORMATION_SHOW,
    className: "Best of Breed",
    placement: 1,
    placementLabel: "Best of Breed",
    pointsEarned: 3,
    handlerName: "Luke Skywalker",
    judgeName: "Richard Thompson",
    notes: "Owner-handled BOB! Starting GCH journey.",
  },

  // Max - Labrador obedience
  {
    animalName: "Max (EIC Carrier Lab)",
    species: Species.DOG,
    eventName: "Mid-Atlantic Obedience Trial",
    eventDate: new Date("2024-02-18"),
    location: "Baltimore, MD",
    organization: "AKC",
    competitionType: CompetitionType.OBEDIENCE_TRIAL,
    className: "Novice B",
    placement: 2,
    placementLabel: "High in Trial Runnerup",
    score: 197.5,
    scoreMax: 200,
    qualifyingScore: true,
    handlerName: "Luke Skywalker",
    judgeName: "Sandra Wilson",
    notes: "Third qualifying score - CD earned!",
  },
  {
    animalName: "Max (EIC Carrier Lab)",
    species: Species.DOG,
    eventName: "Labrador Retriever Club Specialty",
    eventDate: new Date("2023-04-20"),
    location: "Gettysburg, PA",
    organization: "AKC",
    competitionType: CompetitionType.BREED_SPECIALTY,
    className: "Open Dogs",
    placement: 1,
    placementLabel: "Winners Dog",
    pointsEarned: 4,
    isMajorWin: true,
    handlerName: "Tom Henderson",
    judgeName: "Lab Specialist - James Chen",
  },

  // Duke - Grand Champion career
  {
    animalName: "Duke (Clear Lab Male)",
    species: Species.DOG,
    eventName: "Westminster Kennel Club",
    eventDate: new Date("2022-06-12"),
    location: "New York, NY",
    organization: "AKC",
    competitionType: CompetitionType.CONFORMATION_SHOW,
    className: "Best of Breed",
    placement: 1,
    placementLabel: "Select Dog",
    pointsEarned: 5,
    handlerName: "James Worth",
    judgeName: "Dr. Steven Herman",
    notes: "Select Dog at Westminster - career highlight!",
  },
  {
    animalName: "Duke (Clear Lab Male)",
    species: Species.DOG,
    eventName: "AKC National Championship",
    eventDate: new Date("2023-11-08"),
    location: "Orlando, FL",
    organization: "AKC",
    competitionType: CompetitionType.CONFORMATION_SHOW,
    className: "Best of Breed",
    placement: 1,
    placementLabel: "Best of Breed",
    pointsEarned: 25,
    handlerName: "James Worth",
    judgeName: "Patricia Trotter",
    notes: "BOB at the National! Earned GCHB.",
  },
];

const HORSE_COMPETITIONS: CompetitionSeed[] = [
  // Painted Lady - Show career
  {
    animalName: "Painted Lady (Frame Overo Mare)",
    species: Species.HORSE,
    eventName: "APHA World Championship Show",
    eventDate: new Date("2023-10-15"),
    location: "Fort Worth, TX",
    organization: "APHA",
    competitionType: CompetitionType.CONFORMATION_SHOW,
    className: "Amateur Trail",
    placement: 1,
    placementLabel: "World Champion",
    pointsEarned: 50,
    handlerName: "Maria Garcia",
    judgeName: "World Show Panel",
    notes: "World Champion in Amateur Trail!",
  },
  {
    animalName: "Painted Lady (Frame Overo Mare)",
    species: Species.HORSE,
    eventName: "APHA Zone 3 Championship",
    eventDate: new Date("2023-06-20"),
    location: "Columbus, OH",
    organization: "APHA",
    competitionType: CompetitionType.PERFORMANCE_TEST,
    className: "Trail",
    placement: 1,
    placementLabel: "Zone Champion",
    pointsEarned: 15,
    handlerName: "Maria Garcia",
  },
  {
    animalName: "Painted Lady (Frame Overo Mare)",
    species: Species.HORSE,
    eventName: "Paint Horse Breeders Cup",
    eventDate: new Date("2024-05-10"),
    location: "Oklahoma City, OK",
    organization: "APHA",
    competitionType: CompetitionType.PERFORMANCE_TEST,
    className: "Amateur Western Pleasure",
    placement: 2,
    placementLabel: "Reserve Champion",
    pointsEarned: 8,
    handlerName: "Maria Garcia",
    notes: "Close second to the World Champion mare.",
  },

  // Storm Chaser - Show career
  {
    animalName: "Storm Chaser (Frame Overo Stallion)",
    species: Species.HORSE,
    eventName: "APHA Nationals",
    eventDate: new Date("2022-05-10"),
    location: "Fort Worth, TX",
    organization: "APHA",
    competitionType: CompetitionType.CONFORMATION_SHOW,
    className: "Amateur Western Pleasure",
    placement: 1,
    placementLabel: "National Champion",
    pointsEarned: 25,
    handlerName: "Maria Garcia",
    judgeName: "National Panel",
  },

  // Impressive Legacy - AQHA career
  {
    animalName: "Impressive Legacy (HYPP Carrier QH)",
    species: Species.HORSE,
    eventName: "AQHA World Show",
    eventDate: new Date("2020-11-18"),
    location: "Oklahoma City, OK",
    organization: "AQHA",
    competitionType: CompetitionType.CONFORMATION_SHOW,
    className: "Open Halter Stallions",
    placement: 1,
    placementLabel: "World Champion",
    pointsEarned: 100,
    handlerName: "Jessica Williams",
    judgeName: "World Show Panel",
    notes: "World Champion Halter Stallion - incredible achievement!",
  },
  {
    animalName: "Impressive Legacy (HYPP Carrier QH)",
    species: Species.HORSE,
    eventName: "AQHA World Show",
    eventDate: new Date("2021-11-15"),
    location: "Oklahoma City, OK",
    organization: "AQHA",
    competitionType: CompetitionType.CONFORMATION_SHOW,
    className: "Open Halter Stallions",
    placement: 2,
    placementLabel: "Reserve World Champion",
    pointsEarned: 75,
    handlerName: "Jessica Williams",
    notes: "Defending title - came in Reserve.",
  },
];

const CAT_COMPETITIONS: CompetitionSeed[] = [
  // Whiskers - Ragdoll shows
  {
    animalName: "Whiskers (Pointed Carrier)",
    species: Species.CAT,
    eventName: "TICA Southeast Regional",
    eventDate: new Date("2024-01-20"),
    location: "Atlanta, GA",
    organization: "TICA",
    competitionType: CompetitionType.CONFORMATION_SHOW,
    className: "Championship",
    placement: 1,
    placementLabel: "Best Ragdoll",
    handlerName: "Luke Skywalker",
    judgeName: "Multiple Allbreed Judges",
    notes: "Earned Champion title!",
  },
  {
    animalName: "Whiskers (Pointed Carrier)",
    species: Species.CAT,
    eventName: "TICA International Cat Show",
    eventDate: new Date("2024-09-14"),
    location: "Houston, TX",
    organization: "TICA",
    competitionType: CompetitionType.CONFORMATION_SHOW,
    className: "Grand Championship",
    placement: 3,
    placementLabel: "3rd Best Allbreed",
    handlerName: "Luke Skywalker",
    notes: "Working toward Grand Champion!",
  },

  // Shadow - Siamese shows
  {
    animalName: "Shadow (Seal Point Male)",
    species: Species.CAT,
    eventName: "Siamese Cat Club Specialty",
    eventDate: new Date("2023-05-12"),
    location: "Dallas, TX",
    organization: "TICA",
    competitionType: CompetitionType.BREED_SPECIALTY,
    className: "Championship",
    placement: 1,
    placementLabel: "Best Siamese",
    notes: "Specialty win - finished Championship!",
  },
  {
    animalName: "Shadow (Seal Point Male)",
    species: Species.CAT,
    eventName: "TICA Southwest Regional",
    eventDate: new Date("2023-08-20"),
    location: "Phoenix, AZ",
    organization: "TICA",
    competitionType: CompetitionType.CONFORMATION_SHOW,
    className: "Grand Championship",
    placement: 5,
    placementLabel: "5th Best Allbreed",
    notes: "Good points toward Grand!",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("🏆 Starting Titles & Competitions seed...\n");

  // Find Luke Skywalker's tenant
  const lukeUser = await prisma.user.findFirst({
    where: { email: "luke.skywalker@tester.local" },
  });

  if (!lukeUser) {
    console.log("❌ luke.skywalker@tester.local user not found!");
    console.log("Please run seed-genetics-test-animals.ts first.");
    process.exit(1);
  }

  const lukeMembership = await prisma.tenantMembership.findFirst({
    where: { userId: lukeUser.id },
    include: { tenant: true },
  });

  if (!lukeMembership) {
    console.log("❌ Luke Skywalker has no tenant membership!");
    process.exit(1);
  }

  const tenantId = lukeMembership.tenant.id;
  console.log(
    `✓ Found Luke's tenant: ${lukeMembership.tenant.name} (ID: ${tenantId})\n`
  );

  // Combine all titles and competitions
  const allTitles: TitleSeed[] = [...DOG_TITLES, ...HORSE_TITLES, ...CAT_TITLES];
  const allCompetitions: CompetitionSeed[] = [
    ...DOG_COMPETITIONS,
    ...HORSE_COMPETITIONS,
    ...CAT_COMPETITIONS,
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // SEED TITLES
  // ─────────────────────────────────────────────────────────────────────────────

  console.log(`📜 Creating ${allTitles.length} title records...\n`);

  let titlesCreated = 0;
  let titlesSkipped = 0;

  for (const titleSeed of allTitles) {
    // Find the animal
    const animal = await prisma.animal.findFirst({
      where: {
        tenantId,
        name: titleSeed.animalName,
        species: titleSeed.species,
      },
    });

    if (!animal) {
      console.log(
        `⚠️  Animal not found: ${titleSeed.animalName} (${titleSeed.species})`
      );
      titlesSkipped++;
      continue;
    }

    // Find the title definition
    const titleDef = await prisma.titleDefinition.findFirst({
      where: {
        abbreviation: titleSeed.titleAbbreviation,
        organization: titleSeed.organization,
        species: titleSeed.species,
      },
    });

    if (!titleDef) {
      console.log(
        `⚠️  Title definition not found: ${titleSeed.titleAbbreviation} (${titleSeed.organization})`
      );
      titlesSkipped++;
      continue;
    }

    // Check if already exists
    const existing = await prisma.animalTitle.findUnique({
      where: {
        animalId_titleDefinitionId: {
          animalId: animal.id,
          titleDefinitionId: titleDef.id,
        },
      },
    });

    if (existing) {
      console.log(
        `⏭️  Skipped (exists): ${titleSeed.animalName} - ${titleSeed.titleAbbreviation}`
      );
      titlesSkipped++;
      continue;
    }

    // Create the title
    await prisma.animalTitle.create({
      data: {
        tenantId,
        animalId: animal.id,
        titleDefinitionId: titleDef.id,
        dateEarned: titleSeed.dateEarned,
        status: titleSeed.status ?? TitleStatus.EARNED,
        pointsEarned: titleSeed.pointsEarned,
        majorWins: titleSeed.majorWins,
        eventName: titleSeed.eventName,
        eventLocation: titleSeed.eventLocation,
        handlerName: titleSeed.handlerName,
        verified: titleSeed.verified ?? false,
        registryRef: titleSeed.registryRef,
        notes: titleSeed.notes,
      },
    });

    console.log(
      `✅ Created: ${titleSeed.animalName} - ${titleSeed.titleAbbreviation}`
    );
    titlesCreated++;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SEED COMPETITIONS
  // ─────────────────────────────────────────────────────────────────────────────

  console.log(`\n🎪 Creating ${allCompetitions.length} competition entries...\n`);

  let competitionsCreated = 0;
  let competitionsSkipped = 0;

  for (const compSeed of allCompetitions) {
    // Find the animal
    const animal = await prisma.animal.findFirst({
      where: {
        tenantId,
        name: compSeed.animalName,
        species: compSeed.species,
      },
    });

    if (!animal) {
      console.log(
        `⚠️  Animal not found: ${compSeed.animalName} (${compSeed.species})`
      );
      competitionsSkipped++;
      continue;
    }

    // Check if already exists (same animal, event, date)
    const existing = await prisma.competitionEntry.findFirst({
      where: {
        animalId: animal.id,
        eventName: compSeed.eventName,
        eventDate: compSeed.eventDate,
      },
    });

    if (existing) {
      console.log(
        `⏭️  Skipped (exists): ${compSeed.animalName} - ${compSeed.eventName}`
      );
      competitionsSkipped++;
      continue;
    }

    // Create the competition entry
    await prisma.competitionEntry.create({
      data: {
        tenantId,
        animalId: animal.id,
        eventName: compSeed.eventName,
        eventDate: compSeed.eventDate,
        location: compSeed.location,
        organization: compSeed.organization,
        competitionType: compSeed.competitionType,
        className: compSeed.className,
        placement: compSeed.placement,
        placementLabel: compSeed.placementLabel,
        pointsEarned: compSeed.pointsEarned,
        isMajorWin: compSeed.isMajorWin ?? false,
        qualifyingScore: compSeed.qualifyingScore ?? false,
        score: compSeed.score,
        scoreMax: compSeed.scoreMax,
        handlerName: compSeed.handlerName,
        judgeName: compSeed.judgeName,
        notes: compSeed.notes,
      },
    });

    console.log(`✅ Created: ${compSeed.animalName} - ${compSeed.eventName}`);
    competitionsCreated++;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────

  console.log("\n" + "═".repeat(70));
  console.log("🎉 Titles & Competitions seed completed!");
  console.log("═".repeat(70));
  console.log(`\n📜 TITLES:`);
  console.log(`   Created: ${titlesCreated}`);
  console.log(`   Skipped: ${titlesSkipped}`);
  console.log(`\n🎪 COMPETITIONS:`);
  console.log(`   Created: ${competitionsCreated}`);
  console.log(`   Skipped: ${competitionsSkipped}`);

  console.log("\n📋 SAMPLE DATA OVERVIEW:");
  console.log("─".repeat(70));
  console.log("🐕 DOGS:");
  console.log("   • Luna (Aussie) - CH, RN, active in conformation & rally");
  console.log("   • Maverick (Aussie) - CH, GCH, specialty winner");
  console.log("   • Max (Lab) - CH, CD, dual-purpose show & obedience");
  console.log("   • Duke (Lab) - GCHB, Westminster Select Dog!");
  console.log("");
  console.log("🐴 HORSES:");
  console.log("   • Painted Lady (Paint) - APHA World Champion Trail");
  console.log("   • Storm Chaser (Paint) - APHA Superior Western Pleasure");
  console.log("   • Impressive Legacy (QH) - AQHA World Champion Halter");
  console.log("");
  console.log("🐱 CATS:");
  console.log("   • Whiskers (Ragdoll) - TICA CH, working on GC");
  console.log("   • Shadow (Siamese) - TICA CH, specialty winner");
  console.log("─".repeat(70));
  console.log(
    "\n💡 Login as luke.skywalker@tester.local to view in Bloodlines module\n"
  );
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
