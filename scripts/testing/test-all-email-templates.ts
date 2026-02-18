/**
 * Test script: Send ALL email templates to a test address for visual verification.
 *
 * Usage:
 *   npx dotenv -e .env.dev -- tsx scripts/testing/test-all-email-templates.ts [email]
 *
 * Default recipient: dev@breederhq.com
 */

import { Resend } from "resend";
import {
  wrapEmailLayout,
  emailButton,
  emailInfoCard,
  emailDetailRows,
  emailGreeting,
  emailParagraph,
  emailFootnote,
  emailHeading,
  emailAccent,
  emailCodeBlock,
  emailFeatureList,
  emailBulletList,
} from "../../src/services/email-layout.js";
import {
  renderInvoiceEmail,
  renderBookingConfirmationEmail,
  renderBookingCancellationEmail,
  renderBookingRescheduleEmail,
  renderBookingReminderEmail,
} from "../../src/services/email-templates.js";
import { renderMagicLinkEmail } from "../../src/services/email/resend.js";

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.MAIL_FROM || process.env.RESEND_FROM_EMAIL || "noreply@mail.breederhq.com";
const FROM_ADDRESS = `"BreederHQ Test" <${FROM}>`;
const RECIPIENT = process.argv[2] || "dev@breederhq.com";
const MARKETPLACE_URL = "https://marketplace.breederhq.com";
const APP_URL = "https://app.breederhq.com";
const PORTAL_URL = "https://portal.breederhq.com";

if (!RESEND_API_KEY) {
  console.error("❌ RESEND_API_KEY is not set. Run with: npx dotenv -e .env.dev -- tsx scripts/testing/test-all-email-templates.ts");
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

interface TestTemplate {
  name: string;
  subject: string;
  html: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Sample data
// ────────────────────────────────────────────────────────────────────────────

const SAMPLE = {
  clientName: "Jane Smith",
  breederName: "Sunny Acres Farm",
  tenantName: "Sunny Acres Farm",
  orgName: "BreederHQ Marketplace",
  email: RECIPIENT,
  animalName: "Champion Spark",
  invoiceNumber: "INV-2026-0042",
  contractTitle: "Sale Agreement — Champion Spark",
  listingTitle: "Professional Foaling Services",
  eventType: "Puppy Evaluation",
  startsAt: new Date("2026-03-15T14:00:00"),
  endsAt: new Date("2026-03-15T15:00:00"),
  originalStartsAt: new Date("2026-03-10T10:00:00"),
  originalEndsAt: new Date("2026-03-10T11:00:00"),
};

// ────────────────────────────────────────────────────────────────────────────
// Build ALL templates
// ────────────────────────────────────────────────────────────────────────────

function buildAllTemplates(): TestTemplate[] {
  const templates: TestTemplate[] = [];
  const add = (name: string, subject: string, html: string) => templates.push({ name, subject: `[TEST] ${name} — ${subject}`, html });

  // ── 1. email-templates.ts (render functions) ──────────────────────────

  const invoice = renderInvoiceEmail({
    invoiceNumber: SAMPLE.invoiceNumber,
    amountCents: 45000,
    currency: "USD",
    dueAt: new Date("2026-04-01"),
    clientName: SAMPLE.clientName,
    tenantName: SAMPLE.tenantName,
    invoiceUrl: `${APP_URL}/invoices/42`,
  });
  add("Invoice Email", invoice.subject, invoice.html);

  const bookingConf = renderBookingConfirmationEmail({
    eventType: SAMPLE.eventType,
    clientName: SAMPLE.clientName,
    breederName: SAMPLE.breederName,
    tenantName: SAMPLE.tenantName,
    startsAt: SAMPLE.startsAt,
    endsAt: SAMPLE.endsAt,
    location: "123 Farm Road, Springfield IL",
    mode: "in_person",
    nextSteps: "Please bring health records for your puppy.\nArrive 10 minutes early.",
    portalUrl: `${PORTAL_URL}/appointments/1`,
  });
  add("Booking Confirmation", bookingConf.subject, bookingConf.html);

  const bookingCancel = renderBookingCancellationEmail({
    eventType: SAMPLE.eventType,
    clientName: SAMPLE.clientName,
    breederName: SAMPLE.breederName,
    tenantName: SAMPLE.tenantName,
    startsAt: SAMPLE.startsAt,
    endsAt: SAMPLE.endsAt,
    location: null,
    mode: "virtual",
    nextSteps: null,
    portalUrl: `${PORTAL_URL}/appointments`,
  });
  add("Booking Cancellation", bookingCancel.subject, bookingCancel.html);

  const bookingReschedule = renderBookingRescheduleEmail({
    eventType: SAMPLE.eventType,
    clientName: SAMPLE.clientName,
    breederName: SAMPLE.breederName,
    tenantName: SAMPLE.tenantName,
    startsAt: SAMPLE.startsAt,
    endsAt: SAMPLE.endsAt,
    originalStartsAt: SAMPLE.originalStartsAt,
    originalEndsAt: SAMPLE.originalEndsAt,
    location: "123 Farm Road, Springfield IL",
    mode: "in_person",
    nextSteps: "Same preparation as before.",
    portalUrl: `${PORTAL_URL}/appointments/1`,
  });
  add("Booking Reschedule", bookingReschedule.subject, bookingReschedule.html);

  const bookingReminder = renderBookingReminderEmail({
    eventType: SAMPLE.eventType,
    clientName: SAMPLE.clientName,
    breederName: SAMPLE.breederName,
    tenantName: SAMPLE.tenantName,
    startsAt: SAMPLE.startsAt,
    endsAt: SAMPLE.endsAt,
    location: "123 Farm Road, Springfield IL",
    mode: "in_person",
    nextSteps: "Remember to bring health records.",
    portalUrl: `${PORTAL_URL}/appointments/1`,
  });
  add("Booking Reminder", bookingReminder.subject, bookingReminder.html);

  // ── 2. email/resend.ts ────────────────────────────────────────────────

  add("Magic Link Sign-In", "Sign In to BreederHQ", renderMagicLinkEmail(`${APP_URL}/auth/verify?token=test-magic-link-token`));

  // ── 3. portal-access.ts ───────────────────────────────────────────────

  add("Portal Invitation", "You're Invited to Sunny Acres Farm Portal", wrapEmailLayout({
    title: "You're Invited!",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.clientName),
      emailParagraph(`${emailAccent(SAMPLE.breederName)} has invited you to their client portal on BreederHQ.`),
      emailParagraph("Your dedicated portal gives you direct access to:"),
      emailFeatureList([
        "View your animals and their records",
        "Track breeding plans and progress",
        "Access health records and documents",
        "Communicate directly with your breeder",
        "View and pay invoices",
      ]),
      emailButton("Access Your Portal", `${PORTAL_URL}/invite?token=test-invite-token`),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          ${emailAccent("&#9432; This invitation link expires in 7 days")}
        </p>
      `, { borderColor: "orange" }),
      emailFootnote("If you didn't expect this invitation, you can safely ignore this email."),
    ].join("\n"),
  }));

  add("Portal Password Reset", "Reset Your Password", wrapEmailLayout({
    title: "Reset Your Password",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.clientName),
      emailParagraph(`We received a request to reset your password for the ${emailAccent(SAMPLE.tenantName)} client portal.`),
      emailButton("Reset Password", `${PORTAL_URL}/reset-password?token=test-reset-token`),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          ${emailAccent("&#9432; This link expires in 1 hour")}<br>
          <span style="color: #a3a3a3;">If you didn't request a password reset, you can safely ignore this email.</span>
        </p>
      `, { borderColor: "orange" }),
    ].join("\n"),
  }));

  // ── 4. marketplace-email-service.ts ───────────────────────────────────

  add("Marketplace Welcome", `Welcome to BreederHQ Marketplace`, wrapEmailLayout({
    title: "Welcome to BreederHQ Marketplace!",
    body: [
      emailGreeting("Alex"),
      emailParagraph("Thanks for joining our marketplace! Please verify your email address to complete your registration."),
      emailButton("Verify Email Address", `${MARKETPLACE_URL}/verify-email?token=test-verify`),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          ${emailAccent("&#9432; This link will expire in 1 hour")}<br>
          <span style="color: #a3a3a3;">If you didn't create this account, you can safely ignore this email.</span>
        </p>
      `, { borderColor: "orange" }),
    ].join("\n"),
  }));

  add("Marketplace Password Reset", "Reset Your Password", wrapEmailLayout({
    title: "Reset Your Password",
    body: [
      emailGreeting("Alex"),
      emailParagraph("We received a request to reset your password."),
      emailButton("Reset Password", `${MARKETPLACE_URL}/reset-password?token=test-reset`),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          ${emailAccent("&#9432; This link will expire in 1 hour")}<br>
          <span style="color: #a3a3a3;">If you didn't request this, you can safely ignore this email.</span>
        </p>
      `, { borderColor: "orange" }),
    ].join("\n"),
  }));

  add("Marketplace Email Verification", "Verify your email address", wrapEmailLayout({
    title: "Verify Your Email Address",
    body: [
      emailGreeting("Alex"),
      emailParagraph("Please click below to verify your email address and continue using the marketplace."),
      emailButton("Verify Email", `${MARKETPLACE_URL}/verify-email?token=test-verify`),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          ${emailAccent("&#9432; This link will expire in 1 hour")}
        </p>
      `, { borderColor: "orange" }),
    ].join("\n"),
  }));

  add("Email Verification Code", "Your verification code", wrapEmailLayout({
    title: "Your Verification Code",
    body: [
      emailGreeting("Alex"),
      emailParagraph("Use the following code to verify your email address:"),
      emailCodeBlock("847293"),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          ${emailAccent("&#9432; This code expires in 10 minutes")}<br>
          <span style="color: #a3a3a3;">If you didn't request this, you can safely ignore this email.</span>
        </p>
      `, { borderColor: "orange" }),
    ].join("\n"),
  }));

  add("Provider Welcome", "Welcome, Service Provider!", wrapEmailLayout({
    title: "Welcome, Service Provider!",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph("Congratulations! Your provider account has been approved. You can now list your services on the BreederHQ Marketplace."),
      emailFeatureList([
        "Create and manage service listings",
        "Accept bookings from clients",
        "Process payments securely",
        "Build your reputation with reviews",
      ]),
      emailButton("Set Up Your Profile", `${MARKETPLACE_URL}/provider/dashboard`),
      emailFootnote("Need help getting started? Visit our provider guide."),
    ].join("\n"),
  }));

  add("Provider Stripe Onboarding Complete", "Payments are set up!", wrapEmailLayout({
    title: "Payments Are Set Up!",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph("Your Stripe account has been successfully connected. You can now accept payments for your services."),
      emailInfoCard([
        `<p style="color: #10b981; margin: 0; font-weight: 600;">✓ Payment Setup Complete</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">Clients can now pay you directly through the marketplace.</p>`,
      ].join("\n"), { borderColor: "green" }),
      emailButton("Go to Dashboard", `${MARKETPLACE_URL}/provider/dashboard`),
    ].join("\n"),
  }));

  add("Provider Stripe Issue", "Action needed: Payment setup issue", wrapEmailLayout({
    title: "Payment Setup Issue",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph("There's an issue with your Stripe payment setup. Please update your information to continue accepting payments."),
      emailInfoCard([
        `<p style="color: #dc2626; margin: 0; font-weight: 600;">Action Required</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">Your payment account needs attention. This may affect your ability to receive payments.</p>`,
      ].join("\n"), { borderColor: "red" }),
      emailButton("Fix Payment Setup", `${MARKETPLACE_URL}/provider/settings/payments`, "red"),
    ].join("\n"),
  }));

  add("Transaction Created (Buyer)", "Booking confirmed!", wrapEmailLayout({
    title: "Booking Confirmed!",
    body: [
      emailGreeting(SAMPLE.clientName),
      emailParagraph(`Your booking with ${emailAccent("Dr. Sarah's Vet Services")} has been confirmed.`),
      emailDetailRows([
        { label: "Service", value: "Puppy Health Check" },
        { label: "Provider", value: "Dr. Sarah" },
        { label: "Amount", value: "$150.00" },
        { label: "Status", value: "Confirmed" },
      ]),
      emailButton("View Booking", `${MARKETPLACE_URL}/bookings/123`),
    ].join("\n"),
  }));

  add("Transaction Created (Provider)", "New booking received!", wrapEmailLayout({
    title: "New Booking!",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph(`You have a new booking from ${emailAccent(SAMPLE.clientName)}.`),
      emailDetailRows([
        { label: "Service", value: "Puppy Health Check" },
        { label: "Client", value: SAMPLE.clientName },
        { label: "Amount", value: "$150.00" },
        { label: "Status", value: "Confirmed" },
      ]),
      emailButton("View Booking", `${MARKETPLACE_URL}/provider/transactions/123`),
    ].join("\n"),
  }));

  add("Service Started (Buyer)", "Your service has started", wrapEmailLayout({
    title: "Service In Progress",
    body: [
      emailGreeting(SAMPLE.clientName),
      emailParagraph(`${emailAccent("Dr. Sarah")} has started working on your service: ${emailAccent("Puppy Health Check")}.`),
      emailInfoCard([
        `<p style="color: #3b82f6; margin: 0; font-weight: 600;">In Progress</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">The provider has begun working on your service. You'll be notified when it's completed.</p>`,
      ].join("\n"), { borderColor: "blue" }),
      emailButton("View Details", `${MARKETPLACE_URL}/bookings/123`),
    ].join("\n"),
  }));

  add("Service Completed (Buyer)", "Your service is complete!", wrapEmailLayout({
    title: "Service Complete!",
    body: [
      emailGreeting(SAMPLE.clientName),
      emailParagraph(`${emailAccent("Dr. Sarah")} has completed your service: ${emailAccent("Puppy Health Check")}.`),
      emailInfoCard([
        `<p style="color: #10b981; margin: 0; font-weight: 600;">✓ Completed</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">Your service has been marked as complete. Please leave a review to help other users!</p>`,
      ].join("\n"), { borderColor: "green" }),
      emailButton("Leave a Review", `${MARKETPLACE_URL}/bookings/123/review`),
    ].join("\n"),
  }));

  add("Transaction Cancellation", "Booking cancelled", wrapEmailLayout({
    title: "Booking Cancelled",
    body: [
      emailGreeting(SAMPLE.clientName),
      emailParagraph("A booking has been cancelled."),
      emailDetailRows([
        { label: "Service", value: "Puppy Health Check" },
        { label: "Provider", value: "Dr. Sarah" },
        { label: "Original Amount", value: "$150.00" },
        { label: "Status", value: "Cancelled" },
      ]),
      emailInfoCard([
        `<p style="color: #dc2626; margin: 0; font-weight: 600;">Cancelled</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">If you were charged, a refund will be processed within 5-10 business days.</p>`,
      ].join("\n"), { borderColor: "red" }),
      emailButton("View Details", `${MARKETPLACE_URL}/bookings/123`, "gray"),
    ].join("\n"),
  }));

  add("Payment Received (Buyer)", "Payment confirmation", wrapEmailLayout({
    title: "Payment Confirmed",
    body: [
      emailGreeting(SAMPLE.clientName),
      emailParagraph("Your payment has been processed successfully."),
      emailDetailRows([
        { label: "Service", value: "Puppy Health Check" },
        { label: "Provider", value: "Dr. Sarah" },
        { label: "Amount Paid", value: "$150.00" },
        { label: "Date", value: "February 18, 2026" },
      ]),
      emailButton("View Receipt", `${MARKETPLACE_URL}/bookings/123`),
    ].join("\n"),
  }));

  add("Payment Received (Provider)", "You received a payment!", wrapEmailLayout({
    title: "Payment Received!",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph("A payment has been received for your service."),
      emailDetailRows([
        { label: "Service", value: "Puppy Health Check" },
        { label: "Client", value: SAMPLE.clientName },
        { label: "Amount", value: "$150.00" },
        { label: "Your Payout", value: "$142.50 (after fees)" },
      ]),
      emailButton("View Transaction", `${MARKETPLACE_URL}/provider/transactions/123`),
    ].join("\n"),
  }));

  add("New Message Notification", "New message from Jane Smith", wrapEmailLayout({
    title: "New Message",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph(`You have a new message from ${emailAccent(SAMPLE.clientName)} regarding ${emailAccent("Puppy Health Check")}.`),
      emailInfoCard(`
        <p style="color: #e5e5e5; margin: 0; font-style: italic; line-height: 1.5;">
          "Hi, I wanted to ask about the preparation steps for next week's appointment..."
        </p>
      `, { borderColor: "blue" }),
      emailButton("Reply", `${MARKETPLACE_URL}/messages/456`),
    ].join("\n"),
  }));

  add("Inquiry Confirmation (User)", "Your inquiry has been sent", wrapEmailLayout({
    title: "Inquiry Sent!",
    body: [
      emailGreeting(SAMPLE.clientName),
      emailParagraph(`Your inquiry about ${emailAccent("Puppy Health Check")} has been sent to the service provider.`),
      emailInfoCard([
        `<p style="color: #e5e5e5; margin: 0;">The provider will typically respond within 24-48 hours.</p>`,
      ].join("\n"), { borderColor: "blue" }),
      emailButton("View Your Inquiries", `${MARKETPLACE_URL}/inquiries`),
    ].join("\n"),
  }));

  add("Inquiry Notification (Breeder)", "New inquiry received!", wrapEmailLayout({
    title: "New Inquiry",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph(`${emailAccent(SAMPLE.clientName)} has sent an inquiry about your service: ${emailAccent("Puppy Health Check")}.`),
      emailInfoCard(`
        <p style="color: #e5e5e5; margin: 0; line-height: 1.5;">
          "I'm interested in scheduling a health check for my 12-week-old Golden Retriever puppy. Do you have availability next week?"
        </p>
      `, { borderColor: "orange" }),
      emailButton("Respond to Inquiry", `${MARKETPLACE_URL}/provider/inquiries/789`),
    ].join("\n"),
  }));

  add("Waitlist Confirmation", "You're on the waitlist!", wrapEmailLayout({
    title: "Waitlist Confirmed",
    body: [
      emailGreeting(SAMPLE.clientName),
      emailParagraph(`You've been added to the waitlist for ${emailAccent("Puppy Health Check")} by ${emailAccent("Dr. Sarah")}.`),
      emailInfoCard([
        `<p style="color: #f59e0b; margin: 0; font-weight: 600;">Position: #3 on waitlist</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">We'll notify you when a spot becomes available.</p>`,
      ].join("\n"), { borderColor: "yellow" }),
      emailButton("View Waitlist", `${MARKETPLACE_URL}/waitlist`),
    ].join("\n"),
  }));

  add("Waitlist Approval", "A spot is available!", wrapEmailLayout({
    title: "Spot Available!",
    body: [
      emailGreeting(SAMPLE.clientName),
      emailParagraph(`A spot has opened up for ${emailAccent("Puppy Health Check")} by ${emailAccent("Dr. Sarah")}!`),
      emailInfoCard([
        `<p style="color: #10b981; margin: 0; font-weight: 600;">✓ You've been approved</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">Please book your appointment as soon as possible to secure your spot.</p>`,
      ].join("\n"), { borderColor: "green" }),
      emailButton("Book Now", `${MARKETPLACE_URL}/services/101/book`, "green"),
    ].join("\n"),
  }));

  add("Waitlist Rejection", "Waitlist update", wrapEmailLayout({
    title: "Waitlist Update",
    body: [
      emailGreeting(SAMPLE.clientName),
      emailParagraph(`Unfortunately, the waitlist for ${emailAccent("Puppy Health Check")} by ${emailAccent("Dr. Sarah")} has been closed.`),
      emailInfoCard([
        `<p style="color: #a3a3a3; margin: 0;">The provider is no longer accepting waitlist entries for this service at this time.</p>`,
      ].join("\n"), { borderColor: "gray" }),
      emailParagraph("You can browse other available services on the marketplace."),
      emailButton("Browse Services", `${MARKETPLACE_URL}/services`),
    ].join("\n"),
  }));

  add("Admin: Listing Flagged", "A listing has been flagged", wrapEmailLayout({
    title: "Listing Flagged for Review",
    body: [
      emailParagraph(`A service listing has been flagged for admin review.`),
      emailDetailRows([
        { label: "Listing", value: "Puppy Health Check" },
        { label: "Provider", value: "Dr. Sarah" },
        { label: "Reason", value: "Reported by user" },
        { label: "Reports", value: "3" },
      ]),
      emailButton("Review Listing", `${MARKETPLACE_URL}/admin/listings/101`, "red"),
    ].join("\n"),
  }));

  add("Provider Verification Failed", "Verification issue", wrapEmailLayout({
    title: "Verification Unsuccessful",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph("We were unable to verify your provider account. Please review the details below and resubmit."),
      emailInfoCard([
        `<p style="color: #dc2626; margin: 0; font-weight: 600;">Verification Failed</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">Reason: The uploaded documents could not be verified. Please ensure all documents are legible and not expired.</p>`,
      ].join("\n"), { borderColor: "red" }),
      emailButton("Resubmit Documents", `${MARKETPLACE_URL}/provider/verification`, "red"),
    ].join("\n"),
  }));

  add("Invoice Payment Failed (Provider)", "Payment failed for your invoice", wrapEmailLayout({
    title: "Invoice Payment Failed",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph(`A payment attempt for invoice ${emailAccent(SAMPLE.invoiceNumber)} has failed.`),
      emailDetailRows([
        { label: "Invoice", value: SAMPLE.invoiceNumber },
        { label: "Client", value: SAMPLE.clientName },
        { label: "Amount", value: "$150.00" },
      ]),
      emailInfoCard([
        `<p style="color: #dc2626; margin: 0; font-weight: 600;">Payment Failed</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">The client's payment method was declined. They have been notified to update their payment information.</p>`,
      ].join("\n"), { borderColor: "red" }),
      emailButton("View Invoice", `${MARKETPLACE_URL}/provider/invoices/42`),
    ].join("\n"),
  }));

  add("Inactive Address Auto-Reply", "Undeliverable — address not monitored", wrapEmailLayout({
    title: "Undeliverable Message",
    body: [
      emailParagraph("The email address you sent a message to is not actively monitored."),
      emailInfoCard([
        `<p style="color: #f59e0b; margin: 0; font-weight: 600;">This inbox is not monitored</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">If you need assistance, please visit the marketplace or contact support through the platform.</p>`,
      ].join("\n"), { borderColor: "yellow" }),
      emailButton("Visit Marketplace", MARKETPLACE_URL),
    ].join("\n"),
  }));

  // ── 5. email-service.ts ───────────────────────────────────────────────

  add("Quota Warning (80%)", "Usage approaching limit", wrapEmailLayout({
    title: "Usage Warning",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.breederName),
      emailParagraph("Your account is approaching its usage limit."),
      emailInfoCard([
        `<p style="color: #f59e0b; margin: 0; font-weight: 600;">80% of quota used</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">You've used 80 of your 100 animal records. Consider upgrading your plan to avoid interruptions.</p>`,
      ].join("\n"), { borderColor: "yellow" }),
      emailButton("Upgrade Plan", `${APP_URL}/settings/billing`),
    ].join("\n"),
  }));

  add("Quota Critical (95%)", "Usage limit almost reached", wrapEmailLayout({
    title: "Usage Critical",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.breederName),
      emailParagraph("Your account is very close to its usage limit."),
      emailInfoCard([
        `<p style="color: #dc2626; margin: 0; font-weight: 600;">95% of quota used</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">You've used 95 of your 100 animal records. You will be unable to add new records once the limit is reached.</p>`,
      ].join("\n"), { borderColor: "red" }),
      emailButton("Upgrade Now", `${APP_URL}/settings/billing`, "red"),
    ].join("\n"),
  }));

  add("Quota Exceeded", "Usage limit reached", wrapEmailLayout({
    title: "Usage Limit Reached",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.breederName),
      emailParagraph("Your account has reached its usage limit. Some features are now restricted."),
      emailInfoCard([
        `<p style="color: #dc2626; margin: 0; font-weight: 600;">100% of quota used</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">You've reached the limit of 100 animal records. Upgrade your plan to continue adding records.</p>`,
      ].join("\n"), { borderColor: "red" }),
      emailButton("Upgrade Plan", `${APP_URL}/settings/billing`, "red"),
    ].join("\n"),
  }));

  add("Payment Failed (Billing)", "Payment failed", wrapEmailLayout({
    title: "Payment Failed",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.breederName),
      emailParagraph("We were unable to process your subscription payment."),
      emailInfoCard([
        `<p style="color: #dc2626; margin: 0; font-weight: 600;">Action Required</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">Please update your payment method to avoid service interruption. Your account will be downgraded if payment is not resolved within 7 days.</p>`,
      ].join("\n"), { borderColor: "red" }),
      emailButton("Update Payment Method", `${APP_URL}/settings/billing`, "red"),
    ].join("\n"),
  }));

  add("Subscription Canceled", "Subscription canceled", wrapEmailLayout({
    title: "Subscription Canceled",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.breederName),
      emailParagraph("Your subscription has been canceled."),
      emailInfoCard([
        `<p style="color: #ffffff; margin: 0; font-weight: 600;">Your access continues until March 18, 2026</p>`,
        `<p style="color: #a3a3a3; margin: 8px 0 0 0;">After that, your account will be downgraded to the free tier. You can resubscribe anytime.</p>`,
      ].join("\n"), { borderColor: "gray" }),
      emailButton("Resubscribe", `${APP_URL}/settings/billing`),
      emailFootnote("Changed your mind? You can resubscribe anytime before your access expires."),
    ].join("\n"),
  }));

  add("Subscription Renewed", "Subscription renewed", wrapEmailLayout({
    title: "Subscription Renewed",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.breederName),
      emailParagraph("Your subscription has been successfully renewed."),
      emailDetailRows([
        { label: "Plan", value: "Professional" },
        { label: "Amount", value: "$29.00/month" },
        { label: "Next Renewal", value: "March 18, 2026" },
      ]),
      emailButton("View Billing", `${APP_URL}/settings/billing`),
    ].join("\n"),
  }));

  add("Waitlist Signup Notification (Breeder)", "New waitlist signup!", wrapEmailLayout({
    title: "New Waitlist Signup",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.breederName),
      emailParagraph(`${emailAccent(SAMPLE.clientName)} has joined your waitlist for ${emailAccent("Golden Retriever Puppies — Spring 2026 Litter")}.`),
      emailDetailRows([
        { label: "Contact", value: SAMPLE.clientName },
        { label: "Email", value: "jane.smith@example.com" },
        { label: "Waitlist", value: "Golden Retriever Puppies — Spring 2026 Litter" },
        { label: "Position", value: "#7" },
      ]),
      emailButton("View Waitlist", `${APP_URL}/waitlist`),
    ].join("\n"),
  }));

  add("Contract Sent", "Contract ready for your signature", wrapEmailLayout({
    title: "Contract Ready",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.clientName),
      emailParagraph(`${emailAccent(SAMPLE.breederName)} has sent you a contract for your review and signature.`),
      emailDetailRows([
        { label: "Contract", value: SAMPLE.contractTitle },
        { label: "From", value: SAMPLE.breederName },
        { label: "Expires", value: "March 1, 2026" },
      ]),
      emailButton("Review & Sign", `${PORTAL_URL}/contracts/55`),
      emailFootnote("Please review the contract carefully before signing. Contact the breeder if you have questions."),
    ].join("\n"),
  }));

  add("Contract Reminder", "Reminder: Contract awaiting signature", wrapEmailLayout({
    title: "Contract Reminder",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.clientName),
      emailParagraph(`Friendly reminder: You have a contract waiting for your signature from ${emailAccent(SAMPLE.breederName)}.`),
      emailInfoCard([
        `<p style="color: #f59e0b; margin: 0; font-weight: 600;">Awaiting Your Signature</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">${SAMPLE.contractTitle}</p>`,
        `<p style="color: #a3a3a3; margin: 8px 0 0 0;">This contract expires on March 1, 2026.</p>`,
      ].join("\n"), { borderColor: "yellow" }),
      emailButton("Review & Sign", `${PORTAL_URL}/contracts/55`),
    ].join("\n"),
  }));

  add("Contract Signed", "Contract has been signed!", wrapEmailLayout({
    title: "Contract Signed!",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.breederName),
      emailParagraph(`${emailAccent(SAMPLE.clientName)} has signed the contract.`),
      emailInfoCard([
        `<p style="color: #10b981; margin: 0; font-weight: 600;">✓ Fully Executed</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">${SAMPLE.contractTitle}</p>`,
        `<p style="color: #a3a3a3; margin: 8px 0 0 0;">Both parties have signed. The contract is now active.</p>`,
      ].join("\n"), { borderColor: "green" }),
      emailButton("View Contract", `${APP_URL}/contracts/55`),
    ].join("\n"),
  }));

  add("Contract Declined", "Contract was declined", wrapEmailLayout({
    title: "Contract Declined",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.breederName),
      emailParagraph(`${emailAccent(SAMPLE.clientName)} has declined the contract.`),
      emailInfoCard([
        `<p style="color: #dc2626; margin: 0; font-weight: 600;">Declined</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">${SAMPLE.contractTitle}</p>`,
        `<p style="color: #a3a3a3; margin: 8px 0 0 0;">Reason: "I'd like to discuss the payment terms before signing."</p>`,
      ].join("\n"), { borderColor: "red" }),
      emailButton("View Contract", `${APP_URL}/contracts/55`),
    ].join("\n"),
  }));

  add("Contract Voided", "Contract voided", wrapEmailLayout({
    title: "Contract Voided",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.clientName),
      emailParagraph(`The contract ${emailAccent(SAMPLE.contractTitle)} has been voided by ${emailAccent(SAMPLE.breederName)}.`),
      emailInfoCard([
        `<p style="color: #a3a3a3; margin: 0; font-weight: 600;">Voided</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">${SAMPLE.contractTitle}</p>`,
        `<p style="color: #a3a3a3; margin: 8px 0 0 0;">This contract is no longer valid. Contact the breeder if you have questions.</p>`,
      ].join("\n"), { borderColor: "gray" }),
    ].join("\n"),
  }));

  add("Contract Expired", "Contract expired", wrapEmailLayout({
    title: "Contract Expired",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.breederName),
      emailParagraph(`The contract ${emailAccent(SAMPLE.contractTitle)} has expired without being signed.`),
      emailInfoCard([
        `<p style="color: #f59e0b; margin: 0; font-weight: 600;">Expired</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">${SAMPLE.contractTitle}</p>`,
        `<p style="color: #a3a3a3; margin: 8px 0 0 0;">The contract expired on March 1, 2026. You can resend a new contract if needed.</p>`,
      ].join("\n"), { borderColor: "yellow" }),
      emailButton("Create New Contract", `${APP_URL}/contracts/new`),
    ].join("\n"),
  }));

  add("Contract Completed with PDF", "Contract complete — PDF attached", wrapEmailLayout({
    title: "Contract Complete",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.clientName),
      emailParagraph(`Your contract ${emailAccent(SAMPLE.contractTitle)} is fully executed. A PDF copy is attached for your records.`),
      emailInfoCard([
        `<p style="color: #10b981; margin: 0; font-weight: 600;">✓ Fully Executed</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">${SAMPLE.contractTitle}</p>`,
        `<p style="color: #a3a3a3; margin: 8px 0 0 0;">Signed by both parties. PDF attached to this email.</p>`,
      ].join("\n"), { borderColor: "green" }),
      emailButton("View in Portal", `${PORTAL_URL}/contracts/55`),
      emailFootnote("Please save the attached PDF for your records."),
    ].join("\n"),
  }));

  add("Tenant Invoice Payment Failed", "Invoice payment failed", wrapEmailLayout({
    title: "Invoice Payment Failed",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.breederName),
      emailParagraph(`A client's payment attempt for invoice ${emailAccent(SAMPLE.invoiceNumber)} has failed.`),
      emailDetailRows([
        { label: "Invoice", value: SAMPLE.invoiceNumber },
        { label: "Client", value: SAMPLE.clientName },
        { label: "Amount", value: "$450.00" },
      ]),
      emailInfoCard([
        `<p style="color: #dc2626; margin: 0; font-weight: 600;">Payment Declined</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">The client has been notified to update their payment method. You may want to follow up directly.</p>`,
      ].join("\n"), { borderColor: "red" }),
      emailButton("View Invoice", `${APP_URL}/invoices/42`),
    ].join("\n"),
  }));

  add("Tenant Welcome", "Welcome to BreederHQ!", wrapEmailLayout({
    title: "Welcome to BreederHQ!",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.breederName),
      emailParagraph("Your account is set up and ready to go! Here's what you can do:"),
      emailFeatureList([
        "Manage your animals and pedigrees",
        "Track breeding plans and genetics",
        "Create and send contracts",
        "Invoice clients directly",
        "Set up your client portal",
      ]),
      emailButton("Go to Dashboard", `${APP_URL}/dashboard`),
      emailFootnote("Need help? Check out our getting started guide."),
    ].join("\n"),
  }));

  // ── 6. notification-delivery.ts ───────────────────────────────────────

  add("Generic Notification (High)", "New notification", wrapEmailLayout({
    title: "Notification",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailInfoCard([
        `<p style="color: #f97316; margin: 0 0 4px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">⚠️ HIGH PRIORITY</p>`,
        `<p style="color: #ffffff; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">Breeding Plan Update</p>`,
        `<p style="color: #e5e5e5; margin: 0; font-size: 14px; line-height: 1.5;">Your breeding plan "Champion Spark × Golden Star" has been updated with new genetic test results.</p>`,
      ].join("\n"), { borderColor: "orange" }),
      emailButton("View Details", `${APP_URL}/notifications/99`),
    ].join("\n"),
  }));

  add("Carrier Warning (URGENT)", "URGENT: Carrier Status Alert", wrapEmailLayout({
    title: "🚨 Carrier Status Alert",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailInfoCard([
        `<p style="color: #dc2626; margin: 0; font-weight: 600;">URGENT: Genetic Carrier Match Detected</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">Both animals in a planned breeding are carriers for the same genetic condition.</p>`,
      ].join("\n"), { borderColor: "red" }),
      emailDetailRows([
        { label: "Condition", value: "Progressive Retinal Atrophy (PRA)" },
        { label: "Sire", value: "Champion Spark (Carrier)" },
        { label: "Dam", value: "Golden Star (Carrier)" },
        { label: "Risk", value: "25% chance of affected offspring" },
      ]),
      emailParagraph("This is an urgent alert. Please review the breeding plan before proceeding."),
      emailButton("Review Breeding Plan", `${APP_URL}/breeding/plans/12`, "red"),
    ].join("\n"),
  }));

  add("Pre-Breeding Reminder", "Pre-breeding reminder", wrapEmailLayout({
    title: "Pre-Breeding Reminder",
    footerOrgName: SAMPLE.tenantName,
    body: [
      emailGreeting(SAMPLE.breederName),
      emailParagraph("You have a breeding event coming up. Here's a checklist to prepare:"),
      emailBulletList([
        "Confirm both animals' health clearances are current",
        "Review genetic compatibility results",
        "Schedule pre-breeding veterinary exam",
        "Prepare whelping/foaling area",
        "Update breeding plan timeline",
      ]),
      emailDetailRows([
        { label: "Breeding Plan", value: "Champion Spark × Golden Star" },
        { label: "Target Date", value: "March 20, 2026" },
      ]),
      emailButton("View Breeding Plan", `${APP_URL}/breeding/plans/12`),
    ].join("\n"),
  }));

  // ── 7. listing-payment-emails.ts ──────────────────────────────────────

  add("Listing Activated", "Your listing is live!", wrapEmailLayout({
    title: "Your Listing Is Live!",
    footerOrgName: "BreederHQ Marketplace",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph(`Your service listing ${emailAccent(SAMPLE.listingTitle)} is now live on the marketplace.`),
      emailInfoCard([
        `<p style="color: #10b981; margin: 0; font-weight: 600;">Subscription Active</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">Your listing will renew monthly at $19.99.</p>`,
      ].join("\n"), { borderColor: "green" }),
      emailParagraph("Potential clients can now find your listing and reach out to book your services."),
      emailButton("View Your Listing", `${MARKETPLACE_URL}/provider/services/101`),
      emailFootnote("You can manage your subscription anytime from your provider dashboard."),
    ].join("\n"),
  }));

  add("Listing Renewed", "Listing renewed", wrapEmailLayout({
    title: "Listing Renewed",
    footerOrgName: "BreederHQ Marketplace",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph(`Your service listing ${emailAccent(SAMPLE.listingTitle)} has been renewed for another 30 days.`),
      emailInfoCard([
        `<p style="color: #e5e5e5; margin: 0;"><strong style="color: #ffffff;">Amount charged:</strong> $19.99</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;"><strong style="color: #ffffff;">Next renewal:</strong> April 18, 2026</p>`,
      ].join("\n"), { borderColor: "gray" }),
      emailButton("Manage Listing", `${MARKETPLACE_URL}/provider/services/101`),
    ].join("\n"),
  }));

  add("Listing Payment Failed", "Payment failed for listing", wrapEmailLayout({
    title: "Payment Failed",
    footerOrgName: "BreederHQ Marketplace",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph(`We were unable to charge your card for the listing ${emailAccent(SAMPLE.listingTitle)}.`),
      emailInfoCard([
        `<p style="color: #dc2626; margin: 0; font-weight: 600;">Action Required</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">Please update your payment method to keep your listing active. If payment is not resolved, your listing will be paused.</p>`,
      ].join("\n"), { borderColor: "red" }),
      emailButton("Update Payment Method", `${MARKETPLACE_URL}/provider/settings/payments`, "red"),
    ].join("\n"),
  }));

  add("Listing Expiry Warning (3 days)", "Listing expiring soon", wrapEmailLayout({
    title: "Listing Expiring Soon",
    footerOrgName: "BreederHQ Marketplace",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph(`Your service listing ${emailAccent(SAMPLE.listingTitle)} expires in ${emailAccent("3 days")} (March 21, 2026).`),
      emailInfoCard([
        `<p style="color: #f59e0b; margin: 0; font-weight: 600;">Renew to stay visible</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">Once expired, your listing will be paused and hidden from the marketplace. Renew for $19.99/month to keep it active.</p>`,
      ].join("\n"), { borderColor: "yellow" }),
      emailButton("Renew Listing", `${MARKETPLACE_URL}/provider/services/101`),
    ].join("\n"),
  }));

  add("Listing Expired (Paused)", "Listing paused", wrapEmailLayout({
    title: "Listing Paused",
    footerOrgName: "BreederHQ Marketplace",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph(`Your service listing ${emailAccent(SAMPLE.listingTitle)} has been paused because it expired without an active subscription.`),
      emailInfoCard([
        `<p style="color: #a3a3a3; margin: 0; font-weight: 600;">Your listing is no longer visible</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">Renew your subscription ($19.99/month) to make it visible on the marketplace again.</p>`,
      ].join("\n"), { borderColor: "gray" }),
      emailButton("Renew Listing", `${MARKETPLACE_URL}/provider/services/101`),
    ].join("\n"),
  }));

  add("Founding Period Ending", "Free listing period ending", wrapEmailLayout({
    title: "Your Free Period Is Ending",
    footerOrgName: "BreederHQ Marketplace",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph(`As a founding provider, your listing ${emailAccent(SAMPLE.listingTitle)} has been free. Your free period ends in ${emailAccent("7 days")} (March 25, 2026).`),
      emailInfoCard([
        `<p style="color: #f59e0b; margin: 0; font-weight: 600;">Subscribe to keep your listing active</p>`,
        `<p style="color: #e5e5e5; margin: 8px 0 0 0;">After March 25, 2026, a subscription of $19.99/month is required to keep your listing visible on the marketplace. Without a subscription, your listing will be paused.</p>`,
      ].join("\n"), { borderColor: "yellow" }),
      emailButton("Subscribe Now", `${MARKETPLACE_URL}/provider/services/101`),
      emailParagraph("Thank you for being an early supporter of BreederHQ!"),
    ].join("\n"),
  }));

  add("Listing Canceled (Auto-renewal stopped)", "Renewal canceled", wrapEmailLayout({
    title: "Auto-Renewal Canceled",
    footerOrgName: "BreederHQ Marketplace",
    body: [
      emailGreeting("Dr. Sarah"),
      emailParagraph(`The auto-renewal for your listing ${emailAccent(SAMPLE.listingTitle)} has been canceled.`),
      emailInfoCard([
        `<p style="color: #ffffff; margin: 0; font-weight: 600;">Your listing stays live until April 18, 2026</p>`,
        `<p style="color: #a3a3a3; margin: 8px 0 0 0;">After that date, it will be paused and hidden from the marketplace. You can resubscribe anytime at $19.99/month.</p>`,
      ].join("\n"), { borderColor: "gray" }),
      emailButton("Manage Listing", `${MARKETPLACE_URL}/provider/services/101`),
      emailFootnote("Changed your mind? You can resubscribe from your listing page before it expires."),
    ].join("\n"),
  }));

  return templates;
}

// ────────────────────────────────────────────────────────────────────────────
// Send all templates
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const templates = buildAllTemplates();
  console.log(`\n📧 Sending ${templates.length} email templates to ${RECIPIENT}\n`);

  let sent = 0;
  let failed = 0;

  for (const tmpl of templates) {
    try {
      const { data, error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: RECIPIENT,
        subject: tmpl.subject,
        html: tmpl.html,
      });

      if (error) {
        console.log(`  ❌ ${tmpl.name}: ${error.message}`);
        failed++;
      } else {
        console.log(`  ✅ ${tmpl.name} (${data?.id})`);
        sent++;
      }

      // Delay to stay under Resend's 2 req/sec rate limit
      await new Promise((r) => setTimeout(r, 600));
    } catch (err: any) {
      console.log(`  ❌ ${tmpl.name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${sent} sent, ${failed} failed, ${templates.length} total\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
