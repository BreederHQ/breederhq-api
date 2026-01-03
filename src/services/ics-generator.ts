// src/services/ics-generator.ts
// ICS (iCalendar) generator for scheduling booking notifications.
// Generates calendar invites for confirmation, cancellation, and reschedule events.

/**
 * Booking data required for ICS generation.
 */
export interface IcsBookingData {
  bookingId: number;
  eventType: string;
  startsAt: Date;
  endsAt: Date;
  timezone?: string;
  location: string | null;
  mode: "in_person" | "virtual" | null;
  breederName: string;
  clientName: string;
  nextSteps: string | null;
  tenantId: number;
}

/**
 * ICS event method types.
 */
export type IcsMethod = "REQUEST" | "CANCEL" | "PUBLISH";

/**
 * Escape special characters for ICS format.
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Format date to ICS datetime format (YYYYMMDDTHHMMSSZ).
 */
function formatIcsDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Generate a stable UID for a booking.
 * UID format: booking-{tenantId}-{bookingId}@breederhq.com
 */
function generateBookingUid(bookingId: number, tenantId: number): string {
  return `booking-${tenantId}-${bookingId}@breederhq.com`;
}

/**
 * Build the location string based on mode.
 */
function buildLocationString(data: IcsBookingData): string {
  if (data.mode === "virtual") {
    return "Virtual Meeting";
  }
  return data.location || "Location to be confirmed";
}

/**
 * Build the description including next steps.
 */
function buildDescription(data: IcsBookingData, action: "confirm" | "cancel" | "reschedule"): string {
  const parts: string[] = [];

  if (action === "confirm") {
    parts.push(`Your ${data.eventType} appointment has been confirmed.`);
  } else if (action === "cancel") {
    parts.push(`Your ${data.eventType} appointment has been cancelled.`);
  } else if (action === "reschedule") {
    parts.push(`Your ${data.eventType} appointment has been rescheduled.`);
  }

  parts.push("");
  parts.push(`With: ${data.breederName}`);

  if (data.mode === "virtual") {
    parts.push("Mode: Virtual Meeting");
  } else if (data.location) {
    parts.push(`Location: ${data.location}`);
  }

  if (data.nextSteps && action !== "cancel") {
    parts.push("");
    parts.push("Next Steps:");
    parts.push(data.nextSteps);
  }

  parts.push("");
  parts.push("Managed via BreederHQ Client Portal");

  return parts.join("\n");
}

/**
 * Generate ICS content for a booking confirmation.
 */
export function generateBookingConfirmationIcs(data: IcsBookingData): string {
  return generateIcs(data, "REQUEST", "confirm");
}

/**
 * Generate ICS content for a booking cancellation.
 */
export function generateBookingCancellationIcs(data: IcsBookingData): string {
  return generateIcs(data, "CANCEL", "cancel");
}

/**
 * Generate ICS content for a booking reschedule.
 */
export function generateBookingRescheduleIcs(data: IcsBookingData): string {
  return generateIcs(data, "REQUEST", "reschedule");
}

/**
 * Generate ICS content for a booking reminder.
 */
export function generateBookingReminderIcs(data: IcsBookingData): string {
  return generateIcs(data, "PUBLISH", "confirm");
}

/**
 * Core ICS generation function.
 */
function generateIcs(
  data: IcsBookingData,
  method: IcsMethod,
  action: "confirm" | "cancel" | "reschedule"
): string {
  const uid = generateBookingUid(data.bookingId, data.tenantId);
  const dtstamp = formatIcsDateTime(new Date());
  const dtstart = formatIcsDateTime(data.startsAt);
  const dtend = formatIcsDateTime(data.endsAt);
  const location = escapeIcsText(buildLocationString(data));
  const description = escapeIcsText(buildDescription(data, action));

  let summary = `${data.eventType} with ${data.breederName}`;
  if (action === "cancel") {
    summary = `CANCELLED: ${summary}`;
  } else if (action === "reschedule") {
    summary = `RESCHEDULED: ${summary}`;
  }
  summary = escapeIcsText(summary);

  // STATUS field based on action
  const status = action === "cancel" ? "CANCELLED" : "CONFIRMED";

  // SEQUENCE increments for updates (reschedule/cancel)
  const sequence = action === "confirm" ? "0" : "1";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BreederHQ//Scheduling//EN",
    `METHOD:${method}`,
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `STATUS:${status}`,
    `SEQUENCE:${sequence}`,
    `ORGANIZER;CN=${escapeIcsText(data.breederName)}:mailto:noreply@breederhq.com`,
  ];

  // Add alarm for non-cancelled events (15 minutes before)
  if (action !== "cancel") {
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:Reminder: ${data.eventType} with ${data.breederName}`);
    lines.push("TRIGGER:-PT15M");
    lines.push("END:VALARM");
  }

  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

/**
 * Get the ICS filename for a booking.
 */
export function getIcsFilename(bookingId: number, action: "confirm" | "cancel" | "reschedule" | "reminder"): string {
  const prefix = action === "cancel" ? "cancelled" : action === "reschedule" ? "rescheduled" : "appointment";
  return `${prefix}-${bookingId}.ics`;
}
