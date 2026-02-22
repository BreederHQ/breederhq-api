// src/services/email-templates.ts

import {
  wrapEmailLayout,
  emailButton,
  emailInfoCard,
  emailDetailRows,
  emailGreeting,
  emailParagraph,
  emailHeading,
  emailAccent,
} from "./email-layout.js";

export interface InvoiceTemplateParams {
  invoiceNumber: string;
  amountCents: number;
  currency?: string;
  dueAt?: Date | null;
  clientName: string;
  tenantName: string;
  invoiceUrl?: string;
}

export function renderInvoiceEmail(params: InvoiceTemplateParams): { subject: string; html: string; text: string } {
  const {
    invoiceNumber,
    amountCents,
    currency = "USD",
    dueAt,
    clientName,
    tenantName,
    invoiceUrl,
  } = params;

  const amount = (amountCents / 100).toFixed(2);
  const dueDate = dueAt ? new Date(dueAt).toLocaleDateString() : "upon receipt";

  const subject = `Invoice ${invoiceNumber} from ${tenantName}`;

  const text = `
Hi ${clientName},

Your invoice ${invoiceNumber} is ready.

Amount: ${currency} ${amount}
Due: ${dueDate}

${invoiceUrl ? `View invoice: ${invoiceUrl}` : "Please contact us for payment details."}

Thank you,
${tenantName}
`.trim();

  const html = wrapEmailLayout({
    title: "Invoice Ready",
    footerOrgName: tenantName,
    body: [
      emailGreeting(clientName),
      emailParagraph(`Your invoice from ${emailAccent(tenantName)} is ready.`),
      emailDetailRows([
        { label: "Invoice Number", value: invoiceNumber },
        { label: "Amount Due", value: `${currency} ${amount}` },
        { label: "Payment Due", value: dueDate },
      ]),
      invoiceUrl
        ? emailButton("View Invoice", invoiceUrl)
        : emailParagraph("Please contact us for payment details."),
    ].join("\n"),
  });

  return { subject, html, text };
}

// ---------- Scheduling Email Templates ----------

export interface SchedulingEmailParams {
  eventType: string;
  clientName: string;
  breederName: string;
  tenantName: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  mode: "in_person" | "virtual" | null;
  nextSteps: string | null;
  portalUrl?: string;
}

function formatSchedulingDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatSchedulingTime(date: Date): string {
  return date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function buildLocationHtml(location: string | null, mode: "in_person" | "virtual" | null): string {
  if (mode === "virtual") {
    return '<p style="color: #e5e5e5; margin: 10px 0;"><strong style="color: #ffffff;">Location:</strong> Virtual Meeting</p>';
  }
  if (location) {
    return `<p style="color: #e5e5e5; margin: 10px 0;"><strong style="color: #ffffff;">Location:</strong> ${location}</p>`;
  }
  return '<p style="color: #e5e5e5; margin: 10px 0;"><strong style="color: #ffffff;">Location:</strong> To be confirmed</p>';
}

function buildLocationText(location: string | null, mode: "in_person" | "virtual" | null): string {
  if (mode === "virtual") {
    return "Location: Virtual Meeting";
  }
  if (location) {
    return `Location: ${location}`;
  }
  return "Location: To be confirmed";
}

export function renderBookingConfirmationEmail(params: SchedulingEmailParams): { subject: string; html: string; text: string } {
  const { eventType, clientName, breederName, tenantName, startsAt, endsAt, location, mode, nextSteps, portalUrl } = params;

  const dateStr = formatSchedulingDateTime(startsAt);
  const endTimeStr = formatSchedulingTime(endsAt);

  const subject = `Appointment Confirmed: ${eventType} with ${breederName}`;

  const text = `
Hi ${clientName},

Your appointment has been confirmed!

${eventType}
When: ${dateStr} - ${endTimeStr}
${buildLocationText(location, mode)}
With: ${breederName}

${nextSteps ? `Next Steps:\n${nextSteps}\n` : ""}
${portalUrl ? `View in Portal: ${portalUrl}` : ""}

Thank you,
${tenantName}
`.trim();

  const html = wrapEmailLayout({
    title: "Appointment Confirmed",
    footerOrgName: tenantName,
    body: [
      emailGreeting(clientName),
      emailParagraph("Your appointment has been confirmed!"),
      emailInfoCard(
        [
          `<p style="color: #f97316; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">${eventType}</p>`,
          `<p style="color: #e5e5e5; margin: 10px 0;"><strong style="color: #ffffff;">When:</strong> ${dateStr} - ${endTimeStr}</p>`,
          buildLocationHtml(location, mode),
          `<p style="color: #e5e5e5; margin: 10px 0;"><strong style="color: #ffffff;">With:</strong> ${breederName}</p>`,
        ].join("\n"),
        { borderColor: "orange" },
      ),
      nextSteps
        ? emailInfoCard(
            [
              emailHeading("Next Steps"),
              `<p style="color: #e5e5e5; margin: 0; white-space: pre-wrap;">${nextSteps}</p>`,
            ].join("\n"),
            { borderColor: "yellow" },
          )
        : "",
      portalUrl ? emailButton("View in Portal", portalUrl) : "",
    ].join("\n"),
  });

  return { subject, html, text };
}

export function renderBookingCancellationEmail(params: SchedulingEmailParams): { subject: string; html: string; text: string } {
  const { eventType, clientName, breederName, tenantName, startsAt, endsAt, location, mode, portalUrl } = params;

  const dateStr = formatSchedulingDateTime(startsAt);
  const endTimeStr = formatSchedulingTime(endsAt);

  const subject = `Appointment Cancelled: ${eventType} with ${breederName}`;

  const text = `
Hi ${clientName},

Your appointment has been cancelled.

${eventType}
Original Time: ${dateStr} - ${endTimeStr}
${buildLocationText(location, mode)}
With: ${breederName}

If you'd like to reschedule, please visit the portal or contact ${breederName}.

${portalUrl ? `View in Portal: ${portalUrl}` : ""}

Thank you,
${tenantName}
`.trim();

  const html = wrapEmailLayout({
    title: "Appointment Cancelled",
    footerOrgName: tenantName,
    body: [
      emailGreeting(clientName),
      emailParagraph("Your appointment has been cancelled."),
      emailInfoCard(
        [
          `<p style="color: #dc2626; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">${eventType}</p>`,
          `<p style="color: #e5e5e5; margin: 10px 0;"><strong style="color: #ffffff;">Original Time:</strong> ${dateStr} - ${endTimeStr}</p>`,
          buildLocationHtml(location, mode),
          `<p style="color: #e5e5e5; margin: 10px 0;"><strong style="color: #ffffff;">With:</strong> ${breederName}</p>`,
        ].join("\n"),
        { borderColor: "red" },
      ),
      emailParagraph(`If you'd like to reschedule, please visit the portal or contact ${breederName}.`),
      portalUrl ? emailButton("View in Portal", portalUrl, "red") : "",
    ].join("\n"),
  });

  return { subject, html, text };
}

export interface RescheduleEmailParams extends SchedulingEmailParams {
  originalStartsAt: Date;
  originalEndsAt: Date;
}

export function renderBookingRescheduleEmail(params: RescheduleEmailParams): { subject: string; html: string; text: string } {
  const { eventType, clientName, breederName, tenantName, startsAt, endsAt, originalStartsAt, originalEndsAt, location, mode, nextSteps, portalUrl } = params;

  const newDateStr = formatSchedulingDateTime(startsAt);
  const newEndTimeStr = formatSchedulingTime(endsAt);
  const oldDateStr = formatSchedulingDateTime(originalStartsAt);
  const oldEndTimeStr = formatSchedulingTime(originalEndsAt);

  const subject = `Appointment Rescheduled: ${eventType} with ${breederName}`;

  const text = `
Hi ${clientName},

Your appointment has been rescheduled.

${eventType}

NEW TIME: ${newDateStr} - ${newEndTimeStr}
(Previously: ${oldDateStr} - ${oldEndTimeStr})

${buildLocationText(location, mode)}
With: ${breederName}

${nextSteps ? `Next Steps:\n${nextSteps}\n` : ""}
${portalUrl ? `View in Portal: ${portalUrl}` : ""}

Thank you,
${tenantName}
`.trim();

  const html = wrapEmailLayout({
    title: "Appointment Rescheduled",
    footerOrgName: tenantName,
    body: [
      emailGreeting(clientName),
      emailParagraph("Your appointment has been rescheduled."),
      emailInfoCard(
        [
          `<p style="color: #f97316; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">${eventType}</p>`,
          `<p style="color: #e5e5e5; margin: 10px 0;"><strong style="color: #ffffff;">NEW TIME:</strong> ${newDateStr} - ${newEndTimeStr}</p>`,
          `<p style="color: #737373; margin: 10px 0; font-size: 14px;"><s>Previously: ${oldDateStr} - ${oldEndTimeStr}</s></p>`,
          buildLocationHtml(location, mode),
          `<p style="color: #e5e5e5; margin: 10px 0;"><strong style="color: #ffffff;">With:</strong> ${breederName}</p>`,
        ].join("\n"),
        { borderColor: "orange" },
      ),
      nextSteps
        ? emailInfoCard(
            [
              emailHeading("Next Steps"),
              `<p style="color: #e5e5e5; margin: 0; white-space: pre-wrap;">${nextSteps}</p>`,
            ].join("\n"),
            { borderColor: "yellow" },
          )
        : "",
      portalUrl ? emailButton("View in Portal", portalUrl) : "",
    ].join("\n"),
  });

  return { subject, html, text };
}

export function renderBookingReminderEmail(params: SchedulingEmailParams): { subject: string; html: string; text: string } {
  const { eventType, clientName, breederName, tenantName, startsAt, endsAt, location, mode, nextSteps, portalUrl } = params;

  const dateStr = formatSchedulingDateTime(startsAt);
  const endTimeStr = formatSchedulingTime(endsAt);

  const subject = `Reminder: ${eventType} with ${breederName} Tomorrow`;

  const text = `
Hi ${clientName},

This is a friendly reminder about your upcoming appointment.

${eventType}
When: ${dateStr} - ${endTimeStr}
${buildLocationText(location, mode)}
With: ${breederName}

${nextSteps ? `Reminder - Next Steps:\n${nextSteps}\n` : ""}
${portalUrl ? `View in Portal: ${portalUrl}` : ""}

Thank you,
${tenantName}
`.trim();

  const html = wrapEmailLayout({
    title: "Appointment Reminder",
    footerOrgName: tenantName,
    body: [
      emailGreeting(clientName),
      emailParagraph("This is a friendly reminder about your upcoming appointment."),
      emailInfoCard(
        [
          `<p style="color: #3b82f6; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">${eventType}</p>`,
          `<p style="color: #e5e5e5; margin: 10px 0;"><strong style="color: #ffffff;">When:</strong> ${dateStr} - ${endTimeStr}</p>`,
          buildLocationHtml(location, mode),
          `<p style="color: #e5e5e5; margin: 10px 0;"><strong style="color: #ffffff;">With:</strong> ${breederName}</p>`,
        ].join("\n"),
        { borderColor: "blue" },
      ),
      nextSteps
        ? emailInfoCard(
            [
              emailHeading("Reminder - Next Steps"),
              `<p style="color: #e5e5e5; margin: 0; white-space: pre-wrap;">${nextSteps}</p>`,
            ].join("\n"),
            { borderColor: "yellow" },
          )
        : "",
      portalUrl ? emailButton("View in Portal", portalUrl, "blue") : "",
    ].join("\n"),
  });

  return { subject, html, text };
}
