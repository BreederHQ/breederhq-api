# ADR-0001: Use AWS Secrets Manager for Database Credentials

**Date**: 2026-02-03
**Status**: ✅ Accepted (Implemented in Production)
**Deciders**: Engineering Team
**Related**: [AWS Secrets Manager Operations Guide](../operations/AWS-SECRETS-MANAGER.md)

---

## Context

BreederHQ API currently stores sensitive database credentials (DATABASE_URL and DATABASE_DIRECT_URL) as environment variables in Render.com. This approach has several limitations:

1. **Security**: Credentials visible in Render UI to anyone with dashboard access
2. **Rotation**: Changing credentials requires updating env vars and redeploying
3. **Auditability**: No log of who accessed or changed credentials
4. **Centralization**: Each environment (dev, staging, prod) managed separately
5. **Secrets Sprawl**: Growing list of secrets (AWS S3, Stripe, Resend, etc.) all stored the same way

We needed a centralized secret management solution that addresses these concerns while maintaining simplicity for production deployment on Render.

---

## Decision

We will use **AWS Secrets Manager** to store production database credentials (DATABASE_URL and DATABASE_DIRECT_URL), starting with production environment only as a proof of concept.

**Implementation approach**:
- Store secrets as JSON bundle in single secret (`breederhq/prod`)
- Fetch secrets at application startup (cached for runtime)
- Use IAM user with minimal permissions (GetSecretValue only)
- Keep other secrets in Render env vars for now (incremental migration)
- Local development continues using `.env.dev` files

**Cost**: ~$0.45/month for production database credentials

---

## Alternatives Considered

### Option 1: Continue with Render Environment Variables

**Pros**:
- ✅ No additional cost
- ✅ No code changes required
- ✅ Simple mental model (all secrets in one place)
- ✅ Works with Render's deployment model

**Cons**:
- ❌ Credentials visible in dashboard UI
- ❌ No audit trail for access
- ❌ Difficult to rotate (requires redeploy)
- ❌ No centralized management across environments
- ❌ Risk of credential exposure in logs/screenshots

**Why not chosen**: Security and operational concerns outweigh simplicity benefits.

---

### Option 2: HashiCorp Vault

**Pros**:
- ✅ Industry-standard secret management
- ✅ Dynamic secrets (can rotate database passwords automatically)
- ✅ Rich feature set (encryption as a service, PKI, etc.)
- ✅ Works across cloud providers

**Cons**:
- ❌ Requires self-hosting (adds operational burden)
- ❌ Cost: ~$40-100/month for managed Vault (HCP Vault)
- ❌ Complexity: learning curve for team
- ❌ Overkill for current needs (just database credentials)

**Why not chosen**: Too complex and expensive for our current scale. We already use AWS for infrastructure.

---

### Option 3: Doppler or Similar SaaS Secret Management

**Pros**:
- ✅ Purpose-built for secret management
- ✅ Simple UI and CLI
- ✅ Multi-environment support
- ✅ Git-like workflow for secrets

**Cons**:
- ❌ Cost: $49-99/month for team plan
- ❌ Adds another vendor dependency
- ❌ Less control over access policies
- ❌ Not integrated with our existing AWS infrastructure

**Why not chosen**: Cost is higher than AWS Secrets Manager ($0.45/month vs $49/month), and we already use AWS.

---

### Option 4: AWS Parameter Store (instead of Secrets Manager)

**Pros**:
- ✅ Free for standard parameters
- ✅ Similar AWS integration to Secrets Manager
- ✅ Works with IAM policies

**Cons**:
- ❌ No automatic rotation support
- ❌ Limited to 10,000 parameters per region (unlikely to hit)
- ❌ No built-in secret versioning
- ❌ Less feature-rich than Secrets Manager

**Why not chosen**: Secrets Manager provides better features (rotation, versioning) for minimal cost ($0.40/month). Cost difference is negligible at our scale.

---

### Option 5: Render Secret Files

**Pros**:
- ✅ Native Render feature
- ✅ Files not visible in dashboard
- ✅ No external dependencies

**Cons**:
- ❌ Still requires secrets to be uploaded to Render
- ❌ No audit trail
- ❌ Difficult to share across services
- ❌ No programmatic access for developers
- ❌ Limited Render documentation/support

**Why not chosen**: Doesn't solve centralization problem and lacks tooling for rotation.

---

## Rationale

**Why AWS Secrets Manager**:

1. **Cost-effective**: At $0.40/month per secret + $0.05 per 10,000 API calls, this is negligible compared to alternatives
2. **Already on AWS**: We use AWS for S3 storage, and this integrates seamlessly
3. **Minimal code changes**: Single module (`src/config/secrets.ts`) handles all secret fetching
4. **Easy rollback**: Emergency mode can fall back to env vars in minutes
5. **Incremental migration**: Prove concept with database credentials, expand to other secrets later
6. **Render compatibility**: Works with Render's deployment model (just needs AWS IAM credentials in env vars)
7. **Future-proof**: Supports automatic rotation, multiple environments, and more secrets as we grow

**Trade-offs accepted**:
- Still requires IAM access keys in Render env vars (can't avoid this with programmatic access)
- Adds AWS dependency (but we already use AWS for S3)
- Slight increase in startup time (~5 seconds to fetch secrets, but cached thereafter)

---

## Consequences

### Positive

- ✅ **Improved security**: Database credentials no longer visible in Render UI
- ✅ **Audit trail**: CloudTrail logs show who accessed secrets (if enabled)
- ✅ **Easy rotation**: Change secrets in AWS, restart service (no code changes)
- ✅ **Centralized management**: Single location for production database credentials
- ✅ **Cost-effective**: Minimal cost (~$0.45/month)
- ✅ **Future scalability**: Can add dev/staging secrets, other secret types

### Negative

- ❌ **New dependency**: Application now depends on AWS Secrets Manager availability
- ❌ **Startup latency**: ~5 seconds added to cold starts (negligible for web server)
- ❌ **Operational complexity**: New system to learn and manage
- ❌ **IAM keys still in Render**: Can't eliminate all secrets from Render env vars

### Neutral

- ⚪ **AWS lock-in**: Using AWS-specific service (but we already use AWS for S3)
- ⚪ **Team learning**: Engineers need to learn AWS Secrets Manager CLI/API
- ⚪ **Emergency mode**: Fallback to env vars requires manual intervention

---

## Implementation Notes

### Rollout Strategy

**Phase 1: Proof of Concept (✅ Complete)**
- Production database credentials only
- Manual setup with PowerShell scripts
- Emergency fallback to env vars

**Phase 2: Expansion (Future)**
- Add remaining secrets (COOKIE_SECRET, AWS S3 keys, Stripe, Resend)
- Create dev/sandbox/staging secrets
- Developer workflow for local access

**Phase 3: Automation (Future)**
- Automatic credential rotation
- CloudWatch alerts for failures
- Terraform/IaC for secret management

### Gotchas

1. **JSON formatting**: Secret value must be valid JSON with quoted keys/values
   - Use ordered hashtables in PowerShell to avoid issues
   - UTF-8 encoding without BOM required

2. **Preflight script**: Must skip DATABASE_URL validation when AWS vars present
   - Added `skipIf` condition to preflight-env.js

3. **Top-level await**: Requires ES2022 target in tsconfig.json
   - Already configured in our project

4. **Emergency fallback**: Keep DATABASE_URL in Render env vars initially (for rollback)
   - Can remove after confidence period (30-90 days)

---

## Metrics for Success

**Measured after 90 days**:
- ✅ Zero production incidents related to AWS Secrets Manager
- ✅ Database credentials rotated at least once without downtime
- ✅ Cost remains under $1/month
- ✅ Team comfortable with AWS Secrets Manager workflow

**If successful, proceed with Phase 2** (migrate remaining secrets)

---

## Rollback Procedure

If AWS Secrets Manager proves problematic:

1. Add `DATABASE_URL` and `DATABASE_DIRECT_URL` back to Render env vars
2. Remove AWS environment variables from Render
3. Deploy (application will use env vars instead)
4. Document reasons for rollback
5. Consider alternative secret management solutions

**Time to rollback**: ~3-5 minutes

---

## Related Documentation

- **[AWS Secrets Manager Operations Guide](../operations/AWS-SECRETS-MANAGER.md)** - Day-to-day operations
- **[Setup Script](../../setup-secrets-manager.ps1)** - Initial infrastructure setup
- **[Get Credentials Script](../../get-render-credentials.ps1)** - IAM key management
- **[src/config/secrets.ts](../../src/config/secrets.ts)** - Implementation

---

**ADR Version**: 1.0
**Next Review**: 2026-05-03 (90 days after implementation)
