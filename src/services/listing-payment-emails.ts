// src/services/listing-payment-emails.ts
/**
 * Listing Payment Email Service
 *
 * Email templates for the service provider listing subscription lifecycle:
 * activation, renewal, payment failure, expiry warnings, cancellation,
 * and founding period transition.
 */

import { sendEmail } from "./email-service.js";
import { wrapEmailLayout, emailButton, emailInfoCard, emailGreeting, emailParagraph, emailFootnote } from "./email-layout.js";

const MARKETPLACE_URL =
  process.env.MARKETPLACE_URL || "https://marketplace.breederhq.com";
const FROM_NAME =
  process.env.RESEND_FROM_NAME || "BreederHQ Marketplace";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface ListingEmailData {
  email: string;
  recipientName: string;
  listingTitle: string;
  listingId: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function listingManageUrl(listingId: number): string {
  return `${MARKETPLACE_URL}/provider/services/${listingId}`;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Listing Activated
// ────────────────────────────────────────────────────────────────────────────

export async function sendListingActivatedEmail(
  data: ListingEmailData & { feeCents: number }
): Promise<void> {
  const name = data.recipientName || "there";
  const fee = formatCents(data.feeCents);
  const url = listingManageUrl(data.listingId);

  const html = wrapEmailLayout({
    title: "Your Listing Is Live!",
    footerOrgName: FROM_NAME,
    body: [
      emailGreeting(name),
      emailParagraph(`Your service listing <strong style="color: #ffffff;">${data.listingTitle}</strong> is now live on the marketplace.`),
      emailInfoCard(
        [
          `<p style="color: #10b981; margin: 0; font-weight: 600;">Subscription Active</p>`,
          `<p style="color: #e5e5e5; margin: 8px 0 0 0;">Your listing will renew monthly at ${fee}.</p>`,
        ].join("\n"),
        { borderColor: "green" }
      ),
      emailParagraph("Potential clients can now find your listing and reach out to book your services."),
      emailButton("View Your Listing", url),
      emailFootnote("You can manage your subscription anytime from your provider dashboard."),
    ].join("\n"),
  });

  const text = `
Your Listing Is Live!

Hi ${name},

Your service listing "${data.listingTitle}" is now live on the marketplace.

Subscription Active — renews monthly at ${fee}.

View your listing: ${url}

You can manage your subscription anytime from your provider dashboard.

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,
    to: data.email,
    subject: `Your listing is live — ${data.listingTitle}`,
    html,
    text,
    templateKey: "listing_activated",
    category: "transactional",
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Listing Renewed
// ────────────────────────────────────────────────────────────────────────────

export async function sendListingRenewedEmail(
  data: ListingEmailData & { feeCents: number; nextRenewalDate: Date }
): Promise<void> {
  const name = data.recipientName || "there";
  const fee = formatCents(data.feeCents);
  const nextDate = formatDate(data.nextRenewalDate);
  const url = listingManageUrl(data.listingId);

  const html = wrapEmailLayout({
    title: "Listing Renewed",
    footerOrgName: FROM_NAME,
    body: [
      emailGreeting(name),
      emailParagraph(`Your service listing <strong style="color: #ffffff;">${data.listingTitle}</strong> has been renewed for another 30 days.`),
      emailInfoCard(
        [
          `<p style="color: #e5e5e5; margin: 0;"><strong style="color: #ffffff;">Amount charged:</strong> ${fee}</p>`,
          `<p style="color: #e5e5e5; margin: 8px 0 0 0;"><strong style="color: #ffffff;">Next renewal:</strong> ${nextDate}</p>`,
        ].join("\n"),
        { borderColor: "gray" }
      ),
      emailButton("Manage Listing", url),
    ].join("\n"),
  });

  const text = `
Listing Renewed

Hi ${name},

Your service listing "${data.listingTitle}" has been renewed for another 30 days.

Amount charged: ${fee}
Next renewal: ${nextDate}

Manage listing: ${url}

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,
    to: data.email,
    subject: `Listing renewed — ${data.listingTitle}`,
    html,
    text,
    templateKey: "listing_renewed",
    category: "transactional",
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Listing Payment Failed
// ────────────────────────────────────────────────────────────────────────────

export async function sendListingPaymentFailedEmail(
  data: ListingEmailData & { updatePaymentUrl?: string }
): Promise<void> {
  const name = data.recipientName || "there";
  const url = listingManageUrl(data.listingId);
  const paymentUrl =
    data.updatePaymentUrl || `${MARKETPLACE_URL}/provider/settings/payments`;

  const html = wrapEmailLayout({
    title: "Payment Failed",
    footerOrgName: FROM_NAME,
    body: [
      emailGreeting(name),
      emailParagraph(`We were unable to charge your card for the listing <strong style="color: #ffffff;">${data.listingTitle}</strong>.`),
      emailInfoCard(
        [
          `<p style="color: #dc2626; margin: 0; font-weight: 600;">Action Required</p>`,
          `<p style="color: #e5e5e5; margin: 8px 0 0 0;">Please update your payment method to keep your listing active. If payment is not resolved, your listing will be paused.</p>`,
        ].join("\n"),
        { borderColor: "red" }
      ),
      emailButton("Update Payment Method", paymentUrl, "red"),
      emailParagraph(`<a href="${url}" style="color: #a3a3a3; text-decoration: underline;">View listing</a>`),
    ].join("\n"),
  });

  const text = `
Payment Failed

Hi ${name},

We were unable to charge your card for the listing "${data.listingTitle}".

Please update your payment method to keep your listing active.

Update payment method: ${paymentUrl}
View listing: ${url}

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,
    to: data.email,
    subject: `Payment failed — ${data.listingTitle}`,
    html,
    text,
    templateKey: "listing_payment_failed",
    category: "transactional",
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Listing Expiry Warning (7/3/1 days)
// ────────────────────────────────────────────────────────────────────────────

export async function sendListingExpiryWarningEmail(
  data: ListingEmailData & { daysRemaining: number; expiresAt: Date; feeCents: number }
): Promise<void> {
  const name = data.recipientName || "there";
  const fee = formatCents(data.feeCents);
  const expiryDate = formatDate(data.expiresAt);
  const url = listingManageUrl(data.listingId);

  const html = wrapEmailLayout({
    title: "Listing Expiring Soon",
    footerOrgName: FROM_NAME,
    body: [
      emailGreeting(name),
      emailParagraph(`Your service listing <strong style="color: #ffffff;">${data.listingTitle}</strong> expires in <strong style="color: #ffffff;">${data.daysRemaining} day${data.daysRemaining === 1 ? "" : "s"}</strong> (${expiryDate}).`),
      emailInfoCard(
        [
          `<p style="color: #f59e0b; margin: 0; font-weight: 600;">Renew to stay visible</p>`,
          `<p style="color: #e5e5e5; margin: 8px 0 0 0;">Once expired, your listing will be paused and hidden from the marketplace. Renew for ${fee}/month to keep it active.</p>`,
        ].join("\n"),
        { borderColor: "yellow" }
      ),
      emailButton("Renew Listing", url),
    ].join("\n"),
  });

  const text = `
Listing Expiring Soon

Hi ${name},

Your service listing "${data.listingTitle}" expires in ${data.daysRemaining} day${data.daysRemaining === 1 ? "" : "s"} (${expiryDate}).

Renew to stay visible — once expired, your listing will be paused and hidden from the marketplace. Renew for ${fee}/month to keep it active.

Renew listing: ${url}

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,
    to: data.email,
    subject: `Your listing expires in ${data.daysRemaining} day${data.daysRemaining === 1 ? "" : "s"} — ${data.listingTitle}`,
    html,
    text,
    templateKey: "listing_expiry_warning",
    category: "transactional",
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Listing Expired (Paused by Cron)
// ────────────────────────────────────────────────────────────────────────────

export async function sendListingExpiredEmail(
  data: ListingEmailData & { feeCents: number }
): Promise<void> {
  const name = data.recipientName || "there";
  const fee = formatCents(data.feeCents);
  const url = listingManageUrl(data.listingId);

  const html = wrapEmailLayout({
    title: "Listing Paused",
    footerOrgName: FROM_NAME,
    body: [
      emailGreeting(name),
      emailParagraph(`Your service listing <strong style="color: #ffffff;">${data.listingTitle}</strong> has been paused because it expired without an active subscription.`),
      emailInfoCard(
        [
          `<p style="color: #a3a3a3; margin: 0; font-weight: 600;">Your listing is no longer visible</p>`,
          `<p style="color: #e5e5e5; margin: 8px 0 0 0;">Renew your subscription (${fee}/month) to make it visible on the marketplace again.</p>`,
        ].join("\n"),
        { borderColor: "gray" }
      ),
      emailButton("Renew Listing", url),
    ].join("\n"),
  });

  const text = `
Listing Paused

Hi ${name},

Your service listing "${data.listingTitle}" has been paused because it expired without an active subscription.

Your listing is no longer visible on the marketplace. Renew your subscription (${fee}/month) to make it visible again.

Renew listing: ${url}

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,
    to: data.email,
    subject: `Listing paused — ${data.listingTitle}`,
    html,
    text,
    templateKey: "listing_expired",
    category: "transactional",
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Founding Period Ending (30/7 days warning)
// ────────────────────────────────────────────────────────────────────────────

export async function sendFoundingPeriodEndingEmail(
  data: ListingEmailData & {
    daysRemaining: number;
    foundingFreeUntil: Date | string;
    feeCents: number;
  }
): Promise<void> {
  const name = data.recipientName || "there";
  const fee = formatCents(data.feeCents);
  const endDate = formatDate(data.foundingFreeUntil);
  const url = listingManageUrl(data.listingId);

  const html = wrapEmailLayout({
    title: "Your Free Period Is Ending",
    footerOrgName: FROM_NAME,
    body: [
      emailGreeting(name),
      emailParagraph(`As a founding provider, your listing <strong style="color: #ffffff;">${data.listingTitle}</strong> has been free. Your free period ends in <strong style="color: #ffffff;">${data.daysRemaining} day${data.daysRemaining === 1 ? "" : "s"}</strong> (${endDate}).`),
      emailInfoCard(
        [
          `<p style="color: #f59e0b; margin: 0; font-weight: 600;">Subscribe to keep your listing active</p>`,
          `<p style="color: #e5e5e5; margin: 8px 0 0 0;">After ${endDate}, a subscription of ${fee}/month is required to keep your listing visible on the marketplace. Without a subscription, your listing will be paused.</p>`,
        ].join("\n"),
        { borderColor: "yellow" }
      ),
      emailButton("Subscribe Now", url),
      emailParagraph("Thank you for being an early supporter of BreederHQ!"),
    ].join("\n"),
  });

  const text = `
Your Free Period Is Ending

Hi ${name},

As a founding provider, your listing "${data.listingTitle}" has been free. Your free period ends in ${data.daysRemaining} day${data.daysRemaining === 1 ? "" : "s"} (${endDate}).

After ${endDate}, a subscription of ${fee}/month is required to keep your listing visible on the marketplace. Without a subscription, your listing will be paused.

Subscribe now: ${url}

Thank you for being an early supporter of BreederHQ!

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,
    to: data.email,
    subject: `Your free listing period ends in ${data.daysRemaining} days — ${data.listingTitle}`,
    html,
    text,
    templateKey: "listing_founding_period_ending",
    category: "transactional",
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 7. Listing Canceled (Auto-renewal stopped)
// ────────────────────────────────────────────────────────────────────────────

export async function sendListingCanceledEmail(
  data: ListingEmailData & { expiresAt: Date; feeCents: number }
): Promise<void> {
  const name = data.recipientName || "there";
  const fee = formatCents(data.feeCents);
  const expiryDate = formatDate(data.expiresAt);
  const url = listingManageUrl(data.listingId);

  const html = wrapEmailLayout({
    title: "Auto-Renewal Canceled",
    footerOrgName: FROM_NAME,
    body: [
      emailGreeting(name),
      emailParagraph(`The auto-renewal for your listing <strong style="color: #ffffff;">${data.listingTitle}</strong> has been canceled.`),
      emailInfoCard(
        [
          `<p style="color: #ffffff; margin: 0; font-weight: 600;">Your listing stays live until ${expiryDate}</p>`,
          `<p style="color: #a3a3a3; margin: 8px 0 0 0;">After that date, it will be paused and hidden from the marketplace. You can resubscribe anytime at ${fee}/month.</p>`,
        ].join("\n"),
        { borderColor: "gray" }
      ),
      emailButton("Manage Listing", url),
      emailFootnote("Changed your mind? You can resubscribe from your listing page before it expires."),
    ].join("\n"),
  });

  const text = `
Auto-Renewal Canceled

Hi ${name},

The auto-renewal for your listing "${data.listingTitle}" has been canceled.

Your listing stays live until ${expiryDate}. After that date, it will be paused and hidden from the marketplace. You can resubscribe anytime at ${fee}/month.

Manage listing: ${url}

Changed your mind? You can resubscribe from your listing page before it expires.

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,
    to: data.email,
    subject: `Renewal canceled — listing active until ${expiryDate}`,
    html,
    text,
    templateKey: "listing_canceled",
    category: "transactional",
  });
}
