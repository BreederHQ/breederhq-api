// scripts/seed-validation-tenants/seed-data-config.ts
// Configuration file defining all seed data for validation testing tenants.
// Contains 4 themed tenants with unique characteristics for dev and prod environments.
//
// Each tenant has:
// - Unique theme (naming conventions for all entities)
// - 1 owner/admin user with predictable password
// - Multiple species with up to 4 animals each
// - 6 generations of lineage data
// - Up to 4 breeding plans (PLANNING and COMMITTED phases only)
// - Contacts without portal access
// - Marketplace data with varying visibility states
// - Varying privacy/visibility settings for bloodlines and genetics

import { Species, Sex, AnimalStatus, BreedingPlanStatus, ListingType, ListingStatus } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT PREFIXES
// ═══════════════════════════════════════════════════════════════════════════════

export type Environment = 'dev' | 'prod';

export const ENV_PREFIX = {
  dev: 'DEV',
  prod: 'PROD',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// THEME DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ThemeDefinition {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoText: string;
}

export const TENANT_THEMES: Record<string, ThemeDefinition> = {
  middleEarth: {
    id: 'middle-earth',
    name: 'Middle Earth',
    primaryColor: '#2E5339',
    secondaryColor: '#8B7355',
    accentColor: '#C9A959',
    logoText: 'Rivendell Breeders',
  },
  hogwarts: {
    id: 'hogwarts',
    name: 'Hogwarts',
    primaryColor: '#740001',
    secondaryColor: '#1A472A',
    accentColor: '#EEBA30',
    logoText: 'Magical Creatures',
  },
  westeros: {
    id: 'westeros',
    name: 'Westeros',
    primaryColor: '#1C1C1C',
    secondaryColor: '#8B0000',
    accentColor: '#FFD700',
    logoText: 'Seven Kingdoms',
  },
  narnia: {
    id: 'narnia',
    name: 'Narnia',
    primaryColor: '#1E3A5F',
    secondaryColor: '#8B4513',
    accentColor: '#FFE4B5',
    logoText: 'Aslan\'s Pride',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TENANT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface TenantDefinition {
  slug: string;
  theme: ThemeDefinition;
  // Marketplace visibility settings
  marketplaceVisibility: {
    isPublicProgram: boolean;
    hasActiveListings: boolean;
    programsEnabled: number; // 0-2 enabled programs
    programsSaved: number;   // saved but not enabled
  };
  // Bloodlines/lineage visibility
  lineageVisibility: {
    allowCrossTenantMatching: boolean;
    defaultShowName: boolean;
    defaultShowPhoto: boolean;
    defaultShowFullDob: boolean;
    defaultShowRegistryFull: boolean;
    defaultShowHealthResults: boolean;
    defaultShowGeneticData: boolean;
    defaultShowBreeder: boolean;
    defaultAllowInfoRequests: boolean;
    defaultAllowDirectContact: boolean;
  };
  // Species focus for this tenant
  species: Species[];
}

// Helper function to get environment-specific name
export function getEnvName(baseName: string, env: Environment): string {
  return `[${ENV_PREFIX[env]}] ${baseName}`;
}

// Helper function to get environment-specific slug
export function getEnvSlug(baseSlug: string, env: Environment): string {
  return `${env}-${baseSlug}`;
}

// Helper function to get environment-specific email
export function getEnvEmail(baseEmail: string, env: Environment): string {
  const [local, domain] = baseEmail.split('@');
  return `${local}.${env}@${domain}`;
}

export const TENANT_DEFINITIONS: TenantDefinition[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // TENANT 1: Middle Earth (Lord of the Rings) - Full visibility, public program
  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: 'rivendell',
    theme: TENANT_THEMES.middleEarth,
    marketplaceVisibility: {
      isPublicProgram: true,
      hasActiveListings: true,
      programsEnabled: 2,
      programsSaved: 1,
    },
    lineageVisibility: {
      allowCrossTenantMatching: true,
      defaultShowName: true,
      defaultShowPhoto: true,
      defaultShowFullDob: true,
      defaultShowRegistryFull: true,
      defaultShowHealthResults: true,
      defaultShowGeneticData: true,
      defaultShowBreeder: true,
      defaultAllowInfoRequests: true,
      defaultAllowDirectContact: true,
    },
    species: ['DOG', 'HORSE', 'CAT'],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // TENANT 2: Hogwarts (Harry Potter) - Partial visibility, some restrictions
  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: 'hogwarts',
    theme: TENANT_THEMES.hogwarts,
    marketplaceVisibility: {
      isPublicProgram: true,
      hasActiveListings: true,
      programsEnabled: 1,
      programsSaved: 1,
    },
    lineageVisibility: {
      allowCrossTenantMatching: true,
      defaultShowName: true,
      defaultShowPhoto: true,
      defaultShowFullDob: false, // Year only
      defaultShowRegistryFull: false, // Partial registry
      defaultShowHealthResults: true,
      defaultShowGeneticData: false,
      defaultShowBreeder: true,
      defaultAllowInfoRequests: true,
      defaultAllowDirectContact: false,
    },
    species: ['CAT', 'RABBIT', 'DOG'],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // TENANT 3: Westeros (Game of Thrones) - Private program, minimal visibility
  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: 'winterfell',
    theme: TENANT_THEMES.westeros,
    marketplaceVisibility: {
      isPublicProgram: false,
      hasActiveListings: false,
      programsEnabled: 0,
      programsSaved: 1,
    },
    lineageVisibility: {
      allowCrossTenantMatching: false,
      defaultShowName: false,
      defaultShowPhoto: false,
      defaultShowFullDob: false,
      defaultShowRegistryFull: false,
      defaultShowHealthResults: false,
      defaultShowGeneticData: false,
      defaultShowBreeder: false,
      defaultAllowInfoRequests: false,
      defaultAllowDirectContact: false,
    },
    species: ['DOG', 'HORSE'],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // TENANT 4: Narnia - Mixed visibility, selective sharing
  // ─────────────────────────────────────────────────────────────────────────────
  {
    slug: 'cair-paravel',
    theme: TENANT_THEMES.narnia,
    marketplaceVisibility: {
      isPublicProgram: true,
      hasActiveListings: true,
      programsEnabled: 2,
      programsSaved: 0,
    },
    lineageVisibility: {
      allowCrossTenantMatching: true,
      defaultShowName: true,
      defaultShowPhoto: false,
      defaultShowFullDob: true,
      defaultShowRegistryFull: true,
      defaultShowHealthResults: false,
      defaultShowGeneticData: true,
      defaultShowBreeder: false,
      defaultAllowInfoRequests: true,
      defaultAllowDirectContact: true,
    },
    species: ['CAT', 'GOAT', 'HORSE', 'DOG'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// USER DEFINITIONS (per tenant)
// ═══════════════════════════════════════════════════════════════════════════════

export interface UserDefinition {
  firstName: string;
  lastName: string;
  emailBase: string; // Will be prefixed with env
  password: string;
  isSuperAdmin: boolean;
}

export const TENANT_USERS: Record<string, UserDefinition> = {
  // Middle Earth - Elrond
  rivendell: {
    firstName: 'Elrond',
    lastName: 'Peredhel',
    emailBase: 'elrond@rivendell.local',
    password: 'Rivendell123!',
    isSuperAdmin: false,
  },
  // Hogwarts - Hagrid
  hogwarts: {
    firstName: 'Rubeus',
    lastName: 'Hagrid',
    emailBase: 'hagrid@hogwarts.local',
    password: 'Hogwarts123!',
    isSuperAdmin: false,
  },
  // Westeros - Ned Stark
  winterfell: {
    firstName: 'Eddard',
    lastName: 'Stark',
    emailBase: 'ned.stark@winterfell.local',
    password: 'Winterfell123!',
    isSuperAdmin: false,
  },
  // Narnia - Aslan
  'cair-paravel': {
    firstName: 'Aslan',
    lastName: 'TheLion',
    emailBase: 'aslan@narnia.local',
    password: 'Narnia123!',
    isSuperAdmin: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT DEFINITIONS (per tenant) - No portal access
// ═══════════════════════════════════════════════════════════════════════════════

export interface ContactDefinition {
  firstName: string;
  lastName: string;
  nickname?: string;
  emailBase: string;
  phone: string;
  city: string;
  state: string;
  country: string;
}

export const TENANT_CONTACTS: Record<string, ContactDefinition[]> = {
  // Middle Earth contacts
  rivendell: [
    { firstName: 'Gandalf', lastName: 'TheGrey', nickname: 'Mithrandir', emailBase: 'gandalf@middleearth.local', phone: '+1-555-0301', city: 'Valinor', state: 'Aman', country: 'US' },
    { firstName: 'Aragorn', lastName: 'Elessar', nickname: 'Strider', emailBase: 'aragorn@gondor.local', phone: '+1-555-0302', city: 'Minas Tirith', state: 'Gondor', country: 'US' },
    { firstName: 'Legolas', lastName: 'Greenleaf', emailBase: 'legolas@mirkwood.local', phone: '+1-555-0303', city: 'Woodland Realm', state: 'Mirkwood', country: 'US' },
    { firstName: 'Gimli', lastName: 'GloinSon', emailBase: 'gimli@erebor.local', phone: '+1-555-0304', city: 'Erebor', state: 'Dale', country: 'US' },
    { firstName: 'Samwise', lastName: 'Gamgee', nickname: 'Sam', emailBase: 'sam@shire.local', phone: '+1-555-0305', city: 'Hobbiton', state: 'The Shire', country: 'US' },
  ],
  // Hogwarts contacts
  hogwarts: [
    { firstName: 'Albus', lastName: 'Dumbledore', emailBase: 'dumbledore@hogwarts.local', phone: '+1-555-0311', city: 'Hogsmeade', state: 'Scotland', country: 'GB' },
    { firstName: 'Minerva', lastName: 'McGonagall', emailBase: 'mcgonagall@hogwarts.local', phone: '+1-555-0312', city: 'Hogsmeade', state: 'Scotland', country: 'GB' },
    { firstName: 'Newt', lastName: 'Scamander', emailBase: 'newt@ministry.local', phone: '+1-555-0313', city: 'London', state: 'England', country: 'GB' },
    { firstName: 'Luna', lastName: 'Lovegood', emailBase: 'luna@quibbler.local', phone: '+1-555-0314', city: 'Ottery St Catchpole', state: 'Devon', country: 'GB' },
    { firstName: 'Charlie', lastName: 'Weasley', emailBase: 'charlie@dragons.local', phone: '+1-555-0315', city: 'Romanian Reserve', state: 'Carpathians', country: 'RO' },
  ],
  // Westeros contacts
  winterfell: [
    { firstName: 'Jon', lastName: 'Snow', emailBase: 'jon@nightswatch.local', phone: '+1-555-0321', city: 'Castle Black', state: 'The Wall', country: 'US' },
    { firstName: 'Sansa', lastName: 'Stark', emailBase: 'sansa@winterfell.local', phone: '+1-555-0322', city: 'Winterfell', state: 'The North', country: 'US' },
    { firstName: 'Arya', lastName: 'Stark', emailBase: 'arya@braavos.local', phone: '+1-555-0323', city: 'Braavos', state: 'Essos', country: 'US' },
    { firstName: 'Bran', lastName: 'Stark', nickname: 'Three-Eyed Raven', emailBase: 'bran@winterfell.local', phone: '+1-555-0324', city: 'Winterfell', state: 'The North', country: 'US' },
    { firstName: 'Tormund', lastName: 'Giantsbane', emailBase: 'tormund@freefolk.local', phone: '+1-555-0325', city: 'Beyond the Wall', state: 'True North', country: 'US' },
  ],
  // Narnia contacts
  'cair-paravel': [
    { firstName: 'Peter', lastName: 'Pevensie', nickname: 'High King', emailBase: 'peter@narnia.local', phone: '+1-555-0331', city: 'Cair Paravel', state: 'Eastern Sea', country: 'US' },
    { firstName: 'Susan', lastName: 'Pevensie', nickname: 'Gentle Queen', emailBase: 'susan@narnia.local', phone: '+1-555-0332', city: 'Cair Paravel', state: 'Eastern Sea', country: 'US' },
    { firstName: 'Edmund', lastName: 'Pevensie', nickname: 'Just King', emailBase: 'edmund@narnia.local', phone: '+1-555-0333', city: 'Cair Paravel', state: 'Eastern Sea', country: 'US' },
    { firstName: 'Lucy', lastName: 'Pevensie', nickname: 'Valiant Queen', emailBase: 'lucy@narnia.local', phone: '+1-555-0334', city: 'Cair Paravel', state: 'Eastern Sea', country: 'US' },
    { firstName: 'Reepicheep', lastName: 'TheMouse', emailBase: 'reepicheep@narnia.local', phone: '+1-555-0335', city: "Aslan's Country", state: 'Beyond', country: 'US' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZATION DEFINITIONS (per tenant)
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrganizationDefinition {
  name: string;
  emailBase: string;
  phone: string;
  website?: string;
  city: string;
  state: string;
  country: string;
  isPublicProgram: boolean;
  programSlug?: string;
  programBio?: string;
}

export const TENANT_ORGANIZATIONS: Record<string, OrganizationDefinition[]> = {
  rivendell: [
    { name: 'House of Elrond', emailBase: 'elrond.house@rivendell.local', phone: '+1-555-0401', website: 'https://rivendell.local', city: 'Rivendell', state: 'Eriador', country: 'US', isPublicProgram: true, programSlug: 'house-of-elrond', programBio: 'Ancient elven breeding program specializing in noble steeds and loyal companions.' },
    { name: 'Grey Havens Stables', emailBase: 'stables@greyhavens.local', phone: '+1-555-0402', city: 'Grey Havens', state: 'Lindon', country: 'US', isPublicProgram: true, programSlug: 'grey-havens-stables', programBio: 'Premier equine breeding near the sea.' },
    { name: 'Lothlórien Gardens', emailBase: 'gardens@lothlorien.local', phone: '+1-555-0403', city: 'Caras Galadhon', state: 'Lothlórien', country: 'US', isPublicProgram: false },
  ],
  hogwarts: [
    { name: 'Hagrid\'s Hut Creatures', emailBase: 'creatures@hogwarts.local', phone: '+1-555-0411', website: 'https://hogwarts.local/hagrid', city: 'Hogwarts Grounds', state: 'Scotland', country: 'GB', isPublicProgram: true, programSlug: 'hagrids-creatures', programBio: 'Home to magical and mundane creatures alike. Specializing in the unusual.' },
    { name: 'Ministry Beast Division', emailBase: 'beasts@ministry.local', phone: '+1-555-0412', city: 'London', state: 'England', country: 'GB', isPublicProgram: false },
  ],
  winterfell: [
    { name: 'Stark Kennels', emailBase: 'kennels@winterfell.local', phone: '+1-555-0421', city: 'Winterfell', state: 'The North', country: 'US', isPublicProgram: false },
    { name: 'Northern Stables', emailBase: 'stables@winterfell.local', phone: '+1-555-0422', city: 'Winterfell', state: 'The North', country: 'US', isPublicProgram: false },
  ],
  'cair-paravel': [
    { name: 'Royal Menagerie', emailBase: 'menagerie@narnia.local', phone: '+1-555-0431', website: 'https://narnia.local/royal', city: 'Cair Paravel', state: 'Eastern Sea', country: 'US', isPublicProgram: true, programSlug: 'royal-menagerie', programBio: 'The official breeding program of the Kings and Queens of Narnia.' },
    { name: 'Shuddering Wood Preserve', emailBase: 'preserve@narnia.local', phone: '+1-555-0432', city: 'Shuddering Wood', state: 'Western Wild', country: 'US', isPublicProgram: true, programSlug: 'shuddering-preserve', programBio: 'Conservation and breeding in the wild lands of Narnia.' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// GENETIC DATA HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export interface LocusData {
  locus: string;
  locusName: string;
  allele1?: string;
  allele2?: string;
  genotype: string;
}

export interface GeneticsData {
  coatColor?: LocusData[];
  coatType?: LocusData[];
  physicalTraits?: LocusData[];
  eyeColor?: LocusData[];
  health?: LocusData[];
}

export function locus(locusCode: string, locusName: string, allele1: string, allele2: string): LocusData {
  return {
    locus: locusCode,
    locusName,
    allele1,
    allele2,
    genotype: `${allele1}/${allele2}`,
  };
}

export function healthLocus(locusCode: string, locusName: string, status: string): LocusData {
  return {
    locus: locusCode,
    locusName,
    genotype: status,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMAL DEFINITIONS (per tenant, with lineage up to 6 generations)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AnimalDefinition {
  name: string;
  species: Species;
  sex: Sex;
  breed: string;
  generation: number; // 0 = founder, 1-5 = descendants
  sireRef?: string;   // Reference to sire by name
  damRef?: string;    // Reference to dam by name
  birthYear: number;
  notes?: string;
  genetics: GeneticsData;
  testProvider?: string;
  // Privacy overrides (if different from tenant default)
  privacyOverrides?: Partial<{
    showName: boolean;
    showPhoto: boolean;
    showFullDob: boolean;
    showRegistryFull: boolean;
    showHealthResults: boolean;
    showGeneticData: boolean;
    showBreeder: boolean;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLE EARTH ANIMALS (Dogs, Horses, Cats)
// ═══════════════════════════════════════════════════════════════════════════════

export const RIVENDELL_ANIMALS: AnimalDefinition[] = [
  // DOGS - German Shepherd lineage (Elven Hounds)
  // Generation 0 - Founders
  { name: 'Huan the Great', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'Legendary founder sire of the Elven Hound line.',
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')], health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear')] } },
  { name: 'Luthien Tinuviel', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'Legendary founder dam, known for grace and beauty.',
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')], health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear')] } },
  // Generation 1
  { name: 'Carcharoth', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 1, sireRef: 'Huan the Great', damRef: 'Luthien Tinuviel', birthYear: 2017, testProvider: 'Embark',
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')] } },
  { name: 'Tevildo', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 1, sireRef: 'Huan the Great', damRef: 'Luthien Tinuviel', birthYear: 2017, testProvider: 'Embark',
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')] } },
  // Generation 2
  { name: 'Draugluin', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 2, sireRef: 'Carcharoth', damRef: 'Tevildo', birthYear: 2019, testProvider: 'Embark',
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')] } },
  { name: 'Thuringwethil', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 2, sireRef: 'Carcharoth', damRef: 'Tevildo', birthYear: 2019, testProvider: 'Embark',
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'b', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')] } },
  // Generation 3
  { name: 'Garm', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 3, sireRef: 'Draugluin', damRef: 'Thuringwethil', birthYear: 2021, testProvider: 'Embark',
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')], health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m')] } },
  { name: 'Werewolf of Tol Sirion', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 3, sireRef: 'Draugluin', damRef: 'Thuringwethil', birthYear: 2021, testProvider: 'Embark',
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'd', 'd'), locus('K', 'Black Extension', 'ky', 'ky')] } },
  // Generation 4
  { name: 'Fenrir', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 4, sireRef: 'Garm', damRef: 'Werewolf of Tol Sirion', birthYear: 2023, testProvider: 'Embark',
    notes: 'Current breeding male. Watch for DM carrier status.',
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')], health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m')] } },
  { name: 'Sköll', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 4, sireRef: 'Garm', damRef: 'Werewolf of Tol Sirion', birthYear: 2023, testProvider: 'Embark',
    notes: 'Current breeding female.',
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')], health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear')] } },
  // Generation 5
  { name: 'Hati', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 5, sireRef: 'Fenrir', damRef: 'Sköll', birthYear: 2025, testProvider: 'Embark',
    notes: 'Young prospect from latest litter.',
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')], health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m')] } },

  // HORSES - Andalusian (Elven Steeds)
  { name: 'Shadowfax', species: 'HORSE', sex: 'MALE', breed: 'Andalusian', generation: 0, birthYear: 2014, testProvider: 'UC Davis VGL',
    notes: 'Lord of all horses, chief of the Mearas.',
    genetics: { coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'g'), locus('Cr', 'Cream', 'n', 'n')] } },
  { name: 'Asfaloth', species: 'HORSE', sex: 'MALE', breed: 'Andalusian', generation: 0, birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: "Glorfindel's white steed.",
    genetics: { coatColor: [locus('E', 'Extension', 'e', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'g', 'g'), locus('Cr', 'Cream', 'Cr', 'Cr')] } },
  { name: 'Nahar', species: 'HORSE', sex: 'FEMALE', breed: 'Andalusian', generation: 0, birthYear: 2014, testProvider: 'UC Davis VGL',
    notes: 'Steed of the Vala Oromë.',
    genetics: { coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'g'), locus('Cr', 'Cream', 'n', 'n')] } },
  { name: 'Felaróf', species: 'HORSE', sex: 'MALE', breed: 'Andalusian', generation: 1, sireRef: 'Shadowfax', damRef: 'Nahar', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'First of the Mearas to be tamed.',
    genetics: { coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'g'), locus('Cr', 'Cream', 'n', 'n')] } },

  // CATS - Maine Coon (Elven Companions)
  { name: 'Queen Beruthiel Cat I', species: 'CAT', sex: 'FEMALE', breed: 'Maine Coon', generation: 0, birthYear: 2018, testProvider: 'UC Davis VGL',
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'C')] } },
  { name: 'Tevildo Prince of Cats', species: 'CAT', sex: 'MALE', breed: 'Maine Coon', generation: 0, birthYear: 2017, testProvider: 'UC Davis VGL',
    genetics: { coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'cs')] } },
  { name: 'Shadow Cat of Mordor', species: 'CAT', sex: 'MALE', breed: 'Maine Coon', generation: 1, sireRef: 'Tevildo Prince of Cats', damRef: 'Queen Beruthiel Cat I', birthYear: 2020, testProvider: 'UC Davis VGL',
    genetics: { coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')] } },
  { name: 'Mirkwood Prowler', species: 'CAT', sex: 'FEMALE', breed: 'Maine Coon', generation: 1, sireRef: 'Tevildo Prince of Cats', damRef: 'Queen Beruthiel Cat I', birthYear: 2020, testProvider: 'UC Davis VGL',
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'cs')] } },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HOGWARTS ANIMALS (Cats, Rabbits, Dogs)
// ═══════════════════════════════════════════════════════════════════════════════

export const HOGWARTS_ANIMALS: AnimalDefinition[] = [
  // CATS - British Shorthair (Wizarding Familiars)
  { name: 'Mrs Norris', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
    notes: "Filch's loyal cat, exceptional at catching students.",
    genetics: { coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'd', 'd'), locus('C', 'Colorpoint', 'C', 'C')], health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')] } },
  { name: 'Crookshanks', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 0, birthYear: 2010, testProvider: 'UC Davis VGL',
    notes: "Hermione's half-Kneazle familiar.",
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('O', 'Orange', 'O', 'Y')], health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')] } },
  { name: 'Millicent Bulstrode Cat', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 1, sireRef: 'Crookshanks', damRef: 'Mrs Norris', birthYear: 2016,
    genetics: { coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')] } },
  { name: 'Kneazle Descendant', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 2, sireRef: 'Crookshanks', damRef: 'Millicent Bulstrode Cat', birthYear: 2019,
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')] } },

  // RABBITS - Holland Lop (Magical Creatures Class)
  { name: 'Binky the First', species: 'RABBIT', sex: 'MALE', breed: 'Holland Lop', generation: 0, birthYear: 2018,
    notes: "Memorial rabbit from Lavender Brown's line.",
    genetics: { coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Color Series', 'C', 'cchd'), locus('D', 'Dilute', 'D', 'd'), locus('En', 'English Spotting', 'en', 'en')] } },
  { name: 'Scabbers Descendant', species: 'RABBIT', sex: 'FEMALE', breed: 'Holland Lop', generation: 0, birthYear: 2018,
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Color Series', 'C', 'C'), locus('D', 'Dilute', 'D', 'D'), locus('En', 'English Spotting', 'En', 'en')] } },
  { name: 'Magical Menagerie Lop', species: 'RABBIT', sex: 'MALE', breed: 'Holland Lop', generation: 1, sireRef: 'Binky the First', damRef: 'Scabbers Descendant', birthYear: 2020,
    genetics: { coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Color Series', 'C', 'cchd'), locus('D', 'Dilute', 'D', 'd'), locus('En', 'English Spotting', 'En', 'en')] } },
  { name: 'Diagon Alley Bunny', species: 'RABBIT', sex: 'FEMALE', breed: 'Holland Lop', generation: 1, sireRef: 'Binky the First', damRef: 'Scabbers Descendant', birthYear: 2020,
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Color Series', 'C', 'C'), locus('D', 'Dilute', 'D', 'd'), locus('En', 'English Spotting', 'en', 'en')] } },

  // DOGS - Irish Wolfhound (Gamekeeper's Dogs)
  { name: 'Fang', species: 'DOG', sex: 'MALE', breed: 'Irish Wolfhound', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: "Hagrid's boarhound, actually quite cowardly.",
    genetics: { coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')], health: [healthLocus('DCM', 'Dilated Cardiomyopathy', 'At Risk')] } },
  { name: 'Fluffy Jr', species: 'DOG', sex: 'FEMALE', breed: 'Irish Wolfhound', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'Named after the three-headed dog.',
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')], health: [healthLocus('DCM', 'Dilated Cardiomyopathy', 'Clear')] } },
  { name: 'Norbert Hound', species: 'DOG', sex: 'MALE', breed: 'Irish Wolfhound', generation: 1, sireRef: 'Fang', damRef: 'Fluffy Jr', birthYear: 2018, testProvider: 'Embark',
    genetics: { coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')] } },
  { name: 'Buckbeak Hound', species: 'DOG', sex: 'FEMALE', breed: 'Irish Wolfhound', generation: 1, sireRef: 'Fang', damRef: 'Fluffy Jr', birthYear: 2018, testProvider: 'Embark',
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')] } },
];

// ═══════════════════════════════════════════════════════════════════════════════
// WINTERFELL ANIMALS (Dogs, Horses)
// ═══════════════════════════════════════════════════════════════════════════════

export const WINTERFELL_ANIMALS: AnimalDefinition[] = [
  // DOGS - Alaskan Malamute (Direwolves)
  { name: 'Grey Wind', species: 'DOG', sex: 'MALE', breed: 'Alaskan Malamute', generation: 0, birthYear: 2016, testProvider: 'Embark',
    notes: "Robb Stark's direwolf.",
    genetics: { coatColor: [locus('A', 'Agouti', 'Aw', 'Aw'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')], health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear')] } },
  { name: 'Lady', species: 'DOG', sex: 'FEMALE', breed: 'Alaskan Malamute', generation: 0, birthYear: 2016, testProvider: 'Embark',
    notes: "Sansa Stark's direwolf.",
    genetics: { coatColor: [locus('A', 'Agouti', 'Aw', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')], health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear')] } },
  { name: 'Nymeria', species: 'DOG', sex: 'FEMALE', breed: 'Alaskan Malamute', generation: 0, birthYear: 2016, testProvider: 'Embark',
    notes: "Arya Stark's direwolf, leads a wolf pack.",
    genetics: { coatColor: [locus('A', 'Agouti', 'Aw', 'Aw'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')], health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m')] } },
  { name: 'Summer', species: 'DOG', sex: 'MALE', breed: 'Alaskan Malamute', generation: 0, birthYear: 2016, testProvider: 'Embark',
    notes: "Bran Stark's direwolf.",
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')], health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear')] } },
  // Generation 1
  { name: 'Ghost', species: 'DOG', sex: 'MALE', breed: 'Alaskan Malamute', generation: 1, sireRef: 'Grey Wind', damRef: 'Lady', birthYear: 2019, testProvider: 'Embark',
    notes: "Jon Snow's albino direwolf.",
    genetics: { coatColor: [locus('A', 'Agouti', 'Aw', 'Aw'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky'), locus('S', 'White Spotting', 'sw', 'sw')], health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear')] } },
  { name: 'Shaggydog', species: 'DOG', sex: 'MALE', breed: 'Alaskan Malamute', generation: 1, sireRef: 'Summer', damRef: 'Nymeria', birthYear: 2019, testProvider: 'Embark',
    notes: "Rickon Stark's wild direwolf.",
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'KB', 'ky')], health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m')] } },
  // Generation 2
  { name: 'Winter Pup Alpha', species: 'DOG', sex: 'MALE', breed: 'Alaskan Malamute', generation: 2, sireRef: 'Ghost', damRef: 'Nymeria', birthYear: 2022, testProvider: 'Embark',
    genetics: { coatColor: [locus('A', 'Agouti', 'Aw', 'Aw'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')] } },
  { name: 'Winter Pup Beta', species: 'DOG', sex: 'FEMALE', breed: 'Alaskan Malamute', generation: 2, sireRef: 'Ghost', damRef: 'Nymeria', birthYear: 2022, testProvider: 'Embark',
    genetics: { coatColor: [locus('A', 'Agouti', 'Aw', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')] } },

  // HORSES - Friesian (Northern Warhorses)
  { name: 'Stranger', species: 'HORSE', sex: 'MALE', breed: 'Friesian', generation: 0, birthYear: 2014, testProvider: 'UC Davis VGL',
    notes: "The Hound's vicious warhorse.",
    genetics: { coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'a', 'a')] } },
  { name: 'Northern Destrier', species: 'HORSE', sex: 'FEMALE', breed: 'Friesian', generation: 0, birthYear: 2015, testProvider: 'UC Davis VGL',
    genetics: { coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'a', 'a')] } },
  { name: 'Ice Storm', species: 'HORSE', sex: 'MALE', breed: 'Friesian', generation: 1, sireRef: 'Stranger', damRef: 'Northern Destrier', birthYear: 2018,
    genetics: { coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'a', 'a')] } },
  { name: 'Night Mare', species: 'HORSE', sex: 'FEMALE', breed: 'Friesian', generation: 1, sireRef: 'Stranger', damRef: 'Northern Destrier', birthYear: 2018,
    genetics: { coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'a', 'a')] } },
];

// ═══════════════════════════════════════════════════════════════════════════════
// NARNIA ANIMALS (Cats, Goats, Horses, Dogs)
// ═══════════════════════════════════════════════════════════════════════════════

export const NARNIA_ANIMALS: AnimalDefinition[] = [
  // CATS - Ragdoll (Talking Beasts)
  { name: 'Ginger the Deceiver', species: 'CAT', sex: 'MALE', breed: 'Ragdoll', generation: 0, birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'A cunning cat from the Last Battle.',
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Colorpoint', 'cs', 'cs'), locus('D', 'Dilute', 'D', 'D')], health: [healthLocus('HCM_RD', 'HCM (Ragdoll)', 'N/N')] } },
  { name: 'Tash Priestess Cat', species: 'CAT', sex: 'FEMALE', breed: 'Ragdoll', generation: 0, birthYear: 2017, testProvider: 'UC Davis VGL',
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Colorpoint', 'cs', 'cs'), locus('D', 'Dilute', 'D', 'd')], health: [healthLocus('HCM_RD', 'HCM (Ragdoll)', 'N/m')] } },
  { name: 'Narnian Temple Cat', species: 'CAT', sex: 'MALE', breed: 'Ragdoll', generation: 1, sireRef: 'Ginger the Deceiver', damRef: 'Tash Priestess Cat', birthYear: 2020,
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Colorpoint', 'cs', 'cs'), locus('D', 'Dilute', 'D', 'd')] } },
  { name: 'Aslan Blessed Cat', species: 'CAT', sex: 'FEMALE', breed: 'Ragdoll', generation: 1, sireRef: 'Ginger the Deceiver', damRef: 'Tash Priestess Cat', birthYear: 2020,
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Colorpoint', 'cs', 'cs'), locus('D', 'Dilute', 'D', 'D')] } },

  // GOATS - Nigerian Dwarf (Archenland Goats)
  { name: 'Puzzle the Donkey Goat', species: 'GOAT', sex: 'MALE', breed: 'Nigerian Dwarf', generation: 0, birthYear: 2018,
    notes: 'Named after the deceived donkey from Last Battle.',
    genetics: { coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Ab'), locus('B', 'Brown', 'B', 'B')], physicalTraits: [locus('P', 'Polled', 'P', 'p')], health: [healthLocus('G6S', 'G6S', 'N/N')] } },
  { name: 'Archenland Nanny', species: 'GOAT', sex: 'FEMALE', breed: 'Nigerian Dwarf', generation: 0, birthYear: 2018,
    genetics: { coatColor: [locus('A', 'Agouti Pattern', 'Awt', 'Ab')], physicalTraits: [locus('P', 'Polled', 'p', 'p')], health: [healthLocus('G6S', 'G6S', 'N/N')] } },
  { name: 'Calormen Kid', species: 'GOAT', sex: 'MALE', breed: 'Nigerian Dwarf', generation: 1, sireRef: 'Puzzle the Donkey Goat', damRef: 'Archenland Nanny', birthYear: 2021,
    genetics: { coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Awt')], physicalTraits: [locus('P', 'Polled', 'P', 'p')] } },
  { name: 'Telmar Doeling', species: 'GOAT', sex: 'FEMALE', breed: 'Nigerian Dwarf', generation: 1, sireRef: 'Puzzle the Donkey Goat', damRef: 'Archenland Nanny', birthYear: 2021,
    genetics: { coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Ab')], physicalTraits: [locus('P', 'Polled', 'p', 'p')] } },

  // HORSES - Lipizzan (Narnian Talking Horses)
  { name: 'Bree', species: 'HORSE', sex: 'MALE', breed: 'Lipizzan', generation: 0, birthYear: 2014, testProvider: 'UC Davis VGL',
    notes: 'The horse and his boy - a Narnian talking horse.',
    genetics: { coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'G', 'g')] } },
  { name: 'Hwin', species: 'HORSE', sex: 'FEMALE', breed: 'Lipizzan', generation: 0, birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'Brave mare companion of Aravis.',
    genetics: { coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'g')] } },
  { name: 'Fledge', species: 'HORSE', sex: 'MALE', breed: 'Lipizzan', generation: 1, sireRef: 'Bree', damRef: 'Hwin', birthYear: 2018,
    notes: 'Named after the winged horse.',
    genetics: { coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'G', 'g')] } },
  { name: 'Destrier', species: 'HORSE', sex: 'FEMALE', breed: 'Lipizzan', generation: 1, sireRef: 'Bree', damRef: 'Hwin', birthYear: 2018,
    genetics: { coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'G')] } },

  // DOGS - Cavalier King Charles Spaniel (Narnian Companions)
  { name: 'Reepicheep Hound', species: 'DOG', sex: 'MALE', breed: 'Cavalier King Charles Spaniel', generation: 0, birthYear: 2018, testProvider: 'Embark',
    notes: 'Named after the valiant mouse.',
    genetics: { coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('E', 'Extension', 'E', 'e'), locus('S', 'White Spotting', 'sp', 'sp')], health: [healthLocus('MVD', 'Mitral Valve Disease', 'At Risk')] } },
  { name: 'Trufflehunter Dame', species: 'DOG', sex: 'FEMALE', breed: 'Cavalier King Charles Spaniel', generation: 0, birthYear: 2018, testProvider: 'Embark',
    notes: 'Named after the loyal badger.',
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('E', 'Extension', 'E', 'E'), locus('S', 'White Spotting', 'sp', 'sp')], health: [healthLocus('MVD', 'Mitral Valve Disease', 'N/N')] } },
  { name: 'Caspian Pup', species: 'DOG', sex: 'MALE', breed: 'Cavalier King Charles Spaniel', generation: 1, sireRef: 'Reepicheep Hound', damRef: 'Trufflehunter Dame', birthYear: 2021, testProvider: 'Embark',
    genetics: { coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('E', 'Extension', 'E', 'e'), locus('S', 'White Spotting', 'sp', 'sp')] } },
  { name: 'Jadis Pup', species: 'DOG', sex: 'FEMALE', breed: 'Cavalier King Charles Spaniel', generation: 1, sireRef: 'Reepicheep Hound', damRef: 'Trufflehunter Dame', birthYear: 2021, testProvider: 'Embark',
    genetics: { coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('E', 'Extension', 'E', 'E'), locus('S', 'White Spotting', 'sp', 'sp')] } },
];

// Map tenant slugs to their animals
export const TENANT_ANIMALS: Record<string, AnimalDefinition[]> = {
  rivendell: RIVENDELL_ANIMALS,
  hogwarts: HOGWARTS_ANIMALS,
  winterfell: WINTERFELL_ANIMALS,
  'cair-paravel': NARNIA_ANIMALS,
};

// ═══════════════════════════════════════════════════════════════════════════════
// BREEDING PLAN DEFINITIONS (per tenant)
// ═══════════════════════════════════════════════════════════════════════════════

export interface BreedingPlanDefinition {
  name: string;
  nickname?: string;
  species: Species;
  breedText?: string;
  damRef: string;  // Reference to dam by name
  sireRef: string; // Reference to sire by name
  status: 'PLANNING' | 'COMMITTED';
  notes?: string;
  expectedCycleStart?: Date;
}

export const TENANT_BREEDING_PLANS: Record<string, BreedingPlanDefinition[]> = {
  rivendell: [
    { name: 'House of Huan 2026', nickname: 'Spring Litter', species: 'DOG', breedText: 'German Shepherd', damRef: 'Sköll', sireRef: 'Fenrir', status: 'PLANNING', notes: 'Planning spring 2026 litter from our top producing pair.', expectedCycleStart: new Date('2026-03-01') },
    { name: 'Mearas Legacy', species: 'HORSE', breedText: 'Andalusian', damRef: 'Nahar', sireRef: 'Felaróf', status: 'COMMITTED', notes: 'Committed breeding to continue the Mearas bloodline.' },
    { name: 'Elven Cat Program 2026', species: 'CAT', breedText: 'Maine Coon', damRef: 'Mirkwood Prowler', sireRef: 'Shadow Cat of Mordor', status: 'PLANNING', notes: 'Expanding our feline program.' },
    { name: 'Silmaril Line', species: 'DOG', breedText: 'German Shepherd', damRef: 'Werewolf of Tol Sirion', sireRef: 'Garm', status: 'COMMITTED', notes: 'Preservation breeding for rare color genetics.' },
  ],
  hogwarts: [
    { name: 'Magical Creatures 2026', species: 'CAT', breedText: 'British Shorthair', damRef: 'Millicent Bulstrode Cat', sireRef: 'Kneazle Descendant', status: 'PLANNING', notes: 'Care of Magical Creatures class project.' },
    { name: 'Hagrid\'s Hounds Q2', species: 'DOG', breedText: 'Irish Wolfhound', damRef: 'Buckbeak Hound', sireRef: 'Norbert Hound', status: 'COMMITTED', notes: 'Continuing the Hogwarts groundskeeper tradition.' },
    { name: 'Bunny Breeding 101', species: 'RABBIT', breedText: 'Holland Lop', damRef: 'Diagon Alley Bunny', sireRef: 'Magical Menagerie Lop', status: 'PLANNING', notes: 'Teaching breeding basics to students.' },
  ],
  winterfell: [
    { name: 'Direwolf Pack 2026', nickname: 'Winter is Coming', species: 'DOG', breedText: 'Alaskan Malamute', damRef: 'Winter Pup Beta', sireRef: 'Winter Pup Alpha', status: 'COMMITTED', notes: 'Restoring the Stark direwolf pack.' },
    { name: 'Northern Cavalry', species: 'HORSE', breedText: 'Friesian', damRef: 'Night Mare', sireRef: 'Ice Storm', status: 'PLANNING', notes: 'Breeding warhorses for the Night\'s Watch.' },
    { name: 'Nymeria\'s Line', species: 'DOG', breedText: 'Alaskan Malamute', damRef: 'Nymeria', sireRef: 'Ghost', status: 'PLANNING', notes: 'Wild breeding program.' },
  ],
  'cair-paravel': [
    { name: 'Royal Feline Court', species: 'CAT', breedText: 'Ragdoll', damRef: 'Aslan Blessed Cat', sireRef: 'Narnian Temple Cat', status: 'COMMITTED', notes: 'Palace cat breeding program.' },
    { name: 'Talking Horse Program', species: 'HORSE', breedText: 'Lipizzan', damRef: 'Destrier', sireRef: 'Fledge', status: 'PLANNING', notes: 'Continuing the Narnian horse tradition.' },
    { name: 'Archenland Goats 2026', species: 'GOAT', breedText: 'Nigerian Dwarf', damRef: 'Telmar Doeling', sireRef: 'Calormen Kid', status: 'COMMITTED', notes: 'Supplying Archenland farms.' },
    { name: 'Royal Companions', species: 'DOG', breedText: 'Cavalier King Charles Spaniel', damRef: 'Jadis Pup', sireRef: 'Caspian Pup', status: 'PLANNING', notes: 'Companions for the royal family.' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE LISTING DEFINITIONS (per tenant)
// ═══════════════════════════════════════════════════════════════════════════════

export interface MarketplaceListingDefinition {
  title: string;
  description: string;
  listingType: 'BREEDING_PROGRAM' | 'STUD_SERVICE';
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
  priceCents?: number;
  priceType?: string;
  city: string;
  state: string;
  country: string;
}

export const TENANT_MARKETPLACE_LISTINGS: Record<string, MarketplaceListingDefinition[]> = {
  rivendell: [
    { title: 'House of Elrond Premium Breeding', description: 'Ancient elven breeding techniques for exceptional companions.', listingType: 'BREEDING_PROGRAM', status: 'ACTIVE', city: 'Rivendell', state: 'Eriador', country: 'US' },
    { title: 'Mearas Stud Services', description: 'Premium stud service from Shadowfax bloodlines.', listingType: 'STUD_SERVICE', status: 'ACTIVE', priceCents: 250000, priceType: 'fixed', city: 'Rivendell', state: 'Eriador', country: 'US' },
    { title: 'Elven Hound Stud', description: 'German Shepherd stud from Huan lineage.', listingType: 'STUD_SERVICE', status: 'DRAFT', priceCents: 150000, priceType: 'fixed', city: 'Rivendell', state: 'Eriador', country: 'US' },
  ],
  hogwarts: [
    { title: 'Magical Creatures Breeding Program', description: 'Hagrid-approved breeding program for unique companions.', listingType: 'BREEDING_PROGRAM', status: 'ACTIVE', city: 'Hogwarts', state: 'Scotland', country: 'GB' },
    { title: 'Kneazle Mix Breeding', description: 'Half-Kneazle cats with exceptional intuition.', listingType: 'STUD_SERVICE', status: 'DRAFT', priceCents: 100000, priceType: 'starting_at', city: 'Hogsmeade', state: 'Scotland', country: 'GB' },
  ],
  winterfell: [
    // Winterfell has no public listings - private program
    { title: 'Direwolf Preservation', description: 'Private breeding program for the noble houses.', listingType: 'BREEDING_PROGRAM', status: 'DRAFT', city: 'Winterfell', state: 'The North', country: 'US' },
  ],
  'cair-paravel': [
    { title: 'Royal Menagerie of Narnia', description: 'Official breeding program of the Narnian royal family.', listingType: 'BREEDING_PROGRAM', status: 'ACTIVE', city: 'Cair Paravel', state: 'Eastern Sea', country: 'US' },
    { title: 'Talking Horse Stud Services', description: 'Descendants of Bree and Hwin available for breeding.', listingType: 'STUD_SERVICE', status: 'ACTIVE', priceCents: 300000, priceType: 'contact', city: 'Cair Paravel', state: 'Eastern Sea', country: 'US' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// CREDENTIAL SUMMARY (for password vault)
// ═══════════════════════════════════════════════════════════════════════════════

export function generateCredentialsSummary(env: Environment): string {
  const lines: string[] = [
    `═══════════════════════════════════════════════════════════════════════════════`,
    `BREEDERHQ VALIDATION TENANT CREDENTIALS - ${ENV_PREFIX[env]} ENVIRONMENT`,
    `═══════════════════════════════════════════════════════════════════════════════`,
    ``,
  ];

  for (const tenant of TENANT_DEFINITIONS) {
    const user = TENANT_USERS[tenant.slug];
    const envSlug = getEnvSlug(tenant.slug, env);
    const envEmail = getEnvEmail(user.emailBase, env);

    lines.push(`─────────────────────────────────────────────────────────────────────────────`);
    lines.push(`TENANT: ${getEnvName(tenant.theme.name, env)}`);
    lines.push(`─────────────────────────────────────────────────────────────────────────────`);
    lines.push(`  Slug:     ${envSlug}`);
    lines.push(`  Theme:    ${tenant.theme.name}`);
    lines.push(`  Species:  ${tenant.species.join(', ')}`);
    lines.push(``);
    lines.push(`  OWNER/ADMIN:`);
    lines.push(`    Name:     ${user.firstName} ${user.lastName}`);
    lines.push(`    Email:    ${envEmail}`);
    lines.push(`    Password: ${user.password}`);
    lines.push(``);
    lines.push(`  MARKETPLACE:`);
    lines.push(`    Public Program: ${tenant.marketplaceVisibility.isPublicProgram ? 'Yes' : 'No'}`);
    lines.push(`    Active Listings: ${tenant.marketplaceVisibility.hasActiveListings ? 'Yes' : 'No'}`);
    lines.push(`    Programs Enabled: ${tenant.marketplaceVisibility.programsEnabled}`);
    lines.push(``);
    lines.push(`  VISIBILITY:`);
    lines.push(`    Cross-Tenant Matching: ${tenant.lineageVisibility.allowCrossTenantMatching ? 'Yes' : 'No'}`);
    lines.push(`    Show Full DOB: ${tenant.lineageVisibility.defaultShowFullDob ? 'Yes' : 'No'}`);
    lines.push(`    Show Genetics: ${tenant.lineageVisibility.defaultShowGeneticData ? 'Yes' : 'No'}`);
    lines.push(`    Show Health: ${tenant.lineageVisibility.defaultShowHealthResults ? 'Yes' : 'No'}`);
    lines.push(``);
  }

  return lines.join('\n');
}
