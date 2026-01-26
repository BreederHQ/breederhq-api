// scripts/seed-validation-tenants/seed-title-definitions.ts
// Seeds global title definitions for all species.
// These are system-wide definitions that can be referenced when creating animal titles.
//
// Usage:
//   npx tsx scripts/seed-validation-tenants/seed-title-definitions.ts

import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient, Species, TitleCategory } from '@prisma/client';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);

// ═══════════════════════════════════════════════════════════════════════════════
// TITLE DEFINITION INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

interface TitleDefinitionSeed {
  species: Species;
  abbreviation: string;
  fullName: string;
  category: TitleCategory;
  organization?: string;
  prefixTitle: boolean;
  suffixTitle: boolean;
  displayOrder: number;
  isProducingTitle?: boolean;
  parentTitleAbbrev?: string; // Reference to parent title by abbreviation
  pointsRequired?: number;
  description?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOG TITLES (AKC/UKC)
// ═══════════════════════════════════════════════════════════════════════════════

const DOG_TITLES: TitleDefinitionSeed[] = [
  // === CONFORMATION ===
  { species: 'DOG', abbreviation: 'CH', fullName: 'Champion', category: 'CONFORMATION', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 10, pointsRequired: 15, description: '15 points including 2 majors under different judges' },
  { species: 'DOG', abbreviation: 'GCH', fullName: 'Grand Champion', category: 'CONFORMATION', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 20, parentTitleAbbrev: 'CH', pointsRequired: 25, description: '25 GCH points including 3 majors' },
  { species: 'DOG', abbreviation: 'GCHB', fullName: 'Grand Champion Bronze', category: 'CONFORMATION', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 30, parentTitleAbbrev: 'GCH', pointsRequired: 100 },
  { species: 'DOG', abbreviation: 'GCHS', fullName: 'Grand Champion Silver', category: 'CONFORMATION', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 40, parentTitleAbbrev: 'GCHB', pointsRequired: 200 },
  { species: 'DOG', abbreviation: 'GCHG', fullName: 'Grand Champion Gold', category: 'CONFORMATION', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 50, parentTitleAbbrev: 'GCHS', pointsRequired: 400 },
  { species: 'DOG', abbreviation: 'GCHP', fullName: 'Grand Champion Platinum', category: 'CONFORMATION', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 60, parentTitleAbbrev: 'GCHG', pointsRequired: 800 },

  // === OBEDIENCE ===
  { species: 'DOG', abbreviation: 'CD', fullName: 'Companion Dog', category: 'OBEDIENCE', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 100, description: '3 qualifying scores of 170+ in Novice' },
  { species: 'DOG', abbreviation: 'CDX', fullName: 'Companion Dog Excellent', category: 'OBEDIENCE', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 110, parentTitleAbbrev: 'CD' },
  { species: 'DOG', abbreviation: 'UD', fullName: 'Utility Dog', category: 'OBEDIENCE', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 120, parentTitleAbbrev: 'CDX' },
  { species: 'DOG', abbreviation: 'UDX', fullName: 'Utility Dog Excellent', category: 'OBEDIENCE', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 130, parentTitleAbbrev: 'UD' },
  { species: 'DOG', abbreviation: 'OTCH', fullName: 'Obedience Trial Champion', category: 'OBEDIENCE', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 5, parentTitleAbbrev: 'UDX', description: '100 points including 3 first places' },

  // === AGILITY ===
  { species: 'DOG', abbreviation: 'NA', fullName: 'Novice Agility', category: 'AGILITY', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 200 },
  { species: 'DOG', abbreviation: 'NAJ', fullName: 'Novice Agility Jumpers', category: 'AGILITY', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 201 },
  { species: 'DOG', abbreviation: 'OA', fullName: 'Open Agility', category: 'AGILITY', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 210, parentTitleAbbrev: 'NA' },
  { species: 'DOG', abbreviation: 'OAJ', fullName: 'Open Agility Jumpers', category: 'AGILITY', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 211, parentTitleAbbrev: 'NAJ' },
  { species: 'DOG', abbreviation: 'AX', fullName: 'Agility Excellent', category: 'AGILITY', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 220, parentTitleAbbrev: 'OA' },
  { species: 'DOG', abbreviation: 'AXJ', fullName: 'Agility Excellent Jumpers', category: 'AGILITY', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 221, parentTitleAbbrev: 'OAJ' },
  { species: 'DOG', abbreviation: 'MX', fullName: 'Master Agility Excellent', category: 'AGILITY', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 230, parentTitleAbbrev: 'AX' },
  { species: 'DOG', abbreviation: 'MXJ', fullName: 'Master Agility Excellent Jumpers', category: 'AGILITY', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 231, parentTitleAbbrev: 'AXJ' },
  { species: 'DOG', abbreviation: 'MACH', fullName: 'Master Agility Champion', category: 'AGILITY', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 4, description: '750 speed points + 20 double-Qs' },
  { species: 'DOG', abbreviation: 'MACH2', fullName: 'Master Agility Champion 2', category: 'AGILITY', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 3, parentTitleAbbrev: 'MACH' },
  { species: 'DOG', abbreviation: 'PACH', fullName: 'Preferred Agility Champion', category: 'AGILITY', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 6 },

  // === RALLY ===
  { species: 'DOG', abbreviation: 'RN', fullName: 'Rally Novice', category: 'RALLY', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 300 },
  { species: 'DOG', abbreviation: 'RA', fullName: 'Rally Advanced', category: 'RALLY', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 310, parentTitleAbbrev: 'RN' },
  { species: 'DOG', abbreviation: 'RE', fullName: 'Rally Excellent', category: 'RALLY', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 320, parentTitleAbbrev: 'RA' },
  { species: 'DOG', abbreviation: 'RAE', fullName: 'Rally Advanced Excellent', category: 'RALLY', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 330, parentTitleAbbrev: 'RE' },
  { species: 'DOG', abbreviation: 'RAE2', fullName: 'Rally Advanced Excellent 2', category: 'RALLY', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 340, parentTitleAbbrev: 'RAE' },
  { species: 'DOG', abbreviation: 'RACH', fullName: 'Rally Champion', category: 'RALLY', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 7 },

  // === FIELD ===
  { species: 'DOG', abbreviation: 'JH', fullName: 'Junior Hunter', category: 'FIELD', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 400 },
  { species: 'DOG', abbreviation: 'SH', fullName: 'Senior Hunter', category: 'FIELD', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 410, parentTitleAbbrev: 'JH' },
  { species: 'DOG', abbreviation: 'MH', fullName: 'Master Hunter', category: 'FIELD', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 420, parentTitleAbbrev: 'SH' },
  { species: 'DOG', abbreviation: 'AFC', fullName: 'Amateur Field Champion', category: 'FIELD', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 2 },
  { species: 'DOG', abbreviation: 'FC', fullName: 'Field Champion', category: 'FIELD', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 1 },
  { species: 'DOG', abbreviation: 'NFC', fullName: 'National Field Champion', category: 'FIELD', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 0 },

  // === HERDING ===
  { species: 'DOG', abbreviation: 'HT', fullName: 'Herding Tested', category: 'HERDING', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 500 },
  { species: 'DOG', abbreviation: 'PT', fullName: 'Pre-Trial Tested', category: 'HERDING', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 510, parentTitleAbbrev: 'HT' },
  { species: 'DOG', abbreviation: 'HS', fullName: 'Herding Started', category: 'HERDING', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 520 },
  { species: 'DOG', abbreviation: 'HI', fullName: 'Herding Intermediate', category: 'HERDING', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 530, parentTitleAbbrev: 'HS' },
  { species: 'DOG', abbreviation: 'HX', fullName: 'Herding Excellent', category: 'HERDING', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 540, parentTitleAbbrev: 'HI' },
  { species: 'DOG', abbreviation: 'HC', fullName: 'Herding Champion', category: 'HERDING', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 8 },

  // === TRACKING ===
  { species: 'DOG', abbreviation: 'TD', fullName: 'Tracking Dog', category: 'TRACKING', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 600 },
  { species: 'DOG', abbreviation: 'TDX', fullName: 'Tracking Dog Excellent', category: 'TRACKING', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 610, parentTitleAbbrev: 'TD' },
  { species: 'DOG', abbreviation: 'VST', fullName: 'Variable Surface Tracker', category: 'TRACKING', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 620 },
  { species: 'DOG', abbreviation: 'CT', fullName: 'Champion Tracker', category: 'TRACKING', organization: 'AKC', prefixTitle: true, suffixTitle: false, displayOrder: 9, description: 'TD + TDX + VST' },

  // === PRODUCING ===
  { species: 'DOG', abbreviation: 'ROM', fullName: 'Register of Merit', category: 'PRODUCING', organization: 'Breed Club', prefixTitle: false, suffixTitle: true, displayOrder: 700, isProducingTitle: true },
  { species: 'DOG', abbreviation: 'ROMX', fullName: 'Register of Merit Excellent', category: 'PRODUCING', organization: 'Breed Club', prefixTitle: false, suffixTitle: true, displayOrder: 710, isProducingTitle: true, parentTitleAbbrev: 'ROM' },

  // === BREED SPECIFIC (CGC/Therapy) ===
  { species: 'DOG', abbreviation: 'CGC', fullName: 'Canine Good Citizen', category: 'OTHER', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 800 },
  { species: 'DOG', abbreviation: 'CGCA', fullName: 'Canine Good Citizen Advanced', category: 'OTHER', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 810, parentTitleAbbrev: 'CGC' },
  { species: 'DOG', abbreviation: 'CGCU', fullName: 'Canine Good Citizen Urban', category: 'OTHER', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 820, parentTitleAbbrev: 'CGCA' },
  { species: 'DOG', abbreviation: 'TKN', fullName: 'Trick Dog Novice', category: 'OTHER', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 850 },
  { species: 'DOG', abbreviation: 'TKI', fullName: 'Trick Dog Intermediate', category: 'OTHER', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 860, parentTitleAbbrev: 'TKN' },
  { species: 'DOG', abbreviation: 'TKA', fullName: 'Trick Dog Advanced', category: 'OTHER', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 870, parentTitleAbbrev: 'TKI' },
  { species: 'DOG', abbreviation: 'TKP', fullName: 'Trick Dog Performer', category: 'OTHER', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 880, parentTitleAbbrev: 'TKA' },
  { species: 'DOG', abbreviation: 'TKE', fullName: 'Trick Dog Elite Performer', category: 'OTHER', organization: 'AKC', prefixTitle: false, suffixTitle: true, displayOrder: 890, parentTitleAbbrev: 'TKP' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CAT TITLES (TICA/CFA)
// ═══════════════════════════════════════════════════════════════════════════════

const CAT_TITLES: TitleDefinitionSeed[] = [
  // === TICA CONFORMATION ===
  { species: 'CAT', abbreviation: 'CH', fullName: 'Champion', category: 'CONFORMATION', organization: 'TICA', prefixTitle: true, suffixTitle: false, displayOrder: 10, pointsRequired: 200 },
  { species: 'CAT', abbreviation: 'GC', fullName: 'Grand Champion', category: 'CONFORMATION', organization: 'TICA', prefixTitle: true, suffixTitle: false, displayOrder: 20, parentTitleAbbrev: 'CH', pointsRequired: 1000 },
  { species: 'CAT', abbreviation: 'DGC', fullName: 'Double Grand Champion', category: 'CONFORMATION', organization: 'TICA', prefixTitle: true, suffixTitle: false, displayOrder: 30, parentTitleAbbrev: 'GC', pointsRequired: 2000 },
  { species: 'CAT', abbreviation: 'TGC', fullName: 'Triple Grand Champion', category: 'CONFORMATION', organization: 'TICA', prefixTitle: true, suffixTitle: false, displayOrder: 40, parentTitleAbbrev: 'DGC', pointsRequired: 3000 },
  { species: 'CAT', abbreviation: 'QGC', fullName: 'Quadruple Grand Champion', category: 'CONFORMATION', organization: 'TICA', prefixTitle: true, suffixTitle: false, displayOrder: 50, parentTitleAbbrev: 'TGC', pointsRequired: 4000 },
  { species: 'CAT', abbreviation: 'SGC', fullName: 'Supreme Grand Champion', category: 'CONFORMATION', organization: 'TICA', prefixTitle: true, suffixTitle: false, displayOrder: 60, parentTitleAbbrev: 'QGC', pointsRequired: 6000 },

  // === CFA CONFORMATION ===
  { species: 'CAT', abbreviation: 'CFA CH', fullName: 'CFA Champion', category: 'CONFORMATION', organization: 'CFA', prefixTitle: true, suffixTitle: false, displayOrder: 15 },
  { species: 'CAT', abbreviation: 'CFA GC', fullName: 'CFA Grand Champion', category: 'CONFORMATION', organization: 'CFA', prefixTitle: true, suffixTitle: false, displayOrder: 25, parentTitleAbbrev: 'CFA CH' },
  { species: 'CAT', abbreviation: 'NW', fullName: 'National Winner', category: 'CONFORMATION', organization: 'CFA', prefixTitle: false, suffixTitle: true, displayOrder: 100 },
  { species: 'CAT', abbreviation: 'BW', fullName: 'Breed Winner', category: 'CONFORMATION', organization: 'CFA', prefixTitle: false, suffixTitle: true, displayOrder: 110 },
  { species: 'CAT', abbreviation: 'DW', fullName: 'Division Winner', category: 'CONFORMATION', organization: 'CFA', prefixTitle: false, suffixTitle: true, displayOrder: 120 },

  // === TICA Regional/National Awards ===
  { species: 'CAT', abbreviation: 'RW', fullName: 'Regional Winner', category: 'CONFORMATION', organization: 'TICA', prefixTitle: false, suffixTitle: true, displayOrder: 200 },
  { species: 'CAT', abbreviation: 'IW', fullName: 'International Winner', category: 'CONFORMATION', organization: 'TICA', prefixTitle: false, suffixTitle: true, displayOrder: 210 },

  // === PRODUCING ===
  { species: 'CAT', abbreviation: 'DM', fullName: 'Distinguished Merit', category: 'PRODUCING', organization: 'TICA', prefixTitle: false, suffixTitle: true, displayOrder: 300, isProducingTitle: true, description: 'Dam with 5 or more grand offspring, Sire with 10 or more' },
  { species: 'CAT', abbreviation: 'OS', fullName: 'Outstanding Sire', category: 'PRODUCING', organization: 'TICA', prefixTitle: false, suffixTitle: true, displayOrder: 310, isProducingTitle: true },
  { species: 'CAT', abbreviation: 'OD', fullName: 'Outstanding Dam', category: 'PRODUCING', organization: 'TICA', prefixTitle: false, suffixTitle: true, displayOrder: 320, isProducingTitle: true },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HORSE TITLES (AQHA/APHA/USDF/USHJA)
// ═══════════════════════════════════════════════════════════════════════════════

const HORSE_TITLES: TitleDefinitionSeed[] = [
  // === GENERIC CONFORMATION (for breeds without specific org) ===
  { species: 'HORSE', abbreviation: 'CH', fullName: 'Champion', category: 'CONFORMATION', prefixTitle: true, suffixTitle: false, displayOrder: 18, description: 'Generic breed champion' },
  { species: 'HORSE', abbreviation: 'GCH', fullName: 'Grand Champion', category: 'CONFORMATION', prefixTitle: true, suffixTitle: false, displayOrder: 8, parentTitleAbbrev: 'CH' },
  { species: 'HORSE', abbreviation: 'SCH', fullName: 'Supreme Champion', category: 'CONFORMATION', prefixTitle: true, suffixTitle: false, displayOrder: 3, parentTitleAbbrev: 'GCH' },

  // === AQHA HALTER/CONFORMATION ===
  { species: 'HORSE', abbreviation: 'AQHA CH', fullName: 'AQHA Champion', category: 'CONFORMATION', organization: 'AQHA', prefixTitle: true, suffixTitle: false, displayOrder: 10, description: '25 halter pts + 35 perf pts OR 50 halter pts' },
  { species: 'HORSE', abbreviation: 'AQHA SP CH', fullName: 'AQHA Supreme Champion', category: 'CONFORMATION', organization: 'AQHA', prefixTitle: true, suffixTitle: false, displayOrder: 5, parentTitleAbbrev: 'AQHA CH' },
  { species: 'HORSE', abbreviation: 'WC', fullName: 'World Champion', category: 'CONFORMATION', organization: 'AQHA', prefixTitle: true, suffixTitle: false, displayOrder: 1 },
  { species: 'HORSE', abbreviation: 'RC', fullName: 'Reserve World Champion', category: 'CONFORMATION', organization: 'AQHA', prefixTitle: true, suffixTitle: false, displayOrder: 2 },

  // === AQHA PERFORMANCE ===
  { species: 'HORSE', abbreviation: 'ROM', fullName: 'Register of Merit', category: 'PERFORMANCE', organization: 'AQHA', prefixTitle: false, suffixTitle: true, displayOrder: 100, description: '10+ performance points in approved events' },
  { species: 'HORSE', abbreviation: 'ROMH', fullName: 'Register of Merit Halter', category: 'CONFORMATION', organization: 'AQHA', prefixTitle: false, suffixTitle: true, displayOrder: 110 },
  { species: 'HORSE', abbreviation: 'SP', fullName: 'Superior Performance', category: 'PERFORMANCE', organization: 'AQHA', prefixTitle: false, suffixTitle: true, displayOrder: 120, pointsRequired: 50 },
  { species: 'HORSE', abbreviation: 'SH', fullName: 'Superior Halter', category: 'CONFORMATION', organization: 'AQHA', prefixTitle: false, suffixTitle: true, displayOrder: 130 },

  // === APHA CONFORMATION ===
  { species: 'HORSE', abbreviation: 'APHA CH', fullName: 'APHA Champion', category: 'CONFORMATION', organization: 'APHA', prefixTitle: true, suffixTitle: false, displayOrder: 15 },
  { species: 'HORSE', abbreviation: 'APHA SP CH', fullName: 'APHA Supreme Champion', category: 'CONFORMATION', organization: 'APHA', prefixTitle: true, suffixTitle: false, displayOrder: 6 },

  // === RACING ===
  { species: 'HORSE', abbreviation: 'SI', fullName: 'Speed Index', category: 'PERFORMANCE', organization: 'AQHA Racing', prefixTitle: false, suffixTitle: true, displayOrder: 200, description: 'Speed Index rating for racing performance' },
  { species: 'HORSE', abbreviation: 'AAA', fullName: 'Triple-A Racing', category: 'PERFORMANCE', organization: 'AQHA Racing', prefixTitle: false, suffixTitle: true, displayOrder: 210, description: 'Speed Index of 95+' },
  { species: 'HORSE', abbreviation: 'AAAT', fullName: 'Triple-A Racing Top', category: 'PERFORMANCE', organization: 'AQHA Racing', prefixTitle: false, suffixTitle: true, displayOrder: 220, description: 'Speed Index of 100+' },

  // === USDF DRESSAGE ===
  { species: 'HORSE', abbreviation: 'Bronze', fullName: 'USDF Bronze Medal', category: 'PERFORMANCE', organization: 'USDF', prefixTitle: false, suffixTitle: true, displayOrder: 300, description: 'Training-First Level scores' },
  { species: 'HORSE', abbreviation: 'Silver', fullName: 'USDF Silver Medal', category: 'PERFORMANCE', organization: 'USDF', prefixTitle: false, suffixTitle: true, displayOrder: 310, description: 'Second-Fourth Level scores' },
  { species: 'HORSE', abbreviation: 'Gold', fullName: 'USDF Gold Medal', category: 'PERFORMANCE', organization: 'USDF', prefixTitle: false, suffixTitle: true, displayOrder: 320, description: 'Prix St. Georges-Grand Prix scores' },

  // === PRODUCING ===
  { species: 'HORSE', abbreviation: 'PS', fullName: 'Producing Sire', category: 'PRODUCING', organization: 'AQHA', prefixTitle: false, suffixTitle: true, displayOrder: 400, isProducingTitle: true },
  { species: 'HORSE', abbreviation: 'PD', fullName: 'Producing Dam', category: 'PRODUCING', organization: 'AQHA', prefixTitle: false, suffixTitle: true, displayOrder: 410, isProducingTitle: true },
];

// ═══════════════════════════════════════════════════════════════════════════════
// GOAT TITLES (ADGA/AGS)
// ═══════════════════════════════════════════════════════════════════════════════

const GOAT_TITLES: TitleDefinitionSeed[] = [
  // === ADGA CONFORMATION ===
  { species: 'GOAT', abbreviation: 'CH', fullName: 'Champion', category: 'CONFORMATION', organization: 'ADGA', prefixTitle: true, suffixTitle: false, displayOrder: 10 },
  { species: 'GOAT', abbreviation: 'GCH', fullName: 'Grand Champion', category: 'CONFORMATION', organization: 'ADGA', prefixTitle: true, suffixTitle: false, displayOrder: 20, parentTitleAbbrev: 'CH' },
  { species: 'GOAT', abbreviation: 'SGCH', fullName: 'Superior Genetics Champion', category: 'CONFORMATION', organization: 'ADGA', prefixTitle: true, suffixTitle: false, displayOrder: 5 },

  // === PERFORMANCE/MILK ===
  { species: 'GOAT', abbreviation: '*M', fullName: 'Milk Star', category: 'PERFORMANCE', organization: 'ADGA', prefixTitle: false, suffixTitle: true, displayOrder: 100, description: 'Earned milk production records' },
  { species: 'GOAT', abbreviation: '*D', fullName: 'Dairy Star', category: 'PERFORMANCE', organization: 'ADGA', prefixTitle: false, suffixTitle: true, displayOrder: 110 },
  { species: 'GOAT', abbreviation: 'AR', fullName: 'Advanced Registry', category: 'PERFORMANCE', organization: 'ADGA', prefixTitle: false, suffixTitle: true, displayOrder: 120 },

  // === LINEAR APPRAISAL ===
  { species: 'GOAT', abbreviation: 'LA 90', fullName: 'Linear Appraisal Excellent', category: 'CONFORMATION', organization: 'ADGA', prefixTitle: false, suffixTitle: true, displayOrder: 200 },
  { species: 'GOAT', abbreviation: 'E', fullName: 'Excellent', category: 'CONFORMATION', organization: 'ADGA', prefixTitle: false, suffixTitle: true, displayOrder: 210 },
  { species: 'GOAT', abbreviation: 'VG', fullName: 'Very Good', category: 'CONFORMATION', organization: 'ADGA', prefixTitle: false, suffixTitle: true, displayOrder: 220 },

  // === PRODUCING ===
  { species: 'GOAT', abbreviation: '+S', fullName: 'Elite Sire', category: 'PRODUCING', organization: 'ADGA', prefixTitle: false, suffixTitle: true, displayOrder: 300, isProducingTitle: true },
  { species: 'GOAT', abbreviation: '+B', fullName: 'Elite Dam', category: 'PRODUCING', organization: 'ADGA', prefixTitle: false, suffixTitle: true, displayOrder: 310, isProducingTitle: true },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SHEEP TITLES (ASA/ABSS)
// ═══════════════════════════════════════════════════════════════════════════════

const SHEEP_TITLES: TitleDefinitionSeed[] = [
  { species: 'SHEEP', abbreviation: 'CH', fullName: 'Champion', category: 'CONFORMATION', organization: 'ASA', prefixTitle: true, suffixTitle: false, displayOrder: 10 },
  { species: 'SHEEP', abbreviation: 'RC', fullName: 'Reserve Champion', category: 'CONFORMATION', organization: 'ASA', prefixTitle: true, suffixTitle: false, displayOrder: 20 },
  { species: 'SHEEP', abbreviation: 'GCH', fullName: 'Grand Champion', category: 'CONFORMATION', organization: 'ASA', prefixTitle: true, suffixTitle: false, displayOrder: 5 },
  { species: 'SHEEP', abbreviation: 'NC', fullName: 'National Champion', category: 'CONFORMATION', organization: 'ASA', prefixTitle: true, suffixTitle: false, displayOrder: 1 },

  // === PRODUCING ===
  { species: 'SHEEP', abbreviation: 'RR', fullName: 'Registered Ram', category: 'PRODUCING', organization: 'ASA', prefixTitle: false, suffixTitle: true, displayOrder: 100, isProducingTitle: true },
];

// ═══════════════════════════════════════════════════════════════════════════════
// RABBIT TITLES (ARBA)
// ═══════════════════════════════════════════════════════════════════════════════

const RABBIT_TITLES: TitleDefinitionSeed[] = [
  // === ARBA ===
  { species: 'RABBIT', abbreviation: 'GC', fullName: 'Grand Champion', category: 'CONFORMATION', organization: 'ARBA', prefixTitle: true, suffixTitle: false, displayOrder: 10, description: '3 legs under 3 different judges' },
  { species: 'RABBIT', abbreviation: 'RC', fullName: 'Registered Champion', category: 'CONFORMATION', organization: 'ARBA', prefixTitle: true, suffixTitle: false, displayOrder: 20 },
  { species: 'RABBIT', abbreviation: 'BIS', fullName: 'Best In Show', category: 'CONFORMATION', organization: 'ARBA', prefixTitle: false, suffixTitle: true, displayOrder: 100 },
  { species: 'RABBIT', abbreviation: 'BOB', fullName: 'Best of Breed', category: 'CONFORMATION', organization: 'ARBA', prefixTitle: false, suffixTitle: true, displayOrder: 110 },
  { species: 'RABBIT', abbreviation: 'BOS', fullName: 'Best Opposite Sex', category: 'CONFORMATION', organization: 'ARBA', prefixTitle: false, suffixTitle: true, displayOrder: 120 },
  { species: 'RABBIT', abbreviation: 'BOV', fullName: 'Best of Variety', category: 'CONFORMATION', organization: 'ARBA', prefixTitle: false, suffixTitle: true, displayOrder: 130 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED TITLE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const ALL_TITLE_DEFINITIONS: TitleDefinitionSeed[] = [
  ...DOG_TITLES,
  ...CAT_TITLES,
  ...HORSE_TITLES,
  ...GOAT_TITLES,
  ...SHEEP_TITLES,
  ...RABBIT_TITLES,
];

// ═══════════════════════════════════════════════════════════════════════════════
// SEED FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

async function seedTitleDefinitions(): Promise<Map<string, number>> {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  SEEDING GLOBAL TITLE DEFINITIONS');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const titleIdMap = new Map<string, number>();
  const parentReferences: { id: number; parentKey: string }[] = [];

  // First pass: Create all titles without parent references
  for (const titleDef of ALL_TITLE_DEFINITIONS) {
    const key = `${titleDef.species}:${titleDef.abbreviation}:${titleDef.organization || 'null'}`;

    // Check if already exists
    let existing = await prisma.titleDefinition.findFirst({
      where: {
        species: titleDef.species,
        abbreviation: titleDef.abbreviation,
        organization: titleDef.organization || null,
        tenantId: null, // Global definitions only
      },
    });

    if (!existing) {
      existing = await prisma.titleDefinition.create({
        data: {
          tenantId: null, // Global definition
          species: titleDef.species,
          abbreviation: titleDef.abbreviation,
          fullName: titleDef.fullName,
          category: titleDef.category,
          organization: titleDef.organization || null,
          prefixTitle: titleDef.prefixTitle,
          suffixTitle: titleDef.suffixTitle,
          displayOrder: titleDef.displayOrder,
          isProducingTitle: titleDef.isProducingTitle || false,
          pointsRequired: titleDef.pointsRequired || null,
          description: titleDef.description || null,
          // parentTitleId set in second pass
        },
      });
      console.log(`  + Created: ${titleDef.species} ${titleDef.abbreviation} (${titleDef.fullName})`);
    } else {
      console.log(`  = Exists: ${titleDef.species} ${titleDef.abbreviation}`);
    }

    titleIdMap.set(key, existing.id);

    // Track parent references for second pass
    if (titleDef.parentTitleAbbrev) {
      const parentKey = `${titleDef.species}:${titleDef.parentTitleAbbrev}:${titleDef.organization || 'null'}`;
      parentReferences.push({ id: existing.id, parentKey });
    }
  }

  // Second pass: Update parent references
  console.log('\n  Updating parent title references...');
  for (const ref of parentReferences) {
    const parentId = titleIdMap.get(ref.parentKey);
    if (parentId) {
      await prisma.titleDefinition.update({
        where: { id: ref.id },
        data: { parentTitleId: parentId },
      });
    } else {
      console.log(`  ! Warning: Parent not found for key ${ref.parentKey}`);
    }
  }

  const counts = {
    DOG: DOG_TITLES.length,
    CAT: CAT_TITLES.length,
    HORSE: HORSE_TITLES.length,
    GOAT: GOAT_TITLES.length,
    SHEEP: SHEEP_TITLES.length,
    RABBIT: RABBIT_TITLES.length,
  };

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TITLE DEFINITIONS COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  Total: ${ALL_TITLE_DEFINITIONS.length}`);
  Object.entries(counts).forEach(([species, count]) => {
    console.log(`    ${species}: ${count}`);
  });
  console.log('');

  return titleIdMap;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN (only runs when executed directly, not when imported)
// ═══════════════════════════════════════════════════════════════════════════════

// Export for use by other seed scripts
export { seedTitleDefinitions, ALL_TITLE_DEFINITIONS, DOG_TITLES, CAT_TITLES, HORSE_TITLES, GOAT_TITLES, SHEEP_TITLES, RABBIT_TITLES };

// Only run main() when this file is executed directly (not when imported)
// Check if this file is the entry point using ESM-compatible method
const isDirectExecution = process.argv[1] === __filename || process.argv[1]?.includes('seed-title-definitions');

if (isDirectExecution) {
  seedTitleDefinitions()
    .catch((e) => {
      console.error('Seed failed:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
