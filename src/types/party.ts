export type PartyType = "PERSON" | "ORGANIZATION";

export type PartyStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type PartyAddress = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
};

export type PartyBacking = {
  contactId: number | null;
  organizationId: number | null;
};

export type PartyRead = {
  partyId: number;
  type: PartyType;
  backing: PartyBacking;
  displayName: string;
  organizationName: string | null;
  organizationPartyId: number | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  address: PartyAddress | null;
  status: PartyStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};
