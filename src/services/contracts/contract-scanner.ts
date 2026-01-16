// src/services/contracts/contract-scanner.ts
/**
 * Contract Scanner Service
 *
 * Scans contracts for expiration and reminder events.
 * Creates Notification records using the same pattern as notification-scanner.ts
 * Integrates with the existing cron job system.
 */

import prisma from "../../prisma.js";
import type { NotificationType, NotificationPriority, Contract } from "@prisma/client";
import { logContractExpired } from "./signature-event-service.js";
import {
  sendContractReminderEmail,
  sendContractExpiredEmail,
} from "../email-service.js";

// ────────────────────────────────────────────────────────────────────────────
// Date Utilities (matching notification-scanner.ts pattern)
// ────────────────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function differenceInDays(dateA: Date, dateB: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((dateA.getTime() - dateB.getTime()) / msPerDay);
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface ContractAlert {
  contractId: number;
  tenantId: number;
  title: string;
  buyerName: string | null;
  buyerEmail: string | null;
  expiresAt: Date;
  daysUntilExpiration: number;
  alertType: "reminder" | "expiration";
}

// ────────────────────────────────────────────────────────────────────────────
// Contract Expiration Scanning
// ────────────────────────────────────────────────────────────────────────────

/**
 * Scan for contracts that need reminders or have expired
 * Alert windows: 7 days, 3 days, 1 day before expiration
 */
export async function scanContractExpirations(): Promise<ContractAlert[]> {
  const today = startOfDay(new Date());
  const sevenDaysFromNow = addDays(today, 7);

  // Find contracts that:
  // 1. Are in sent/viewed status (awaiting signature)
  // 2. Expire within next 7 days OR have just expired (today)
  const contracts = await prisma.contract.findMany({
    where: {
      status: { in: ["sent", "viewed"] },
      expiresAt: {
        gte: today,
        lte: sevenDaysFromNow,
      },
    },
    include: {
      parties: {
        where: { signer: true, status: { in: ["pending", "viewed"] } },
        select: { name: true, email: true },
      },
    },
  });

  const alerts: ContractAlert[] = [];

  for (const contract of contracts) {
    if (!contract.expiresAt) continue;

    const expiresAtStartOfDay = startOfDay(contract.expiresAt);
    const daysUntilExpiration = differenceInDays(expiresAtStartOfDay, today);

    // Only alert for specific day thresholds: 7, 3, 1
    const shouldAlert =
      daysUntilExpiration === 7 ||
      daysUntilExpiration === 3 ||
      daysUntilExpiration === 1;

    if (shouldAlert) {
      // Create alert for each unsigned party
      for (const party of contract.parties) {
        alerts.push({
          contractId: contract.id,
          tenantId: contract.tenantId,
          title: contract.title,
          buyerName: party.name,
          buyerEmail: party.email,
          expiresAt: contract.expiresAt,
          daysUntilExpiration,
          alertType: "reminder",
        });
      }
    }
  }

  return alerts;
}

/**
 * Scan for expired contracts that need status update
 */
export async function scanExpiredContracts(): Promise<Contract[]> {
  const today = startOfDay(new Date());

  // Find contracts that have expired but haven't been marked as such
  const expiredContracts = await prisma.contract.findMany({
    where: {
      status: { in: ["sent", "viewed"] },
      expiresAt: {
        lt: today,
      },
    },
  });

  return expiredContracts;
}

// ────────────────────────────────────────────────────────────────────────────
// Notification Creation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Map days until expiration to notification type and priority
 */
function getContractNotificationType(
  daysUntilExpiration: number
): { type: NotificationType; priority: NotificationPriority } {
  if (daysUntilExpiration === 7) {
    return { type: "contract_reminder_7d", priority: "LOW" };
  } else if (daysUntilExpiration === 3) {
    return { type: "contract_reminder_3d", priority: "MEDIUM" };
  } else if (daysUntilExpiration === 1) {
    return { type: "contract_reminder_1d", priority: "HIGH" };
  }
  // Default (shouldn't happen with our scanning logic)
  return { type: "contract_reminder_7d", priority: "LOW" };
}

/**
 * Create notification records for contract alerts and send reminder emails
 */
export async function createContractNotifications(
  alerts: ContractAlert[]
): Promise<number> {
  const today = startOfDay(new Date());
  let created = 0;

  for (const alert of alerts) {
    const { type, priority } = getContractNotificationType(alert.daysUntilExpiration);

    // Generate idempotency key to prevent duplicate notifications
    // Format: type:Contract:contractId:buyerEmail:date
    const idempotencyKey = `${type}:Contract:${alert.contractId}:${alert.buyerEmail}:${today.toISOString().split("T")[0]}`;

    // Check if notification already exists for today
    const existing = await prisma.notification.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      continue; // Already notified today
    }

    // Get breeder name for email
    const tenant = await prisma.tenant.findUnique({
      where: { id: alert.tenantId },
      select: { name: true },
    });
    const breederName = tenant?.name || "Breeder";

    // Generate notification content
    let title: string;
    let message: string;

    if (alert.daysUntilExpiration === 1) {
      title = "Contract Expires Tomorrow";
      message = `${alert.buyerName || "A buyer"} hasn't signed "${alert.title}" yet. The contract expires tomorrow (${alert.expiresAt.toLocaleDateString()}).`;
    } else {
      title = `Contract Expires in ${alert.daysUntilExpiration} Days`;
      message = `${alert.buyerName || "A buyer"} hasn't signed "${alert.title}" yet. The contract expires in ${alert.daysUntilExpiration} days (${alert.expiresAt.toLocaleDateString()}).`;
    }

    // Create notification record
    await prisma.notification.create({
      data: {
        tenantId: alert.tenantId,
        userId: null, // Null = notify all tenant staff
        type,
        priority,
        title,
        message,
        linkUrl: `/contracts/${alert.contractId}`,
        status: "UNREAD",
        idempotencyKey,
        metadata: {
          contractId: alert.contractId,
          contractTitle: alert.title,
          buyerName: alert.buyerName,
          buyerEmail: alert.buyerEmail,
          expiresAt: alert.expiresAt.toISOString(),
          daysUntilExpiration: alert.daysUntilExpiration,
        },
      },
    });

    // Send reminder email to the buyer
    if (alert.buyerEmail) {
      try {
        await sendContractReminderEmail(
          alert.tenantId,
          {
            contractId: alert.contractId,
            contractTitle: alert.title,
            breederName,
            recipientName: alert.buyerName || "Buyer",
            recipientEmail: alert.buyerEmail,
            expiresAt: alert.expiresAt,
          },
          alert.daysUntilExpiration
        );
      } catch (err) {
        console.error(`[contract-scanner] Failed to send reminder email to ${alert.buyerEmail}:`, err);
      }
    }

    created++;
  }

  return created;
}

/**
 * Process expired contracts - update status and notify
 */
export async function processExpiredContracts(
  contracts: Contract[]
): Promise<number> {
  const today = startOfDay(new Date());
  let processed = 0;

  for (const contract of contracts) {
    // Get tenant and party info for emails
    const fullContract = await prisma.contract.findUnique({
      where: { id: contract.id },
      include: {
        tenant: true,
        parties: { where: { signer: true } },
      },
    });

    if (!fullContract) continue;

    // Update contract status to expired
    await prisma.contract.update({
      where: { id: contract.id },
      data: { status: "expired" },
    });

    // Update all pending parties to expired
    await prisma.contractParty.updateMany({
      where: {
        contractId: contract.id,
        status: { in: ["pending", "viewed"] },
      },
      data: { status: "expired" },
    });

    // Log expiration event
    await logContractExpired(contract.tenantId, contract.id);

    // Create expiration notification
    const idempotencyKey = `contract_expired:Contract:${contract.id}:${today.toISOString().split("T")[0]}`;

    const existing = await prisma.notification.findUnique({
      where: { idempotencyKey },
    });

    if (!existing) {
      await prisma.notification.create({
        data: {
          tenantId: contract.tenantId,
          userId: null,
          type: "contract_expired",
          priority: "MEDIUM",
          title: "Contract Expired",
          message: `The contract "${contract.title}" has expired without being signed.`,
          linkUrl: `/contracts/${contract.id}`,
          status: "UNREAD",
          idempotencyKey,
          metadata: {
            contractId: contract.id,
            contractTitle: contract.title,
          },
        },
      });
    }

    // Send expiration emails to all parties
    for (const party of fullContract.parties) {
      try {
        await sendContractExpiredEmail(fullContract.tenantId, {
          contractId: fullContract.id,
          contractTitle: fullContract.title,
          breederName: fullContract.tenant.name,
          recipientName: party.name,
          recipientEmail: party.email,
        });
      } catch (err) {
        console.error(`[contract-scanner] Failed to send expired email to ${party.email}:`, err);
      }
    }

    processed++;
  }

  return processed;
}

// ────────────────────────────────────────────────────────────────────────────
// Main Scanner Function
// ────────────────────────────────────────────────────────────────────────────

/**
 * Run contract notification scan
 * Returns counts for logging
 */
export async function runContractScan(): Promise<{
  reminders: number;
  expired: number;
  total: number;
}> {
  console.log("[contract-scanner] Starting contract scan...");

  // Scan for reminder alerts
  const alerts = await scanContractExpirations();
  console.log(`[contract-scanner] Found ${alerts.length} reminder alerts`);

  const remindersCreated = await createContractNotifications(alerts);
  console.log(`[contract-scanner] Created ${remindersCreated} reminder notifications`);

  // Process expired contracts
  const expiredContracts = await scanExpiredContracts();
  console.log(`[contract-scanner] Found ${expiredContracts.length} expired contracts`);

  const expiredProcessed = await processExpiredContracts(expiredContracts);
  console.log(`[contract-scanner] Processed ${expiredProcessed} expired contracts`);

  const total = remindersCreated + expiredProcessed;
  console.log(`[contract-scanner] Scan complete. Created ${total} total notifications`);

  return {
    reminders: remindersCreated,
    expired: expiredProcessed,
    total,
  };
}
