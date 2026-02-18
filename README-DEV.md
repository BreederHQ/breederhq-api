# BreederHQ API - Development Guide

## Quick Start

### Standard Development Server
```bash
npm run dev
```
- Works without Stripe configuration
- Billing routes available but non-functional without real keys
- Perfect for non-billing feature development

### With Stripe Billing (Reminder)
```bash
npm run dev:stripe
```
- Shows reminder that Stripe keys are needed
- Same as `npm run dev` but helps you remember to configure Stripe

## Environment Configuration

### Secrets (AWS Secrets Manager)

All secrets (DATABASE_URL, COOKIE_SECRET, RESEND_API_KEY, STRIPE keys, JWT secrets, etc.) are fetched from AWS Secrets Manager at startup. No need to manually configure them locally.

**Prerequisite** (one-time): `aws configure --profile dev` — get credentials from team lead.

`.env.dev` is committed to the repo — it contains only non-secret config (PORT, feature flags, S3 bucket name, etc.) and the SM pointer (`AWS_SECRET_NAME=breederhq-api/dev-prototype`). No credentials live in it.

See [AWS Secrets Manager docs](docs/operations/AWS-SECRETS-MANAGER.md) for details.

### Local-Only Config (in `.env.dev`)
```bash
PORT=6001
APP_URL=http://localhost:5173
MARKETPLACE_PUBLIC_ENABLED=true
S3_BUCKET=breederhq-assets-dev
```

## Features by Configuration

| Feature | Requires | Status Without Config |
|---------|----------|----------------------|
| Core API | DATABASE_URL | ❌ Fails |
| Authentication | COOKIE_SECRET | ❌ Fails |
| Email Notifications | RESEND_API_KEY | ⚠️ Silent failure |
| Billing/Subscriptions | STRIPE_SECRET_KEY | ⚠️ Routes exist but fail |
| Quota Warnings | RESEND_API_KEY | ⚠️ Silent failure |

## Email Notifications

The system sends automatic emails for:

### Quota Events (via usage-service.ts)
- **80%** usage → Warning email (orange)
- **95%** usage → Critical email (red)
- **100%** usage → Quota exceeded email (red)

### Billing Events (via Stripe webhooks)
- Payment failed → Payment failed email (red)
- Subscription canceled → Cancellation confirmation (gray)
- Subscription renewed → Renewal success (green)

## Database Commands

### Migrations
```bash
npm run db:dev:migrate    # Run new migrations
npm run db:dev:status     # Check migration status
npm run db:dev:deploy     # Deploy migrations (non-interactive)
```

### Seeding
```bash
npm run db:dev:seed              # Seed all (traits + users + products)
npm run db:dev:seed:products     # Seed subscription products only
npm run db:dev:seed:users        # Seed test users only
npm run db:dev:seed:traits       # Seed trait definitions only
```

### Testing
```bash
npm run test:quota        # Test quota enforcement
npm run test:usage        # Test usage API
```

## Stripe Webhook Setup (Production)

1. Create webhook endpoint in Stripe Dashboard
2. Point to: `https://api.breederhq.com/api/v1/billing/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

## Architecture Notes

- Stripe is **optional in development** - uses placeholder key if not configured
- Email service gracefully fails if Resend is not configured
- Quota enforcement works without emails (just won't notify users)
- All billing routes exist but will error without valid Stripe configuration
