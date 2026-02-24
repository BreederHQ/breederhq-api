/**
 * KVS Demo Tenant — Pure Data Definitions
 *
 * All data for the Katie Van Slyke / Running Springs demo tenant.
 * This file contains ONLY data — no Prisma calls, no side effects.
 *
 * Reference: docs/demos/KATIE-VAN-SLYKE-DOSSIER.md
 */

import {
  type LocusData,
  locus,
  healthLocus,
  sixPanelClear,
  d,
  yearDate,
  daysAfter,
  daysBefore,
} from './kvs-helpers';

// ══════════════════════════════════════════════════════════════════════
// TIER 1 — TENANT + AUTH
// ══════════════════════════════════════════════════════════════════════

export const KVS_TENANT = {
  name: 'Running Springs Quarter Horse & Cattle Company',
  slug: 'kvs-demo',
  isDemoTenant: true,
  // Theme settings
  theme: {
    name: 'Running Springs Quarter Horse & Cattle Company',
    city: 'Nolensville',
    region: 'TN',
    country: 'US',
    timeZone: 'America/Chicago',
    operationType: 'PROFESSIONAL',
  },
};

export const KVS_USER = {
  email: 'demo-kvs@breederhq.com',
  firstName: 'Katie',
  lastName: 'Van Slyke',
  password: 'BreederHQ2026!',
};

// ══════════════════════════════════════════════════════════════════════
// TIER 2 — TAGS
// ══════════════════════════════════════════════════════════════════════

export const KVS_TAGS = [
  // Animal tags
  { name: 'Stallion', module: 'ANIMAL', color: '#3B82F6' },
  { name: 'Broodmare', module: 'ANIMAL', color: '#EC4899' },
  { name: 'Recipient Mare', module: 'ANIMAL', color: '#8B5CF6' },
  { name: 'Foal', module: 'ANIMAL', color: '#10B981' },
  { name: 'Freeloader', module: 'ANIMAL', color: '#F59E0B' },
  { name: 'Donor Mare', module: 'ANIMAL', color: '#F97316' },
  { name: 'Show Horse', module: 'ANIMAL', color: '#EF4444' },
  { name: 'Mini', module: 'ANIMAL', color: '#06B6D4' },
  // Breeding plan tags
  { name: '2025 Season', module: 'BREEDING_PLAN', color: '#6366F1' },
  { name: '2026 Season', module: 'BREEDING_PLAN', color: '#8B5CF6' },
  { name: 'Embryo Transfer', module: 'BREEDING_PLAN', color: '#F97316' },
  { name: 'AI Frozen', module: 'BREEDING_PLAN', color: '#3B82F6' },
  { name: 'Sexed Semen', module: 'BREEDING_PLAN', color: '#EC4899' },
  // Contact tags
  { name: 'Vet', module: 'CONTACT', color: '#10B981' },
  { name: 'Trainer', module: 'CONTACT', color: '#3B82F6' },
  { name: 'Stallion Manager', module: 'CONTACT', color: '#F59E0B' },
  { name: 'Barn Staff', module: 'CONTACT', color: '#8B5CF6' },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 3 — CONTACTS
// ══════════════════════════════════════════════════════════════════════

export interface ContactDef {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  notes?: string;
  tags?: string[];
}

export interface OrgDef {
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  notes?: string;
  tags?: string[];
}

export const KVS_CONTACTS: ContactDef[] = [
  {
    firstName: 'Rachel',
    lastName: 'Hadley',
    email: 'rachel@runningspringsqh.example.com',
    city: 'Nolensville',
    state: 'TN',
    country: 'US',
    notes: 'Barn Manager — primary day-to-day operations contact',
    tags: ['Barn Staff'],
  },
  {
    firstName: 'Rebecca',
    lastName: '',
    email: 'rebecca@runningspringsqh.example.com',
    city: 'Nolensville',
    state: 'TN',
    country: 'US',
    notes: 'AI-certified inseminator. Katie\'s best friend. Performs on-farm inseminations.',
    tags: ['Barn Staff'],
  },
  {
    firstName: 'Christi',
    lastName: 'Christenson',
    email: 'christi@highpointperformance.example.com',
    phone: '+19038161428',
    city: 'Pilot Point',
    state: 'TX',
    country: 'US',
    notes: 'Stallion Breeding Manager at Highpoint Performance Horses. Manages all VS Code Red & Denver breeding contracts.',
    tags: ['Stallion Manager'],
  },
  {
    firstName: 'Aaron',
    lastName: 'Moses',
    email: 'aaron@mosesperformance.example.com',
    state: 'TX',
    country: 'US',
    notes: 'Professional trainer/rider. Aaron Moses Performance Horses. Trains and shows Denver (First Thingz First).',
    tags: ['Trainer'],
  },
  {
    firstName: 'Karen',
    lastName: 'Carter',
    email: 'karen.carter@example.com',
    city: 'Chesterfield',
    state: 'VA',
    country: 'US',
    notes: 'Previous owner of Gone Commando (Rikki). Showed Rikki to Congress Championship.',
  },
  {
    firstName: 'Kevin',
    lastName: 'Smith',
    email: 'kevin@capallcreek.example.com',
    state: 'NC',
    country: 'US',
    notes: 'Capall Creek Farm. Previous owner/breeder of First Thingz First (Denver).',
  },
  {
    firstName: 'Chandler',
    lastName: 'Marks',
    email: 'chandler@marks.example.com',
    country: 'US',
    notes: 'Mini horse semen collection & shipping specialist.',
    tags: ['Stallion Manager'],
  },
  {
    firstName: 'Taft',
    lastName: 'Dickerson',
    email: 'taft@dickersonhorses.example.com',
    state: 'PA',
    country: 'US',
    notes: 'Professional trainer. 4x Congress Champion, NSBA WC, $250K+ NSBA rider. Showed Gone Commando.',
    tags: ['Trainer'],
  },
];

export const KVS_ORGANIZATIONS: OrgDef[] = [
  {
    name: 'Tennessee Equine Hospital',
    email: 'info@tnequine.example.com',
    city: 'Thompsons Station',
    state: 'TN',
    country: 'US',
    notes: 'Primary vet clinic. Handles reproductive ultrasounds, breeding, pregnancy checks.',
    tags: ['Vet'],
  },
  {
    name: 'Highpoint Performance Horses',
    email: 'info@highpointperformance.example.com',
    city: 'Pilot Point',
    state: 'TX',
    country: 'US',
    notes: 'Stallion management facility. VS Code Red and First Thingz First stand here.',
    tags: ['Stallion Manager'],
  },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 4 — ANIMALS
// ══════════════════════════════════════════════════════════════════════

export interface AnimalDef {
  name: string;         // Registered or display name
  barnName?: string;    // Barn/call name
  species: 'HORSE' | 'GOAT';
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN';
  breed?: string;
  birthYear?: number;
  birthDate?: string;   // YYYY-MM-DD if known
  status: 'ACTIVE' | 'BREEDING' | 'RETIRED' | 'DECEASED' | 'PROSPECT';
  sireRef?: string;     // Name ref → resolved to ID at runtime
  damRef?: string;      // Name ref → resolved to ID at runtime
  notes?: string;
  generation: number;   // 0 = earliest ancestors, higher = later
  tags?: string[];
  color?: string;
}

// ── PEDIGREE ANCESTORS (Generation 0–3) ──────────────────────────────
// These are NOT owned by Running Springs — they exist for pedigree depth.

export const KVS_ANCESTORS: AnimalDef[] = [
  // Gen 0 — Great-great-grandparents
  { name: 'Doc Bar', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1956, status: 'DECEASED', generation: 0, notes: 'AQHA Hall of Fame' },
  { name: 'Zippo Pat Bars', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1963, status: 'DECEASED', generation: 0 },
  { name: 'Poco Pine', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1954, status: 'DECEASED', generation: 0 },
  { name: 'Blondys Dude', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1965, status: 'DECEASED', generation: 0 },
  { name: 'The Invester', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1976, status: 'DECEASED', generation: 0 },
  { name: 'Therapy', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1978, status: 'DECEASED', generation: 0, sireRef: 'Zippo Pine Bar' },
  { name: 'Lazy Loper', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1986, status: 'DECEASED', generation: 0 },

  // Gen 1 — Great-grandparents
  { name: 'Docs Hotrodder', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1965, status: 'DECEASED', generation: 1, sireRef: 'Doc Bar', notes: 'By Doc Bar (AQHA Hall of Fame)' },
  { name: 'Zippo Pine Bar', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1969, status: 'DECEASED', generation: 1, notes: 'AQHA Hall of Fame. Foundation sire of the modern WP industry.' },
  { name: 'Tamara Wess', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse', birthYear: 1975, status: 'DECEASED', generation: 1, damRef: 'Blondys Dude' },
  { name: 'An Awesome Mister', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1985, status: 'DECEASED', generation: 1 },
  { name: 'Impulsions', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1985, status: 'DECEASED', generation: 1, sireRef: 'The Invester' },
  { name: 'Good Asset', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1980, status: 'DECEASED', generation: 1 },

  // Gen 2 — Grandparents
  { name: 'Hotrodders Jet Set', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1979, status: 'DECEASED', generation: 2, sireRef: 'Docs Hotrodder' },
  { name: 'Tahnee Zippo', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse', birthYear: 1982, status: 'DECEASED', generation: 2, sireRef: 'Zippo Pine Bar' },
  { name: 'Zippos Mr Good Bar', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1984, status: 'DECEASED', generation: 2, sireRef: 'Zippo Pine Bar', damRef: 'Tamara Wess', notes: 'AQHA Hall of Fame, NSBA Hall of Fame' },
  { name: 'Vitalism', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse', birthYear: 1990, status: 'DECEASED', generation: 2, sireRef: 'An Awesome Mister' },
  { name: 'A Sudden Impulse', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1991, status: 'DECEASED', generation: 2, sireRef: 'Impulsions' },
  { name: 'Zip N Therapy', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse', birthYear: 1990, status: 'DECEASED', generation: 2, sireRef: 'Therapy' },
  { name: 'Protect Your Assets', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1990, status: 'DECEASED', generation: 2, sireRef: 'Good Asset' },
  { name: 'A Good Machine', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1994, status: 'DECEASED', generation: 2, sireRef: 'Zippos Mr Good Bar' },

  // Gen 3 — Parents of owned horses (not owned by Running Springs)
  { name: 'Blazing Hot', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1992, status: 'DECEASED', generation: 3, sireRef: 'Hotrodders Jet Set', damRef: 'Tahnee Zippo', notes: 'AQHA World Champion. 1,983+ foals, $3.88M offspring earnings. NSBA Hall of Fame.' },
  { name: 'Vital Signs Are Good', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse', birthYear: 2000, status: 'DECEASED', generation: 3, sireRef: 'Zippos Mr Good Bar', damRef: 'Vitalism', notes: 'AQHA Hall of Fame (2019). 13 AQHA World Championships, 31 Congress Championships. Greatest show mare in AQHA history.' },
  { name: 'Dont Skip Zip', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1990, status: 'DECEASED', generation: 3, sireRef: 'Zippo Pine Bar' },
  { name: 'Cool Lookin Lady', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse', birthYear: 1997, status: 'DECEASED', generation: 3, sireRef: 'Dont Skip Zip', notes: '$80,759 LTE, 263.5 pts, 1999 WC 2YO WP. 48+ Congress/World Champions from offspring.' },
  { name: 'Hot N Blazing', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1997, status: 'DECEASED', generation: 3, sireRef: 'Blazing Hot', notes: 'AQHA/NSBA All-Time Leading HUS Sire. Deceased 2019.' },
  { name: 'Vested Wishes', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse', birthYear: 1998, status: 'DECEASED', generation: 3 },
  { name: 'Allocate Your Assets', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 2000, status: 'DECEASED', generation: 3, sireRef: 'Protect Your Assets', notes: 'AQHA Hall of Fame, Million Dollar Sire, #1 All-Time HUS Sire.' },
  { name: 'Red Carpet Rita', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse', birthYear: 1998, status: 'DECEASED', generation: 3, notes: 'By Iron Enterprise — Congress Champion, Superior Amateur HUS.' },
  { name: 'No Doubt Im Lazy', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 1998, status: 'DECEASED', generation: 3, sireRef: 'Lazy Loper' },
  { name: 'Gone Viral', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 2014, status: 'RETIRED', generation: 3, sireRef: 'No Doubt Im Lazy', notes: '$100K+ LTE, 4x Congress Champion, 6x NSBA WC.' },
  { name: 'Only In The Moonlite', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 2005, status: 'DECEASED', generation: 3 },
  { name: 'Only A Sterling Moon', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse', birthYear: 2010, status: 'RETIRED', generation: 3, sireRef: 'Only In The Moonlite' },
  { name: 'Invitation Only', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 2005, status: 'DECEASED', generation: 3 },
  { name: 'Jet Set Five', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse', birthYear: 1995, status: 'DECEASED', generation: 3, sireRef: 'Hotrodders Jet Set', notes: 'One of the last daughters of Hotrodders Jet Set.' },
  { name: 'Phonetics', species: 'HORSE', sex: 'MALE', breed: 'Thoroughbred', birthYear: 2005, status: 'RETIRED', generation: 3 },
  { name: 'Coats N Tails', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 2000, status: 'DECEASED', generation: 3, sireRef: 'Invitation Only' },
  { name: 'Good I Will Be', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse', birthYear: 2007, status: 'RETIRED', generation: 3, sireRef: 'A Good Machine' },
];

// ── OUTSIDE STALLIONS (PROSPECT status) ──────────────────────────────

export const KVS_OUTSIDE_STALLIONS: AnimalDef[] = [
  {
    name: 'RL Best of Sudden', barnName: 'Best', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse',
    birthYear: 2002, status: 'DECEASED', generation: 3,
    sireRef: 'A Sudden Impulse', damRef: 'Zip N Therapy',
    notes: '$6.5M Dollar Sire. 1,406 foals, 129 World/Reserve WC, 609 Superior Awards. AQHA & NSBA All-Time Leading WP Sire. Died June 2025.',
    color: 'Bay',
  },
  {
    name: 'Machine Made', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse',
    birthYear: 2007, status: 'PROSPECT', generation: 4,
    sireRef: 'A Good Machine',
    notes: 'AQHA #1 Leading WP Sire since 2019. $4M Dollar Sire. Stud fee $5,000. Standing: Riverside Ranch, Sultan, WA. 5-Panel (GBED N/GBED carrier).',
    color: 'Bay',
  },
  {
    name: 'Cool Breeze', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse',
    birthYear: 2015, status: 'PROSPECT', generation: 4,
    sireRef: 'No Doubt Im Lazy',
    notes: '2019 Reserve Congress Champion. Stud fee $3,000. Standing: Looney QH, Jackson, TN. 6-Panel N/N.',
    color: 'Chestnut',
  },
  {
    name: 'Cool Ladys Man', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse',
    birthYear: 2020, status: 'PROSPECT', generation: 4,
    sireRef: 'RL Best of Sudden',
    notes: '2022 Congress Champion 2YO Maiden HUS. Stud fee $2,500. Standing: Tom McCutcheon Reining Horses, Aubrey, TX. 6-Panel N/N.',
    color: 'Bay',
  },
  {
    name: 'Hey Good Lookin', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse',
    birthYear: 2017, status: 'PROSPECT', generation: 4,
    sireRef: 'Invitation Only',
    notes: 'AQHA WC 2YO WP, Congress NSBA Masters WP Futurity Champion, NSBA WC 3YO WP. 2025 Super Sires Stallion of the Year. Stud fee $3,500.',
    color: 'Chestnut',
  },
  {
    name: 'Good Better Best', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse',
    birthYear: 2014, status: 'PROSPECT', generation: 4,
    sireRef: 'Good I Will Be',
    notes: '$1M Dollar Sire. #1 QData Sire of HUS Money-Earners. 50 World/Congress Champions/Reserves. Stud fee $2,850. 7-Panel N/N.',
    color: 'Bay',
  },
  {
    name: 'Full Medal Jacket', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse',
    birthYear: 2009, status: 'PROSPECT', generation: 4,
    sireRef: 'Coats N Tails',
    notes: '2012 NSBA WC 3YO Open HUS. Homozygous black. 7-Panel N/N. Stud fee $1,750. Standing: Robin Baker Show Horses, Whitesboro, TX.',
    color: 'Black',
  },
  {
    name: 'Making Me Willie Wild', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse',
    birthYear: 2018, status: 'PROSPECT', generation: 4,
    notes: 'Outside stallion used for Ginger\'s 2026 breeding (failed — retained fluid).',
  },
  // Mini horse outside stallions
  {
    name: 'Maddox', species: 'HORSE', sex: 'MALE', breed: 'Miniature Horse',
    birthYear: 2018, status: 'PROSPECT', generation: 4,
    notes: 'Visiting mini horse stallion. Sire of Regina\'s 2026 foal (due July 8, 2026).',
    tags: ['Mini'],
  },
];

// ── OWNED STALLIONS ──────────────────────────────────────────────────

export const KVS_STALLIONS: AnimalDef[] = [
  {
    name: 'VS Code Red', barnName: 'Waylon', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse',
    birthYear: 2007, status: 'BREEDING', generation: 4,
    sireRef: 'Blazing Hot', damRef: 'Vital Signs Are Good',
    notes: 'AQHA #4986316. Foundation sire. 15.3h Red Roan. Purchased $1,000,000 (VS Dispersal Sale, Aug 2023). 788 AQHA foals, $2M+ offspring earnings. Standing at Highpoint Performance Horses.',
    tags: ['Stallion', 'Show Horse'],
    color: 'Red Roan',
  },
  {
    name: 'First Thingz First', barnName: 'Denver', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse',
    birthYear: 2021, status: 'BREEDING', generation: 5,
    sireRef: 'RL Best of Sudden', damRef: 'VS The First Lady',
    notes: '16.0h Red Roan. Purchased May 2024 from Capall Creek Farm. First foals expected 2026. Trained/shown by Aaron Moses. Standing at Highpoint Performance Horses.',
    tags: ['Stallion', 'Show Horse'],
    color: 'Red Roan',
  },
  {
    name: 'RS Wanted N Dallas', barnName: 'Dallas', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse',
    birthYear: 2023, status: 'PROSPECT', generation: 5,
    sireRef: 'VS Code Red', damRef: 'Goodygoody Gumdrops',
    notes: 'Homebred stallion prospect. Retained for potential breeding career.',
    tags: ['Stallion'],
  },
];

// ── BROODMARES ───────────────────────────────────────────────────────

export const KVS_BROODMARES: AnimalDef[] = [
  {
    name: 'VS The First Lady', barnName: 'Kennedy', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2015, status: 'BREEDING', generation: 4,
    sireRef: 'VS Code Red', damRef: 'Cool Lookin Lady',
    notes: '$50,495 LTE. Congress Masters Champion, 4x NSBA WC, 2x AQHA WC, AQHYA Reserve WC, 2x Tom Powers Futurity Champion. Dam of Denver.',
    tags: ['Broodmare', 'Show Horse'],
    color: 'Red Roan',
  },
  {
    name: 'Red Carpet Debut', barnName: 'Erlene', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2017, status: 'BREEDING', generation: 4,
    sireRef: 'Allocate Your Assets', damRef: 'Red Carpet Rita',
    notes: 'HUS competitor. 6th AQHA L2 Junior HUS. First-time mother in 2025 — foal Noelle born premature.',
    tags: ['Broodmare'],
    color: 'Sorrel',
  },
  {
    name: 'Hot Pistol Annie', barnName: 'Annie', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2016, status: 'BREEDING', generation: 4,
    sireRef: 'Hot N Blazing', damRef: 'Vested Wishes',
    notes: 'Homebred (Katie purchased the embryo). Shares Blazing Hot blood with VS Code Red. Struggles to conceive while nursing. Known 345-day gestation history.',
    tags: ['Broodmare'],
  },
  {
    name: 'Gone Commando', barnName: 'Rikki', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2019, status: 'BREEDING', generation: 4,
    sireRef: 'Gone Viral', damRef: 'Only A Sterling Moon',
    notes: 'Purchased from Karen Carter (Chesterfield, VA). 3x Congress Champion, NSBA WC, Superior Open & Amateur WP. Maiden mare for 2026. Trainer: Taft Dickerson.',
    tags: ['Broodmare', 'Show Horse'],
    color: 'Bay',
  },
  {
    name: 'Ginger', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2019, status: 'BREEDING', generation: 5,
    sireRef: 'VS Code Red',
    notes: 'Homebred (dam: Beyonce). 2026 breeding to Making Me Willie Wild failed (retained fluid).',
    tags: ['Broodmare'],
  },
  {
    name: 'Kat Tails R Blazing', barnName: 'Trudy', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2016, status: 'ACTIVE', generation: 4,
    notes: 'On breeding break ("freeloader"). Embryo donor. Offspring: Hank, Daphne. 2026 embryo carried by Charlotte.',
    tags: ['Freeloader', 'Donor Mare'],
  },
  {
    name: 'Beyonce', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2012, status: 'BREEDING', generation: 3,
    notes: 'Donor mare only — cannot carry due to injury. Produces embryos carried by surrogates. Offspring: Ginger, Stevie, Freddy (all by VS Code Red).',
    tags: ['Donor Mare'],
  },
  {
    name: 'Marilynn Monroe', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2018, status: 'BREEDING', generation: 4,
    sireRef: 'Machine Made',
    notes: 'AQHA/APHA dual-registered. Donor mare (does not reside at Running Springs). Congress Championship Youth 12-14 WP, $7,750 LTE. Offspring: Cash (ICSI foal by VS Code Red).',
    tags: ['Donor Mare'],
    color: 'Sorrel',
  },
  {
    name: 'Goodygoody Gumdrops', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2007, status: 'DECEASED', generation: 3,
    sireRef: 'Zippos Mr Good Bar', damRef: 'Jet Set Five',
    notes: 'Deceased Oct 2024 (age 17). One of the greatest producers in modern AQHA — 5 Congress Champions from first 6 foals. 2,050+ AQHA pts across offspring, $125K+ offspring earnings. Legacy embryos exist.',
    tags: ['Broodmare'],
    color: 'Bay',
  },
  {
    name: 'La India Elegant', barnName: 'Indy', species: 'HORSE', sex: 'FEMALE', breed: 'Thoroughbred',
    birthYear: 2014, status: 'BREEDING', generation: 3,
    sireRef: 'Phonetics',
    notes: 'Thoroughbred mare. Appendix crosses. Dam of RS Black Ice & Wheezy. 2026: bred to VS Code Red, due Feb 7.',
    tags: ['Broodmare'],
  },
];

// ── RECIPIENT MARES ──────────────────────────────────────────────────

export const KVS_RECIPIENTS: AnimalDef[] = [
  {
    name: 'Phoebe', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2012, status: 'BREEDING', generation: 3,
    notes: 'PB106 (unregistered). Rescued mare, leased recipient. History of embryo absorption (lost at 27 days). On Regumate protocol.',
    tags: ['Recipient Mare'],
  },
  {
    name: 'Opal', species: 'HORSE', sex: 'FEMALE', breed: 'Thoroughbred',
    birthYear: 2010, status: 'ACTIVE', generation: 3,
    notes: 'Jersey Hottie. Retired racehorse, recipient mare.',
    tags: ['Recipient Mare'],
  },
  {
    name: 'Willow', species: 'HORSE', sex: 'FEMALE', breed: 'Thoroughbred',
    birthYear: 2013, status: 'BREEDING', generation: 3,
    notes: 'Willie U. Rescued retired racer. 2026: carrying Trudy x Good Better Best embryo.',
    tags: ['Recipient Mare'],
  },
  {
    name: 'Charlotte', species: 'HORSE', sex: 'FEMALE', breed: 'Thoroughbred',
    birthYear: 2020, status: 'BREEDING', generation: 3,
    notes: 'Moro Charlotte. Rescued from Oklahoma kill pen. 2026: carrying Trudy x First Thingz First embryo, due Feb 12.',
    tags: ['Recipient Mare'],
  },
  {
    name: 'Maggie', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2011, status: 'BREEDING', generation: 3,
    notes: 'Brendas Doll. Seasoned broodmare/recipient. 2026: carrying VS The First Lady x Machine Made embryo. Caslick procedure performed.',
    tags: ['Recipient Mare'],
  },
  {
    name: 'Gracie', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2013, status: 'BREEDING', generation: 3,
    notes: 'Recipient mare. History of premature foaling complications.',
    tags: ['Recipient Mare'],
  },
  {
    name: 'Happy', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2012, status: 'BREEDING', generation: 3,
    notes: 'Recipient mare. Tends to foal early. 2025: carried Marilyn Monroe x VS Code Red. 2026: carrying First Thingz First embryo.',
    tags: ['Recipient Mare'],
  },
  {
    name: 'Ethel', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2011, status: 'ACTIVE', generation: 3,
    notes: 'Surrogate. 2025: carried Beyonce x VS Code Red. 2026: intentionally open.',
    tags: ['Recipient Mare'],
  },
  {
    name: 'Raven', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2014, status: 'BREEDING', generation: 3,
    notes: 'Recipient mare. 2026: carrying Only Blue Couture x VS Code Red, due Jan 20. Tracked at 339-345 days gestation.',
    tags: ['Recipient Mare'],
  },
  {
    name: 'Lexy', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2015, status: 'BREEDING', generation: 3,
    notes: 'New addition, palomino grade mare. 2026: carrying Waffle House x VS Code Red, due Mar 12.',
    tags: ['Recipient Mare'],
    color: 'Palomino',
  },
];

// ── FOALS & YOUNG STOCK ──────────────────────────────────────────────

export const KVS_FOALS: AnimalDef[] = [
  {
    name: 'RS Son of a Gun', barnName: 'Huckleberry', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse',
    birthYear: 2024, status: 'ACTIVE', generation: 5,
    sireRef: 'VS Code Red', damRef: 'Hot Pistol Annie',
    tags: ['Foal'],
  },
  {
    name: 'RS Kopy Kat', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2024, status: 'ACTIVE', generation: 5,
    sireRef: 'VS Code Red',
    tags: ['Foal'],
  },
  {
    name: 'RS Ruby Red Slippers', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2024, status: 'ACTIVE', generation: 5,
    sireRef: 'VS Code Red',
    tags: ['Foal'],
  },
  {
    name: 'RS Code Fred', barnName: 'Freddy', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse',
    birthYear: 2024, status: 'ACTIVE', generation: 5,
    sireRef: 'Cool Breeze', damRef: 'Ginger',
    notes: 'Full sibling to Ginger x Cool Breeze 2025 foal.',
    tags: ['Foal'],
  },
  {
    name: 'RS Black Ice', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse',
    birthYear: 2024, status: 'ACTIVE', generation: 5,
    sireRef: 'Full Medal Jacket', damRef: 'La India Elegant',
    notes: 'Yearling stallion prospect. Appendix cross.',
    tags: ['Foal'],
  },
  {
    name: 'RS Full of Elegance', barnName: 'Wheezy', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2024, status: 'ACTIVE', generation: 5,
    sireRef: 'Full Medal Jacket', damRef: 'La India Elegant',
    notes: 'Yearling filly. In training off-property. Appendix.',
    tags: ['Foal'],
  },
  // 2025 foals (offspring of 2025 breeding plans — promoted to Animal records)
  {
    name: 'Noelle', barnName: 'Baby Noelle', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthDate: '2024-12-28', status: 'ACTIVE', generation: 5,
    sireRef: 'VS Code Red', damRef: 'Red Carpet Debut',
    notes: 'Born premature (before Jan 1). Erlene\'s first foal. Survived.',
    tags: ['Foal'],
  },
  {
    name: 'Kirby', species: 'HORSE', sex: 'MALE', breed: 'Quarter Horse',
    birthDate: '2025-01-29', status: 'DECEASED', generation: 5,
    sireRef: 'Machine Made', damRef: 'VS The First Lady',
    notes: 'Died August 2025 — pasture accident. Full sibling to 2026 Maggie embryo.',
    tags: ['Foal'],
  },
];

// ── OTHER HORSES ─────────────────────────────────────────────────────

export const KVS_OTHER_HORSES: AnimalDef[] = [
  {
    name: 'Bodeous Legacy', barnName: 'Bo', species: 'HORSE', sex: 'MALE', breed: 'Paint Horse',
    birthYear: 2005, status: 'RETIRED', generation: 3,
    notes: 'APHA registered. Oldest horse on farm. Retired companion.',
    tags: ['Freeloader'],
  },
  {
    name: 'Sophie', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2014, status: 'ACTIVE', generation: 3,
    notes: '"Freeloader" mare, on breeding break.',
    tags: ['Freeloader'],
  },
  {
    name: 'RS MarryAMillionaire', barnName: 'Millie', species: 'HORSE', sex: 'FEMALE', breed: 'Quarter Horse',
    birthYear: 2023, status: 'ACTIVE', generation: 5,
    notes: 'Young mare.',
  },
];

// ── MINI HORSES ──────────────────────────────────────────────────────

export const KVS_MINI_HORSES: AnimalDef[] = [
  {
    name: 'Rowan Creek Chasinthat Neon Rainbow', barnName: 'Regina', species: 'HORSE', sex: 'FEMALE', breed: 'Miniature Horse',
    birthYear: 2019, status: 'BREEDING', generation: 4,
    notes: 'AMHA, AMHR, ASPC registered. Ex-show horse, dam. "Mean Girls" naming theme.',
    tags: ['Mini', 'Broodmare'],
  },
  {
    name: 'Rayvic Jocomotions Contessa', barnName: 'Coco', species: 'HORSE', sex: 'FEMALE', breed: 'Miniature Horse',
    birthYear: 2017, status: 'BREEDING', generation: 4,
    notes: 'Triple-registered. Currently in foal.',
    tags: ['Mini', 'Broodmare'],
  },
  {
    name: 'Los Arboles Silver Hawk', barnName: 'Karen', species: 'HORSE', sex: 'FEMALE', breed: 'Miniature Horse',
    birthYear: 2010, status: 'BREEDING', generation: 3,
    notes: 'AMHA, AMHR registered. White mare. Sire: "Nighthawk" (legendary line).',
    tags: ['Mini', 'Broodmare'],
    color: 'White',
  },
  {
    name: 'Hills Sweet Melissa', barnName: 'Janice', species: 'HORSE', sex: 'FEMALE', breed: 'Miniature Horse',
    birthYear: 2015, status: 'BREEDING', generation: 3,
    notes: 'AMHR registered. Mother of Jack.',
    tags: ['Mini', 'Broodmare'],
  },
  {
    name: 'Running Springs Jack on the Roxx', barnName: 'Jack', species: 'HORSE', sex: 'MALE', breed: 'Miniature Horse',
    birthYear: 2024, status: 'ACTIVE', generation: 5,
    damRef: 'Hills Sweet Melissa',
    notes: 'Dual-registered (pending). Sire: ERL Cutty Roxx the House.',
    tags: ['Mini', 'Foal'],
  },
  {
    name: 'NMotions Rulers Fashionista', barnName: 'Gretchen', species: 'HORSE', sex: 'FEMALE', breed: 'Miniature Horse',
    birthYear: 2024, status: 'ACTIVE', generation: 5,
    notes: 'Kids\' horse prospect.',
    tags: ['Mini'],
  },
];

// ── NIGERIAN DWARF GOATS ─────────────────────────────────────────────

export const KVS_GOATS: AnimalDef[] = [
  { name: 'Bella', species: 'GOAT', sex: 'FEMALE', breed: 'Nigerian Dwarf', birthYear: 2022, status: 'ACTIVE', generation: 4 },
  { name: 'Blossom', species: 'GOAT', sex: 'FEMALE', breed: 'Nigerian Dwarf', birthYear: 2022, status: 'ACTIVE', generation: 4 },
  { name: 'Buttercup', species: 'GOAT', sex: 'FEMALE', breed: 'Nigerian Dwarf', birthYear: 2022, status: 'ACTIVE', generation: 4 },
  { name: 'Honey', species: 'GOAT', sex: 'FEMALE', breed: 'Nigerian Dwarf', birthYear: 2023, status: 'ACTIVE', generation: 4 },
  { name: 'Bee', species: 'GOAT', sex: 'FEMALE', breed: 'Nigerian Dwarf', birthYear: 2023, status: 'ACTIVE', generation: 4 },
  { name: 'Bubbles', species: 'GOAT', sex: 'FEMALE', breed: 'Nigerian Dwarf', birthYear: 2024, status: 'ACTIVE', generation: 4 },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 5 — GENETICS
// ══════════════════════════════════════════════════════════════════════

export interface GeneticsDef {
  animalRef: string;
  testProvider?: string;
  testDate?: string;       // ISO date string, defaults to '2024-01-01' if not set
  coatColor?: LocusData[];
  health?: LocusData[];
}

export const KVS_GENETICS: GeneticsDef[] = [
  {
    animalRef: 'VS Code Red',
    testProvider: 'UC Davis VGL',
    coatColor: [
      locus('E', 'Extension', 'E', 'e'),      // Red roan base
      locus('A', 'Agouti', 'A', 'a'),
      locus('Rn', 'Roan', 'Rn', 'rn'),        // Heterozygous roan
    ],
    health: sixPanelClear(),
  },
  {
    animalRef: 'First Thingz First',
    testProvider: 'UC Davis VGL',
    coatColor: [
      locus('E', 'Extension', 'E', 'e'),
      locus('A', 'Agouti', 'A', 'a'),
      locus('Rn', 'Roan', 'Rn', 'rn'),
    ],
    health: sixPanelClear(),
  },
  {
    animalRef: 'Gone Commando',
    testProvider: 'UC Davis VGL',
    coatColor: [
      locus('E', 'Extension', 'E', 'E'),      // Bay
      locus('A', 'Agouti', 'A', 'A'),
    ],
    health: sixPanelClear(),
  },
  {
    animalRef: 'Full Medal Jacket',
    testProvider: 'UC Davis VGL',
    coatColor: [
      locus('E', 'Extension', 'E', 'E'),      // Black base
      locus('A', 'Agouti', 'a', 'a'),         // Homozygous recessive → black
    ],
    health: [
      ...sixPanelClear(),
      healthLocus('EJSCA', 'JCA (7-Panel)', 'N/N'),
    ],
  },
  {
    animalRef: 'Machine Made',
    testProvider: 'UC Davis VGL',
    coatColor: [
      locus('E', 'Extension', 'E', 'E'),
      locus('A', 'Agouti', 'A', 'a'),
    ],
    health: [
      healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'N/N'),
      healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/GBED'),  // Carrier!
      healthLocus('HERDA', 'Hereditary Equine Regional Dermal Asthenia', 'N/N'),
      healthLocus('OLWS', 'Overo Lethal White Syndrome', 'N/N'),
      healthLocus('PSSM', 'Polysaccharide Storage Myopathy', 'N/N'),
    ],
  },

  // ── Kennedy (VS The First Lady) ────────────────────────────────────────
  // GBED carrier — both she AND Machine Made are N/GBED, meaning any foal
  // they produce together has a 25% chance of being GBED-affected.
  // This is the critical context behind Kirby's story and the 2026 Maggie embryo.
  {
    animalRef: 'VS The First Lady',
    testProvider: 'UC Davis VGL',
    coatColor: [
      locus('E', 'Extension', 'E', 'e'),      // Sorrel/chestnut base
      locus('A', 'Agouti', 'A', 'a'),
    ],
    health: [
      healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'N/N'),
      healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/GBED'),  // Carrier!
      healthLocus('HERDA', 'Hereditary Equine Regional Dermal Asthenia', 'N/N'),
      healthLocus('OLWS', 'Overo Lethal White Syndrome', 'N/N'),
      healthLocus('PSSM', 'Polysaccharide Storage Myopathy', 'N/N'),
      healthLocus('MH', 'Malignant Hyperthermia', 'N/N'),
    ],
  },

  // ── Kirby ──────────────────────────────────────────────────────────────
  // Kennedy × Machine Made 2025 colt. Died August 2025 from a pasture accident.
  // Post-mortem genetic panel confirmed N/GBED carrier — he inherited one copy
  // from each parent. The 2026 Maggie embryo is his full sibling (same parents).
  // Test dated September 2025 (post-mortem).
  {
    animalRef: 'Kirby',
    testProvider: 'UC Davis VGL',
    testDate: '2025-09-10',
    coatColor: [
      locus('E', 'Extension', 'E', 'e'),
      locus('A', 'Agouti', 'A', 'a'),         // Bay
    ],
    health: [
      healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'N/N'),
      healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/GBED'),  // Carrier — inherited from both parents
      healthLocus('HERDA', 'Hereditary Equine Regional Dermal Asthenia', 'N/N'),
      healthLocus('OLWS', 'Overo Lethal White Syndrome', 'N/N'),
      healthLocus('PSSM', 'Polysaccharide Storage Myopathy', 'N/N'),
      healthLocus('MH', 'Malignant Hyperthermia', 'N/N'),
    ],
  },

  // ── Raven (Only Blue Couture — recipient mare) ─────────────────────────
  // The Gray (G) locus is why Katie predicts a "gray filly" (Violet) from
  // Raven × VS Code Red. Raven carries one copy of Gray (G/g), so 50% of
  // her foals will be gray regardless of sire. VS Code Red passes his roan
  // but the gray is dominant — the foal would gray out over time.
  {
    animalRef: 'Raven',
    testProvider: 'UC Davis VGL',
    coatColor: [
      locus('E', 'Extension', 'E', 'E'),      // Black/bay base
      locus('A', 'Agouti', 'A', 'a'),         // Bay base
      locus('G', 'Gray', 'G', 'g'),           // Heterozygous gray — 50% of foals will be gray
    ],
    health: sixPanelClear(),
  },

  // ── Kat Tails R Blazing (Trudy) — Charlotte's genetic dam ─────────────
  // Trudy is bay roan (Rn/rn). When her embryo is implanted into Charlotte
  // and bred to Denver (First Thingz First, also Rn/rn), the result has a
  // 50% chance of being roan — consistent with Katie's "bay roan filly" prediction.
  {
    animalRef: 'Kat Tails R Blazing',
    testProvider: 'UC Davis VGL',
    coatColor: [
      locus('E', 'Extension', 'E', 'E'),      // Bay base
      locus('A', 'Agouti', 'A', 'a'),
      locus('Rn', 'Roan', 'Rn', 'rn'),        // Bay roan — matches phenotype
    ],
    health: sixPanelClear(),
  },

  // ── Rowan Creek Chasinthat Neon Rainbow (Regina) — mini mare ──────────
  // Silver dapple (Z/z) on bay base produces a horse with flaxen mane/tail
  // and a chocolate-tinted body. Common and striking in miniature horses.
  // The Silver gene (Z) is linked to MCOA (Multiple Congenital Ocular
  // Abnormalities) — breeders should screen silver dapple foals' eyes.
  {
    animalRef: 'Rowan Creek Chasinthat Neon Rainbow',
    testProvider: 'Veterinary Genetics Laboratory',
    coatColor: [
      locus('E', 'Extension', 'E', 'E'),      // Black/bay base
      locus('A', 'Agouti', 'A', 'a'),         // Bay base
      locus('Z', 'Silver', 'Z', 'z'),         // Silver dapple carrier — the flashy mane/tail color
    ],
    health: [
      healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'N/N'),
      healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/N'),
      healthLocus('HERDA', 'Hereditary Equine Regional Dermal Asthenia', 'N/N'),
      healthLocus('OLWS', 'Overo Lethal White Syndrome', 'N/N'),
      healthLocus('PSSM', 'Polysaccharide Storage Myopathy', 'N/N'),
      healthLocus('MCOA', 'Multiple Congenital Ocular Abnormalities (Silver-linked)', 'MCOA/n'),  // At-risk — linked to Z gene
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 6 — REGISTRY IDENTIFIERS
// ══════════════════════════════════════════════════════════════════════

export interface RegistryIdDef {
  animalRef: string;
  registryName: string;    // Must match Registry.name seeded in seed-registries.ts
  identifier: string;
}

export const KVS_REGISTRATIONS: RegistryIdDef[] = [
  { animalRef: 'VS Code Red', registryName: 'American Quarter Horse Association', identifier: '4986316' },
  { animalRef: 'First Thingz First', registryName: 'American Quarter Horse Association', identifier: '6102847' },
  { animalRef: 'Gone Commando', registryName: 'American Quarter Horse Association', identifier: '5987321' },
  { animalRef: 'VS The First Lady', registryName: 'American Quarter Horse Association', identifier: '5621089' },
  { animalRef: 'Red Carpet Debut', registryName: 'American Quarter Horse Association', identifier: '5724653' },
  { animalRef: 'Hot Pistol Annie', registryName: 'American Quarter Horse Association', identifier: '5689012' },
  { animalRef: 'Goodygoody Gumdrops', registryName: 'American Quarter Horse Association', identifier: '4986204' },
  { animalRef: 'RS Son of a Gun', registryName: 'American Quarter Horse Association', identifier: '6201453' },
  { animalRef: 'RS Wanted N Dallas', registryName: 'American Quarter Horse Association', identifier: '6201802' },
  { animalRef: 'RS Code Fred', registryName: 'American Quarter Horse Association', identifier: '6201567' },
  { animalRef: 'RS Black Ice', registryName: 'American Quarter Horse Association', identifier: '6201789' },
  { animalRef: 'RS Full of Elegance', registryName: 'American Quarter Horse Association', identifier: '6201890' },
  { animalRef: 'Marilynn Monroe', registryName: 'American Quarter Horse Association', identifier: '5856432' },
  { animalRef: 'Marilynn Monroe', registryName: 'American Paint Horse Association', identifier: '1098765' },
  // Mini horses
  { animalRef: 'Rowan Creek Chasinthat Neon Rainbow', registryName: 'American Miniature Horse Registry', identifier: 'A-234567' },
  { animalRef: 'Los Arboles Silver Hawk', registryName: 'American Miniature Horse Registry', identifier: 'A-189023' },
  { animalRef: 'Hills Sweet Melissa', registryName: 'American Miniature Horse Registry', identifier: 'R-345678' },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 7 — REGISTRY PEDIGREES (position-coded ancestor trees)
// ══════════════════════════════════════════════════════════════════════

export interface RegistryPedigreeDef {
  animalRef: string;
  registryName: string;
  ancestors: {
    position: string;  // S, D, SS, SD, DS, DD, SSS, SSD, SDS, SDD, DSS, DSD, DDS, DDD
    generation: number;
    name: string;
    registrationNumber?: string;
    color?: string;
    birthYear?: number;
    sex: string;
  }[];
}

export const KVS_REGISTRY_PEDIGREES: RegistryPedigreeDef[] = [
  {
    animalRef: 'VS Code Red',
    registryName: 'American Quarter Horse Association',
    ancestors: [
      // Gen 1
      { position: 'S', generation: 1, name: 'Blazing Hot', birthYear: 1992, sex: 'M', color: 'Bay' },
      { position: 'D', generation: 1, name: 'Vital Signs Are Good', birthYear: 2000, sex: 'F', color: 'Red Roan' },
      // Gen 2
      { position: 'SS', generation: 2, name: 'Hotrodders Jet Set', birthYear: 1979, sex: 'M' },
      { position: 'SD', generation: 2, name: 'Tahnee Zippo', birthYear: 1982, sex: 'F' },
      { position: 'DS', generation: 2, name: 'Zippos Mr Good Bar', birthYear: 1984, sex: 'M', color: 'Roan' },
      { position: 'DD', generation: 2, name: 'Vitalism', birthYear: 1990, sex: 'F' },
      // Gen 3
      { position: 'SSS', generation: 3, name: 'Docs Hotrodder', birthYear: 1965, sex: 'M' },
      { position: 'SSD', generation: 3, name: 'Majors Jet', sex: 'F' },
      { position: 'SDS', generation: 3, name: 'Zippo Pine Bar', birthYear: 1969, sex: 'M' },
      { position: 'SDD', generation: 3, name: 'Unknown', sex: 'F' },
      { position: 'DSS', generation: 3, name: 'Zippo Pine Bar', birthYear: 1969, sex: 'M' },
      { position: 'DSD', generation: 3, name: 'Tamara Wess', birthYear: 1975, sex: 'F' },
      { position: 'DDS', generation: 3, name: 'An Awesome Mister', birthYear: 1985, sex: 'M' },
      { position: 'DDD', generation: 3, name: 'Unknown', sex: 'F' },
    ],
  },
  {
    animalRef: 'First Thingz First',
    registryName: 'American Quarter Horse Association',
    ancestors: [
      // Gen 1
      { position: 'S', generation: 1, name: 'RL Best of Sudden', birthYear: 2002, sex: 'M', color: 'Bay' },
      { position: 'D', generation: 1, name: 'VS The First Lady', birthYear: 2015, sex: 'F', color: 'Roan' },
      // Gen 2
      { position: 'SS', generation: 2, name: 'A Sudden Impulse', birthYear: 1991, sex: 'M' },
      { position: 'SD', generation: 2, name: 'Zip N Therapy', birthYear: 1990, sex: 'F' },
      { position: 'DS', generation: 2, name: 'VS Code Red', birthYear: 2007, sex: 'M', color: 'Red Roan' },
      { position: 'DD', generation: 2, name: 'Cool Lookin Lady', birthYear: 1997, sex: 'F', color: 'Sorrel' },
      // Gen 3
      { position: 'SSS', generation: 3, name: 'Impulsions', sex: 'M' },
      { position: 'SSD', generation: 3, name: 'Unknown', sex: 'F' },
      { position: 'SDS', generation: 3, name: 'Therapy', sex: 'M' },
      { position: 'SDD', generation: 3, name: 'Unknown', sex: 'F' },
      { position: 'DSS', generation: 3, name: 'Blazing Hot', birthYear: 1992, sex: 'M' },
      { position: 'DSD', generation: 3, name: 'Vital Signs Are Good', birthYear: 2000, sex: 'F' },
      { position: 'DDS', generation: 3, name: 'Dont Skip Zip', birthYear: 1990, sex: 'M' },
      { position: 'DDD', generation: 3, name: 'Unknown', sex: 'F' },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 8 — COMPETITION ENTRIES
// ══════════════════════════════════════════════════════════════════════

export interface CompetitionDef {
  animalRef: string;
  eventName: string;
  eventDate: string;
  location?: string;
  organization?: string;
  className?: string;
  placement?: number;
  placementLabel?: string;
  pointsEarned?: number;
  isMajorWin?: boolean;
  prizeMoneyCents?: number;
}

export const KVS_COMPETITIONS: CompetitionDef[] = [
  // ── VS Code Red ────────────────────────────────────────────────────
  { animalRef: 'VS Code Red', eventName: 'All American QH Congress', eventDate: '2009-10-15', location: 'Columbus, OH', organization: 'AQHA', className: 'Open 2YO Western Pleasure Futurity', placement: 1, placementLabel: 'Congress Champion', isMajorWin: true },
  { animalRef: 'VS Code Red', eventName: 'All American QH Congress', eventDate: '2009-10-16', location: 'Columbus, OH', organization: 'AQHA', className: 'Limited Open 2YO WP Futurity', placement: 1, placementLabel: 'Congress Champion', isMajorWin: true },
  { animalRef: 'VS Code Red', eventName: 'All American QH Congress', eventDate: '2009-10-17', location: 'Columbus, OH', organization: 'AQHA', className: 'Non-Pro 2YO WP Futurity', placement: 1, placementLabel: 'Congress Champion', isMajorWin: true },
  { animalRef: 'VS Code Red', eventName: 'Southern Belle Breeders', eventDate: '2009-10-18', location: 'Columbus, OH', organization: 'Southern Belle', className: 'Non-Pro 2YO WP Futurity', placement: 1, placementLabel: 'Champion', isMajorWin: true },
  { animalRef: 'VS Code Red', eventName: 'All American QH Congress', eventDate: '2011-10-12', location: 'Columbus, OH', organization: 'AQHA', className: 'Junior Western Riding', placement: 1, placementLabel: 'Congress Champion (unanimous)', isMajorWin: true },
  { animalRef: 'VS Code Red', eventName: 'All American QH Congress', eventDate: '2011-10-13', location: 'Columbus, OH', organization: 'AQHA', className: 'Green Western Riding', placement: 1, placementLabel: 'Congress Champion', isMajorWin: true },
  { animalRef: 'VS Code Red', eventName: 'NSBA World Championship', eventDate: '2012-08-20', location: 'Tulsa, OK', organization: 'NSBA', className: 'Junior Western Riding', placement: 1, placementLabel: 'World Champion', isMajorWin: true, prizeMoneyCents: 1500000 },
  { animalRef: 'VS Code Red', eventName: 'NSBA BCF World Show', eventDate: '2012-08-21', location: 'Tulsa, OK', organization: 'NSBA', className: '3-6YO Western Riding', placement: 1, placementLabel: 'BCF Champion', isMajorWin: true },
  { animalRef: 'VS Code Red', eventName: 'NSBA BCF World Show', eventDate: '2012-08-22', location: 'Tulsa, OK', organization: 'NSBA', className: 'Non-Pro 3-6YO Western Riding', placement: 1, placementLabel: 'BCF Champion', isMajorWin: true },
  { animalRef: 'VS Code Red', eventName: 'NSBA World Championship', eventDate: '2012-08-23', location: 'Tulsa, OK', organization: 'NSBA', className: 'Amateur Western Riding', placement: 2, placementLabel: 'Reserve World Champion' },
  { animalRef: 'VS Code Red', eventName: 'AQHA World Championship', eventDate: '2012-11-10', location: 'Oklahoma City, OK', organization: 'AQHA', className: 'Junior Western Riding', placement: 3, placementLabel: '3rd Place' },

  // ── First Thingz First (Denver) ────────────────────────────────────
  { animalRef: 'First Thingz First', eventName: 'All American QH Congress', eventDate: '2024-10-10', location: 'Columbus, OH', organization: 'AQHA', className: 'Open $10K Ltd Horse WP', placement: 1, placementLabel: 'Congress Champion', isMajorWin: true },
  { animalRef: 'First Thingz First', eventName: 'All American QH Congress', eventDate: '2024-10-11', location: 'Columbus, OH', organization: 'AQHA', className: 'Open Performance Halter Stallions', placement: 1, placementLabel: 'Congress Champion', isMajorWin: true },
  { animalRef: 'First Thingz First', eventName: 'All American QH Congress', eventDate: '2024-10-12', location: 'Columbus, OH', organization: 'AQHA', className: 'Ltd Amateur Performance Halter Stallions', placement: 1, placementLabel: 'Congress Champion', isMajorWin: true },
  { animalRef: 'First Thingz First', eventName: 'All American QH Congress', eventDate: '2024-10-13', location: 'Columbus, OH', organization: 'AQHA', className: 'Amateur Performance Halter Stallions', placement: 2, placementLabel: 'Reserve Congress Champion' },
  { animalRef: 'First Thingz First', eventName: 'NSBA at Congress', eventDate: '2024-10-10', location: 'Columbus, OH', organization: 'NSBA', className: 'Open $10K Ltd Horse WP', placement: 1, placementLabel: 'NSBA Champion', isMajorWin: true },
  { animalRef: 'First Thingz First', eventName: 'Southern Belle Breeders', eventDate: '2024-10-14', location: 'Columbus, OH', organization: 'Southern Belle', className: 'Open $10K Ltd Horse WP', placement: 1, placementLabel: 'Champion', isMajorWin: true },
  { animalRef: 'First Thingz First', eventName: 'AQHA World Championship', eventDate: '2024-11-15', location: 'Oklahoma City, OK', organization: 'AQHA', className: 'Super Sires Pleasure Versatility', placement: 2, placementLabel: 'Reserve (2nd)' },
  { animalRef: 'First Thingz First', eventName: 'AQHA World Championship', eventDate: '2024-11-15', location: 'Oklahoma City, OK', organization: 'AQHA', className: 'Fan Favorite Award', placement: 1, placementLabel: 'Winner (13,000+ votes)', isMajorWin: true },
  { animalRef: 'First Thingz First', eventName: 'NSBA BCF World Show', eventDate: '2025-07-18', location: 'Tulsa, OK', organization: 'NSBA', className: '$10K Maturity Ltd Horse Open WP', placement: 1, placementLabel: 'BCF World Champion', isMajorWin: true },
  { animalRef: 'First Thingz First', eventName: 'NSBA BCF World Show', eventDate: '2025-07-19', location: 'Tulsa, OK', organization: 'NSBA', className: 'Open Performance Halter Stallions', placement: 2, placementLabel: 'BCF Reserve World Champion' },
  { animalRef: 'First Thingz First', eventName: 'Back to Berrien', eventDate: '2025-08-10', organization: 'AQHA', className: 'Bridleless Western Pleasure', placement: 1, placementLabel: 'Champion', isMajorWin: true },
  { animalRef: 'First Thingz First', eventName: 'Back to Berrien', eventDate: '2025-08-11', organization: 'AQHA', className: 'NSBA THE DAC $2,500 Novice Horse Open WP', placement: 1, placementLabel: 'Champion', isMajorWin: true },

  // ── Gone Commando (Rikki) ──────────────────────────────────────────
  { animalRef: 'Gone Commando', eventName: 'All American QH Congress', eventDate: '2022-10-14', location: 'Columbus, OH', organization: 'AQHA', className: '3YO Non-Pro WP Futurity Limited', placement: 1, placementLabel: 'Congress Champion (unanimous)', isMajorWin: true },
  { animalRef: 'Gone Commando', eventName: 'Virginia Maiden', eventDate: '2022-09-20', organization: 'AQHA', className: '3YO+ Western Pleasure', placement: 1, placementLabel: 'Champion', isMajorWin: true, prizeMoneyCents: 1350000 },
  { animalRef: 'Gone Commando', eventName: 'NSBA World Championship', eventDate: '2023-08-15', location: 'Tulsa, OK', organization: 'NSBA', className: 'Western Pleasure', placement: 1, placementLabel: 'World Champion', isMajorWin: true },
  { animalRef: 'Gone Commando', eventName: 'NSBA World Championship', eventDate: '2023-08-16', location: 'Tulsa, OK', organization: 'NSBA', className: 'Reserve Western Pleasure', placement: 2, placementLabel: 'Reserve World Champion' },
  { animalRef: 'Gone Commando', eventName: 'All American QH Congress', eventDate: '2023-10-15', location: 'Columbus, OH', organization: 'AQHA', className: 'Amateur Western Pleasure', placement: 1, placementLabel: 'Congress Champion', isMajorWin: true },

  // ── VS The First Lady (Kennedy) ────────────────────────────────────
  { animalRef: 'VS The First Lady', eventName: 'All American QH Congress', eventDate: '2017-10-12', location: 'Columbus, OH', organization: 'AQHA', className: 'Masters 2YO WP', placement: 1, placementLabel: 'Congress Masters Champion', isMajorWin: true },
  { animalRef: 'VS The First Lady', eventName: 'NSBA World Championship', eventDate: '2018-08-14', location: 'Tulsa, OK', organization: 'NSBA', className: 'Western Pleasure', placement: 1, placementLabel: 'World Champion', isMajorWin: true },
  { animalRef: 'VS The First Lady', eventName: 'NSBA World Championship', eventDate: '2019-08-14', location: 'Tulsa, OK', organization: 'NSBA', className: 'Western Pleasure', placement: 1, placementLabel: 'World Champion', isMajorWin: true },
  { animalRef: 'VS The First Lady', eventName: 'Tom Powers Futurity', eventDate: '2017-11-05', organization: 'Tom Powers', className: '2YO Western Pleasure', placement: 1, placementLabel: 'Futurity Champion', isMajorWin: true },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 9 — BREEDING PROFILES
// ══════════════════════════════════════════════════════════════════════

export interface BreedingProfileDef {
  animalRef: string;
  breedingStatus: string;
  libido?: string;
  serviceType?: string;
  collectionTrained?: boolean;
  collectionNotes?: string;
  fertilityStatus?: string;
  fertilityNotes?: string;
  heatCycleRegularity?: string;
  pregnancyComplications?: string;
  proneToComplications?: boolean;
  generalNotes?: string;
}

export const KVS_BREEDING_PROFILES: BreedingProfileDef[] = [
  // Stallions
  {
    animalRef: 'VS Code Red',
    breedingStatus: 'INTACT',
    libido: 'HIGH',
    serviceType: 'AI',
    collectionTrained: true,
    collectionNotes: 'Collected at Highpoint Performance Horses, Pilot Point, TX. Christi Christenson manages.',
    generalNotes: '$5,000 stud fee (includes $600 non-refundable booking/chute fee). Frozen semen only.',
  },
  {
    animalRef: 'First Thingz First',
    breedingStatus: 'INTACT',
    libido: 'HIGH',
    serviceType: 'AI',
    collectionTrained: true,
    collectionNotes: 'Collected at Highpoint Performance Horses. Cooled (Feb 1 - Mar 13, 2026) & frozen year-round.',
    generalNotes: '$2,250 stud fee. First foals expected 2026. Available US, Canada, Europe, Australia.',
  },
  // Key broodmares
  {
    animalRef: 'Hot Pistol Annie',
    breedingStatus: 'INTACT',
    fertilityStatus: 'MODERATE',
    fertilityNotes: 'Struggles to conceive while nursing. Known 345-day gestation history (extends well past expected 340).',
    pregnancyComplications: 'Extended gestation (345 days). Difficulty conceiving while lactating.',
    proneToComplications: true,
  },
  {
    animalRef: 'Gone Commando',
    breedingStatus: 'INTACT',
    fertilityStatus: 'GOOD',
    generalNotes: 'Maiden mare for 2026 season. Bred to Hey Good Lookin.',
  },
  {
    animalRef: 'Beyonce',
    breedingStatus: 'INTACT',
    fertilityStatus: 'GOOD',
    fertilityNotes: 'Cannot carry due to injury. Donor only — produces embryos for surrogates.',
    generalNotes: 'Multiple successful embryo harvests. Offspring: Ginger, Stevie, Freddy.',
  },
  {
    animalRef: 'Goodygoody Gumdrops',
    breedingStatus: 'DECEASED',
    fertilityStatus: 'EXCELLENT',
    fertilityNotes: '5 Congress Champions from first 6 foals. Legendary producer. Legacy embryos available.',
  },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 10 — SEMEN INVENTORY
// ══════════════════════════════════════════════════════════════════════

export interface SemenBatchDef {
  stallionRef: string;
  batchNumber: string;
  collectionDate: string;
  storageType: 'FRESH' | 'COOLED' | 'FROZEN';
  storageFacility?: string;
  storageLocation?: string;
  initialDoses: number;
  availableDoses: number;
  qualityGrade?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  motility?: number;
  morphology?: number;
  concentration?: number;
  notes?: string;
}

export const KVS_SEMEN_INVENTORY: SemenBatchDef[] = [
  // VS Code Red — frozen batches
  { stallionRef: 'VS Code Red', batchNumber: 'VCR-2023-001', collectionDate: '2023-02-15', storageType: 'FROZEN', storageFacility: 'Highpoint Performance Horses', storageLocation: 'Pilot Point, TX', initialDoses: 20, availableDoses: 12, qualityGrade: 'EXCELLENT', motility: 85, morphology: 78, concentration: 250 },
  { stallionRef: 'VS Code Red', batchNumber: 'VCR-2024-001', collectionDate: '2024-01-20', storageType: 'FROZEN', storageFacility: 'Highpoint Performance Horses', storageLocation: 'Pilot Point, TX', initialDoses: 25, availableDoses: 18, qualityGrade: 'EXCELLENT', motility: 88, morphology: 82, concentration: 275 },
  { stallionRef: 'VS Code Red', batchNumber: 'VCR-2024-002', collectionDate: '2024-03-10', storageType: 'FROZEN', storageFacility: 'Highpoint Performance Horses', storageLocation: 'Pilot Point, TX', initialDoses: 20, availableDoses: 15, qualityGrade: 'EXCELLENT', motility: 86, morphology: 80, concentration: 260 },
  { stallionRef: 'VS Code Red', batchNumber: 'VCR-2025-001', collectionDate: '2025-02-05', storageType: 'FROZEN', storageFacility: 'Highpoint Performance Horses', storageLocation: 'Pilot Point, TX', initialDoses: 30, availableDoses: 24, qualityGrade: 'EXCELLENT', motility: 90, morphology: 84, concentration: 280 },
  // First Thingz First — frozen batches
  { stallionRef: 'First Thingz First', batchNumber: 'FTF-2025-001', collectionDate: '2025-02-20', storageType: 'FROZEN', storageFacility: 'Highpoint Performance Horses', storageLocation: 'Pilot Point, TX', initialDoses: 15, availableDoses: 10, qualityGrade: 'EXCELLENT', motility: 82, morphology: 76, concentration: 240 },
  { stallionRef: 'First Thingz First', batchNumber: 'FTF-2025-002', collectionDate: '2025-04-15', storageType: 'FROZEN', storageFacility: 'Highpoint Performance Horses', storageLocation: 'Pilot Point, TX', initialDoses: 20, availableDoses: 16, qualityGrade: 'GOOD', motility: 78, morphology: 74, concentration: 230 },
  { stallionRef: 'First Thingz First', batchNumber: 'FTF-2026-001', collectionDate: '2026-01-10', storageType: 'COOLED', storageFacility: 'Highpoint Performance Horses', storageLocation: 'Pilot Point, TX', initialDoses: 5, availableDoses: 3, qualityGrade: 'EXCELLENT', motility: 90, morphology: 82, concentration: 260, notes: 'Cooled semen available Feb 1 - Mar 13, 2026.' },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 11 — BREEDING PLANS
// ══════════════════════════════════════════════════════════════════════

export interface BreedingPlanDef {
  name: string;
  nickname?: string;
  damRef: string;          // carrier mare
  sireRef: string;
  donorDamRef?: string;    // genetic dam if different from carrier (ET)
  species: 'HORSE';
  breedText?: string;
  method: string;
  status: string;
  notes?: string;
  expectedBirthDate?: string;
  breedDateActual?: string;
  birthDateActual?: string;
  completedDateActual?: string;
  tags?: string[];
}

// 2025 — COMPLETED PLANS
export const KVS_PLANS_2025: BreedingPlanDef[] = [
  {
    name: 'Erlene x VS Code Red 2025',
    nickname: 'Baby Noelle',
    damRef: 'Red Carpet Debut',
    sireRef: 'VS Code Red',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'AI_FROZEN',
    status: 'COMPLETE',
    expectedBirthDate: '2025-01-16',
    breedDateActual: '2024-02-10',
    birthDateActual: '2024-12-28',
    completedDateActual: '2025-06-01',
    notes: 'First-time mother. Foal (Noelle) born premature before Jan 1. Healthy.',
    tags: ['2025 Season'],
  },
  {
    name: 'Kennedy x Machine Made 2025',
    nickname: 'Kirby',
    damRef: 'VS The First Lady',
    sireRef: 'Machine Made',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'AI_FROZEN',
    status: 'COMPLETE',
    expectedBirthDate: '2025-01-29',
    breedDateActual: '2024-02-22',
    birthDateActual: '2025-01-29',
    completedDateActual: '2025-08-15',
    notes: 'Colt (Kirby) born healthy. Died August 2025 — pasture accident. Congress champion dam x #1 WP sire.',
    tags: ['2025 Season'],
  },
  {
    name: 'Ginger x Cool Breeze 2025',
    damRef: 'Ginger',
    sireRef: 'Cool Breeze',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'AI_FROZEN',
    status: 'COMPLETE',
    expectedBirthDate: '2025-02-10',
    breedDateActual: '2024-03-05',
    birthDateActual: '2025-02-10',
    completedDateActual: '2025-08-01',
    notes: 'Full sibling to RS Code Fred (Freddy). Healthy foal.',
    tags: ['2025 Season'],
  },
  {
    name: 'Beyonce (Ethel) x VS Code Red 2025',
    nickname: 'Beyonce x Waylon Baby',
    damRef: 'Ethel',
    sireRef: 'VS Code Red',
    donorDamRef: 'Beyonce',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'EMBRYO_TRANSFER',
    status: 'COMPLETE',
    expectedBirthDate: '2025-02-11',
    breedDateActual: '2024-03-08',
    birthDateActual: '2025-02-11',
    completedDateActual: '2025-08-01',
    notes: 'Embryo transfer. Genetic dam: Beyonce. Carrier: Ethel.',
    tags: ['2025 Season', 'Embryo Transfer'],
  },
  {
    name: 'Annie x Cool Ladies Man 2025',
    damRef: 'Hot Pistol Annie',
    sireRef: 'Cool Ladys Man',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'AI_FROZEN',
    status: 'COMPLETE',
    expectedBirthDate: '2025-02-21',
    breedDateActual: '2024-03-15',
    birthDateActual: '2025-02-25',
    completedDateActual: '2025-08-15',
    notes: 'Annie\'s known 345-day gestation. Foal arrived 4 days late. Healthy.',
    tags: ['2025 Season'],
  },
  {
    name: 'Gumdrops (Phoebe) x VS Code Red 2025',
    nickname: 'Legacy Baby',
    damRef: 'Phoebe',
    sireRef: 'VS Code Red',
    donorDamRef: 'Goodygoody Gumdrops',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'EMBRYO_TRANSFER',
    status: 'COMPLETE',
    expectedBirthDate: '2025-03-13',
    breedDateActual: '2024-04-05',
    birthDateActual: '2025-03-13',
    completedDateActual: '2025-09-01',
    notes: 'Legacy embryo from Goodygoody Gumdrops (deceased). Sexed semen targeting stallion prospect. ET + sexed semen.',
    tags: ['2025 Season', 'Embryo Transfer', 'Sexed Semen'],
  },
  {
    name: 'Beyonce (Gracie) x VS Code Red 2025',
    damRef: 'Gracie',
    sireRef: 'VS Code Red',
    donorDamRef: 'Beyonce',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'EMBRYO_TRANSFER',
    status: 'COMPLETE',
    expectedBirthDate: '2025-03-14',
    breedDateActual: '2024-04-07',
    birthDateActual: '2025-03-12',
    completedDateActual: '2025-09-01',
    notes: 'Gracie has premature foaling complications history. Foal arrived 2 days early but healthy.',
    tags: ['2025 Season', 'Embryo Transfer'],
  },
  {
    name: 'Marilyn (Happy) x VS Code Red 2025',
    damRef: 'Happy',
    sireRef: 'VS Code Red',
    donorDamRef: 'Marilynn Monroe',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'EMBRYO_TRANSFER',
    status: 'COMPLETE',
    expectedBirthDate: '2025-04-15',
    breedDateActual: '2024-05-10',
    birthDateActual: '2025-04-12',
    completedDateActual: '2025-10-01',
    notes: 'Happy tends to foal early. Born 3 days ahead of schedule.',
    tags: ['2025 Season', 'Embryo Transfer'],
  },
];

// 2026 — ACTIVE PLANS
export const KVS_PLANS_2026: BreedingPlanDef[] = [
  {
    name: 'Raven x VS Code Red 2026',
    nickname: 'Violet',
    damRef: 'Raven',
    sireRef: 'VS Code Red',
    donorDamRef: 'Only Blue Couture',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'EMBRYO_TRANSFER',
    status: 'PREGNANT',
    expectedBirthDate: '2026-01-20',
    breedDateActual: '2025-02-14',
    notes: 'Genetic dam: Only Blue Couture. Raven tracked at 339-345 days gestation. Katie predicts gray filly.',
    tags: ['2026 Season', 'Embryo Transfer'],
  },
  {
    name: 'Indy x VS Code Red 2026',
    damRef: 'La India Elegant',
    sireRef: 'VS Code Red',
    species: 'HORSE',
    breedText: 'Appendix Quarter Horse',
    method: 'AI_FROZEN',
    status: 'PREGNANT',
    expectedBirthDate: '2026-02-07',
    breedDateActual: '2025-03-01',
    notes: 'Appendix cross (TB dam). Katie predicts dark bay colt.',
    tags: ['2026 Season'],
  },
  {
    name: 'Rikki x Hey Good Lookin 2026',
    nickname: 'Rikki\'s Red Baby',
    damRef: 'Gone Commando',
    sireRef: 'Hey Good Lookin',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'AI_FROZEN',
    status: 'PREGNANT',
    expectedBirthDate: '2026-02-09',
    breedDateActual: '2025-03-03',
    notes: 'Maiden mare. Katie predicts red colt. Hey Good Lookin = 2025 Super Sires Stallion of the Year.',
    tags: ['2026 Season'],
  },
  {
    name: 'Charlotte x Denver 2026',
    nickname: 'Trudy x Denver Baby',
    damRef: 'Charlotte',
    sireRef: 'First Thingz First',
    donorDamRef: 'Kat Tails R Blazing',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'EMBRYO_TRANSFER',
    status: 'PREGNANT',
    expectedBirthDate: '2026-02-12',
    breedDateActual: '2025-03-06',
    notes: 'Genetic dam: Trudy (Kat Tails R Blazing). Katie predicts bay roan filly. Denver\'s first crop!',
    tags: ['2026 Season', 'Embryo Transfer'],
  },
  {
    name: 'Lexy x VS Code Red 2026',
    damRef: 'Lexy',
    sireRef: 'VS Code Red',
    donorDamRef: 'Waffle House',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'EMBRYO_TRANSFER',
    status: 'PREGNANT',
    expectedBirthDate: '2026-03-12',
    breedDateActual: '2025-04-05',
    notes: 'Genetic dam: Waffle House. Katie predicts bay roan colt.',
    tags: ['2026 Season', 'Embryo Transfer'],
  },
  {
    name: 'Phoebe x RL Best of Sudden 2026',
    nickname: 'Denver\'s Full Sibling',
    damRef: 'Phoebe',
    sireRef: 'RL Best of Sudden',
    donorDamRef: 'BS The First Lady',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'AI_FROZEN',
    status: 'PREGNANT',
    expectedBirthDate: '2026-03-24',
    breedDateActual: '2025-04-18',
    notes: 'FULL SIBLING TO DENVER! Genetic dam: BS The First Lady. Phoebe on Regumate (history of embryo absorption at 27 days). June 2 check: 19 days, confirmed. June 20: heartbeat confirmed.',
    tags: ['2026 Season'],
  },
  {
    name: 'Maggie x Machine Made 2026',
    nickname: 'Kirby\'s Full Sibling',
    damRef: 'Maggie',
    sireRef: 'Machine Made',
    donorDamRef: 'VS The First Lady',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'EMBRYO_TRANSFER',
    status: 'PREGNANT',
    expectedBirthDate: '2026-04-10',
    breedDateActual: '2025-05-05',
    notes: 'Genetic dam: Kennedy (VS The First Lady). Full sibling to Kirby (deceased). Maggie had Caslick procedure. June 20: heartbeat confirmed.',
    tags: ['2026 Season', 'Embryo Transfer'],
  },
  {
    name: 'Annie x Denver 2026',
    damRef: 'Hot Pistol Annie',
    sireRef: 'First Thingz First',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'AI_FROZEN',
    status: 'PREGNANT',
    expectedBirthDate: '2026-04-11',
    breedDateActual: '2025-05-16',
    notes: 'Annie\'s 345-day gestation history. June 2 check: 16 days pregnant. June 20: heartbeat confirmed. Katie predicts chestnut roan filly with blaze.',
    tags: ['2026 Season', 'AI Frozen'],
  },
  {
    name: 'Happy x Denver 2026',
    damRef: 'Happy',
    sireRef: 'First Thingz First',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'AI_FROZEN',
    status: 'PREGNANT',
    expectedBirthDate: '2026-04-11',
    breedDateActual: '2025-05-16',
    notes: 'June 20: heartbeat confirmed. Katie predicts dark liver chestnut colt. Happy tends to foal early.',
    tags: ['2026 Season', 'AI Frozen'],
  },
  {
    name: 'Ginger x Making Me Willie Wild 2026',
    damRef: 'Ginger',
    sireRef: 'Making Me Willie Wild',
    species: 'HORSE',
    breedText: 'Quarter Horse',
    method: 'AI_FROZEN',
    status: 'UNSUCCESSFUL',
    breedDateActual: '2025-05-10',
    notes: 'FAILED — retained fluid, NOT pregnant. Plan cancelled. Will retry next season.',
    tags: ['2026 Season'],
  },

  // ── Mini Horse 2026 Plans ────────────────────────────────────────────
  {
    name: 'Coco x Unknown Sire 2026',
    damRef: 'Rayvic Jocomotions Contessa',
    sireRef: 'Maddox',
    species: 'HORSE',
    breedText: 'Miniature Horse',
    method: 'NATURAL_COVER',
    status: 'PREGNANT',
    expectedBirthDate: '2026-02-10',
    notes: 'Coco purchased already in foal. Sire unknown at purchase. Due Feb 10, 2026 — first mini foal of the season. Foal alert device in use.',
    tags: ['2026 Season'],
  },
  {
    name: 'Karen x Maddox 2026',
    damRef: 'Los Arboles Silver Hawk',
    sireRef: 'Maddox',
    species: 'HORSE',
    breedText: 'Miniature Horse',
    method: 'NATURAL_COVER',
    status: 'PREGNANT',
    expectedBirthDate: '2026-05-17',
    notes: 'Karen bred to visiting mini stallion Maddox. Due May 17, 2026.',
    tags: ['2026 Season'],
  },
  {
    name: 'Regina x Maddox 2026',
    damRef: 'Rowan Creek Chasinthat Neon Rainbow',
    sireRef: 'Maddox',
    species: 'HORSE',
    breedText: 'Miniature Horse',
    method: 'AI_FRESH',
    status: 'PREGNANT',
    expectedBirthDate: '2026-07-08',
    notes: 'Regina bred to Maddox via AI (Histrelin implant used for ovulation timing). Follicle measured at 40mm prior to breeding. Due July 8, 2026.',
    tags: ['2026 Season'],
  },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 12 — TEST RESULTS & PREGNANCY CHECKS
// ══════════════════════════════════════════════════════════════════════

export interface TestResultDef {
  planRef: string;
  animalRef: string;
  kind: string;
  method?: string;
  collectedAt: string;
  valueNumber?: number;
  valueText?: string;
  units?: string;
  notes?: string;
}

export interface PregnancyCheckDef {
  planRef: string;
  method: string;
  result: boolean;
  checkedAt: string;
  notes?: string;
}

// Real pregnancy check data from June 2025 blog content
export const KVS_PREGNANCY_CHECKS: PregnancyCheckDef[] = [
  // 2026 plans — June 2 checks
  { planRef: 'Annie x Denver 2026', method: 'ULTRASOUND', result: true, checkedAt: '2025-06-02', notes: '16 days pregnant. Confirmed.' },
  { planRef: 'Phoebe x RL Best of Sudden 2026', method: 'ULTRASOUND', result: true, checkedAt: '2025-06-02', notes: '19 days. On Regumate protocol. Confirmed.' },
  { planRef: 'Maggie x Machine Made 2026', method: 'ULTRASOUND', result: true, checkedAt: '2025-06-02', notes: 'Confirmed. Caslick procedure performed.' },
  { planRef: 'Happy x Denver 2026', method: 'ULTRASOUND', result: true, checkedAt: '2025-06-02', notes: 'Confirmed pregnant.' },
  { planRef: 'Ginger x Making Me Willie Wild 2026', method: 'ULTRASOUND', result: false, checkedAt: '2025-06-02', notes: 'FAILED — retained fluid. Not pregnant.' },
  // 2026 plans — June 20 heartbeat checks
  { planRef: 'Maggie x Machine Made 2026', method: 'ULTRASOUND', result: true, checkedAt: '2025-06-20', notes: 'Heartbeat confirmed.' },
  { planRef: 'Phoebe x RL Best of Sudden 2026', method: 'ULTRASOUND', result: true, checkedAt: '2025-06-20', notes: 'Heartbeat confirmed. Continuing Regumate.' },
  { planRef: 'Annie x Denver 2026', method: 'ULTRASOUND', result: true, checkedAt: '2025-06-20', notes: 'Heartbeat confirmed.' },
  { planRef: 'Happy x Denver 2026', method: 'ULTRASOUND', result: true, checkedAt: '2025-06-20', notes: 'Heartbeat confirmed.' },
  // 2025 plans — pregnancy confirmations
  { planRef: 'Erlene x VS Code Red 2025', method: 'ULTRASOUND', result: true, checkedAt: '2024-03-01', notes: '19 days pregnant. Confirmed.' },
  { planRef: 'Kennedy x Machine Made 2025', method: 'ULTRASOUND', result: true, checkedAt: '2024-03-12', notes: '18 days pregnant. Confirmed.' },
  { planRef: 'Ginger x Cool Breeze 2025', method: 'ULTRASOUND', result: true, checkedAt: '2024-03-22', notes: '17 days pregnant. Confirmed.' },
  { planRef: 'Beyonce (Ethel) x VS Code Red 2025', method: 'ULTRASOUND', result: true, checkedAt: '2024-03-26', notes: 'Embryo implanted successfully. 18 days.' },
  { planRef: 'Annie x Cool Ladies Man 2025', method: 'ULTRASOUND', result: true, checkedAt: '2024-04-02', notes: '18 days pregnant. Confirmed.' },
  { planRef: 'Gumdrops (Phoebe) x VS Code Red 2025', method: 'ULTRASOUND', result: true, checkedAt: '2024-04-22', notes: '17 days. Legacy embryo confirmed.' },
  { planRef: 'Beyonce (Gracie) x VS Code Red 2025', method: 'ULTRASOUND', result: true, checkedAt: '2024-04-25', notes: '18 days. Monitoring closely due to Gracie\'s history.' },
  { planRef: 'Marilyn (Happy) x VS Code Red 2025', method: 'ULTRASOUND', result: true, checkedAt: '2024-05-28', notes: '18 days. Confirmed.' },
];

// Progesterone test data (generated but realistic)
export const KVS_TEST_RESULTS: TestResultDef[] = [
  // Annie x Denver 2026 — pre-breeding progesterone
  { planRef: 'Annie x Denver 2026', animalRef: 'Hot Pistol Annie', kind: 'PROGESTERONE', method: 'BLOOD', collectedAt: '2025-05-08', valueNumber: 0.8, units: 'ng/mL', notes: 'Low — mare in estrus' },
  { planRef: 'Annie x Denver 2026', animalRef: 'Hot Pistol Annie', kind: 'PROGESTERONE', method: 'BLOOD', collectedAt: '2025-05-12', valueNumber: 1.2, units: 'ng/mL', notes: 'Rising — approaching ovulation' },
  { planRef: 'Annie x Denver 2026', animalRef: 'Hot Pistol Annie', kind: 'FOLLICLE_EXAM', method: 'ULTRASOUND', collectedAt: '2025-05-14', valueNumber: 42, units: 'mm', notes: 'Follicle 42mm — ready for breeding' },
  { planRef: 'Annie x Denver 2026', animalRef: 'Hot Pistol Annie', kind: 'PROGESTERONE', method: 'BLOOD', collectedAt: '2025-05-18', valueNumber: 8.5, units: 'ng/mL', notes: 'Post-ovulation rise. Confirms ovulation.' },

  // Phoebe x RL Best of Sudden 2026
  { planRef: 'Phoebe x RL Best of Sudden 2026', animalRef: 'Phoebe', kind: 'PROGESTERONE', method: 'BLOOD', collectedAt: '2025-04-10', valueNumber: 0.5, units: 'ng/mL', notes: 'Low — estrus' },
  { planRef: 'Phoebe x RL Best of Sudden 2026', animalRef: 'Phoebe', kind: 'FOLLICLE_EXAM', method: 'ULTRASOUND', collectedAt: '2025-04-15', valueNumber: 38, units: 'mm', notes: 'Follicle developing — 38mm' },
  { planRef: 'Phoebe x RL Best of Sudden 2026', animalRef: 'Phoebe', kind: 'PROGESTERONE', method: 'BLOOD', collectedAt: '2025-04-20', valueNumber: 12.0, units: 'ng/mL', notes: 'Strong post-ovulation rise' },

  // Maggie x Machine Made 2026
  { planRef: 'Maggie x Machine Made 2026', animalRef: 'Maggie', kind: 'PROGESTERONE', method: 'BLOOD', collectedAt: '2025-04-28', valueNumber: 0.6, units: 'ng/mL' },
  { planRef: 'Maggie x Machine Made 2026', animalRef: 'Maggie', kind: 'FOLLICLE_EXAM', method: 'ULTRASOUND', collectedAt: '2025-05-02', valueNumber: 40, units: 'mm', notes: 'Follicle 40mm — ready' },
  { planRef: 'Maggie x Machine Made 2026', animalRef: 'Maggie', kind: 'PROGESTERONE', method: 'BLOOD', collectedAt: '2025-05-08', valueNumber: 10.2, units: 'ng/mL', notes: 'Post-ovulation confirmed' },

  // Happy x Denver 2026
  { planRef: 'Happy x Denver 2026', animalRef: 'Happy', kind: 'PROGESTERONE', method: 'BLOOD', collectedAt: '2025-05-08', valueNumber: 0.7, units: 'ng/mL' },
  { planRef: 'Happy x Denver 2026', animalRef: 'Happy', kind: 'FOLLICLE_EXAM', method: 'ULTRASOUND', collectedAt: '2025-05-13', valueNumber: 44, units: 'mm' },
  { planRef: 'Happy x Denver 2026', animalRef: 'Happy', kind: 'PROGESTERONE', method: 'BLOOD', collectedAt: '2025-05-18', valueNumber: 9.8, units: 'ng/mL', notes: 'Post-ovulation' },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 12b — BREEDING ATTEMPTS
// ══════════════════════════════════════════════════════════════════════

export interface BreedingAttemptDef {
  planRef: string;
  method: string;
  attemptAt: string;
  success?: boolean;
  notes?: string;
}

export const KVS_BREEDING_ATTEMPTS: BreedingAttemptDef[] = [
  // 2026 plans
  { planRef: 'Raven x VS Code Red 2026', method: 'EMBRYO_TRANSFER', attemptAt: '2025-02-14', success: true, notes: 'ET successful' },
  { planRef: 'Indy x VS Code Red 2026', method: 'AI_FROZEN', attemptAt: '2025-03-01', success: true },
  { planRef: 'Rikki x Hey Good Lookin 2026', method: 'AI_FROZEN', attemptAt: '2025-03-03', success: true, notes: 'Maiden mare — first breeding' },
  { planRef: 'Charlotte x Denver 2026', method: 'EMBRYO_TRANSFER', attemptAt: '2025-03-06', success: true },
  { planRef: 'Lexy x VS Code Red 2026', method: 'EMBRYO_TRANSFER', attemptAt: '2025-04-05', success: true },
  { planRef: 'Phoebe x RL Best of Sudden 2026', method: 'AI_FROZEN', attemptAt: '2025-04-18', success: true, notes: 'On Regumate — previous absorption at 27 days' },
  { planRef: 'Maggie x Machine Made 2026', method: 'EMBRYO_TRANSFER', attemptAt: '2025-05-05', success: true, notes: 'Caslick procedure done prior' },
  { planRef: 'Annie x Denver 2026', method: 'AI_FROZEN', attemptAt: '2025-05-16', success: true },
  { planRef: 'Happy x Denver 2026', method: 'AI_FROZEN', attemptAt: '2025-05-16', success: true },
  { planRef: 'Ginger x Making Me Willie Wild 2026', method: 'AI_FROZEN', attemptAt: '2025-05-10', success: false, notes: 'Failed — mare retained fluid' },
  // 2025 plans
  { planRef: 'Erlene x VS Code Red 2025', method: 'AI_FROZEN', attemptAt: '2024-02-10', success: true },
  { planRef: 'Kennedy x Machine Made 2025', method: 'AI_FROZEN', attemptAt: '2024-02-22', success: true },
  { planRef: 'Ginger x Cool Breeze 2025', method: 'AI_FROZEN', attemptAt: '2024-03-05', success: true },
  { planRef: 'Beyonce (Ethel) x VS Code Red 2025', method: 'EMBRYO_TRANSFER', attemptAt: '2024-03-08', success: true },
  { planRef: 'Annie x Cool Ladies Man 2025', method: 'AI_FROZEN', attemptAt: '2024-03-15', success: true },
  { planRef: 'Gumdrops (Phoebe) x VS Code Red 2025', method: 'EMBRYO_TRANSFER', attemptAt: '2024-04-05', success: true },
  { planRef: 'Beyonce (Gracie) x VS Code Red 2025', method: 'EMBRYO_TRANSFER', attemptAt: '2024-04-07', success: true },
  { planRef: 'Marilyn (Happy) x VS Code Red 2025', method: 'EMBRYO_TRANSFER', attemptAt: '2024-05-10', success: true },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 13 — FOALING OUTCOMES
// ══════════════════════════════════════════════════════════════════════

export interface FoalingOutcomeDef {
  planRef: string;
  hadComplications: boolean;
  complicationDetails?: string;
  veterinarianCalled?: boolean;
  veterinarianName?: string;
  placentaPassed?: boolean;
  placentaPassedMinutes?: number;
  mareCondition?: string;
  readyForRebreeding?: boolean;
}

export const KVS_FOALING_OUTCOMES: FoalingOutcomeDef[] = [
  { planRef: 'Erlene x VS Code Red 2025', hadComplications: true, complicationDetails: 'Premature birth (before due date). Foal Noelle born before Jan 1 but survived.', veterinarianCalled: true, veterinarianName: 'Tennessee Equine Hospital', placentaPassed: true, placentaPassedMinutes: 45, mareCondition: 'GOOD', readyForRebreeding: true },
  { planRef: 'Kennedy x Machine Made 2025', hadComplications: false, placentaPassed: true, placentaPassedMinutes: 30, mareCondition: 'EXCELLENT', readyForRebreeding: true },
  { planRef: 'Ginger x Cool Breeze 2025', hadComplications: false, placentaPassed: true, placentaPassedMinutes: 35, mareCondition: 'EXCELLENT', readyForRebreeding: true },
  { planRef: 'Beyonce (Ethel) x VS Code Red 2025', hadComplications: false, placentaPassed: true, placentaPassedMinutes: 40, mareCondition: 'GOOD', readyForRebreeding: true },
  { planRef: 'Annie x Cool Ladies Man 2025', hadComplications: true, complicationDetails: 'Extended gestation (345 days). Foal arrived 4 days late but healthy.', placentaPassed: true, placentaPassedMinutes: 50, mareCondition: 'GOOD', readyForRebreeding: true },
  { planRef: 'Gumdrops (Phoebe) x VS Code Red 2025', hadComplications: false, placentaPassed: true, placentaPassedMinutes: 30, mareCondition: 'EXCELLENT', readyForRebreeding: true },
  { planRef: 'Beyonce (Gracie) x VS Code Red 2025', hadComplications: true, complicationDetails: 'Gracie has premature foaling history. Foal arrived 2 days early but healthy.', veterinarianCalled: true, veterinarianName: 'Tennessee Equine Hospital', placentaPassed: true, placentaPassedMinutes: 55, mareCondition: 'FAIR', readyForRebreeding: true },
  { planRef: 'Marilyn (Happy) x VS Code Red 2025', hadComplications: false, complicationDetails: 'Happy tends to foal early. Born 3 days ahead.', placentaPassed: true, placentaPassedMinutes: 25, mareCondition: 'EXCELLENT', readyForRebreeding: true },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 13b — OFFSPRING GROUPS
// ══════════════════════════════════════════════════════════════════════

export interface OffspringGroupDef {
  planRef: string;
  name: string;
  damRef: string;
  sireRef: string;
  actualBirthOn: string;
  offspring: {
    name: string;
    sex: 'MALE' | 'FEMALE';
    lifeState: 'ALIVE' | 'DECEASED';
    keeperIntent: 'KEEP' | 'AVAILABLE' | 'UNDER_EVALUATION';
    diedAt?: string; // YYYY-MM-DD, for deceased foals
    notes?: string;
  }[];
}

export const KVS_OFFSPRING_GROUPS: OffspringGroupDef[] = [
  {
    planRef: 'Erlene x VS Code Red 2025',
    name: 'Erlene x VS Code Red 2025 Foals',
    damRef: 'Red Carpet Debut',
    sireRef: 'VS Code Red',
    actualBirthOn: '2024-12-28',
    offspring: [
      { name: 'Noelle', sex: 'FEMALE', lifeState: 'ALIVE', keeperIntent: 'KEEP', notes: 'Born premature before Jan 1. Healthy. First-time mother.' },
    ],
  },
  {
    planRef: 'Kennedy x Machine Made 2025',
    name: 'Kennedy x Machine Made 2025 Foals',
    damRef: 'VS The First Lady',
    sireRef: 'Machine Made',
    actualBirthOn: '2025-01-29',
    offspring: [
      { name: 'Kirby', sex: 'MALE', lifeState: 'DECEASED', diedAt: '2025-08-15', keeperIntent: 'KEEP', notes: 'Died August 2025 — pasture accident. Full sibling to 2026 Maggie embryo.' },
    ],
  },
  {
    planRef: 'Ginger x Cool Breeze 2025',
    name: 'Ginger x Cool Breeze 2025 Foals',
    damRef: 'Ginger',
    sireRef: 'Cool Breeze',
    actualBirthOn: '2025-02-10',
    offspring: [
      { name: 'RS Cool Ginger Snap', sex: 'FEMALE', lifeState: 'ALIVE', keeperIntent: 'UNDER_EVALUATION', notes: 'Full sibling to Freddy' },
    ],
  },
  {
    planRef: 'Annie x Cool Ladies Man 2025',
    name: 'Annie x Cool Ladys Man 2025 Foals',
    damRef: 'Hot Pistol Annie',
    sireRef: 'Cool Ladys Man',
    actualBirthOn: '2025-02-25',
    offspring: [
      { name: 'RS Cool Hand Annie', sex: 'MALE', lifeState: 'ALIVE', keeperIntent: 'UNDER_EVALUATION', notes: 'Annie\'s 345-day gestation' },
    ],
  },
  {
    planRef: 'Beyonce (Ethel) x VS Code Red 2025',
    name: 'Beyonce (Ethel) x VS Code Red 2025 Foals',
    damRef: 'Ethel',
    sireRef: 'VS Code Red',
    actualBirthOn: '2025-02-11',
    offspring: [
      { name: 'RS Red E or Not', sex: 'FEMALE', lifeState: 'ALIVE', keeperIntent: 'UNDER_EVALUATION', notes: 'Genetic dam: Beyonce (donor). Carried by Ethel. "Red E" = wordplay on Red Roan + Ready.' },
    ],
  },
  {
    planRef: 'Gumdrops (Phoebe) x VS Code Red 2025',
    name: 'Gumdrops (Phoebe) x VS Code Red 2025 Foals',
    damRef: 'Phoebe',
    sireRef: 'VS Code Red',
    actualBirthOn: '2025-03-13',
    offspring: [
      { name: 'RS Gumdrop Machine', sex: 'MALE', lifeState: 'ALIVE', keeperIntent: 'KEEP', notes: 'Genetic dam: Goodygoody Gumdrops (legacy embryo). Carried by Phoebe. Sexed semen — stallion prospect. Registered name "RS Gumdrop Machine" confirmed.' },
    ],
  },
  {
    planRef: 'Beyonce (Gracie) x VS Code Red 2025',
    name: 'Beyonce (Gracie) x VS Code Red 2025 Foals',
    damRef: 'Gracie',
    sireRef: 'VS Code Red',
    actualBirthOn: '2025-03-14',
    offspring: [
      { name: 'RS Have You Met Ted', sex: 'MALE', lifeState: 'ALIVE', keeperIntent: 'UNDER_EVALUATION', notes: 'Genetic dam: Beyonce (donor). Carried by Gracie (premature foaling history — vet present).' },
    ],
  },
  {
    planRef: 'Marilyn (Happy) x VS Code Red 2025',
    name: 'Marilyn (Happy) x VS Code Red 2025 Foals',
    damRef: 'Happy',
    sireRef: 'VS Code Red',
    actualBirthOn: '2025-04-12',
    offspring: [
      { name: 'RS Something Special', sex: 'FEMALE', lifeState: 'ALIVE', keeperIntent: 'UNDER_EVALUATION', notes: 'Genetic dam: Marilynn Monroe (donor). Carried by Happy. Born 3 days early (Happy foals consistently early).' },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 14 — MARE REPRODUCTIVE HISTORY
// ══════════════════════════════════════════════════════════════════════

export interface MareHistoryDef {
  mareRef: string;
  totalFoalings: number;
  totalLiveFoals: number;
  totalComplicatedFoalings: number;
  riskScore: number;
  riskFactors?: string[];
  notes?: string;
}

export const KVS_MARE_HISTORY: MareHistoryDef[] = [
  { mareRef: 'VS The First Lady', totalFoalings: 2, totalLiveFoals: 2, totalComplicatedFoalings: 0, riskScore: 0, notes: 'Dam of Denver (2021) and Kirby (2025, deceased Aug 2025).' },
  { mareRef: 'Red Carpet Debut', totalFoalings: 1, totalLiveFoals: 1, totalComplicatedFoalings: 1, riskScore: 2, riskFactors: ['Premature birth'], notes: 'First-time mother. Foal Noelle born premature (before Jan 1) but survived.' },
  { mareRef: 'Hot Pistol Annie', totalFoalings: 3, totalLiveFoals: 3, totalComplicatedFoalings: 1, riskScore: 3, riskFactors: ['Extended gestation (345 days)', 'Difficulty conceiving while nursing'], notes: 'Known 345-day gestation. Struggles to conceive while lactating.' },
  { mareRef: 'Phoebe', totalFoalings: 2, totalLiveFoals: 2, totalComplicatedFoalings: 1, riskScore: 4, riskFactors: ['Embryo absorption history (27 days)', 'Requires Regumate protocol'], notes: 'Absorbed embryo at 27 days in previous cycle. Re-bred successfully. On Regumate.' },
  { mareRef: 'Gracie', totalFoalings: 2, totalLiveFoals: 2, totalComplicatedFoalings: 2, riskScore: 5, riskFactors: ['Premature foaling history', 'Required veterinary intervention'], notes: 'History of premature foaling complications as recipient mare.' },
  { mareRef: 'Happy', totalFoalings: 2, totalLiveFoals: 2, totalComplicatedFoalings: 0, riskScore: 1, riskFactors: ['Tends to foal early'], notes: 'Foals consistently 2-3 days early. Otherwise uncomplicated.' },
  { mareRef: 'Ginger', totalFoalings: 1, totalLiveFoals: 1, totalComplicatedFoalings: 0, riskScore: 2, riskFactors: ['Retained fluid (2026 attempt failed)'], notes: '2026 breeding to Making Me Willie Wild failed — retained fluid. Will retry.' },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 15 — TITLE DEFINITIONS + ANIMAL TITLES
// ══════════════════════════════════════════════════════════════════════

export interface TitleDefDef {
  abbreviation: string;
  fullName: string;
  category: string; // TitleCategory enum value
  organization?: string;
}

/** Tenant-specific title definitions (no global horse titles exist in the DB) */
export const KVS_TITLE_DEFS: TitleDefDef[] = [
  // AQHA designations
  { abbreviation: 'AQHA HOF',  fullName: 'AQHA Hall of Fame',                 category: 'OTHER',       organization: 'AQHA' },
  { abbreviation: 'AQHA WC',   fullName: 'AQHA World Champion',               category: 'PERFORMANCE', organization: 'AQHA' },
  { abbreviation: 'AQHA RWC',  fullName: 'AQHA Reserve World Champion',       category: 'PERFORMANCE', organization: 'AQHA' },
  { abbreviation: 'AQHA SUP WP', fullName: 'AQHA Superior Western Pleasure',  category: 'PERFORMANCE', organization: 'AQHA' },
  { abbreviation: 'AQHA SUP WR', fullName: 'AQHA Superior Western Riding',    category: 'PERFORMANCE', organization: 'AQHA' },
  { abbreviation: 'AQHA SUP AWP', fullName: 'AQHA Superior Amateur Western Pleasure', category: 'PERFORMANCE', organization: 'AQHA' },
  { abbreviation: 'AQHA SUPERHORSE', fullName: 'AQHA Superhorse',             category: 'PERFORMANCE', organization: 'AQHA' },
  // NSBA designations
  { abbreviation: 'NSBA HOF',  fullName: 'NSBA Hall of Fame',                 category: 'OTHER',       organization: 'NSBA' },
  { abbreviation: 'NSBA WC',   fullName: 'NSBA World Champion',               category: 'PERFORMANCE', organization: 'NSBA' },
  { abbreviation: 'NSBA RWC',  fullName: 'NSBA Reserve World Champion',       category: 'PERFORMANCE', organization: 'NSBA' },
  { abbreviation: 'NSBA HOTY', fullName: 'NSBA Horse of the Year',            category: 'OTHER',       organization: 'NSBA' },
  { abbreviation: 'BCF WC',    fullName: 'NSBA BCF World Champion',           category: 'PERFORMANCE', organization: 'NSBA' },
  { abbreviation: 'BCF RWC',   fullName: 'NSBA BCF Reserve World Champion',   category: 'PERFORMANCE', organization: 'NSBA' },
  // Congress
  { abbreviation: 'CONG CHAMP', fullName: 'Congress Champion',                category: 'PERFORMANCE', organization: 'All American Quarter Horse Congress' },
  { abbreviation: 'CONG RES',  fullName: 'Congress Reserve Champion',         category: 'PERFORMANCE', organization: 'All American Quarter Horse Congress' },
  { abbreviation: 'CONG MASTERS', fullName: 'Congress Masters Champion',      category: 'PERFORMANCE', organization: 'All American Quarter Horse Congress' },
  // Other
  { abbreviation: 'TOM POWERS', fullName: 'Tom Powers Futurity Champion',     category: 'PERFORMANCE', organization: 'Tom Powers Quarter Horse Show' },
];

export interface AnimalTitleDef {
  animalRef: string;
  titleAbbr: string;    // matches TitleDefDef.abbreviation
  status: string;       // TitleStatus: EARNED | VERIFIED | IN_PROGRESS
  verified: boolean;
  dateEarned?: string;  // YYYY or YYYY-MM-DD
  notes?: string;
}

export const KVS_ANIMAL_TITLES: AnimalTitleDef[] = [
  // ── VS Code Red ("Waylon") — 5x Congress Champ, NSBA WC, BCF WC ─────
  // Note: unique constraint is (animalId, titleDefinitionId) — one record per title type
  { animalRef: 'VS Code Red', titleAbbr: 'CONG CHAMP', status: 'VERIFIED', verified: true,  dateEarned: '2009', notes: '5x Congress Champion: Open 2YO WP, Limited Open 2YO WP, Non-Pro 2YO WP (2009 sweep — first non-pro to accomplish this); Junior WR, Green WR (2011)' },
  { animalRef: 'VS Code Red', titleAbbr: 'NSBA WC',    status: 'VERIFIED', verified: true,  dateEarned: '2012', notes: 'NSBA World Champion Junior Western Riding (2012)' },
  { animalRef: 'VS Code Red', titleAbbr: 'NSBA RWC',   status: 'VERIFIED', verified: true,  dateEarned: '2012', notes: 'NSBA Reserve World Champion Amateur Western Riding (2012)' },
  { animalRef: 'VS Code Red', titleAbbr: 'BCF WC',     status: 'VERIFIED', verified: true,  dateEarned: '2012', notes: 'NSBA BCF Champion 3-6YO Western Riding (2012)' },

  // ── First Thingz First ("Denver") — 3x Congress Champ, NSBA, BCF ────
  { animalRef: 'First Thingz First', titleAbbr: 'CONG CHAMP', status: 'VERIFIED', verified: true,  dateEarned: '2024', notes: '3x Congress Champion: Open $10K Ltd Horse WP, Open Performance Halter Stallions, Ltd Amateur Performance Halter Stallions (2024)' },
  { animalRef: 'First Thingz First', titleAbbr: 'CONG RES',   status: 'VERIFIED', verified: true,  dateEarned: '2024', notes: 'Congress Reserve Champion Amateur Performance Halter Stallions (2024)' },
  { animalRef: 'First Thingz First', titleAbbr: 'NSBA WC',    status: 'VERIFIED', verified: true,  dateEarned: '2024', notes: 'NSBA Champion Open $10K Ltd Horse WP at Congress (2024)' },
  { animalRef: 'First Thingz First', titleAbbr: 'AQHA RWC',   status: 'VERIFIED', verified: true,  dateEarned: '2024', notes: 'AQHA World Super Sires Pleasure Versatility Challenge Reserve (2024)' },
  { animalRef: 'First Thingz First', titleAbbr: 'BCF WC',     status: 'VERIFIED', verified: true,  dateEarned: '2025', notes: 'NSBA BCF World Champion $10K Maturity Ltd Horse Open WP (2025)' },
  { animalRef: 'First Thingz First', titleAbbr: 'BCF RWC',    status: 'VERIFIED', verified: true,  dateEarned: '2025', notes: 'NSBA BCF Reserve World Champion Open Performance Halter Stallions (2025)' },

  // ── VS The First Lady ("Kennedy") — Congress Masters, 4x NSBA, 2x AQHA
  { animalRef: 'VS The First Lady', titleAbbr: 'CONG MASTERS', status: 'VERIFIED', verified: true, notes: 'Congress Masters Champion Western Pleasure' },
  { animalRef: 'VS The First Lady', titleAbbr: 'NSBA WC',      status: 'VERIFIED', verified: true, notes: '4x NSBA World Champion Western Pleasure' },
  { animalRef: 'VS The First Lady', titleAbbr: 'AQHA WC',      status: 'VERIFIED', verified: true, notes: '2x AQHA World Champion Western Pleasure' },
  { animalRef: 'VS The First Lady', titleAbbr: 'TOM POWERS',   status: 'VERIFIED', verified: true, notes: '2x Tom Powers Futurity Champion' },

  // ── Gone Commando ("Rikki") — 3x Congress, NSBA WC + RWC, Superior ──
  { animalRef: 'Gone Commando', titleAbbr: 'CONG CHAMP',   status: 'VERIFIED', verified: true,  dateEarned: '2022', notes: '3x Congress Champion WP. Debut win: 3YO Non-Pro WP Futurity Limited — unanimous (shown by Karen Carter, 2022)' },
  { animalRef: 'Gone Commando', titleAbbr: 'NSBA WC',      status: 'VERIFIED', verified: true,  notes: 'NSBA World Champion Western Pleasure' },
  { animalRef: 'Gone Commando', titleAbbr: 'NSBA RWC',     status: 'VERIFIED', verified: true,  notes: 'NSBA Reserve World Champion Western Pleasure' },
  { animalRef: 'Gone Commando', titleAbbr: 'AQHA SUP WP',  status: 'VERIFIED', verified: true,  notes: 'AQHA Superior Open Western Pleasure' },
  { animalRef: 'Gone Commando', titleAbbr: 'AQHA SUP AWP', status: 'VERIFIED', verified: true,  notes: 'AQHA Superior Amateur Western Pleasure' },

  // ── Key Ancestors ─────────────────────────────────────────────────────
  { animalRef: 'Vital Signs Are Good', titleAbbr: 'AQHA HOF', status: 'VERIFIED', verified: true, dateEarned: '2019', notes: 'AQHA Hall of Fame 2019. 13 AQHA World Championships, 31 Congress Championships, 3,037.5 AQHA pts — widely considered greatest show mare in AQHA history' },
  { animalRef: 'Blazing Hot',          titleAbbr: 'AQHA WC',  status: 'VERIFIED', verified: true, notes: 'AQHA World Champion. Sire of VS Code Red. 1,983+ foals, $3.88M offspring earnings, NSBA Hall of Fame' },
  { animalRef: 'Zippos Mr Good Bar',   titleAbbr: 'AQHA HOF', status: 'VERIFIED', verified: true, notes: 'AQHA Hall of Fame. AQHA & NSBA All-Time Leading WP Sire (money & points)' },
  { animalRef: 'Zippos Mr Good Bar',   titleAbbr: 'NSBA HOF', status: 'VERIFIED', verified: true, notes: 'NSBA Hall of Fame' },

  // ── Outside Stallions with known titles ───────────────────────────────
  { animalRef: 'Machine Made', titleAbbr: 'AQHA SUP WP', status: 'VERIFIED', verified: true, notes: 'AQHA Superior Western Pleasure. AQHA #1 Leading WP Sire continuously since 2019. $4M Dollar Sire.' },
  { animalRef: 'Machine Made', titleAbbr: 'AQHA SUP WR', status: 'VERIFIED', verified: true, notes: 'AQHA Superior Western Riding. 2012 AQHA WC L2 OP Jr Western Riding; 2011 NSBA WC Jr Western Riding' },
];

// ══════════════════════════════════════════════════════════════════════
// TAG ASSIGNMENTS (maps animal/plan names to tag names)
// ══════════════════════════════════════════════════════════════════════

// Tag assignments are derived from the `tags` arrays on individual definitions.
// The orchestrator script reads these arrays and creates TagAssignment records.
