import type { CommChannel, PreferenceLevel, ComplianceStatus } from "@prisma/client";
import prisma from "../prisma.js";

export type CommPreferenceRead = {
  channel: CommChannel;
  preference: PreferenceLevel;
  compliance: ComplianceStatus | null;
  complianceSetAt: Date | null;
  complianceSource: string | null;
};

export type CommPreferenceUpdate = {
  channel: CommChannel;
  preference?: PreferenceLevel;
  compliance?: ComplianceStatus | null;
  complianceSource?: string | null;
};

const ALL_CHANNELS: CommChannel[] = ["EMAIL", "SMS", "PHONE", "MAIL", "WHATSAPP"];
const COMPLIANCE_ALLOWED_CHANNELS: CommChannel[] = ["EMAIL", "SMS"];

/**
 * Get communication preferences for a party. Returns defaults (ALLOW) for missing channels.
 */
export async function getCommPreferences(partyId: number): Promise<CommPreferenceRead[]> {
  const existing = await prisma.partyCommPreference.findMany({
    where: { partyId },
    orderBy: { channel: "asc" },
  });

  const existingMap = new Map(existing.map((p) => [p.channel, p]));

  // Return all 5 channels, using DB values where available, defaults otherwise
  return ALL_CHANNELS.map((channel) => {
    const pref = existingMap.get(channel);
    if (pref) {
      return {
        channel: pref.channel,
        preference: pref.preference,
        compliance: pref.compliance,
        complianceSetAt: pref.complianceSetAt,
        complianceSource: pref.complianceSource,
      };
    }
    // Default
    return {
      channel,
      preference: "ALLOW" as PreferenceLevel,
      compliance: null,
      complianceSetAt: null,
      complianceSource: null,
    };
  });
}

/**
 * Check if a party can be contacted via a specific channel.
 * Returns true if the party allows contact on this channel (preference is ALLOW).
 */
export async function canContactViaChannel(partyId: number, channel: CommChannel): Promise<boolean> {
  const pref = await prisma.partyCommPreference.findUnique({
    where: { partyId_channel: { partyId, channel } },
  });

  // Default is ALLOW if no preference is set
  if (!pref) return true;

  return pref.preference === "ALLOW";
}

/**
 * Update (upsert) communication preferences. Only creates events when values actually change.
 * Validates compliance fields are only set for EMAIL and SMS channels.
 */
export async function updateCommPreferences(
  partyId: number,
  updates: CommPreferenceUpdate[],
  actorPartyId?: number,
  source?: string
): Promise<CommPreferenceRead[]> {
  // Validate compliance is only set for allowed channels
  for (const update of updates) {
    if (
      (update.compliance !== undefined || update.complianceSource !== undefined) &&
      !COMPLIANCE_ALLOWED_CHANNELS.includes(update.channel)
    ) {
      throw new Error(
        `Compliance fields are only allowed for ${COMPLIANCE_ALLOWED_CHANNELS.join(", ")} channels. Got: ${update.channel}`
      );
    }
  }

  // Process each update
  for (const update of updates) {
    const existing = await prisma.partyCommPreference.findUnique({
      where: { partyId_channel: { partyId, channel: update.channel } },
    });

    const prevPreference = existing?.preference ?? null;
    const prevCompliance = existing?.compliance ?? null;
    const newPreference = update.preference ?? prevPreference ?? "ALLOW";
    const newCompliance = update.compliance !== undefined ? update.compliance : prevCompliance;

    // Determine if we need to set complianceSetAt
    let complianceSetAt = existing?.complianceSetAt ?? null;
    if (update.compliance !== undefined && update.compliance !== prevCompliance) {
      complianceSetAt = new Date();
    }

    // Upsert the preference
    await prisma.partyCommPreference.upsert({
      where: { partyId_channel: { partyId, channel: update.channel } },
      create: {
        partyId,
        channel: update.channel,
        preference: newPreference,
        compliance: newCompliance,
        complianceSetAt,
        complianceSource: update.complianceSource ?? null,
      },
      update: {
        preference: newPreference,
        compliance: newCompliance,
        complianceSetAt,
        complianceSource: update.complianceSource !== undefined ? update.complianceSource : existing?.complianceSource,
      },
    });

    // Only create event if something actually changed
    const prefChanged = prevPreference !== newPreference;
    const complianceChanged = prevCompliance !== newCompliance;

    if (prefChanged || complianceChanged) {
      await prisma.partyCommPreferenceEvent.create({
        data: {
          partyId,
          channel: update.channel,
          prevPreference,
          newPreference: prefChanged ? newPreference : null,
          prevCompliance,
          newCompliance: complianceChanged ? newCompliance : null,
          actorPartyId: actorPartyId ?? null,
          reason: null,
          source: source ?? null,
        },
      });
    }
  }

  // Return updated preferences
  return getCommPreferences(partyId);
}

export const CommPrefsService = {
  getCommPreferences,
  updateCommPreferences,
};
