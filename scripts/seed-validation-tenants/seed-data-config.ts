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
  { name: 'Huan the Great', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 0, birthYear: 2012, testProvider: 'Embark',
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
  { name: 'Luthien Tinuviel', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 0, birthYear: 2012, testProvider: 'Embark',
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
  { name: 'Oromë Hunter', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 0, birthYear: 2012, testProvider: 'Embark',
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
  { name: 'Vána Evergreen', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 0, birthYear: 2013, testProvider: 'Embark',
    notes: 'Founder dam Line B. DM Carrier, EIC Clear.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'd', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('EIC', 'Exercise-Induced Collapse', 'Clear')]
    }
  },

  // === Generation 1 - Children of Founders ===
  { name: 'Carcharoth', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 1, sireRef: 'Huan the Great', damRef: 'Luthien Tinuviel', birthYear: 2014, testProvider: 'Embark',
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
  { name: 'Tevildo', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 1, sireRef: 'Huan the Great', damRef: 'Luthien Tinuviel', birthYear: 2014, testProvider: 'Embark',
    notes: 'Daughter of Huan × Luthien (Line A). Full sister to Carcharoth.',
    coiTestScenario: 'Gen 1 Line A - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear'), healthLocus('EIC', 'Exercise-Induced Collapse', 'Clear')]
    }
  },
  { name: 'Nahar Hound', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 1, sireRef: 'Oromë Hunter', damRef: 'Vána Evergreen', birthYear: 2015, testProvider: 'Embark',
    notes: 'Son of Oromë × Vána (Line B). DM Carrier.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'aw', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('EIC', 'Exercise-Induced Collapse', 'N/m')]
    }
  },
  { name: 'Tilion Moonhound', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 1, sireRef: 'Oromë Hunter', damRef: 'Vána Evergreen', birthYear: 2015, testProvider: 'Embark',
    notes: 'Daughter of Oromë × Vána (Line B). Full sister to Nahar Hound.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'd', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('EIC', 'Exercise-Induced Collapse', 'Clear')]
    }
  },

  // === Generation 2 - COUSIN MATING (Line A × Line B) ===
  { name: 'Draugluin', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 2, sireRef: 'Carcharoth', damRef: 'Tilion Moonhound', birthYear: 2017, testProvider: 'Embark',
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
  { name: 'Thuringwethil', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 2, sireRef: 'Nahar Hound', damRef: 'Tevildo', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line B sire × Line A dam. Cross between lines. DM Carrier, EIC Carrier - DOUBLE CARRIER WARNING!',
    coiTestScenario: 'Gen 2 outcross - COI ~0% (unrelated lines)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'aw', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('EIC', 'Exercise-Induced Collapse', 'N/m')]
    }
  },

  // === Generation 3 - HALF-SIBLING MATING (shared grandparent Huan) ===
  { name: 'Garm', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 3, sireRef: 'Draugluin', damRef: 'Thuringwethil', birthYear: 2019, testProvider: 'Embark',
    notes: 'Both parents share Huan the Great as grandparent. MODERATE COI. DM Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 3 half-cousin mating - COI ~6.25% (shared great-grandparent)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('EIC', 'Exercise-Induced Collapse', 'N/m')]
    }
  },
  { name: 'Werewolf of Tol Sirion', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 3, sireRef: 'Draugluin', damRef: 'Thuringwethil', birthYear: 2019, testProvider: 'Embark',
    notes: 'Full sister to Garm. MODERATE COI. Lucked out - DM Clear!',
    coiTestScenario: 'Gen 3 half-cousin mating - COI ~6.25% (shared great-grandparent)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'aw', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'd', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear'), healthLocus('EIC', 'Exercise-Induced Collapse', 'Clear')]
    }
  },

  // === Generation 4 - FULL SIBLING MATING (Garm × Werewolf = HIGH COI) ===
  { name: 'Fenrir', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 4, sireRef: 'Garm', damRef: 'Werewolf of Tol Sirion', birthYear: 2021, testProvider: 'Embark',
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
  { name: 'Sköll', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 4, sireRef: 'Garm', damRef: 'Werewolf of Tol Sirion', birthYear: 2021, testProvider: 'Embark',
    notes: 'Full sister to Fenrir. HIGH COI ~25%. DM Clear.',
    coiTestScenario: 'Gen 4 full sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'aw', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear'), healthLocus('EIC', 'Exercise-Induced Collapse', 'N/m')]
    }
  },

  // === Generation 5 - ANOTHER FULL SIBLING MATING (CRITICAL COI) ===
  { name: 'Hati', species: 'DOG', sex: 'MALE', breed: 'German Shepherd', generation: 5, sireRef: 'Fenrir', damRef: 'Sköll', birthYear: 2023, testProvider: 'Embark',
    notes: 'PARENTS ARE FULL SIBLINGS! CRITICAL COI ~37.5%. This is a linebreeding test case.',
    coiTestScenario: 'Gen 5 consecutive sibling matings - COI ~37.5% (CRITICAL)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('K', 'Black Extension', 'ky', 'ky')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('EIC', 'Exercise-Induced Collapse', 'N/m')]
    }
  },
  { name: 'Mánagarm', species: 'DOG', sex: 'FEMALE', breed: 'German Shepherd', generation: 5, sireRef: 'Fenrir', damRef: 'Sköll', birthYear: 2023, testProvider: 'Embark',
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
  { name: 'Shadowfax', species: 'HORSE', sex: 'MALE', breed: 'Andalusian', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
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
  { name: 'Nahar', species: 'HORSE', sex: 'FEMALE', breed: 'Andalusian', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
    notes: 'Steed of Oromë. OLWS Carrier - DO NOT BREED TO SHADOWFAX (25% lethal white)!',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'g'), locus('Cr', 'Cream', 'n', 'n')],
      health: [healthLocus('OLWS', 'Lethal White Overo Syndrome', 'O/n')]
    }
  },
  { name: 'Asfaloth', species: 'HORSE', sex: 'MALE', breed: 'Andalusian', generation: 0, birthYear: 2013, testProvider: 'UC Davis VGL',
    notes: "Glorfindel's white steed. OLWS Clear - safe to breed to carriers.",
    genetics: {
      coatColor: [locus('E', 'Extension', 'e', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'g', 'g'), locus('Cr', 'Cream', 'Cr', 'Cr')],
      health: [healthLocus('OLWS', 'Lethal White Overo Syndrome', 'n/n')]
    }
  },
  { name: 'Felaróf', species: 'HORSE', sex: 'MALE', breed: 'Andalusian', generation: 1, sireRef: 'Shadowfax', damRef: 'Nahar', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'First Mearas. OLWS Carrier inherited. Moderate COI from carrier × carrier mating.',
    coiTestScenario: 'Carrier × Carrier warning test - 25% lethal outcome',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'A'), locus('G', 'Grey', 'G', 'g'), locus('Cr', 'Cream', 'n', 'n')],
      health: [healthLocus('OLWS', 'Lethal White Overo Syndrome', 'O/n')]
    }
  },
  { name: 'Arod', species: 'HORSE', sex: 'MALE', breed: 'Andalusian', generation: 1, sireRef: 'Asfaloth', damRef: 'Nahar', birthYear: 2017, testProvider: 'UC Davis VGL',
    notes: "Legolas's horse. Safe breeding - OLWS Clear.",
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'G', 'g'), locus('Cr', 'Cream', 'Cr', 'n')],
      health: [healthLocus('OLWS', 'Lethal White Overo Syndrome', 'n/n')]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CATS - Maine Coon with HCM (Heart Disease) testing
  // ═══════════════════════════════════════════════════════════════════════════════
  { name: 'Tevildo Prince of Cats', species: 'CAT', sex: 'MALE', breed: 'Maine Coon', generation: 0, birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'HCM Carrier - WARNING for hypertrophic cardiomyopathy!',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'cs')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2017-03-15', eventName: 'TICA Regional', eventLocation: 'Mirkwood' },
      { titleAbbreviation: 'GC', dateEarned: '2018-06-20', eventName: 'TICA Supreme', eventLocation: 'Rivendell' },
    ]
  },
  { name: 'Queen Beruthiel Cat I', species: 'CAT', sex: 'FEMALE', breed: 'Maine Coon', generation: 0, birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'HCM Carrier - DO NOT BREED TO TEVILDO (25% affected risk)!',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    }
  },
  { name: 'Shadow Cat of Mordor', species: 'CAT', sex: 'MALE', breed: 'Maine Coon', generation: 1, sireRef: 'Tevildo Prince of Cats', damRef: 'Queen Beruthiel Cat I', birthYear: 2018, testProvider: 'UC Davis VGL',
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
  { name: 'Mirkwood Prowler', species: 'CAT', sex: 'FEMALE', breed: 'Maine Coon', generation: 1, sireRef: 'Tevildo Prince of Cats', damRef: 'Queen Beruthiel Cat I', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'CARRIER × CARRIER offspring. HCM Affected - DO NOT BREED!',
    coiTestScenario: 'Carrier × Carrier - this one got the affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'cs')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'm/m'), healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
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
  { name: 'Crookshanks', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 0, birthYear: 2010, testProvider: 'UC Davis VGL',
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
  { name: 'Kneazle Queen', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 0, birthYear: 2011, testProvider: 'UC Davis VGL',
    notes: "Crookshanks' mate. Founder dam Line A. PKD Clear.",
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('O', 'Orange', 'o', 'o')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N')]
    }
  },

  // === MRS NORRIS LINE (Line B) - Generation 0 Founders (unrelated) ===
  { name: 'Mrs Norris', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
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
  { name: 'Argus Tom', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
    notes: "Founder sire Line B. PKD Clear, HCM Carrier.",
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'cs')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },

  // === Generation 1 - Children of Founders ===
  { name: 'Millicent Bulstrode Cat', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 1, sireRef: 'Crookshanks', damRef: 'Kneazle Queen', birthYear: 2014, testProvider: 'UC Davis VGL',
    notes: 'Daughter of Crookshanks × Kneazle Queen (Line A). PKD Carrier inherited from sire.',
    coiTestScenario: 'Gen 1 Line A - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('O', 'Orange', 'o', 'o')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N')]
    }
  },
  { name: 'Kneazle Son', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 1, sireRef: 'Crookshanks', damRef: 'Kneazle Queen', birthYear: 2014, testProvider: 'UC Davis VGL',
    notes: 'Son of Crookshanks × Kneazle Queen (Line A). PKD Clear.',
    coiTestScenario: 'Gen 1 Line A - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('O', 'Orange', 'O', 'Y')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N')]
    }
  },
  { name: 'Filch Kitten I', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 1, sireRef: 'Argus Tom', damRef: 'Mrs Norris', birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'Son of Argus × Mrs Norris (Line B). PKD Carrier, HCM Carrier - DOUBLE WARNING!',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },
  { name: 'Filch Kitten II', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 1, sireRef: 'Argus Tom', damRef: 'Mrs Norris', birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'Daughter of Argus × Mrs Norris (Line B). PKD Carrier.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'd', 'd'), locus('C', 'Colorpoint', 'C', 'cs')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N')]
    }
  },

  // === Generation 2 - CROSS BETWEEN LINES (Line A × Line B) ===
  { name: 'Magical Cross Cat', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 2, sireRef: 'Kneazle Son', damRef: 'Filch Kitten II', birthYear: 2017, testProvider: 'UC Davis VGL',
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
  { name: 'Kneazle Descendant', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 2, sireRef: 'Filch Kitten I', damRef: 'Millicent Bulstrode Cat', birthYear: 2017, testProvider: 'UC Davis VGL',
    notes: 'Line B sire × Line A dam. PKD Carrier × Carrier = 25% affected risk! HCM Carrier.',
    coiTestScenario: 'Gen 2 outcross - COI ~0% (unrelated lines) - PKD carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },

  // === Generation 3 - COUSIN MATING ===
  { name: 'Hogwarts Inbred Cat', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 3, sireRef: 'Magical Cross Cat', damRef: 'Kneazle Descendant', birthYear: 2019, testProvider: 'UC Davis VGL',
    notes: 'Parents share common ancestors. MODERATE COI. PKD Carrier × Carrier.',
    coiTestScenario: 'Gen 3 cousin mating - COI ~6.25% (shared great-grandparents)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },
  { name: 'Hogwarts Sister Cat', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 3, sireRef: 'Magical Cross Cat', damRef: 'Kneazle Descendant', birthYear: 2019, testProvider: 'UC Davis VGL',
    notes: 'Full sister. MODERATE COI. Got lucky - PKD Clear!',
    coiTestScenario: 'Gen 3 cousin mating - COI ~6.25%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N')]
    }
  },

  // === Generation 4 - FULL SIBLING MATING (HIGH COI) ===
  { name: 'Inbred Tom IV', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 4, sireRef: 'Hogwarts Inbred Cat', damRef: 'Hogwarts Sister Cat', birthYear: 2021, testProvider: 'UC Davis VGL',
    notes: 'FULL SIBLING PARENTS! HIGH COI ~25%. PKD Carrier.',
    coiTestScenario: 'Gen 4 full sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },
  { name: 'Inbred Queen IV', species: 'CAT', sex: 'FEMALE', breed: 'British Shorthair', generation: 4, sireRef: 'Hogwarts Inbred Cat', damRef: 'Hogwarts Sister Cat', birthYear: 2021, testProvider: 'UC Davis VGL',
    notes: 'Full sister. HIGH COI ~25%. PKD Clear.',
    coiTestScenario: 'Gen 4 full sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/N')]
    }
  },

  // === Generation 5 - ANOTHER SIBLING MATING (CRITICAL COI) ===
  { name: 'Critical COI Tom', species: 'CAT', sex: 'MALE', breed: 'British Shorthair', generation: 5, sireRef: 'Inbred Tom IV', damRef: 'Inbred Queen IV', birthYear: 2023, testProvider: 'UC Davis VGL',
    notes: 'PARENTS ARE FULL SIBLINGS! CRITICAL COI ~37.5%. Test for inbreeding depression.',
    coiTestScenario: 'Gen 5 consecutive sibling matings - COI ~37.5% (CRITICAL)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m'), healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
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
  { name: 'Night Watch Filly', species: 'HORSE', sex: 'FEMALE', breed: 'Friesian', generation: 2, sireRef: 'Stark Warhorse', damRef: 'Northern Filly', birthYear: 2019, testProvider: 'UC Davis VGL',
    notes: 'Line B cross. HYPP Carrier.',
    coiTestScenario: 'Gen 2 - COI ~25% (sibling cross)',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'a', 'a')],
      health: [healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'H/N')]
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
  { name: 'Muad\'Dib Hunter', species: 'DOG', sex: 'MALE', breed: 'Saluki', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: 'Named for the desert mouse. Founder sire Line A. DM Carrier - WARNING!',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'E', 'e')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'Clear')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2016-05-15', eventName: 'Arrakis Desert Classic', eventLocation: 'Arrakeen', pointsEarned: 15, majorWins: 2 },
      { titleAbbreviation: 'GCH', dateEarned: '2017-09-20', eventName: 'Atreides National', eventLocation: 'Caladan', pointsEarned: 25 },
    ]
  },
  { name: 'Shai-Hulud Dame', species: 'DOG', sex: 'FEMALE', breed: 'Saluki', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'Named for the great sandworms. Founder dam Line A. DM Carrier - DO NOT BREED TO MUAD\'DIB!',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'E', 'E')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'Clear')]
    }
  },

  // FREMEN LINE (Line B)
  { name: 'Stilgar Hound', species: 'DOG', sex: 'MALE', breed: 'Saluki', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: 'Founder sire Line B. DM Clear.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'E', 'E')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'N/m')]
    }
  },
  { name: 'Chani Huntress', species: 'DOG', sex: 'FEMALE', breed: 'Saluki', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'Founder dam Line B. DM Carrier.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'E', 'e')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'Clear')]
    }
  },

  // Generation 1
  { name: 'Spice Runner', species: 'DOG', sex: 'MALE', breed: 'Saluki', generation: 1, sireRef: 'Muad\'Dib Hunter', damRef: 'Shai-Hulud Dame', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line A. DM Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 Line A - DM carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'E', 'e')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'Clear')]
    }
  },
  { name: 'Fremen Scout', species: 'DOG', sex: 'FEMALE', breed: 'Saluki', generation: 1, sireRef: 'Muad\'Dib Hunter', damRef: 'Shai-Hulud Dame', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line A. DM Affected - DO NOT BREED!',
    coiTestScenario: 'Gen 1 Line A - got affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'E', 'E')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'm/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'Clear')]
    }
  },
  { name: 'Sietch Pup', species: 'DOG', sex: 'MALE', breed: 'Saluki', generation: 1, sireRef: 'Stilgar Hound', damRef: 'Chani Huntress', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line B. DM Carrier from dam.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'E', 'e')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'N/m')]
    }
  },
  { name: 'Naib Huntress', species: 'DOG', sex: 'FEMALE', breed: 'Saluki', generation: 1, sireRef: 'Stilgar Hound', damRef: 'Chani Huntress', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line B. DM Clear.',
    coiTestScenario: 'Gen 1 Line B - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'E', 'E')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'Clear'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'Clear')]
    }
  },

  // Generation 2 - CROSS
  { name: 'Kwisatz Hound', species: 'DOG', sex: 'MALE', breed: 'Saluki', generation: 2, sireRef: 'Spice Runner', damRef: 'Naib Huntress', birthYear: 2020, testProvider: 'Embark',
    notes: 'Line A sire × Line B dam outcross. DM Carrier.',
    coiTestScenario: 'Gen 2 outcross - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'E', 'e')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'Clear')]
    }
  },
  { name: 'Sayyadina Dame', species: 'DOG', sex: 'FEMALE', breed: 'Saluki', generation: 2, sireRef: 'Sietch Pup', damRef: 'Naib Huntress', birthYear: 2020, testProvider: 'Embark',
    notes: 'Line B × Line B sibling cross. HIGH COI ~25%.',
    coiTestScenario: 'Gen 2 sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'E', 'E')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m'), healthLocus('CMR', 'Canine Multifocal Retinopathy', 'N/m')]
    }
  },

  // === HORSES - Arabian (Atreides Warhorses) ===
  // SCID (Severe Combined Immunodeficiency) carrier testing
  { name: 'Duke Leto\'s Steed', species: 'HORSE', sex: 'MALE', breed: 'Arabian', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
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
  { name: 'Caladan Mare', species: 'HORSE', sex: 'FEMALE', breed: 'Arabian', generation: 0, birthYear: 2013, testProvider: 'UC Davis VGL',
    notes: 'Brought from the ocean world. SCID Carrier - DO NOT BREED TO LETO\'S STEED!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'g', 'g')],
      health: [healthLocus('SCID', 'Severe Combined Immunodeficiency', 'N/m')]
    }
  },
  { name: 'Sietch Warhorse', species: 'HORSE', sex: 'MALE', breed: 'Arabian', generation: 1, sireRef: 'Duke Leto\'s Steed', damRef: 'Caladan Mare', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'SCID Carrier × Carrier = 25% lethal!',
    coiTestScenario: 'Gen 1 - SCID carrier × carrier (lethal)',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('G', 'Grey', 'G', 'g')],
      health: [healthLocus('SCID', 'Severe Combined Immunodeficiency', 'N/m')]
    }
  },
  { name: 'Desert Wind', species: 'HORSE', sex: 'FEMALE', breed: 'Arabian', generation: 1, sireRef: 'Duke Leto\'s Steed', damRef: 'Caladan Mare', birthYear: 2016, testProvider: 'UC Davis VGL',
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
  { name: 'Bene Gesserit Cat', species: 'CAT', sex: 'FEMALE', breed: 'Abyssinian', generation: 0, birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'Cat with unusually perceptive abilities. Founder dam. PK Def Carrier!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('Ta', 'Tabby', 'Ta', 'Ta')],
      health: [healthLocus('PK_Def', 'PK Deficiency', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2017-05-10', eventName: 'Sietch Cat Show', eventLocation: 'Arrakis' },
    ]
  },
  { name: 'Mentat Companion', species: 'CAT', sex: 'MALE', breed: 'Abyssinian', generation: 0, birthYear: 2014, testProvider: 'UC Davis VGL',
    notes: 'Founder sire. PK Def Carrier - DO NOT BREED TO BENE GESSERIT!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'b', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('Ta', 'Tabby', 'Ta', 'Ta')],
      health: [healthLocus('PK_Def', 'PK Deficiency', 'N/m')]
    }
  },
  { name: 'Sardaukar Shadow', species: 'CAT', sex: 'MALE', breed: 'Abyssinian', generation: 1, sireRef: 'Mentat Companion', damRef: 'Bene Gesserit Cat', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'PK Def Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 - PK carrier × carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'A'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('Ta', 'Tabby', 'Ta', 'Ta')],
      health: [healthLocus('PK_Def', 'PK Deficiency', 'N/m')]
    }
  },
  { name: 'Kwisatz Kitten', species: 'CAT', sex: 'FEMALE', breed: 'Abyssinian', generation: 1, sireRef: 'Mentat Companion', damRef: 'Bene Gesserit Cat', birthYear: 2018, testProvider: 'UC Davis VGL',
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
  { name: 'Spot', species: 'CAT', sex: 'MALE', breed: 'Exotic Shorthair', generation: 0, birthYear: 2014, testProvider: 'UC Davis VGL',
    notes: 'Data\'s beloved cat from the Enterprise. Founder sire. PKD Carrier!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('O', 'Orange', 'O', 'Y')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2016-04-15', eventName: 'Enterprise Cat Show', eventLocation: 'Starbase 1', pointsEarned: 200 },
      { titleAbbreviation: 'GC', dateEarned: '2017-08-20', eventName: 'Federation Championship', eventLocation: 'Earth', pointsEarned: 500 },
    ]
  },
  { name: 'Enterprise Cat', species: 'CAT', sex: 'FEMALE', breed: 'Exotic Shorthair', generation: 0, birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'Founder dam. PKD Carrier - DO NOT BREED TO SPOT!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('O', 'Orange', 'o', 'o')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m')]
    }
  },
  { name: 'Warp Drive Kitten', species: 'CAT', sex: 'MALE', breed: 'Exotic Shorthair', generation: 1, sireRef: 'Spot', damRef: 'Enterprise Cat', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'PKD Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 - PKD carrier × carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('O', 'Orange', 'O', 'o')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m')]
    }
  },
  { name: 'Tribble Chaser', species: 'CAT', sex: 'FEMALE', breed: 'Exotic Shorthair', generation: 1, sireRef: 'Spot', damRef: 'Enterprise Cat', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'PKD Clear from carrier × carrier.',
    coiTestScenario: 'Gen 1 - got clear genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('O', 'Orange', 'o', 'o')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/N')]
    }
  },
  // Gen 2 sibling mating
  { name: 'Captain Kitten', species: 'CAT', sex: 'MALE', breed: 'Exotic Shorthair', generation: 2, sireRef: 'Warp Drive Kitten', damRef: 'Tribble Chaser', birthYear: 2021, testProvider: 'UC Davis VGL',
    notes: 'FULL SIBLING PARENTS! HIGH COI ~25%.',
    coiTestScenario: 'Gen 2 full sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('O', 'Orange', 'O', 'o')],
      health: [healthLocus('PKD', 'Polycystic Kidney Disease', 'N/m')]
    }
  },

  // === RABBITS - Flemish Giant (Space Station Rabbits) ===
  { name: 'Tribble Alternative', species: 'RABBIT', sex: 'MALE', breed: 'Flemish Giant', generation: 0, birthYear: 2016,
    notes: 'Much easier to manage than tribbles. Founder sire.',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: { coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Color Series', 'C', 'C'), locus('D', 'Dilute', 'D', 'D'), locus('En', 'English Spotting', 'en', 'en')] },
    titles: [
      { titleAbbreviation: 'GC', dateEarned: '2018-05-10', eventName: 'Starbase Rabbit Show', eventLocation: 'Deep Space 9', pointsEarned: 5 },
    ]
  },
  { name: 'Vulcan Lop', species: 'RABBIT', sex: 'FEMALE', breed: 'Flemish Giant', generation: 0, birthYear: 2016,
    notes: 'Founder dam.',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Color Series', 'C', 'cchd'), locus('D', 'Dilute', 'D', 'd'), locus('En', 'English Spotting', 'En', 'en')] }
  },
  { name: 'Holodeck Bunny', species: 'RABBIT', sex: 'MALE', breed: 'Flemish Giant', generation: 1, sireRef: 'Tribble Alternative', damRef: 'Vulcan Lop', birthYear: 2019,
    coiTestScenario: 'Gen 1 - COI ~0%',
    genetics: { coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Color Series', 'C', 'cchd'), locus('D', 'Dilute', 'D', 'd'), locus('En', 'English Spotting', 'En', 'en')] }
  },
  { name: 'Transporter Bun', species: 'RABBIT', sex: 'FEMALE', breed: 'Flemish Giant', generation: 1, sireRef: 'Tribble Alternative', damRef: 'Vulcan Lop', birthYear: 2019,
    coiTestScenario: 'Gen 1 - COI ~0%',
    genetics: { coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('C', 'Color Series', 'C', 'C'), locus('D', 'Dilute', 'D', 'D'), locus('En', 'English Spotting', 'en', 'en')] }
  },
  { name: 'High COI Trek Rabbit', species: 'RABBIT', sex: 'MALE', breed: 'Flemish Giant', generation: 2, sireRef: 'Holodeck Bunny', damRef: 'Transporter Bun', birthYear: 2022,
    notes: 'FULL SIBLING PARENTS! HIGH COI ~25%.',
    coiTestScenario: 'Gen 2 full sibling mating - COI ~25% (HIGH)',
    genetics: { coatColor: [locus('A', 'Agouti', 'A', 'a'), locus('B', 'Brown', 'B', 'B'), locus('C', 'Color Series', 'C', 'cchd'), locus('D', 'Dilute', 'D', 'd'), locus('En', 'English Spotting', 'En', 'en')] }
  },

  // === DOGS - Border Collie (Starfleet Service Dogs) ===
  // CEA (Collie Eye Anomaly) carrier testing
  { name: 'Number One Dog', species: 'DOG', sex: 'MALE', breed: 'Border Collie', generation: 0, birthYear: 2014, testProvider: 'Embark',
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
  { name: 'Ten Forward Lass', species: 'DOG', sex: 'FEMALE', breed: 'Border Collie', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'Loves to greet visitors. Founder dam. CEA Carrier, TNS Carrier - DOUBLE WARNING!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('CEA', 'Collie Eye Anomaly', 'N/m'), healthLocus('TNS', 'Trapped Neutrophil Syndrome', 'N/m')]
    }
  },
  { name: 'Phaser Pup', species: 'DOG', sex: 'MALE', breed: 'Border Collie', generation: 1, sireRef: 'Number One Dog', damRef: 'Ten Forward Lass', birthYear: 2018, testProvider: 'Embark',
    notes: 'TNS Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 - TNS carrier × carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('CEA', 'Collie Eye Anomaly', 'N/m'), healthLocus('TNS', 'Trapped Neutrophil Syndrome', 'N/m')]
    }
  },
  { name: 'Comms Officer Collie', species: 'DOG', sex: 'FEMALE', breed: 'Border Collie', generation: 1, sireRef: 'Number One Dog', damRef: 'Ten Forward Lass', birthYear: 2018, testProvider: 'Embark',
    notes: 'TNS Clear.',
    coiTestScenario: 'Gen 1 - got clear genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'at', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('S', 'White Spotting', 'sp', 'sp')],
      health: [healthLocus('CEA', 'Collie Eye Anomaly', 'Clear'), healthLocus('TNS', 'Trapped Neutrophil Syndrome', 'Clear')]
    }
  },
  { name: 'High COI Trek Pup', species: 'DOG', sex: 'MALE', breed: 'Border Collie', generation: 2, sireRef: 'Phaser Pup', damRef: 'Comms Officer Collie', birthYear: 2021, testProvider: 'Embark',
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
  { name: 'Biscuits', species: 'DOG', sex: 'MALE', breed: 'Golden Retriever', generation: 0, birthYear: 2014, testProvider: 'Embark',
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
  { name: 'Diamond Dogs Dam', species: 'DOG', sex: 'FEMALE', breed: 'Golden Retriever', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'The Diamond Dogs are Ted\'s support group. Founder dam Line A. PRA Carrier - DO NOT BREED TO BISCUITS!',
    coiTestScenario: 'Founder Line A - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('ICH', 'Ichthyosis', 'Clear')]
    }
  },

  // ROY KENT LINE (Line B)
  { name: 'Roy Kent Hound', species: 'DOG', sex: 'MALE', breed: 'Golden Retriever', generation: 0, birthYear: 2014, testProvider: 'Embark',
    notes: 'Founder sire Line B. PRA Clear, Ichthyosis Carrier.',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear'), healthLocus('ICH', 'Ichthyosis', 'N/m')]
    }
  },
  { name: 'Keeley Dame', species: 'DOG', sex: 'FEMALE', breed: 'Golden Retriever', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'Founder dam Line B. PRA Carrier, Ichthyosis Carrier - DOUBLE WARNING!',
    coiTestScenario: 'Founder Line B - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('ICH', 'Ichthyosis', 'N/m')]
    }
  },

  // Generation 1
  { name: 'Believe Pup', species: 'DOG', sex: 'MALE', breed: 'Golden Retriever', generation: 1, sireRef: 'Biscuits', damRef: 'Diamond Dogs Dam', birthYear: 2017, testProvider: 'Embark',
    notes: 'Named after the iconic BELIEVE sign. Line A. PRA Carrier × Carrier = 25% affected!',
    coiTestScenario: 'Gen 1 Line A - PRA carrier × carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('ICH', 'Ichthyosis', 'N/m')]
    }
  },
  { name: 'Barbecue Sauce', species: 'DOG', sex: 'FEMALE', breed: 'Golden Retriever', generation: 1, sireRef: 'Biscuits', damRef: 'Diamond Dogs Dam', birthYear: 2017, testProvider: 'Embark',
    notes: 'Ted\'s second favorite condiment. Line A. PRA Affected - DO NOT BREED!',
    coiTestScenario: 'Gen 1 Line A - got affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'm/m'), healthLocus('ICH', 'Ichthyosis', 'Clear')]
    }
  },
  { name: 'Jamie Tartt Pup', species: 'DOG', sex: 'MALE', breed: 'Golden Retriever', generation: 1, sireRef: 'Roy Kent Hound', damRef: 'Keeley Dame', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line B. Ichthyosis Carrier × Carrier = 25% affected!',
    coiTestScenario: 'Gen 1 Line B - Ichthyosis carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('ICH', 'Ichthyosis', 'N/m')]
    }
  },
  { name: 'Nate Dame', species: 'DOG', sex: 'FEMALE', breed: 'Golden Retriever', generation: 1, sireRef: 'Roy Kent Hound', damRef: 'Keeley Dame', birthYear: 2017, testProvider: 'Embark',
    notes: 'Line B. Clear for both.',
    coiTestScenario: 'Gen 1 Line B - got clear genotypes',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'Clear'), healthLocus('ICH', 'Ichthyosis', 'Clear')]
    }
  },

  // Generation 2 - CROSS
  { name: 'Richmond Champ', species: 'DOG', sex: 'MALE', breed: 'Golden Retriever', generation: 2, sireRef: 'Believe Pup', damRef: 'Nate Dame', birthYear: 2020, testProvider: 'Embark',
    notes: 'Line A sire × Line B dam outcross. PRA Carrier.',
    coiTestScenario: 'Gen 2 outcross - COI ~0%',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('ICH', 'Ichthyosis', 'N/m')]
    }
  },
  { name: 'High COI Richmond Dame', species: 'DOG', sex: 'FEMALE', breed: 'Golden Retriever', generation: 2, sireRef: 'Jamie Tartt Pup', damRef: 'Nate Dame', birthYear: 2020, testProvider: 'Embark',
    notes: 'Line B × Line B sibling cross. HIGH COI ~25%.',
    coiTestScenario: 'Gen 2 sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('E', 'Extension', 'e', 'e')],
      health: [healthLocus('PRA', 'Progressive Retinal Atrophy', 'N/m'), healthLocus('ICH', 'Ichthyosis', 'N/m')]
    }
  },

  // === HORSES - Thoroughbred (English Football Club Horses) ===
  // GBED carrier testing
  { name: 'Total Football', species: 'HORSE', sex: 'MALE', breed: 'Thoroughbred', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
    notes: 'Named after the playing style. Founder sire. GBED Carrier - WARNING!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'A'), locus('Cr', 'Cream', 'n', 'n')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2015-06-20', eventName: 'Richmond Derby', eventLocation: 'Nelson Road' },
    ]
  },
  { name: 'Nelson Road Mare', species: 'HORSE', sex: 'FEMALE', breed: 'Thoroughbred', generation: 0, birthYear: 2013, testProvider: 'UC Davis VGL',
    notes: 'Named after Richmond\'s stadium. GBED Carrier - DO NOT BREED TO TOTAL FOOTBALL!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'a'), locus('Cr', 'Cream', 'n', 'n')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/m')]
    }
  },
  { name: 'Greyhound Colt', species: 'HORSE', sex: 'MALE', breed: 'Thoroughbred', generation: 1, sireRef: 'Total Football', damRef: 'Nelson Road Mare', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'Named after the Richmond Greyhounds nickname. GBED Carrier × Carrier = 25% lethal!',
    coiTestScenario: 'Gen 1 - GBED carrier × carrier (lethal)',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('Cr', 'Cream', 'n', 'n')],
      health: [healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/m')]
    }
  },
  { name: 'Wonder Kid Filly', species: 'HORSE', sex: 'FEMALE', breed: 'Thoroughbred', generation: 1, sireRef: 'Total Football', damRef: 'Nelson Road Mare', birthYear: 2016, testProvider: 'UC Davis VGL',
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
];

// ═══════════════════════════════════════════════════════════════════════════════
// MATRIX ANIMALS (Cats, Goats, Horses, Dogs) - Zion
// HCM for cats, G6S for goats, HERDA for horses, DM for dogs
// ═══════════════════════════════════════════════════════════════════════════════
export const ZION_ANIMALS: AnimalDefinition[] = [
  // === CATS - Bombay (Black Cats of Zion) ===
  // HCM carrier testing
  { name: 'The One Cat', species: 'CAT', sex: 'MALE', breed: 'Bombay', generation: 0, birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'There is no spoon, but there is a cat. Founder sire. HCM Carrier - WARNING!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'CH', dateEarned: '2017-04-15', eventName: 'Zion Cat Show', eventLocation: 'Zion', pointsEarned: 200 },
      { titleAbbreviation: 'GC', dateEarned: '2018-08-20', eventName: 'Matrix Championship', eventLocation: 'Zion', pointsEarned: 500 },
    ]
  },
  { name: 'Matrix Queen', species: 'CAT', sex: 'FEMALE', breed: 'Bombay', generation: 0, birthYear: 2015, testProvider: 'UC Davis VGL',
    notes: 'Founder dam. HCM Carrier - DO NOT BREED TO THE ONE CAT!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },
  { name: 'Red Pill Kitten', species: 'CAT', sex: 'MALE', breed: 'Bombay', generation: 1, sireRef: 'The One Cat', damRef: 'Matrix Queen', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'HCM Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 - HCM carrier × carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },
  { name: 'Blue Pill Kitten', species: 'CAT', sex: 'FEMALE', breed: 'Bombay', generation: 1, sireRef: 'The One Cat', damRef: 'Matrix Queen', birthYear: 2018, testProvider: 'UC Davis VGL',
    notes: 'HCM Affected from carrier × carrier - DO NOT BREED!',
    coiTestScenario: 'Gen 1 - got affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'm/m')]
    }
  },
  { name: 'High COI Matrix Cat', species: 'CAT', sex: 'MALE', breed: 'Bombay', generation: 2, sireRef: 'Red Pill Kitten', damRef: 'Blue Pill Kitten', birthYear: 2021, testProvider: 'UC Davis VGL',
    notes: 'FULL SIBLING PARENTS! HIGH COI ~25%.',
    coiTestScenario: 'Gen 2 full sibling mating - COI ~25% (HIGH)',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'a', 'a'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('C', 'Colorpoint', 'C', 'C')],
      health: [healthLocus('HCM', 'Hypertrophic Cardiomyopathy', 'N/m')]
    }
  },

  // === GOATS - La Mancha (Zion Farm) ===
  // G6S carrier testing
  { name: 'Architect\'s Goat', species: 'GOAT', sex: 'MALE', breed: 'La Mancha', generation: 0, birthYear: 2016,
    notes: 'Providing milk for Zion. Founder sire. G6S Carrier - WARNING!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Ab'), locus('B', 'Brown', 'B', 'B')],
      physicalTraits: [locus('P', 'Polled', 'P', 'p')],
      health: [healthLocus('G6S', 'G6S', 'N/m')]
    },
    titles: [
      { titleAbbreviation: 'GCH', dateEarned: '2018-06-15', eventName: 'Zion Farm Show', eventLocation: 'Zion', pointsEarned: 10 },
    ]
  },
  { name: 'Resistance Nanny', species: 'GOAT', sex: 'FEMALE', breed: 'La Mancha', generation: 0, birthYear: 2016,
    notes: 'Founder dam. G6S Carrier - DO NOT BREED TO ARCHITECT\'S GOAT!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Awt', 'Ab')],
      physicalTraits: [locus('P', 'Polled', 'p', 'p')],
      health: [healthLocus('G6S', 'G6S', 'N/m')]
    }
  },
  { name: 'Freedom Kid', species: 'GOAT', sex: 'MALE', breed: 'La Mancha', generation: 1, sireRef: 'Architect\'s Goat', damRef: 'Resistance Nanny', birthYear: 2019,
    notes: 'G6S Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 - G6S carrier × carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti Pattern', 'Ab', 'Awt')],
      physicalTraits: [locus('P', 'Polled', 'P', 'p')],
      health: [healthLocus('G6S', 'G6S', 'N/m')]
    }
  },
  { name: 'Awakened Doeling', species: 'GOAT', sex: 'FEMALE', breed: 'La Mancha', generation: 1, sireRef: 'Architect\'s Goat', damRef: 'Resistance Nanny', birthYear: 2019,
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
  { name: 'Nebuchadnezzar Horse', species: 'HORSE', sex: 'MALE', breed: 'Mustang', generation: 0, birthYear: 2012, testProvider: 'UC Davis VGL',
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
  { name: 'Zion Mare', species: 'HORSE', sex: 'FEMALE', breed: 'Mustang', generation: 0, birthYear: 2013, testProvider: 'UC Davis VGL',
    notes: 'Founder dam. HERDA Carrier - DO NOT BREED TO NEB HORSE!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'A'), locus('D', 'Dilute', 'D', 'd')],
      health: [healthLocus('HERDA', 'Hereditary Equine Regional Dermal Asthenia', 'N/m')]
    }
  },
  { name: 'Sentinel Runner', species: 'HORSE', sex: 'MALE', breed: 'Mustang', generation: 1, sireRef: 'Nebuchadnezzar Horse', damRef: 'Zion Mare', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'HERDA Carrier × Carrier = 25% affected!',
    coiTestScenario: 'Gen 1 - HERDA carrier × carrier warning',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'e'), locus('A', 'Agouti', 'A', 'a'), locus('D', 'Dilute', 'D', 'd')],
      health: [healthLocus('HERDA', 'Hereditary Equine Regional Dermal Asthenia', 'N/m')]
    }
  },
  { name: 'Oracle\'s Filly', species: 'HORSE', sex: 'FEMALE', breed: 'Mustang', generation: 1, sireRef: 'Nebuchadnezzar Horse', damRef: 'Zion Mare', birthYear: 2016, testProvider: 'UC Davis VGL',
    notes: 'HERDA Clear from carrier × carrier.',
    coiTestScenario: 'Gen 1 - got clear genotype',
    genetics: {
      coatColor: [locus('E', 'Extension', 'E', 'E'), locus('A', 'Agouti', 'A', 'A'), locus('D', 'Dilute', 'D', 'D')],
      health: [healthLocus('HERDA', 'Hereditary Equine Regional Dermal Asthenia', 'N/N')]
    }
  },

  // === DOGS - Belgian Malinois (Resistance Dogs) ===
  // DM carrier testing
  { name: 'Agent Hunter', species: 'DOG', sex: 'MALE', breed: 'Belgian Malinois', generation: 0, birthYear: 2014, testProvider: 'Embark',
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
  { name: 'Operator\'s Companion', species: 'DOG', sex: 'FEMALE', breed: 'Belgian Malinois', generation: 0, birthYear: 2015, testProvider: 'Embark',
    notes: 'Founder dam. DM Carrier - DO NOT BREED TO AGENT HUNTER!',
    coiTestScenario: 'Founder - no inbreeding',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'd'), locus('Em', 'Melanistic Mask', 'Em', 'Em')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m')]
    }
  },
  { name: 'Unplugged Pup', species: 'DOG', sex: 'MALE', breed: 'Belgian Malinois', generation: 1, sireRef: 'Agent Hunter', damRef: 'Operator\'s Companion', birthYear: 2018, testProvider: 'Embark',
    notes: 'DM Carrier × Carrier = 25% affected risk!',
    coiTestScenario: 'Gen 1 - DM carrier × carrier warning',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'at'), locus('B', 'Brown', 'B', 'B'), locus('D', 'Dilute', 'D', 'd'), locus('Em', 'Melanistic Mask', 'Em', 'E')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'N/m')]
    }
  },
  { name: 'Kung Fu Pup', species: 'DOG', sex: 'FEMALE', breed: 'Belgian Malinois', generation: 1, sireRef: 'Agent Hunter', damRef: 'Operator\'s Companion', birthYear: 2018, testProvider: 'Embark',
    notes: 'DM Affected from carrier × carrier - DO NOT BREED!',
    coiTestScenario: 'Gen 1 - got affected genotype',
    genetics: {
      coatColor: [locus('A', 'Agouti', 'Ay', 'Ay'), locus('B', 'Brown', 'B', 'b'), locus('D', 'Dilute', 'D', 'D'), locus('Em', 'Melanistic Mask', 'Em', 'Em')],
      health: [healthLocus('DM', 'Degenerative Myelopathy', 'm/m')]
    }
  },
  { name: 'High COI Matrix Pup', species: 'DOG', sex: 'MALE', breed: 'Belgian Malinois', generation: 2, sireRef: 'Unplugged Pup', damRef: 'Kung Fu Pup', birthYear: 2021, testProvider: 'Embark',
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
    { name: 'Atreides Hound Program 2026', nickname: 'Spice Dogs', species: 'DOG', breedText: 'Saluki', damRef: 'Shai-Hulud Dame', sireRef: 'Muad\'Dib Hunter', status: 'PLANNING', notes: 'Desert-adapted hunting dogs for House Atreides.', expectedCycleStart: new Date('2026-03-01') },
    { name: 'Caladan Legacy', species: 'HORSE', breedText: 'Arabian', damRef: 'Caladan Mare', sireRef: 'Duke Leto\'s Steed', status: 'COMMITTED', notes: 'Preserving the Atreides equine bloodline.' },
    { name: 'Bene Gesserit Companions', species: 'CAT', breedText: 'Abyssinian', damRef: 'Bene Gesserit Cat', sireRef: 'Mentat Companion', status: 'PLANNING', notes: 'Breeding perceptive feline companions.' },
    { name: 'Fremen Pack', species: 'DOG', breedText: 'Saluki', damRef: 'Fremen Scout', sireRef: 'Spice Runner', status: 'COMMITTED', notes: 'Sietch guard dogs.' },
  ],
  starfleet: [
    { name: 'Enterprise Cats 2026', species: 'CAT', breedText: 'Exotic Shorthair', damRef: 'Enterprise Cat', sireRef: 'Spot', status: 'PLANNING', notes: 'Ship cat breeding program for starships.' },
    { name: 'Academy Service Dogs', species: 'DOG', breedText: 'Border Collie', damRef: 'Ten Forward Lass', sireRef: 'Number One Dog', status: 'COMMITTED', notes: 'Service dogs for Starfleet Academy.' },
    { name: 'Station Rabbits', species: 'RABBIT', breedText: 'Flemish Giant', damRef: 'Vulcan Lop', sireRef: 'Tribble Alternative', status: 'PLANNING', notes: 'Alternative to tribbles for station morale.' },
  ],
  richmond: [
    { name: 'Diamond Dogs Breeding', nickname: 'Believe Litter', species: 'DOG', breedText: 'Golden Retriever', damRef: 'Diamond Dogs Dam', sireRef: 'Biscuits', status: 'COMMITTED', notes: 'Breeding the next generation of AFC Richmond mascots.' },
    { name: 'Nelson Road Horses', species: 'HORSE', breedText: 'Thoroughbred', damRef: 'Nelson Road Mare', sireRef: 'Total Football', status: 'PLANNING', notes: 'Horses for club promotional events.' },
    { name: 'Wonder Kids Program', species: 'DOG', breedText: 'Golden Retriever', damRef: 'Barbecue Sauce', sireRef: 'Believe Pup', status: 'PLANNING', notes: 'Youth development breeding program.' },
  ],
  zion: [
    { name: 'Resistance Cat Program', species: 'CAT', breedText: 'Bombay', damRef: 'Matrix Queen', sireRef: 'The One Cat', status: 'COMMITTED', notes: 'Black cats of Zion breeding program.' },
    { name: 'Free Horse Initiative', species: 'HORSE', breedText: 'Mustang', damRef: 'Zion Mare', sireRef: 'Nebuchadnezzar Horse', status: 'PLANNING', notes: 'Wild horse breeding for freedom.' },
    { name: 'Zion Farm Goats', species: 'GOAT', breedText: 'La Mancha', damRef: 'Resistance Nanny', sireRef: 'Architect\'s Goat', status: 'COMMITTED', notes: 'Sustenance for Zion.' },
    { name: 'Agent Tracker Dogs', species: 'DOG', breedText: 'Belgian Malinois', damRef: 'Operator\'s Companion', sireRef: 'Agent Hunter', status: 'PLANNING', notes: 'Training dogs to detect Agents.' },
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
// CREDENTIAL SUMMARY (for password vault)
// ═══════════════════════════════════════════════════════════════════════════════

export function generateCredentialsSummary(env: Environment): string {
  const tenantDefs = getTenantDefinitions(env);
  const tenantUsers = getTenantUsers(env);

  const lines: string[] = [
    `═══════════════════════════════════════════════════════════════════════════════`,
    `BREEDERHQ VALIDATION TENANT CREDENTIALS - ${ENV_PREFIX[env]} ENVIRONMENT`,
    `═══════════════════════════════════════════════════════════════════════════════`,
    ``,
  ];

  for (const tenant of tenantDefs) {
    const user = tenantUsers[tenant.slug];
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
