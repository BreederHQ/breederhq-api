/**
 * Genetics Import Module
 *
 * Supports importing genetic test results from various providers:
 * - Embark (dogs) - CSV export
 * - Wisdom Panel (dogs) - Coming soon
 * - UC Davis VGL (multiple species) - Coming soon
 * - Animal Genetics - Coming soon
 * - Manual entry with templates
 */

export * from './embark-parser.js';

// Provider types
export type GeneticsProvider = 'embark' | 'wisdom_panel' | 'uc_davis' | 'animal_genetics' | 'paw_print' | 'manual';

export interface ProviderInfo {
  id: GeneticsProvider;
  name: string;
  species: string[];
  supportedFormats: string[];
  isSupported: boolean;
  exportInstructions?: string;
}

export const GENETICS_PROVIDERS: ProviderInfo[] = [
  {
    id: 'embark',
    name: 'Embark',
    species: ['DOG'],
    supportedFormats: ['CSV', 'TSV'],
    isSupported: true,
    exportInstructions: `
1. Log into your Embark account at embarkvet.com
2. Go to your dog's results page
3. Click the "Advanced" tab
4. Scroll down and click "Raw Data"
5. Click "Download as CSV" or "Download as TSV"
6. Upload the downloaded file here
    `.trim(),
  },
  {
    id: 'wisdom_panel',
    name: 'Wisdom Panel',
    species: ['DOG', 'CAT'],
    supportedFormats: ['PDF'],
    isSupported: false,
    exportInstructions: 'Coming soon - PDF parsing support',
  },
  {
    id: 'uc_davis',
    name: 'UC Davis VGL',
    species: ['DOG', 'CAT', 'HORSE'],
    supportedFormats: ['PDF'],
    isSupported: false,
    exportInstructions: 'Coming soon - PDF parsing support',
  },
  {
    id: 'animal_genetics',
    name: 'Animal Genetics',
    species: ['DOG', 'CAT', 'HORSE', 'BIRD'],
    supportedFormats: ['PDF'],
    isSupported: false,
    exportInstructions: 'Coming soon - PDF parsing support',
  },
  {
    id: 'paw_print',
    name: 'Paw Print Genetics',
    species: ['DOG', 'CAT'],
    supportedFormats: ['PDF'],
    isSupported: false,
    exportInstructions: 'Coming soon - PDF parsing support',
  },
  {
    id: 'manual',
    name: 'Manual Entry',
    species: ['DOG', 'CAT', 'HORSE', 'RABBIT', 'GOAT', 'OTHER'],
    supportedFormats: [],
    isSupported: true,
  },
];

export function getProviderBySpecies(species: string): ProviderInfo[] {
  return GENETICS_PROVIDERS.filter(
    (p) => p.isSupported && p.species.includes(species.toUpperCase())
  );
}

export function getProviderById(id: GeneticsProvider): ProviderInfo | undefined {
  return GENETICS_PROVIDERS.find((p) => p.id === id);
}
