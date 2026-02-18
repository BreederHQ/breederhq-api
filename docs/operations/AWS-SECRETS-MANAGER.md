# AWS Secrets Manager Integration

**Date**: 2026-02-03
**Updated**: 2026-02-18
**Status**: ✅ Active (All Environments)
**Cost**: ~$0.45/month per secret (~$3.15/month total for 7 secrets)
**Related**: [ADR-0001](../architecture-decisions/0001-AWS-SECRETS-MANAGER.md)

---

## Overview

BreederHQ API stores ALL application secrets in AWS Secrets Manager across two AWS accounts. Each environment gets its own secret containing 17 keys.

**Trigger**: Set `USE_SECRETS_MANAGER=true` environment variable to enable (any environment).

**What's in Secrets Manager (17 keys per environment)**:

| Category | Keys |
|----------|------|
| Database | `DATABASE_URL` (pooled), `DATABASE_DIRECT_URL` (direct) |
| Session | `COOKIE_SECRET` |
| Email | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `INBOUND_EMAIL_HMAC_SECRET` |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Storage | `AWS_ACCESS_KEY_ID` (S3), `AWS_SECRET_ACCESS_KEY` (S3) |
| Mobile Auth | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` |
| Compliance | `JWT_UNSUBSCRIBE_SECRET` |
| Monitoring | `SENTRY_DSN` |
| Push Notifications | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |

---

## Architecture

### Two AWS Accounts

| Account | Profile | Account ID | Environments | IAM Policy |
|---------|---------|------------|--------------|------------|
| **Production** | `prod` | `427814061976` | production | `breederhq-api-prod-secrets-read` |
| **Development** | `dev` | `335274136775` | dev, alpha, bravo | `breederhq-api-dev-secrets-read` |

### NeonDB Projects

| Project | NeonDB Project ID | Branches | AWS Account | Status |
|---------|-------------------|----------|-------------|--------|
| `breederhq-production` | `flat-flower-54202261` | production | Prod | Future production |
| `breederhq-development` | `polished-fire-14346254` | dev, alpha, bravo | Dev | Future dev/staging |
| `breederhq-prototype` | *(legacy)* | *(single)* | Dev (dev profile) | Active prototype — will be decommissioned after migration to breederhq-development |

### Secrets

All secrets use the `breederhq/{env}` naming convention (no `-api` prefix), stored in `us-east-2`.

| Secret Name | AWS Account | NeonDB / Endpoint | Status |
|-------------|-------------|-------------------|--------|
| `breederhq/prod-prototype` | Prod | flat-flower-54202261 (breederhq-production) | **Active** — Render points here |
| `breederhq/prod` | Prod | flat-flower-54202261 (breederhq-production) | Ready — use after cutover |
| `breederhq/dev-prototype` | Dev | ep-misty-frog (breederhq-prototype) | **Active** — local dev + migrations |
| `breederhq/dev` | Dev | polished-fire-14346254 (breederhq-development/dev) | Ready — use after cutover |
| `breederhq/alpha` | Dev | polished-fire-14346254 (breederhq-development/alpha) | Ready |
| `breederhq/bravo` | Dev | polished-fire-14346254 (breederhq-development/bravo) | Ready |
| `breederhq/platform` | Dev | — (not a DB secret) | **Active** — cross-env management keys |

#### `breederhq/platform` keys

| Key | Purpose |
|-----|---------|
| `NEON_API_KEY` | NeonDB management API — accesses all projects and branches |
| `SENTRY_AUTH_TOKEN` | Sentry CLI auth token for source maps and release management |
| `RENDER_API_KEY` | Render.com management API |

#### DB Role Convention

Every SM secret stores two DB connection strings with distinct roles:

| SM Key | Role | Endpoint | Purpose |
|--------|------|----------|---------|
| `DATABASE_URL` | `bhq_app` | Pooler (`-pooler`) | Runtime queries — app server via `boot-dev.js` / `boot-with-secrets.js` |
| `DATABASE_DIRECT_URL` | `bhq_migrator` | Direct (no pooler) | Schema migrations (dbmate) and Prisma introspection (`prisma db pull`) |

> `run-with-env.js` automatically remaps `DATABASE_URL = DATABASE_DIRECT_URL` when fetching from SM for migration scripts, ensuring dbmate always gets a direct connection.

#### Prototype → New Environment Cutover

When ready to migrate from prototype to new NeonDB environments:

1. **Dev**: Change `AWS_SECRET_NAME` in `.env.dev.migrate` and `.env.dev` from `breederhq/dev-prototype` → `breederhq/dev`
2. **Prod**: Change `AWS_SECRET_NAME` in `.env.prod.migrate` from `breederhq/prod-prototype` → `breederhq/prod`

### How It Works

**Deployed environments** (EB / Render):
```
[boot-with-secrets.js]
     ↓
Fetch from AWS Secrets Manager
     │  Secret name: AWS_SECRET_NAME or breederhq/${NODE_ENV}
     │  Region: AWS_SECRETS_MANAGER_REGION or us-east-2
     ↓
Object.assign(process.env, secrets) → All 17 keys merged into process.env
     ↓
[preflight-env.js] → Validates environment
     ↓
[node dist/server.js] → Prisma, Stripe, Resend, S3, JWT all read from process.env
```

**Local development** (`npm run dev`):
```
[boot-dev.js]
     ↓
Load .env.dev → local-only vars (PORT, NODE_ENV, feature flags)
     │  AWS_SECRET_NAME=breederhq/dev-prototype  (or breederhq/dev when ready to cut over)
     ↓
Fetch from AWS Secrets Manager (via AWS_PROFILE=dev)
     │  If SSO token expired → auto-opens browser for re-auth → retries
     ↓
Object.assign(process.env, secrets) → SM values override .env.dev fallbacks
     │  DATABASE_URL = bhq_app @ pooler (runtime)
     ↓
[preflight-env.js] → Validates environment
     ↓
[tsx watch src/server.ts] → Hot-reload dev server
```

**Migration scripts** (`npm run db:dev:*`):
```
[run-with-env.js .env.dev.migrate]
     ↓
Load .env.dev.migrate → thin config (AWS_SECRET_NAME, AWS_PROFILE, NODE_ENV only)
     ↓
Detect AWS_SECRET_NAME → fetch from AWS Secrets Manager
     ↓
Remap: DATABASE_URL = DATABASE_DIRECT_URL  (bhq_migrator @ direct — required for DDL)
     ↓
[guardrails] → Block pooler URL, validate migration ordering, require TTY confirmation
     ↓
[dbmate / prisma db pull / seed scripts]
```

### Files Involved

- **[scripts/boot-with-secrets.js](../../scripts/boot-with-secrets.js)** — Deployed startup: fetches SM secrets, runs preflight, starts server
- **[scripts/development/boot-dev.js](../../scripts/development/boot-dev.js)** — Local dev startup: loads .env.dev, fetches SM secrets (with auto SSO re-login), starts tsx watch
- **[scripts/development/preflight-env.js](../../scripts/development/preflight-env.js)** — Validates required env vars (skips checks when SM enabled)

---

## IAM Resources

### Prod Account (427814061976)

**Policy**: `breederhq-api-prod-secrets-read` (v3)
- Allows: `secretsmanager:GetSecretValue`
- Resource: `arn:aws:secretsmanager:us-east-2:427814061976:secret:breederhq/prod-*`

**Attached to users**: `breederhq-api-prod`, `breederhq-api-render-prod`

### Dev Account (335274136775)

**Policy**: `breederhq-api-dev-secrets-read`
- Allows: `secretsmanager:GetSecretValue`
- Resource: `arn:aws:secretsmanager:us-east-2:335274136775:secret:breederhq/*`

**Attached to users**: `breederhq-api-dev`, `breederhq-api-alpha`, `breederhq-api-beta`

### Environment Variables (EB / Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `USE_SECRETS_MANAGER` | Yes | Set to `"true"` to enable |
| `AWS_SECRET_NAME` | Recommended | Override default name (e.g., `breederhq/dev-prototype`) |
| `AWS_SECRETS_MANAGER_REGION` | No | Defaults to `us-east-2` |
| `AWS_ACCESS_KEY_ID` | On Render only | Not needed on EB (uses instance roles) |
| `AWS_SECRET_ACCESS_KEY` | On Render only | Not needed on EB (uses instance roles) |

**Note**: `AWS_SECRETS_MANAGER_REGION` is separate from `AWS_REGION` (which is used by S3, defaults to `us-east-1`).

---

## Common Operations

### View Secret Keys (without values)

```bash
# Production (active prototype)
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id breederhq/prod-prototype \
  --profile prod --region us-east-2 \
  --query 'SecretString' --output text) && \
  node -e "console.log(JSON.stringify(Object.keys(JSON.parse(process.argv[1])),null,2))" "$SECRET"

# Dev (active prototype)
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id breederhq/dev-prototype \
  --profile dev --region us-east-2 \
  --query 'SecretString' --output text) && \
  node -e "console.log(JSON.stringify(Object.keys(JSON.parse(process.argv[1])),null,2))" "$SECRET"
```

### View Full Secret

```bash
# ⚠️ WARNING: This prints plaintext secrets — never paste output into chat/logs
aws secretsmanager get-secret-value \
  --secret-id breederhq/prod-prototype \
  --profile prod --region us-east-2 \
  --query SecretString --output text
```

### Update a Single Key in a Secret

```bash
# 1. Get current secret
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id breederhq/prod-prototype \
  --profile prod --region us-east-2 \
  --query 'SecretString' --output text)

# 2. Update one key using node
UPDATED=$(node -e "
  const s = JSON.parse(process.argv[1]);
  s.STRIPE_SECRET_KEY = 'sk_live_NEW_KEY_HERE';
  console.log(JSON.stringify(s));
" "$SECRET")

# 3. Push updated secret
aws secretsmanager put-secret-value \
  --secret-id breederhq/prod-prototype \
  --secret-string "$UPDATED" \
  --profile prod --region us-east-2

# 4. Restart service to pick up new values
```

### Update Database Connection Strings

After changing NeonDB password or endpoint:

```bash
# Write updated secret to temp file
node -e "
  const s = JSON.parse(process.argv[1]);
  s.DATABASE_URL = 'postgresql://...new-pooler-url...';
  s.DATABASE_DIRECT_URL = 'postgresql://...new-direct-url...';
  require('fs').writeFileSync('/tmp/updated.json', JSON.stringify(s));
" "$SECRET"

aws secretsmanager put-secret-value \
  --secret-id breederhq/prod-prototype \
  --secret-string "file:///tmp/updated.json" \
  --profile prod --region us-east-2

rm /tmp/updated.json
```

### Rotate IAM Access Keys

**When**: Every 90 days or if keys are compromised

```bash
# 1. Create new access keys
aws iam create-access-key \
  --user-name breederhq-api-prod \
  --profile prod

# 2. Update hosting env vars (Render/EB) with new keys
# 3. Restart service
# 4. Verify (check logs for "✓ 17 secrets loaded")
# 5. Delete old access keys
aws iam delete-access-key \
  --user-name breederhq-api-prod \
  --access-key-id <OLD_KEY_ID> \
  --profile prod
```

---

## Troubleshooting

### Symptom: Application fails to start with "Secret initialization failed"

**Possible causes**:
1. AWS credentials not set in hosting env vars
2. IAM policy doesn't allow GetSecretValue
3. Secret doesn't exist or wrong name
4. Region mismatch (check `AWS_SECRETS_MANAGER_REGION`)

**Check logs for**:
```
ℹ️  Skipping COOKIE_SECRET check (will be fetched from AWS Secrets Manager)
Fetching app secrets from AWS Secrets Manager: breederhq/dev-prototype
✓ 17 secrets loaded from AWS Secrets Manager
```

### Symptom: "Access Denied" error

```bash
# Check IAM policy is attached
aws iam list-attached-user-policies \
  --user-name breederhq-api-dev \
  --profile dev

# Should show: breederhq-api-dev-secrets-read
```

### Symptom: S3 uploads fail after enabling Secrets Manager

**Cause**: `AWS_REGION` in the secret may override the S3 region.

**Fix**: The SM client now uses `AWS_SECRETS_MANAGER_REGION` (separate from `AWS_REGION`). Ensure secrets include `AWS_REGION=us-east-1` if S3 needs it, or rely on the default in s3-client.ts.

---

## Emergency Rollback

### Option 1: Emergency Mode

```bash
# In hosting env vars:
EMERGENCY_MODE=true
DATABASE_URL=postgresql://...direct-url...
```

Application will skip Secrets Manager and use DATABASE_URL from env vars. Other services (Stripe, Resend, etc.) will need their env vars set manually.

### Option 2: Full Rollback

1. Set all 17 secret values as individual env vars in hosting platform
2. Remove `USE_SECRETS_MANAGER` env var (or set to `false`)
3. Restart service
4. Application will use `.env` files / env vars

**Time to rollback**: ~5-10 minutes

---

## Cost Breakdown

| Resource | Cost |
|----------|------|
| Secret storage (7 secrets @ $0.40/month each) | $2.80/month |
| API calls (~70/month, 10 per env) | $0.03/month |
| **Total** | **~$2.83/month** |

> Cost will return to ~$1.62/month once prototype secrets are decommissioned post-migration (leaves 4 active: dev, prod, alpha, bravo).

---

## Local Development

**Local development uses AWS Secrets Manager by default** via `boot-dev.js`.

When `npm run dev` runs:
1. Loads `.env.dev` for local-only vars (PORT, NODE_ENV, feature flags, etc.)
2. Fetches all secrets from SM using the `dev` AWS profile
3. SM values override any fallback values in `.env.dev`
4. Runs preflight checks and starts the dev server

**Prerequisite**: Configure the AWS CLI dev profile once:

```bash
aws configure --profile dev
# Access Key ID: (get from team lead)
# Secret Access Key: (get from team lead)
# Region: us-east-2
```

**On startup you should see**:

```
🔐 Fetching secrets from AWS Secrets Manager: breederhq/dev-prototype
✓ 17 secrets loaded from AWS Secrets Manager
🔍 Running preflight checks...
✅ Preflight check passed
🚀 Starting dev server (tsx watch)...
```

**For migration scripts** (`npm run db:dev:status`, `db:dev:up`, etc.):

```
🔐 run-with-env: Fetching secrets from SM: breederhq/dev-prototype
   ✓ 16 secrets loaded (DATABASE_URL → direct endpoint)
```

The `DATABASE_URL` is automatically remapped to the direct (non-pooler) connection for dbmate compatibility.

**To disable SM** (e.g., no internet, AWS issues):

Set `USE_SECRETS_MANAGER=false` in `.env.dev`. You will also need to set the required secrets (DATABASE_URL, COOKIE_SECRET, etc.) as environment variables or temporarily in a local `.env.dev.local` file (gitignored). `.env.dev` itself contains no secret fallbacks — all credentials live in Secrets Manager.

**Note**: Other scripts (`npm run test`, `db:studio`, etc.) read directly from `.env.dev` and do not go through SM. They rely on AWS SM credentials being available in the shell environment (via `aws configure --profile dev`), or you can set the required secrets as environment variables before running them.

---

## Deprecated/Removed Secrets

Secrets removed during the 2026-02-18 rename from `breederhq-api/*` → `breederhq/*`:

| Secret | Account | Replaced By | Removed |
|--------|---------|-------------|---------|
| `breederhq-api/dev-prototype` | Dev | `breederhq/dev-prototype` | 2026-02-18 |
| `breederhq-api/dev` | Dev | `breederhq/dev` | 2026-02-18 |
| `breederhq-api/alpha` | Dev | `breederhq/alpha` | 2026-02-18 |
| `breederhq-api/bravo` | Dev | `breederhq/bravo` | 2026-02-18 |
| `breederhq-api/prod` | Prod | `breederhq/prod-prototype` | 2026-02-18 |
| `breederhq-api/prod-prototype` | Prod | (merged into `breederhq/prod-prototype`) | 2026-02-18 |
| `breederhq-api/production` | Prod | `breederhq/prod` | 2026-02-18 (force-deleted) |

---

## Related Documentation

- **[Architecture Decision](../architecture-decisions/0001-AWS-SECRETS-MANAGER.md)** — Why we chose this approach
- **[src/config/secrets.ts](../../src/config/secrets.ts)** — Implementation (`getAppSecrets()`)
- **[src/prisma.ts](../../src/prisma.ts)** — Startup integration
- **[EB Deployment Guide](./ELASTIC-BEANSTALK-DEPLOYMENT.md)** — Deployment with SM

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-03 | Initial production deployment (database credentials only) |
| 1.1 | 2026-02-15 | Trigger changed to `USE_SECRETS_MANAGER=true`; default name `breederhq/${NODE_ENV}` |
| 2.0 | 2026-02-16 | Phase 2: 16 keys per secret, 4 environments, 2 AWS accounts, new NeonDB projects, separate IAM policies, `getAppSecrets()` rename |
| 2.1 | 2026-02-18 | Added `JWT_UNSUBSCRIBE_SECRET` for CAN-SPAM email unsubscribe token signing (17 keys) |
| 3.0 | 2026-02-18 | Added prototype secrets (`dev-prototype`, `prod-prototype`) for legacy NeonDB instance. Unified SM for both runtime and migrations: `run-with-env.js` now fetches from SM (thin `.env.*.migrate` config files replace hardcoded credentials). All `db:*:status/dump` scripts now route through `run-with-env.js`. DB role convention documented: `bhq_app@pooler` for `DATABASE_URL`, `bhq_migrator@direct` for `DATABASE_DIRECT_URL`. |
| 3.1 | 2026-02-18 | Renamed all secrets from `breederhq-api/*` → `breederhq/*` (dropped `-api` prefix). Created `breederhq/prod` (future production) and `breederhq/platform` (cross-env management keys: NEON_API_KEY, SENTRY_AUTH_TOKEN, RENDER_API_KEY). Updated prod IAM policy to v3 (`breederhq/prod-*`). Updated dev IAM policy to `breederhq/*`. |

---

**Document Version**: 3.1
**Maintained By**: Engineering Team
**Last Updated**: 2026-02-18
**Next Review**: 2026-05-16 (90 days)
