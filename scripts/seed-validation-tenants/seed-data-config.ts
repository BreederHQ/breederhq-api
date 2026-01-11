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

// DEV THEMES
export const DEV_THEMES: Record<string, ThemeDefinition> = {
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
  marvel: {
    id: 'marvel',
    name: 'Marvel Avengers',
    primaryColor: '#ED1D24',
    secondaryColor: '#1E3A8A',
    accentColor: '#F4C430',
    logoText: 'Stark Industries',
  },
};

// PROD THEMES - Completely different universes
export const PROD_THEMES: Record<string, ThemeDefinition> = {
  dune: {
    id: 'dune',
    name: 'Dune Arrakis',
    primaryColor: '#C2A366',
    secondaryColor: '#1A1A2E',
    accentColor: '#00D4FF',
    logoText: 'House Atreides',
  },
  startrek: {
    id: 'startrek',
    name: 'Star Trek',
    primaryColor: '#0057B7',
    secondaryColor: '#FFD700',
    accentColor: '#CC0000',
    logoText: 'Starfleet Academy',
  },
  tedlasso: {
    id: 'tedlasso',
    name: 'Ted Lasso',
    primaryColor: '#00529F',
    secondaryColor: '#FFD700',
    accentColor: '#DC143C',
    logoText: 'AFC Richmond',
  },
  matrix: {
    id: 'matrix',
    name: 'The Matrix',
    primaryColor: '#003300',
    secondaryColor: '#000000',
    accentColor: '#00FF00',
    logoText: 'Zion Collective',
  },
};

// Legacy export for compatibility
export const TENANT_THEMES = DEV_THEMES;

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
// No longer prefixing names - the different themes between DEV and PROD
// are sufficient to distinguish environments. Slugs still have dev-/prod- prefix.
export function getEnvName(baseName: string, _env: Environment): string {
  return baseName;
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

// Visibility presets for reuse
const FULL_VISIBILITY = {
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
};

const PARTIAL_VISIBILITY = {
  allowCrossTenantMatching: true,
  defaultShowName: true,
  defaultShowPhoto: true,
  defaultShowFullDob: false,
  defaultShowRegistryFull: false,
  defaultShowHealthResults: true,
  defaultShowGeneticData: false,
  defaultShowBreeder: true,
  defaultAllowInfoRequests: true,
  defaultAllowDirectContact: false,
};

const NO_VISIBILITY = {
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
};

const MIXED_VISIBILITY = {
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
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEV TENANT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const DEV_TENANT_DEFINITIONS: TenantDefinition[] = [
  // TENANT 1: Middle Earth (Lord of the Rings) - Full visibility, public program
  {
    slug: 'rivendell',
    theme: DEV_THEMES.middleEarth,
    marketplaceVisibility: { isPublicProgram: true, hasActiveListings: true, programsEnabled: 2, programsSaved: 1 },
    lineageVisibility: FULL_VISIBILITY,
    species: ['DOG', 'HORSE', 'CAT'],
  },
  // TENANT 2: Hogwarts (Harry Potter) - Partial visibility
  {
    slug: 'hogwarts',
    theme: DEV_THEMES.hogwarts,
    marketplaceVisibility: { isPublicProgram: true, hasActiveListings: true, programsEnabled: 1, programsSaved: 1 },
    lineageVisibility: PARTIAL_VISIBILITY,
    species: ['CAT', 'RABBIT', 'DOG'],
  },
  // TENANT 3: Westeros (Game of Thrones) - Private, no visibility
  {
    slug: 'winterfell',
    theme: DEV_THEMES.westeros,
    marketplaceVisibility: { isPublicProgram: false, hasActiveListings: false, programsEnabled: 0, programsSaved: 1 },
    lineageVisibility: NO_VISIBILITY,
    species: ['DOG', 'HORSE'],
  },
  // TENANT 4: Marvel Avengers - Mixed visibility
  {
    slug: 'stark-tower',
    theme: DEV_THEMES.marvel,
    marketplaceVisibility: { isPublicProgram: true, hasActiveListings: true, programsEnabled: 2, programsSaved: 0 },
    lineageVisibility: MIXED_VISIBILITY,
    species: ['CAT', 'GOAT', 'HORSE', 'DOG'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PROD TENANT DEFINITIONS - Completely different themes
// ═══════════════════════════════════════════════════════════════════════════════

export const PROD_TENANT_DEFINITIONS: TenantDefinition[] = [
  // TENANT 1: Dune Arrakis - Full visibility, public program
  {
    slug: 'arrakis',
    theme: PROD_THEMES.dune,
    marketplaceVisibility: { isPublicProgram: true, hasActiveListings: true, programsEnabled: 2, programsSaved: 1 },
    lineageVisibility: FULL_VISIBILITY,
    species: ['DOG', 'HORSE', 'CAT'],
  },
  // TENANT 2: Star Trek - Partial visibility
  {
    slug: 'starfleet',
    theme: PROD_THEMES.startrek,
    marketplaceVisibility: { isPublicProgram: true, hasActiveListings: true, programsEnabled: 1, programsSaved: 1 },
    lineageVisibility: PARTIAL_VISIBILITY,
    species: ['CAT', 'RABBIT', 'DOG'],
  },
  // TENANT 3: Ted Lasso (AFC Richmond) - Private, no visibility
  {
    slug: 'richmond',
    theme: PROD_THEMES.tedlasso,
    marketplaceVisibility: { isPublicProgram: false, hasActiveListings: false, programsEnabled: 0, programsSaved: 1 },
    lineageVisibility: NO_VISIBILITY,
    species: ['DOG', 'HORSE'],
  },
  // TENANT 4: The Matrix - Mixed visibility
  {
    slug: 'zion',
    theme: PROD_THEMES.matrix,
    marketplaceVisibility: { isPublicProgram: true, hasActiveListings: true, programsEnabled: 2, programsSaved: 0 },
    lineageVisibility: MIXED_VISIBILITY,
    species: ['CAT', 'GOAT', 'HORSE', 'DOG'],
  },
];

// Helper to get tenant definitions for an environment
export function getTenantDefinitions(env: Environment): TenantDefinition[] {
  return env === 'prod' ? PROD_TENANT_DEFINITIONS : DEV_TENANT_DEFINITIONS;
}

// Legacy export - defaults to DEV
export const TENANT_DEFINITIONS = DEV_TENANT_DEFINITIONS;

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

// DEV Users
export const DEV_TENANT_USERS: Record<string, UserDefinition> = {
  rivendell: { firstName: 'Elrond', lastName: 'Peredhel', emailBase: 'elrond@rivendell.local', password: 'Rivendell123!', isSuperAdmin: false },
  hogwarts: { firstName: 'Rubeus', lastName: 'Hagrid', emailBase: 'hagrid@hogwarts.local', password: 'Hogwarts123!', isSuperAdmin: false },
  winterfell: { firstName: 'Eddard', lastName: 'Stark', emailBase: 'ned.stark@winterfell.local', password: 'Winterfell123!', isSuperAdmin: false },
  'stark-tower': { firstName: 'Tony', lastName: 'Stark', emailBase: 'tony.stark@avengers.local', password: 'Avengers123!', isSuperAdmin: false },
};

// PROD Users - Different themes
export const PROD_TENANT_USERS: Record<string, UserDefinition> = {
  arrakis: { firstName: 'Paul', lastName: 'Atreides', emailBase: 'paul@arrakis.local', password: 'Arrakis123!', isSuperAdmin: false },
  starfleet: { firstName: 'Jean-Luc', lastName: 'Picard', emailBase: 'picard@starfleet.local', password: 'Starfleet123!', isSuperAdmin: false },
  richmond: { firstName: 'Ted', lastName: 'Lasso', emailBase: 'ted@afcrichmond.local', password: 'Richmond123!', isSuperAdmin: false },
  zion: { firstName: 'Neo', lastName: 'Anderson', emailBase: 'neo@zion.local', password: 'Matrix123!', isSuperAdmin: false },
};

// Helper to get users for an environment
export function getTenantUsers(env: Environment): Record<string, UserDefinition> {
  return env === 'prod' ? PROD_TENANT_USERS : DEV_TENANT_USERS;
}

// Legacy export - defaults to DEV
export const TENANT_USERS = DEV_TENANT_USERS;

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
  // Marvel contacts
  'stark-tower': [
    { firstName: 'Steve', lastName: 'Rogers', nickname: 'Captain America', emailBase: 'steve.rogers@avengers.local', phone: '+1-555-0331', city: 'Brooklyn', state: 'NY', country: 'US' },
    { firstName: 'Natasha', lastName: 'Romanoff', nickname: 'Black Widow', emailBase: 'natasha@avengers.local', phone: '+1-555-0332', city: 'New York', state: 'NY', country: 'US' },
    { firstName: 'Bruce', lastName: 'Banner', nickname: 'Hulk', emailBase: 'bruce.banner@avengers.local', phone: '+1-555-0333', city: 'New York', state: 'NY', country: 'US' },
    { firstName: 'Thor', lastName: 'Odinson', emailBase: 'thor@asgard.local', phone: '+1-555-0334', city: 'Asgard', state: 'Realm Eternal', country: 'US' },
    { firstName: 'Clint', lastName: 'Barton', nickname: 'Hawkeye', emailBase: 'clint.barton@avengers.local', phone: '+1-555-0335', city: 'Iowa', state: 'IA', country: 'US' },
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
  'stark-tower': [
    { name: 'Stark Industries K9 Division', emailBase: 'k9@stark.local', phone: '+1-555-0431', website: 'https://stark.local/k9', city: 'New York', state: 'NY', country: 'US', isPublicProgram: true, programSlug: 'stark-k9', programBio: 'Advanced breeding program powered by Stark Industries technology.' },
    { name: 'Avengers Compound Animals', emailBase: 'animals@avengers.local', phone: '+1-555-0432', city: 'Upstate', state: 'NY', country: 'US', isPublicProgram: true, programSlug: 'avengers-animals', programBio: 'Home to the animal companions of Earth\'s Mightiest Heroes.' },
  ],
};

// PROD Contacts
export const PROD_TENANT_CONTACTS: Record<string, ContactDefinition[]> = {
  arrakis: [
    { firstName: 'Duncan', lastName: 'Idaho', emailBase: 'duncan@atreides.local', phone: '+1-555-0401', city: 'Arrakeen', state: 'Arrakis', country: 'US' },
    { firstName: 'Stilgar', lastName: 'Naib', emailBase: 'stilgar@fremen.local', phone: '+1-555-0402', city: 'Sietch Tabr', state: 'Desert', country: 'US' },
    { firstName: 'Chani', lastName: 'Kynes', emailBase: 'chani@fremen.local', phone: '+1-555-0403', city: 'Sietch Tabr', state: 'Desert', country: 'US' },
    { firstName: 'Gurney', lastName: 'Halleck', emailBase: 'gurney@atreides.local', phone: '+1-555-0404', city: 'Arrakeen', state: 'Arrakis', country: 'US' },
    { firstName: 'Thufir', lastName: 'Hawat', emailBase: 'thufir@atreides.local', phone: '+1-555-0405', city: 'Arrakeen', state: 'Arrakis', country: 'US' },
  ],
  starfleet: [
    { firstName: 'William', lastName: 'Riker', nickname: 'Number One', emailBase: 'riker@starfleet.local', phone: '+1-555-0411', city: 'San Francisco', state: 'CA', country: 'US' },
    { firstName: 'Data', lastName: 'Soong', emailBase: 'data@starfleet.local', phone: '+1-555-0412', city: 'San Francisco', state: 'CA', country: 'US' },
    { firstName: 'Beverly', lastName: 'Crusher', emailBase: 'crusher@starfleet.local', phone: '+1-555-0413', city: 'San Francisco', state: 'CA', country: 'US' },
    { firstName: 'Deanna', lastName: 'Troi', emailBase: 'troi@starfleet.local', phone: '+1-555-0414', city: 'San Francisco', state: 'CA', country: 'US' },
    { firstName: 'Worf', lastName: 'Mogh', emailBase: 'worf@starfleet.local', phone: '+1-555-0415', city: 'San Francisco', state: 'CA', country: 'US' },
  ],
  richmond: [
    { firstName: 'Rebecca', lastName: 'Welton', emailBase: 'rebecca@afcrichmond.local', phone: '+1-555-0421', city: 'Richmond', state: 'London', country: 'GB' },
    { firstName: 'Roy', lastName: 'Kent', emailBase: 'roy.kent@afcrichmond.local', phone: '+1-555-0422', city: 'Richmond', state: 'London', country: 'GB' },
    { firstName: 'Keeley', lastName: 'Jones', emailBase: 'keeley@afcrichmond.local', phone: '+1-555-0423', city: 'Richmond', state: 'London', country: 'GB' },
    { firstName: 'Jamie', lastName: 'Tartt', emailBase: 'jamie.tartt@afcrichmond.local', phone: '+1-555-0424', city: 'Richmond', state: 'London', country: 'GB' },
    { firstName: 'Coach', lastName: 'Beard', emailBase: 'beard@afcrichmond.local', phone: '+1-555-0425', city: 'Richmond', state: 'London', country: 'GB' },
  ],
  zion: [
    { firstName: 'Morpheus', lastName: 'Captain', emailBase: 'morpheus@zion.local', phone: '+1-555-0431', city: 'Zion', state: 'Underground', country: 'US' },
    { firstName: 'Trinity', lastName: 'Operator', emailBase: 'trinity@zion.local', phone: '+1-555-0432', city: 'Zion', state: 'Underground', country: 'US' },
    { firstName: 'Tank', lastName: 'Operator', emailBase: 'tank@zion.local', phone: '+1-555-0433', city: 'Zion', state: 'Underground', country: 'US' },
    { firstName: 'Niobe', lastName: 'Captain', emailBase: 'niobe@zion.local', phone: '+1-555-0434', city: 'Zion', state: 'Underground', country: 'US' },
    { firstName: 'Oracle', lastName: 'Program', emailBase: 'oracle@matrix.local', phone: '+1-555-0435', city: 'Matrix', state: 'Simulation', country: 'US' },
  ],
};

// Helper to get contacts for an environment
export function getTenantContacts(env: Environment): Record<string, ContactDefinition[]> {
  return env === 'prod' ? PROD_TENANT_CONTACTS : TENANT_CONTACTS;
}

// PROD Organizations
export const PROD_TENANT_ORGANIZATIONS: Record<string, OrganizationDefinition[]> = {
  arrakis: [
    { name: 'House Atreides Stables', emailBase: 'stables@atreides.local', phone: '+1-555-0501', website: 'https://atreides.local', city: 'Arrakeen', state: 'Arrakis', country: 'US', isPublicProgram: true, programSlug: 'atreides-stables', programBio: 'Noble breeding traditions of House Atreides.' },
    { name: 'Fremen Animal Preserve', emailBase: 'preserve@fremen.local', phone: '+1-555-0502', city: 'Sietch Tabr', state: 'Desert', country: 'US', isPublicProgram: true, programSlug: 'fremen-preserve', programBio: 'Desert-adapted breeding program.' },
    { name: 'Spacing Guild Kennels', emailBase: 'kennels@guild.local', phone: '+1-555-0503', city: 'Heighliner', state: 'Space', country: 'US', isPublicProgram: false },
  ],
  starfleet: [
    { name: 'Starfleet Academy Animals', emailBase: 'academy@starfleet.local', phone: '+1-555-0511', website: 'https://starfleet.local/academy', city: 'San Francisco', state: 'CA', country: 'US', isPublicProgram: true, programSlug: 'starfleet-academy', programBio: 'Training companion animals for Starfleet officers.' },
    { name: 'Vulcan Science Academy', emailBase: 'vulcan@starfleet.local', phone: '+1-555-0512', city: 'ShiKahr', state: 'Vulcan', country: 'US', isPublicProgram: false },
  ],
  richmond: [
    { name: 'AFC Richmond Kennels', emailBase: 'kennels@afcrichmond.local', phone: '+1-555-0521', city: 'Richmond', state: 'London', country: 'GB', isPublicProgram: false },
    { name: 'Nelson Road Stables', emailBase: 'stables@afcrichmond.local', phone: '+1-555-0522', city: 'Richmond', state: 'London', country: 'GB', isPublicProgram: false },
  ],
  zion: [
    { name: 'Zion Breeding Collective', emailBase: 'collective@zion.local', phone: '+1-555-0531', website: 'https://zion.local', city: 'Zion', state: 'Underground', country: 'US', isPublicProgram: true, programSlug: 'zion-collective', programBio: 'Last human breeding program.' },
    { name: 'Nebuchadnezzar Crew', emailBase: 'neb@zion.local', phone: '+1-555-0532', city: 'Hovership', state: 'Underground', country: 'US', isPublicProgram: true, programSlug: 'neb-crew', programBio: 'Crew companions for the resistance.' },
  ],
};

// Helper to get organizations for an environment
export function getTenantOrganizations(env: Environment): Record<string, OrganizationDefinition[]> {
  return env === 'prod' ? PROD_TENANT_ORGANIZATIONS : TENANT_ORGANIZATIONS;
}

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
// TITLE AND COMPETITION DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type TitleCategory = 'CONFORMATION' | 'OBEDIENCE' | 'AGILITY' | 'FIELD' | 'HERDING' | 'RALLY' | 'PRODUCING' | 'BREED_SPECIFIC' | 'PERFORMANCE' | 'OTHER';
export type CompetitionType = 'CONFORMATION_SHOW' | 'OBEDIENCE_TRIAL' | 'AGILITY_TRIAL' | 'FIELD_TRIAL' | 'RALLY_TRIAL' | 'BREED_SPECIALTY' | 'OTHER';

export interface TitleDefinition {
  abbreviation: string;       // "CH", "GCH", "CD"
  fullName: string;           // "Champion", "Companion Dog"
  category: TitleCategory;
  organization: string;       // "AKC", "UKC", "TICA"
  isPrefix: boolean;          // true = "CH Duke", false = "Duke CD"
  pointsRequired?: number;
  prerequisiteTitle?: string; // "CH" required before "GCH"
}

export interface AnimalTitleDefinition {
  titleAbbreviation: string;  // Reference to TitleDefinition
  dateEarned: string;         // ISO date string
  eventName?: string;
  eventLocation?: string;
  handlerName?: string;
  pointsEarned?: number;
  majorWins?: number;
}

export interface CompetitionEntryDefinition {
  eventName: string;
  eventDate: string;          // ISO date string
  location: string;
  organization: string;
  competitionType: CompetitionType;
  className?: string;
  placement?: number;
  placementLabel?: string;    // "Winners Dog", "Best of Breed"
  pointsEarned?: number;
  isMajorWin?: boolean;
  judgeName?: string;
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
  // Titles earned by this animal
  titles?: AnimalTitleDefinition[];
  // Competition entries for this animal
  competitions?: CompetitionEntryDefinition[];
  // COI test note (for documentation purposes)
  coiTestScenario?: string;
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

// Standard title definitions used across tenants
export const STANDARD_DOG_TITLES: TitleDefinition[] = [
  // Conformation
  { abbreviation: 'CH', fullName: 'Champion', category: 'CONFORMATION', organization: 'AKC', isPrefix: true, pointsRequired: 15 },
  { abbreviation: 'GCH', fullName: 'Grand Champion', category: 'CONFORMATION', organization: 'AKC', isPrefix: true, prerequisiteTitle: 'CH' },
  { abbreviation: 'GCHB', fullName: 'Grand Champion Bronze', category: 'CONFORMATION', organization: 'AKC', isPrefix: true, prerequisiteTitle: 'GCH' },
  { abbreviation: 'GCHS', fullName: 'Grand Champion Silver', category: 'CONFORMATION', organization: 'AKC', isPrefix: true, prerequisiteTitle: 'GCHB' },
  // Obedience
  { abbreviation: 'CD', fullName: 'Companion Dog', category: 'OBEDIENCE', organization: 'AKC', isPrefix: false },
  { abbreviation: 'CDX', fullName: 'Companion Dog Excellent', category: 'OBEDIENCE', organization: 'AKC', isPrefix: false, prerequisiteTitle: 'CD' },
  { abbreviation: 'UD', fullName: 'Utility Dog', category: 'OBEDIENCE', organization: 'AKC', isPrefix: false, prerequisiteTitle: 'CDX' },
  // Rally
  { abbreviation: 'RN', fullName: 'Rally Novice', category: 'RALLY', organization: 'AKC', isPrefix: false },
  { abbreviation: 'RA', fullName: 'Rally Advanced', category: 'RALLY', organization: 'AKC', isPrefix: false, prerequisiteTitle: 'RN' },
  { abbreviation: 'RE', fullName: 'Rally Excellent', category: 'RALLY', organization: 'AKC', isPrefix: false, prerequisiteTitle: 'RA' },
  // Agility
  { abbreviation: 'NA', fullName: 'Novice Agility', category: 'AGILITY', organization: 'AKC', isPrefix: false },
  { abbreviation: 'OA', fullName: 'Open Agility', category: 'AGILITY', organization: 'AKC', isPrefix: false, prerequisiteTitle: 'NA' },
  { abbreviation: 'AX', fullName: 'Agility Excellent', category: 'AGILITY', organization: 'AKC', isPrefix: false, prerequisiteTitle: 'OA' },
  { abbreviation: 'MX', fullName: 'Master Agility Excellent', category: 'AGILITY', organization: 'AKC', isPrefix: false, prerequisiteTitle: 'AX' },
  // Producing titles
  { abbreviation: 'ROM', fullName: 'Register of Merit', category: 'PRODUCING', organization: 'AKC', isPrefix: false },
];

export const STANDARD_HORSE_TITLES: TitleDefinition[] = [
  { abbreviation: 'CH', fullName: 'Champion', category: 'CONFORMATION', organization: 'APHA', isPrefix: true },
  { abbreviation: 'SCH', fullName: 'Superior Champion', category: 'CONFORMATION', organization: 'APHA', isPrefix: true, prerequisiteTitle: 'CH' },
  { abbreviation: 'WCH', fullName: 'World Champion', category: 'CONFORMATION', organization: 'APHA', isPrefix: true },
  { abbreviation: 'ROM', fullName: 'Register of Merit', category: 'PERFORMANCE', organization: 'APHA', isPrefix: false },
  { abbreviation: 'ROMH', fullName: 'Register of Merit Halter', category: 'CONFORMATION', organization: 'APHA', isPrefix: false },
];

export const STANDARD_CAT_TITLES: TitleDefinition[] = [
  { abbreviation: 'CH', fullName: 'Champion', category: 'CONFORMATION', organization: 'TICA', isPrefix: true },
  { abbreviation: 'GC', fullName: 'Grand Champion', category: 'CONFORMATION', organization: 'TICA', isPrefix: true, prerequisiteTitle: 'CH' },
  { abbreviation: 'DGC', fullName: 'Double Grand Champion', category: 'CONFORMATION', organization: 'TICA', isPrefix: true, prerequisiteTitle: 'GC' },
  { abbreviation: 'TGC', fullName: 'Triple Grand Champion', category: 'CONFORMATION', organization: 'TICA', isPrefix: true, prerequisiteTitle: 'DGC' },
  { abbreviation: 'QGC', fullName: 'Quadruple Grand Champion', category: 'CONFORMATION', organization: 'TICA', isPrefix: true, prerequisiteTitle: 'TGC' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLE EARTH ANIMALS (Dogs, Horses, Cats)
// Comprehensive COI testing, health marker warnings, and title/competition data
// ═══════════════════════════════════════════════════════════════════════════════

export const RIVENDELL_ANIMALS: AnimalDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════════
  // DOGS - German Shepherd lineage (Elven Hounds)
  // Two founder lines for COI testing: Huan Line + Oromë Line
  // ═══════════════════════════════════════════════════════════════════════════════

  // === HUAN LINE (Line A) - Generation 0 Founders ===
  { name: 'Huan the Great (EIC Carrier Founder Male)', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 0, birthYear: 2012, testProvider: 'Embark',
    notes: 'Legendary founder sire of Line A. DM Clear, EIC Carrier - WARNING: carrier status.',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear'), healthLocus('EIC', 'Exercise-Induced Collapse', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2014-05-15', eventName: 'Rivendell Kennel Club', eventLocation: 'Rivendell', pointsEarned: 15, majorWins: 2 },
      { titleAbbreviation: 'GCH', dateEarned: '2015-09-20', eventName: 'Eriador National', eventLocation: 'Grey Havens', pointsEarned: 25 },
      { titleAbbreviation: 'ROM', dateEarned: '2018-01-01', eventName: 'Breeding Record', pointsEarned: 10 },
    ],
    competitions: [
      { eventName: 'Rivendell Kennel Club', eventDate: '2014-05-15', location: 'Rivendell', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Open Dogs', placement: 1, placementLabel: 'Winners Dog', pointsEarned: 5, isMajorWin: true, judgeName: 'Elrond Peredhel' },
      { eventName: 'Eriador National', eventDate: '2015-09-20', location: 'Grey Havens', organization: 'AKC', competitionType: 'BREED_SPECIALTY', className: 'Best of Breed', placement: 1, placementLabel: 'Best of Breed', pointsEarned: 5, isMajorWin: true },
    ]
  },
  { name: 'Luthien Tinuviel (Clear Founder Female)', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 0, birthYear: 2012, testProvider: 'Embark',
    notes: 'Founder dam Line A. DM Clear, EIC Clear.',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear'), healthLocus('EIC', 'Exercise-Induced Collapse', 'Clear')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2014-06-10', eventName: 'Rivendell Kennel Club', eventLocation: 'Rivendell', pointsEarned: 15, majorWins: 2 },
    ]
  },

  // === OROMË LINE (Line B) - Generation 0 Founders (unrelated to Huan) ===
  { name: 'Oromë Hunter (DM Carrier Founder Male)', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 0, birthYear: 2012, testProvider: 'Embark',
    notes: 'Founder sire Line B. DM Carrier, EIC Carrier - WARNING: double carrier!',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'aw', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('EIC', 'Exercise-Induced Collapse', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2014-07-20', eventName: 'Valinor Championship', eventLocation: 'Aman', pointsEarned: 15, majorWins: 2 },
      { titleAbbreviation: 'CD', dateEarned: '2015-03-10', eventName: 'Obedience Trial', eventLocation: 'Rivendell' },
    ]
  },
  { name: 'Vána Evergreen (DM Carrier Founder Female)', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 0, birthYear: 2013, testProvider: 'Embark',
    notes: 'Founder dam Line B. DM Carrier, EIC Clear.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'd', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('EIC', 'Exercise-Induced Collapse', 'Clear')]
    }
  },

  // === Generation 1 - Children of Founders ===
  { name: 'Carcharoth (EIC Carrier Male)', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 1, sireRef: 'Huan the Great (EIC Carrier Founder Male)', damRef: 'Luthien Tinuviel (Clear Founder Female)', birthYear: 2014, testProvider: 'Embark',
    notes: 'Son of Huan × Luthien (Line A). EIC Carrier inherited from sire.',
    coiTestScenario: 'Gen 1 Line A - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear'), healthLocus('EIC', 'Exercise-Induced Collapse', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2016-04-15', eventName: 'Middle Earth Nationals', eventLocation: 'Minas Tirith', pointsEarned: 15, majorWins: 2 },
    ]
  },
  { name: 'Tevildo (Clear Female)', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 1, sireRef: 'Huan the Great (EIC Carrier Founder Male)', damRef: 'Luthien Tinuviel (Clear Founder Female)', birthYear: 2014, testProvider: 'Embark',
    notes: 'Daughter of Huan × Luthien (Line A). Full sister to Carcharoth.',
    coiTestScenario: 'Gen 1 Line A - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear'), healthLocus('EIC', 'Exercise-Induced Collapse', 'Clear')]
    }
  },
  { name: 'Nahar Hound (DM Carrier Male)', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 1, sireRef: 'Oromë Hunter (DM Carrier Founder Male)', damRef: 'Vána Evergreen (DM Carrier Founder Female)', birthYear: 2015, testProvider: 'Embark',
    notes: 'Son of Oromë × Vána (Line B). DM Carrier.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'aw', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('EIC', 'Exercise-Induced Collapse', 'N/m')]
    }
  },
  { name: 'Tilion Moonhound (DM Carrier Female)', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 1, sireRef: 'Oromë Hunter (DM Carrier Founder Male)', damRef: 'Vána Evergreen (DM Carrier Founder Female)', birthYear: 2015, testProvider: 'Embark',
    notes: 'Daughter of Oromë × Vána (Line B). Full sister to Nahar Hound.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'd', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('EIC', 'Exercise-Induced Collapse', 'Clear')]
    }
  },

  // === Generation 2 - COUSIN MATING (Line A × Line B) ===
  { name: 'Draugluin (DM Carrier Male)', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 2, sireRef: 'Carcharoth (EIC Carrier Male)', damRef: 'Tilion Moonhound (DM Carrier Female)', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line A sire × Line B dam. First cross between lines. DM Carrier, EIC Carrier.',
    coiTestScenario: 'Gen 2 outcross - COI ~0% (unrelated lines)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('EIC', 'Exercise-Induced Collapse', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2019-05-20', eventName: 'Mirkwood Regional', eventLocation: 'Woodland Realm', pointsEarned: 15, majorWins: 2 },
      { titleAbbreviation: 'RN', dateEarned: '2019-08-15', eventName: 'Rally Trial', eventLocation: 'Rivendell' },
      { titleAbbreviation: 'RA', dateEarned: '2020-02-10', eventName: 'Rally Trial', eventLocation: 'Rivendell' },
    ]
  },
  { name: 'Thuringwethil (DM Carrier Female)', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 2, sireRef: 'Nahar Hound (DM Carrier Male)', damRef: 'Tevildo (Clear Female)', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line B sire × Line A dam. Cross between lines. DM Carrier, EIC Carrier - DOUBLE CARRIER WARNING!',
    coiTestScenario: 'Gen 2 outcross - COI ~0% (unrelated lines)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'aw', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('EIC', 'Exercise-Induced Collapse', 'N/m')]
    }
  },

  // === Generation 3 - HALF-SIBLING MATING (shared grandparent Huan) ===
  { name: 'Garm (DM Carrier High COI Male)', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 3, sireRef: 'Draugluin (DM Carrier Male)', damRef: 'Thuringwethil (DM Carrier Female)', birthYear: 2019, testProvider: 'Embark',
    notes: 'Both parents share Huan the Great as grandparent. MODERATE COI. DM Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 3 half-cousin mating - COI ~6.25% (shared great-grandparent)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('EIC', 'Exercise-Induced Collapse', 'N/m')]
    }
  },
  { name: 'Werewolf of Tol Sirion (Clear High COI Female)', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 3, sireRef: 'Draugluin (DM Carrier Male)', damRef: 'Thuringwethil (DM Carrier Female)', birthYear: 2019, testProvider: 'Embark',
    notes: 'Full sister to Garm. MODERATE COI. Lucked out - DM Clear!',
    coiTestScenario: 'Gen 3 half-cousin mating - COI ~6.25% (shared great-grandparent)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'aw', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'd', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear'), healthLocus('EIC', 'Exercise-Induced Collapse', 'Clear')]
    }
  },

  // === Generation 4 - FULL SIBLING MATING (Garm × Werewolf = HIGH COI) ===
  { name: 'Fenrir (DM Carrier Critical COI Male)', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 4, sireRef: 'Garm (DM Carrier High COI Male)', damRef: 'Werewolf of Tol Sirion (Clear High COI Female)', birthYear: 2021, testProvider: 'Embark',
    notes: 'FULL SIBLING PARENTS! HIGH COI ~25%. Watch for DM carrier from sire.',
    coiTestScenario: 'Gen 4 full sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('EIC', 'Exercise-Induced Collapse', 'Clear')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2023-06-15', eventName: 'Mordor Border Show', eventLocation: 'Ithilien', pointsEarned: 15, majorWins: 2 },
    ]
  },
  { name: 'Sköll (Clear Critical COI Female)', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 4, sireRef: 'Garm (DM Carrier High COI Male)', damRef: 'Werewolf of Tol Sirion (Clear High COI Female)', birthYear: 2021, testProvider: 'Embark',
    notes: 'Full sister to Fenrir. HIGH COI ~25%. DM Clear.',
    coiTestScenario: 'Gen 4 full sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'aw', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear'), healthLocus('EIC', 'Exercise-Induced Collapse', 'N/m')]
    }
  },

  // === Generation 5 - ANOTHER FULL SIBLING MATING (CRITICAL COI) ===
  { name: 'Hati (DM Carrier Critical COI Male)', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 5, sireRef: 'Fenrir (DM Carrier Critical COI Male)', damRef: 'Sköll (Clear Critical COI Female)', birthYear: 2023, testProvider: 'Embark',
    notes: 'PARENTS ARE FULL SIBLINGS! CRITICAL COI ~37.5%. This is a linebreeding test case.',
    coiTestScenario: 'Gen 5 consecutive sibling matings - COI ~37.5% (CRITICAL)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('EIC', 'Exercise-Induced Collapse', 'N/m')]
    }
  },
  { name: 'Mánagarm (Clear Critical COI Female)', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 5, sireRef: 'Fenrir (DM Carrier Critical COI Male)', damRef: 'Sköll (Clear Critical COI Female)', birthYear: 2023, testProvider: 'Embark',
    notes: 'Full sister to Hati. CRITICAL COI. Test for inbreeding depression.',
    coiTestScenario: 'Gen 5 consecutive sibling matings - COI ~37.5% (CRITICAL)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'aw', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear'), healthLocus('EIC', 'Exercise-Induced Collapse', 'Clear')]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // HORSES - Andalusian/Paint (Elven Steeds) with OLWS (Lethal White) testing
  // ═══════════════════════════════════════════════════════════════════════════════
  { name: 'Shadowfax (Frame Overo Stallion)', species: 'HORSE', sex: 'MALE', breed: 'Andalusian', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
    notes: 'Lord of all horses. OLWS Carrier - WARNING for lethal white overo!',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'g'), locus('Cr', 'Cream', 'n', 'n')],
      health: [healthLocus('OLWS', 'Lethal White Overo Syndrome', 'O/n')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2015-04-10', eventName: 'Mearas Championship', eventLocation: 'Rohan' },
      { titleAbbreviation: 'SCH', dateEarned: '2017-08-20', eventName: 'Middle Earth Nationals', eventLocation: 'Gondor' },
    ]
  },
  { name: 'Nahar (Frame Overo Mare)', species: 'HORSE', sex: 'FEMALE', breed: 'Andalusian', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
    notes: 'Steed of Oromë. OLWS Carrier - DO NOT BREED TO SHADOWFAX (25% lethal white)!',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'g'), locus('Cr', 'Cream', 'n', 'n')],
      health: [healthLocus('OLWS', 'Lethal White Overo Syndrome', 'O/n')]
    }
  },
  { name: 'Asfaloth (Non-Overo Safe Stallion)', species: 'HORSE', sex: 'MALE', breed: 'Andalusian', generation: 0, birthYear: 2013, testProvider: 'UC Davis VGL',
    notes: "Glorfindel's white steed. OLWS Clear - safe to breed to carriers.",
    genetics: {
      coatColor: [locus('E', 'Extension', 'e', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'g', 'g'), locus('Cr', 'Cream', 'Cr', 'Cr')],
      health: [healthLocus('OLWS', 'Lethal White Overo Syndrome', 'n/n')]
    }
  },
  { name: 'Felaróf (Frame Overo Colt)', species: 'HORSE', sex: 'MALE', breed: 'Andalusian', generation: 1, sireRef: 'Shadowfax (Frame Overo Stallion)', damRef: 'Nahar (Frame Overo Mare)', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'First Mearas. OLWS Carrier inherited. Moderate COI from carrier × carrier mating.',
    coiTestScenario: 'Carrier × Carrier warning test - 25% lethal outcome',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'g'), locus('Cr', 'Cream', 'n', 'n')],
      health: [healthLocus('OLWS', 'Lethal White Overo Syndrome', 'O/n')]
    }
  },
  { name: 'Arod (Non-Overo Safe Colt)', species: 'HORSE', sex: 'MALE', breed: 'Andalusian', generation: 1, sireRef: 'Asfaloth (Non-Overo Safe Stallion)', damRef: 'Nahar (Frame Overo Mare)', birthYear: 2017, testProvider: 'UC Davis VGL',
    notes: "Legolas's horse. Safe breeding - OLWS Clear.",
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'G', 'g'), locus('Cr', 'Cream', 'Cr', 'n')],
      health: [healthLocus('OLWS', 'Lethal White Overo Syndrome', 'n/n')]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CATS - Maine Coon with HCM (Heart Disease) testing
  // ═══════════════════════════════════════════════════════════════════════════════
  { name: 'Tevildo Prince of Cats (HCM Carrier Type A Male)', species: 'CAT', sex: 'MALE', breed: 'Maine Coon', generation: 0, birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'HCM Carrier - WARNING for hypertrophic cardiomyopathy! Blood Type A.',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'cs')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N'), healthLocus('BloodType', 'Blood Type', 'A')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2017-03-15', eventName: 'TICA Regional', eventLocation: 'Mirkwood' },
      { titleAbbreviation: 'GC', dateEarned: '2018-06-20', eventName: 'TICA Supreme', eventLocation: 'Rivendell' },
    ]
  },
  { name: 'Queen Beruthiel Cat I (HCM Carrier Type B Female)', species: 'CAT', sex: 'FEMALE', breed: 'Maine Coon', generation: 0, birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'HCM Carrier - DO NOT BREED TO TEVILDO (25% affected risk)! Blood Type B - WARNING for neonatal isoerythrolysis if bred to Type A sire!',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N'), healthLocus('BloodType', 'Blood Type', 'B')]
    }
  },
  { name: 'Shadow Cat of Mordor (HCM Clear Male)', species: 'CAT', sex: 'MALE', breed: 'Maine Coon', generation: 1, sireRef: 'Tevildo Prince of Cats (HCM Carrier Type A Male)', damRef: 'Queen Beruthiel Cat I (HCM Carrier Type B Female)', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'CARRIER × CARRIER offspring. Got lucky - HCM Clear!',
    coiTestScenario: 'Carrier × Carrier heart disease warning test',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2020-05-10', eventName: 'Mordor Cat Fanciers', eventLocation: 'Barad-dûr' },
    ]
  },
  { name: 'Mirkwood Prowler (HCM Affected Female)', species: 'CAT', sex: 'FEMALE', breed: 'Maine Coon', generation: 1, sireRef: 'Tevildo Prince of Cats (HCM Carrier Type A Male)', damRef: 'Queen Beruthiel Cat I (HCM Carrier Type B Female)', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'CARRIER × CARRIER offspring. HCM Affected - DO NOT BREED!',
    coiTestScenario: 'Carrier × Carrier - this one got the affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'cs')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'm/m'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // INCOMPLETE GENETICS - What's Missing Analysis Test
  // ═══════════════════════════════════════════════════════════════════════════════
  { name: 'Gandalf\'s Rescue (Incomplete Genetics)', species: 'DOG', sex: 'MALE', breed: 'Mixed Breed', generation: 0, birthYear: 2022,
    notes: 'INTENTIONALLY INCOMPLETE. Recently rescued from the Misty Mountains. Only has B locus. For testing What\'s Missing analysis.',
    genetics: {
      coatColor: [locus('B', 'Brown', 'B', 'b')]
      // No health data - triggers suggestions
    }
  },
  { name: 'Elrond\'s New Acquisition (Awaiting Test)', species: 'HORSE', sex: 'FEMALE', breed: 'Arabian', generation: 0, birthYear: 2024,
    notes: 'NO GENETICS YET. Newly arrived from the East. For testing What\'s Missing analysis.',
    genetics: {
      // Completely empty - tests worst case
    }
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HOGWARTS ANIMALS (Cats, Rabbits, Dogs)
// Two founder lines for COI testing + PKD carrier warnings for cats
// ═══════════════════════════════════════════════════════════════════════════════

export const HOGWARTS_ANIMALS: AnimalDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════════
  // CATS - British Shorthair (Wizarding Familiars)
  // Two founder lines: Crookshanks Line + Mrs Norris Line for COI testing
  // PKD carrier warnings for health testing
  // ═══════════════════════════════════════════════════════════════════════════════

  // === CROOKSHANKS LINE (Line A) - Generation 0 Founders ===
  { name: 'Crookshanks (PKD Carrier Founder Male)', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 0, birthYear: 2010, testProvider: 'UC Davis VGL',
    notes: "Hermione's half-Kneazle familiar. Founder Line A. PKD Carrier - WARNING!",
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('O', 'Orange', 'O', 'Y')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2012-03-15', eventName: 'Diagon Alley Cat Show', eventLocation: 'London', pointsEarned: 200 },
      { titleAbbreviation: 'GC', dateEarned: '2013-06-20', eventName: 'Ministry Cat Championship', eventLocation: 'London', pointsEarned: 500 },
    ],
    competitions: [
      { eventName: 'Diagon Alley Cat Show', eventDate: '2012-03-15', location: 'London', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Open', placement: 1, placementLabel: 'Best in Show', pointsEarned: 200, isMajorWin: true, judgeName: 'Minerva McGonagall' },
    ]
  },
  { name: 'Kneazle Queen (Clear Founder Female)', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 0, birthYear: 2011, testProvider: 'UC Davis VGL',
    notes: "Crookshanks' mate. Founder dam Line A. PKD Clear.",
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('O', 'Orange', 'o', 'o')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N')]
    }
  },

  // === MRS NORRIS LINE (Line B) - Generation 0 Founders (unrelated) ===
  { name: 'Mrs Norris (PKD Carrier Founder Female)', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
    notes: "Filch's loyal cat. Founder Line B. PKD Carrier - WARNING for kidney disease!",
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'd', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2014-09-10', eventName: 'Hogwarts Familiar Show', eventLocation: 'Hogwarts', pointsEarned: 200 },
    ]
  },
  { name: 'Argus Tom (HCM Carrier Founder Male)', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
    notes: "Founder sire Line B. PKD Clear, HCM Carrier.",
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'cs')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },

  // === Generation 1 - Children of Founders ===
  { name: 'Millicent Bulstrode Cat (PKD Carrier Female)', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 1, sireRef: 'Crookshanks (PKD Carrier Founder Male)', damRef: 'Kneazle Queen (Clear Founder Female)', birthYear: 2014, testProvider: 'UC Davis VGL',
    notes: 'Daughter of Crookshanks × Kneazle Queen (Line A). PKD Carrier inherited from sire.',
    coiTestScenario: 'Gen 1 Line A - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('O', 'Orange', 'o', 'o')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N')]
    }
  },
  { name: 'Kneazle Son (Clear Male)', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 1, sireRef: 'Crookshanks (PKD Carrier Founder Male)', damRef: 'Kneazle Queen (Clear Founder Female)', birthYear: 2014, testProvider: 'UC Davis VGL',
    notes: 'Son of Crookshanks × Kneazle Queen (Line A). PKD Clear.',
    coiTestScenario: 'Gen 1 Line A - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('O', 'Orange', 'O', 'Y')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N')]
    }
  },
  { name: 'Filch Kitten I (Double Carrier Male)', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 1, sireRef: 'Argus Tom (HCM Carrier Founder Male)', damRef: 'Mrs Norris (PKD Carrier Founder Female)', birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'Son of Argus × Mrs Norris (Line B). PKD Carrier, HCM Carrier - DOUBLE WARNING!',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },
  { name: 'Filch Kitten II (PKD Carrier Female)', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 1, sireRef: 'Argus Tom (HCM Carrier Founder Male)', damRef: 'Mrs Norris (PKD Carrier Founder Female)', birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'Daughter of Argus × Mrs Norris (Line B). PKD Carrier.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'd', 'd'), locus('C', 'Colorpoint', 'C', 'cs')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N')]
    }
  },

  // === Generation 2 - CROSS BETWEEN LINES (Line A × Line B) ===
  { name: 'Magical Cross Cat (PKD Carrier Male)', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 2, sireRef: 'Kneazle Son (Clear Male)', damRef: 'Filch Kitten II (PKD Carrier Female)', birthYear: 2017, testProvider: 'UC Davis VGL',
    notes: 'Line A sire × Line B dam. First cross between lines. PKD Carrier.',
    coiTestScenario: 'Gen 2 outcross - COI ~0% (unrelated lines)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2019-05-15', eventName: 'Hogsmeade Show', eventLocation: 'Hogsmeade', pointsEarned: 200 },
    ]
  },
  { name: 'Kneazle Descendant (Double Carrier Female)', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 2, sireRef: 'Filch Kitten I (Double Carrier Male)', damRef: 'Millicent Bulstrode Cat (PKD Carrier Female)', birthYear: 2017, testProvider: 'UC Davis VGL',
    notes: 'Line B sire × Line A dam. PKD Carrier × Carrier = 25% affected risk! HCM Carrier.',
    coiTestScenario: 'Gen 2 outcross - COI ~0% (unrelated lines) - PKD carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },

  // === Generation 3 - COUSIN MATING ===
  { name: 'Hogwarts Inbred Cat (Double Carrier High COI Male)', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 3, sireRef: 'Magical Cross Cat (PKD Carrier Male)', damRef: 'Kneazle Descendant (Double Carrier Female)', birthYear: 2019, testProvider: 'UC Davis VGL',
    notes: 'Parents share common ancestors. MODERATE COI. PKD Carrier × Carrier.',
    coiTestScenario: 'Gen 3 cousin mating - COI ~6.25% (shared great-grandparents)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },
  { name: 'Hogwarts Sister Cat (Clear High COI Female)', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 3, sireRef: 'Magical Cross Cat (PKD Carrier Male)', damRef: 'Kneazle Descendant (Double Carrier Female)', birthYear: 2019, testProvider: 'UC Davis VGL',
    notes: 'Full sister. MODERATE COI. Got lucky - PKD Clear!',
    coiTestScenario: 'Gen 3 cousin mating - COI ~6.25%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N')]
    }
  },

  // === Generation 4 - FULL SIBLING MATING (HIGH COI) ===
  { name: 'Inbred Tom IV (PKD Carrier Critical COI Male)', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 4, sireRef: 'Hogwarts Inbred Cat (Double Carrier High COI Male)', damRef: 'Hogwarts Sister Cat (Clear High COI Female)', birthYear: 2021, testProvider: 'UC Davis VGL',
    notes: 'FULL SIBLING PARENTS! HIGH COI ~25%. PKD Carrier.',
    coiTestScenario: 'Gen 4 full sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },
  { name: 'Inbred Queen IV (Clear Critical COI Female)', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 4, sireRef: 'Hogwarts Inbred Cat (Double Carrier High COI Male)', damRef: 'Hogwarts Sister Cat (Clear High COI Female)', birthYear: 2021, testProvider: 'UC Davis VGL',
    notes: 'Full sister. HIGH COI ~25%. PKD Clear.',
    coiTestScenario: 'Gen 4 full sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N')]
    }
  },

  // === Generation 5 - ANOTHER SIBLING MATING (CRITICAL COI) ===
  { name: 'Critical COI Tom (PKD Carrier Critical COI Male)', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 5, sireRef: 'Inbred Tom IV (PKD Carrier Critical COI Male)', damRef: 'Inbred Queen IV (Clear Critical COI Female)', birthYear: 2023, testProvider: 'UC Davis VGL',
    notes: 'PARENTS ARE FULL SIBLINGS! CRITICAL COI ~37.5%. Test for inbreeding depression.',
    coiTestScenario: 'Gen 5 consecutive sibling matings - COI ~37.5% (CRITICAL)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCOTTISH FOLD CATS - Double Fold Warning Test (Osteochondrodysplasia)
  // Testing Fd/fd × Fd/fd = 25% Fd/Fd (severe cartilage/bone issues)
  // ═══════════════════════════════════════════════════════════════════════════════
  { name: 'McGonagall\'s Cat (Fold Carrier Female)', species: 'CAT', sex: 'FEMALE', breed: 'Scottish Fold', generation: 0, birthYear: 2020, testProvider: 'UC Davis VGL',
    notes: 'Named after Minerva. Fold carrier (Fd/fd). WARNING: Do not breed to another fold carrier!',
    coiTestScenario: 'Founder - Fold carrier for dangerous pairing test',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Colorpoint', 'C', 'C'), locus('D', 'Dilute', 'D', 'd')],
      physicalTraits: [locus('Fd', 'Fold', 'Fd', 'fd')],
      health: [healthLocus('OCD', 'Osteochondrodysplasia', 'At Risk'), healthLocus('BloodType', 'Blood Type', 'A')]
    }
  },
  { name: 'Dumbledore\'s Familiar (Fold Carrier Male)', species: 'CAT', sex: 'MALE', breed: 'Scottish Fold', generation: 0, birthYear: 2019, testProvider: 'UC Davis VGL',
    notes: 'Named after Albus. Fold carrier. Pair with McGonagall\'s Cat for DOUBLE FOLD WARNING!',
    coiTestScenario: 'Founder - Fold carrier for dangerous pairing test',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Colorpoint', 'C', 'C'), locus('D', 'Dilute', 'd', 'd')],
      physicalTraits: [locus('Fd', 'Fold', 'Fd', 'fd')],
      health: [healthLocus('OCD', 'Osteochondrodysplasia', 'At Risk'), healthLocus('BloodType', 'Blood Type', 'B')]
    }
  },
  { name: 'Sprout\'s Cat (Straight Eared Safe Female)', species: 'CAT', sex: 'FEMALE', breed: 'Scottish Straight', generation: 0, birthYear: 2021, testProvider: 'UC Davis VGL',
    notes: 'Professor Sprout\'s cat with normal ears. Non-fold (fd/fd). Safe to breed with any fold carrier.',
    coiTestScenario: 'Founder - Non-fold for safe pairing comparison',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Colorpoint', 'C', 'cs'), locus('D', 'Dilute', 'D', 'D')],
      physicalTraits: [locus('Fd', 'Fold', 'fd', 'fd')],
      health: [healthLocus('OCD', 'Osteochondrodysplasia', 'N/N'), healthLocus('BloodType', 'Blood Type', 'A')]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // RABBITS - Holland Lop (Magical Creatures Class)
  // ═══════════════════════════════════════════════════════════════════════════════
  { name: 'Binky the First', species: 'RABBIT', sex: 'MALE', breed: 'Holland Lop', generation: 0, birthYear: 2018,
    notes: "Memorial rabbit from Lavender Brown's line. Founder sire.",
    coiTestScenario: 'Founder - no inbreeding',
    genetics: { coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Color Series', 'C', 'cchd'), locus('D', 'Dilute', 'D', 'd'), locus('En', 'English Spotting', 'en', 'en')] },
    titles: [
      { titleAbbreviation: 'GC', dateEarned: '2020-04-10', eventName: 'ARBA National', eventLocation: 'London', pointsEarned: 5 },
    ]
  },
  { name: 'Scabbers Descendant', species: 'RABBIT', sex: 'FEMALE', breed: 'Holland Lop', generation: 0, birthYear: 2018,
    notes: 'Founder dam.',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Color Series', 'C', 'C'), locus('D', 'Dilute', 'D', 'D'), locus('En', 'English Spotting', 'En', 'en')] }
  },
  { name: 'Magical Menagerie Lop', species: 'RABBIT', sex: 'MALE', breed: 'Holland Lop', generation: 1, sireRef: 'Binky the First', damRef: 'Scabbers Descendant', birthYear: 2020,
    coiTestScenario: 'Gen 1 - COI ~0%',
    genetics: { coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Color Series', 'C', 'cchd'), locus('D', 'Dilute', 'D', 'd'), locus('En', 'English Spotting', 'En', 'en')] }
  },
  { name: 'Diagon Alley Bunny', species: 'RABBIT', sex: 'FEMALE', breed: 'Holland Lop', generation: 1, sireRef: 'Binky the First', damRef: 'Scabbers Descendant', birthYear: 2020,
    coiTestScenario: 'Gen 1 - COI ~0%',
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Color Series', 'C', 'C'), locus('D', 'Dilute', 'D', 'd'), locus('En', 'English Spotting', 'en', 'en')] }
  },
  // Generation 2 - sibling mating for COI
  { name: 'Inbred Lop Buck', species: 'RABBIT', sex: 'MALE', breed: 'Holland Lop', generation: 2, sireRef: 'Magical Menagerie Lop', damRef: 'Diagon Alley Bunny', birthYear: 2022,
    notes: 'FULL SIBLING PARENTS. COI ~25%.',
    coiTestScenario: 'Gen 2 full sibling mating - COI ~25% (HIGH)',
    genetics: { coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Color Series', 'C', 'cchd'), locus('D', 'Dilute', 'D', 'd'), locus('En', 'English Spotting', 'En', 'en')] }
  },
  { name: 'Inbred Lop Doe', species: 'RABBIT', sex: 'FEMALE', breed: 'Holland Lop', generation: 2, sireRef: 'Magical Menagerie Lop', damRef: 'Diagon Alley Bunny', birthYear: 2022,
    notes: 'Full sister. COI ~25%.',
    coiTestScenario: 'Gen 2 full sibling mating - COI ~25% (HIGH)',
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Color Series', 'C', 'C'), locus('D', 'Dilute', 'D', 'D'), locus('En', 'English Spotting', 'en', 'en')] }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // DOGS - Irish Wolfhound (Gamekeeper's Dogs)
  // Two founder lines + DCM (heart disease) carrier warnings
  // ═══════════════════════════════════════════════════════════════════════════════

  // === FANG LINE (Line A) ===
  { name: 'Fang', species: 'DOG', sex: 'MALE', breed: 'Irish Wolfhound', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: "Hagrid's boarhound. Founder Line A. DCM At Risk - WARNING for heart disease!",
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DCM', 'Dilated Cardiomyopathy', 'At Risk'), healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2016-08-20', eventName: 'Hogwarts Grounds Show', eventLocation: 'Hogwarts', pointsEarned: 15, majorWins: 2 },
    ],
    competitions: [
      { eventName: 'Hogwarts Grounds Show', eventDate: '2016-08-20', location: 'Hogwarts', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Open Dogs', placement: 1, placementLabel: 'Best of Breed', pointsEarned: 5, isMajorWin: true },
    ]
  },
  { name: 'Fluffy Jr', species: 'DOG', sex: 'FEMALE', breed: 'Irish Wolfhound', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'Named after the three-headed dog. Founder dam Line A. DCM Clear.',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DCM', 'Dilated Cardiomyopathy', 'Clear'), healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear')]
    }
  },

  // === FORBIDDEN FOREST LINE (Line B) ===
  { name: 'Aragog Hound', species: 'DOG', sex: 'MALE', breed: 'Irish Wolfhound', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: 'Named for the giant spider. Founder Line B. DCM Carrier, PRA Carrier - DOUBLE WARNING!',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'd', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DCM', 'Dilated Cardiomyopathy', 'N/m'), healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m')]
    }
  },
  { name: 'Thestral Dame', species: 'DOG', sex: 'FEMALE', breed: 'Irish Wolfhound', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'Founder dam Line B. DCM Carrier.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DCM', 'Dilated Cardiomyopathy', 'N/m'), healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear')]
    }
  },

  // === Generation 1 ===
  { name: 'Norbert Hound', species: 'DOG', sex: 'MALE', breed: 'Irish Wolfhound', generation: 1, sireRef: 'Fang', damRef: 'Fluffy Jr', birthYear: 2018, testProvider: 'Embark',
    notes: 'Son of Fang × Fluffy (Line A). Inherited At Risk from sire.',
    coiTestScenario: 'Gen 1 Line A - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DCM', 'Dilated Cardiomyopathy', 'At Risk'), healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear')]
    }
  },
  { name: 'Buckbeak Hound', species: 'DOG', sex: 'FEMALE', breed: 'Irish Wolfhound', generation: 1, sireRef: 'Fang', damRef: 'Fluffy Jr', birthYear: 2018, testProvider: 'Embark',
    notes: 'Daughter of Fang × Fluffy (Line A). DCM Clear.',
    coiTestScenario: 'Gen 1 Line A - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DCM', 'Dilated Cardiomyopathy', 'Clear'), healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear')]
    }
  },
  { name: 'Hippogriff Hound', species: 'DOG', sex: 'MALE', breed: 'Irish Wolfhound', generation: 1, sireRef: 'Aragog Hound', damRef: 'Thestral Dame', birthYear: 2018, testProvider: 'Embark',
    notes: 'Line B. DCM Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 Line B - COI ~0% - DCM carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'Ay'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DCM', 'Dilated Cardiomyopathy', 'N/m'), healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m')]
    }
  },
  { name: 'Phoenix Hound', species: 'DOG', sex: 'FEMALE', breed: 'Irish Wolfhound', generation: 1, sireRef: 'Aragog Hound', damRef: 'Thestral Dame', birthYear: 2018, testProvider: 'Embark',
    notes: 'Named for Fawkes. Line B. DCM Affected - DO NOT BREED!',
    coiTestScenario: 'Gen 1 Line B - got affected genotype from carrier × carrier',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'd', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DCM', 'Dilated Cardiomyopathy', 'm/m'), healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear')]
    }
  },

  // === Generation 2 - CROSS BETWEEN LINES ===
  { name: 'Centaur Cross Hound', species: 'DOG', sex: 'MALE', breed: 'Irish Wolfhound', generation: 2, sireRef: 'Norbert Hound', damRef: 'Phoenix Hound', birthYear: 2020, testProvider: 'Embark',
    notes: 'Line A sire × Line B dam. WARNING: Sire At Risk, Dam Affected!',
    coiTestScenario: 'Gen 2 outcross - risky health cross',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DCM', 'Dilated Cardiomyopathy', 'At Risk'), healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear')]
    }
  },
  { name: 'Unicorn Cross Dame', species: 'DOG', sex: 'FEMALE', breed: 'Irish Wolfhound', generation: 2, sireRef: 'Hippogriff Hound', damRef: 'Buckbeak Hound', birthYear: 2020, testProvider: 'Embark',
    notes: 'Line B sire × Line A dam. DCM Carrier.',
    coiTestScenario: 'Gen 2 outcross - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DCM', 'Dilated Cardiomyopathy', 'N/m'), healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m')]
    }
  },

  // === Generation 3 - COUSIN MATING (shared grandparents) ===
  { name: 'Hogwarts High COI Pup', species: 'DOG', sex: 'MALE', breed: 'Irish Wolfhound', generation: 3, sireRef: 'Centaur Cross Hound', damRef: 'Unicorn Cross Dame', birthYear: 2022, testProvider: 'Embark',
    notes: 'Parents share common ancestors. MODERATE COI ~6.25%. DCM carrier warning.',
    coiTestScenario: 'Gen 3 cousin mating - COI ~6.25% (MODERATE)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DCM', 'Dilated Cardiomyopathy', 'At Risk'), healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m')]
    }
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// WINTERFELL ANIMALS (Dogs, Horses)
// Two founder lines for COI testing + PRA carrier warnings for dogs
// HYPP testing for horses
// ═══════════════════════════════════════════════════════════════════════════════

export const WINTERFELL_ANIMALS: AnimalDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════════
  // DOGS - Alaskan Malamute (Direwolves)
  // Two founder lines: Grey Wind/Lady (Line A) + Summer/Nymeria (Line B)
  // PRA (Progressive Retinal Atrophy) carrier warnings
  // ═══════════════════════════════════════════════════════════════════════════════

  // === GREY WIND LINE (Line A) - Generation 0 Founders ===
  { name: 'Grey Wind', species: 'DOG', sex: 'MALE', breed: 'Alaskan Malamute', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: "Robb Stark's direwolf. Founder sire Line A. PRA Clear, Poly Clear.",
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Aw', 'Aw'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear'), healthLocus('POLY', 'Polyneuropathy', 'Clear')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2016-06-15', eventName: 'Winterfell Kennel Show', eventLocation: 'Winterfell', pointsEarned: 15, majorWins: 2 },
      { titleAbbreviation: 'GCH', dateEarned: '2017-09-20', eventName: 'Northern Territories Championship', eventLocation: 'The Wall', pointsEarned: 25 },
    ],
    competitions: [
      { eventName: 'Winterfell Kennel Show', eventDate: '2016-06-15', location: 'Winterfell', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Open Dogs', placement: 1, placementLabel: 'Best of Breed', pointsEarned: 5, isMajorWin: true, judgeName: 'Ned Stark' },
    ]
  },
  { name: 'Lady', species: 'DOG', sex: 'FEMALE', breed: 'Alaskan Malamute', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: "Sansa Stark's direwolf. Founder dam Line A. PRA Clear, Poly Carrier - WARNING!",
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Aw', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear'), healthLocus('POLY', 'Polyneuropathy', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2016-07-10', eventName: 'Kings Landing Show', eventLocation: 'Kings Landing', pointsEarned: 15, majorWins: 2 },
    ]
  },

  // === SUMMER LINE (Line B) - Generation 0 Founders (unrelated) ===
  { name: 'Summer', species: 'DOG', sex: 'MALE', breed: 'Alaskan Malamute', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: "Bran Stark's direwolf. Founder sire Line B. PRA Carrier, Poly Carrier - DOUBLE WARNING!",
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('POLY', 'Polyneuropathy', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2016-08-20', eventName: 'Beyond the Wall Trial', eventLocation: 'Castle Black', pointsEarned: 15, majorWins: 2 },
    ]
  },
  { name: 'Nymeria', species: 'DOG', sex: 'FEMALE', breed: 'Alaskan Malamute', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: "Arya Stark's direwolf, leads a wolf pack. Founder dam Line B. PRA Carrier.",
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Aw', 'Aw'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('POLY', 'Polyneuropathy', 'Clear')]
    }
  },

  // === Generation 1 - Children of Founders ===
  { name: 'Ghost', species: 'DOG', sex: 'MALE', breed: 'Alaskan Malamute', generation: 1, sireRef: 'Grey Wind', damRef: 'Lady', birthYear: 2017, testProvider: 'Embark',
    notes: "Jon Snow's albino direwolf. Line A. Poly Carrier inherited from dam.",
    coiTestScenario: 'Gen 1 Line A - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Aw', 'Aw'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky'), locus('S', 'White Spotting', 'sw', 'sw')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear'), healthLocus('POLY', 'Polyneuropathy', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2019-05-15', eventName: 'Night Watch Championship', eventLocation: 'Castle Black', pointsEarned: 15, majorWins: 2 },
      { titleAbbreviation: 'GCH', dateEarned: '2020-03-10', eventName: 'Northern Alliance Show', eventLocation: 'Winterfell', pointsEarned: 25 },
    ]
  },
  { name: 'Stark Pup Lady II', species: 'DOG', sex: 'FEMALE', breed: 'Alaskan Malamute', generation: 1, sireRef: 'Grey Wind', damRef: 'Lady', birthYear: 2017, testProvider: 'Embark',
    notes: 'Daughter of Grey Wind × Lady (Line A). Poly Clear.',
    coiTestScenario: 'Gen 1 Line A - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Aw', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear'), healthLocus('POLY', 'Polyneuropathy', 'Clear')]
    }
  },
  { name: 'Shaggydog', species: 'DOG', sex: 'MALE', breed: 'Alaskan Malamute', generation: 1, sireRef: 'Summer', damRef: 'Nymeria', birthYear: 2017, testProvider: 'Embark',
    notes: "Rickon Stark's wild direwolf. Line B. PRA Carrier × Carrier = 25% affected risk!",
    coiTestScenario: 'Gen 1 Line B - COI ~0% - PRA carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'KB', 'ky')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('POLY', 'Polyneuropathy', 'N/m')]
    }
  },
  { name: 'Wolf Pack Female', species: 'DOG', sex: 'FEMALE', breed: 'Alaskan Malamute', generation: 1, sireRef: 'Summer', damRef: 'Nymeria', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line B. PRA Affected from carrier × carrier - DO NOT BREED!',
    coiTestScenario: 'Gen 1 Line B - got affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Aw', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'm/m'), healthLocus('POLY', 'Polyneuropathy', 'Clear')]
    }
  },

  // === Generation 2 - CROSS BETWEEN LINES ===
  { name: 'Winter Pup Alpha', species: 'DOG', sex: 'MALE', breed: 'Alaskan Malamute', generation: 2, sireRef: 'Ghost', damRef: 'Nymeria', birthYear: 2020, testProvider: 'Embark',
    notes: 'Line A sire × Line B dam. PRA Carrier from dam.',
    coiTestScenario: 'Gen 2 outcross - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Aw', 'Aw'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('POLY', 'Polyneuropathy', 'N/m')]
    }
  },
  { name: 'Winter Pup Beta', species: 'DOG', sex: 'FEMALE', breed: 'Alaskan Malamute', generation: 2, sireRef: 'Shaggydog', damRef: 'Stark Pup Lady II', birthYear: 2020, testProvider: 'Embark',
    notes: 'Line B sire × Line A dam. PRA Carrier.',
    coiTestScenario: 'Gen 2 outcross - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Aw', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('POLY', 'Polyneuropathy', 'N/m')]
    }
  },

  // === Generation 3 - COUSIN MATING ===
  { name: 'Direwolf High COI Male', species: 'DOG', sex: 'MALE', breed: 'Alaskan Malamute', generation: 3, sireRef: 'Winter Pup Alpha', damRef: 'Winter Pup Beta', birthYear: 2022, testProvider: 'Embark',
    notes: 'Parents share common ancestors. MODERATE COI ~6.25%. PRA Carrier × Carrier!',
    coiTestScenario: 'Gen 3 cousin mating - COI ~6.25% (MODERATE)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Aw', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('POLY', 'Polyneuropathy', 'N/m')]
    }
  },
  { name: 'Direwolf High COI Female', species: 'DOG', sex: 'FEMALE', breed: 'Alaskan Malamute', generation: 3, sireRef: 'Winter Pup Alpha', damRef: 'Winter Pup Beta', birthYear: 2022, testProvider: 'Embark',
    notes: 'Full sister. MODERATE COI. PRA Clear.',
    coiTestScenario: 'Gen 3 cousin mating - COI ~6.25%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Aw', 'Aw'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear'), healthLocus('POLY', 'Polyneuropathy', 'Clear')]
    }
  },

  // === Generation 4 - FULL SIBLING MATING (HIGH COI) ===
  { name: 'Critical COI Direwolf', species: 'DOG', sex: 'MALE', breed: 'Alaskan Malamute', generation: 4, sireRef: 'Direwolf High COI Male', damRef: 'Direwolf High COI Female', birthYear: 2024, testProvider: 'Embark',
    notes: 'FULL SIBLING PARENTS! HIGH COI ~25%. Inbreeding test case.',
    coiTestScenario: 'Gen 4 full sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Aw', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('POLY', 'Polyneuropathy', 'N/m')]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // HORSES - Friesian (Northern Warhorses)
  // HYPP (Hyperkalemic Periodic Paralysis) testing
  // ═══════════════════════════════════════════════════════════════════════════════

  // === Generation 0 Founders ===
  { name: 'Stranger', species: 'HORSE', sex: 'MALE', breed: 'Friesian', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
    notes: "The Hound's vicious warhorse. Founder sire. HYPP Carrier - WARNING!",
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'a', 'a')],
      health: [healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'H/N')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2015-07-20', eventName: 'Westerlands Championship', eventLocation: 'Casterly Rock', pointsEarned: 100 },
    ]
  },
  { name: 'Northern Destrier', species: 'HORSE', sex: 'FEMALE', breed: 'Friesian', generation: 0, birthYear: 2013, testProvider: 'UC Davis VGL',
    notes: 'Founder dam. HYPP Carrier - DO NOT BREED TO STRANGER (lethal homozygous risk)!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'a', 'a')],
      health: [healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'H/N')]
    }
  },
  { name: 'Robb Steed', species: 'HORSE', sex: 'MALE', breed: 'Friesian', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
    notes: 'Founder sire Line B. HYPP Clear - safe breeding.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'a', 'a')],
      health: [healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'N/N')]
    }
  },
  { name: 'Winterfell Mare', species: 'HORSE', sex: 'FEMALE', breed: 'Friesian', generation: 0, birthYear: 2013, testProvider: 'UC Davis VGL',
    notes: 'Founder dam Line B. HYPP Carrier.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'a', 'a')],
      health: [healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'H/N')]
    }
  },

  // === Generation 1 ===
  { name: 'Ice Storm', species: 'HORSE', sex: 'MALE', breed: 'Friesian', generation: 1, sireRef: 'Stranger', damRef: 'Northern Destrier', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'HYPP Carrier × Carrier offspring. Got affected genotype - DO NOT BREED!',
    coiTestScenario: 'Gen 1 - HYPP carrier × carrier warning (lethal homozygous)',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'a', 'a')],
      health: [healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'H/H')]
    }
  },
  { name: 'Night Mare', species: 'HORSE', sex: 'FEMALE', breed: 'Friesian', generation: 1, sireRef: 'Stranger', damRef: 'Northern Destrier', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'HYPP Carrier × Carrier. Got Carrier status.',
    coiTestScenario: 'Gen 1 - HYPP carrier warning',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'a', 'a')],
      health: [healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'H/N')]
    }
  },
  { name: 'Stark Warhorse', species: 'HORSE', sex: 'MALE', breed: 'Friesian', generation: 1, sireRef: 'Robb Steed', damRef: 'Winterfell Mare', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'Line B. HYPP Carrier from dam.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'a', 'a')],
      health: [healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'H/N')]
    }
  },
  { name: 'Northern Filly', species: 'HORSE', sex: 'FEMALE', breed: 'Friesian', generation: 1, sireRef: 'Robb Steed', damRef: 'Winterfell Mare', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'Line B. HYPP Clear.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'a', 'a')],
      health: [healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'N/N')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2019-09-15', eventName: 'North Regional', eventLocation: 'Winterfell' },
    ]
  },

  // === Generation 2 - CROSS ===
  { name: 'Wall Warhorse', species: 'HORSE', sex: 'MALE', breed: 'Friesian', generation: 2, sireRef: 'Stark Warhorse', damRef: 'Night Mare', birthYear: 2019, testProvider: 'UC Davis VGL',
    notes: 'Cross between lines. HYPP Carrier × Carrier.',
    coiTestScenario: 'Gen 2 outcross - HYPP carrier warning',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'a', 'a')],
      health: [healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'H/N')]
    }
  },
  { name: 'Night Watch Filly (HYPP Carrier Mare)', species: 'HORSE', sex: 'FEMALE', breed: 'Friesian', generation: 2, sireRef: 'Stark Warhorse', damRef: 'Northern Filly', birthYear: 2019, testProvider: 'UC Davis VGL',
    notes: 'Line B cross. HYPP Carrier.',
    coiTestScenario: 'Gen 2 - COI ~25% (sibling cross)',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'a', 'a')],
      health: [healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'H/N')]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // APPALOOSA - LP/LP Vision Issues Warning (Double LP Night Blindness)
  // Testing LP/lp × LP/lp = 25% LP/LP (congenital stationary night blindness)
  // ═══════════════════════════════════════════════════════════════════════════════
  { name: 'Winter Spots (LP Carrier Mare)', species: 'HORSE', sex: 'FEMALE', breed: 'Appaloosa', generation: 0, birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'North of the Wall mare with snow leopard spots. LP carrier (LP/lp). WARNING: LP/lp × LP/lp = vision issues!',
    coiTestScenario: 'Founder - LP carrier for dangerous pairing test',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('LP', 'Leopard Complex', 'LP', 'lp'), locus('PATN1', 'Pattern 1', 'PATN1', 'N')],
      health: [healthLocus('CSNB', 'Congenital Stationary Night Blindness', 'At Risk')]
    }
  },
  { name: 'Direwolf Stallion (LP Carrier Stallion)', species: 'HORSE', sex: 'MALE', breed: 'Appaloosa', generation: 0, birthYear: 2017, testProvider: 'UC Davis VGL',
    notes: 'Grey spotted stallion. LP carrier. Pair with Winter Spots for DOUBLE LP WARNING!',
    coiTestScenario: 'Founder - LP carrier for dangerous pairing test',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'a', 'a'), locus('LP', 'Leopard Complex', 'LP', 'lp'), locus('PATN1', 'Pattern 1', 'N', 'N')],
      health: [healthLocus('CSNB', 'Congenital Stationary Night Blindness', 'At Risk')]
    }
  },
  { name: 'Wildling Mare (LP Clear Mare)', species: 'HORSE', sex: 'FEMALE', breed: 'Appaloosa', generation: 0, birthYear: 2019, testProvider: 'UC Davis VGL',
    notes: 'Non-LP mare (lp/lp). Safe to breed with any LP stallion.',
    coiTestScenario: 'Founder - Non-LP for safe pairing comparison',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'A'), locus('LP', 'Leopard Complex', 'lp', 'lp'), locus('PATN1', 'Pattern 1', 'PATN1', 'PATN1')],
      health: [healthLocus('CSNB', 'Congenital Stationary Night Blindness', 'N/N')]
    }
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MARVEL ANIMALS (Cats, Goats, Horses, Dogs)
// Two founder lines for COI testing + species-specific health warnings
// MVD for dogs, HCM for cats, G6S for goats, GBED for horses
// ═══════════════════════════════════════════════════════════════════════════════

export const MARVEL_ANIMALS: AnimalDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════════
  // CATS - Ragdoll (Avengers Pets)
  // HCM (Ragdoll variant) carrier testing
  // ═══════════════════════════════════════════════════════════════════════════════

  // === GOOSE LINE (Line A) ===
  { name: 'Goose the Flerken', species: 'CAT', sex: 'MALE', breed: 'Ragdoll', generation: 0, birthYear: 2014, testProvider: 'UC Davis VGL',
    notes: 'Captain Marvel\'s "cat" - actually an alien Flerken. Founder sire Line A. HCM Carrier!',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Colorpoint', 'cs', 'cs'), locus('D', 'Dilute', 'D', 'D')],
      health: [healthLocus('HCM_RD', 'HCM (Ragdoll)', 'N/m'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2016-03-15', eventName: 'SHIELD Cat Show', eventLocation: 'New York', pointsEarned: 200 },
      { titleAbbreviation: 'GC', dateEarned: '2017-06-20', eventName: 'Avengers Compound Championship', eventLocation: 'Upstate NY', pointsEarned: 500 },
    ],
    competitions: [
      { eventName: 'SHIELD Cat Show', eventDate: '2016-03-15', location: 'New York', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Open', placement: 1, placementLabel: 'Best in Show', pointsEarned: 200, isMajorWin: true, judgeName: 'Nick Fury' },
    ]
  },
  { name: 'Captain Whiskers', species: 'CAT', sex: 'FEMALE', breed: 'Ragdoll', generation: 0, birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'Founder dam Line A. HCM Clear.',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Colorpoint', 'cs', 'cs'), locus('D', 'Dilute', 'D', 'd')],
      health: [healthLocus('HCM_RD', 'HCM (Ragdoll)', 'N/N'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    }
  },

  // === WAKANDA LINE (Line B) ===
  { name: 'Wakandan Temple Cat', species: 'CAT', sex: 'FEMALE', breed: 'Ragdoll', generation: 0, birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'Founder dam Line B. HCM Carrier - WARNING!',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Colorpoint', 'cs', 'cs'), locus('D', 'Dilute', 'D', 'd')],
      health: [healthLocus('HCM_RD', 'HCM (Ragdoll)', 'N/m'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2017-09-10', eventName: 'Wakanda Royal Show', eventLocation: 'Wakanda', pointsEarned: 200 },
    ]
  },
  { name: 'Black Panther Tom', species: 'CAT', sex: 'MALE', breed: 'Ragdoll', generation: 0, birthYear: 2014, testProvider: 'UC Davis VGL',
    notes: 'Founder sire Line B. HCM Carrier - DO NOT BREED TO WAKANDAN TEMPLE CAT!',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Colorpoint', 'C', 'cs'), locus('D', 'Dilute', 'D', 'D')],
      health: [healthLocus('HCM_RD', 'HCM (Ragdoll)', 'N/m'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    }
  },

  // === Generation 1 ===
  { name: 'Vibranium Kitten', species: 'CAT', sex: 'MALE', breed: 'Ragdoll', generation: 1, sireRef: 'Goose the Flerken', damRef: 'Captain Whiskers', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'Line A. HCM Carrier from sire.',
    coiTestScenario: 'Gen 1 Line A - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Colorpoint', 'cs', 'cs'), locus('D', 'Dilute', 'D', 'd')],
      health: [healthLocus('HCM_RD', 'HCM (Ragdoll)', 'N/m'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    }
  },
  { name: 'Shield Cat', species: 'CAT', sex: 'FEMALE', breed: 'Ragdoll', generation: 1, sireRef: 'Goose the Flerken', damRef: 'Captain Whiskers', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'Line A. HCM Clear.',
    coiTestScenario: 'Gen 1 Line A - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Colorpoint', 'cs', 'cs'), locus('D', 'Dilute', 'D', 'D')],
      health: [healthLocus('HCM_RD', 'HCM (Ragdoll)', 'N/N'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    }
  },
  { name: 'Shuri Kitten', species: 'CAT', sex: 'MALE', breed: 'Ragdoll', generation: 1, sireRef: 'Black Panther Tom', damRef: 'Wakandan Temple Cat', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'Line B. HCM Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 Line B - HCM carrier × carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Colorpoint', 'C', 'cs'), locus('D', 'Dilute', 'D', 'd')],
      health: [healthLocus('HCM_RD', 'HCM (Ragdoll)', 'N/m'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    }
  },
  { name: 'Okoye Queen', species: 'CAT', sex: 'FEMALE', breed: 'Ragdoll', generation: 1, sireRef: 'Black Panther Tom', damRef: 'Wakandan Temple Cat', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'Line B. HCM Affected from carrier × carrier - DO NOT BREED!',
    coiTestScenario: 'Gen 1 Line B - got affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Colorpoint', 'cs', 'cs'), locus('D', 'Dilute', 'D', 'D')],
      health: [healthLocus('HCM_RD', 'HCM (Ragdoll)', 'm/m'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    }
  },

  // === Generation 2 - CROSS BETWEEN LINES ===
  { name: 'Avenger Cross Cat', species: 'CAT', sex: 'MALE', breed: 'Ragdoll', generation: 2, sireRef: 'Vibranium Kitten', damRef: 'Shield Cat', birthYear: 2020, testProvider: 'UC Davis VGL',
    notes: 'Line A × Line A. HCM Carrier.',
    coiTestScenario: 'Gen 2 - COI ~25% (sibling mating)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Colorpoint', 'cs', 'cs'), locus('D', 'Dilute', 'D', 'd')],
      health: [healthLocus('HCM_RD', 'HCM (Ragdoll)', 'N/m'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    }
  },
  { name: 'Thanos Snap Cat', species: 'CAT', sex: 'FEMALE', breed: 'Ragdoll', generation: 2, sireRef: 'Shuri Kitten', damRef: 'Shield Cat', birthYear: 2020, testProvider: 'UC Davis VGL',
    notes: 'Line B sire × Line A dam outcross. HCM Carrier.',
    coiTestScenario: 'Gen 2 outcross - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Colorpoint', 'cs', 'cs'), locus('D', 'Dilute', 'D', 'D')],
      health: [healthLocus('HCM_RD', 'HCM (Ragdoll)', 'N/m'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    }
  },

  // === Generation 3 - COUSIN MATING ===
  { name: 'High COI Marvel Cat', species: 'CAT', sex: 'MALE', breed: 'Ragdoll', generation: 3, sireRef: 'Avenger Cross Cat', damRef: 'Thanos Snap Cat', birthYear: 2022, testProvider: 'UC Davis VGL',
    notes: 'Parents share common ancestors. MODERATE COI. HCM Carrier × Carrier.',
    coiTestScenario: 'Gen 3 cousin mating - COI ~6.25% (MODERATE)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Colorpoint', 'cs', 'cs'), locus('D', 'Dilute', 'D', 'd')],
      health: [healthLocus('HCM_RD', 'HCM (Ragdoll)', 'N/m'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // GOATS - Nigerian Dwarf (Avengers Farm Goats)
  // G6S carrier testing + Polled × Polled warnings
  // ═══════════════════════════════════════════════════════════════════════════════

  // === Generation 0 Founders ===
  { name: 'Thanos Bane', species: 'GOAT', sex: 'MALE', breed: 'Nigerian Dwarf', generation: 0, birthYear: 2016,
    notes: 'Named for surviving the snap. Founder sire Line A. G6S Carrier, Polled Carrier - WARNING!',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Ab'), locus('B', 'Brown', 'B', 'B')],
      physicalTraits: [locus('P', 'Polled', 'P', 'p')],
      health: [healthLocus('G6S', 'G6S', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'GCH', dateEarned: '2018-07-20', eventName: 'Avengers Compound Show', eventLocation: 'Upstate NY', pointsEarned: 10 },
    ]
  },
  { name: 'Infinity Nanny', species: 'GOAT', sex: 'FEMALE', breed: 'Nigerian Dwarf', generation: 0, birthYear: 2016,
    notes: 'Founder dam Line A. G6S Carrier - DO NOT BREED TO THANOS BANE!',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Awt', 'Ab')],
      physicalTraits: [locus('P', 'Polled', 'p', 'p')],
      health: [healthLocus('G6S', 'G6S', 'N/m')]
    }
  },
  { name: 'Stark Buck', species: 'GOAT', sex: 'MALE', breed: 'Nigerian Dwarf', generation: 0, birthYear: 2016,
    notes: 'Founder sire Line B. G6S Clear, Polled homozygous - WARNING for intersex risk!',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Awt')],
      physicalTraits: [locus('P', 'Polled', 'P', 'P')],
      health: [healthLocus('G6S', 'G6S', 'N/N')]
    }
  },
  { name: 'Pepper Doe', species: 'GOAT', sex: 'FEMALE', breed: 'Nigerian Dwarf', generation: 0, birthYear: 2017,
    notes: 'Founder dam Line B. G6S Clear, Polled heterozygous.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Ab')],
      physicalTraits: [locus('P', 'Polled', 'P', 'p')],
      health: [healthLocus('G6S', 'G6S', 'N/N')]
    }
  },

  // === Generation 1 ===
  { name: 'Soul Stone Kid', species: 'GOAT', sex: 'MALE', breed: 'Nigerian Dwarf', generation: 1, sireRef: 'Thanos Bane', damRef: 'Infinity Nanny', birthYear: 2019,
    notes: 'Line A. G6S Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 Line A - G6S carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Awt')],
      physicalTraits: [locus('P', 'Polled', 'P', 'p')],
      health: [healthLocus('G6S', 'G6S', 'N/m')]
    }
  },
  { name: 'Reality Doeling', species: 'GOAT', sex: 'FEMALE', breed: 'Nigerian Dwarf', generation: 1, sireRef: 'Thanos Bane', damRef: 'Infinity Nanny', birthYear: 2019,
    notes: 'Line A. G6S Affected - DO NOT BREED!',
    coiTestScenario: 'Gen 1 Line A - got affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Ab')],
      physicalTraits: [locus('P', 'Polled', 'p', 'p')],
      health: [healthLocus('G6S', 'G6S', 'm/m')]
    }
  },
  { name: 'Iron Kid', species: 'GOAT', sex: 'MALE', breed: 'Nigerian Dwarf', generation: 1, sireRef: 'Stark Buck', damRef: 'Pepper Doe', birthYear: 2019,
    notes: 'Line B. Polled × Polled = intersex risk for does!',
    coiTestScenario: 'Gen 1 Line B - Polled warning',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Ab')],
      physicalTraits: [locus('P', 'Polled', 'P', 'P')],
      health: [healthLocus('G6S', 'G6S', 'N/N')]
    }
  },
  { name: 'Morgan Doeling', species: 'GOAT', sex: 'FEMALE', breed: 'Nigerian Dwarf', generation: 1, sireRef: 'Stark Buck', damRef: 'Pepper Doe', birthYear: 2019,
    notes: 'Line B. Polled heterozygous.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Awt', 'Ab')],
      physicalTraits: [locus('P', 'Polled', 'P', 'p')],
      health: [healthLocus('G6S', 'G6S', 'N/N')]
    }
  },

  // === Generation 2 - CROSS ===
  { name: 'Endgame Buck', species: 'GOAT', sex: 'MALE', breed: 'Nigerian Dwarf', generation: 2, sireRef: 'Soul Stone Kid', damRef: 'Morgan Doeling', birthYear: 2021,
    notes: 'Line A sire × Line B dam. G6S Carrier, Polled × Polled risk.',
    coiTestScenario: 'Gen 2 outcross - COI ~0% - mixed warnings',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Ab')],
      physicalTraits: [locus('P', 'Polled', 'P', 'p')],
      health: [healthLocus('G6S', 'G6S', 'N/m')]
    }
  },
  { name: 'Multiverse Doeling', species: 'GOAT', sex: 'FEMALE', breed: 'Nigerian Dwarf', generation: 2, sireRef: 'Iron Kid', damRef: 'Morgan Doeling', birthYear: 2021,
    notes: 'Line B × Line B sibling cross. HIGH COI ~25%. Polled homozygous.',
    coiTestScenario: 'Gen 2 sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Awt')],
      physicalTraits: [locus('P', 'Polled', 'P', 'P')],
      health: [healthLocus('G6S', 'G6S', 'N/N')]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // HORSES - Lipizzan (Asgardian Steeds)
  // GBED (Glycogen Branching Enzyme Deficiency) carrier testing
  // ═══════════════════════════════════════════════════════════════════════════════

  // === Generation 0 Founders ===
  { name: 'Sleipnir', species: 'HORSE', sex: 'MALE', breed: 'Lipizzan', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
    notes: 'Odin\'s eight-legged horse from Asgard. Founder sire. GBED Carrier - WARNING!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'G', 'g')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2015-05-15', eventName: 'Asgard Royal Championship', eventLocation: 'Asgard', pointsEarned: 100 },
    ]
  },
  { name: 'Valkyrie Mare', species: 'HORSE', sex: 'FEMALE', breed: 'Lipizzan', generation: 0, birthYear: 2013, testProvider: 'UC Davis VGL',
    notes: 'Steed of a Valkyrie warrior. Founder dam Line A. GBED Carrier - DO NOT BREED TO SLEIPNIR!',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'g')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/m')]
    }
  },
  { name: 'Thunder Stallion', species: 'HORSE', sex: 'MALE', breed: 'Lipizzan', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
    notes: 'Founder sire Line B. GBED Clear.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'G')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/N')]
    }
  },
  { name: 'Hela Mare', species: 'HORSE', sex: 'FEMALE', breed: 'Lipizzan', generation: 0, birthYear: 2013, testProvider: 'UC Davis VGL',
    notes: 'Founder dam Line B. GBED Carrier.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'g', 'g')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/m')]
    }
  },

  // === Generation 1 ===
  { name: 'Bifrost Runner', species: 'HORSE', sex: 'MALE', breed: 'Lipizzan', generation: 1, sireRef: 'Sleipnir', damRef: 'Valkyrie Mare', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'Named for the rainbow bridge. GBED Carrier × Carrier = 25% lethal!',
    coiTestScenario: 'Gen 1 - GBED carrier × carrier (lethal homozygous)',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'G', 'g')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/m')]
    }
  },
  { name: 'Mjolnir Mare', species: 'HORSE', sex: 'FEMALE', breed: 'Lipizzan', generation: 1, sireRef: 'Sleipnir', damRef: 'Valkyrie Mare', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'GBED Clear from carrier × carrier.',
    coiTestScenario: 'Gen 1 - got clear genotype',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'G')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/N')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2019-06-20', eventName: 'New Asgard Show', eventLocation: 'Norway' },
    ]
  },
  { name: 'Stormbreaker Colt', species: 'HORSE', sex: 'MALE', breed: 'Lipizzan', generation: 1, sireRef: 'Thunder Stallion', damRef: 'Hela Mare', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'Line B. GBED Carrier from dam.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'G', 'g')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/m')]
    }
  },
  { name: 'Ragnarok Filly', species: 'HORSE', sex: 'FEMALE', breed: 'Lipizzan', generation: 1, sireRef: 'Thunder Stallion', damRef: 'Hela Mare', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'Line B. GBED Clear.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'g')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/N')]
    }
  },

  // === Generation 2 - CROSS ===
  { name: 'Infinity Stallion', species: 'HORSE', sex: 'MALE', breed: 'Lipizzan', generation: 2, sireRef: 'Bifrost Runner', damRef: 'Ragnarok Filly', birthYear: 2019, testProvider: 'UC Davis VGL',
    notes: 'Line A × Line B outcross. GBED Carrier.',
    coiTestScenario: 'Gen 2 outcross - COI ~0%',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'g')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/m')]
    }
  },
  { name: 'Endgame Filly', species: 'HORSE', sex: 'FEMALE', breed: 'Lipizzan', generation: 2, sireRef: 'Stormbreaker Colt', damRef: 'Mjolnir Mare', birthYear: 2019, testProvider: 'UC Davis VGL',
    notes: 'Line B × Line A outcross. GBED Carrier.',
    coiTestScenario: 'Gen 2 outcross - COI ~0%',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'G', 'G')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/m')]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // DOGS - Cavalier King Charles Spaniel (Avenger Companions)
  // MVD (Mitral Valve Disease) and EFS (Episodic Falling Syndrome) carrier testing
  // ═══════════════════════════════════════════════════════════════════════════════

  // === LUCKY LINE (Line A) ===
  { name: 'Lucky Pizza Dog', species: 'DOG', sex: 'MALE', breed: 'Cavalier King Charles Spaniel', generation: 0, birthYear: 2016, testProvider: 'Embark',
    notes: 'Hawkeye\'s loyal one-eyed dog. Founder sire Line A. MVD At Risk, EFS Carrier - WARNING!',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('E', 'Extension', 'E', 'e'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('MVD', 'Mitral Valve Disease', 'At Risk'), healthLocus('EFS', 'Episodic Falling Syndrome', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2018-04-15', eventName: 'Brooklyn Dog Show', eventLocation: 'Brooklyn', pointsEarned: 15, majorWins: 2 },
    ],
    competitions: [
      { eventName: 'Brooklyn Dog Show', eventDate: '2018-04-15', location: 'Brooklyn', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Open Dogs', placement: 1, placementLabel: 'Best of Breed', pointsEarned: 5, isMajorWin: true },
    ]
  },
  { name: 'Kate Bishop Dame', species: 'DOG', sex: 'FEMALE', breed: 'Cavalier King Charles Spaniel', generation: 0, birthYear: 2017, testProvider: 'Embark',
    notes: 'Founder dam Line A. MVD Clear, EFS Carrier.',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('E', 'Extension', 'E', 'E'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('MVD', 'Mitral Valve Disease', 'N/N'), healthLocus('EFS', 'Episodic Falling Syndrome', 'N/m')]
    }
  },

  // === COSMO LINE (Line B) ===
  { name: 'Cosmo Dame', species: 'DOG', sex: 'FEMALE', breed: 'Cavalier King Charles Spaniel', generation: 0, birthYear: 2016, testProvider: 'Embark',
    notes: 'Named after Cosmo the Spacedog. Founder dam Line B. MVD Clear, EFS Clear.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('E', 'Extension', 'E', 'E'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('MVD', 'Mitral Valve Disease', 'N/N'), healthLocus('EFS', 'Episodic Falling Syndrome', 'N/N')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2018-06-20', eventName: 'Guardians Galaxy Show', eventLocation: 'Knowhere', pointsEarned: 15, majorWins: 2 },
    ]
  },
  { name: 'Rocket Stud', species: 'DOG', sex: 'MALE', breed: 'Cavalier King Charles Spaniel', generation: 0, birthYear: 2016, testProvider: 'Embark',
    notes: 'Founder sire Line B. MVD At Risk, EFS Carrier.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'b'), locus('E', 'Extension', 'E', 'e'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('MVD', 'Mitral Valve Disease', 'At Risk'), healthLocus('EFS', 'Episodic Falling Syndrome', 'N/m')]
    }
  },

  // === Generation 1 ===
  { name: 'Rocket Pup', species: 'DOG', sex: 'MALE', breed: 'Cavalier King Charles Spaniel', generation: 1, sireRef: 'Lucky Pizza Dog', damRef: 'Kate Bishop Dame', birthYear: 2019, testProvider: 'Embark',
    notes: 'Line A. EFS Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 Line A - EFS carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('E', 'Extension', 'E', 'e'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('MVD', 'Mitral Valve Disease', 'At Risk'), healthLocus('EFS', 'Episodic Falling Syndrome', 'N/m')]
    }
  },
  { name: 'Groot Pup', species: 'DOG', sex: 'FEMALE', breed: 'Cavalier King Charles Spaniel', generation: 1, sireRef: 'Lucky Pizza Dog', damRef: 'Kate Bishop Dame', birthYear: 2019, testProvider: 'Embark',
    notes: 'Line A. EFS Affected from carrier × carrier - DO NOT BREED!',
    coiTestScenario: 'Gen 1 Line A - got affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('E', 'Extension', 'E', 'E'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('MVD', 'Mitral Valve Disease', 'N/N'), healthLocus('EFS', 'Episodic Falling Syndrome', 'm/m')]
    }
  },
  { name: 'Starlord Pup', species: 'DOG', sex: 'MALE', breed: 'Cavalier King Charles Spaniel', generation: 1, sireRef: 'Rocket Stud', damRef: 'Cosmo Dame', birthYear: 2019, testProvider: 'Embark',
    notes: 'Line B. EFS Carrier from sire.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('E', 'Extension', 'E', 'e'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('MVD', 'Mitral Valve Disease', 'At Risk'), healthLocus('EFS', 'Episodic Falling Syndrome', 'N/m')]
    }
  },
  { name: 'Gamora Pup', species: 'DOG', sex: 'FEMALE', breed: 'Cavalier King Charles Spaniel', generation: 1, sireRef: 'Rocket Stud', damRef: 'Cosmo Dame', birthYear: 2019, testProvider: 'Embark',
    notes: 'Line B. EFS Clear.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('E', 'Extension', 'E', 'E'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('MVD', 'Mitral Valve Disease', 'N/N'), healthLocus('EFS', 'Episodic Falling Syndrome', 'N/N')]
    }
  },

  // === Generation 2 - CROSS ===
  { name: 'Guardian Pup', species: 'DOG', sex: 'MALE', breed: 'Cavalier King Charles Spaniel', generation: 2, sireRef: 'Rocket Pup', damRef: 'Gamora Pup', birthYear: 2021, testProvider: 'Embark',
    notes: 'Line A sire × Line B dam outcross. EFS Carrier.',
    coiTestScenario: 'Gen 2 outcross - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('E', 'Extension', 'E', 'e'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('MVD', 'Mitral Valve Disease', 'At Risk'), healthLocus('EFS', 'Episodic Falling Syndrome', 'N/m')]
    }
  },
  { name: 'Avenger Dame', species: 'DOG', sex: 'FEMALE', breed: 'Cavalier King Charles Spaniel', generation: 2, sireRef: 'Starlord Pup', damRef: 'Gamora Pup', birthYear: 2021, testProvider: 'Embark',
    notes: 'Line B × Line B sibling cross. HIGH COI ~25%. EFS Carrier.',
    coiTestScenario: 'Gen 2 sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('E', 'Extension', 'E', 'E'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('MVD', 'Mitral Valve Disease', 'At Risk'), healthLocus('EFS', 'Episodic Falling Syndrome', 'N/m')]
    }
  },

  // === Generation 3 - COUSIN MATING ===
  { name: 'High COI Marvel Pup', species: 'DOG', sex: 'MALE', breed: 'Cavalier King Charles Spaniel', generation: 3, sireRef: 'Guardian Pup', damRef: 'Avenger Dame', birthYear: 2023, testProvider: 'Embark',
    notes: 'Parents share common ancestors. MODERATE COI. EFS Carrier × Carrier warning!',
    coiTestScenario: 'Gen 3 cousin mating - COI ~6.25% (MODERATE)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('E', 'Extension', 'E', 'e'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('MVD', 'Mitral Valve Disease', 'At Risk'), healthLocus('EFS', 'Episodic Falling Syndrome', 'N/m')]
    }
  },
];

// Map DEV tenant slugs to their animals
export const DEV_TENANT_ANIMALS: Record<string, AnimalDefinition[]> = {
  rivendell: RIVENDELL_ANIMALS,
  hogwarts: HOGWARTS_ANIMALS,
  winterfell: WINTERFELL_ANIMALS,
  'stark-tower': MARVEL_ANIMALS,
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROD ANIMAL DEFINITIONS (Dune, Star Trek, Ted Lasso, Matrix)
// All with enhanced COI testing, health carrier warnings, and titles
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// DUNE ANIMALS (Dogs, Horses, Cats) - House Atreides
// DM carrier testing for dogs, SCID for horses, PK Deficiency for cats
// ═══════════════════════════════════════════════════════════════════════════════
export const ARRAKIS_ANIMALS: AnimalDefinition[] = [
  // === DOGS - Saluki (Desert Hounds) ===
  // Two founder lines for COI + DM carrier warnings

  // MUAD'DIB LINE (Line A)
  { name: 'Muad\'Dib Hunter (DM Carrier Founder Male)', species: 'DOG', sex: 'MALE', breed: 'Saluki', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: 'Named for the desert mouse. Founder sire Line A. DM Carrier - WARNING!',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'E', 'e')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'Clear')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2016-05-15', eventName: 'Arrakis Desert Classic', eventLocation: 'Arrakeen', pointsEarned: 15, majorWins: 2 },
      { titleAbbreviation: 'GCH', dateEarned: '2017-09-20', eventName: 'Atreides National', eventLocation: 'Caladan', pointsEarned: 25 },
      { titleAbbreviation: 'GCHB', dateEarned: '2019-03-10', eventName: 'Fremen Open', eventLocation: 'Sietch Tabr', pointsEarned: 100 },
      { titleAbbreviation: 'CD', dateEarned: '2016-09-05', eventName: 'Caladan Obedience Club', eventLocation: 'Caladan' },
      { titleAbbreviation: 'RN', dateEarned: '2017-02-18', eventName: 'Arrakis Rally Trial', eventLocation: 'Arrakeen' },
    ],
    competitions: [
      // 2015 - First shows as puppy
      { eventName: 'Arrakis Puppy Match', eventDate: '2015-06-20', location: 'Arrakeen', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Puppy 6-9 Months', placement: 1, placementLabel: 'Best Puppy', judgeName: 'Mr. Stilgar Naib' },
      { eventName: 'Desert Sighthound Specialty', eventDate: '2015-09-12', location: 'Sietch Tabr', organization: 'AKC', competitionType: 'BREED_SPECIALTY', className: 'Puppy 9-12 Months', placement: 2, judgeName: 'Mrs. Chani Kynes' },
      // 2016 - Championship year
      { eventName: 'Caladan Winter Classic', eventDate: '2016-01-15', location: 'Caladan', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Open Dogs', placement: 1, placementLabel: 'Winners Dog', pointsEarned: 2, isMajorWin: false, judgeName: 'Dr. Yueh Suk' },
      { eventName: 'Fremen Desert Show', eventDate: '2016-02-20', location: 'Sietch Tabr', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Open Dogs', placement: 1, placementLabel: 'Winners Dog', pointsEarned: 3, isMajorWin: true, judgeName: 'Mr. Duncan Idaho' },
      { eventName: 'Arrakis Desert Classic', eventDate: '2016-05-14', location: 'Arrakeen', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Open Dogs', placement: 1, placementLabel: 'Winners Dog', pointsEarned: 4, isMajorWin: true, judgeName: 'Mrs. Jessica Atreides' },
      { eventName: 'Arrakis Desert Classic', eventDate: '2016-05-15', location: 'Arrakeen', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Best of Breed', placement: 1, placementLabel: 'Best of Breed', pointsEarned: 5, isMajorWin: true, judgeName: 'Dr. Liet Kynes' },
      { eventName: 'Caladan Obedience Club', eventDate: '2016-09-05', location: 'Caladan', organization: 'AKC', competitionType: 'OBEDIENCE_TRIAL', className: 'Novice B', placement: 2, pointsEarned: 195, judgeName: 'Mrs. Margot Fenring' },
      // 2017 - GCH and performance titles
      { eventName: 'Atreides National', eventDate: '2017-09-20', location: 'Caladan', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Best of Breed', placement: 1, placementLabel: 'Best of Breed', pointsEarned: 5, isMajorWin: true, judgeName: 'Mr. Gurney Halleck' },
      { eventName: 'Arrakis Rally Trial', eventDate: '2017-02-18', location: 'Arrakeen', organization: 'AKC', competitionType: 'RALLY_TRIAL', className: 'Rally Novice', placement: 1, pointsEarned: 98, judgeName: 'Mrs. Harah' },
      // 2018-2019 - GCHB points accumulation
      { eventName: 'Spice Harvest Show', eventDate: '2018-04-10', location: 'Arrakeen', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Best of Breed', placement: 1, placementLabel: 'Best of Breed', pointsEarned: 3, judgeName: 'Dr. Wellington Yueh' },
      { eventName: 'Sietch Tabr Classic', eventDate: '2018-08-15', location: 'Sietch Tabr', organization: 'AKC', competitionType: 'BREED_SPECIALTY', className: 'Best of Breed', placement: 1, placementLabel: 'Best of Breed', pointsEarned: 5, isMajorWin: true, judgeName: 'Mr. Jamis' },
      { eventName: 'Fremen Open', eventDate: '2019-03-10', location: 'Sietch Tabr', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Best of Breed', placement: 1, placementLabel: 'Best of Breed', pointsEarned: 4, isMajorWin: true, judgeName: 'Mrs. Ramallo' },
    ]
  },
  { name: 'Shai-Hulud Dame (DM Carrier Founder Female)', species: 'DOG', sex: 'FEMALE', breed: 'Saluki', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'Named for the great sandworms. Founder dam Line A. DM Carrier - DO NOT BREED TO MUAD\'DIB!',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'E', 'E')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'Clear')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2017-06-20', eventName: 'Caladan Summer Show', eventLocation: 'Caladan', pointsEarned: 15, majorWins: 2 },
    ],
    competitions: [
      { eventName: 'Arrakis Puppy Match', eventDate: '2016-01-15', location: 'Arrakeen', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Puppy 6-9 Months', placement: 1, placementLabel: 'Best Puppy', judgeName: 'Mr. Stilgar Naib' },
      { eventName: 'Caladan Kennel Club', eventDate: '2016-09-10', location: 'Caladan', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Open Bitches', placement: 1, placementLabel: 'Winners Bitch', pointsEarned: 2, judgeName: 'Mrs. Jessica Atreides' },
      { eventName: 'Fremen Desert Show', eventDate: '2017-02-20', location: 'Sietch Tabr', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Open Bitches', placement: 1, placementLabel: 'Winners Bitch', pointsEarned: 4, isMajorWin: true, judgeName: 'Mr. Duncan Idaho' },
      { eventName: 'Caladan Summer Show', eventDate: '2017-06-20', location: 'Caladan', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Open Bitches', placement: 1, placementLabel: 'Winners Bitch', pointsEarned: 5, isMajorWin: true, judgeName: 'Dr. Liet Kynes' },
    ]
  },

  // FREMEN LINE (Line B)
  { name: 'Stilgar Hound (Clear Founder Male)', species: 'DOG', sex: 'MALE', breed: 'Saluki', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: 'Founder sire Line B. DM Clear.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'E', 'E')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'N/m')]
    }
  },
  { name: 'Chani (DM Carrier Founder Female)', species: 'DOG', sex: 'FEMALE', breed: 'Saluki', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'Founder dam Line B. DM Carrier.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'E', 'e')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'Clear')]
    }
  },

  // Generation 1
  { name: 'Spice Runner (DM Carrier Gen1 Male)', species: 'DOG', sex: 'MALE', breed: 'Saluki', generation: 1, sireRef: 'Muad\'Dib Hunter (DM Carrier Founder Male)', damRef: 'Shai-Hulud Dame (DM Carrier Founder Female)', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line A. DM Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 Line A - DM carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'E', 'e')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'Clear')]
    }
  },
  { name: 'Fremen Scout (DM Affected Female)', species: 'DOG', sex: 'FEMALE', breed: 'Saluki', generation: 1, sireRef: 'Muad\'Dib Hunter (DM Carrier Founder Male)', damRef: 'Shai-Hulud Dame (DM Carrier Founder Female)', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line A. DM Affected - DO NOT BREED!',
    coiTestScenario: 'Gen 1 Line A - got affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'E', 'E')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'm/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'Clear')]
    }
  },
  { name: 'Sietch Warrior (DM Carrier Gen1 Male)', species: 'DOG', sex: 'MALE', breed: 'Saluki', generation: 1, sireRef: 'Stilgar Hound (Clear Founder Male)', damRef: 'Chani (DM Carrier Founder Female)', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line B. DM Carrier from dam.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'E', 'e')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'N/m')]
    }
  },
  { name: 'Naib Huntress (Clear Gen1 Female)', species: 'DOG', sex: 'FEMALE', breed: 'Saluki', generation: 1, sireRef: 'Stilgar Hound (Clear Founder Male)', damRef: 'Chani (DM Carrier Founder Female)', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line B. DM Clear.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'E', 'E')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'Clear')]
    }
  },

  // Generation 2 - CROSS
  { name: 'Kwisatz Haderach (DM Carrier Gen2 Male)', species: 'DOG', sex: 'MALE', breed: 'Saluki', generation: 2, sireRef: 'Spice Runner (DM Carrier Gen1 Male)', damRef: 'Naib Huntress (Clear Gen1 Female)', birthYear: 2020, testProvider: 'Embark',
    notes: 'Line A sire × Line B dam outcross. DM Carrier.',
    coiTestScenario: 'Gen 2 outcross - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'E', 'e')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'Clear')]
    }
  },
  { name: 'Sayyadina (High COI DM Carrier Female)', species: 'DOG', sex: 'FEMALE', breed: 'Saluki', generation: 2, sireRef: 'Sietch Warrior (DM Carrier Gen1 Male)', damRef: 'Naib Huntress (Clear Gen1 Female)', birthYear: 2020, testProvider: 'Embark',
    notes: 'Line B × Line B sibling cross. HIGH COI ~25%.',
    coiTestScenario: 'Gen 2 sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'E', 'E')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'N/m')]
    }
  },

  // === HORSES - Arabian (Atreides Warhorses) ===
  // SCID (Severe Combined Immunodeficiency) carrier testing
  { name: 'Duke Leto (SCID Carrier Founder Stallion)', species: 'HORSE', sex: 'MALE', breed: 'Arabian', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
    notes: 'Noble stallion of House Atreides. Founder sire. SCID Carrier - WARNING!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'g')],
      health: [healthLocus('SCID', 'Severe Combined Immunodeficiency', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2015-06-15', eventName: 'Caladan Royal', eventLocation: 'Caladan' },
    ]
  },
  { name: 'Caladan Jewel (SCID Carrier Founder Mare)', species: 'HORSE', sex: 'FEMALE', breed: 'Arabian', generation: 0, birthYear: 2013, testProvider: 'UC Davis VGL',
    notes: 'Brought from the ocean world. SCID Carrier - DO NOT BREED TO LETO!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'g', 'g')],
      health: [healthLocus('SCID', 'Severe Combined Immunodeficiency', 'N/m')]
    }
  },
  { name: 'Sietch Warhorse (SCID Carrier Gen1 Colt)', species: 'HORSE', sex: 'MALE', breed: 'Arabian', generation: 1, sireRef: 'Duke Leto (SCID Carrier Founder Stallion)', damRef: 'Caladan Jewel (SCID Carrier Founder Mare)', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'SCID Carrier × Carrier = 25% lethal!',
    coiTestScenario: 'Gen 1 - SCID carrier × carrier (lethal)',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'G', 'g')],
      health: [healthLocus('SCID', 'Severe Combined Immunodeficiency', 'N/m')]
    }
  },
  { name: 'Desert Wind (SCID Clear Gen1 Filly)', species: 'HORSE', sex: 'FEMALE', breed: 'Arabian', generation: 1, sireRef: 'Duke Leto (SCID Carrier Founder Stallion)', damRef: 'Caladan Jewel (SCID Carrier Founder Mare)', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'Got clear from carrier × carrier.',
    coiTestScenario: 'Gen 1 - got clear genotype',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'g')],
      health: [healthLocus('SCID', 'Severe Combined Immunodeficiency', 'N/N')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2019-08-20', eventName: 'Arrakis Derby', eventLocation: 'Arrakeen' },
    ]
  },

  // === CATS - Abyssinian (Desert Cats) ===
  // PK Deficiency carrier testing
  { name: 'Reverend Mother (PKDef Carrier Type A Founder Female)', species: 'CAT', sex: 'FEMALE', breed: 'Abyssinian', generation: 0, birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'Cat with unusually perceptive abilities. Founder dam. PK Def Carrier!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('Ta', 'Tabby', 'Ta', 'Ta')],
      health: [healthLocus('PK_Def', 'PK Deficiency', 'N/m'), healthLocus('BloodType', 'Blood Type', 'A')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2017-05-10', eventName: 'Sietch Cat Show', eventLocation: 'Arrakis' },
    ]
  },
  { name: 'Mentat (PKDef Carrier Type B Founder Male)', species: 'CAT', sex: 'MALE', breed: 'Abyssinian', generation: 0, birthYear: 2014, testProvider: 'UC Davis VGL',
    notes: 'Founder sire. PK Def Carrier - DO NOT BREED TO REVEREND MOTHER!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'b', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('Ta', 'Tabby', 'Ta', 'Ta')],
      health: [healthLocus('PK_Def', 'PK Deficiency', 'N/m'), healthLocus('BloodType', 'Blood Type', 'B')]
    }
  },
  { name: 'Sardaukar (PKDef Carrier Gen1 Male)', species: 'CAT', sex: 'MALE', breed: 'Abyssinian', generation: 1, sireRef: 'Mentat (PKDef Carrier Type B Founder Male)', damRef: 'Reverend Mother (PKDef Carrier Type A Founder Female)', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'PK Def Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 - PK carrier × carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('Ta', 'Tabby', 'Ta', 'Ta')],
      health: [healthLocus('PK_Def', 'PK Deficiency', 'N/m')]
    }
  },
  { name: 'Alia (PKDef Affected Gen1 Female)', species: 'CAT', sex: 'FEMALE', breed: 'Abyssinian', generation: 1, sireRef: 'Mentat (PKDef Carrier Type B Founder Male)', damRef: 'Reverend Mother (PKDef Carrier Type A Founder Female)', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'PK Def Affected from carrier × carrier - DO NOT BREED!',
    coiTestScenario: 'Gen 1 - got affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'b', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('Ta', 'Tabby', 'Ta', 'Ta')],
      health: [healthLocus('PK_Def', 'PK Deficiency', 'm/m')]
    }
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// STAR TREK ANIMALS (Cats, Rabbits, Dogs) - Starfleet
// PKD for cats, CEA for dogs
// ═══════════════════════════════════════════════════════════════════════════════
export const STARFLEET_ANIMALS: AnimalDefinition[] = [
  // === CATS - Exotic Shorthair (Ship's Cats) ===
  // PKD carrier testing
  { name: 'Spot (PKD Carrier Founder Male)', species: 'CAT', sex: 'MALE', breed: 'Exotic Shorthair', generation: 0, birthYear: 2014, testProvider: 'UC Davis VGL',
    notes: 'Data\'s beloved cat from the Enterprise. Founder sire. PKD Carrier!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('O', 'Orange', 'O', 'Y')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2016-04-15', eventName: 'Enterprise Cat Show', eventLocation: 'Starbase 1', pointsEarned: 200 },
      { titleAbbreviation: 'GC', dateEarned: '2017-08-20', eventName: 'Federation Championship', eventLocation: 'Earth', pointsEarned: 1000 },
      { titleAbbreviation: 'DGC', dateEarned: '2019-05-10', eventName: 'Alpha Quadrant Finals', eventLocation: 'Vulcan', pointsEarned: 2000 },
    ],
    competitions: [
      // 2015 - Kitten class
      { eventName: 'Starbase 1 Cat Show', eventDate: '2015-03-15', location: 'Starbase 1', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Kitten', placement: 1, placementLabel: 'Best Kitten', judgeName: 'Dr. Beverly Crusher' },
      { eventName: 'Deep Space 9 Feline Expo', eventDate: '2015-09-20', location: 'DS9', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Kitten', placement: 2, judgeName: 'Major Kira Nerys' },
      // 2016 - Championship year
      { eventName: 'Enterprise Cat Show', eventDate: '2016-04-15', location: 'Starbase 1', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Championship', placement: 1, placementLabel: 'Best Cat', pointsEarned: 200, judgeName: 'Counselor Deanna Troi' },
      { eventName: 'Federation Regional', eventDate: '2016-08-10', location: 'Earth', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Championship', placement: 1, pointsEarned: 150, judgeName: 'Admiral Janeway' },
      // 2017 - Grand Champion year
      { eventName: 'Vulcan Logic Cat Show', eventDate: '2017-03-22', location: 'Vulcan', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Grand Championship', placement: 1, pointsEarned: 300, judgeName: 'Ambassador Sarek' },
      { eventName: 'Federation Championship', eventDate: '2017-08-20', location: 'Earth', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Grand Championship', placement: 1, placementLabel: 'Best Grand Champion', pointsEarned: 500, judgeName: 'Captain Jean-Luc Picard' },
      // 2018-2019 - DGC accumulation
      { eventName: 'Risa Cat Festival', eventDate: '2018-06-15', location: 'Risa', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Grand Championship', placement: 1, pointsEarned: 400, judgeName: 'Dr. Julian Bashir' },
      { eventName: 'Bajoran Heritage Show', eventDate: '2018-11-08', location: 'Bajor', organization: 'TICA', competitionType: 'BREED_SPECIALTY', className: 'Grand Championship', placement: 2, pointsEarned: 250, judgeName: 'Vedek Bareil' },
      { eventName: 'Alpha Quadrant Finals', eventDate: '2019-05-10', location: 'Vulcan', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Grand Championship', placement: 1, placementLabel: 'Best Double Grand Champion', pointsEarned: 600, judgeName: "T'Pau" },
    ]
  },
  { name: 'Enterprise (PKD Carrier Founder Female)', species: 'CAT', sex: 'FEMALE', breed: 'Exotic Shorthair', generation: 0, birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'Founder dam. PKD Carrier - DO NOT BREED TO SPOT!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('O', 'Orange', 'o', 'o')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m')]
    }
  },
  { name: 'Warp Core (PKD Carrier Gen1 Male)', species: 'CAT', sex: 'MALE', breed: 'Exotic Shorthair', generation: 1, sireRef: 'Spot (PKD Carrier Founder Male)', damRef: 'Enterprise (PKD Carrier Founder Female)', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'PKD Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 - PKD carrier × carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('O', 'Orange', 'O', 'o')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m')]
    }
  },
  { name: 'Tribble Hunter (PKD Clear Gen1 Female)', species: 'CAT', sex: 'FEMALE', breed: 'Exotic Shorthair', generation: 1, sireRef: 'Spot (PKD Carrier Founder Male)', damRef: 'Enterprise (PKD Carrier Founder Female)', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'PKD Clear from carrier × carrier.',
    coiTestScenario: 'Gen 1 - got clear genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('O', 'Orange', 'o', 'o')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    }
  },
  // Gen 2 sibling mating
  { name: 'Captain Picard (High COI PKD Carrier Male)', species: 'CAT', sex: 'MALE', breed: 'Exotic Shorthair', generation: 2, sireRef: 'Warp Core (PKD Carrier Gen1 Male)', damRef: 'Tribble Hunter (PKD Clear Gen1 Female)', birthYear: 2021, testProvider: 'UC Davis VGL',
    notes: 'FULL SIBLING PARENTS! HIGH COI ~25%.',
    coiTestScenario: 'Gen 2 full sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('O', 'Orange', 'O', 'o')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m')]
    }
  },

  // === RABBITS - Flemish Giant (Space Station Rabbits) ===
  { name: 'Tribble Alternative (Founder Male)', species: 'RABBIT', sex: 'MALE', breed: 'Flemish Giant', generation: 0, birthYear: 2016,
    notes: 'Much easier to manage than tribbles. Founder sire.',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: { coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Color Series', 'C', 'C'), locus('D', 'Dilute', 'D', 'D'), locus('En', 'English Spotting', 'en', 'en')] },
    titles: [
      { titleAbbreviation: 'GC', dateEarned: '2018-05-10', eventName: 'Starbase Rabbit Show', eventLocation: 'Deep Space 9', pointsEarned: 5 },
      { titleAbbreviation: 'BIS', dateEarned: '2019-09-15', eventName: 'Federation Rabbit Championship', eventLocation: 'Earth' },
    ],
    competitions: [
      { eventName: 'Enterprise Rabbit Show', eventDate: '2017-03-15', location: 'USS Enterprise', organization: 'ARBA', competitionType: 'CONFORMATION_SHOW', className: 'Senior Buck', placement: 1, placementLabel: 'Best of Breed', judgeName: 'Lt. Commander Data' },
      { eventName: 'Starbase Rabbit Show', eventDate: '2018-05-10', location: 'Deep Space 9', organization: 'ARBA', competitionType: 'CONFORMATION_SHOW', className: 'Grand Champion', placement: 1, placementLabel: 'Grand Champion', pointsEarned: 5, judgeName: 'Dr. Bashir' },
      { eventName: 'Vulcan Logic Show', eventDate: '2018-11-20', location: 'Vulcan', organization: 'ARBA', competitionType: 'CONFORMATION_SHOW', className: 'Grand Champion', placement: 2, judgeName: "T'Pring" },
      { eventName: 'Federation Rabbit Championship', eventDate: '2019-09-15', location: 'Earth', organization: 'ARBA', competitionType: 'CONFORMATION_SHOW', className: 'Best in Show', placement: 1, placementLabel: 'Best in Show', judgeName: 'Admiral Picard' },
    ]
  },
  { name: 'T\'Pol (Founder Female)', species: 'RABBIT', sex: 'FEMALE', breed: 'Flemish Giant', generation: 0, birthYear: 2016,
    notes: 'Founder dam.',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Color Series', 'C', 'cchd'), locus('D', 'Dilute', 'D', 'd'), locus('En', 'English Spotting', 'En', 'en')] }
  },
  { name: 'Holodeck (Gen1 Male)', species: 'RABBIT', sex: 'MALE', breed: 'Flemish Giant', generation: 1, sireRef: 'Tribble Alternative (Founder Male)', damRef: 'T\'Pol (Founder Female)', birthYear: 2019,
    coiTestScenario: 'Gen 1 - COI ~0%',
    genetics: { coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Color Series', 'C', 'cchd'), locus('D', 'Dilute', 'D', 'd'), locus('En', 'English Spotting', 'En', 'en')] }
  },
  { name: 'Transporter (Gen1 Female)', species: 'RABBIT', sex: 'FEMALE', breed: 'Flemish Giant', generation: 1, sireRef: 'Tribble Alternative (Founder Male)', damRef: 'T\'Pol (Founder Female)', birthYear: 2019,
    coiTestScenario: 'Gen 1 - COI ~0%',
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Color Series', 'C', 'C'), locus('D', 'Dilute', 'D', 'D'), locus('En', 'English Spotting', 'en', 'en')] }
  },
  { name: 'Worf (High COI Gen2 Male)', species: 'RABBIT', sex: 'MALE', breed: 'Flemish Giant', generation: 2, sireRef: 'Holodeck (Gen1 Male)', damRef: 'Transporter (Gen1 Female)', birthYear: 2022,
    notes: 'FULL SIBLING PARENTS! HIGH COI ~25%.',
    coiTestScenario: 'Gen 2 full sibling mating - COI ~25% (HIGH)',
    genetics: { coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Color Series', 'C', 'cchd'), locus('D', 'Dilute', 'D', 'd'), locus('En', 'English Spotting', 'En', 'en')] }
  },

  // === DOGS - Border Collie (Starfleet Service Dogs) ===
  // CEA (Collie Eye Anomaly) carrier testing
  { name: 'Number One (TNS Carrier Founder Male)', species: 'DOG', sex: 'MALE', breed: 'Border Collie', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: 'Named after Riker\'s nickname. Founder sire. CEA Clear, TNS Carrier - WARNING!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('CEA', 'Collie Eye Anomaly', 'Clear'), healthLocus('TNS', 'Trapped Neutrophil Syndrome', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2016-06-20', eventName: 'Starfleet Academy Show', eventLocation: 'San Francisco', pointsEarned: 15, majorWins: 2 },
    ]
  },
  { name: 'Ten Forward (CEA+TNS Carrier Founder Female)', species: 'DOG', sex: 'FEMALE', breed: 'Border Collie', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'Loves to greet visitors. Founder dam. CEA Carrier, TNS Carrier - DOUBLE WARNING!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('CEA', 'Collie Eye Anomaly', 'N/m'), healthLocus('TNS', 'Trapped Neutrophil Syndrome', 'N/m')]
    }
  },
  { name: 'Phaser (CEA+TNS Carrier Gen1 Male)', species: 'DOG', sex: 'MALE', breed: 'Border Collie', generation: 1, sireRef: 'Number One (TNS Carrier Founder Male)', damRef: 'Ten Forward (CEA+TNS Carrier Founder Female)', birthYear: 2018, testProvider: 'Embark',
    notes: 'TNS Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 - TNS carrier × carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('CEA', 'Collie Eye Anomaly', 'N/m'), healthLocus('TNS', 'Trapped Neutrophil Syndrome', 'N/m')]
    }
  },
  { name: 'Uhura (Clear Gen1 Female)', species: 'DOG', sex: 'FEMALE', breed: 'Border Collie', generation: 1, sireRef: 'Number One (TNS Carrier Founder Male)', damRef: 'Ten Forward (CEA+TNS Carrier Founder Female)', birthYear: 2018, testProvider: 'Embark',
    notes: 'TNS Clear.',
    coiTestScenario: 'Gen 1 - got clear genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('CEA', 'Collie Eye Anomaly', 'Clear'), healthLocus('TNS', 'Trapped Neutrophil Syndrome', 'Clear')]
    }
  },
  { name: 'Data (High COI CEA+TNS Carrier Male)', species: 'DOG', sex: 'MALE', breed: 'Border Collie', generation: 2, sireRef: 'Phaser (CEA+TNS Carrier Gen1 Male)', damRef: 'Uhura (Clear Gen1 Female)', birthYear: 2021, testProvider: 'Embark',
    notes: 'FULL SIBLING PARENTS! HIGH COI ~25%.',
    coiTestScenario: 'Gen 2 full sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('CEA', 'Collie Eye Anomaly', 'N/m'), healthLocus('TNS', 'Trapped Neutrophil Syndrome', 'N/m')]
    }
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TED LASSO ANIMALS (Dogs, Horses) - AFC Richmond
// PRA and Ichthyosis for Golden Retrievers, GBED for horses
// ═══════════════════════════════════════════════════════════════════════════════
export const RICHMOND_ANIMALS: AnimalDefinition[] = [
  // === DOGS - Golden Retriever (Mascot Dogs) ===
  // PRA and Ichthyosis carrier testing

  // BISCUITS LINE (Line A)
  { name: 'Ted Lasso (PRA+ICH Carrier Founder Male)', species: 'DOG', sex: 'MALE', breed: 'Golden Retriever', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: 'Named after Ted\'s famous shortbread biscuits. Founder sire Line A. PRA Carrier, Ichthyosis Carrier!',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('ICH', 'Ichthyosis', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2016-05-15', eventName: 'Richmond Dog Show', eventLocation: 'Nelson Road', pointsEarned: 15, majorWins: 2 },
      { titleAbbreviation: 'GCH', dateEarned: '2017-09-20', eventName: 'Premier League Championship', eventLocation: 'Wembley', pointsEarned: 25 },
    ],
    competitions: [
      { eventName: 'Richmond Dog Show', eventDate: '2016-05-15', location: 'Nelson Road', organization: 'AKC', competitionType: 'CONFORMATION_SHOW', className: 'Open Dogs', placement: 1, placementLabel: 'Best of Breed', pointsEarned: 5, isMajorWin: true, judgeName: 'Rebecca Welton' },
    ]
  },
  { name: 'Rebecca (PRA Carrier Founder Female)', species: 'DOG', sex: 'FEMALE', breed: 'Golden Retriever', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'The Diamond Dogs are Ted\'s support group. Founder dam Line A. PRA Carrier - DO NOT BREED TO TED LASSO!',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('ICH', 'Ichthyosis', 'Clear')]
    }
  },

  // ROY KENT LINE (Line B)
  { name: 'Roy Kent (ICH Carrier Founder Male)', species: 'DOG', sex: 'MALE', breed: 'Golden Retriever', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: 'Founder sire Line B. PRA Clear, Ichthyosis Carrier.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear'), healthLocus('ICH', 'Ichthyosis', 'N/m')]
    }
  },
  { name: 'Keeley (PRA+ICH Carrier Founder Female)', species: 'DOG', sex: 'FEMALE', breed: 'Golden Retriever', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'Founder dam Line B. PRA Carrier, Ichthyosis Carrier - DOUBLE WARNING!',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('ICH', 'Ichthyosis', 'N/m')]
    }
  },

  // Generation 1
  { name: 'Believe (PRA+ICH Carrier Gen1 Male)', species: 'DOG', sex: 'MALE', breed: 'Golden Retriever', generation: 1, sireRef: 'Ted Lasso (PRA+ICH Carrier Founder Male)', damRef: 'Rebecca (PRA Carrier Founder Female)', birthYear: 2017, testProvider: 'Embark',
    notes: 'Named after the iconic BELIEVE sign. Line A. PRA Carrier × Carrier = 25% affected!',
    coiTestScenario: 'Gen 1 Line A - PRA carrier × carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('ICH', 'Ichthyosis', 'N/m')]
    }
  },
  { name: 'Biscuits (PRA Affected Gen1 Female)', species: 'DOG', sex: 'FEMALE', breed: 'Golden Retriever', generation: 1, sireRef: 'Ted Lasso (PRA+ICH Carrier Founder Male)', damRef: 'Rebecca (PRA Carrier Founder Female)', birthYear: 2017, testProvider: 'Embark',
    notes: 'Ted\'s second favorite condiment. Line A. PRA Affected - DO NOT BREED!',
    coiTestScenario: 'Gen 1 Line A - got affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'm/m'), healthLocus('ICH', 'Ichthyosis', 'Clear')]
    }
  },
  { name: 'Jamie Tartt (PRA+ICH Carrier Gen1 Male)', species: 'DOG', sex: 'MALE', breed: 'Golden Retriever', generation: 1, sireRef: 'Roy Kent (ICH Carrier Founder Male)', damRef: 'Keeley (PRA+ICH Carrier Founder Female)', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line B. Ichthyosis Carrier × Carrier = 25% affected!',
    coiTestScenario: 'Gen 1 Line B - Ichthyosis carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('ICH', 'Ichthyosis', 'N/m')]
    }
  },
  { name: 'Nate (Clear Gen1 Female)', species: 'DOG', sex: 'FEMALE', breed: 'Golden Retriever', generation: 1, sireRef: 'Roy Kent (ICH Carrier Founder Male)', damRef: 'Keeley (PRA+ICH Carrier Founder Female)', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line B. Clear for both.',
    coiTestScenario: 'Gen 1 Line B - got clear genotypes',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear'), healthLocus('ICH', 'Ichthyosis', 'Clear')]
    }
  },

  // Generation 2 - CROSS
  { name: 'Richmond (PRA+ICH Carrier Gen2 Male)', species: 'DOG', sex: 'MALE', breed: 'Golden Retriever', generation: 2, sireRef: 'Believe (PRA+ICH Carrier Gen1 Male)', damRef: 'Nate (Clear Gen1 Female)', birthYear: 2020, testProvider: 'Embark',
    notes: 'Line A sire × Line B dam outcross. PRA Carrier.',
    coiTestScenario: 'Gen 2 outcross - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('ICH', 'Ichthyosis', 'N/m')]
    }
  },
  { name: 'Diamond Dog (High COI PRA+ICH Carrier Female)', species: 'DOG', sex: 'FEMALE', breed: 'Golden Retriever', generation: 2, sireRef: 'Jamie Tartt (PRA+ICH Carrier Gen1 Male)', damRef: 'Nate (Clear Gen1 Female)', birthYear: 2020, testProvider: 'Embark',
    notes: 'Line B × Line B sibling cross. HIGH COI ~25%.',
    coiTestScenario: 'Gen 2 sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('ICH', 'Ichthyosis', 'N/m')]
    }
  },

  // === HORSES - Thoroughbred (English Football Club Horses) ===
  // GBED carrier testing
  { name: 'Total Football (GBED Carrier Founder Stallion)', species: 'HORSE', sex: 'MALE', breed: 'Thoroughbred', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
    notes: 'Named after the playing style. Founder sire. GBED Carrier - WARNING!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'A'), locus('Cr', 'Cream', 'n', 'n')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'ROM', dateEarned: '2015-06-20', eventName: 'Richmond Derby', eventLocation: 'Nelson Road', pointsEarned: 15 },
      { titleAbbreviation: 'SP', dateEarned: '2017-09-10', eventName: 'English Championship', eventLocation: 'Newmarket', pointsEarned: 50 },
    ],
    competitions: [
      // Racing career 2014-2018
      { eventName: 'Richmond Derby', eventDate: '2014-05-15', location: 'Nelson Road', organization: 'BHA', competitionType: 'RACE', className: 'Maiden', placement: 1, placementLabel: 'Winner', prizeMoneyCents: 1500000, trackName: 'Nelson Road Downs', trackSurface: 'Turf', distanceFurlongs: 8, finishTime: '1:38.45', speedFigure: 85, handlerName: 'Jamie Tartt' },
      { eventName: 'AFC Richmond Stakes', eventDate: '2014-08-20', location: 'Nelson Road', organization: 'BHA', competitionType: 'RACE', className: 'Allowance', placement: 2, prizeMoneyCents: 500000, trackName: 'Nelson Road Downs', trackSurface: 'Turf', distanceFurlongs: 10, finishTime: '2:05.12', speedFigure: 88 },
      { eventName: 'Believe Stakes', eventDate: '2015-03-10', location: 'Richmond', organization: 'BHA', competitionType: 'RACE', className: 'Stakes', placement: 1, placementLabel: 'Winner', prizeMoneyCents: 5000000, trackName: 'Richmond Park', trackSurface: 'Turf', distanceFurlongs: 10, raceGrade: 'G3', finishTime: '2:02.88', speedFigure: 92, handlerName: 'Roy Kent' },
      { eventName: 'Richmond Derby', eventDate: '2015-06-20', location: 'Nelson Road', organization: 'BHA', competitionType: 'RACE', className: 'Stakes', placement: 1, placementLabel: 'Winner', prizeMoneyCents: 10000000, trackName: 'Nelson Road Downs', trackSurface: 'Turf', distanceFurlongs: 12, raceGrade: 'G2', finishTime: '2:28.15', speedFigure: 95, handlerName: 'Roy Kent' },
      { eventName: 'Diamond Dogs Handicap', eventDate: '2016-04-15', location: 'Newmarket', organization: 'BHA', competitionType: 'RACE', className: 'Stakes', placement: 3, prizeMoneyCents: 2000000, trackName: 'Newmarket', trackSurface: 'Turf', distanceFurlongs: 12, raceGrade: 'G1', finishTime: '2:26.44', speedFigure: 97, handlerName: 'Dani Rojas' },
      { eventName: 'English Championship', eventDate: '2017-09-10', location: 'Newmarket', organization: 'BHA', competitionType: 'RACE', className: 'Stakes', placement: 1, placementLabel: 'Winner', prizeMoneyCents: 25000000, trackName: 'Newmarket', trackSurface: 'Turf', distanceFurlongs: 12, raceGrade: 'G1', finishTime: '2:25.01', speedFigure: 102, handlerName: 'Sam Obisanya' },
      // Halter career post-racing
      { eventName: 'AFC Richmond Halter Show', eventDate: '2018-05-20', location: 'Nelson Road', organization: 'AQHA', competitionType: 'CONFORMATION_SHOW', className: 'Stallion', placement: 1, placementLabel: 'Grand Champion Stallion', pointsEarned: 10, judgeName: 'Ted Lasso' },
    ]
  },
  { name: 'Nelson Road (GBED Carrier Founder Mare)', species: 'HORSE', sex: 'FEMALE', breed: 'Thoroughbred', generation: 0, birthYear: 2013, testProvider: 'UC Davis VGL',
    notes: 'Named after Richmond\'s stadium. GBED Carrier - DO NOT BREED TO TOTAL FOOTBALL!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'a'), locus('Cr', 'Cream', 'n', 'n')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/m')]
    }
  },
  { name: 'Greyhound (GBED Carrier Gen1 Colt)', species: 'HORSE', sex: 'MALE', breed: 'Thoroughbred', generation: 1, sireRef: 'Total Football (GBED Carrier Founder Stallion)', damRef: 'Nelson Road (GBED Carrier Founder Mare)', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'Named after the Richmond Greyhounds nickname. GBED Carrier × Carrier = 25% lethal!',
    coiTestScenario: 'Gen 1 - GBED carrier × carrier (lethal)',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('Cr', 'Cream', 'n', 'n')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/m')]
    }
  },
  { name: 'Wonder Kid (GBED Clear Gen1 Filly)', species: 'HORSE', sex: 'FEMALE', breed: 'Thoroughbred', generation: 1, sireRef: 'Total Football (GBED Carrier Founder Stallion)', damRef: 'Nelson Road (GBED Carrier Founder Mare)', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'A filly with great potential. GBED Clear from carrier × carrier.',
    coiTestScenario: 'Gen 1 - got clear genotype',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'A'), locus('Cr', 'Cream', 'n', 'n')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/N')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2019-09-15', eventName: 'FA Cup Derby', eventLocation: 'Wembley' },
    ]
  },

  // === APPALOOSA - LP/LP Vision Issues Warning ===
  // Testing LP/lp × LP/lp = 25% LP/LP (night blindness)
  { name: 'Richmond Spots (Double LP Mare)', species: 'HORSE', sex: 'FEMALE', breed: 'Appaloosa', generation: 0, birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'Richmond mascot mare with spots. LP carrier (LP/lp). WARNING: LP/lp × LP/lp = vision issues!',
    coiTestScenario: 'Founder - LP carrier for dangerous pairing test',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('LP', 'Leopard Complex', 'LP', 'lp'), locus('PATN1', 'Pattern 1', 'PATN1', 'N')],
      health: [healthLocus('CSNB', 'Congenital Stationary Night Blindness', 'At Risk')]
    }
  },
  { name: 'Lasso Leopard (Double LP Stallion)', species: 'HORSE', sex: 'MALE', breed: 'Appaloosa', generation: 0, birthYear: 2017, testProvider: 'UC Davis VGL',
    notes: 'Spotted stallion with Ted\'s optimism. LP carrier. Pair with Richmond Spots for DOUBLE LP WARNING!',
    coiTestScenario: 'Founder - LP carrier for dangerous pairing test',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'a', 'a'), locus('LP', 'Leopard Complex', 'LP', 'lp'), locus('PATN1', 'Pattern 1', 'N', 'N')],
      health: [healthLocus('CSNB', 'Congenital Stationary Night Blindness', 'At Risk')]
    }
  },
  { name: 'Blanket (LP Clear Founder Mare)', species: 'HORSE', sex: 'FEMALE', breed: 'Appaloosa', generation: 0, birthYear: 2019, testProvider: 'UC Davis VGL',
    notes: 'Non-LP mare (lp/lp). Safe to breed with any LP stallion.',
    coiTestScenario: 'Founder - Non-LP for safe pairing comparison',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'A'), locus('LP', 'Leopard Complex', 'lp', 'lp'), locus('PATN1', 'Pattern 1', 'PATN1', 'PATN1')],
      health: [healthLocus('CSNB', 'Congenital Stationary Night Blindness', 'N/N')]
    }
  },

  // === INCOMPLETE GENETICS - What's Missing Analysis ===
  { name: 'New Signing (Incomplete Genetics)', species: 'DOG', sex: 'MALE', breed: 'Golden Retriever', generation: 0, birthYear: 2024,
    notes: 'NO GENETICS YET. New transfer, awaiting DNA test. For testing What\'s Missing analysis.',
    genetics: {
      // Completely empty - tests worst case
    }
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MATRIX ANIMALS (Cats, Goats, Horses, Dogs) - Zion
// HCM for cats, G6S for goats, HERDA for horses, DM for dogs
// ═══════════════════════════════════════════════════════════════════════════════
export const ZION_ANIMALS: AnimalDefinition[] = [
  // === CATS - Bombay (Black Cats of Zion) ===
  // HCM carrier testing
  { name: 'Neo (HCM Carrier Founder Male)', species: 'CAT', sex: 'MALE', breed: 'Bombay', generation: 0, birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'There is no spoon, but there is a cat. Founder sire. HCM Carrier - WARNING!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2017-04-15', eventName: 'Zion Cat Show', eventLocation: 'Zion', pointsEarned: 200 },
      { titleAbbreviation: 'GC', dateEarned: '2018-08-20', eventName: 'Matrix Championship', eventLocation: 'Zion', pointsEarned: 1000 },
      { titleAbbreviation: 'TGC', dateEarned: '2021-06-12', eventName: 'Resistance Championship', eventLocation: 'Zion', pointsEarned: 3000 },
    ],
    competitions: [
      // 2016 - Kitten class
      { eventName: 'Zion Underground Show', eventDate: '2016-02-20', location: 'Zion', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Kitten', placement: 1, placementLabel: 'Best Kitten', judgeName: 'The Oracle' },
      { eventName: 'Nebuchadnezzar Cat Show', eventDate: '2016-06-15', location: 'Nebuchadnezzar', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Kitten', placement: 1, pointsEarned: 50, judgeName: 'Morpheus' },
      // 2017 - Championship year
      { eventName: 'Zion Cat Show', eventDate: '2017-04-15', location: 'Zion', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Championship', placement: 1, placementLabel: 'Best Championship Cat', pointsEarned: 200, judgeName: 'Councillor Hamann' },
      { eventName: 'Resistance Regional', eventDate: '2017-09-10', location: 'Zion', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Championship', placement: 1, pointsEarned: 175, judgeName: 'Commander Lock' },
      // 2018 - Grand Champion year
      { eventName: 'Matrix Championship', eventDate: '2018-08-20', location: 'Zion', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Grand Championship', placement: 1, placementLabel: 'Best Grand Champion', pointsEarned: 500, judgeName: 'The Keymaker' },
      { eventName: 'Machine City Invitational', eventDate: '2018-11-05', location: 'Machine City', organization: 'TICA', competitionType: 'BREED_SPECIALTY', className: 'Grand Championship', placement: 1, pointsEarned: 400, judgeName: 'Deus Ex Machina' },
      // 2019-2021 - Working toward TGC
      { eventName: 'Zion Liberation Show', eventDate: '2019-04-20', location: 'Zion', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Grand Championship', placement: 1, pointsEarned: 350, judgeName: 'Niobe' },
      { eventName: 'Free Minds Cat Show', eventDate: '2020-02-14', location: 'Zion', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Grand Championship', placement: 1, pointsEarned: 400, judgeName: 'Ghost' },
      { eventName: 'Nebuchadnezzar Memorial', eventDate: '2020-09-10', location: 'Zion', organization: 'TICA', competitionType: 'BREED_SPECIALTY', className: 'Grand Championship', placement: 1, pointsEarned: 350, judgeName: 'Tank' },
      { eventName: 'Resistance Championship', eventDate: '2021-06-12', location: 'Zion', organization: 'TICA', competitionType: 'CONFORMATION_SHOW', className: 'Grand Championship', placement: 1, placementLabel: 'Best Triple Grand Champion', pointsEarned: 500, judgeName: 'Seraph' },
    ]
  },
  { name: 'Trinity (HCM Carrier Founder Female)', species: 'CAT', sex: 'FEMALE', breed: 'Bombay', generation: 0, birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'Founder dam. HCM Carrier - DO NOT BREED TO NEO!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },
  { name: 'Red Pill (HCM Carrier Gen1 Male)', species: 'CAT', sex: 'MALE', breed: 'Bombay', generation: 1, sireRef: 'Neo (HCM Carrier Founder Male)', damRef: 'Trinity (HCM Carrier Founder Female)', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'HCM Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 - HCM carrier × carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },
  { name: 'Blue Pill (HCM Affected Gen1 Female)', species: 'CAT', sex: 'FEMALE', breed: 'Bombay', generation: 1, sireRef: 'Neo (HCM Carrier Founder Male)', damRef: 'Trinity (HCM Carrier Founder Female)', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'HCM Affected from carrier × carrier - DO NOT BREED!',
    coiTestScenario: 'Gen 1 - got affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'm/m')]
    }
  },
  { name: 'Morpheus (High COI HCM Carrier Male)', species: 'CAT', sex: 'MALE', breed: 'Bombay', generation: 2, sireRef: 'Red Pill (HCM Carrier Gen1 Male)', damRef: 'Blue Pill (HCM Affected Gen1 Female)', birthYear: 2021, testProvider: 'UC Davis VGL',
    notes: 'FULL SIBLING PARENTS! HIGH COI ~25%.',
    coiTestScenario: 'Gen 2 full sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },

  // === SCOTTISH FOLD CATS - Reality Benders (Double Fold Warning) ===
  // Testing Fd/fd × Fd/fd = 25% Fd/Fd (severe cartilage issues)
  { name: 'Glitch (Double Fold Type A Female)', species: 'CAT', sex: 'FEMALE', breed: 'Scottish Fold', generation: 0, birthYear: 2020, testProvider: 'UC Davis VGL',
    notes: 'A glitch in the Matrix. Fold carrier (Fd/fd). WARNING: Do not breed to another fold carrier!',
    coiTestScenario: 'Founder - Fold carrier for dangerous pairing test',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Colorpoint', 'C', 'C'), locus('D', 'Dilute', 'D', 'd')],
      physicalTraits: [locus('Fd', 'Fold', 'Fd', 'fd')],
      health: [healthLocus('OCD', 'Osteochondrodysplasia', 'At Risk'), healthLocus('BloodType', 'Blood Type', 'A')]
    }
  },
  { name: 'Déjà Vu (Double Fold Type B Male)', species: 'CAT', sex: 'MALE', breed: 'Scottish Fold', generation: 0, birthYear: 2019, testProvider: 'UC Davis VGL',
    notes: 'When you see the same cat twice. Fold carrier. Pair with Glitch for DOUBLE FOLD WARNING!',
    coiTestScenario: 'Founder - Fold carrier for dangerous pairing test',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Colorpoint', 'C', 'C'), locus('D', 'Dilute', 'd', 'd')],
      physicalTraits: [locus('Fd', 'Fold', 'Fd', 'fd')],
      health: [healthLocus('OCD', 'Osteochondrodysplasia', 'At Risk'), healthLocus('BloodType', 'Blood Type', 'B')]
    }
  },
  { name: 'Agent Smith (Straight Ear Safe Female)', species: 'CAT', sex: 'FEMALE', breed: 'Scottish Straight', generation: 0, birthYear: 2021, testProvider: 'UC Davis VGL',
    notes: 'Agent with normal ears. Non-fold (fd/fd). Safe to breed with any fold carrier.',
    coiTestScenario: 'Founder - Non-fold for safe pairing comparison',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Colorpoint', 'C', 'cs'), locus('D', 'Dilute', 'D', 'D')],
      physicalTraits: [locus('Fd', 'Fold', 'fd', 'fd')],
      health: [healthLocus('OCD', 'Osteochondrodysplasia', 'N/N'), healthLocus('BloodType', 'Blood Type', 'A')]
    }
  },

  // === INCOMPLETE GENETICS - What's Missing Analysis ===
  { name: 'Rescued (Incomplete Genetics)', species: 'DOG', sex: 'MALE', breed: 'Mixed Breed', generation: 0, birthYear: 2022,
    notes: 'INTENTIONALLY INCOMPLETE. Recently unplugged rescue. Only has B locus. For testing What\'s Missing analysis.',
    genetics: {
      coatColor: [locus('B', 'Brown', 'B', 'b')]
      // No health data - triggers suggestions
    }
  },

  // === GOATS - La Mancha (Zion Farm) ===
  // G6S carrier testing
  { name: 'The Architect (G6S Carrier Founder Male)', species: 'GOAT', sex: 'MALE', breed: 'La Mancha', generation: 0, birthYear: 2016,
    notes: 'Providing milk for Zion. Founder sire. G6S Carrier - WARNING!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Ab'), locus('B', 'Brown', 'B', 'B')],
      physicalTraits: [locus('P', 'Polled', 'P', 'p')],
      health: [healthLocus('G6S', 'G6S', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2017-04-10', eventName: 'Underground Farm Show', eventLocation: 'Zion', pointsEarned: 5 },
      { titleAbbreviation: 'GCH', dateEarned: '2018-06-15', eventName: 'Zion Farm Show', eventLocation: 'Zion', pointsEarned: 10 },
      { titleAbbreviation: '*M', dateEarned: '2019-09-20', eventName: 'ADGA Milk Test', eventLocation: 'Zion' },
    ],
    competitions: [
      { eventName: 'Underground Farm Show', eventDate: '2017-04-10', location: 'Zion', organization: 'ADGA', competitionType: 'CONFORMATION_SHOW', className: 'Senior Buck', placement: 1, placementLabel: 'Grand Champion Buck', pointsEarned: 5, judgeName: 'The Merovingian' },
      { eventName: 'Nebuchadnezzar Dairy Show', eventDate: '2017-09-15', location: 'Nebuchadnezzar', organization: 'ADGA', competitionType: 'CONFORMATION_SHOW', className: 'Senior Buck', placement: 1, pointsEarned: 3, judgeName: 'Persephone' },
      { eventName: 'Zion Farm Show', eventDate: '2018-06-15', location: 'Zion', organization: 'ADGA', competitionType: 'CONFORMATION_SHOW', className: 'Grand Champion', placement: 1, placementLabel: 'Best in Show', pointsEarned: 10, judgeName: 'Councillor West' },
      { eventName: 'Machine City Open', eventDate: '2019-03-20', location: 'Machine City', organization: 'ADGA', competitionType: 'CONFORMATION_SHOW', className: 'Grand Champion', placement: 2, pointsEarned: 5, judgeName: 'The Trainman' },
    ]
  },
  { name: 'The Oracle (G6S Carrier Founder Female)', species: 'GOAT', sex: 'FEMALE', breed: 'La Mancha', generation: 0, birthYear: 2016,
    notes: 'Founder dam. G6S Carrier - DO NOT BREED TO THE ARCHITECT!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Awt', 'Ab')],
      physicalTraits: [locus('P', 'Polled', 'p', 'p')],
      health: [healthLocus('G6S', 'G6S', 'N/m')]
    }
  },
  { name: 'Freedom (G6S Carrier Gen1 Kid)', species: 'GOAT', sex: 'MALE', breed: 'La Mancha', generation: 1, sireRef: 'The Architect (G6S Carrier Founder Male)', damRef: 'The Oracle (G6S Carrier Founder Female)', birthYear: 2019,
    notes: 'G6S Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 - G6S carrier × carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Awt')],
      physicalTraits: [locus('P', 'Polled', 'P', 'p')],
      health: [healthLocus('G6S', 'G6S', 'N/m')]
    }
  },
  { name: 'Awakened (G6S Affected Gen1 Doeling)', species: 'GOAT', sex: 'FEMALE', breed: 'La Mancha', generation: 1, sireRef: 'The Architect (G6S Carrier Founder Male)', damRef: 'The Oracle (G6S Carrier Founder Female)', birthYear: 2019,
    notes: 'G6S Affected - DO NOT BREED!',
    coiTestScenario: 'Gen 1 - got affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Ab')],
      physicalTraits: [locus('P', 'Polled', 'p', 'p')],
      health: [healthLocus('G6S', 'G6S', 'm/m')]
    }
  },

  // === HORSES - Mustang (Free Horses) ===
  // HERDA carrier testing
  { name: 'Nebuchadnezzar (HERDA Carrier Founder Stallion)', species: 'HORSE', sex: 'MALE', breed: 'Mustang', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
    notes: 'Named after Morpheus\' ship. Founder sire. HERDA Carrier - WARNING!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'a'), locus('D', 'Dilute', 'D', 'D')],
      health: [healthLocus('HERDA', 'Hereditary Equine Regional Dermal Asthenia', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2015-07-20', eventName: 'Zion Freedom Run', eventLocation: 'Zion' },
    ]
  },
  { name: 'Zion (HERDA Carrier Founder Mare)', species: 'HORSE', sex: 'FEMALE', breed: 'Mustang', generation: 0, birthYear: 2013, testProvider: 'UC Davis VGL',
    notes: 'Founder dam. HERDA Carrier - DO NOT BREED TO NEBUCHADNEZZAR!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'A'), locus('D', 'Dilute', 'D', 'd')],
      health: [healthLocus('HERDA', 'Hereditary Equine Regional Dermal Asthenia', 'N/m')]
    }
  },
  { name: 'Sentinel (HERDA Carrier Gen1 Colt)', species: 'HORSE', sex: 'MALE', breed: 'Mustang', generation: 1, sireRef: 'Nebuchadnezzar (HERDA Carrier Founder Stallion)', damRef: 'Zion (HERDA Carrier Founder Mare)', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'HERDA Carrier × Carrier = 25% affected!',
    coiTestScenario: 'Gen 1 - HERDA carrier × carrier warning',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('D', 'Dilute', 'D', 'd')],
      health: [healthLocus('HERDA', 'Hereditary Equine Regional Dermal Asthenia', 'N/m')]
    }
  },
  { name: 'Oracle (HERDA Clear Gen1 Filly)', species: 'HORSE', sex: 'FEMALE', breed: 'Mustang', generation: 1, sireRef: 'Nebuchadnezzar (HERDA Carrier Founder Stallion)', damRef: 'Zion (HERDA Carrier Founder Mare)', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'HERDA Clear from carrier × carrier.',
    coiTestScenario: 'Gen 1 - got clear genotype',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'A'), locus('D', 'Dilute', 'D', 'D')],
      health: [healthLocus('HERDA', 'Hereditary Equine Regional Dermal Asthenia', 'N/N')]
    }
  },

  // === DOGS - Belgian Malinois (Resistance Dogs) ===
  // DM carrier testing
  { name: 'Agent Hunter (DM Carrier Founder Male)', species: 'DOG', sex: 'MALE', breed: 'Belgian Malinois', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: 'Trained to detect Agents. Founder sire. DM Carrier - WARNING!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('Em', 'Melanistic Mask', 'Em', 'E')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2016-05-15', eventName: 'Zion Guard Dog Trials', eventLocation: 'Zion', pointsEarned: 15, majorWins: 2 },
    ]
  },
  { name: 'Tank (DM Carrier Founder Female)', species: 'DOG', sex: 'FEMALE', breed: 'Belgian Malinois', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'Founder dam. DM Carrier - DO NOT BREED TO AGENT HUNTER!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('Em', 'Melanistic Mask', 'Em', 'Em')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m')]
    }
  },
  { name: 'Unplugged (DM Carrier Gen1 Male)', species: 'DOG', sex: 'MALE', breed: 'Belgian Malinois', generation: 1, sireRef: 'Agent Hunter (DM Carrier Founder Male)', damRef: 'Tank (DM Carrier Founder Female)', birthYear: 2018, testProvider: 'Embark',
    notes: 'DM Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 - DM carrier × carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('Em', 'Melanistic Mask', 'Em', 'E')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m')]
    }
  },
  { name: 'Kung Fu (DM Affected Gen1 Female)', species: 'DOG', sex: 'FEMALE', breed: 'Belgian Malinois', generation: 1, sireRef: 'Agent Hunter (DM Carrier Founder Male)', damRef: 'Tank (DM Carrier Founder Female)', birthYear: 2018, testProvider: 'Embark',
    notes: 'DM Affected from carrier × carrier - DO NOT BREED!',
    coiTestScenario: 'Gen 1 - got affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('Em', 'Melanistic Mask', 'Em', 'Em')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'm/m')]
    }
  },
  { name: 'Resistance (High COI DM Carrier Male)', species: 'DOG', sex: 'MALE', breed: 'Belgian Malinois', generation: 2, sireRef: 'Unplugged (DM Carrier Gen1 Male)', damRef: 'Kung Fu (DM Affected Gen1 Female)', birthYear: 2021, testProvider: 'Embark',
    notes: 'FULL SIBLING PARENTS! HIGH COI ~25%.',
    coiTestScenario: 'Gen 2 full sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('Em', 'Melanistic Mask', 'Em', 'E')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m')]
    }
  },
];

// Map PROD tenant slugs to their animals
export const PROD_TENANT_ANIMALS: Record<string, AnimalDefinition[]> = {
  arrakis: ARRAKIS_ANIMALS,
  starfleet: STARFLEET_ANIMALS,
  richmond: RICHMOND_ANIMALS,
  zion: ZION_ANIMALS,
};

// Helper to get animals for an environment
export function getTenantAnimals(env: Environment): Record<string, AnimalDefinition[]> {
  return env === 'prod' ? PROD_TENANT_ANIMALS : DEV_TENANT_ANIMALS;
}

// Legacy export - defaults to DEV
export const TENANT_ANIMALS = DEV_TENANT_ANIMALS;

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

export const DEV_TENANT_BREEDING_PLANS: Record<string, BreedingPlanDefinition[]> = {
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
  'stark-tower': [
    { name: 'Flerken Breeding Initiative', species: 'CAT', breedText: 'Ragdoll', damRef: 'Wakandan Temple Cat', sireRef: 'Goose the Flerken', status: 'COMMITTED', notes: 'SHIELD-monitored breeding program for Flerken descendants.' },
    { name: 'Asgardian Steed Program', species: 'HORSE', breedText: 'Lipizzan', damRef: 'Valkyrie Mare', sireRef: 'Sleipnir', status: 'PLANNING', notes: 'Breeding horses worthy of Asgardian warriors.' },
    { name: 'Infinity Farm Goats', species: 'GOAT', breedText: 'Nigerian Dwarf', damRef: 'Infinity Nanny', sireRef: 'Thanos Bane', status: 'COMMITTED', notes: 'Avengers compound sustainability program.' },
    { name: 'Lucky\'s Legacy', species: 'DOG', breedText: 'Cavalier King Charles Spaniel', damRef: 'Cosmo Dame', sireRef: 'Lucky Pizza Dog', status: 'PLANNING', notes: 'Companion breeding for Avengers families.' },
  ],
};

// PROD Breeding Plans
export const PROD_TENANT_BREEDING_PLANS: Record<string, BreedingPlanDefinition[]> = {
  arrakis: [
    { name: 'Atreides Hound Program 2026', nickname: 'Spice Dogs', species: 'DOG', breedText: 'Saluki', damRef: 'Shai-Hulud Dame (DM Carrier Founder Female)', sireRef: 'Muad\'Dib Hunter (DM Carrier Founder Male)', status: 'PLANNING', notes: 'Desert-adapted hunting dogs for House Atreides.', expectedCycleStart: new Date('2026-03-01') },
    { name: 'Caladan Legacy', species: 'HORSE', breedText: 'Arabian', damRef: 'Caladan Jewel (SCID Carrier Founder Mare)', sireRef: 'Duke Leto (SCID Carrier Founder Stallion)', status: 'COMMITTED', notes: 'Preserving the Atreides equine bloodline.' },
    { name: 'Bene Gesserit Companions', species: 'CAT', breedText: 'Abyssinian', damRef: 'Reverend Mother (PKDef Carrier Type A Founder Female)', sireRef: 'Mentat (PKDef Carrier Type B Founder Male)', status: 'PLANNING', notes: 'Breeding perceptive feline companions.' },
    { name: 'Fremen Pack', species: 'DOG', breedText: 'Saluki', damRef: 'Fremen Scout (DM Affected Female)', sireRef: 'Spice Runner (DM Carrier Gen1 Male)', status: 'COMMITTED', notes: 'Sietch guard dogs.' },
  ],
  starfleet: [
    { name: 'Enterprise Cats 2026', species: 'CAT', breedText: 'Exotic Shorthair', damRef: 'Enterprise (PKD Carrier Founder Female)', sireRef: 'Spot (PKD Carrier Founder Male)', status: 'PLANNING', notes: 'Ship cat breeding program for starships.' },
    { name: 'Academy Service Dogs', species: 'DOG', breedText: 'Border Collie', damRef: 'Ten Forward (CEA+TNS Carrier Founder Female)', sireRef: 'Number One (TNS Carrier Founder Male)', status: 'COMMITTED', notes: 'Service dogs for Starfleet Academy.' },
    { name: 'Station Rabbits', species: 'RABBIT', breedText: 'Flemish Giant', damRef: 'T\'Pol (Founder Female)', sireRef: 'Tribble Alternative (Founder Male)', status: 'PLANNING', notes: 'Alternative to tribbles for station morale.' },
  ],
  richmond: [
    { name: 'Diamond Dogs Breeding', nickname: 'Believe Litter', species: 'DOG', breedText: 'Golden Retriever', damRef: 'Rebecca (PRA Carrier Founder Female)', sireRef: 'Ted Lasso (PRA+ICH Carrier Founder Male)', status: 'COMMITTED', notes: 'Breeding the next generation of AFC Richmond mascots.' },
    { name: 'Nelson Road Horses', species: 'HORSE', breedText: 'Thoroughbred', damRef: 'Nelson Road (GBED Carrier Founder Mare)', sireRef: 'Total Football (GBED Carrier Founder Stallion)', status: 'PLANNING', notes: 'Horses for club promotional events.' },
    { name: 'Wonder Kids Program', species: 'DOG', breedText: 'Golden Retriever', damRef: 'Biscuits (PRA Affected Gen1 Female)', sireRef: 'Believe (PRA+ICH Carrier Gen1 Male)', status: 'PLANNING', notes: 'Youth development breeding program.' },
  ],
  zion: [
    { name: 'Resistance Cat Program', species: 'CAT', breedText: 'Bombay', damRef: 'Trinity (HCM Carrier Founder Female)', sireRef: 'Neo (HCM Carrier Founder Male)', status: 'COMMITTED', notes: 'Black cats of Zion breeding program.' },
    { name: 'Free Horse Initiative', species: 'HORSE', breedText: 'Mustang', damRef: 'Zion (HERDA Carrier Founder Mare)', sireRef: 'Nebuchadnezzar (HERDA Carrier Founder Stallion)', status: 'PLANNING', notes: 'Wild horse breeding for freedom.' },
    { name: 'Zion Farm Goats', species: 'GOAT', breedText: 'La Mancha', damRef: 'The Oracle (G6S Carrier Founder Female)', sireRef: 'The Architect (G6S Carrier Founder Male)', status: 'COMMITTED', notes: 'Sustenance for Zion.' },
    { name: 'Agent Tracker Dogs', species: 'DOG', breedText: 'Belgian Malinois', damRef: 'Tank (DM Carrier Founder Female)', sireRef: 'Agent Hunter (DM Carrier Founder Male)', status: 'PLANNING', notes: 'Training dogs to detect Agents.' },
  ],
};

// Helper to get breeding plans for an environment
export function getTenantBreedingPlans(env: Environment): Record<string, BreedingPlanDefinition[]> {
  return env === 'prod' ? PROD_TENANT_BREEDING_PLANS : DEV_TENANT_BREEDING_PLANS;
}

// Legacy export - defaults to DEV
export const TENANT_BREEDING_PLANS = DEV_TENANT_BREEDING_PLANS;

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

export const DEV_TENANT_MARKETPLACE_LISTINGS: Record<string, MarketplaceListingDefinition[]> = {
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
  'stark-tower': [
    { title: 'Stark Industries K9 Program', description: 'Advanced breeding program backed by Stark Industries technology and Avengers expertise.', listingType: 'BREEDING_PROGRAM', status: 'ACTIVE', city: 'New York', state: 'NY', country: 'US' },
    { title: 'Asgardian Horse Stud Services', description: 'Descendants of Sleipnir available for breeding. Thor-approved.', listingType: 'STUD_SERVICE', status: 'ACTIVE', priceCents: 500000, priceType: 'contact', city: 'New York', state: 'NY', country: 'US' },
  ],
};

// PROD Marketplace Listings
export const PROD_TENANT_MARKETPLACE_LISTINGS: Record<string, MarketplaceListingDefinition[]> = {
  arrakis: [
    { title: 'House Atreides Breeding Program', description: 'Noble breeding traditions from Caladan, adapted to Arrakis.', listingType: 'BREEDING_PROGRAM', status: 'ACTIVE', city: 'Arrakeen', state: 'Arrakis', country: 'US' },
    { title: 'Desert Hound Stud Services', description: 'Saluki studs bred for desert survival and hunting.', listingType: 'STUD_SERVICE', status: 'ACTIVE', priceCents: 200000, priceType: 'fixed', city: 'Sietch Tabr', state: 'Arrakis', country: 'US' },
    { title: 'Atreides Horse Stud', description: 'Arabian stallions from the Duke\'s personal stable.', listingType: 'STUD_SERVICE', status: 'DRAFT', priceCents: 350000, priceType: 'contact', city: 'Arrakeen', state: 'Arrakis', country: 'US' },
  ],
  starfleet: [
    { title: 'Starfleet Companion Program', description: 'Federation-approved breeding for starship and station companions.', listingType: 'BREEDING_PROGRAM', status: 'ACTIVE', city: 'San Francisco', state: 'CA', country: 'US' },
    { title: 'Academy Dog Stud Services', description: 'Border Collies trained for Starfleet service.', listingType: 'STUD_SERVICE', status: 'DRAFT', priceCents: 150000, priceType: 'starting_at', city: 'San Francisco', state: 'CA', country: 'US' },
  ],
  richmond: [
    // Richmond has no public listings - private club program
    { title: 'AFC Richmond Mascot Program', description: 'Private breeding program for club mascots. Not open to public.', listingType: 'BREEDING_PROGRAM', status: 'DRAFT', city: 'Richmond', state: 'London', country: 'GB' },
  ],
  zion: [
    { title: 'Zion Collective Breeding', description: 'Last human breeding collective. All species welcome.', listingType: 'BREEDING_PROGRAM', status: 'ACTIVE', city: 'Zion', state: 'Underground', country: 'US' },
    { title: 'Resistance Dog Program', description: 'Belgian Malinois trained for Agent detection.', listingType: 'STUD_SERVICE', status: 'ACTIVE', priceCents: 175000, priceType: 'fixed', city: 'Zion', state: 'Underground', country: 'US' },
  ],
};

// Helper to get marketplace listings for an environment
export function getTenantMarketplaceListings(env: Environment): Record<string, MarketplaceListingDefinition[]> {
  return env === 'prod' ? PROD_TENANT_MARKETPLACE_LISTINGS : DEV_TENANT_MARKETPLACE_LISTINGS;
}

// Legacy export - defaults to DEV
export const TENANT_MARKETPLACE_LISTINGS = DEV_TENANT_MARKETPLACE_LISTINGS;

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL ACCESS DEFINITIONS
// One contact and one organization per tenant get portal access
// ═══════════════════════════════════════════════════════════════════════════════

export interface PortalAccessDefinition {
  // Which entity gets portal access (index into contacts/organizations array)
  contactIndex: number;  // First contact gets portal access
  organizationIndex: number;  // First organization gets portal access
  // Portal user credentials (separate User account linked via PortalAccess)
  contactPortalUser: {
    emailBase: string;
    firstName: string;
    lastName: string;
    password: string;
  };
  organizationPortalUser: {
    emailBase: string;
    firstName: string;
    lastName: string;
    password: string;
  };
}

// DEV Portal Access - first contact and first org get access
export const DEV_PORTAL_ACCESS: Record<string, PortalAccessDefinition> = {
  rivendell: {
    contactIndex: 0,  // Gandalf
    organizationIndex: 0,  // House of Elrond
    contactPortalUser: {
      emailBase: 'gandalf.portal@middleearth.local',
      firstName: 'Gandalf',
      lastName: 'TheGrey',
      password: 'Mithrandir123!',
    },
    organizationPortalUser: {
      emailBase: 'elrond.portal@rivendell.local',
      firstName: 'Elrond',
      lastName: 'HalfElven',
      password: 'Vilya123!',
    },
  },
  hogwarts: {
    contactIndex: 0,  // Dumbledore
    organizationIndex: 0,  // Hagrid's Hut
    contactPortalUser: {
      emailBase: 'dumbledore.portal@hogwarts.local',
      firstName: 'Albus',
      lastName: 'Dumbledore',
      password: 'LemonDrop123!',
    },
    organizationPortalUser: {
      emailBase: 'hagrid.portal@hogwarts.local',
      firstName: 'Rubeus',
      lastName: 'Hagrid',
      password: 'Norbert123!',
    },
  },
  winterfell: {
    contactIndex: 0,  // Jon Snow
    organizationIndex: 0,  // Stark Kennels
    contactPortalUser: {
      emailBase: 'jon.portal@nightswatch.local',
      firstName: 'Jon',
      lastName: 'Snow',
      password: 'GhostWolf123!',
    },
    organizationPortalUser: {
      emailBase: 'arya.portal@winterfell.local',
      firstName: 'Arya',
      lastName: 'Stark',
      password: 'Needle123!',
    },
  },
  'stark-tower': {
    contactIndex: 0,  // Steve Rogers
    organizationIndex: 0,  // Stark Industries K9
    contactPortalUser: {
      emailBase: 'steve.portal@avengers.local',
      firstName: 'Steve',
      lastName: 'Rogers',
      password: 'Shield123!',
    },
    organizationPortalUser: {
      emailBase: 'pepper.portal@stark.local',
      firstName: 'Pepper',
      lastName: 'Potts',
      password: 'StarkIndustries123!',
    },
  },
};

// PROD Portal Access
export const PROD_PORTAL_ACCESS: Record<string, PortalAccessDefinition> = {
  arrakis: {
    contactIndex: 0,  // Duncan Idaho
    organizationIndex: 0,  // House Atreides Stables
    contactPortalUser: {
      emailBase: 'duncan.portal@atreides.local',
      firstName: 'Duncan',
      lastName: 'Idaho',
      password: 'Ginaz123!',
    },
    organizationPortalUser: {
      emailBase: 'jessica.portal@atreides.local',
      firstName: 'Jessica',
      lastName: 'Atreides',
      password: 'BeneGesserit123!',
    },
  },
  starfleet: {
    contactIndex: 0,  // Riker
    organizationIndex: 0,  // Starfleet Academy
    contactPortalUser: {
      emailBase: 'riker.portal@starfleet.local',
      firstName: 'William',
      lastName: 'Riker',
      password: 'NumberOne123!',
    },
    organizationPortalUser: {
      emailBase: 'data.portal@starfleet.local',
      firstName: 'Data',
      lastName: 'Soong',
      password: 'Android123!',
    },
  },
  richmond: {
    contactIndex: 0,  // Rebecca
    organizationIndex: 0,  // AFC Richmond Kennels
    contactPortalUser: {
      emailBase: 'rebecca.portal@afcrichmond.local',
      firstName: 'Rebecca',
      lastName: 'Welton',
      password: 'Boss123!',
    },
    organizationPortalUser: {
      emailBase: 'higgins.portal@afcrichmond.local',
      firstName: 'Leslie',
      lastName: 'Higgins',
      password: 'DiamondDogs123!',
    },
  },
  zion: {
    contactIndex: 0,  // Morpheus
    organizationIndex: 0,  // Zion Breeding Collective
    contactPortalUser: {
      emailBase: 'morpheus.portal@zion.local',
      firstName: 'Morpheus',
      lastName: 'Captain',
      password: 'RedPill123!',
    },
    organizationPortalUser: {
      emailBase: 'trinity.portal@zion.local',
      firstName: 'Trinity',
      lastName: 'Operator',
      password: 'WhiteRabbit123!',
    },
  },
};

// Helper to get portal access definitions for an environment
export function getPortalAccessDefinitions(env: Environment): Record<string, PortalAccessDefinition> {
  return env === 'prod' ? PROD_PORTAL_ACCESS : DEV_PORTAL_ACCESS;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE USER DEFINITIONS (standalone shoppers)
// These users have no tenant membership - they simulate marketplace consumers
// ═══════════════════════════════════════════════════════════════════════════════

export interface MarketplaceUserDefinition {
  emailBase: string;
  firstName: string;
  lastName: string;
  password: string;
  description: string;  // What this user persona represents for testing
}

// Marketplace users are the same for both DEV and PROD (different email prefixes)
export const MARKETPLACE_USERS: MarketplaceUserDefinition[] = [
  {
    emailBase: 'shopper.alice@marketplace.local',
    firstName: 'Alice',
    lastName: 'Shopper',
    password: 'MarketAlice123!',
    description: 'New user browsing for first pet',
  },
  {
    emailBase: 'shopper.bob@marketplace.local',
    firstName: 'Bob',
    lastName: 'Buyer',
    password: 'MarketBob123!',
    description: 'Experienced buyer looking for show quality',
  },
  {
    emailBase: 'shopper.carol@marketplace.local',
    firstName: 'Carol',
    lastName: 'Collector',
    password: 'MarketCarol123!',
    description: 'Collector interested in rare breeds',
  },
  {
    emailBase: 'shopper.dave@marketplace.local',
    firstName: 'Dave',
    lastName: 'Dealer',
    password: 'MarketDave123!',
    description: 'Professional breeder scouting studs',
  },
];

// Helper to get marketplace users (same for both environments, but emails prefixed)
export function getMarketplaceUsers(): MarketplaceUserDefinition[] {
  return MARKETPLACE_USERS;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREDENTIAL SUMMARY (for password vault)
// ═══════════════════════════════════════════════════════════════════════════════

export function generateCredentialsSummary(env: Environment): string {
  const tenantDefs = getTenantDefinitions(env);
  const tenantUsers = getTenantUsers(env);
  const portalAccessDefs = getPortalAccessDefinitions(env);
  const marketplaceUsers = getMarketplaceUsers();

  const lines: string[] = [
    `═══════════════════════════════════════════════════════════════════════════════`,
    `BREEDERHQ VALIDATION TENANT CREDENTIALS - ${ENV_PREFIX[env]} ENVIRONMENT`,
    `═══════════════════════════════════════════════════════════════════════════════`,
    ``,
  ];

  for (const tenant of tenantDefs) {
    const user = tenantUsers[tenant.slug];
    const portalAccess = portalAccessDefs[tenant.slug];
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

    if (portalAccess) {
      lines.push(`  PORTAL ACCESS - CONTACT:`);
      lines.push(`    Name:     ${portalAccess.contactPortalUser.firstName} ${portalAccess.contactPortalUser.lastName}`);
      lines.push(`    Email:    ${getEnvEmail(portalAccess.contactPortalUser.emailBase, env)}`);
      lines.push(`    Password: ${portalAccess.contactPortalUser.password}`);
      lines.push(``);
      lines.push(`  PORTAL ACCESS - ORGANIZATION:`);
      lines.push(`    Name:     ${portalAccess.organizationPortalUser.firstName} ${portalAccess.organizationPortalUser.lastName}`);
      lines.push(`    Email:    ${getEnvEmail(portalAccess.organizationPortalUser.emailBase, env)}`);
      lines.push(`    Password: ${portalAccess.organizationPortalUser.password}`);
      lines.push(``);
    }

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

  // Add marketplace shoppers section
  lines.push(`═══════════════════════════════════════════════════════════════════════════════`);
  lines.push(`MARKETPLACE SHOPPERS (No tenant membership - consumer accounts)`);
  lines.push(`═══════════════════════════════════════════════════════════════════════════════`);
  lines.push(``);
  for (const shopper of marketplaceUsers) {
    lines.push(`  ${shopper.firstName} ${shopper.lastName}:`);
    lines.push(`    Email:       ${getEnvEmail(shopper.emailBase, env)}`);
    lines.push(`    Password:    ${shopper.password}`);
    lines.push(`    Description: ${shopper.description}`);
    lines.push(``);
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNICATIONS HUB - CONTACT META DEFINITIONS
// These define the enriched contact metadata for the Communications Hub
// ═══════════════════════════════════════════════════════════════════════════════

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'negotiating' | 'won' | 'lost' | 'inactive';

export interface ContactMetaDefinition {
  contactIndex: number;  // Index into tenant contacts array
  leadStatus: LeadStatus;
  // Waitlist info - if on waitlist
  waitlistPlanIndex?: number;  // Index into tenant breeding plans
  waitlistPosition?: number;
  waitlistStatus?: 'INQUIRY' | 'APPROVED' | 'DEPOSIT_PAID' | 'ALLOCATED';
  // Financial info
  hasActiveDeposit: boolean;
  depositAmountCents?: number;
  depositPlanIndex?: number;  // Index into breeding plans for deposit
  totalPurchasesCents: number;  // Lifetime value
  animalsOwned: number;
  // Communication tracking
  lastContactedDaysAgo: number | null;
}

// DEV Contact Meta - Different scenarios for testing
export const DEV_CONTACT_META: Record<string, ContactMetaDefinition[]> = {
  rivendell: [
    // Gandalf - VIP Repeat Buyer (high value customer)
    { contactIndex: 0, leadStatus: 'won', hasActiveDeposit: true, depositAmountCents: 50000, depositPlanIndex: 0, totalPurchasesCents: 1250000, animalsOwned: 3, lastContactedDaysAgo: 2 },
    // Aragorn - Active Waitlist Lead (on waitlist with deposit)
    { contactIndex: 1, leadStatus: 'qualified', waitlistPlanIndex: 0, waitlistPosition: 2, waitlistStatus: 'DEPOSIT_PAID', hasActiveDeposit: true, depositAmountCents: 50000, depositPlanIndex: 0, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: 5 },
    // Legolas - Fresh Prospect (new inquiry)
    { contactIndex: 2, leadStatus: 'new', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: null },
    // Gimli - Waitlisted Without Deposit
    { contactIndex: 3, leadStatus: 'contacted', waitlistPlanIndex: 1, waitlistPosition: 7, waitlistStatus: 'APPROVED', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: 14 },
    // Samwise - Past Customer (inactive)
    { contactIndex: 4, leadStatus: 'inactive', hasActiveDeposit: false, totalPurchasesCents: 350000, animalsOwned: 1, lastContactedDaysAgo: 120 },
  ],
  hogwarts: [
    // Dumbledore - VIP ($10k+ lifetime)
    { contactIndex: 0, leadStatus: 'won', hasActiveDeposit: true, depositAmountCents: 75000, depositPlanIndex: 0, totalPurchasesCents: 1500000, animalsOwned: 4, lastContactedDaysAgo: 1 },
    // McGonagall - Qualified lead on waitlist
    { contactIndex: 1, leadStatus: 'qualified', waitlistPlanIndex: 0, waitlistPosition: 1, waitlistStatus: 'DEPOSIT_PAID', hasActiveDeposit: true, depositAmountCents: 50000, depositPlanIndex: 0, totalPurchasesCents: 500000, animalsOwned: 1, lastContactedDaysAgo: 3 },
    // Newt - Contacted prospect
    { contactIndex: 2, leadStatus: 'contacted', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: 7 },
    // Luna - New inquiry
    { contactIndex: 3, leadStatus: 'new', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: null },
    // Charlie - Past customer checking in
    { contactIndex: 4, leadStatus: 'won', hasActiveDeposit: false, totalPurchasesCents: 800000, animalsOwned: 2, lastContactedDaysAgo: 45 },
  ],
  winterfell: [
    // Jon Snow - Active customer
    { contactIndex: 0, leadStatus: 'won', hasActiveDeposit: true, depositAmountCents: 100000, depositPlanIndex: 0, totalPurchasesCents: 600000, animalsOwned: 2, lastContactedDaysAgo: 4 },
    // Sansa - Waitlist position 3
    { contactIndex: 1, leadStatus: 'qualified', waitlistPlanIndex: 0, waitlistPosition: 3, waitlistStatus: 'APPROVED', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: 10 },
    // Arya - Negotiating
    { contactIndex: 2, leadStatus: 'negotiating', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: 2 },
    // Bran - New prospect
    { contactIndex: 3, leadStatus: 'new', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: null },
    // Tormund - Lost lead
    { contactIndex: 4, leadStatus: 'lost', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: 60 },
  ],
  'stark-tower': [
    // Steve Rogers - VIP repeat buyer
    { contactIndex: 0, leadStatus: 'won', hasActiveDeposit: true, depositAmountCents: 75000, depositPlanIndex: 0, totalPurchasesCents: 2000000, animalsOwned: 5, lastContactedDaysAgo: 1 },
    // Natasha - On waitlist with deposit
    { contactIndex: 1, leadStatus: 'qualified', waitlistPlanIndex: 1, waitlistPosition: 1, waitlistStatus: 'DEPOSIT_PAID', hasActiveDeposit: true, depositAmountCents: 50000, depositPlanIndex: 1, totalPurchasesCents: 350000, animalsOwned: 1, lastContactedDaysAgo: 6 },
    // Bruce - Contacted prospect
    { contactIndex: 2, leadStatus: 'contacted', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: 8 },
    // Thor - Inquiry stage on waitlist
    { contactIndex: 3, leadStatus: 'contacted', waitlistPlanIndex: 0, waitlistPosition: 5, waitlistStatus: 'INQUIRY', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: 12 },
    // Clint - Past customer
    { contactIndex: 4, leadStatus: 'won', hasActiveDeposit: false, totalPurchasesCents: 450000, animalsOwned: 1, lastContactedDaysAgo: 30 },
  ],
};

// PROD Contact Meta
export const PROD_CONTACT_META: Record<string, ContactMetaDefinition[]> = {
  arrakis: [
    // Duncan - VIP customer
    { contactIndex: 0, leadStatus: 'won', hasActiveDeposit: true, depositAmountCents: 100000, depositPlanIndex: 0, totalPurchasesCents: 1800000, animalsOwned: 4, lastContactedDaysAgo: 2 },
    // Stilgar - Active waitlist
    { contactIndex: 1, leadStatus: 'qualified', waitlistPlanIndex: 0, waitlistPosition: 2, waitlistStatus: 'DEPOSIT_PAID', hasActiveDeposit: true, depositAmountCents: 50000, depositPlanIndex: 0, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: 4 },
    // Chani - New prospect
    { contactIndex: 2, leadStatus: 'new', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: null },
    // Gurney - Waitlisted no deposit
    { contactIndex: 3, leadStatus: 'contacted', waitlistPlanIndex: 1, waitlistPosition: 4, waitlistStatus: 'APPROVED', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: 15 },
    // Thufir - Past customer
    { contactIndex: 4, leadStatus: 'inactive', hasActiveDeposit: false, totalPurchasesCents: 500000, animalsOwned: 1, lastContactedDaysAgo: 90 },
  ],
  starfleet: [
    // Riker - VIP
    { contactIndex: 0, leadStatus: 'won', hasActiveDeposit: true, depositAmountCents: 60000, depositPlanIndex: 0, totalPurchasesCents: 1200000, animalsOwned: 3, lastContactedDaysAgo: 1 },
    // Data - On waitlist
    { contactIndex: 1, leadStatus: 'qualified', waitlistPlanIndex: 0, waitlistPosition: 1, waitlistStatus: 'DEPOSIT_PAID', hasActiveDeposit: true, depositAmountCents: 50000, depositPlanIndex: 0, totalPurchasesCents: 400000, animalsOwned: 1, lastContactedDaysAgo: 5 },
    // Beverly - Contacted
    { contactIndex: 2, leadStatus: 'contacted', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: 9 },
    // Deanna - New inquiry
    { contactIndex: 3, leadStatus: 'new', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: null },
    // Worf - Past customer
    { contactIndex: 4, leadStatus: 'won', hasActiveDeposit: false, totalPurchasesCents: 700000, animalsOwned: 2, lastContactedDaysAgo: 40 },
  ],
  richmond: [
    // Rebecca - VIP
    { contactIndex: 0, leadStatus: 'won', hasActiveDeposit: true, depositAmountCents: 80000, depositPlanIndex: 0, totalPurchasesCents: 1600000, animalsOwned: 4, lastContactedDaysAgo: 3 },
    // Roy - On waitlist
    { contactIndex: 1, leadStatus: 'qualified', waitlistPlanIndex: 0, waitlistPosition: 2, waitlistStatus: 'APPROVED', hasActiveDeposit: false, totalPurchasesCents: 250000, animalsOwned: 1, lastContactedDaysAgo: 7 },
    // Keeley - Negotiating
    { contactIndex: 2, leadStatus: 'negotiating', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: 2 },
    // Jamie - New
    { contactIndex: 3, leadStatus: 'new', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: null },
    // Coach Beard - Inactive
    { contactIndex: 4, leadStatus: 'inactive', hasActiveDeposit: false, totalPurchasesCents: 300000, animalsOwned: 1, lastContactedDaysAgo: 100 },
  ],
  zion: [
    // Morpheus - VIP
    { contactIndex: 0, leadStatus: 'won', hasActiveDeposit: true, depositAmountCents: 75000, depositPlanIndex: 0, totalPurchasesCents: 1400000, animalsOwned: 3, lastContactedDaysAgo: 2 },
    // Trinity - Waitlist with deposit
    { contactIndex: 1, leadStatus: 'qualified', waitlistPlanIndex: 1, waitlistPosition: 1, waitlistStatus: 'DEPOSIT_PAID', hasActiveDeposit: true, depositAmountCents: 50000, depositPlanIndex: 1, totalPurchasesCents: 350000, animalsOwned: 1, lastContactedDaysAgo: 4 },
    // Tank - Contacted
    { contactIndex: 2, leadStatus: 'contacted', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: 11 },
    // Niobe - New
    { contactIndex: 3, leadStatus: 'new', hasActiveDeposit: false, totalPurchasesCents: 0, animalsOwned: 0, lastContactedDaysAgo: null },
    // Oracle - Past customer
    { contactIndex: 4, leadStatus: 'won', hasActiveDeposit: false, totalPurchasesCents: 600000, animalsOwned: 2, lastContactedDaysAgo: 55 },
  ],
};

export function getContactMeta(env: Environment): Record<string, ContactMetaDefinition[]> {
  return env === 'prod' ? PROD_CONTACT_META : DEV_CONTACT_META;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNICATIONS HUB - MESSAGE DEFINITIONS
// Realistic email and DM conversations for the Communications Hub
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmailDefinition {
  contactIndex: number;  // Index into tenant contacts array
  direction: 'inbound' | 'outbound';
  subject: string;
  body: string;
  status: 'sent' | 'delivered' | 'read' | 'unread';
  isRead: boolean;
  flagged: boolean;
  archived: boolean;
  daysAgo: number;  // How many days ago this email was sent
  hasAttachment?: boolean;
}

export interface DMThreadDefinition {
  // For marketplace DMs from shoppers
  marketplaceUserIndex?: number;  // Index into MARKETPLACE_USERS
  // Or for DMs from contacts
  contactIndex?: number;  // Index into tenant contacts
  subject: string;
  inquiryType: 'MARKETPLACE' | 'WAITLIST' | 'GENERAL';
  flagged: boolean;
  archived: boolean;
  messages: DMMessageDefinition[];
}

export interface DMMessageDefinition {
  direction: 'inbound' | 'outbound';
  body: string;
  daysAgo: number;
  hoursAgo?: number;  // For same-day messages
}

export interface DraftDefinition {
  channel: 'email' | 'dm';
  contactIndex?: number;
  subject?: string;
  body: string;
  daysAgo: number;
}

// DEV Email Conversations
export const DEV_EMAILS: Record<string, EmailDefinition[]> = {
  rivendell: [
    // Gandalf - VIP customer checking in
    { contactIndex: 0, direction: 'inbound', subject: 'Update on Shadowmere', body: 'Elrond, I wanted to let you know Shadowmere is doing wonderfully. His coat is magnificent and his temperament is exactly as you described. I may be interested in another companion for him soon.', status: 'unread', isRead: false, flagged: true, archived: false, daysAgo: 0 },
    { contactIndex: 0, direction: 'outbound', subject: 'RE: Update on Shadowmere', body: 'Gandalf, wonderful to hear! I have a promising young filly from the Mearas line who would be perfect. She has excellent bloodlines and a calm disposition. Would you like me to send photos?', status: 'sent', isRead: true, flagged: false, archived: false, daysAgo: 2 },
    // Aragorn - Waitlist confirmation
    { contactIndex: 1, direction: 'outbound', subject: 'Welcome to the Spring 2026 Waitlist!', body: 'Dear Aragorn, Great news - you\'re now #2 on our Spring 2026 Mearas litter waitlist! I\'ve attached our puppy contract for your review. Your deposit of $500 has been received. I\'ll send updates as we get closer to the expected date.', status: 'delivered', isRead: true, flagged: false, archived: false, daysAgo: 5, hasAttachment: true },
    { contactIndex: 1, direction: 'inbound', subject: 'RE: Welcome to the Spring 2026 Waitlist!', body: 'Thank you, Elrond. I am honored to be on your waitlist. Arwen speaks highly of your breeding program. Looking forward to updates.', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 4 },
    // Legolas - New inquiry (unread)
    { contactIndex: 2, direction: 'inbound', subject: 'Inquiry about Elven Hounds', body: 'Greetings! I found your program through the marketplace and I\'m very interested in your Elven Hound breeding program. Do you have any puppies available or upcoming litters? I have extensive experience with hounds in Mirkwood.', status: 'unread', isRead: false, flagged: false, archived: false, daysAgo: 0 },
    // Gimli - Follow-up on waitlist
    { contactIndex: 3, direction: 'outbound', subject: 'Waitlist Update - Position #7', body: 'Dear Gimli, Just a quick update on your waitlist position. You\'re currently #7 for our Fall litter. If you\'d like to secure your spot with a deposit, please let me know and I\'ll send the payment link.', status: 'sent', isRead: true, flagged: false, archived: false, daysAgo: 14 },
    { contactIndex: 3, direction: 'inbound', subject: 'RE: Waitlist Update - Position #7', body: 'Elrond, I need to discuss this with my clan first. Mountain folk are particular about these things. I\'ll get back to you within the fortnight.', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 12 },
    // Samwise - Old conversation (archived)
    { contactIndex: 4, direction: 'inbound', subject: 'Bill the Pony is doing great!', body: 'Mr. Elrond, Just wanted to send you an update. Bill is the best pony in the whole Shire! He loves apples and the gaffer says he\'s never seen such a well-mannered animal. Thank you again!', status: 'read', isRead: true, flagged: false, archived: true, daysAgo: 120 },
    { contactIndex: 4, direction: 'outbound', subject: 'RE: Bill the Pony is doing great!', body: 'Sam, so wonderful to hear! Bill came from excellent stock. Please give him a carrot from me. Let me know if you ever need anything.', status: 'sent', isRead: true, flagged: false, archived: true, daysAgo: 118 },
  ],
  hogwarts: [
    // Dumbledore - Health question (flagged, needs response)
    { contactIndex: 0, direction: 'inbound', subject: 'Question about Phoenix', body: 'Hagrid, Phoenix has been a bit off his food lately. He\'s 2 years old now. Is this normal behavior? Should I be concerned? He seems otherwise healthy but I want to make sure.', status: 'unread', isRead: false, flagged: true, archived: false, daysAgo: 0 },
    // McGonagall - Deposit received
    { contactIndex: 1, direction: 'outbound', subject: 'Deposit Received - Next Steps', body: 'Dear Professor McGonagall, I\'ve received your £500 deposit - thank you! You\'re now confirmed for a kitten from our Spring litter. Expected birth date is around March 15th. I\'ll send weekly updates once the kittens arrive!', status: 'delivered', isRead: true, flagged: false, archived: false, daysAgo: 3 },
    { contactIndex: 1, direction: 'inbound', subject: 'RE: Deposit Received - Next Steps', body: 'Excellent news, Hagrid. I look forward to the updates. I\'ve been preparing a space in my quarters. The students are quite excited as well.', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 2 },
    // Newt - Interest in magical creatures
    { contactIndex: 2, direction: 'inbound', subject: 'Interest in your breeding program', body: 'Dear Hagrid, I\'ve heard wonderful things about your creature care program. I\'m particularly interested in any unusual specimens you might have. My research could benefit greatly from your expertise.', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 7 },
    { contactIndex: 2, direction: 'outbound', subject: 'RE: Interest in your breeding program', body: 'Newt! What an honor! I\'ve got some right interesting creatures here. Would you like to visit? I can show you our breeding program and discuss potential collaborations.', status: 'sent', isRead: true, flagged: false, archived: false, daysAgo: 6 },
    // Luna - New inquiry
    { contactIndex: 3, direction: 'inbound', subject: 'Do you have any Kneazles?', body: 'Hello! I\'m looking for a Kneazle companion. Daddy says they\'re excellent at detecting suspicious persons, which would be useful for our expeditions. Do you breed them?', status: 'unread', isRead: false, flagged: false, archived: false, daysAgo: 1 },
    // Charlie - Update on dragons (archived)
    { contactIndex: 4, direction: 'inbound', subject: 'Norbert update from Romania', body: 'Hagrid! Norbert (well, Norberta actually) is doing brilliantly. She\'s one of our best mothers now. Thought you\'d like to know. The reserve is considering expanding our breeding program.', status: 'read', isRead: true, flagged: false, archived: true, daysAgo: 45 },
  ],
  winterfell: [
    // Jon - Active customer communication
    { contactIndex: 0, direction: 'outbound', subject: 'Ghost\'s sibling availability', body: 'Jon, I wanted to reach out about a new Direwolf litter expected this spring. Given how well Ghost has worked out, I thought you might be interested in another from the same line.', status: 'delivered', isRead: true, flagged: false, archived: false, daysAgo: 4 },
    { contactIndex: 0, direction: 'inbound', subject: 'RE: Ghost\'s sibling availability', body: 'Lord Stark, Ghost has been invaluable at the Wall. The men respect him greatly. I would be honored to have another of his line. What would the cost be?', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 3 },
    // Sansa - Waitlist inquiry
    { contactIndex: 1, direction: 'inbound', subject: 'Question about my waitlist position', body: 'Father, I noticed I\'m #3 on the waitlist. When do you expect the litter? I\'ve been so eager since Lady... I\'d love to have another companion.', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 10 },
    { contactIndex: 1, direction: 'outbound', subject: 'RE: Question about my waitlist position', body: 'Sansa, the litter is expected in late spring. You\'ll have first choice of the females. I promise this one will stay with you.', status: 'sent', isRead: true, flagged: false, archived: false, daysAgo: 9 },
    // Arya - Negotiating
    { contactIndex: 2, direction: 'inbound', subject: 'I want a wolf like Nymeria', body: 'Can I have one? I don\'t have much gold but I can work for it. I\'m good at cleaning kennels. Please?', status: 'unread', isRead: false, flagged: true, archived: false, daysAgo: 2 },
    // Bran - New inquiry
    { contactIndex: 3, direction: 'inbound', subject: 'The wolves call to me', body: 'Father, in my dreams I see wolves. Many wolves. I believe one is meant for me. The three-eyed raven showed me.', status: 'unread', isRead: false, flagged: false, archived: false, daysAgo: 0 },
    // Tormund - Lost lead (archived)
    { contactIndex: 4, direction: 'inbound', subject: 'HAR! Your wolves are too small!', body: 'STARK! I\'ve seen your wolves. Impressive to southerners maybe! But north of the Wall we have REAL beasts! HAR! Maybe I\'ll take one anyway. For a pet.', status: 'read', isRead: true, flagged: false, archived: true, daysAgo: 60 },
    { contactIndex: 4, direction: 'outbound', subject: 'RE: HAR! Your wolves are too small!', body: 'Tormund, our Direwolves are the finest in all the Seven Kingdoms. Perhaps a demonstration would change your mind?', status: 'sent', isRead: true, flagged: false, archived: true, daysAgo: 58 },
  ],
  'stark-tower': [
    // Steve - VIP follow-up
    { contactIndex: 0, direction: 'inbound', subject: 'Request for puppy photos', body: 'Tony, could you send some photos of the current litter? I\'d like to share them with the team. Bucky is particularly interested.', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 1 },
    { contactIndex: 0, direction: 'outbound', subject: 'RE: Request for puppy photos', body: 'Cap, attached are the latest photos from Week 4. The little guy with the blue collar reminds me of you - stubborn but loyal. JARVIS can set up a video call if you want to see them live.', status: 'sent', isRead: true, flagged: false, archived: false, daysAgo: 0, hasAttachment: true },
    // Natasha - Waitlist update
    { contactIndex: 1, direction: 'outbound', subject: 'Your Waitlist Position Update', body: 'Natasha, Good news - you\'ve moved to position #1 on the Asgardian Horse waitlist! The expected foaling date is June 20th. Let me know if you need anything.', status: 'delivered', isRead: true, flagged: false, archived: false, daysAgo: 6 },
    { contactIndex: 1, direction: 'inbound', subject: 'RE: Your Waitlist Position Update', body: 'Perfect timing. I\'ve been preparing the stable at the compound. Will you need help with transport?', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 5 },
    // Bruce - General inquiry
    { contactIndex: 2, direction: 'inbound', subject: 'Calm temperament puppies?', body: 'Hi Tony, I\'m looking for a companion with a very calm temperament. Given my... condition... I need something that won\'t get too excited. Any recommendations?', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 8 },
    { contactIndex: 2, direction: 'outbound', subject: 'RE: Calm temperament puppies?', body: 'Bruce, I have just the thing. Our Cavaliers are bred specifically for calm, therapeutic temperaments. JARVIS has run the analysis - perfect match for your needs. Want to meet them?', status: 'sent', isRead: true, flagged: false, archived: false, daysAgo: 7 },
    // Thor - Inquiry about horses
    { contactIndex: 3, direction: 'inbound', subject: 'A MIGHTY STEED FOR A MIGHTY WARRIOR', body: 'STARK! I require a steed worthy of the God of Thunder! Something that won\'t flee at the sound of Mjolnir! Can your program provide such a creature?', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 12 },
    { contactIndex: 3, direction: 'outbound', subject: 'RE: A MIGHTY STEED FOR A MIGHTY WARRIOR', body: 'Thor, funny you should ask. We\'ve been breeding Lipizzans that can handle... unusual circumstances. I\'ve added you to the waitlist at position #5. No deposit required from an Avenger.', status: 'sent', isRead: true, flagged: false, archived: false, daysAgo: 11 },
    // Clint - Past customer update (archived)
    { contactIndex: 4, direction: 'inbound', subject: 'Lucky loves the farm', body: 'Hey Tony, just wanted to let you know Lucky is living his best life on the farm. The kids adore him. Best decision I ever made. Thanks again.', status: 'read', isRead: true, flagged: false, archived: true, daysAgo: 30 },
  ],
};

// DEV DM Threads (Marketplace conversations)
export const DEV_DM_THREADS: Record<string, DMThreadDefinition[]> = {
  rivendell: [
    // Alice Shopper - New marketplace inquiry
    {
      marketplaceUserIndex: 0,
      subject: 'Interested in Golden Retriever listing',
      inquiryType: 'MARKETPLACE',
      flagged: false,
      archived: false,
      messages: [
        { direction: 'inbound', body: 'Hi! I saw your Golden Retriever listing on the marketplace. Is the male puppy with the green collar still available? My family has been looking for the perfect addition!', daysAgo: 0, hoursAgo: 3 },
        { direction: 'outbound', body: 'Hello Alice! Yes, he\'s still available. He\'s such a sweet boy - very calm temperament. Would you like to schedule a video call to meet him?', daysAgo: 0, hoursAgo: 1 },
      ],
    },
    // Bob Buyer - Negotiation thread
    {
      marketplaceUserIndex: 1,
      subject: 'Question about shipping',
      inquiryType: 'MARKETPLACE',
      flagged: true,
      archived: false,
      messages: [
        { direction: 'inbound', body: 'Do you ship puppies? I\'m in Colorado.', daysAgo: 3 },
        { direction: 'outbound', body: 'Yes, we offer flight nanny service for $400. We never cargo ship - the safety of our puppies is paramount.', daysAgo: 3 },
        { direction: 'inbound', body: 'That sounds great. What\'s the total cost including the flight nanny?', daysAgo: 2 },
        { direction: 'outbound', body: 'The puppy is $2,500 + $400 flight nanny = $2,900 total. I can send you a detailed breakdown if you\'d like.', daysAgo: 2 },
        { direction: 'inbound', body: 'Yes please, and do you have references from previous out-of-state buyers?', daysAgo: 1 },
      ],
    },
  ],
  hogwarts: [
    // Carol Collector - Rare breed inquiry
    {
      marketplaceUserIndex: 2,
      subject: 'Rare Kneazle Mix inquiry',
      inquiryType: 'MARKETPLACE',
      flagged: false,
      archived: false,
      messages: [
        { direction: 'inbound', body: 'I\'m a collector of rare magical creature breeds. Your Kneazle mix program caught my eye. Are these purebred or crosses?', daysAgo: 5 },
        { direction: 'outbound', body: 'Wonderful to hear from a fellow enthusiast! These are half-Kneazle, half-British Shorthair. They retain the Kneazle intelligence and suspicious person detection while being more family-friendly.', daysAgo: 4 },
        { direction: 'inbound', body: 'Fascinating! What documentation do you provide regarding lineage?', daysAgo: 4 },
      ],
    },
  ],
  winterfell: [
    // Dave Dealer - Professional breeder inquiry
    {
      marketplaceUserIndex: 3,
      subject: 'Stud service inquiry',
      inquiryType: 'MARKETPLACE',
      flagged: true,
      archived: false,
      messages: [
        { direction: 'inbound', body: 'I\'m a professional breeder looking for quality studs. I\'ve heard excellent things about your Direwolf line. Do you offer stud services?', daysAgo: 7 },
        { direction: 'outbound', body: 'We do offer limited stud services for approved breeding programs. Could you tell me more about your program? We\'re selective about partnerships to maintain bloodline quality.', daysAgo: 6 },
        { direction: 'inbound', body: 'Certainly. I run Northern Breeds Alliance based in Alaska. We\'ve been breeding Malamutes for 15 years with a focus on working dogs. I can send our health testing protocols.', daysAgo: 5 },
      ],
    },
  ],
  'stark-tower': [
    // Alice - Casual inquiry
    {
      marketplaceUserIndex: 0,
      subject: 'First time puppy owner question',
      inquiryType: 'MARKETPLACE',
      flagged: false,
      archived: false,
      messages: [
        { direction: 'inbound', body: 'Hi! I\'ve never owned a dog before. Are Cavaliers good for first-time owners?', daysAgo: 2 },
        { direction: 'outbound', body: 'Cavaliers are excellent for first-time owners! They\'re gentle, adaptable, and love to cuddle. They do need regular grooming and companionship though - they don\'t like being left alone for long periods.', daysAgo: 2 },
        { direction: 'inbound', body: 'I work from home so that should be perfect! What\'s the application process?', daysAgo: 1 },
        { direction: 'outbound', body: 'Great to hear! I\'ll send you our application form. It includes questions about your home setup, experience, and what you\'re looking for. We typically schedule a video call after reviewing applications.', daysAgo: 1 },
      ],
    },
    // Bob - Show quality inquiry
    {
      marketplaceUserIndex: 1,
      subject: 'Show quality Ragdolls?',
      inquiryType: 'MARKETPLACE',
      flagged: false,
      archived: true,
      messages: [
        { direction: 'inbound', body: 'I\'m looking for show quality Ragdolls. Do you have any with championship potential?', daysAgo: 20 },
        { direction: 'outbound', body: 'We do occasionally have show-quality kittens. Our last litter produced two that went on to earn titles. Are you an experienced exhibitor?', daysAgo: 19 },
        { direction: 'inbound', body: 'Yes, I\'ve shown cats for 10 years. Currently looking to add a Ragdoll to my program.', daysAgo: 18 },
        { direction: 'outbound', body: 'Excellent! I don\'t have any available right now but I\'ll add you to our show-quality notification list. Expected litter in 3 months.', daysAgo: 17 },
      ],
    },
  ],
};

// DEV Drafts
export const DEV_DRAFTS: Record<string, DraftDefinition[]> = {
  rivendell: [
    { channel: 'email', contactIndex: 2, subject: 'RE: Inquiry about Elven Hounds', body: 'Dear Legolas, Thank you for your interest in our Elven Hound program. We currently have...', daysAgo: 0 },
  ],
  hogwarts: [
    { channel: 'email', contactIndex: 0, subject: 'RE: Question about Phoenix', body: 'Dear Professor Dumbledore, That\'s actually quite common for cats around that age. I\'d recommend trying...', daysAgo: 0 },
  ],
  winterfell: [
    { channel: 'email', contactIndex: 2, subject: 'RE: I want a wolf like Nymeria', body: 'Arya, I understand how much you want a direwolf. Let\'s discuss this when...', daysAgo: 0 },
  ],
  'stark-tower': [
    { channel: 'dm', contactIndex: 2, body: 'Bruce, I\'ve been thinking about your situation. There\'s actually a new therapy dog certification program that...', daysAgo: 1 },
  ],
};

// PROD versions follow the same pattern
export const PROD_EMAILS: Record<string, EmailDefinition[]> = {
  arrakis: [
    { contactIndex: 0, direction: 'inbound', subject: 'Shai-Hulud update', body: 'My Duke, the hound Shai-Hulud has adapted well to desert conditions. His training as a sandworm spotter has been invaluable. The Fremen are impressed.', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 2 },
    { contactIndex: 0, direction: 'outbound', subject: 'RE: Shai-Hulud update', body: 'Duncan, excellent news. His bloodline carries the best traits for desert survival. I have a sibling from the same litter if you\'re interested in expanding the program.', status: 'sent', isRead: true, flagged: false, archived: false, daysAgo: 1 },
    { contactIndex: 1, direction: 'outbound', subject: 'Waitlist Confirmation', body: 'Stilgar, You are now #2 on our Spring litter waitlist. Your deposit has been received. The spice must flow, and so shall quality breeding.', status: 'delivered', isRead: true, flagged: false, archived: false, daysAgo: 4, hasAttachment: true },
    { contactIndex: 2, direction: 'inbound', subject: 'Interest in desert breeds', body: 'Muad\'Dib, I seek a companion suited to the deep desert. What breeds do you recommend for a Fremen lifestyle?', status: 'unread', isRead: false, flagged: false, archived: false, daysAgo: 0 },
    { contactIndex: 3, direction: 'outbound', subject: 'Waitlist Position Update', body: 'Gurney, You\'re currently #4 on our waitlist. Let me know when you\'re ready to place a deposit to secure your position.', status: 'sent', isRead: true, flagged: false, archived: false, daysAgo: 15 },
    { contactIndex: 4, direction: 'inbound', subject: 'Old friend checking in', body: 'My Lord, it has been too long. The mentat calculations suggest it\'s time for a new companion. What do you have available?', status: 'read', isRead: true, flagged: false, archived: true, daysAgo: 90 },
  ],
  starfleet: [
    { contactIndex: 0, direction: 'inbound', subject: 'Number One needs a friend', body: 'Captain, my previous companion has retired to Risa. I\'m looking for a new shipboard pet. Any recommendations?', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 1 },
    { contactIndex: 0, direction: 'outbound', subject: 'RE: Number One needs a friend', body: 'Will, I have just the thing. A new litter of station cats - bred for zero-G adaptability and calm temperament. Perfect for the Enterprise.', status: 'sent', isRead: true, flagged: false, archived: false, daysAgo: 0 },
    { contactIndex: 1, direction: 'outbound', subject: 'Your Waitlist Position', body: 'Data, You\'re #1 on our waiting list. Fascinating that an android would want a pet, but Spot clearly changed that perspective.', status: 'delivered', isRead: true, flagged: false, archived: false, daysAgo: 5 },
    { contactIndex: 2, direction: 'inbound', subject: 'Medical question about cats', body: 'Jean-Luc, one of our crew members is interested in hypoallergenic breeds. Do you have any recommendations from your program?', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 9 },
    { contactIndex: 3, direction: 'inbound', subject: 'Empathic animals?', body: 'Captain, are there any breeds known for their empathic sensitivity? I feel it would be beneficial for counseling sessions.', status: 'unread', isRead: false, flagged: true, archived: false, daysAgo: 0 },
    { contactIndex: 4, direction: 'inbound', subject: 'Klingon-compatible breeds?', body: 'Picard. Klingons do not keep pets. But... for my son Alexander, perhaps something fierce yet loyal?', status: 'read', isRead: true, flagged: false, archived: true, daysAgo: 40 },
  ],
  richmond: [
    { contactIndex: 0, direction: 'inbound', subject: 'Another championship dog?', body: 'Ted, our last one was such a success for team morale. The boys are asking if we can get another mascot for the new season.', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 3 },
    { contactIndex: 0, direction: 'outbound', subject: 'RE: Another championship dog?', body: 'Rebecca! Believe in yourself, believe in the team, believe in the puppy! I\'ve got a golden with the heart of a champion ready for you.', status: 'sent', isRead: true, flagged: false, archived: false, daysAgo: 2 },
    { contactIndex: 1, direction: 'inbound', subject: 'Looking for something tough', body: 'Ted. Need a dog. Something that doesn\'t take any s***. Like me.', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 7 },
    { contactIndex: 2, direction: 'inbound', subject: 'PR opportunity with puppies?', body: 'Hi Ted! Keeley here. I was thinking - puppy photoshoots with the players could be great for our social media. Do you have any cute puppies available for a session?', status: 'unread', isRead: false, flagged: false, archived: false, daysAgo: 2 },
    { contactIndex: 3, direction: 'inbound', subject: 'Oi Ted', body: 'Ted mate, me mum wants a dog. Something that looks good on Instagram yeah? What you got?', status: 'unread', isRead: false, flagged: false, archived: false, daysAgo: 0 },
    { contactIndex: 4, direction: 'inbound', subject: 'Chess partner needed', body: 'Ted. Looking for an intelligent companion. Preferably one that can appreciate strategic thinking. Do dogs play chess?', status: 'read', isRead: true, flagged: false, archived: true, daysAgo: 100 },
  ],
  zion: [
    { contactIndex: 0, direction: 'inbound', subject: 'The One needs a companion', body: 'Neo requires a companion for his meditation sessions. Something calm, knowing. What do you recommend?', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 2 },
    { contactIndex: 0, direction: 'outbound', subject: 'RE: The One needs a companion', body: 'Morpheus, I have a black cat with an uncanny ability to sense the Matrix. Perfect for meditation. The Oracle has approved.', status: 'sent', isRead: true, flagged: false, archived: false, daysAgo: 1 },
    { contactIndex: 1, direction: 'outbound', subject: 'Waitlist Position #1', body: 'Trinity, You\'ve reached the top of our waitlist. Your patience has paid off. The companion you seek is almost ready.', status: 'delivered', isRead: true, flagged: false, archived: false, daysAgo: 4 },
    { contactIndex: 2, direction: 'inbound', subject: 'Need a ship cat', body: 'Neo, the Logos needs a ship cat for morale. The crew has been tense since the last EMP discharge. What can you provide?', status: 'read', isRead: true, flagged: false, archived: false, daysAgo: 11 },
    { contactIndex: 3, direction: 'inbound', subject: 'My ship needs a companion', body: 'The Nebuchadnezzar II is in need of a ship\'s animal. Something that can handle the electrical systems without getting spooked.', status: 'unread', isRead: false, flagged: false, archived: false, daysAgo: 0 },
    { contactIndex: 4, direction: 'inbound', subject: 'I foresaw this message', body: 'Neo, I knew you\'d start a breeding program. The cookies are ready, and so is my application for a companion.', status: 'read', isRead: true, flagged: false, archived: true, daysAgo: 55 },
  ],
};

export const PROD_DM_THREADS: Record<string, DMThreadDefinition[]> = {
  arrakis: [
    {
      marketplaceUserIndex: 0,
      subject: 'Desert-adapted puppies?',
      inquiryType: 'MARKETPLACE',
      flagged: false,
      archived: false,
      messages: [
        { direction: 'inbound', body: 'Hello! I live in Arizona and I\'m looking for dogs that can handle extreme heat. I saw you specialize in desert breeds?', daysAgo: 2 },
        { direction: 'outbound', body: 'Yes! Our Salukis are specifically bred for hot, arid climates. They\'ve been the dogs of desert peoples for thousands of years.', daysAgo: 1 },
      ],
    },
  ],
  starfleet: [
    {
      marketplaceUserIndex: 1,
      subject: 'Exotic Shorthair availability',
      inquiryType: 'MARKETPLACE',
      flagged: true,
      archived: false,
      messages: [
        { direction: 'inbound', body: 'I\'m a longtime Star Trek fan and I heard your cattery is themed after the show. Do you have any cats like Spot?', daysAgo: 4 },
        { direction: 'outbound', body: 'You\'re in the right place! We breed Exotic Shorthairs just like Spot. Current litter has two orange tabbies available.', daysAgo: 3 },
        { direction: 'inbound', body: 'Perfect! What\'s the adoption process?', daysAgo: 2 },
      ],
    },
  ],
  richmond: [
    {
      marketplaceUserIndex: 2,
      subject: 'Football mascot dogs?',
      inquiryType: 'MARKETPLACE',
      flagged: false,
      archived: false,
      messages: [
        { direction: 'inbound', body: 'I run a small football club and we\'re looking for a mascot dog. Do you have any that are good with crowds?', daysAgo: 6 },
        { direction: 'outbound', body: 'Absolutely! Our Goldens are trained to handle crowds and noise. They\'ve been to actual AFC Richmond matches!', daysAgo: 5 },
      ],
    },
  ],
  zion: [
    {
      marketplaceUserIndex: 3,
      subject: 'Black cats for adoption',
      inquiryType: 'MARKETPLACE',
      flagged: false,
      archived: false,
      messages: [
        { direction: 'inbound', body: 'I\'m specifically looking for solid black cats. Do you have any available or upcoming?', daysAgo: 3 },
        { direction: 'outbound', body: 'We specialize in Bombay cats - the "parlor panthers". All black, golden eyes. We have a litter due next month.', daysAgo: 2 },
        { direction: 'inbound', body: 'That sounds perfect! Can I get on the waitlist?', daysAgo: 1 },
      ],
    },
  ],
};

export const PROD_DRAFTS: Record<string, DraftDefinition[]> = {
  arrakis: [
    { channel: 'email', contactIndex: 2, subject: 'RE: Interest in desert breeds', body: 'Chani, For the deep desert, I recommend our Saluki line. They\'ve been bred for...', daysAgo: 0 },
  ],
  starfleet: [
    { channel: 'email', contactIndex: 3, subject: 'RE: Empathic animals?', body: 'Counselor Troi, There are some breeds known for emotional sensitivity. Cavalier King Charles Spaniels in particular...', daysAgo: 0 },
  ],
  richmond: [],
  zion: [
    { channel: 'dm', contactIndex: 3, body: 'Niobe, I understand the need for a reliable ship companion. Our cats are trained to handle...', daysAgo: 0 },
  ],
};

// Helper functions
export function getEmails(env: Environment): Record<string, EmailDefinition[]> {
  return env === 'prod' ? PROD_EMAILS : DEV_EMAILS;
}

export function getDMThreads(env: Environment): Record<string, DMThreadDefinition[]> {
  return env === 'prod' ? PROD_DM_THREADS : DEV_DM_THREADS;
}

export function getDrafts(env: Environment): Record<string, DraftDefinition[]> {
  return env === 'prod' ? PROD_DRAFTS : DEV_DRAFTS;
}
