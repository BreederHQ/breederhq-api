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
