// src/routes/portal-contracts.ts
/**
 * Portal Contracts API (Buyer Portal)
 *
 * Endpoints for buyers to:
 * - View contract documents
 * - Sign contracts
 * - Decline contracts
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { requireClientPartyScope } from "../middleware/actor-context.js";
import {
  signContract,
  declineContract,
  canPartySign,
  getSignatureOptionsForTenant,
  logContractViewed,
  type SignContractInput,
} from "../services/contracts/index.js";

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /portal/contracts/:id/signing
   * Get contract details for signing view
   * Returns contract content, signature options, and signing status
   */
  app.get<{ Params: { id: string } }>("/portal/contracts/:id/signing", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const contractId = parseInt(req.params.id, 10);

      if (isNaN(contractId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Find the contract party link to verify access and get signing context
      const contractParty = await prisma.contractParty.findFirst({
        where: {
          tenantId,
          partyId,
          contractId,
        },
        include: {
          contract: {
            include: {
              content: {
                select: { renderedHtml: true },
              },
              template: {
                select: { name: true, category: true },
              },
              parties: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                  status: true,
                  order: true,
                },
                orderBy: { order: "asc" },
              },
            },
          },
        },
      });

      if (!contractParty) {
        return reply.code(404).send({ error: "not_found" });
      }

      const contract = contractParty.contract;

      // Check if contract can be signed
      if (contract.status !== "sent" && contract.status !== "viewed") {
        return reply.code(400).send({
          error: "contract_not_signable",
          message: `Contract is in status: ${contract.status}`,
          status: contract.status,
        });
      }

      // Get signature options based on tenant tier
      const signatureOptions = await getSignatureOptionsForTenant(tenantId);

      // Check if this specific party can sign (order validation)
      const canSignResult = await canPartySign(contractId, contractParty.id);

      // Log view event (idempotent)
      await logContractViewed(req, tenantId, contractId, contractParty.id);

      // Update contract status to viewed if still in sent
      if (contract.status === "sent") {
        await prisma.contract.update({
          where: { id: contractId },
          data: { status: "viewed" },
        });
      }

      // Update party status to viewed if still pending
      if (contractParty.status === "pending") {
        await prisma.contractParty.update({
          where: { id: contractParty.id },
          data: { status: "viewed" },
        });
      }

      return reply.send({
        contract: {
          id: contract.id,
          title: contract.title,
          status: contract.status === "sent" ? "viewed" : contract.status, // Return updated status
          issuedAt: contract.issuedAt?.toISOString(),
          expiresAt: contract.expiresAt?.toISOString(),
          templateName: contract.template?.name,
          templateCategory: contract.template?.category,
        },
        content: contract.content?.renderedHtml || null,
        parties: contract.parties.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          status: p.status,
          isCurrentParty: p.id === contractParty.id,
        })),
        currentParty: {
          id: contractParty.id,
          name: contractParty.name,
          role: contractParty.role,
          status: contractParty.status === "pending" ? "viewed" : contractParty.status,
          canSign: canSignResult.canSign,
          canSignReason: canSignResult.reason,
        },
        signatureOptions,
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to load contract for signing");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * GET /portal/contracts/:id/document
   * Get just the rendered contract document HTML
   * Used for document viewer display
   */
  app.get<{ Params: { id: string } }>("/portal/contracts/:id/document", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const contractId = parseInt(req.params.id, 10);

      if (isNaN(contractId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Verify access
      const contractParty = await prisma.contractParty.findFirst({
        where: {
          tenantId,
          partyId,
          contractId,
        },
        include: {
          contract: {
            include: {
              content: {
                select: { renderedHtml: true },
              },
            },
          },
        },
      });

      if (!contractParty) {
        return reply.code(404).send({ error: "not_found" });
      }

      if (!contractParty.contract.content?.renderedHtml) {
        return reply.code(404).send({
          error: "no_content",
          message: "Contract content not available",
        });
      }

      // Log view event (idempotent)
      await logContractViewed(req, tenantId, contractId, contractParty.id);

      return reply.send({
        html: contractParty.contract.content.renderedHtml,
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to load contract document");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * POST /portal/contracts/:id/sign
   * Submit signature for a contract
   */
  app.post<{ Params: { id: string } }>("/portal/contracts/:id/sign", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const contractId = parseInt(req.params.id, 10);

      if (isNaN(contractId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Find the contract party
      const contractParty = await prisma.contractParty.findFirst({
        where: {
          tenantId,
          partyId,
          contractId,
        },
      });

      if (!contractParty) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Validate request body
      const { signatureType, signatureData, consent } = req.body as any;

      if (!signatureType) {
        return reply.code(400).send({
          error: "validation_error",
          message: "signatureType is required",
        });
      }

      if (!consent) {
        return reply.code(400).send({
          error: "consent_required",
          message: "You must agree to sign this document electronically",
        });
      }

      // Validate signature data based on type
      if (signatureType === "typed" && !signatureData?.typedName) {
        return reply.code(400).send({
          error: "validation_error",
          message: "typedName is required for typed signatures",
        });
      }

      if (signatureType === "drawn" && !signatureData?.drawnImageBase64) {
        return reply.code(400).send({
          error: "validation_error",
          message: "drawnImageBase64 is required for drawn signatures",
        });
      }

      if (signatureType === "uploaded" && !signatureData?.uploadedImageBase64) {
        return reply.code(400).send({
          error: "validation_error",
          message: "uploadedImageBase64 is required for uploaded signatures",
        });
      }

      const input: SignContractInput = {
        signatureType,
        signatureData: signatureData || {},
        consent,
      };

      await signContract(req, tenantId, contractId, contractParty.id, input);

      // Get updated contract status
      const updatedContract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { status: true, signedAt: true },
      });

      return reply.send({
        success: true,
        message: "Contract signed successfully",
        contractStatus: updatedContract?.status,
        signedAt: updatedContract?.signedAt?.toISOString(),
        allPartiesSigned: updatedContract?.status === "signed",
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to sign contract");

      if (err.message.includes("not allowed for your subscription")) {
        return reply.code(403).send({
          error: "signature_type_not_allowed",
          message: err.message,
        });
      }

      if (err.message.includes("Cannot sign") || err.message.includes("Waiting")) {
        return reply.code(400).send({
          error: "cannot_sign",
          message: err.message,
        });
      }

      return reply.code(500).send({
        error: "sign_failed",
        message: err.message,
      });
    }
  });

  /**
   * POST /portal/contracts/:id/decline
   * Decline to sign a contract
   */
  app.post<{ Params: { id: string } }>("/portal/contracts/:id/decline", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const contractId = parseInt(req.params.id, 10);

      if (isNaN(contractId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Find the contract party
      const contractParty = await prisma.contractParty.findFirst({
        where: {
          tenantId,
          partyId,
          contractId,
        },
        include: {
          contract: {
            select: { status: true },
          },
        },
      });

      if (!contractParty) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Verify contract is in a signable state
      if (
        contractParty.contract.status !== "sent" &&
        contractParty.contract.status !== "viewed"
      ) {
        return reply.code(400).send({
          error: "cannot_decline",
          message: `Cannot decline contract in status: ${contractParty.contract.status}`,
        });
      }

      // Verify party hasn't already actioned
      if (contractParty.status === "signed" || contractParty.status === "declined") {
        return reply.code(400).send({
          error: "already_actioned",
          message: `You have already ${contractParty.status} this contract`,
        });
      }

      const { reason } = req.body as any;

      await declineContract(req, tenantId, contractId, contractParty.id, reason);

      return reply.send({
        success: true,
        message: "Contract declined",
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to decline contract");
      return reply.code(500).send({
        error: "decline_failed",
        message: err.message,
      });
    }
  });
};

export default routes;
