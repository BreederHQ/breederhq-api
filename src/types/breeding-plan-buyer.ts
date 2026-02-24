import type { WaitlistStatus, Species, BreedingPlanBuyerStage } from "@prisma/client";

export type MatchReason =
  | "PROGRAM_MATCH"
  | "SPECIES_MATCH"
  | "BREED_MATCH"
  | "SIRE_PREFERENCE"
  | "DAM_PREFERENCE"
  | "DEPOSIT_PAID";

export interface WaitlistEntrySummaryDTO {
  id: number;
  status: WaitlistStatus;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  speciesPref: Species | null;
  breedPrefs: string[] | null;
  sirePrefId: number | null;
  sirePrefName: string | null;
  damPrefId: number | null;
  damPrefName: string | null;
  priority: number | null;
  depositPaidAt: string | null;
  depositPaidCents: number | null;
  notes: string | null;
  createdAt: string;
}

export interface PartyDTO {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface BreedingPlanBuyerDTO {
  id: number;
  planId: number;
  stage: BreedingPlanBuyerStage;

  // Buyer info (one of these)
  waitlistEntryId: number | null;
  waitlistEntry: WaitlistEntrySummaryDTO | null;
  partyId: number | null;
  party: PartyDTO | null;

  // Computed buyer display
  buyerName: string;
  buyerEmail: string | null;
  buyerPhone: string | null;

  // Match info
  matchScore: number | null;
  matchReasons: MatchReason[] | null;

  // Assignment info
  assignedAt: string | null;
  assignedByPartyId: number | null;
  priority: number | null;

  // Offspring connection
  offspringId: number | null;

  // Deposit invoice (linked directly to this plan buyer)
  depositInvoiceId: number | null;
  depositInvoiceStatus: string | null;
  depositInvoiceBalanceCents: number | null;
  depositInvoiceTotalCents: number | null;

  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UnappliedCredit {
  invoiceId: number;
  invoiceNumber: string;
  amountCents: number;
}

export interface AssignBuyerResponse {
  buyer: BreedingPlanBuyerDTO;
  unappliedCredit: UnappliedCredit | null;
}

export interface ApplyCreditRequest {
  invoiceId: number;
}

export interface PlanBuyersSummary {
  totalAssigned: number;
  expectedLitterSize: number | null;
  availableSpots: number | null;
  isOverbooked: boolean;
  depositSettings: {
    required: boolean;
    amountCents: number | null;
    source: "plan" | "program" | "none";
  };
}

export interface PlanBuyersResponse {
  possibleMatches: BreedingPlanBuyerDTO[];
  inquiries: BreedingPlanBuyerDTO[];
  assigned: BreedingPlanBuyerDTO[];
  matchedToOffspring: BreedingPlanBuyerDTO[];
  summary: PlanBuyersSummary;
}

export interface AddPlanBuyerRequest {
  waitlistEntryId?: number;
  partyId?: number;
  stage?: BreedingPlanBuyerStage;
  priority?: number;
  notes?: string;
}

export interface UpdatePlanBuyerRequest {
  stage?: BreedingPlanBuyerStage;
  priority?: number;
  notes?: string;
}

export interface ReorderPlanBuyersRequest {
  buyerIds: number[];
}

export interface RefreshMatchesResponse {
  added: number;
  removed: number;
  updated: number;
  matches: BreedingPlanBuyerDTO[];
}

export interface BulkAssignRequest {
  buyerIds: number[];
}

