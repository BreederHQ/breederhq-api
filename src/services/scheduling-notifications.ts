// src/services/scheduling-notifications.ts
// Orchestrates scheduling notification delivery (email + ICS calendar invites).
// Uses fire-and-forget pattern: booking endpoints should not block on notification delivery.

import { sendEmail, type SendEmailResult } from "./email-service.js";
import {
  renderBookingConfirmationEmail,
  renderBookingCancellationEmail,
  renderBookingRescheduleEmail,
  renderBookingReminderEmail,
  type SchedulingEmailParams,
  type RescheduleEmailParams,
} from "./email-templates.js";
import {
  generateBookingConfirmationIcs,
  generateBookingCancellationIcs,
  generateBookingRescheduleIcs,
  generateBookingReminderIcs,
  getIcsFilename,
  type IcsBookingData,
} from "./ics-generator.js";

/**
 * Notification data extracted from booking with relations.
 */
export interface BookingNotificationData {
  bookingId: number;
  tenantId: number;
  eventType: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  mode: "in_person" | "virtual" | null;
  clientPartyId: number;
  clientEmail: string;
  clientName: string;
  breederName: string;
  tenantName: string;
  nextSteps: string | null;
}

/**
 * Additional data for reschedule notifications.
 */
export interface RescheduleNotificationData extends BookingNotificationData {
  originalStartsAt: Date;
  originalEndsAt: Date;
}

/**
 * Booking with relations type for type safety when building notification data.
 */
export interface BookingWithRelations {
  id: number;
  tenantId: number;
  eventId: string;
  nextSteps: string | null;
  slot: {
    startsAt: Date;
    endsAt: Date;
    location: string | null;
    mode: string | null;
    block: {
      template: {
        eventType: string | null;
      } | null;
    } | null;
  };
  party: {
    id: number;
    name: string;
    email: string | null;
  };
  tenant: {
    name: string | null;
  };
}

/**
 * Build notification data from a booking with its relations.
 * Returns null if required fields are missing (e.g., no client email).
 */
export function buildNotificationDataFromBooking(
  booking: BookingWithRelations
): BookingNotificationData | null {
  if (!booking.party.email) {
    return null;
  }

  let mode: "in_person" | "virtual" | null = null;
  if (booking.slot.mode === "IN_PERSON") mode = "in_person";
  else if (booking.slot.mode === "VIRTUAL") mode = "virtual";

  return {
    bookingId: booking.id,
    tenantId: booking.tenantId,
    eventType: booking.slot.block?.template?.eventType || "Appointment",
    startsAt: booking.slot.startsAt,
    endsAt: booking.slot.endsAt,
    location: booking.slot.location,
    mode,
    clientPartyId: booking.party.id,
    clientEmail: booking.party.email,
    clientName: booking.party.name || "Client",
    breederName: booking.tenant.name || "Your Breeder",
    tenantName: booking.tenant.name || "BreederHQ",
    nextSteps: booking.nextSteps,
  };
}

/**
 * Append ICS data as a download link in the email HTML.
 * Uses a data URI for the calendar file since Resend doesn't support attachments directly.
 */
function appendIcsDownloadLink(html: string, icsContent: string, filename: string): string {
  const base64Ics = Buffer.from(icsContent, "utf-8").toString("base64");
  const dataUri = `data:text/calendar;base64,${base64Ics}`;

  const downloadButton = `
    <div style="text-align: center; margin: 20px 0;">
      <a href="${dataUri}" download="${filename}" style="display: inline-block; background: #6b7280; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px;">
        📅 Add to Calendar
      </a>
    </div>
  `;

  // Insert before the closing </body> tag
  return html.replace("</body>", `${downloadButton}</body>`);
}

/**
 * Send booking confirmation notification (email + ICS).
 */
export async function sendBookingConfirmationNotification(
  data: BookingNotificationData
): Promise<SendEmailResult> {
  const emailParams: SchedulingEmailParams = {
    eventType: data.eventType,
    clientName: data.clientName,
    breederName: data.breederName,
    tenantName: data.tenantName,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    location: data.location,
    mode: data.mode,
    nextSteps: data.nextSteps,
  };

  const { subject, html, text } = renderBookingConfirmationEmail(emailParams);

  const icsData: IcsBookingData = {
    bookingId: data.bookingId,
    eventType: data.eventType,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    location: data.location,
    mode: data.mode,
    breederName: data.breederName,
    clientName: data.clientName,
    nextSteps: data.nextSteps,
    tenantId: data.tenantId,
  };

  const icsContent = generateBookingConfirmationIcs(icsData);
  const icsFilename = getIcsFilename(data.bookingId, "confirm");
  const htmlWithIcs = appendIcsDownloadLink(html, icsContent, icsFilename);

  return sendEmail({
    tenantId: data.tenantId,
    to: data.clientEmail,
    subject,
    html: htmlWithIcs,
    text,
    templateKey: `scheduling_confirmation_${data.bookingId}`,
    category: "transactional",
    metadata: {
      bookingId: data.bookingId,
      eventType: data.eventType,
      slotStartsAt: data.startsAt.toISOString(),
    },
  });
}

/**
 * Send booking cancellation notification (email + ICS).
 */
export async function sendBookingCancellationNotification(
  data: BookingNotificationData
): Promise<SendEmailResult> {
  const emailParams: SchedulingEmailParams = {
    eventType: data.eventType,
    clientName: data.clientName,
    breederName: data.breederName,
    tenantName: data.tenantName,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    location: data.location,
    mode: data.mode,
    nextSteps: null, // No next steps for cancellations
  };

  const { subject, html, text } = renderBookingCancellationEmail(emailParams);

  const icsData: IcsBookingData = {
    bookingId: data.bookingId,
    eventType: data.eventType,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    location: data.location,
    mode: data.mode,
    breederName: data.breederName,
    clientName: data.clientName,
    nextSteps: null,
    tenantId: data.tenantId,
  };

  const icsContent = generateBookingCancellationIcs(icsData);
  const icsFilename = getIcsFilename(data.bookingId, "cancel");
  const htmlWithIcs = appendIcsDownloadLink(html, icsContent, icsFilename);

  return sendEmail({
    tenantId: data.tenantId,
    to: data.clientEmail,
    subject,
    html: htmlWithIcs,
    text,
    templateKey: `scheduling_cancellation_${data.bookingId}`,
    category: "transactional",
    metadata: {
      bookingId: data.bookingId,
      eventType: data.eventType,
      slotStartsAt: data.startsAt.toISOString(),
    },
  });
}

/**
 * Send booking reschedule notification (email + ICS).
 */
export async function sendBookingRescheduleNotification(
  data: RescheduleNotificationData
): Promise<SendEmailResult> {
  const emailParams: RescheduleEmailParams = {
    eventType: data.eventType,
    clientName: data.clientName,
    breederName: data.breederName,
    tenantName: data.tenantName,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    originalStartsAt: data.originalStartsAt,
    originalEndsAt: data.originalEndsAt,
    location: data.location,
    mode: data.mode,
    nextSteps: data.nextSteps,
  };

  const { subject, html, text } = renderBookingRescheduleEmail(emailParams);

  const icsData: IcsBookingData = {
    bookingId: data.bookingId,
    eventType: data.eventType,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    location: data.location,
    mode: data.mode,
    breederName: data.breederName,
    clientName: data.clientName,
    nextSteps: data.nextSteps,
    tenantId: data.tenantId,
  };

  const icsContent = generateBookingRescheduleIcs(icsData);
  const icsFilename = getIcsFilename(data.bookingId, "reschedule");
  const htmlWithIcs = appendIcsDownloadLink(html, icsContent, icsFilename);

  return sendEmail({
    tenantId: data.tenantId,
    to: data.clientEmail,
    subject,
    html: htmlWithIcs,
    text,
    templateKey: `scheduling_reschedule_${data.bookingId}`,
    category: "transactional",
    metadata: {
      bookingId: data.bookingId,
      eventType: data.eventType,
      newSlotStartsAt: data.startsAt.toISOString(),
      originalSlotStartsAt: data.originalStartsAt.toISOString(),
    },
  });
}

/**
 * Send booking reminder notification (email + ICS).
 * Used by the reminder cron job 24 hours before appointments.
 */
export async function sendBookingReminderNotification(
  data: BookingNotificationData
): Promise<SendEmailResult> {
  const emailParams: SchedulingEmailParams = {
    eventType: data.eventType,
    clientName: data.clientName,
    breederName: data.breederName,
    tenantName: data.tenantName,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    location: data.location,
    mode: data.mode,
    nextSteps: data.nextSteps,
  };

  const { subject, html, text } = renderBookingReminderEmail(emailParams);

  const icsData: IcsBookingData = {
    bookingId: data.bookingId,
    eventType: data.eventType,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    location: data.location,
    mode: data.mode,
    breederName: data.breederName,
    clientName: data.clientName,
    nextSteps: data.nextSteps,
    tenantId: data.tenantId,
  };

  const icsContent = generateBookingReminderIcs(icsData);
  const icsFilename = getIcsFilename(data.bookingId, "reminder");
  const htmlWithIcs = appendIcsDownloadLink(html, icsContent, icsFilename);

  return sendEmail({
    tenantId: data.tenantId,
    to: data.clientEmail,
    subject,
    html: htmlWithIcs,
    text,
    templateKey: `scheduling_reminder_${data.bookingId}`,
    category: "transactional",
    metadata: {
      bookingId: data.bookingId,
      eventType: data.eventType,
      slotStartsAt: data.startsAt.toISOString(),
    },
  });
}
