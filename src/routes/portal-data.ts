// src/routes/portal-data.ts
// Read-only endpoints for client portal value surfaces
// All endpoints enforce requireClientPartyScope for party-based data isolation

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { requireClientPartyScope } from "../middleware/actor-context.js";

const portalDataRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/portal/agreements
   * Returns contracts where the authenticated client party is a ContractParty
   * Read-only: status and metadata only, no edit or sign operations
   */
  app.get("/portal/agreements", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);

      // Find all contracts where this party is a participant
      const contractParties = await prisma.contractParty.findMany({
        where: {
          tenantId,
          partyId,
        },
        include: {
          contract: {
            select: {
              id: true,
              title: true,
              status: true,
              issuedAt: true,
              expiresAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const agreements = contractParties.map((cp) => ({
        id: cp.contract.id,
        name: cp.contract.title,
        status: cp.contract.status,
        effectiveDate: cp.contract.issuedAt ? new Date(cp.contract.issuedAt).toISOString() : null,
        expirationDate: cp.contract.expiresAt ? new Date(cp.contract.expiresAt).toISOString() : null,
        role: cp.role || "UNKNOWN",
        signedAt: cp.signedAt ? new Date(cp.signedAt).toISOString() : null,
        createdAt: new Date(cp.contract.createdAt).toISOString(),
        updatedAt: new Date(cp.contract.updatedAt).toISOString(),
      }));

      return reply.send({ agreements });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list portal agreements");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * GET /api/v1/portal/agreements/:id
   * Returns agreement detail if the authenticated client party is a participant
   * Read-only: detailed view with timeline, parties, status
   */
  app.get<{ Params: { id: string } }>("/portal/agreements/:id", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const agreementId = parseInt(req.params.id, 10);

      if (isNaN(agreementId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Find the contract party link to verify access
      const contractParty = await prisma.contractParty.findFirst({
        where: {
          tenantId,
          partyId,
          contractId: agreementId,
        },
        include: {
          contract: {
            select: {
              id: true,
              title: true,
              status: true,
              issuedAt: true,
              signedAt: true,
              voidedAt: true,
              expiresAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          party: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!contractParty) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Find all other parties on this contract (counterparties)
      const allParties = await prisma.contractParty.findMany({
        where: {
          tenantId,
          contractId: agreementId,
        },
        include: {
          party: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          order: "asc",
        },
      });

      // Separate client party from counterparties
      const counterparties = allParties
        .filter((cp) => cp.partyId !== partyId)
        .map((cp) => ({
          role: cp.role || "Other Party",
          name: cp.name || cp.party?.name || "Unknown",
          signedAt: cp.signedAt ? new Date(cp.signedAt).toISOString() : null,
        }));

      const agreement = {
        id: contractParty.contract.id,
        title: contractParty.contract.title,
        status: contractParty.contract.status,
        issuedAt: contractParty.contract.issuedAt ? new Date(contractParty.contract.issuedAt).toISOString() : null,
        signedAt: contractParty.contract.signedAt ? new Date(contractParty.contract.signedAt).toISOString() : null,
        voidedAt: contractParty.contract.voidedAt ? new Date(contractParty.contract.voidedAt).toISOString() : null,
        expiresAt: contractParty.contract.expiresAt ? new Date(contractParty.contract.expiresAt).toISOString() : null,
        createdAt: new Date(contractParty.contract.createdAt).toISOString(),
        clientParty: {
          role: contractParty.role || "Party",
          name: contractParty.name || contractParty.party?.name || "You",
          signedAt: contractParty.signedAt ? new Date(contractParty.signedAt).toISOString() : null,
        },
        counterparties,
      };

      return reply.send({ agreement });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to load portal agreement detail");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * GET /api/v1/portal/documents
   * Returns documents scoped to the client party
   * Includes offspring documents linked to offspring where party is buyer
   * Read-only: list and download only, no upload or delete
   */
  app.get("/portal/documents", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);

      // Find offspring documents for offspring where this party is a buyer
      // OffspringDocument links to Attachment (not Document) via fileId
      const offspringDocuments = await prisma.offspringDocument.findMany({
        where: {
          tenantId,
          offspring: {
            group: {
              groupBuyerLinks: {
                some: {
                  buyerPartyId: partyId,
                },
              },
            },
          },
          fileId: {
            not: null,
          },
        },
        include: {
          file: {
            select: {
              id: true,
              filename: true,
              mime: true,
              bytes: true,
              createdAt: true,
            },
          },
          offspring: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const documents = offspringDocuments
        .filter((od) => od.file !== null)
        .map((od) => ({
          id: od.file!.id,
          name: od.file!.filename,
          description: null,
          category: null,
          uploadedAt: od.file!.createdAt.toISOString(),
          fileUrl: null, // Will be provided via download endpoint
          mimeType: od.file!.mime,
          fileSizeBytes: od.file!.bytes,
          source: "offspring" as const,
          offspringId: od.offspring.id,
          offspringName: od.offspring.name,
        }));

      return reply.send({ documents });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list portal documents");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  // TODO: Implement document download endpoint when storage is configured
  // Route: GET /api/v1/portal/documents/:id/download
  // Implementation requirements:
  // 1. Verify party access via Attachment -> OffspringDocument -> Offspring -> Group -> GroupBuyerLinks
  // 2. Return 404 for out-of-scope access (party doesn't own document)
  // 3. Determine storage backend from attachment.storageProvider (S3, local, etc.)
  // 4. Fetch file using attachment.storageKey
  // 5. Stream file with Content-Disposition: attachment; filename="<attachment.filename>"
  // 6. Set Content-Type from attachment.mime
  // 7. Log download for audit trail
  // See RUNTIME_VERIFICATION.md for reference implementation

  /**
   * GET /api/v1/portal/offspring
   * Returns offspring placement details for offspring where party is a buyer
   * Read-only: placement status, basic info, linked documents
   */
  app.get("/portal/offspring", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);

      // Find offspring where this party is the buyer
      const offspring = await prisma.offspring.findMany({
        where: {
          tenantId,
          buyerPartyId: partyId,
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              actualBirthOn: true,
              species: true,
              dam: {
                select: {
                  id: true,
                  name: true,
                },
              },
              sire: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      function mapOffspringStateToPlacementStatus(o: any): string {
        if (o.placedAt) return "PLACED";
        if (o.pickupAt && !o.placedAt) return "READY_FOR_PICKUP";
        if (o.paidInFullAt) return "FULLY_PAID";
        if (o.contractSignedAt || o.financialState === "DEPOSIT_PAID") return "DEPOSIT_PAID";
        if (o.buyerPartyId) return "RESERVED";
        return "WAITLISTED";
      }

      const placements = offspring.map((o) => ({
        id: o.id,
        offspringGroupId: o.group.id,
        offspringGroupCode: o.group.name || `Group-${o.group.id}`,
        offspringGroupLabel: o.group.name,
        birthDate: o.group.actualBirthOn ? o.group.actualBirthOn.toISOString() : o.bornAt?.toISOString() || null,
        species: o.group.species,
        breed: o.breed,
        dam: o.group.dam,
        sire: o.group.sire,
        offspring: {
          id: o.id,
          name: o.name || "Unnamed",
          sex: o.sex,
        },
        placementStatus: mapOffspringStateToPlacementStatus(o),
        depositPaidAt: null, // Would need to query related invoices/payments
        fullPricePaidAt: o.paidInFullAt?.toISOString() || null,
        pickedUpAt: o.pickupAt?.toISOString() || null,
        createdAt: o.createdAt.toISOString(),
      }));

      return reply.send({ placements });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list portal offspring");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * GET /api/v1/portal/offspring/:id
   * Returns offspring detail if the authenticated client party is the buyer
   * Read-only: detailed view with timeline, parents, placement info
   */
  app.get<{ Params: { id: string } }>("/portal/offspring/:id", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const offspringId = parseInt(req.params.id, 10);

      if (isNaN(offspringId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const offspring = await prisma.offspring.findFirst({
        where: {
          id: offspringId,
          tenantId,
          buyerPartyId: partyId,
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              actualBirthOn: true,
              species: true,
              dam: {
                select: {
                  id: true,
                  name: true,
                },
              },
              sire: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!offspring) {
        return reply.code(404).send({ error: "not_found" });
      }

      function mapOffspringStateToPlacementStatus(o: any): string {
        if (o.placedAt) return "PLACED";
        if (o.pickupAt && !o.placedAt) return "READY_FOR_PICKUP";
        if (o.paidInFullAt) return "FULLY_PAID";
        if (o.contractSignedAt || o.financialState === "DEPOSIT_PAID") return "DEPOSIT_PAID";
        if (o.buyerPartyId) return "RESERVED";
        return "WAITLISTED";
      }

      const detail = {
        id: offspring.id,
        name: offspring.name || "Unnamed",
        sex: offspring.sex,
        breed: offspring.breed,
        species: offspring.group.species,
        birthDate: offspring.group.actualBirthOn
          ? offspring.group.actualBirthOn.toISOString()
          : offspring.bornAt?.toISOString() || null,
        placementStatus: mapOffspringStateToPlacementStatus(offspring),
        dam: offspring.group.dam,
        sire: offspring.group.sire,
        groupId: offspring.group.id,
        groupName: offspring.group.name,
        contractSignedAt: offspring.contractSignedAt?.toISOString() || null,
        paidInFullAt: offspring.paidInFullAt?.toISOString() || null,
        pickupAt: offspring.pickupAt?.toISOString() || null,
        placedAt: offspring.placedAt?.toISOString() || null,
        createdAt: offspring.createdAt.toISOString(),
      };

      return reply.send({ offspring: detail });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to load portal offspring detail");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });
};

export default portalDataRoutes;
