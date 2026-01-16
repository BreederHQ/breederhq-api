// src/services/notification-delivery.ts
/**
 * Notification Delivery Service
 *
 * Sends notifications via email using existing email-service.ts
 * Integrates with hybrid notification system
 */

import prisma from "../prisma.js";
import { sendEmail } from "./email-service.js";
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

  const html = generateNotificationEmail(notification, tenantName, appUrl);
  const text = generateNotificationText(notification, tenantName, appUrl);

  try {
    const result = await sendEmail({
      tenantId: notification.tenantId,
      to: userEmail,
      subject: `[${notification.priority}] ${notification.title}`,
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

  console.log(`[notification-delivery] Delivered notification ${notificationId}: ${sent} sent, ${failed} failed`);

  return { sent, failed };
}

/**
 * Check if user wants to receive this notification type
 */
function shouldSendNotificationType(
  type: string,
  prefs: { vaccinationExpiring: boolean; vaccinationOverdue: boolean; breedingTimeline: boolean; pregnancyCheck: boolean; foalingApproaching: boolean; heatCycleExpected: boolean } | null
): boolean {
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

  // Default to enabled for unknown types
  return true;
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
