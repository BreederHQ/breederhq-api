/**
 * KVS Demo Tenant — Shared Helpers
 *
 * Reusable helper functions for building the Katie Van Slyke demo tenant seed data.
 * Patterns adapted from seed-data-config.ts and seed-pedigree-tenant-4.ts.
 */

// ── Genetics helpers ──────────────────────────────────────────────────

export interface LocusData {
  locus: string;
  locusName: string;
  allele1?: string;
  allele2?: string;
  genotype: string;
}

/** Build a coat-color / physical-trait locus entry. */
export function locus(
  locusCode: string,
  locusName: string,
  allele1: string,
  allele2: string,
): LocusData {
  return {
    locus: locusCode,
    locusName,
    allele1,
    allele2,
    genotype: `${allele1}/${allele2}`,
  };
}

/** Build a health-panel locus entry (e.g. 6-panel N/N). */
export function healthLocus(
  locusCode: string,
  locusName: string,
  status: string,
): LocusData {
  return {
    locus: locusCode,
    locusName,
    genotype: status,
  };
}

// ── Standard equine 6-panel N/N (all clear) ───────────────────────────

export function sixPanelClear(): LocusData[] {
  return [
    healthLocus('HYPP', 'Hyperkalemic Periodic Paralysis', 'N/N'),
    healthLocus('GBED', 'Glycogen Branching Enzyme Deficiency', 'N/N'),
    healthLocus('HERDA', 'Hereditary Equine Regional Dermal Asthenia', 'N/N'),
    healthLocus('OLWS', 'Overo Lethal White Syndrome', 'N/N'),
    healthLocus('PSSM', 'Polysaccharide Storage Myopathy', 'N/N'),
    healthLocus('MH', 'Malignant Hyperthermia', 'N/N'),
  ];
}

// ── Date helpers ──────────────────────────────────────────────────────

/** Parse a date string (YYYY-MM-DD) into a Date object. */
export function d(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`);
}

/** Shorthand for building a Date from year only (defaults to June 15). */
export function yearDate(year: number): Date {
  return new Date(`${year}-06-15T12:00:00Z`);
}

/** Return a date N days after a reference date. */
export function daysAfter(ref: Date, days: number): Date {
  return new Date(ref.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Return a date N days before a reference date. */
export function daysBefore(ref: Date, days: number): Date {
  return new Date(ref.getTime() - days * 24 * 60 * 60 * 1000);
}
