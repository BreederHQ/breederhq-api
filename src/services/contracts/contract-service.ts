// src/services/contracts/contract-service.ts
/**
 * Contract Service
 *
 * Core business logic for contract management:
 * - Create contracts from templates
 * - Send contracts to parties
 * - Process signatures
 * - Manage contract lifecycle
 */

import type { FastifyRequest } from "fastify";
import type {
  Contract,
  ContractParty,
  ContractStatus,
  SignatureStatus,
} from "@prisma/client";
import prisma from "../../prisma.js";
import { checkEntitlement } from "../subscription/entitlement-service.js";
import { renderContractTemplate } from "./contract-template-renderer.js";
import {
  logContractCreated,
  logContractSent,
  logSignatureCaptured,
  logContractDeclined,
  logContractVoided,
  getClientIp,
  getUserAgent,
} from "./signature-event-service.js";
import type {
  CreateContractInput,
  SignContractInput,
  SignatureOptions,
  SignatureData,
  ContractRenderContext,
} from "./types.js";
import {
  sendContractSentEmail,
  sendContractSignedEmail,
  sendContractDeclinedEmail,
  sendContractVoidedEmail,
} from "../email-service.js";

// ────────────────────────────────────────────────────────────────────────────
// Contract Creation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a new contract from a template
 */
export async function createContract(
  req: FastifyRequest,
  tenantId: number,
  input: CreateContractInput
): Promise<Contract> {
  const {
    templateId,
    title,
    offspringId,
    animalId,
    waitlistEntryId,
    invoiceId,
    parties,
    expiresInDays = 30,
    reminderDays = [7, 3, 1],
    customContent,
  } = input;

  // Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // Create contract with parties
  const contract = await prisma.contract.create({
    data: {
      tenantId,
      templateId,
      title,
      status: "draft",
      provider: "internal",
      expiresAt,
      offspringId,
      animalId,
      waitlistEntryId,
      invoiceId,
      data: {
        reminderDays,
        customContent,
      },
      parties: {
        create: parties.map((p) => ({
          tenantId,
          role: p.role,
          partyId: p.partyId,
          email: p.email,
          name: p.name,
          signer: p.signer,
          order: p.order ?? null, // Default to parallel signing (null = any order)
          status: "pending",
        })),
      },
    },
    include: {
      parties: true,
      template: true,
    },
  });

  // Log creation event
  await logContractCreated(req, tenantId, contract.id);

  return contract;
}

/**
 * Build render context from contract and related entities
 */
export async function buildRenderContext(
  tenantId: number,
  contractId: number
): Promise<ContractRenderContext> {
  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: {
      tenant: true,
      parties: {
        include: {
          party: true,
        },
      },
      animal: true,
      offspring: {
        include: {
          group: {
            include: {
              dam: true,
              sire: true,
            },
          },
        },
      },
      invoice: true,
    },
  });

  // Find seller (breeder) and buyer parties
  const sellerParty = contract.parties.find((p) => p.role === "SELLER");
  const buyerParty = contract.parties.find((p) => p.role === "BUYER");

  // Build tenant/breeder context from tenant profile
  const tenant = contract.tenant;

  // Build address string from tenant data (assuming these fields exist or use defaults)
  const breederAddress = [
    (tenant as any).street,
    (tenant as any).city,
    (tenant as any).state,
    (tenant as any).postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  const context: ContractRenderContext = {
    breeder: {
      name: sellerParty?.name || tenant.name,
      businessName: tenant.name,
      address: breederAddress || undefined,
      phone: (tenant as any).phone || undefined,
      email: sellerParty?.email || (tenant as any).email || "",
    },
    buyer: {
      name: buyerParty?.name || "",
      address: buyerParty?.party?.addressLine1
        ? [
            buyerParty.party.addressLine1,
            buyerParty.party.city,
            buyerParty.party.state,
            buyerParty.party.postalCode,
          ]
            .filter(Boolean)
            .join(", ")
        : undefined,
      phone: buyerParty?.party?.phoneE164 || undefined,
      email: buyerParty?.email || "",
    },
    transaction: {
      totalPrice: contract.invoice?.totalCents
        ? (contract.invoice.totalCents / 100).toFixed(2)
        : "0",
      depositAmount: contract.invoice?.depositCents
        ? (contract.invoice.depositCents / 100).toFixed(2)
        : undefined,
      balanceDue: contract.invoice?.balanceDueCents
        ? (contract.invoice.balanceDueCents / 100).toFixed(2)
        : undefined,
    },
    contract: {
      date: new Date().toISOString().split("T")[0],
      expirationDate: contract.expiresAt?.toISOString().split("T")[0],
    },
  };

  // Add animal context if present
  if (contract.animal) {
    context.animal = {
      name: contract.animal.name,
      breed: contract.animal.breed || "",
      dateOfBirth: contract.animal.birthDate?.toISOString().split("T")[0],
      microchipNumber: contract.animal.microchip || undefined,
      sex: contract.animal.sex,
    };
  }

  // Add offspring context if present
  if (contract.offspring) {
    context.offspring = {
      name: contract.offspring.name || undefined,
      collarColor: contract.offspring.collarColorName || undefined,
      sex: contract.offspring.sex || undefined,
      dateOfBirth: contract.offspring.birthDate?.toISOString().split("T")[0],
    };

    // If no animal but offspring has parents, use dam info
    if (!context.animal && contract.offspring.group?.dam) {
      const dam = contract.offspring.group.dam;
      context.animal = {
        name: dam.name,
        breed: dam.breed || "",
        dateOfBirth: dam.birthDate?.toISOString().split("T")[0],
      };
    }
  }

  return context;
}

/**
 * Render contract content and store as immutable snapshot
 */
export async function renderAndStoreContractContent(
  tenantId: number,
  contractId: number
): Promise<void> {
  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: { template: true },
  });

  if (!contract.template?.bodyHtml) {
    throw new Error("Contract template has no content");
  }

  const context = await buildRenderContext(tenantId, contractId);
  const { html, missingFields } = renderContractTemplate(
    contract.template.bodyHtml,
    context
  );

  if (missingFields.length > 0) {
    console.warn(
      `[contract-service] Contract ${contractId} rendered with missing fields: ${missingFields.join(", ")}`
    );
  }

  // Store immutable snapshot
  await prisma.contractContent.create({
    data: {
      contractId,
      renderedHtml: html,
      mergeData: context as any,
      templateVersion: contract.template.version,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Contract Sending
// ────────────────────────────────────────────────────────────────────────────

/**
 * Send contract to all signing parties
 */
export async function sendContract(
  req: FastifyRequest,
  tenantId: number,
  contractId: number,
  message?: string
): Promise<void> {
  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId, tenantId },
    include: {
      tenant: true,
      parties: {
        where: { signer: true },
        include: { party: true },
      },
      template: true,
    },
  });

  if (contract.status !== "draft") {
    throw new Error(`Cannot send contract in status: ${contract.status}`);
  }

  // Render and store content if not already done
  const existingContent = await prisma.contractContent.findUnique({
    where: { contractId },
  });
  if (!existingContent) {
    await renderAndStoreContractContent(tenantId, contractId);
  }

  // Collect recipient emails
  const recipientEmails: string[] = [];

  for (const party of contract.parties) {
    if (!party.email) {
      throw new Error(`Party ${party.name} has no email address`);
    }
    recipientEmails.push(party.email);
  }

  // Update contract status
  await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: "sent",
      issuedAt: new Date(),
    },
  });

  // Log sent event
  await logContractSent(req, tenantId, contractId, recipientEmails);

  // Send email to each signing party
  const breederName = contract.tenant.name;
  for (const party of contract.parties) {
    // Skip sending to seller (breeder) - they're the one sending
    if (party.role === "SELLER") continue;

    try {
      await sendContractSentEmail(tenantId, {
        contractId: contract.id,
        contractTitle: contract.title,
        breederName,
        recipientName: party.name,
        recipientEmail: party.email,
        expiresAt: contract.expiresAt || undefined,
        message,
      });
    } catch (err) {
      console.error(`[contract-service] Failed to send contract email to ${party.email}:`, err);
      // Don't fail the whole operation if email fails
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Contract Signing
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get signature options based on tenant tier
 */
export async function getSignatureOptionsForTenant(
  tenantId: number
): Promise<SignatureOptions> {
  // Check E_SIGNATURES entitlement
  const entitlement = await checkEntitlement(tenantId, "E_SIGNATURES");
  if (!entitlement.hasAccess) {
    return { allowTyped: false, allowDrawn: false, allowUploaded: false };
  }

  // Check subscription tier for Pro features
  // E_SIGNATURES limitValue: null or high = Pro (all options), 1 = Basic (typed only)
  const isPro =
    entitlement.limitValue === null ||
    entitlement.limitValue === undefined ||
    entitlement.limitValue >= 2;

  return {
    allowTyped: true,
    allowDrawn: isPro,
    allowUploaded: isPro,
  };
}

/**
 * Validate signature type against tenant tier
 */
export function validateSignatureType(
  options: SignatureOptions,
  signatureType: string
): boolean {
  switch (signatureType) {
    case "typed":
      return options.allowTyped;
    case "drawn":
      return options.allowDrawn;
    case "uploaded":
      return options.allowUploaded;
    default:
      return false;
  }
}

/**
 * Check if a party can sign (order validation for sequential signing)
 */
export async function canPartySign(
  contractId: number,
  contractPartyId: number
): Promise<{ canSign: boolean; reason?: string }> {
  const party = await prisma.contractParty.findUnique({
    where: { id: contractPartyId },
    include: {
      contract: {
        include: { parties: { where: { signer: true } } },
      },
    },
  });

  if (!party) {
    return { canSign: false, reason: "Party not found" };
  }

  if (party.status !== "pending" && party.status !== "viewed") {
    return { canSign: false, reason: `Party already has status: ${party.status}` };
  }

  if (party.contract.status !== "sent" && party.contract.status !== "viewed") {
    return { canSign: false, reason: `Contract not available for signing` };
  }

  // If no order specified, parallel signing allowed
  if (party.order === null) {
    return { canSign: true };
  }

  // Check all parties with lower order have signed
  const priorParties = party.contract.parties.filter(
    (p) => p.order !== null && p.order < party.order!
  );

  const allPriorSigned = priorParties.every((p) => p.status === "signed");
  if (!allPriorSigned) {
    return { canSign: false, reason: "Waiting for prior signers" };
  }

  return { canSign: true };
}

/**
 * Process signature submission
 */
export async function signContract(
  req: FastifyRequest,
  tenantId: number,
  contractId: number,
  contractPartyId: number,
  input: SignContractInput
): Promise<void> {
  // Validate consent
  if (!input.consent) {
    throw new Error("Consent is required to sign");
  }

  // Check signature options for tenant
  const options = await getSignatureOptionsForTenant(tenantId);
  if (!validateSignatureType(options, input.signatureType)) {
    throw new Error(`Signature type ${input.signatureType} not allowed for your subscription`);
  }

  // Check if party can sign
  const canSignResult = await canPartySign(contractId, contractPartyId);
  if (!canSignResult.canSign) {
    throw new Error(canSignResult.reason || "Cannot sign at this time");
  }

  // Build signature data
  const signatureData: SignatureData = {
    type: input.signatureType,
    typedName: input.signatureData.typedName,
    imageData: input.signatureData.drawnImageBase64 || input.signatureData.uploadedImageBase64,
    capturedAt: new Date().toISOString(),
    capturedIp: getClientIp(req),
    capturedUserAgent: getUserAgent(req),
  };

  // Update party status and store signature
  await prisma.contractParty.update({
    where: { id: contractPartyId },
    data: {
      status: "signed",
      signedAt: new Date(),
      data: signatureData as any,
    },
  });

  // Log signature event
  await logSignatureCaptured(req, tenantId, contractId, contractPartyId, signatureData);

  // Check if all parties have signed
  const allSigned = await checkAllPartiesSigned(contractId);
  if (allSigned) {
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: "signed",
        signedAt: new Date(),
      },
    });
  } else {
    // Update contract status to viewed if still in sent
    await prisma.contract.updateMany({
      where: { id: contractId, status: "sent" },
      data: { status: "viewed" },
    });
  }

  // Get full contract with party info for notifications
  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: {
      tenant: true,
      parties: { where: { signer: true } },
    },
  });

  // Get the party that just signed
  const signingParty = contract.parties.find((p) => p.id === contractPartyId);
  if (!signingParty) return;

  // Notify other parties about the signature
  for (const party of contract.parties) {
    // Don't notify the person who just signed
    if (party.id === contractPartyId) continue;

    try {
      await sendContractSignedEmail(tenantId, {
        contractId: contract.id,
        contractTitle: contract.title,
        breederName: contract.tenant.name,
        recipientName: party.name,
        recipientEmail: party.email,
        signedByName: signingParty.name,
        signedAt: new Date(),
        allPartiesSigned: allSigned,
      });
    } catch (err) {
      console.error(`[contract-service] Failed to send signed notification to ${party.email}:`, err);
    }
  }
}

/**
 * Check if all signing parties have signed
 */
export async function checkAllPartiesSigned(contractId: number): Promise<boolean> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { parties: { where: { signer: true } } },
  });

  return contract?.parties.every((p) => p.status === "signed") ?? false;
}

// ────────────────────────────────────────────────────────────────────────────
// Contract Actions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Decline a contract
 */
export async function declineContract(
  req: FastifyRequest,
  tenantId: number,
  contractId: number,
  contractPartyId: number,
  reason?: string
): Promise<void> {
  // Get contract and party info before updating
  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: {
      tenant: true,
      parties: { where: { signer: true } },
    },
  });

  const decliningParty = contract.parties.find((p) => p.id === contractPartyId);
  if (!decliningParty) {
    throw new Error("Party not found");
  }

  await prisma.contractParty.update({
    where: { id: contractPartyId },
    data: { status: "declined" },
  });

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: "declined" },
  });

  await logContractDeclined(req, tenantId, contractId, contractPartyId, reason);

  // Notify other parties about the decline
  for (const party of contract.parties) {
    // Don't notify the person who declined
    if (party.id === contractPartyId) continue;

    try {
      await sendContractDeclinedEmail(tenantId, {
        contractId: contract.id,
        contractTitle: contract.title,
        breederName: contract.tenant.name,
        recipientName: party.name,
        recipientEmail: party.email,
        declinedByName: decliningParty.name,
        declinedAt: new Date(),
        reason,
      });
    } catch (err) {
      console.error(`[contract-service] Failed to send declined notification to ${party.email}:`, err);
    }
  }
}

/**
 * Void a contract (breeder action)
 */
export async function voidContract(
  req: FastifyRequest,
  tenantId: number,
  contractId: number,
  userId: string,
  reason?: string
): Promise<void> {
  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId, tenantId },
    include: {
      tenant: true,
      parties: { where: { signer: true } },
    },
  });

  if (contract.status === "signed") {
    throw new Error("Cannot void a signed contract");
  }

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: "voided",
      voidedAt: new Date(),
    },
  });

  // Update all pending parties to voided
  await prisma.contractParty.updateMany({
    where: {
      contractId,
      status: { in: ["pending", "viewed"] },
    },
    data: { status: "voided" },
  });

  await logContractVoided(req, tenantId, contractId, userId, reason);

  // Notify all parties about the void
  for (const party of contract.parties) {
    // Skip the breeder/seller - they're the one voiding
    if (party.role === "SELLER") continue;

    try {
      await sendContractVoidedEmail(tenantId, {
        contractId: contract.id,
        contractTitle: contract.title,
        breederName: contract.tenant.name,
        recipientName: party.name,
        recipientEmail: party.email,
        reason,
      });
    } catch (err) {
      console.error(`[contract-service] Failed to send voided notification to ${party.email}:`, err);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Contract Queries
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get contract with all related data
 */
export async function getContractWithDetails(
  tenantId: number,
  contractId: number
): Promise<Contract & {
  parties: ContractParty[];
  content: { renderedHtml: string } | null;
}> {
  return prisma.contract.findUniqueOrThrow({
    where: { id: contractId, tenantId },
    include: {
      parties: {
        include: { party: true },
        orderBy: { order: "asc" },
      },
      content: {
        select: { renderedHtml: true },
      },
      template: true,
      animal: true,
      offspring: true,
    },
  });
}

/**
 * List contracts for tenant with filters
 */
export async function listContracts(
  tenantId: number,
  filters: {
    status?: ContractStatus;
    partyId?: number;
    offspringId?: number;
    animalId?: number;
  }
): Promise<Contract[]> {
  const where: any = { tenantId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.partyId) {
    where.parties = { some: { partyId: filters.partyId } };
  }
  if (filters.offspringId) {
    where.offspringId = filters.offspringId;
  }
  if (filters.animalId) {
    where.animalId = filters.animalId;
  }

  return prisma.contract.findMany({
    where,
    include: {
      parties: {
        select: { name: true, email: true, role: true, status: true },
      },
      template: { select: { name: true, category: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
