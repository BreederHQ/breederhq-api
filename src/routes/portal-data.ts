// src/routes/portal-data.ts
// Read-only endpoints for client portal value surfaces
// All endpoints enforce requireClientPartyScope for party-based data isolation

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { requireClientPartyScope } from "../middleware/actor-context.js";
import { stripe } from "../services/stripe-service.js";

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

  /**
   * GET /api/v1/portal/documents/:id/download
   * Returns a presigned URL for downloading a document
   * Access: Party must be a buyer linked to the offspring group containing this document
   * Note: :id is the Attachment ID (file.id) as returned by /portal/documents
   */
  app.get<{ Params: { id: string } }>("/portal/documents/:id/download", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const fileId = parseInt(req.params.id, 10);

      if (isNaN(fileId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Find the document via the same access path used by /portal/documents list endpoint
      // OffspringDocument -> Offspring -> Group -> GroupBuyerLinks -> buyerPartyId
      const offspringDocument = await prisma.offspringDocument.findFirst({
        where: {
          tenantId,
          fileId,
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
        include: {
          file: true,
          offspring: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!offspringDocument) {
        // Either document doesn't exist or party doesn't have access
        req.log?.warn?.({ fileId, partyId }, "Document access denied or not found");
        return reply.code(404).send({ error: "document_not_found" });
      }

      // Get the file attachment
      const attachment = offspringDocument.file;
      if (!attachment || !attachment.storageKey) {
        req.log?.error?.({ fileId }, "Document has no associated storage key");
        return reply.code(404).send({ error: "file_not_found" });
      }

      // Generate presigned download URL
      const { generatePresignedDownloadUrl } = await import("../services/media-storage.js");
      const { url, expiresIn } = await generatePresignedDownloadUrl(
        attachment.storageKey,
        3600 // 1 hour expiry
      );

      // Log the download for audit trail
      req.log?.info?.({
        action: "portal_document_download",
        fileId,
        offspringDocumentId: offspringDocument.id,
        offspringId: offspringDocument.offspring.id,
        partyId,
        tenantId,
        filename: attachment.filename,
      }, "Portal document download");

      // Return the download URL
      return reply.send({
        downloadUrl: url,
        filename: attachment.filename || `document-${fileId}`,
        mimeType: attachment.mime || "application/octet-stream",
        expiresIn,
      });

    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to generate document download URL");
      return reply.code(500).send({ error: "download_failed" });
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

  /**
   * GET /api/v1/portal/placements
   * Alias for /portal/offspring - returns the same data for frontend compatibility
   * The frontend uses both "placements" and "offspring" terminology
   */
  app.get("/portal/placements", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);

      // Find offspring where this party is the buyer (same logic as /portal/offspring)
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
        depositPaidAt: null,
        fullPricePaidAt: o.paidInFullAt?.toISOString() || null,
        pickedUpAt: o.pickupAt?.toISOString() || null,
        createdAt: o.createdAt.toISOString(),
      }));

      return reply.send({ placements });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list portal placements");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * GET /api/v1/portal/financials
   * Returns financial summary for the client party
   * Includes totals, overdue amounts, and next payment info
   */
  app.get("/portal/financials", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);

      // Find invoices where this party is the buyer (via offspring)
      // First get offspring IDs for this party
      const partyOffspring = await prisma.offspring.findMany({
        where: {
          tenantId,
          buyerPartyId: partyId,
        },
        select: { id: true },
      });
      const offspringIds = partyOffspring.map((o) => o.id);

      // Find invoices linked to these offspring or directly to this party
      const invoices = await prisma.invoice.findMany({
        where: {
          tenantId,
          OR: [
            { clientPartyId: partyId },
            { offspringId: { in: offspringIds } },
          ],
        },
        select: {
          id: true,
          status: true,
          amountCents: true,
          balanceCents: true,
          issuedAt: true,
          dueAt: true,
          paidAt: true,
        },
        orderBy: { dueAt: "asc" },
      });

      const now = new Date();

      // Calculate summary (amounts stored in cents, convert to dollars for API response)
      let totalPaidCents = 0;
      let totalDueCents = 0;
      let overdueAmountCents = 0;
      let nextPaymentAmountCents: number | null = null;
      let nextPaymentDueAt: string | null = null;

      for (const inv of invoices) {
        const amountCents = Number(inv.amountCents || 0);
        const balanceCents = Number(inv.balanceCents || 0);
        const paidCents = amountCents - balanceCents;

        totalPaidCents += paidCents;

        if (balanceCents > 0) {
          totalDueCents += balanceCents;

          // Check if overdue
          if (inv.dueAt && new Date(inv.dueAt) < now && inv.status !== "paid") {
            overdueAmountCents += balanceCents;
          }

          // Track next payment (first unpaid invoice)
          if (nextPaymentAmountCents === null && inv.status !== "paid") {
            nextPaymentAmountCents = balanceCents;
            nextPaymentDueAt = inv.dueAt?.toISOString() || null;
          }
        }
      }

      // Convert cents to dollars for API response
      const totalPaid = totalPaidCents / 100;
      const totalDue = totalDueCents / 100;
      const overdueAmount = overdueAmountCents / 100;
      const nextPaymentAmount = nextPaymentAmountCents !== null ? nextPaymentAmountCents / 100 : null;

      return reply.send({
        totalPaid,
        totalDue,
        overdueAmount,
        nextPaymentAmount,
        nextPaymentDueAt,
        invoiceCount: invoices.length,
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to load portal financials");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * GET /api/v1/portal/invoices
   * Returns list of invoices for the client party
   */
  app.get("/portal/invoices", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);

      // Get offspring IDs for this party
      const partyOffspring = await prisma.offspring.findMany({
        where: {
          tenantId,
          buyerPartyId: partyId,
        },
        select: { id: true, name: true },
      });
      const offspringIds = partyOffspring.map((o) => o.id);
      const offspringMap = new Map(partyOffspring.map((o) => [o.id, o.name]));

      // Find invoices linked to these offspring or directly to this party
      const invoices = await prisma.invoice.findMany({
        where: {
          tenantId,
          OR: [
            { clientPartyId: partyId },
            { offspringId: { in: offspringIds } },
          ],
        },
        include: {
          LineItems: {
            select: {
              id: true,
              description: true,
              qty: true,
              unitCents: true,
              totalCents: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const result = invoices.map((inv) => {
        // Determine status for frontend
        let status: string = inv.status;
        if (inv.status === "issued" || inv.status === "partially_paid") {
          const now = new Date();
          if (inv.dueAt && new Date(inv.dueAt) < now) {
            status = "overdue";
          } else {
            status = "due";
          }
        }

        // Calculate amounts from cents
        const total = Number(inv.amountCents) / 100;
        const amountDue = Number(inv.balanceCents) / 100;
        const amountPaid = (Number(inv.amountCents) - Number(inv.balanceCents)) / 100;

        // Build description from line items or notes
        const description = inv.notes || (inv.LineItems.length > 0 ? inv.LineItems[0].description : "Invoice");

        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber || `INV-${inv.id}`,
          description,
          total,
          subtotal: total, // No separate subtotal field, use total
          tax: 0, // Tax calculated per line item, not stored on invoice
          amountPaid,
          amountDue,
          status,
          issuedAt: inv.issuedAt?.toISOString() || inv.createdAt.toISOString(),
          dueAt: inv.dueAt?.toISOString() || null,
          paidAt: inv.paidAt?.toISOString() || null,
          relatedOffspringName: inv.offspringId ? offspringMap.get(inv.offspringId) || null : null,
          lineItems: inv.LineItems.map((li) => ({
            id: li.id,
            description: li.description,
            quantity: li.qty,
            unitPrice: li.unitCents / 100,
            total: li.totalCents / 100,
          })),
        };
      });

      return reply.send({ invoices: result });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list portal invoices");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * GET /api/v1/portal/threads
   * Returns message threads for the client party
   * Wrapper that re-uses the messaging party scope pattern
   */
  app.get("/portal/threads", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);

      // Get threads where user's party is a participant
      const participantRecords = await prisma.messageParticipant.findMany({
        where: { partyId },
        select: { threadId: true, lastReadAt: true },
      });

      const threadIds = participantRecords.map((p) => p.threadId);
      if (threadIds.length === 0) {
        return reply.send({ threads: [] });
      }

      const threads = await prisma.messageThread.findMany({
        where: { id: { in: threadIds }, tenantId },
        include: {
          participants: {
            include: { party: { select: { id: true, name: true, email: true, type: true } } },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      // Calculate unread count
      const threadsWithUnread = await Promise.all(
        threads.map(async (t) => {
          const participant = participantRecords.find((p) => p.threadId === t.id);
          const lastReadAt = participant?.lastReadAt;

          const unreadCount = lastReadAt
            ? await prisma.message.count({
                where: {
                  threadId: t.id,
                  createdAt: { gt: lastReadAt },
                  senderPartyId: { not: partyId },
                },
              })
            : await prisma.message.count({
                where: {
                  threadId: t.id,
                  senderPartyId: { not: partyId },
                },
              });

          return {
            ...t,
            unreadCount,
          };
        })
      );

      return reply.send({ threads: threadsWithUnread });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list portal threads");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * GET /api/v1/portal/invoices/:id
   * Returns a single invoice detail if the authenticated client party owns it
   */
  app.get<{ Params: { id: string } }>("/portal/invoices/:id", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const invoiceId = parseInt(req.params.id, 10);

      if (isNaN(invoiceId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          tenantId,
          clientPartyId: partyId,
        },
        include: {
          LineItems: {
            select: {
              id: true,
              description: true,
              qty: true,
              unitCents: true,
              totalCents: true,
            },
          },
        },
      });

      if (!invoice) {
        return reply.code(404).send({ error: "not_found" });
      }

      return reply.send({
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id}`,
          amountCents: invoice.amountCents,
          balanceCents: invoice.balanceCents,
          status: invoice.status,
          issuedAt: invoice.issuedAt?.toISOString() || invoice.createdAt.toISOString(),
          dueAt: invoice.dueAt?.toISOString() || null,
          paidAt: invoice.paidAt?.toISOString() || null,
          lineItems: invoice.LineItems.map((li) => ({
            id: li.id,
            description: li.description,
            quantity: li.qty,
            unitPrice: li.unitCents,
            total: li.totalCents,
          })),
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to load portal invoice detail");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * POST /api/v1/portal/invoices/:id/checkout
   * Creates a Stripe Checkout session for paying an invoice
   *
   * Authorization:
   * - User must be authenticated portal user
   * - Invoice's clientPartyId must match the portal user's partyId
   * - Invoice status must be payable (not PAID, VOID, or DRAFT)
   *
   * Response:
   * { checkoutUrl: string, sessionId: string }
   */
  app.post<{ Params: { id: string } }>("/portal/invoices/:id/checkout", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const invoiceId = parseInt(req.params.id, 10);

      if (isNaN(invoiceId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Fetch invoice with tenant context
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          tenantId,
        },
        include: {
          LineItems: true,
          clientParty: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });

      if (!invoice) {
        return reply.code(404).send({ error: "Invoice not found" });
      }

      // Authorization: verify ownership
      if (invoice.clientPartyId !== partyId) {
        return reply.code(403).send({ error: "Access denied" });
      }

      // Validate invoice can be paid
      const nonPayableStatuses = ["paid", "void", "draft"];
      if (nonPayableStatuses.includes(invoice.status)) {
        return reply.code(400).send({
          error: `Invoice cannot be paid (status: ${invoice.status})`,
        });
      }

      // Calculate amount due
      const amountDue = Number(invoice.balanceCents);
      if (amountDue <= 0) {
        return reply.code(400).send({ error: "Invoice has no balance due" });
      }

      // Get tenant info for URLs and Stripe Connect
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          slug: true,
          name: true,
          stripeConnectAccountId: true,
        } as any,
      }) as any;

      if (!tenant?.slug) {
        return reply.code(500).send({ error: "Tenant configuration error" });
      }

      // Build success/cancel URLs
      const portalBaseUrl = process.env.PORTAL_BASE_URL || "https://portal.breederhq.com";
      const successUrl = `${portalBaseUrl}/t/${tenant.slug}/financials?payment=success`;
      const cancelUrl = `${portalBaseUrl}/t/${tenant.slug}/financials?payment=canceled`;

      // Build line items for Stripe
      let stripeLineItems: Array<{
        price_data: {
          currency: string;
          product_data: { name: string };
          unit_amount: number;
        };
        quantity: number;
      }> = [];

      if (invoice.LineItems && invoice.LineItems.length > 0) {
        stripeLineItems = invoice.LineItems.map((item) => ({
          price_data: {
            currency: invoice.currency.toLowerCase(),
            product_data: {
              name: item.description || `Invoice #${invoice.invoiceNumber}`,
            },
            unit_amount: Math.abs(item.unitCents),
          },
          quantity: item.qty,
        }));
      } else {
        // Single line item for total if no line items exist
        stripeLineItems = [
          {
            price_data: {
              currency: invoice.currency.toLowerCase(),
              product_data: {
                name: `Invoice #${invoice.invoiceNumber}`,
              },
              unit_amount: amountDue,
            },
            quantity: 1,
          },
        ];
      }

      // Create Stripe Checkout session params
      const sessionParams: any = {
        mode: "payment",
        line_items: stripeLineItems,
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: invoice.clientParty?.email || undefined,
        metadata: {
          type: "portal_invoice_payment",
          invoiceId: String(invoice.id),
          tenantId: String(tenantId),
          clientPartyId: String(partyId),
          invoiceNumber: invoice.invoiceNumber,
        },
      };

      // If tenant has Stripe Connect, route payment to their account
      if (tenant.stripeConnectAccountId) {
        // Platform fee calculation: 2.9% + $0.30 (example)
        const platformFeeCents = Math.round(amountDue * 0.029) + 30;
        sessionParams.payment_intent_data = {
          application_fee_amount: platformFeeCents,
          transfer_data: {
            destination: tenant.stripeConnectAccountId,
          },
        };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      req.log?.info?.(
        { invoiceId, sessionId: session.id, amountDue },
        "Created Stripe checkout session for portal invoice"
      );

      return reply.send({
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to create portal invoice checkout");
      return reply.code(500).send({ error: "checkout_failed", detail: err.message });
    }
  });

  /**
   * GET /api/v1/portal/breeder
   * Returns basic breeder/organization info for the portal context
   * Primarily used for messaging - returns the org party ID needed to create threads
   */
  app.get("/portal/breeder", async (req, reply) => {
    try {
      const { tenantId } = await requireClientPartyScope(req);

      // Get the tenant's organization (breeder) with their party ID
      const org = await prisma.organization.findFirst({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          partyId: true,
          party: {
            select: {
              email: true,
            },
          },
        },
      });

      if (!org) {
        return reply.code(404).send({ error: "breeder_not_found" });
      }

      return reply.send({
        breeder: {
          orgId: org.id,
          partyId: org.partyId,
          name: org.name,
          email: org.party?.email || null,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to load portal breeder info");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Microchip Registration Endpoints (Buyer Portal)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/portal/offspring/:id/microchip
   * Returns microchip registration info for an offspring owned by the portal user
   */
  app.get<{ Params: { id: string } }>("/portal/offspring/:id/microchip", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const offspringId = parseInt(req.params.id, 10);

      if (isNaN(offspringId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Verify the offspring belongs to this buyer
      const offspring = await prisma.offspring.findFirst({
        where: {
          id: offspringId,
          tenantId,
          buyerPartyId: partyId,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!offspring) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Get microchip registrations for this offspring
      const registrations = await prisma.animalMicrochipRegistration.findMany({
        where: {
          tenantId,
          offspringId,
        },
        include: {
          registry: {
            select: {
              id: true,
              name: true,
              slug: true,
              website: true,
              renewalType: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Compute status for each registration
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const mappedRegistrations = registrations.map((reg) => {
        let status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "LIFETIME" = "ACTIVE";
        let daysUntilExpiration: number | null = null;

        if (reg.registry.renewalType === "LIFETIME") {
          status = "LIFETIME";
        } else if (reg.expirationDate) {
          const expDate = new Date(reg.expirationDate);
          daysUntilExpiration = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (expDate < now) {
            status = "EXPIRED";
          } else if (expDate <= thirtyDaysFromNow) {
            status = "EXPIRING_SOON";
          }
        }

        return {
          id: reg.id,
          microchipNumber: reg.microchipNumber,
          registry: {
            id: reg.registry.id,
            name: reg.registry.name,
            slug: reg.registry.slug,
            website: reg.registry.website,
            renewalType: reg.registry.renewalType,
          },
          registrationDate: reg.registrationDate?.toISOString() || null,
          expirationDate: reg.expirationDate?.toISOString() || null,
          accountNumber: reg.accountNumber,
          status,
          daysUntilExpiration,
        };
      });

      // Derive the microchip number from the first registration
      const primaryMicrochipNumber = registrations.length > 0 ? registrations[0].microchipNumber : null;

      return reply.send({
        microchip: {
          number: primaryMicrochipNumber,
          registrations: mappedRegistrations,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to load portal offspring microchip");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * PATCH /api/v1/portal/microchip-registrations/:id
   * Allows buyer to update their microchip registration (registration date, expiration, account #)
   */
  app.patch<{
    Params: { id: string };
    Body: {
      registrationDate?: string | null;
      expirationDate?: string | null;
      accountNumber?: string | null;
    };
  }>("/portal/microchip-registrations/:id", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const registrationId = parseInt(req.params.id, 10);

      if (isNaN(registrationId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Find the registration and verify buyer owns the offspring
      const registration = await prisma.animalMicrochipRegistration.findFirst({
        where: {
          id: registrationId,
          tenantId,
        },
        include: {
          offspring: {
            select: {
              buyerPartyId: true,
            },
          },
        },
      });

      if (!registration) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Verify ownership - must be the buyer of the offspring
      if (registration.offspring?.buyerPartyId !== partyId) {
        return reply.code(403).send({ error: "access_denied" });
      }

      // Update only allowed fields
      const { registrationDate, expirationDate, accountNumber } = req.body;

      const updateData: any = {};
      if (registrationDate !== undefined) {
        updateData.registrationDate = registrationDate ? new Date(registrationDate) : null;
      }
      if (expirationDate !== undefined) {
        updateData.expirationDate = expirationDate ? new Date(expirationDate) : null;
      }
      if (accountNumber !== undefined) {
        updateData.accountNumber = accountNumber || null;
      }

      const updated = await prisma.animalMicrochipRegistration.update({
        where: { id: registrationId },
        data: updateData,
        include: {
          registry: {
            select: {
              name: true,
              renewalType: true,
            },
          },
        },
      });

      req.log?.info?.(
        { registrationId, partyId },
        "Portal user updated microchip registration"
      );

      return reply.send({
        registration: {
          id: updated.id,
          registrationDate: updated.registrationDate?.toISOString() || null,
          expirationDate: updated.expirationDate?.toISOString() || null,
          accountNumber: updated.accountNumber,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to update portal microchip registration");
      return reply.code(500).send({ error: "update_failed" });
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Portal Notifications Endpoint
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/portal/notifications
   * Returns notifications related to animals owned by the portal user
   * Filters by animalId in notification metadata
   */
  app.get<{
    Querystring: {
      status?: "UNREAD" | "READ" | "DISMISSED";
      limit?: string;
    };
  }>("/portal/notifications", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const { status, limit: limitStr } = req.query;

      const limit = Math.min(parseInt(limitStr || "50", 10), 100);

      // Get all animal IDs owned by this party (via AnimalOwner or Offspring.buyerPartyId)
      const [ownedAnimals, ownedOffspring] = await Promise.all([
        prisma.animalOwner.findMany({
          where: {
            partyId,
            animal: { tenantId },
          },
          select: { animalId: true },
        }),
        prisma.offspring.findMany({
          where: {
            tenantId,
            buyerPartyId: partyId,
          },
          select: { damId: true, sireId: true, promotedAnimalId: true },
        }),
      ]);

      // Combine all animal IDs (including dam, sire, and promoted animal from offspring)
      const animalIds = new Set<number>();
      ownedAnimals.forEach((o) => animalIds.add(o.animalId));
      ownedOffspring.forEach((o) => {
        if (o.damId) animalIds.add(o.damId);
        if (o.sireId) animalIds.add(o.sireId);
        if (o.promotedAnimalId) animalIds.add(o.promotedAnimalId);
      });

      if (animalIds.size === 0) {
        return reply.send({ notifications: [] });
      }

      // Fetch notifications that have any of these animal IDs in their metadata
      // We need to filter in memory since Prisma JSON filtering is limited
      const allNotifications = await prisma.notification.findMany({
        where: {
          tenantId,
          ...(status ? { status } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit * 10, // Fetch more to filter in memory
      });

      // Filter notifications where metadata.animalId matches one of our animals
      const filteredNotifications = allNotifications.filter((notif) => {
        const metadata = notif.metadata as Record<string, unknown> | null;
        if (!metadata) return false;

        const notifAnimalId = metadata.animalId as number | undefined;
        const notifDamId = metadata.damId as number | undefined;
        const notifSireId = metadata.sireId as number | undefined;

        return (
          (notifAnimalId !== undefined && animalIds.has(notifAnimalId)) ||
          (notifDamId !== undefined && animalIds.has(notifDamId)) ||
          (notifSireId !== undefined && animalIds.has(notifSireId))
        );
      }).slice(0, limit);

      const notifications = filteredNotifications.map((notif) => ({
        id: notif.id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        priority: notif.priority,
        status: notif.status,
        linkUrl: notif.linkUrl,
        createdAt: notif.createdAt.toISOString(),
      }));

      return reply.send({ notifications });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to load portal notifications");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });
};

export default portalDataRoutes;
