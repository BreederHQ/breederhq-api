# AWS Secrets Manager Integration

**Date**: 2026-02-03
**Updated**: 2026-02-16
**Status**: ✅ Active (All Environments)
**Cost**: ~$0.45/month per secret (~$1.80/month total for 4 environments)
**Related**: [ADR-0001](../architecture-decisions/0001-AWS-SECRETS-MANAGER.md)

---

## Overview

BreederHQ API stores ALL application secrets in AWS Secrets Manager across two AWS accounts. Each environment gets its own secret containing 16 keys.

**Trigger**: Set `USE_SECRETS_MANAGER=true` environment variable to enable (any environment).

**What's in Secrets Manager (16 keys per environment)**:

| Category | Keys |
|----------|------|
| Database | `DATABASE_URL` (pooled), `DATABASE_DIRECT_URL` (direct) |
| Session | `COOKIE_SECRET` |
| Email | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `INBOUND_EMAIL_HMAC_SECRET` |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Storage | `AWS_ACCESS_KEY_ID` (S3), `AWS_SECRET_ACCESS_KEY` (S3) |
| Mobile Auth | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` |
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

| Project | NeonDB Project ID | Branches | AWS Account |
|---------|-------------------|----------|-------------|
| `breederhq-production` | `flat-flower-54202261` | production | Prod |
| `breederhq-development` | `polished-fire-14346254` | dev, alpha, bravo | Dev |

### Secrets

| Secret Name | AWS Account | NeonDB Branch | Endpoint Prefix |
|-------------|-------------|---------------|-----------------|
| `breederhq-api/production` | Prod | production | `ep-orange-smoke-aj3kv9vw` |
| `breederhq-api/dev` | Dev | dev | `ep-odd-bonus-ajoxp70y` |
| `breederhq-api/alpha` | Dev | alpha | `ep-twilight-sea-ajba9zqt` |
| `breederhq-api/bravo` | Dev | bravo | `ep-young-river-ajc7oseh` |

### How It Works

```
[Application Startup]
     ↓
[preflight-env.js] → Skips secret checks if USE_SECRETS_MANAGER=true
     ↓
[src/prisma.ts] → If USE_SECRETS_MANAGER=true, calls getAppSecrets()
     ↓
[src/config/secrets.ts] → Fetches from AWS Secrets Manager
     │                      Secret name: AWS_SECRET_NAME or breederhq-api/${NODE_ENV}
     │                      Region: AWS_SECRETS_MANAGER_REGION or us-east-2
     ↓
[Object.assign(process.env, secrets)] → All 16 keys merged into process.env
     ↓
[Prisma Client, Stripe, Resend, S3, JWT all read from process.env]
```

### Files Involved

- **[src/config/secrets.ts](../../src/config/secrets.ts)** — `getAppSecrets()` fetches all secrets from AWS
- **[src/prisma.ts](../../src/prisma.ts)** — Calls `getAppSecrets()` before Prisma init, merges into process.env
- **[scripts/development/preflight-env.js](../../scripts/development/preflight-env.js)** — Skips validation when SM enabled

---

## IAM Resources

### Prod Account (427814061976)

**Policy**: `breederhq-api-prod-secrets-read`
- Allows: `secretsmanager:GetSecretValue`
- Resource: `arn:aws:secretsmanager:us-east-2:427814061976:secret:breederhq-api/production-*`

**Attached to users**: `breederhq-api-prod`, `breederhq-api-render-prod`

### Dev Account (335274136775)

**Policy**: `breederhq-api-dev-secrets-read`
- Allows: `secretsmanager:GetSecretValue`
- Resource: `arn:aws:secretsmanager:us-east-2:335274136775:secret:breederhq-api/*`

**Attached to users**: `breederhq-api-dev`, `breederhq-api-alpha`, `breederhq-api-beta`

### Environment Variables (EB / Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `USE_SECRETS_MANAGER` | Yes | Set to `"true"` to enable |
| `AWS_SECRET_NAME` | Recommended | Override default name (e.g., `breederhq-api/dev`) |
| `AWS_SECRETS_MANAGER_REGION` | No | Defaults to `us-east-2` |
| `AWS_ACCESS_KEY_ID` | On Render only | Not needed on EB (uses instance roles) |
| `AWS_SECRET_ACCESS_KEY` | On Render only | Not needed on EB (uses instance roles) |

**Note**: `AWS_SECRETS_MANAGER_REGION` is separate from `AWS_REGION` (which is used by S3, defaults to `us-east-1`).

---

## Common Operations

### View Secret Keys (without values)

```bash
# Production
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id breederhq-api/production \
  --profile prod --region us-east-2 \
  --query 'SecretString' --output text) && \
  node -e "console.log(JSON.stringify(Object.keys(JSON.parse(process.argv[1])),null,2))" "$SECRET"

# Dev
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id breederhq-api/dev \
  --profile dev --region us-east-2 \
  --query 'SecretString' --output text) && \
  node -e "console.log(JSON.stringify(Object.keys(JSON.parse(process.argv[1])),null,2))" "$SECRET"
```

### View Full Secret

```bash
aws secretsmanager get-secret-value \
  --secret-id breederhq-api/production \
  --profile prod --region us-east-2 \
  --query SecretString --output text
```

### Update a Single Key in a Secret

```bash
# 1. Get current secret
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id breederhq-api/production \
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
  --secret-id breederhq-api/production \
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
  --secret-id breederhq-api/production \
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
# 4. Verify (check logs for "✓ 16 secrets loaded")
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
Fetching app secrets from AWS Secrets Manager: breederhq-api/dev
✓ 16 secrets loaded from AWS Secrets Manager
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

1. Set all 16 secret values as individual env vars in hosting platform
2. Remove `USE_SECRETS_MANAGER` env var (or set to `false`)
3. Restart service
4. Application will use `.env` files / env vars

**Time to rollback**: ~5-10 minutes

---

## Cost Breakdown

| Resource | Cost |
|----------|------|
| Secret storage (4 secrets) | $1.60/month |
| API calls (~40/month, 10 per env) | $0.02/month |
| **Total** | **~$1.62/month** |

---

## Local Development

**Local development does NOT use AWS Secrets Manager by default.**

When `USE_SECRETS_MANAGER` is not set (or not `"true"`):
- `getAppSecrets()` returns empty object
- Application uses values from `.env.dev` file
- No AWS credentials needed

**To test Secrets Manager integration locally**:

```bash
# Bash
export USE_SECRETS_MANAGER=true
export AWS_PROFILE=dev
export AWS_SECRET_NAME=breederhq-api/dev
npm run dev

# Should see: "✓ 16 secrets loaded from AWS Secrets Manager"
```

```powershell
# PowerShell
$env:USE_SECRETS_MANAGER="true"
$env:AWS_PROFILE="dev"
$env:AWS_SECRET_NAME="breederhq-api/dev"
npm run dev
```

---

## Deprecated/Removed Secrets

| Secret | Account | Status | Removal Date |
|--------|---------|--------|--------------|
| `breederhq/prod` | Prod | Deprecated (marked) | Manual deletion pending |
| `breederhq-api/prod-prototype` | Prod | Backup of old prototype | Reference only |
| `breederhq/alpha` | Dev | Scheduled deletion | 2026-03-18 |
| `breederhq/beta` | Dev | Scheduled deletion | 2026-03-18 |
| `breederhq/rob` | Dev | Scheduled deletion | 2026-03-18 |

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
| 1.1 | 2026-02-15 | Trigger changed to `USE_SECRETS_MANAGER=true`; default name `breederhq-api/${NODE_ENV}` |
| 2.0 | 2026-02-16 | Phase 2: 16 keys per secret, 4 environments, 2 AWS accounts, new NeonDB projects, separate IAM policies, `getAppSecrets()` rename |

---

**Document Version**: 2.0
**Maintained By**: Engineering Team
**Last Updated**: 2026-02-16
**Next Review**: 2026-05-16 (90 days)
