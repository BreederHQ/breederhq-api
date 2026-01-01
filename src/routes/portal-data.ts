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

  /**
   * GET /api/v1/portal/documents/:id/download
   * Download a document that is scoped to the client party
   * Verifies party access before streaming file
   */
  app.get("/portal/documents/:id/download", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const documentId = Number((req.params as any).id);

      if (!documentId || isNaN(documentId)) {
        return reply.code(400).send({ error: "invalid_document_id" });
      }

      // Find the attachment and verify it's linked to an offspring where party is buyer
      const attachment = await prisma.attachment.findFirst({
        where: {
          id: documentId,
          tenantId,
        },
        include: {
          OffspringDocument: {
            where: {
              offspring: {
                group: {
                  groupBuyerLinks: {
                    some: {
                      buyerPartyId: partyId,
                    },
                  },
                },
              },
            },
            take: 1,
          },
        },
      });

      // Return 404 if document doesn't exist or party doesn't have access
      if (!attachment || attachment.OffspringDocument.length === 0) {
        return reply.code(404).send({ error: "not_found" });
      }

      // TODO: Implement actual file streaming when storage is configured
      // For now, return 501 Not Implemented
      // When implementing:
      // 1. Use attachment.storageProvider to determine storage backend
      // 2. Use attachment.storageKey to fetch file
      // 3. Stream file with proper Content-Disposition header
      // 4. Log download for audit trail

      return reply.code(501).send({
        error: "not_implemented",
        message: "File storage not yet configured",
        debug: {
          filename: attachment.filename,
          mime: attachment.mime,
          bytes: attachment.bytes,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to download portal document");
      return reply.code(500).send({ error: "failed_to_download" });
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
          color: null, // Offspring model doesn't have color field
          microchipId: null, // Offspring model doesn't have microchipId
          registrationNumber: null, // Offspring model doesn't have registrationNumber
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
};

export default portalDataRoutes;
