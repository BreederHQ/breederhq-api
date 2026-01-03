// src/services/email-templates.ts

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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f97316 0%, #0d9488 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px 20px; border-radius: 0 0 8px 8px; }
    .invoice-card { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f97316; }
    .amount { font-size: 24px; font-weight: bold; color: #f97316; }
    .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Invoice Ready</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${clientName}</strong>,</p>
      <p>Your invoice from <strong>${tenantName}</strong> is ready.</p>

      <div class="invoice-card">
        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Invoice Number</p>
        <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">${invoiceNumber}</p>

        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Amount Due</p>
        <p class="amount">${currency} ${amount}</p>

        <p style="margin: 20px 0 10px 0; color: #6b7280; font-size: 14px;">Payment Due</p>
        <p style="margin: 0;">${dueDate}</p>
      </div>

      ${invoiceUrl ? `<a href="${invoiceUrl}" class="button">View Invoice</a>` : '<p>Please contact us for payment details.</p>'}

      <div class="footer">
        <p>Thank you,<br/>${tenantName}</p>
      </div>
    </div>
  </div>
</body>
</html>
`.trim();

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
    return '<p style="margin: 10px 0;"><strong>Location:</strong> Virtual Meeting</p>';
  }
  if (location) {
    return `<p style="margin: 10px 0;"><strong>Location:</strong> ${location}</p>`;
  }
  return '<p style="margin: 10px 0;"><strong>Location:</strong> To be confirmed</p>';
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

const emailStyles = `
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f97316 0%, #0d9488 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px 20px; border-radius: 0 0 8px 8px; }
    .card { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #0d9488; }
    .card-cancel { border-left-color: #ef4444; }
    .card-reschedule { border-left-color: #f97316; }
    .card-reminder { border-left-color: #3b82f6; }
    .event-type { font-size: 18px; font-weight: 600; color: #0d9488; margin-bottom: 15px; }
    .next-steps { background: #fef3c7; padding: 15px; border-radius: 6px; margin-top: 15px; }
    .next-steps-title { font-weight: 600; color: #92400e; margin-bottom: 10px; }
    .button { display: inline-block; background: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px; }
  </style>
`;

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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${emailStyles}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Appointment Confirmed</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${clientName}</strong>,</p>
      <p>Your appointment has been confirmed!</p>

      <div class="card">
        <div class="event-type">${eventType}</div>
        <p style="margin: 10px 0;"><strong>When:</strong> ${dateStr} - ${endTimeStr}</p>
        ${buildLocationHtml(location, mode)}
        <p style="margin: 10px 0;"><strong>With:</strong> ${breederName}</p>
        ${nextSteps ? `
        <div class="next-steps">
          <div class="next-steps-title">Next Steps</div>
          <p style="margin: 0; white-space: pre-wrap;">${nextSteps}</p>
        </div>
        ` : ""}
      </div>

      ${portalUrl ? `<a href="${portalUrl}" class="button">View in Portal</a>` : ""}

      <div class="footer">
        <p>Thank you,<br/>${tenantName}</p>
      </div>
    </div>
  </div>
</body>
</html>
`.trim();

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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${emailStyles}
</head>
<body>
  <div class="container">
    <div class="header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
      <h1 style="margin: 0;">Appointment Cancelled</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${clientName}</strong>,</p>
      <p>Your appointment has been cancelled.</p>

      <div class="card card-cancel">
        <div class="event-type" style="color: #ef4444;">${eventType}</div>
        <p style="margin: 10px 0;"><strong>Original Time:</strong> ${dateStr} - ${endTimeStr}</p>
        ${buildLocationHtml(location, mode)}
        <p style="margin: 10px 0;"><strong>With:</strong> ${breederName}</p>
      </div>

      <p>If you'd like to reschedule, please visit the portal or contact ${breederName}.</p>

      ${portalUrl ? `<a href="${portalUrl}" class="button" style="background: #ef4444;">View in Portal</a>` : ""}

      <div class="footer">
        <p>Thank you,<br/>${tenantName}</p>
      </div>
    </div>
  </div>
</body>
</html>
`.trim();

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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${emailStyles}
</head>
<body>
  <div class="container">
    <div class="header" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);">
      <h1 style="margin: 0;">Appointment Rescheduled</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${clientName}</strong>,</p>
      <p>Your appointment has been rescheduled.</p>

      <div class="card card-reschedule">
        <div class="event-type" style="color: #f97316;">${eventType}</div>
        <p style="margin: 10px 0;"><strong>NEW TIME:</strong> ${newDateStr} - ${newEndTimeStr}</p>
        <p style="margin: 10px 0; color: #6b7280; font-size: 14px;"><s>Previously: ${oldDateStr} - ${oldEndTimeStr}</s></p>
        ${buildLocationHtml(location, mode)}
        <p style="margin: 10px 0;"><strong>With:</strong> ${breederName}</p>
        ${nextSteps ? `
        <div class="next-steps">
          <div class="next-steps-title">Next Steps</div>
          <p style="margin: 0; white-space: pre-wrap;">${nextSteps}</p>
        </div>
        ` : ""}
      </div>

      ${portalUrl ? `<a href="${portalUrl}" class="button" style="background: #f97316;">View in Portal</a>` : ""}

      <div class="footer">
        <p>Thank you,<br/>${tenantName}</p>
      </div>
    </div>
  </div>
</body>
</html>
`.trim();

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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${emailStyles}
</head>
<body>
  <div class="container">
    <div class="header" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">
      <h1 style="margin: 0;">Appointment Reminder</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${clientName}</strong>,</p>
      <p>This is a friendly reminder about your upcoming appointment.</p>

      <div class="card card-reminder">
        <div class="event-type" style="color: #3b82f6;">${eventType}</div>
        <p style="margin: 10px 0;"><strong>When:</strong> ${dateStr} - ${endTimeStr}</p>
        ${buildLocationHtml(location, mode)}
        <p style="margin: 10px 0;"><strong>With:</strong> ${breederName}</p>
        ${nextSteps ? `
        <div class="next-steps">
          <div class="next-steps-title">Reminder - Next Steps</div>
          <p style="margin: 0; white-space: pre-wrap;">${nextSteps}</p>
        </div>
        ` : ""}
      </div>

      ${portalUrl ? `<a href="${portalUrl}" class="button" style="background: #3b82f6;">View in Portal</a>` : ""}

      <div class="footer">
        <p>Thank you,<br/>${tenantName}</p>
      </div>
    </div>
  </div>
</body>
</html>
`.trim();

  return { subject, html, text };
}
