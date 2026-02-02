// src/services/notification-delivery.ts
/**
 * Notification Delivery Service
 *
 * Sends notifications via email using existing email-service.ts
 * Integrates with hybrid notification system
 */

import prisma from "../prisma.js";
import { sendEmail } from "./email-service.js";
import { canContactViaChannel } from "./comm-prefs-service.js";
import type { Notification, NotificationPriority } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Email Templates
// ────────────────────────────────────────────────────────────────────────────

function getPriorityColor(priority: NotificationPriority): string {
  switch (priority) {
    case "URGENT":
      return "#dc2626"; // red-600
    case "HIGH":
      return "#f97316"; // orange-500
    case "MEDIUM":
      return "#3b82f6"; // blue-500
    case "LOW":
    default:
      return "#6b7280"; // gray-500
  }
}

function getPriorityLabel(priority: NotificationPriority): string {
  switch (priority) {
    case "URGENT":
      return "🚨 URGENT";
    case "HIGH":
      return "⚠️ HIGH PRIORITY";
    case "MEDIUM":
      return "📋 MEDIUM PRIORITY";
    case "LOW":
    default:
      return "ℹ️ LOW PRIORITY";
  }
}

/**
 * Generate HTML email for notification
 */
function generateNotificationEmail(notification: Notification, tenantName: string, appUrl: string): string {
  const priorityColor = getPriorityColor(notification.priority);
  const priorityLabel = getPriorityLabel(notification.priority);
  const deepLinkUrl = notification.linkUrl ? `${appUrl}${notification.linkUrl}` : appUrl;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${notification.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: white; border-radius: 8px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <!-- Priority Badge -->
      <div style="display: inline-block; padding: 6px 12px; background-color: ${priorityColor}; color: white; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">
        ${priorityLabel}
      </div>

      <!-- Title -->
      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111;">
        ${notification.title}
      </h1>

      <!-- Message -->
      <p style="margin: 0 0 24px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
        ${notification.message}
      </p>

      <!-- Action Button -->
      ${
        notification.linkUrl
          ? `
      <a href="${deepLinkUrl}" style="display: inline-block; padding: 12px 24px; background-color: #f97316; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
        View Details
      </a>
      `
          : ""
      }
    </div>

    <!-- Footer -->
    <div style="text-align: center; color: #9ca3af; font-size: 12px; padding: 20px 0;">
      <p style="margin: 0 0 8px 0;">
        This notification was sent from <strong>${tenantName}</strong> via BreederHQ
      </p>
      <p style="margin: 0;">
        <a href="${appUrl}/settings/notifications" style="color: #f97316; text-decoration: none;">
          Manage notification preferences
        </a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email for notification
 */
function generateNotificationText(notification: Notification, tenantName: string, appUrl: string): string {
  const priorityLabel = getPriorityLabel(notification.priority);
  const deepLinkUrl = notification.linkUrl ? `${appUrl}${notification.linkUrl}` : appUrl;

  return `
${priorityLabel}

${notification.title}

${notification.message}

${notification.linkUrl ? `View details: ${deepLinkUrl}` : ""}

---
This notification was sent from ${tenantName} via BreederHQ
Manage notification preferences: ${appUrl}/settings/notifications
  `.trim();
}

// ────────────────────────────────────────────────────────────────────────────
// Genetic Notification Email Templates
// ────────────────────────────────────────────────────────────────────────────

interface GeneticNotificationMetadata {
  breedingPlanId?: number;
  planName?: string;
  damId?: number;
  damName?: string;
  sireId?: number;
  sireName?: string;
  damStatus?: string;
  sireStatus?: string;
  gene?: string;
  geneName?: string;
  riskPercentage?: number;
  isLethal?: boolean;
  animalId?: number;
  animalName?: string;
  breed?: string;
  missingTests?: string[];
}

/**
 * Generate specialized email for carrier warning (URGENT)
 */
function generateCarrierWarningEmail(
  notification: Notification,
  metadata: GeneticNotificationMetadata,
  tenantName: string,
  appUrl: string
): string {
  const deepLinkUrl = notification.linkUrl ? `${appUrl}${notification.linkUrl}` : appUrl;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚠️ Lethal Pairing Risk Detected</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: white; border-radius: 8px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <!-- Priority Badge -->
      <div style="display: inline-block; padding: 6px 12px; background-color: #dc2626; color: white; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">
        🚨 URGENT - LETHAL PAIRING RISK
      </div>

      <!-- Title -->
      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111;">
        ⚠️ Lethal Pairing Risk Detected
      </h1>

      <!-- Warning Message -->
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0; color: #991b1b; font-weight: 500;">
          A potential lethal pairing has been detected in your breeding plan.
        </p>
      </div>

      <!-- Details Table -->
      <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151; width: 40%;">Breeding Plan:</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #111;">${metadata.planName || "Unnamed Plan"}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Dam:</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #111;">${metadata.damName || "Unknown"} <span style="color: #f97316;">(${metadata.damStatus || "Carrier"})</span></td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Sire:</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #111;">${metadata.sireName || "Unknown"} <span style="color: #f97316;">(${metadata.sireStatus || "Carrier"})</span></td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Gene:</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #111;">${metadata.geneName || metadata.gene || "Unknown"}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: 600; color: #374151;">Risk:</td>
          <td style="padding: 10px; color: #dc2626; font-weight: 600;">${metadata.riskPercentage || 25}% chance of affected offspring</td>
        </tr>
      </table>

      <!-- Explanation -->
      <p style="margin: 0 0 24px 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
        Both parents are carriers of this gene. When two carriers are bred together, there is a ${metadata.riskPercentage || 25}% chance of producing offspring that ${metadata.isLethal ? "will not survive" : "may have health issues"}.
      </p>

      <!-- Action Button -->
      <a href="${deepLinkUrl}" style="display: inline-block; padding: 14px 28px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
        Review Breeding Plan
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; color: #9ca3af; font-size: 12px; padding: 20px 0;">
      <p style="margin: 0 0 8px 0;">
        This urgent notification was sent from <strong>${tenantName}</strong> via BreederHQ
      </p>
      <p style="margin: 0;">
        <a href="${appUrl}/settings/notifications" style="color: #f97316; text-decoration: none;">
          Manage notification preferences
        </a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate specialized email for pre-breeding test reminder (HIGH)
 */
function generatePrebreedingEmail(
  notification: Notification,
  metadata: GeneticNotificationMetadata,
  tenantName: string,
  appUrl: string
): string {
  const deepLinkUrl = notification.linkUrl ? `${appUrl}${notification.linkUrl}` : appUrl;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Genetic Testing Reminder</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: white; border-radius: 8px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <!-- Priority Badge -->
      <div style="display: inline-block; padding: 6px 12px; background-color: #f97316; color: white; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">
        ⚠️ HIGH PRIORITY
      </div>

      <!-- Title -->
      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111;">
        🧬 Genetic Testing Reminder
      </h1>

      <!-- Message -->
      <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563;">
        Your breeding plan ${metadata.planName ? `"${metadata.planName}"` : ""} is scheduled within 7 days.
      </p>

      <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0; color: #92400e; font-weight: 500;">
          <strong>${metadata.animalName || "This animal"}</strong> has not been genetically tested yet.
        </p>
      </div>

      <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">
        Consider testing before breeding to:
      </p>
      <ul style="margin: 0 0 24px 0; padding-left: 20px; color: #4b5563;">
        <li style="margin-bottom: 8px;">Identify carrier status for lethal genes</li>
        <li style="margin-bottom: 8px;">Meet registry requirements</li>
        <li style="margin-bottom: 8px;">Make informed breeding decisions</li>
      </ul>

      <!-- Action Button -->
      <a href="${deepLinkUrl}" style="display: inline-block; padding: 12px 24px; background-color: #f97316; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
        View Genetics
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; color: #9ca3af; font-size: 12px; padding: 20px 0;">
      <p style="margin: 0 0 8px 0;">
        This notification was sent from <strong>${tenantName}</strong> via BreederHQ
      </p>
      <p style="margin: 0;">
        <a href="${appUrl}/settings/notifications" style="color: #f97316; text-decoration: none;">
          Manage notification preferences
        </a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Get specialized email template for genetic notifications
 * Falls back to generic template for other notification types
 */
function getGeneticEmailHtml(
  notification: Notification,
  tenantName: string,
  appUrl: string
): string {
  const metadata = (notification.metadata as GeneticNotificationMetadata) || {};

  switch (notification.type) {
    case "genetic_test_carrier_warning":
      return generateCarrierWarningEmail(notification, metadata, tenantName, appUrl);

    case "genetic_test_prebreeding":
      return generatePrebreedingEmail(notification, metadata, tenantName, appUrl);

    // Other genetic types use the standard template
    default:
      return generateNotificationEmail(notification, tenantName, appUrl);
  }
}

/**
 * Get specialized email subject for genetic notifications
 */
function getGeneticEmailSubject(notification: Notification): string {
  const metadata = (notification.metadata as GeneticNotificationMetadata) || {};

  switch (notification.type) {
    case "genetic_test_carrier_warning":
      return `⚠️ URGENT: Lethal Pairing Risk - ${metadata.planName || "Breeding Plan"}`;

    case "genetic_test_prebreeding":
      return `🧬 Genetic Testing Reminder - ${metadata.animalName || "Breeding"} scheduled`;

    case "genetic_test_registration":
      return `🧬 Registry Genetic Testing Required - ${metadata.animalName || "Animal"}`;

    case "genetic_test_missing":
      return `🧬 Genetic Panel Missing - ${metadata.animalName || "Animal"}`;

    case "genetic_test_incomplete":
      return `🧬 Incomplete Genetic Testing - ${metadata.animalName || "Animal"}`;

    default:
      return `[${notification.priority}] ${notification.title}`;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Email Frequency Limits
// ────────────────────────────────────────────────────────────────────────────

/**
 * Email frequency limits per notification type
 * - 'always': Always send email (for URGENT)
 * - 'once_then_silence_days': Send once, then silence for N days
 * - number[]: Send at these day intervals before event
 */
const EMAIL_FREQUENCY_LIMITS: Record<string, "always" | { silenceDays: number } | number[]> = {
  genetic_test_carrier_warning: "always", // Always send for lethal warnings
  genetic_test_prebreeding: [7, 3, 1], // 7d, 3d, 1d before breeding
  genetic_test_registration: [90, 60, 30], // 90d, 60d, 30d before deadline
  genetic_test_missing: { silenceDays: 90 }, // Once, then silence 90 days
  genetic_test_incomplete: { silenceDays: 90 }, // Once, then silence 90 days
  genetic_test_recommended: { silenceDays: -1 }, // Never send email (-1 = disabled)
};

/**
 * Check if we should send email for this notification based on frequency limits
 * Uses the notification's idempotency key pattern to check last sent time
 */
export async function shouldSendEmailForNotification(
  notificationType: string,
  entityType: "Animal" | "BreedingPlan",
  entityId: number
): Promise<boolean> {
  const limit = EMAIL_FREQUENCY_LIMITS[notificationType];

  // No limit defined = allow
  if (!limit) return true;

  // Always send
  if (limit === "always") return true;

  // Check silence period
  if (typeof limit === "object" && "silenceDays" in limit) {
    // -1 = never send email
    if (limit.silenceDays < 0) return false;

    // Check if we've sent an email for this entity within the silence period
    const silenceDate = new Date();
    silenceDate.setDate(silenceDate.getDate() - limit.silenceDays);

    // Check last email sent for this type + entity
    const lastSent = await prisma.notification.findFirst({
      where: {
        type: notificationType as any,
        idempotencyKey: {
          contains: `${entityType}:${entityId}`,
        },
        createdAt: {
          gt: silenceDate,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // If found within silence period, don't send
    return !lastSent;
  }

  // Array = send at specific intervals (handled by notification creation, not email)
  // The notification scanner creates notifications at these intervals
  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// Delivery Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Send email notification to a specific user
 */
export async function sendNotificationEmail(
  notification: Notification,
  userEmail: string,
  tenantName: string
): Promise<boolean> {
  const appUrl = process.env.APP_URL || "https://app.breederhq.com";

  // Use specialized templates for genetic notifications
  const isGeneticNotification = notification.type.startsWith("genetic_test_");
  const html = isGeneticNotification
    ? getGeneticEmailHtml(notification, tenantName, appUrl)
    : generateNotificationEmail(notification, tenantName, appUrl);
  const subject = isGeneticNotification
    ? getGeneticEmailSubject(notification)
    : `[${notification.priority}] ${notification.title}`;
  const text = generateNotificationText(notification, tenantName, appUrl);

  try {
    const result = await sendEmail({
      tenantId: notification.tenantId,
      to: userEmail,
      subject,
      html,
      text,
      category: "transactional", // Health/breeding alerts are transactional
      metadata: {
        notificationId: notification.id,
        notificationType: notification.type,
        notificationPriority: notification.priority,
      },
    });

    return result.ok;
  } catch (err) {
    console.error(`[notification-delivery] Failed to send email to ${userEmail}:`, err);
    return false;
  }
}

/**
 * Deliver notification to all tenant users via email
 * Respects user notification preferences
 */
export async function deliverNotification(notificationId: number): Promise<{ sent: number; failed: number }> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!notification) {
    console.error(`[notification-delivery] Notification ${notificationId} not found`);
    return { sent: 0, failed: 0 };
  }

  // Get all active tenant members
  const memberships = await prisma.tenantMembership.findMany({
    where: {
      tenantId: notification.tenantId,
      membershipStatus: "ACTIVE",
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  let sent = 0;
  let failed = 0;

  for (const membership of memberships) {
    const user = membership.user;

    // Check if user has notification preferences
    const prefs = await prisma.userNotificationPreferences.findUnique({
      where: { userId: user.id },
    });

    // If no preferences exist, assume all notifications enabled (default opt-in)
    const emailEnabled = prefs?.emailEnabled ?? true;

    if (!emailEnabled) {
      // User has disabled email notifications
      continue;
    }

    // Check notification type preferences
    const shouldSend = shouldSendNotificationType(notification.type, prefs);

    if (!shouldSend) {
      // User has disabled this specific notification type
      continue;
    }

    // Send email
    const success = await sendNotificationEmail(notification, user.email, notification.tenant.name);

    if (success) {
      sent++;
    } else {
      failed++;
    }
  }

  // Also deliver to animal owners who have receiveNotifications enabled
  const ownerResult = await deliverToAnimalOwners(notification);
  sent += ownerResult.sent;
  failed += ownerResult.failed;

  // Update notification metadata with delivery info so breeders can see who was notified
  if (ownerResult.recipients.length > 0) {
    const existingMetadata = (notification.metadata as Record<string, unknown>) || {};
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        metadata: {
          ...existingMetadata,
          ownerDelivery: {
            sentAt: new Date().toISOString(),
            recipientCount: ownerResult.recipients.length,
            recipients: ownerResult.recipients.map((r) => ({
              name: r.name,
              // Don't store full email in metadata for privacy - just show it was sent
            })),
          },
        },
      },
    });
  }

  console.log(`[notification-delivery] Delivered notification ${notificationId}: ${sent} sent (${ownerResult.sent} to owners), ${failed} failed`);

  return { sent, failed };
}

/** User notification preferences type */
interface NotificationPrefs {
  vaccinationExpiring: boolean;
  vaccinationOverdue: boolean;
  breedingTimeline: boolean;
  pregnancyCheck: boolean;
  foalingApproaching: boolean;
  heatCycleExpected: boolean;
  microchipRenewal: boolean;
  // Genetic test preferences
  geneticCarrierWarning?: boolean;
  geneticPrebreeding?: boolean;
  geneticRegistration?: boolean;
  geneticMissing?: boolean;
  geneticIncomplete?: boolean;
  geneticRecommended?: boolean;
}

/**
 * Check if user wants to receive this notification type
 */
function shouldSendNotificationType(type: string, prefs: NotificationPrefs | null): boolean {
  // If no preferences, default to enabled
  if (!prefs) return true;

  // Map notification types to preference fields
  if (type.startsWith("vaccination_expiring")) {
    return prefs.vaccinationExpiring;
  }
  if (type === "vaccination_overdue") {
    return prefs.vaccinationOverdue;
  }
  if (type.startsWith("breeding_") || type.startsWith("pregnancy_check_")) {
    return prefs.breedingTimeline && prefs.pregnancyCheck;
  }
  if (type.startsWith("foaling_")) {
    return prefs.foalingApproaching;
  }
  if (type === "breeding_heat_cycle_expected") {
    return prefs.heatCycleExpected;
  }
  // Microchip renewal notifications
  if (type.startsWith("microchip_renewal_") || type === "microchip_expired") {
    return prefs.microchipRenewal;
  }

  // ─── Genetic Test Notifications ─────────────────────────────────
  if (type === "genetic_test_carrier_warning") {
    // URGENT: Always send carrier warnings by default (lethal risk)
    return prefs.geneticCarrierWarning ?? true;
  }
  if (type === "genetic_test_prebreeding") {
    // HIGH: Pre-breeding test reminders
    return prefs.geneticPrebreeding ?? true;
  }
  if (type === "genetic_test_registration") {
    // MEDIUM: Registry requirement reminders
    return prefs.geneticRegistration ?? true;
  }
  if (type === "genetic_test_missing") {
    // LOW: Missing genetic panel (default OFF)
    return prefs.geneticMissing ?? false;
  }
  if (type === "genetic_test_incomplete") {
    // LOW: Incomplete testing (default OFF)
    return prefs.geneticIncomplete ?? false;
  }
  if (type === "genetic_test_recommended") {
    // LOW: Recommended tests (NEVER send email - too noisy)
    return false;
  }

  // Default to enabled for unknown types
  return true;
}

/** Info about an owner who received a notification */
interface OwnerDeliveryRecipient {
  partyId: number;
  name: string | null;
  email: string;
}

/** Result of delivering to animal owners */
interface OwnerDeliveryResult {
  sent: number;
  failed: number;
  skipped: number;
  recipients: OwnerDeliveryRecipient[];
}

/**
 * Deliver notification to animal owners who have receiveNotifications enabled
 * Extracts animal IDs from notification metadata and sends to owners
 * Respects AnimalOwner.receiveNotifications and PartyCommPreference
 * Returns list of recipients so breeders can be informed
 */
export async function deliverToAnimalOwners(
  notification: Notification & { tenant: { id: number; name: string; slug: string | null } }
): Promise<OwnerDeliveryResult> {
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const recipients: OwnerDeliveryRecipient[] = [];

  // Extract animal IDs from notification metadata
  const metadata = notification.metadata as Record<string, unknown> | null;
  if (!metadata) {
    return { sent: 0, failed: 0, skipped: 0, recipients: [] };
  }

  const animalIds: number[] = [];

  // Collect all animal IDs from metadata (damId, sireId, animalId)
  if (typeof metadata.damId === "number") animalIds.push(metadata.damId);
  if (typeof metadata.sireId === "number") animalIds.push(metadata.sireId);
  if (typeof metadata.animalId === "number") animalIds.push(metadata.animalId);

  if (animalIds.length === 0) {
    return { sent: 0, failed: 0, skipped: 0, recipients: [] };
  }

  // Get all owners for these animals who want to receive notifications
  const owners = await prisma.animalOwner.findMany({
    where: {
      animalId: { in: animalIds },
      receiveNotifications: true,
    },
    include: {
      party: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  // Track emails we've already sent to (prevent duplicates if same owner owns dam and sire)
  const sentEmails = new Set<string>();

  for (const owner of owners) {
    const email = owner.party?.email;
    if (!email) {
      skipped++;
      continue;
    }

    // Skip if we've already sent to this email
    if (sentEmails.has(email.toLowerCase())) {
      continue;
    }

    // Check PartyCommPreference - respect email channel blocking
    const canContact = await canContactViaChannel(owner.partyId, "EMAIL");
    if (!canContact) {
      skipped++;
      console.log(`[notification-delivery] Skipping owner party ${owner.partyId} - email blocked by PartyCommPreference`);
      continue;
    }

    // Send email
    const success = await sendNotificationEmail(notification, email, notification.tenant.name);

    if (success) {
      sent++;
      sentEmails.add(email.toLowerCase());
      recipients.push({
        partyId: owner.partyId,
        name: owner.party?.name ?? null,
        email,
      });
      console.log(`[notification-delivery] Sent to animal owner: ${email} (party ${owner.partyId})`);
    } else {
      failed++;
    }
  }

  if (sent > 0 || failed > 0 || skipped > 0) {
    console.log(`[notification-delivery] Animal owner delivery for notification ${notification.id}: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  }

  return { sent, failed, skipped, recipients };
}

/**
 * Deliver all undelivered notifications
 * Called by cron job after scanning creates new notifications
 */
export async function deliverPendingNotifications(): Promise<{ total: number; sent: number; failed: number }> {
  // Find all UNREAD notifications created today that haven't been emailed yet
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const notifications = await prisma.notification.findMany({
    where: {
      status: "UNREAD",
      createdAt: {
        gte: today,
      },
    },
    select: {
      id: true,
    },
  });

  console.log(`[notification-delivery] Found ${notifications.length} notifications to deliver`);

  let totalSent = 0;
  let totalFailed = 0;

  for (const notification of notifications) {
    const result = await deliverNotification(notification.id);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  console.log(`[notification-delivery] Delivery complete: ${totalSent} sent, ${totalFailed} failed`);

  return {
    total: notifications.length,
    sent: totalSent,
    failed: totalFailed,
  };
}
