# AWS Secrets Manager Integration

**Date**: 2026-02-03
**Status**: ✅ Active (Production)
**Environment**: Production only
**Cost**: $0.40/month per secret
**Related**: [Setup Script](../../setup-secrets-manager.ps1)

---

## Overview

BreederHQ API production database credentials are stored in AWS Secrets Manager instead of environment variables. This provides centralized secret management, audit logging, and easier rotation.

**What's in Secrets Manager**: Database connection strings (DATABASE_URL, DATABASE_DIRECT_URL)
**What's still in Render**: All other secrets (COOKIE_SECRET, AWS S3 keys, Stripe keys, etc.)

---

## Architecture

### How It Works

```
[Render Startup]
     ↓
[preflight-env.js] → Skips DATABASE_URL check if AWS vars present
     ↓
[src/prisma.ts] → Calls getDatabaseSecrets() (production only)
     ↓
[src/config/secrets.ts] → Fetches from AWS Secrets Manager
     ↓
[Merges into process.env]
     ↓
[Prisma Client initialized with DATABASE_URL from AWS]
```

### Files Involved

- **[src/config/secrets.ts](../../src/config/secrets.ts)** - Fetches secrets from AWS
- **[src/prisma.ts](../../src/prisma.ts)** - Calls `getDatabaseSecrets()` before Prisma init
- **[scripts/development/preflight-env.js](../../scripts/development/preflight-env.js)** - Skips DATABASE_URL validation when AWS vars present

---

## AWS Resources

### IAM User
- **Name**: `breederhq-api-render-prod`
- **Type**: Programmatic access only (no console)
- **Policy**: `breederhq-prod-db-secrets-read`
- **Permissions**: `secretsmanager:GetSecretValue` on `breederhq/prod` secret

### Secret
- **Name**: `breederhq/prod`
- **Region**: `us-east-2`
- **Type**: JSON bundle
- **Contains**: `DATABASE_URL`, `DATABASE_DIRECT_URL`

### Environment Variables (Render)
- `AWS_ACCESS_KEY_ID` - Access key for `breederhq-api-render-prod` IAM user
- `AWS_SECRET_ACCESS_KEY` - Secret key for IAM user
- `AWS_REGION` - `us-east-2`
- `AWS_SECRET_NAME` - `breederhq/prod`

---

## Common Operations

### View Current Secret

```bash
aws secretsmanager get-secret-value \
  --secret-id breederhq/prod \
  --profile prod \
  --region us-east-2 \
  --query SecretString \
  --output text
```

### Update Database Credentials

**When**: After changing NeonDB password or connection string

```bash
# 1. Update the secret
aws secretsmanager update-secret \
  --secret-id breederhq/prod \
  --secret-string '{"DATABASE_URL":"postgresql://...","DATABASE_DIRECT_URL":"postgresql://..."}' \
  --profile prod \
  --region us-east-2

# 2. Verify update
aws secretsmanager get-secret-value \
  --secret-id breederhq/prod \
  --profile prod \
  --region us-east-2

# 3. Restart Render service (or trigger deploy)
# Application will fetch new credentials on startup
```

**Important**: Ensure JSON is properly formatted with quotes around keys and values.

### Rotate IAM Access Keys

**When**: Every 90 days or if keys are compromised

```bash
# 1. Create new access keys
aws iam create-access-key \
  --user-name breederhq-api-render-prod \
  --profile prod \
  --region us-east-2

# 2. Update Render environment variables
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY

# 3. Deploy or restart service

# 4. Verify new keys work (check logs for "Database secrets loaded")

# 5. Delete old access keys
aws iam delete-access-key \
  --user-name breederhq-api-render-prod \
  --access-key-id <OLD_KEY_ID> \
  --profile prod \
  --region us-east-2
```

**Script**: Use [get-render-credentials.ps1](../../get-render-credentials.ps1) to generate new keys.

### Add Additional Secrets

**To add more secrets to the bundle** (e.g., COOKIE_SECRET, AWS S3 keys):

```bash
# 1. Get current secret
aws secretsmanager get-secret-value \
  --secret-id breederhq/prod \
  --profile prod \
  --region us-east-2 \
  --query SecretString \
  --output text > current-secret.json

# 2. Edit current-secret.json to add new keys
# {
#   "DATABASE_URL": "...",
#   "DATABASE_DIRECT_URL": "...",
#   "COOKIE_SECRET": "...",
#   "AWS_ACCESS_KEY_ID": "...",
#   "AWS_SECRET_ACCESS_KEY": "..."
# }

# 3. Update secret
aws secretsmanager update-secret \
  --secret-id breederhq/prod \
  --secret-string file://current-secret.json \
  --profile prod \
  --region us-east-2

# 4. Update code to use new secrets (instead of process.env)
# 5. Deploy and verify

# 6. Remove secrets from Render env vars (once verified)
```

---

## Troubleshooting

### Symptom: Application fails to start with "DATABASE_URL missing"

**Possible causes**:
1. AWS credentials not set in Render
2. IAM policy doesn't allow GetSecretValue
3. Secret doesn't exist or wrong name
4. Region mismatch

**Check Render logs for**:
```
ℹ️  Skipping DATABASE_URL check (will be fetched from AWS Secrets Manager)
Fetching database secrets from AWS Secrets Manager: breederhq/prod
✓ Database secrets loaded from AWS Secrets Manager
```

**If you don't see these logs**:
- Check Render env vars: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_SECRET_NAME`
- Verify IAM user has correct policy attached
- Test access with AWS CLI

### Symptom: "JSON parse error" on startup

**Cause**: Secret contains malformed JSON (missing quotes)

**Fix**:
```bash
# 1. View current secret
aws secretsmanager get-secret-value \
  --secret-id breederhq/prod \
  --profile prod \
  --region us-east-2

# 2. If JSON is malformed, update it
aws secretsmanager update-secret \
  --secret-id breederhq/prod \
  --secret-string '{"DATABASE_URL":"...","DATABASE_DIRECT_URL":"..."}' \
  --profile prod \
  --region us-east-2

# 3. Restart Render service
```

### Symptom: "Access Denied" error

**Cause**: IAM user doesn't have permission to read secret

**Fix**:
```bash
# 1. Check IAM policy is attached
aws iam list-attached-user-policies \
  --user-name breederhq-api-render-prod \
  --profile prod \
  --region us-east-2

# 2. Verify policy allows GetSecretValue on correct resource
aws iam get-policy \
  --policy-arn arn:aws:iam::427814061976:policy/breederhq-prod-db-secrets-read \
  --profile prod \
  --region us-east-2

# 3. If policy missing, reattach:
aws iam attach-user-policy \
  --user-name breederhq-api-render-prod \
  --policy-arn arn:aws:iam::427814061976:policy/breederhq-prod-db-secrets-read \
  --profile prod \
  --region us-east-2
```

---

## Emergency Rollback

**If AWS Secrets Manager is down or inaccessible:**

### Option 1: Emergency Mode (if DATABASE_URL still in Render)

1. Set `EMERGENCY_MODE=true` in Render env vars
2. Ensure `DATABASE_URL` exists in Render env vars
3. Restart service
4. Application will use DATABASE_URL from env vars instead

### Option 2: Full Rollback (remove AWS integration)

1. Add `DATABASE_URL` and `DATABASE_DIRECT_URL` back to Render env vars
2. Remove AWS environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_SECRET_NAME`)
3. Deploy
4. Application will use DATABASE_URL from env vars (preflight script won't skip check)

**Time to rollback**: ~3-5 minutes

---

## Cost Breakdown

| Resource | Cost |
|----------|------|
| Secret storage (1 secret) | $0.40/month |
| API calls (10,000 per month) | $0.05/month |
| **Total** | **~$0.45/month** |

**Note**: Production startup fetches secret once per deploy. With ~10 deploys/month, this is negligible cost.

---

## Security Notes

### What's Protected

✅ Database credentials not exposed in Render UI
✅ Audit log of secret access via CloudTrail (if enabled)
✅ Centralized rotation without code changes
✅ IAM access keys rotatable independently

### What's Not Protected (Yet)

⚠️ Other secrets still in Render env vars (COOKIE_SECRET, AWS S3 keys, Stripe keys)
⚠️ IAM access keys still in Render env vars (needed for AWS API calls)
⚠️ No automatic rotation configured

### Future Improvements

- [ ] Migrate remaining secrets to Secrets Manager
- [ ] Enable automatic rotation for database credentials
- [ ] Set up CloudWatch alerts for secret fetch failures
- [ ] Create dev/staging secrets for non-prod environments

---

## Local Development

**Local development does NOT use AWS Secrets Manager.**

In development mode (`NODE_ENV !== "production"`):
- `getDatabaseSecrets()` returns empty object
- Application uses `DATABASE_URL` from `.env.dev` file
- No AWS credentials needed for local development

**To test Secrets Manager integration locally**:

```bash
# Set environment variables
$env:NODE_ENV="production"
$env:AWS_PROFILE="prod"  # Or use AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
$env:AWS_SECRET_NAME="breederhq/prod"
$env:AWS_REGION="us-east-2"

# Run server
npm run dev

# Should see: "✓ Database secrets loaded from AWS Secrets Manager"
```

---

## Related Documentation

- **[Setup Script](../../setup-secrets-manager.ps1)** - Initial AWS infrastructure setup
- **[Get Credentials Script](../../get-render-credentials.ps1)** - Generate new IAM access keys
- **[Architecture Decision](../architecture-decisions/0001-AWS-SECRETS-MANAGER.md)** - Why we chose this approach
- **[src/config/secrets.ts](../../src/config/secrets.ts)** - Implementation code

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-03 | Initial production deployment (database credentials only) |

---

**Document Version**: 1.0
**Maintained By**: Engineering Team
**Last Updated**: 2026-02-03
**Next Review**: 2026-05-03 (90 days)
