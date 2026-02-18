# Email System Setup Guide

This guide covers setting up the BreederHQ email system using Resend for both development and production environments.

## Overview

BreederHQ uses [Resend](https://resend.com) for transactional email delivery. The system includes:

- **Transactional emails**: Invoices, password resets, booking confirmations
- **Billing notifications**: Payment failures, subscription changes, quota alerts
- **Marketing emails**: User-managed templates with opt-out compliance
- **Development safeguards**: Prevent accidental emails to real users

## Quick Start

### 1. Get Your Resend API Key

1. Sign up at [resend.com](https://resend.com)
2. Go to **API Keys** in the dashboard
3. Create a new API key
4. Copy the key (starts with `re_`)

### 2. Configure Environment Variables

Copy the relevant settings to your `.env` file:

```bash
# Required
RESEND_API_KEY=re_your_api_key_here

# From address
RESEND_FROM_EMAIL=onboarding@resend.dev   # Dev: Resend's test domain
RESEND_FROM_NAME=BreederHQ

# App URL for email links
APP_URL=http://localhost:5173
```

### 3. Choose a Development Safeguard

Pick ONE of these options to prevent emailing real users during development:

```bash
# Option A: Redirect all emails to your inbox
EMAIL_DEV_REDIRECT=your-email@gmail.com

# Option B: Log only (no emails sent)
EMAIL_DEV_LOG_ONLY=true

# Option C: Allow specific domains only
EMAIL_DEV_ALLOWED_DOMAINS=yourdomain.com,test.com
```

---

## Environment Configuration

### Development Environment

```bash
# .env.dev
NODE_ENV=development

# Resend
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_FROM_NAME=BreederHQ (Dev)

# Dev safeguard - pick one:
EMAIL_DEV_REDIRECT=developer@yourdomain.com
# EMAIL_DEV_LOG_ONLY=true
# EMAIL_DEV_ALLOWED_DOMAINS=yourdomain.com

# App URL
APP_URL=http://localhost:5173
```

### Production Environment

```bash
# .env.prod
NODE_ENV=production

# Resend
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=noreply@breederhq.com
RESEND_FROM_NAME=BreederHQ

# App URL
APP_URL=https://app.breederhq.com

# No dev safeguards needed - they're ignored in production
```

---

## Development Safeguards

These settings **only apply when `NODE_ENV` is not `production`**. They prevent accidentally emailing real users during development and testing.

### Option 1: Email Redirect (`EMAIL_DEV_REDIRECT`)

All emails are redirected to a single test address. The original recipient is shown in the subject line.

```bash
EMAIL_DEV_REDIRECT=developer@yourdomain.com
```

**Example behavior:**
- Original: `customer@example.com` with subject "Your Invoice"
- Actual: `developer@yourdomain.com` with subject "[DEV: customer@example.com] Your Invoice"

**Best for:** Testing email delivery and templates while seeing all emails in one inbox.

### Option 2: Log Only Mode (`EMAIL_DEV_LOG_ONLY`)

Emails are logged to the console and database but never actually sent.

```bash
EMAIL_DEV_LOG_ONLY=true
```

**Console output:**
```
[email-service] DEV LOG ONLY - Would send to: customer@example.com
  Subject: Your Invoice
  Category: transactional
  HTML: <div style="font-family: sans-serif...
```

**Best for:** Local development without Resend, or CI/CD testing.

### Option 3: Domain Allowlist (`EMAIL_DEV_ALLOWED_DOMAINS`)

Only emails to specific domains are sent. Others are blocked.

```bash
EMAIL_DEV_ALLOWED_DOMAINS=yourdomain.com,staging.breederhq.com
```

**Best for:** Staging environments where you want to test with real team emails.

### Priority Order

If multiple safeguards are configured, they're applied in this order:

1. `EMAIL_DEV_LOG_ONLY=true` - Blocks all emails
2. `EMAIL_DEV_ALLOWED_DOMAINS` - Allows matching domains through
3. `EMAIL_DEV_REDIRECT` - Redirects everything else

---

## Production Setup: Domain Verification

For production, you must verify your sending domain in Resend.

### Step 1: Add Your Domain

1. Go to Resend Dashboard → **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `breederhq.com`)

### Step 2: Configure DNS Records

Resend will provide DNS records to add. Typically:

| Type | Name | Value |
|------|------|-------|
| TXT | `resend._domainkey` | `p=MIGfMA0GCS...` (DKIM) |
| TXT | `@` | `v=spf1 include:_spf.resend.com ~all` (SPF) |
| TXT | `_dmarc` | `v=DMARC1; p=none;` (DMARC) |

### Step 3: Verify

1. Add the DNS records to your domain provider
2. Wait for propagation (usually 5-30 minutes)
3. Click **Verify** in Resend dashboard

### Step 4: Update Environment

```bash
RESEND_FROM_EMAIL=noreply@breederhq.com
```

---

## Email Types

### Transactional Emails

System-generated emails that bypass user preferences:

| Template Key | Trigger | Description |
|--------------|---------|-------------|
| `invoice_issued` | Invoice created | Invoice notification with PDF link |
| `payment_failed` | Stripe webhook | Payment failure alert |
| `subscription_renewed` | Stripe webhook | Renewal confirmation |
| `subscription_canceled` | User action | Cancellation notice |
| `quota_warning` | 80% usage | Approaching quota limit |
| `quota_critical` | 95% usage | Near quota limit |
| `quota_exceeded` | 100% usage | At quota limit |
| `booking_confirmation` | Booking created | Appointment details |
| `booking_reminder` | Cron job | Day-before reminder |
| `booking_cancellation` | Booking canceled | Cancellation notice |
| `booking_reschedule` | Booking updated | Rescheduled details |

### Marketing Emails

User-managed emails that respect communication preferences:

- Custom templates stored in database
- Honor `PartyCommPreference` opt-out settings
- Tracked for compliance (SUBSCRIBED/UNSUBSCRIBED)

---

## Email Logging

All emails are logged to the `EmailSendLog` table:

```sql
SELECT
  id,
  "to",
  subject,
  status,
  "templateKey",
  category,
  "providerMessageId",
  metadata,
  "createdAt"
FROM "EmailSendLog"
WHERE "tenantId" = 1
ORDER BY "createdAt" DESC
LIMIT 10;
```

### Log Fields

| Field | Description |
|-------|-------------|
| `status` | `queued`, `sent`, `failed` |
| `category` | `transactional` or `marketing` |
| `providerMessageId` | Resend's message ID for tracking |
| `metadata` | JSON with dev mode info, context data |
| `error` | JSON with error details if failed |

### Dev Mode Metadata

When dev safeguards are active, metadata includes:

```json
{
  "devMode": "redirected",
  "originalTo": "customer@example.com",
  "actualRecipient": "developer@yourdomain.com"
}
```

---

## Testing Emails

### Send a Test Email

```typescript
import { sendEmail } from "./services/email-service.js";

await sendEmail({
  tenantId: 1,
  to: "test@example.com",
  subject: "Test Email",
  html: "<h1>Hello!</h1><p>This is a test.</p>",
  category: "transactional",
});
```

### Check Email Logs

```bash
# Via API (admin only)
curl -X GET "http://localhost:6001/api/v1/admin/email-logs?limit=10" \
  -H "X-Tenant-Id: 1"
```

### Verify Dev Mode

With `EMAIL_DEV_LOG_ONLY=true`, check console output:

```
[email-service] DEV LOG ONLY - Would send to: test@example.com
  Subject: Test Email
  Category: transactional
```

---

## Troubleshooting

### "RESEND_API_KEY environment variable is not set"

The API key is missing. Add it to your `.env` file:

```bash
RESEND_API_KEY=re_xxxxx
```

### Emails Not Being Received

1. **Check logs**: Look at `EmailSendLog` table for status
2. **Check spam**: Resend emails may land in spam initially
3. **Verify domain**: Production requires verified domain
4. **Check dev mode**: Ensure `EMAIL_DEV_REDIRECT` points to correct address

### "recipient_has_blocked_email" Error

The recipient has opted out of marketing emails. This only affects `category: "marketing"` emails. Transactional emails bypass this check.

### Emails Going to Wrong Address in Dev

Check your dev safeguard configuration:

```bash
# This redirects ALL emails
EMAIL_DEV_REDIRECT=wrong@email.com

# Remove or update to fix
```

---

## Resend Pricing (as of 2024)

| Plan | Monthly Emails | Price |
|------|----------------|-------|
| Free | 3,000 | $0 |
| Pro | 50,000 | $20/mo |
| Pro | 100,000 | $40/mo |
| Enterprise | Custom | Contact |

Free tier is sufficient for development and small production use.

---

## Creating Email Templates

All transactional emails must use the shared layout system in `src/services/email-layout.ts`. **Do not write raw HTML.** The layout system provides dark-theme design tokens, brand consistency, and reusable components.

### Basic Structure

```typescript
import {
  wrapEmailLayout,
  emailGreeting,
  emailParagraph,
  emailButton,
  emailFootnote,
} from "./email-layout.js";

const html = wrapEmailLayout({
  title: "Your Email Title",        // shown in the header below the logo
  footerOrgName: orgName,           // personalizes "Sent by X via BreederHQ"
  body: [
    emailGreeting(partyName),
    emailParagraph("Your message here."),
    emailButton("Call to Action", activationUrl),
    emailFootnote("Didn't expect this? You can safely ignore this email."),
  ].join("\n"),
});
```

### `wrapEmailLayout(options)` — Main Wrapper

Renders the full email shell: orange accent bar → logo + title header → body → branded footer.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `title` | `string` | Yes | Heading shown below the logo |
| `body` | `string` | Yes | HTML body content (use component helpers below) |
| `footerOrgName` | `string` | No | Org name in footer. Defaults to `"BreederHQ"` |
| `showLogo` | `boolean` | No | Whether to show the logo. Defaults to `true` |

### Component Helpers

#### `emailGreeting(name)` — Greeting line
```typescript
emailGreeting("Gavin Darklighter")
// → Hello Gavin Darklighter,
```

#### `emailParagraph(html)` — Body paragraph
```typescript
emailParagraph(`Welcome to <strong>BreederHQ</strong>.`)
// Muted body text (#a3a3a3), 15px, 1.6 line-height
```

#### `emailAccent(text)` — Orange emphasis
```typescript
emailParagraph(`${emailAccent("Darklighter Ranch")} has invited you...`)
// Inline orange (#f97316) bold text — compose inside emailParagraph
```

#### `emailButton(text, href, color?)` — CTA button
```typescript
emailButton("Activate Your Account", url)           // orange (default)
emailButton("View Invoice", url, "green")
emailButton("Cancel Booking", url, "red")
emailButton("Learn More", url, "blue")
emailButton("Dismiss", url, "gray")
```
Available colors: `orange` | `green` | `red` | `blue` | `gray`

#### `emailFeatureList(items)` — Orange-checkmark feature list
```typescript
emailFeatureList([
  "View and sign agreements & contracts",
  "Track your waitlist & reservations",
  "Make secure payments online",
])
// Dark cards with orange ✓ marks — use for benefit lists on invite/welcome emails
```

#### `emailBulletList(items)` — Simple bulleted list
```typescript
emailBulletList(["Item one", "Item two", "Item three"])
// Standard bullet list — lighter than emailFeatureList
```

#### `emailDetailRows(rows)` — Key/value detail table
```typescript
emailDetailRows([
  { label: "Invoice #", value: "INV-1042" },
  { label: "Amount Due", value: "$350.00" },
  { label: "Due Date", value: "March 1, 2026" },
])
// Dark table with muted labels and white values
```

#### `emailInfoCard(content, options?)` — Callout card
```typescript
emailInfoCard(`<p style="color: #d4d4d4; margin: 0;">Link expires in 3 days.</p>`)
emailInfoCard(`<p style="color: #d4d4d4; margin: 0;">Action required.</p>`, { borderColor: "orange" })
// borderColor options: "orange" | "green" | "red" | "blue" | "yellow" | "gray"
```

#### `emailHeading(text)` — Section heading
```typescript
emailHeading("What's Included")
// White, 16px, 600 weight — use to break up longer emails
```

#### `emailFootnote(text)` — Muted footer note
```typescript
emailFootnote("Didn't expect this? You can safely ignore this email.")
// Centered, muted (#737373), 13px — always include at bottom of email
```

#### `emailCodeBlock(code)` — Verification code display
```typescript
emailCodeBlock("847291")
// Large centered code in a dark box — use for OTPs and verification codes
```

### Design Tokens

| Token | Value | Used For |
|-------|-------|----------|
| Page background | `#0a0a0a` | Outer wrapper |
| Card background | `#171717` | Info cards, detail tables |
| Border | `#262626` | Dividers, card borders |
| Heading text | `#ffffff` | Titles, strong values |
| Body text | `#e5e5e5` | Greeting names |
| Muted text | `#a3a3a3` | Paragraphs, labels |
| Subtle text | `#737373` | Footnotes, footer |
| Brand orange | `#f97316 → #ea580c` | Buttons, accents, checkmarks |

### Template Checklist

When creating a new email template:

- [ ] Use `wrapEmailLayout()` — no raw HTML
- [ ] Set `footerOrgName` from a `prisma.tenant.findUnique()` lookup if tenant-specific
- [ ] Include `emailFootnote()` at the bottom
- [ ] Use `emailButton()` for all CTAs (not raw `<a>` tags)
- [ ] Pass the result to `sendEmail()` with an appropriate `templateKey` and `category`
- [ ] Also write a plain-text version for the `text` field

### Reference Implementations

- `src/routes/portal-access.ts` — `sendInviteEmail()` (portal invite with feature list)
- `src/services/email-templates.ts` — booking and invoice templates (detail rows, buttons)
- `src/services/email-service.ts` — contract and billing notification templates

---

## Related Files

- `src/services/email-layout.ts` - Shared dark-theme layout components (use this for all templates)
- `src/services/email-service.ts` - Core email sending logic
- `src/services/email-templates.ts` - HTML email templates
- `src/services/comm-prefs-service.ts` - Communication preferences
- `src/services/template-renderer.ts` - Mustache template rendering
- `src/services/notification-delivery.ts` - Notification email delivery
- `prisma/schema.prisma` - `EmailSendLog`, `Template`, `PartyCommPreference` models

## Related Documentation

- [NOTIFICATION-DELIVERY-SYSTEM.md](./NOTIFICATION-DELIVERY-SYSTEM.md) - Notification generation and delivery to owners

---

## Security Considerations

1. **Never commit API keys** - Use environment variables
2. **Verify domains** - Prevents spoofing and improves deliverability
3. **Use dev safeguards** - Prevent accidental customer emails
4. **Log all sends** - Audit trail for compliance
5. **Respect opt-outs** - Marketing emails honor preferences
