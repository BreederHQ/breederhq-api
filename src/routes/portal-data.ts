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
              name: true,
              status: true,
              effectiveDate: true,
              expirationDate: true,
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
        name: cp.contract.name,
        status: cp.contract.status,
        effectiveDate: cp.contract.effectiveDate,
        expirationDate: cp.contract.expirationDate,
        role: cp.role,
        signedAt: cp.signedAt,
        createdAt: cp.contract.createdAt,
        updatedAt: cp.contract.updatedAt,
      }));

      return reply.send({ agreements });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list portal agreements");
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

      // Find documents directly linked to this party
      const partyDocuments = await prisma.document.findMany({
        where: {
          tenantId,
          scope: "PARTY",
          partyId,
        },
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          uploadedAt: true,
          uploadedByUserId: true,
          fileUrl: true,
          mimeType: true,
          fileSizeBytes: true,
        },
        orderBy: {
          uploadedAt: "desc",
        },
      });

      // Find offspring documents for offspring where this party is a buyer
      const offspringDocuments = await prisma.offspringDocument.findMany({
        where: {
          tenantId,
          offspring: {
            group: {
              buyers: {
                some: {
                  buyerPartyId: partyId,
                },
              },
            },
          },
        },
        include: {
          document: {
            select: {
              id: true,
              name: true,
              description: true,
              category: true,
              uploadedAt: true,
              fileUrl: true,
              mimeType: true,
              fileSizeBytes: true,
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

      const documents = [
        ...partyDocuments.map((doc) => ({
          id: doc.id,
          name: doc.name,
          description: doc.description,
          category: doc.category,
          uploadedAt: doc.uploadedAt,
          fileUrl: doc.fileUrl,
          mimeType: doc.mimeType,
          fileSizeBytes: doc.fileSizeBytes,
          source: "party" as const,
        })),
        ...offspringDocuments.map((od) => ({
          id: od.document.id,
          name: od.document.name,
          description: od.document.description,
          category: od.document.category,
          uploadedAt: od.document.uploadedAt,
          fileUrl: od.document.fileUrl,
          mimeType: od.document.mimeType,
          fileSizeBytes: od.document.fileSizeBytes,
          source: "offspring" as const,
          offspringId: od.offspring.id,
          offspringName: od.offspring.name,
        })),
      ];

      // Sort by uploadedAt desc
      documents.sort((a, b) => {
        const aDate = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
        const bDate = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
        return bDate - aDate;
      });

      return reply.send({ documents });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list portal documents");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * GET /api/v1/portal/offspring
   * Returns offspring placement details for offspring where party is a buyer
   * Read-only: placement status, basic info, linked documents
   */
  app.get("/portal/offspring", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);

      // Find offspring groups where this party is a buyer
      const buyers = await prisma.offspringGroupBuyer.findMany({
        where: {
          tenantId,
          buyerPartyId: partyId,
        },
        include: {
          group: {
            select: {
              id: true,
              code: true,
              label: true,
              birthDate: true,
              species: true,
              breed: true,
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
          offspring: {
            select: {
              id: true,
              name: true,
              sex: true,
              color: true,
              microchipId: true,
              registrationNumber: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const placements = buyers.map((buyer) => ({
        id: buyer.id,
        offspringGroupId: buyer.group.id,
        offspringGroupCode: buyer.group.code,
        offspringGroupLabel: buyer.group.label,
        birthDate: buyer.group.birthDate,
        species: buyer.group.species,
        breed: buyer.group.breed,
        dam: buyer.group.dam,
        sire: buyer.group.sire,
        offspring: buyer.offspring,
        placementStatus: buyer.placementStatus,
        depositPaidAt: buyer.depositPaidAt,
        fullPricePaidAt: buyer.fullPricePaidAt,
        pickedUpAt: buyer.pickedUpAt,
        createdAt: buyer.createdAt,
      }));

      return reply.send({ placements });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list portal offspring");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });
};

export default portalDataRoutes;
