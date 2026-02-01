// src/services/microchip-ownership-transfer.ts
/**
 * Microchip Ownership Transfer Service
 *
 * Handles automatic transfer of microchip registration ownership when offspring is placed.
 * - Creates AnimalMicrochipRegistration if offspring has microchip but no registration
 * - Updates existing registrations to link to buyer's contact
 * - Creates AnimalOwner records so buyer receives renewal notifications
 */

import prisma from "../prisma.js";

interface TransferResult {
  success: boolean;
  registrationsUpdated: number;
  registrationsCreated: number;
  ownerRecordsCreated: number;
  error?: string;
}

/**
 * Transfer microchip registration ownership when offspring is placed.
 * Called when offspring.placementState transitions to PLACED.
 *
 * @param offspringId - The offspring ID being placed
 * @param tenantId - Tenant ID for scoping
 * @returns TransferResult with counts of updated/created records
 */
export async function transferMicrochipOwnership(
  offspringId: number,
  tenantId: number
): Promise<TransferResult> {
  const result: TransferResult = {
    success: true,
    registrationsUpdated: 0,
    registrationsCreated: 0,
    ownerRecordsCreated: 0,
  };

  try {
    // Get offspring with buyer party and microchip registrations
    const offspring = await prisma.offspring.findUnique({
      where: { id: offspringId },
      include: {
        buyerParty: {
          include: {
            contact: true, // Get linked Contact if exists
          },
        },
        microchipRegistrations: {
          include: {
            registry: true,
          },
        },
      },
    });

    if (!offspring) {
      console.log(`[microchip-ownership-transfer] Offspring ${offspringId} not found`);
      result.success = false;
      result.error = "offspring_not_found";
      return result;
    }

    if (!offspring.buyerPartyId) {
      console.log(`[microchip-ownership-transfer] Offspring ${offspringId} has no buyer`);
      // Not an error - just no buyer to transfer to
      return result;
    }

    // Find the Contact linked to the buyer Party
    const buyerContactId = offspring.buyerParty?.contact?.id ?? null;

    // Get microchip number from offspring data field
    const offspringData = offspring.data as Record<string, unknown> | null;
    const microchipNumber = offspringData?.microchip as string | null;

    // Update existing registrations to link to buyer contact
    if (offspring.microchipRegistrations.length > 0) {
      for (const registration of offspring.microchipRegistrations) {
        if (registration.registeredToContactId !== buyerContactId) {
          await prisma.animalMicrochipRegistration.update({
            where: { id: registration.id },
            data: { registeredToContactId: buyerContactId },
          });
          result.registrationsUpdated++;
          console.log(
            `[microchip-ownership-transfer] Updated registration ${registration.id} to buyer contact ${buyerContactId}`
          );
        }
      }
    } else if (microchipNumber) {
      // Offspring has microchip but no registration - create one with default registry
      const defaultRegistry = await prisma.microchipRegistry.findFirst({
        where: {
          slug: "other",
          isActive: true,
        },
      });

      if (defaultRegistry) {
        await prisma.animalMicrochipRegistration.create({
          data: {
            tenantId,
            offspringId,
            microchipNumber,
            registryId: defaultRegistry.id,
            registeredToContactId: buyerContactId,
          },
        });
        result.registrationsCreated++;
        console.log(
          `[microchip-ownership-transfer] Created registration for offspring ${offspringId} with chip ${microchipNumber}`
        );
      }
    }

    // Create AnimalOwner records for buyer to receive notifications
    // This links the buyer party to the dam and sire animals
    const animalIdsToLink: number[] = [];
    if (offspring.damId) animalIdsToLink.push(offspring.damId);
    if (offspring.sireId) animalIdsToLink.push(offspring.sireId);
    if (offspring.promotedAnimalId) animalIdsToLink.push(offspring.promotedAnimalId);

    for (const animalId of animalIdsToLink) {
      // Check if AnimalOwner already exists
      const existingOwner = await prisma.animalOwner.findFirst({
        where: {
          animalId,
          partyId: offspring.buyerPartyId,
        },
      });

      if (!existingOwner) {
        try {
          await prisma.animalOwner.create({
            data: {
              animalId,
              partyId: offspring.buyerPartyId!,
              percent: 0, // Not a percentage owner, just receives notifications
              isPrimary: false,
              role: "SILENT_PARTNER", // Has interest via offspring purchase but no management role
              receiveNotifications: true, // Enable notifications for buyer
              effectiveDate: new Date(),
            },
          });
          result.ownerRecordsCreated++;
          console.log(
            `[microchip-ownership-transfer] Created AnimalOwner for party ${offspring.buyerPartyId} on animal ${animalId}`
          );
        } catch (err: any) {
          // Ignore unique constraint violations (race condition)
          if (!err.code?.includes("P2002")) {
            throw err;
          }
        }
      }
    }

    console.log(
      `[microchip-ownership-transfer] Transfer complete for offspring ${offspringId}: ` +
        `${result.registrationsUpdated} updated, ${result.registrationsCreated} created, ` +
        `${result.ownerRecordsCreated} owner records`
    );

    return result;
  } catch (err: any) {
    console.error(`[microchip-ownership-transfer] Failed for offspring ${offspringId}:`, err);
    result.success = false;
    result.error = err.message || "unknown_error";
    return result;
  }
}

/**
 * Check if offspring just transitioned to PLACED state.
 * Compares previous state with new state.
 */
export function isPlacementTransition(
  previousState: string | null | undefined,
  newState: string | null | undefined
): boolean {
  return previousState !== "PLACED" && newState === "PLACED";
}
