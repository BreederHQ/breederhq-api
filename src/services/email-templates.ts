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
  emailBulletList,
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

// ---------- Payment Notification Email Templates ----------

export interface PaymentReceiptParams {
  invoiceNumber: string;
  paymentAmountCents: number;
  totalCents: number;
  remainingBalanceCents: number;
  clientName: string;
  tenantName: string;
  methodType?: string | null;
  receivedAt: Date;
  portalUrl?: string;
  currency?: string;
}

/**
 * Payment receipt email sent to the buyer/client after a payment is recorded.
 */
export function renderPaymentReceiptEmail(params: PaymentReceiptParams): { subject: string; html: string; text: string } {
  const {
    invoiceNumber,
    paymentAmountCents,
    totalCents,
    remainingBalanceCents,
    clientName,
    tenantName,
    methodType,
    receivedAt,
    portalUrl,
    currency = "USD",
  } = params;

  const paymentAmount = (paymentAmountCents / 100).toFixed(2);
  const total = (totalCents / 100).toFixed(2);
  const remaining = (remainingBalanceCents / 100).toFixed(2);
  const dateStr = new Date(receivedAt).toLocaleDateString();
  const isPaid = remainingBalanceCents <= 0;

  const subject = `Payment received for Invoice ${invoiceNumber}`;

  const text = `
Hi ${clientName},

Your payment of ${currency} ${paymentAmount} for invoice ${invoiceNumber} has been received.

Invoice Total: ${currency} ${total}
Payment Amount: ${currency} ${paymentAmount}
${isPaid ? "Status: Paid in Full" : `Remaining Balance: ${currency} ${remaining}`}
Date: ${dateStr}
${methodType ? `Method: ${methodType}` : ""}

${portalUrl ? `View your invoices: ${portalUrl}` : ""}

Thank you,
${tenantName}
`.trim();

  const html = wrapEmailLayout({
    title: "Payment Received",
    footerOrgName: tenantName,
    body: [
      emailGreeting(clientName),
      emailParagraph(
        `Your payment of ${emailAccent(`${currency} ${paymentAmount}`)} for invoice ${emailAccent(invoiceNumber)} has been received.`
      ),
      emailDetailRows([
        { label: "Invoice", value: invoiceNumber },
        { label: "Payment Amount", value: `${currency} ${paymentAmount}` },
        { label: "Invoice Total", value: `${currency} ${total}` },
        ...(isPaid
          ? [{ label: "Status", value: "Paid in Full" }]
          : [{ label: "Remaining Balance", value: `${currency} ${remaining}` }]),
        { label: "Date", value: dateStr },
        ...(methodType ? [{ label: "Method", value: methodType }] : []),
      ]),
      isPaid
        ? emailInfoCard(emailParagraph("This invoice is now paid in full. Thank you!"), { borderColor: "green" })
        : "",
      portalUrl ? emailButton("View Invoices", portalUrl) : "",
    ].join("\n"),
  });

  return { subject, html, text };
}

export interface BreederPaymentNotificationParams {
  invoiceNumber: string;
  paymentAmountCents: number;
  remainingBalanceCents: number;
  clientName: string;
  tenantName: string;
  isPaid: boolean;
  currency?: string;
}

/**
 * Payment notification email sent to the breeder when a payment is recorded.
 */
export function renderBreederPaymentNotification(params: BreederPaymentNotificationParams): { subject: string; html: string; text: string } {
  const {
    invoiceNumber,
    paymentAmountCents,
    remainingBalanceCents,
    clientName,
    tenantName,
    isPaid,
    currency = "USD",
  } = params;

  const paymentAmount = (paymentAmountCents / 100).toFixed(2);
  const remaining = (remainingBalanceCents / 100).toFixed(2);

  const subject = isPaid
    ? `Invoice ${invoiceNumber} paid in full by ${clientName}`
    : `Payment received on Invoice ${invoiceNumber} from ${clientName}`;

  const text = `
${clientName} made a payment of ${currency} ${paymentAmount} on invoice ${invoiceNumber}.

${isPaid ? "This invoice is now paid in full." : `Remaining balance: ${currency} ${remaining}`}

— ${tenantName}
`.trim();

  const html = wrapEmailLayout({
    title: "Payment Received",
    footerOrgName: tenantName,
    body: [
      emailParagraph(
        `${emailAccent(clientName)} made a payment of ${emailAccent(`${currency} ${paymentAmount}`)} on invoice ${emailAccent(invoiceNumber)}.`
      ),
      isPaid
        ? emailInfoCard(emailParagraph("This invoice is now paid in full."), { borderColor: "green" })
        : emailDetailRows([
            { label: "Remaining Balance", value: `${currency} ${remaining}` },
          ]),
    ].join("\n"),
  });

  return { subject, html, text };
}

// ---------- Overdue Invoice Reminder Email Templates ----------

export interface OverdueReminderParams {
  invoiceNumber: string;
  amountCents: number;
  balanceCents: number;
  dueAt: Date;
  daysOverdue: number;
  clientName: string;
  tenantName: string;
  paymentMode: "stripe" | "manual";
  portalUrl?: string;
  paymentInstructions?: string | null;
  currency?: string;
}

/**
 * Overdue invoice reminder sent to the buyer/client.
 */
export function renderOverdueReminderEmail(params: OverdueReminderParams): { subject: string; html: string; text: string } {
  const {
    invoiceNumber,
    balanceCents,
    dueAt,
    daysOverdue,
    clientName,
    tenantName,
    paymentMode,
    portalUrl,
    paymentInstructions,
    currency = "USD",
  } = params;

  const balance = (balanceCents / 100).toFixed(2);
  const dueDate = new Date(dueAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = `Payment Reminder: Invoice ${invoiceNumber} is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue`;

  const paymentInfo = paymentMode === "stripe" && portalUrl
    ? `Pay online: ${portalUrl}`
    : paymentInstructions
      ? `Payment instructions:\n${paymentInstructions}`
      : `Please contact ${tenantName} for payment details.`;

  const text = `
Hi ${clientName},

This is a friendly reminder that invoice ${invoiceNumber} is now ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} past due.

Outstanding Balance: ${currency} ${balance}
Due Date: ${dueDate}

${paymentInfo}

If you've already sent payment, please disregard this notice.

Thank you,
${tenantName}
`.trim();

  const html = wrapEmailLayout({
    title: "Payment Reminder",
    footerOrgName: tenantName,
    body: [
      emailGreeting(clientName),
      emailParagraph(
        `This is a friendly reminder that invoice ${emailAccent(invoiceNumber)} is now ${emailAccent(`${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}`)} past due.`
      ),
      emailDetailRows([
        { label: "Invoice", value: invoiceNumber },
        { label: "Outstanding Balance", value: `${currency} ${balance}` },
        { label: "Due Date", value: dueDate },
        { label: "Days Overdue", value: String(daysOverdue) },
      ]),
      paymentMode === "stripe" && portalUrl
        ? emailButton("Pay Now", portalUrl, "orange")
        : paymentInstructions
          ? emailInfoCard(
              [
                emailHeading("Payment Instructions"),
                `<p style="color: #e5e5e5; margin: 0; white-space: pre-wrap;">${paymentInstructions}</p>`,
              ].join("\n"),
              { borderColor: "yellow" },
            )
          : emailParagraph(`Please contact ${tenantName} for payment details.`),
      emailParagraph("If you've already sent payment, please disregard this notice."),
    ].join("\n"),
  });

  return { subject, html, text };
}

export interface BreederOverdueSummaryParams {
  tenantName: string;
  overdueCount: number;
  totalOverdueCents: number;
  currency?: string;
}

/**
 * Daily summary to breeder about their overdue invoices.
 */
export function renderBreederOverdueSummary(params: BreederOverdueSummaryParams): { subject: string; html: string; text: string } {
  const {
    tenantName,
    overdueCount,
    totalOverdueCents,
    currency = "USD",
  } = params;

  const total = (totalOverdueCents / 100).toFixed(2);

  const subject = `${overdueCount} overdue invoice${overdueCount !== 1 ? "s" : ""} — ${currency} ${total} outstanding`;

  const text = `
You have ${overdueCount} overdue invoice${overdueCount !== 1 ? "s" : ""} totaling ${currency} ${total}.

Reminder emails have been sent to the respective clients.

— ${tenantName}
`.trim();

  const html = wrapEmailLayout({
    title: "Overdue Invoice Summary",
    footerOrgName: tenantName,
    body: [
      emailParagraph(
        `You have ${emailAccent(String(overdueCount))} overdue invoice${overdueCount !== 1 ? "s" : ""} totaling ${emailAccent(`${currency} ${total}`)}.`
      ),
      emailParagraph("Reminder emails have been sent to the respective clients."),
    ].join("\n"),
  });

  return { subject, html, text };
}

// ---------- Compliance Reminder Email Templates ----------

export interface ComplianceReminderParams {
  clientName: string;
  offspringName: string;
  requirementType: string;
  requirementDescription: string;
  dueDate: string;
  daysRemaining: number;
  tenantName: string;
  portalUrl: string;
}

/**
 * 30-day compliance reminder — informational tone.
 */
export function renderComplianceReminderEmail(params: ComplianceReminderParams): { subject: string; html: string; text: string } {
  const { clientName, offspringName, requirementType, requirementDescription, dueDate, daysRemaining, tenantName, portalUrl } = params;

  const subject = `Reminder: ${requirementType} due in ${daysRemaining} days for ${offspringName}`;

  const text = `
Hi ${clientName},

This is a friendly reminder about an upcoming health guarantee requirement for ${offspringName}.

Requirement: ${requirementType}
Details: ${requirementDescription}
Due Date: ${dueDate}
Days Remaining: ${daysRemaining}

Please complete this requirement before the deadline to maintain your health guarantee coverage.

View in Portal: ${portalUrl}

Thank you,
${tenantName}
`.trim();

  const html = wrapEmailLayout({
    title: "Health Guarantee Reminder",
    footerOrgName: tenantName,
    body: [
      emailGreeting(clientName),
      emailParagraph(
        `This is a friendly reminder about an upcoming health guarantee requirement for ${emailAccent(offspringName)}.`
      ),
      emailInfoCard(
        [
          `<p style="color: #3b82f6; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">${requirementType}</p>`,
          `<p style="color: #e5e5e5; margin: 8px 0;">${requirementDescription}</p>`,
        ].join("\n"),
        { borderColor: "blue" },
      ),
      emailDetailRows([
        { label: "Due Date", value: dueDate },
        { label: "Days Remaining", value: String(daysRemaining) },
      ]),
      emailParagraph("Please complete this requirement before the deadline to maintain your health guarantee coverage."),
      emailButton("View in Portal", portalUrl),
    ].join("\n"),
  });

  return { subject, html, text };
}

/**
 * 7-day compliance reminder — urgent tone, amber styling.
 */
export function renderComplianceUrgentEmail(params: ComplianceReminderParams): { subject: string; html: string; text: string } {
  const { clientName, offspringName, requirementType, requirementDescription, dueDate, daysRemaining, tenantName, portalUrl } = params;

  const subject = `Urgent: ${requirementType} due in ${daysRemaining} days for ${offspringName}`;

  const text = `
Hi ${clientName},

URGENT: Your health guarantee requirement for ${offspringName} is due in ${daysRemaining} days.

Requirement: ${requirementType}
Details: ${requirementDescription}
Due Date: ${dueDate}

Please take action soon to avoid losing your health guarantee coverage.

View in Portal: ${portalUrl}

Thank you,
${tenantName}
`.trim();

  const html = wrapEmailLayout({
    title: "Urgent: Compliance Deadline Approaching",
    footerOrgName: tenantName,
    body: [
      emailGreeting(clientName),
      emailParagraph(
        `Your health guarantee requirement for ${emailAccent(offspringName)} is due in ${emailAccent(`${daysRemaining} days`)}.`
      ),
      emailInfoCard(
        [
          `<p style="color: #f59e0b; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">${requirementType}</p>`,
          `<p style="color: #e5e5e5; margin: 8px 0;">${requirementDescription}</p>`,
        ].join("\n"),
        { borderColor: "yellow" },
      ),
      emailDetailRows([
        { label: "Due Date", value: dueDate },
        { label: "Days Remaining", value: String(daysRemaining) },
      ]),
      emailParagraph("Please take action soon to avoid losing your health guarantee coverage."),
      emailButton("Take Action Now", portalUrl, "orange"),
    ].join("\n"),
  });

  return { subject, html, text };
}

/**
 * 1-day compliance reminder — critical tone, red styling.
 */
export function renderComplianceFinalEmail(params: ComplianceReminderParams): { subject: string; html: string; text: string } {
  const { clientName, offspringName, requirementType, requirementDescription, dueDate, tenantName, portalUrl } = params;

  const subject = `FINAL NOTICE: ${requirementType} due TOMORROW for ${offspringName}`;

  const text = `
Hi ${clientName},

FINAL NOTICE: Your health guarantee requirement for ${offspringName} is due TOMORROW.

Requirement: ${requirementType}
Details: ${requirementDescription}
Due Date: ${dueDate}

Failure to complete this requirement by the deadline may void your health guarantee. Please take immediate action.

View in Portal: ${portalUrl}

Thank you,
${tenantName}
`.trim();

  const html = wrapEmailLayout({
    title: "Final Notice: Compliance Due Tomorrow",
    footerOrgName: tenantName,
    body: [
      emailGreeting(clientName),
      emailInfoCard(
        [
          `<p style="color: #ef4444; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">FINAL NOTICE</p>`,
          `<p style="color: #e5e5e5; margin: 0;">Your health guarantee requirement for ${emailAccent(offspringName)} is due ${emailAccent("TOMORROW")}.</p>`,
        ].join("\n"),
        { borderColor: "red" },
      ),
      emailDetailRows([
        { label: "Requirement", value: requirementType },
        { label: "Details", value: requirementDescription },
        { label: "Due Date", value: dueDate },
      ]),
      emailParagraph("Failure to complete this requirement by the deadline may void your health guarantee. Please take immediate action."),
      emailButton("Complete Now", portalUrl, "red"),
    ].join("\n"),
  });

  return { subject, html, text };
}

/**
 * Overdue compliance notification — action-required tone, red styling.
 */
export function renderComplianceOverdueEmail(params: ComplianceReminderParams): { subject: string; html: string; text: string } {
  const { clientName, offspringName, requirementType, requirementDescription, dueDate, daysRemaining, tenantName, portalUrl } = params;

  const daysOverdue = Math.abs(daysRemaining);

  const subject = `Action Required: ${requirementType} is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue for ${offspringName}`;

  const text = `
Hi ${clientName},

ACTION REQUIRED: Your health guarantee requirement for ${offspringName} is now ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue.

Requirement: ${requirementType}
Details: ${requirementDescription}
Was Due: ${dueDate}
Days Overdue: ${daysOverdue}

Your health guarantee coverage may be at risk. Please complete this requirement as soon as possible and upload proof in your portal.

View in Portal: ${portalUrl}

Thank you,
${tenantName}
`.trim();

  const html = wrapEmailLayout({
    title: "Action Required: Overdue Compliance",
    footerOrgName: tenantName,
    body: [
      emailGreeting(clientName),
      emailInfoCard(
        [
          `<p style="color: #ef4444; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">OVERDUE</p>`,
          `<p style="color: #e5e5e5; margin: 0;">Your health guarantee requirement for ${emailAccent(offspringName)} is now ${emailAccent(`${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}`)} overdue.</p>`,
        ].join("\n"),
        { borderColor: "red" },
      ),
      emailDetailRows([
        { label: "Requirement", value: requirementType },
        { label: "Details", value: requirementDescription },
        { label: "Was Due", value: dueDate },
        { label: "Days Overdue", value: String(daysOverdue) },
      ]),
      emailParagraph("Your health guarantee coverage may be at risk. Please complete this requirement as soon as possible and upload proof in your portal."),
      emailButton("Complete Now", portalUrl, "red"),
    ].join("\n"),
  });

  return { subject, html, text };
}

// ---------- Breeder Compliance Digest Email Template ----------

export interface BreederComplianceDigestParams {
  tenantName: string;
  overdueItems: Array<{
    offspringName: string;
    requirementType: string;
    dueDate: string;
    daysOverdue: number;
    clientName: string;
  }>;
  portalUrl: string;
}

/**
 * Weekly digest email to breeder summarizing all overdue compliance requirements.
 */
export function renderBreederComplianceDigestEmail(params: BreederComplianceDigestParams): { subject: string; html: string; text: string } {
  const { tenantName, overdueItems, portalUrl } = params;

  const subject = `${overdueItems.length} overdue compliance requirement${overdueItems.length !== 1 ? "s" : ""} — Weekly Digest`;

  const itemLines = overdueItems.map(
    (item) => `• ${item.offspringName} — ${item.requirementType} (${item.daysOverdue}d overdue, client: ${item.clientName})`
  );

  const text = `
You have ${overdueItems.length} overdue compliance requirement${overdueItems.length !== 1 ? "s" : ""} across your placed offspring.

${itemLines.join("\n")}

Reminder emails have been sent to the respective clients.

— ${tenantName}
`.trim();

  const bulletItems = overdueItems.map(
    (item) =>
      `<strong style="color: #ffffff;">${item.offspringName}</strong> — ${item.requirementType} <span style="color: #ef4444;">(${item.daysOverdue}d overdue)</span> · Client: ${item.clientName}`
  );

  const html = wrapEmailLayout({
    title: "Compliance Digest",
    footerOrgName: tenantName,
    body: [
      emailParagraph(
        `You have ${emailAccent(String(overdueItems.length))} overdue compliance requirement${overdueItems.length !== 1 ? "s" : ""} across your placed offspring.`
      ),
      emailBulletList(bulletItems),
      emailParagraph("Reminder emails have been sent to the respective clients."),
      emailButton("View Offspring", portalUrl),
    ].join("\n"),
  });

  return { subject, html, text };
}
