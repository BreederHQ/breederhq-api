/**
 * KVS Demo Tenant — Supplemental Data for Video Demo
 *
 * Adds data that the main seed script doesn't create but the demo video needs:
 *   1. A breeding plan in CYCLE phase (Sophie x Good Better Best Fall 2026)
 *   2. Cycle start dates (heat history) on Annie for Cycle Tab demo
 *   3. Vaccination records for Kennedy and Annie
 *   4. Foaling check history for Raven (overdue mare)
 *   5. Health trait values (Coggins, Breeding Soundness) for Kennedy
 *
 * Usage:
 *   npx tsx scripts/seeding/kvs-demo-tenant/kvs-demo-supplements.ts
 *
 * Prerequisites: Main kvs seed must have run first (npm run db:dev:seed:kvs)
 */

import { d, daysAfter, daysBefore } from './kvs-helpers';

// ══════════════════════════════════════════════════════════════════════
// 1. CYCLE-PHASE BREEDING PLAN
//    Sophie is currently a "freeloader" with no breeding plan.
//    We create a fall 2026 plan in early CYCLE phase so the demo
//    can show follicle exam recording, P4 testing, and breeding
//    attempt recording on a plan that's "in progress."
// ══════════════════════════════════════════════════════════════════════

export const KVS_CYCLE_PLAN = {
  name: 'Sophie x Good Better Best Fall 2026',
  nickname: 'Sophie\'s Comeback',
  damRef: 'Sophie',
  sireRef: 'Good Better Best',
  species: 'HORSE' as const,
  breedText: 'Quarter Horse',
  method: 'AI_FROZEN',
  status: 'CYCLE',
  // No breed date yet — plan is in monitoring phase
  cycleStartDateActual: '2026-02-20',
  notes: 'Sophie back in the breeding program after 2-year break. Good Better Best = $1M Dollar Sire, #1 QData Sire of HUS money-earners. Monitoring cycle prior to breeding. Target breed window: early March 2026.',
  tags: ['2026 Season'],
};

// Pre-breeding P4 tests for the CYCLE-phase plan (realistic progression)
export const KVS_CYCLE_PLAN_TESTS = [
  {
    kind: 'PROGESTERONE',
    method: 'BLOOD',
    collectedAt: '2026-02-20',
    valueNumber: 0.4,
    units: 'ng/mL',
    notes: 'Baseline — mare in early estrus. Low P4 confirms heat.',
  },
  {
    kind: 'FOLLICLE_EXAM',
    method: 'ULTRASOUND',
    collectedAt: '2026-02-22',
    valueNumber: 28,
    units: 'mm',
    notes: 'Dominant follicle 28mm right ovary. Mild uterine edema (Grade 1). Developing.',
  },
  {
    kind: 'PROGESTERONE',
    method: 'BLOOD',
    collectedAt: '2026-02-24',
    valueNumber: 1.1,
    units: 'ng/mL',
    notes: 'Rising — approaching LH surge threshold.',
  },
  {
    kind: 'FOLLICLE_EXAM',
    method: 'ULTRASOUND',
    collectedAt: '2026-02-25',
    valueNumber: 35,
    units: 'mm',
    notes: 'Dominant follicle 35mm right ovary. Moderate edema (Grade 2). Growing well.',
  },
  // Today is Feb 27 — the next test would be "today" in the demo
  // The demo can show recording a new P4 test live
];

// ══════════════════════════════════════════════════════════════════════
// 2. CYCLE START DATES (heat history) for Annie
//    Annie has a documented breeding profile with known cycle quirks.
//    Adding 6 historical heat dates lets the Cycle Tab show:
//    - Cycle length calculation (~22 day avg, longer than typical 21)
//    - 12 future cycle projections
//    - Ovulation pattern analysis
//    - Seasonality indicator
// ══════════════════════════════════════════════════════════════════════

export const KVS_CYCLE_HISTORY_ANNIE = [
  '2025-03-10',  // Spring — coming into season
  '2025-04-01',  // 22-day cycle
  '2025-04-22',  // 21-day cycle
  '2025-05-14',  // 22-day cycle (bred on May 16 — plan: Annie x Denver 2026)
  // Gap: pregnant through 2026
  // Pre-pregnancy 2024 cycles
  '2024-02-18',  // Early season 2024
  '2024-03-12',  // 22-day cycle (bred Mar 15 — plan: Annie x Cool Ladies Man 2025)
];

// Also add cycle history for Sophie (the CYCLE-phase plan mare)
export const KVS_CYCLE_HISTORY_SOPHIE = [
  '2025-09-15',  // Back from 2-year break — first observed heat
  '2025-10-06',  // 21-day cycle
  '2025-10-28',  // 22-day cycle
  '2025-11-18',  // 21-day cycle
  '2026-01-30',  // Winter cycle (longer gap — seasonal)
  '2026-02-20',  // 21-day cycle — THIS is the current cycle (CYCLE plan start)
];

// ══════════════════════════════════════════════════════════════════════
// 3. VACCINATION RECORDS
//    Kennedy and Annie are the demo's health tab targets.
//    We seed a mix of current, due-soon, and expired to show the
//    compliance color spectrum (green/amber/red).
// ══════════════════════════════════════════════════════════════════════

export interface VaccinationRecordDef {
  animalRef: string;
  protocolKey: string;       // Matches VaccinationProtocol.key
  administeredAt: string;    // YYYY-MM-DD
  expiresAt?: string;        // YYYY-MM-DD
  veterinarianName?: string;
  clinicName?: string;
  batchNumber?: string;
  notes?: string;
}

export const KVS_VACCINATIONS: VaccinationRecordDef[] = [
  // ── Kennedy (VS The First Lady) ───────────────────────────────
  // Rabies — current (annual, given Aug 2025)
  {
    animalRef: 'VS The First Lady',
    protocolKey: 'RABIES',
    administeredAt: '2025-08-10',
    expiresAt: '2026-08-10',
    veterinarianName: 'Dr. Sarah Mitchell',
    clinicName: 'Tennessee Equine Hospital',
    batchNumber: 'RAB-2025-4412',
    notes: 'Annual rabies. No reaction.',
  },
  // Tetanus — current
  {
    animalRef: 'VS The First Lady',
    protocolKey: 'TETANUS',
    administeredAt: '2025-08-10',
    expiresAt: '2026-08-10',
    veterinarianName: 'Dr. Sarah Mitchell',
    clinicName: 'Tennessee Equine Hospital',
  },
  // EWT — current
  {
    animalRef: 'VS The First Lady',
    protocolKey: 'EWT',
    administeredAt: '2025-04-15',
    expiresAt: '2026-04-15',
    veterinarianName: 'Dr. Sarah Mitchell',
    clinicName: 'Tennessee Equine Hospital',
    notes: 'Spring series. Combined with West Nile.',
  },
  // West Nile — DUE SOON (expires in ~6 weeks)
  {
    animalRef: 'VS The First Lady',
    protocolKey: 'WEST_NILE',
    administeredAt: '2025-04-15',
    expiresAt: '2026-04-15',
    veterinarianName: 'Dr. Sarah Mitchell',
    clinicName: 'Tennessee Equine Hospital',
  },
  // Influenza — EXPIRED (was due Dec 2025, 6-month protocol)
  {
    animalRef: 'VS The First Lady',
    protocolKey: 'INFLUENZA',
    administeredAt: '2025-06-15',
    expiresAt: '2025-12-15',
    veterinarianName: 'Dr. Sarah Mitchell',
    clinicName: 'Tennessee Equine Hospital',
    notes: 'Semi-annual flu. DUE FOR BOOSTER.',
  },
  // Rhinopneumonitis (EHV) — EXPIRED (critical for pregnant mares)
  {
    animalRef: 'VS The First Lady',
    protocolKey: 'RHINOPNEUMONITIS',
    administeredAt: '2025-05-20',
    expiresAt: '2025-11-20',
    veterinarianName: 'Dr. Sarah Mitchell',
    clinicName: 'Tennessee Equine Hospital',
    notes: 'Rhino booster. OVERDUE — schedule ASAP.',
  },
  // Strangles — current
  {
    animalRef: 'VS The First Lady',
    protocolKey: 'STRANGLES',
    administeredAt: '2025-08-10',
    expiresAt: '2026-08-10',
    veterinarianName: 'Dr. Sarah Mitchell',
    clinicName: 'Tennessee Equine Hospital',
    batchNumber: 'STR-2025-2201',
    notes: 'Intranasal. Annual.',
  },

  // ── Annie (Hot Pistol Annie) ──────────────────────────────────
  // Rabies — current
  {
    animalRef: 'Hot Pistol Annie',
    protocolKey: 'RABIES',
    administeredAt: '2025-08-10',
    expiresAt: '2026-08-10',
    veterinarianName: 'Dr. Sarah Mitchell',
    clinicName: 'Tennessee Equine Hospital',
  },
  // Tetanus — current
  {
    animalRef: 'Hot Pistol Annie',
    protocolKey: 'TETANUS',
    administeredAt: '2025-08-10',
    expiresAt: '2026-08-10',
    veterinarianName: 'Dr. Sarah Mitchell',
    clinicName: 'Tennessee Equine Hospital',
  },
  // EWT — current
  {
    animalRef: 'Hot Pistol Annie',
    protocolKey: 'EWT',
    administeredAt: '2025-04-15',
    expiresAt: '2026-04-15',
    veterinarianName: 'Dr. Sarah Mitchell',
    clinicName: 'Tennessee Equine Hospital',
  },
  // Rhinopneumonitis — CRITICAL: current (pregnant mare protocol = every 2 months)
  {
    animalRef: 'Hot Pistol Annie',
    protocolKey: 'RHINOPNEUMONITIS',
    administeredAt: '2026-01-15',
    expiresAt: '2026-03-15',
    veterinarianName: 'Dr. Sarah Mitchell',
    clinicName: 'Tennessee Equine Hospital',
    notes: 'Pregnant mare Rhino protocol — every 60 days. Due for next booster mid-March.',
  },
  // Influenza — DUE SOON
  {
    animalRef: 'Hot Pistol Annie',
    protocolKey: 'INFLUENZA',
    administeredAt: '2025-09-01',
    expiresAt: '2026-03-01',
    veterinarianName: 'Dr. Sarah Mitchell',
    clinicName: 'Tennessee Equine Hospital',
    notes: 'Semi-annual flu. Due early March.',
  },
];

// ══════════════════════════════════════════════════════════════════════
// 4. FOALING CHECK HISTORY for Raven
//    Raven is overdue (due Jan 20, today is Feb 27).
//    Seed 5 progressive foaling checks over the past week to show
//    the check history log and urgency scoring.
// ══════════════════════════════════════════════════════════════════════

export interface FoalingCheckDef {
  mareRef: string;
  checkedAt: string;          // ISO timestamp
  udderDevelopment: string;   // NONE | FILLING | FULL | WAXING
  vulvaRelaxation: string;    // NONE | SLIGHT | SIGNIFICANT
  tailheadRelaxation: string; // NONE | SLIGHT | SIGNIFICANT
  temperature?: number;       // Fahrenheit
  behaviorNotes?: string[];   // Array of behavior tags
  additionalNotes?: string;
  foalingImminent?: boolean;
}

export const KVS_FOALING_CHECKS: FoalingCheckDef[] = [
  // Check 1 — Feb 22 (5 days ago)
  {
    mareRef: 'Raven',
    checkedAt: '2026-02-22T06:30:00Z',
    udderDevelopment: 'FILLING',
    vulvaRelaxation: 'NONE',
    tailheadRelaxation: 'NONE',
    temperature: 99.8,
    additionalNotes: 'Udder starting to fill. No other changes. Eating well.',
  },
  // Check 2 — Feb 23
  {
    mareRef: 'Raven',
    checkedAt: '2026-02-23T06:15:00Z',
    udderDevelopment: 'FILLING',
    vulvaRelaxation: 'SLIGHT',
    tailheadRelaxation: 'NONE',
    temperature: 99.6,
    additionalNotes: 'Slight vulvar changes noted. Udder continues filling.',
  },
  // Check 3 — Feb 24
  {
    mareRef: 'Raven',
    checkedAt: '2026-02-24T06:45:00Z',
    udderDevelopment: 'FULL',
    vulvaRelaxation: 'SLIGHT',
    tailheadRelaxation: 'SLIGHT',
    temperature: 99.4,
    behaviorNotes: ['Restless'],
    additionalNotes: 'Udder full. Starting to see tailhead softening. Slightly restless overnight per cameras.',
  },
  // Check 4 — Feb 25
  {
    mareRef: 'Raven',
    checkedAt: '2026-02-25T06:00:00Z',
    udderDevelopment: 'FULL',
    vulvaRelaxation: 'SLIGHT',
    tailheadRelaxation: 'SLIGHT',
    temperature: 99.2,
    behaviorNotes: ['Restless', 'Pawing'],
    additionalNotes: 'Pawing at bedding intermittently. Udder still full, no waxing yet. Temperature dropping slightly each day.',
  },
  // Check 5 — Feb 26 (yesterday)
  {
    mareRef: 'Raven',
    checkedAt: '2026-02-26T05:45:00Z',
    udderDevelopment: 'WAXING',
    vulvaRelaxation: 'SIGNIFICANT',
    tailheadRelaxation: 'SIGNIFICANT',
    temperature: 98.8,
    behaviorNotes: ['Restless', 'Pawing', 'Sweating'],
    additionalNotes: 'WAXING started overnight! Significant vulva and tailhead relaxation. Temperature dropped to 98.8°F. Called Dr. Mitchell — on standby. Foaling expected within 24-48 hours.',
    foalingImminent: true,
  },
];

// ══════════════════════════════════════════════════════════════════════
// 5. HEALTH TRAIT VALUES
//    Seed Coggins (current) and Breeding Soundness Exam for Kennedy
//    so the Health Tab has populated trait data for the demo.
// ══════════════════════════════════════════════════════════════════════

export interface HealthTraitDef {
  animalRef: string;
  traitKey: string;        // Must match a TraitDefinition.key for species HORSE
  value: string;           // Stored value
  notes?: string;
  recordedAt?: string;     // YYYY-MM-DD
}

export const KVS_HEALTH_TRAITS: HealthTraitDef[] = [
  {
    animalRef: 'VS The First Lady',
    traitKey: 'horse.infectious.cogginsStatus',
    value: 'NEGATIVE',
    notes: 'Coggins test current. Tested Aug 2025 at Tennessee Equine Hospital. Certificate on file.',
    recordedAt: '2025-08-10',
  },
  {
    animalRef: 'VS The First Lady',
    traitKey: 'horse.repro.breedingSoundness',
    value: 'PASS',
    notes: 'Full BSE performed pre-2026 season. Cervix, uterus, ovaries all normal. Cleared for breeding.',
    recordedAt: '2025-11-15',
  },
  {
    animalRef: 'Hot Pistol Annie',
    traitKey: 'horse.infectious.cogginsStatus',
    value: 'NEGATIVE',
    notes: 'Coggins test current. Annual test at Tennessee Equine Hospital.',
    recordedAt: '2025-08-10',
  },
  {
    animalRef: 'Hot Pistol Annie',
    traitKey: 'horse.repro.breedingSoundness',
    value: 'PASS',
    notes: 'BSE performed. Known issues: struggles to conceive while nursing, 345-day gestation history. Otherwise sound.',
    recordedAt: '2025-11-15',
  },
  {
    animalRef: 'VS Code Red',
    traitKey: 'horse.infectious.cogginsStatus',
    value: 'NEGATIVE',
    notes: 'Coggins current. Required for stallion standing at Highpoint Performance Horses.',
    recordedAt: '2025-07-01',
  },
];
