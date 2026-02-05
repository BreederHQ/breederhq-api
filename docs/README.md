# BreederHQ API Documentation

**Repository**: breederhq-api
**Purpose**: Production-ready RESTful API for BreederHQ platform
**Stack**: Node.js, TypeScript, Prisma, PostgreSQL (NeonDB)
**Deployment**: Render.com

---

## Quick Links

### Operations
- **[AWS Secrets Manager](operations/AWS-SECRETS-MANAGER.md)** - Managing production database credentials

### Architecture Decisions
- **[ADR-0001: AWS Secrets Manager](architecture-decisions/0001-AWS-SECRETS-MANAGER.md)** - Why we use AWS for secret management

---

## Directory Structure

```
docs/
├── README.md (this file)
├── operations/
│   └── AWS-SECRETS-MANAGER.md          # Day-to-day secret management
└── architecture-decisions/
    └── 0001-AWS-SECRETS-MANAGER.md     # Decision rationale
```

---

## Key Concepts

### Secret Management

Production database credentials are stored in **AWS Secrets Manager**, not environment variables.

- **What's in AWS**: Database connection strings (DATABASE_URL, DATABASE_DIRECT_URL)
- **What's in Render**: Other secrets (COOKIE_SECRET, AWS S3 keys, Stripe, etc.)
- **How it works**: Application fetches secrets from AWS at startup (production only)

**See**: [AWS Secrets Manager Operations Guide](operations/AWS-SECRETS-MANAGER.md)

### Local Development

Local development uses `.env.dev` files (not AWS Secrets Manager).

```bash
# Copy example environment file
cp .env.example .env.dev

# Add your local database URL
# DATABASE_URL=postgresql://localhost:5432/breederhq_dev
```

---

## Common Tasks

### Update Production Database Credentials

```bash
# Update secret in AWS
aws secretsmanager update-secret \
  --secret-id breederhq/prod \
  --secret-string '{"DATABASE_URL":"...","DATABASE_DIRECT_URL":"..."}' \
  --profile prod \
  --region us-east-2

# Restart Render service to pick up new credentials
```

**Full guide**: [AWS Secrets Manager - Update Database Credentials](operations/AWS-SECRETS-MANAGER.md#update-database-credentials)

### Rotate IAM Access Keys

```bash
# Use helper script
./get-render-credentials.ps1

# Or manually:
aws iam create-access-key \
  --user-name breederhq-api-render-prod \
  --profile prod
```

**Full guide**: [AWS Secrets Manager - Rotate IAM Access Keys](operations/AWS-SECRETS-MANAGER.md#rotate-iam-access-keys)

### Troubleshooting Production Issues

1. Check Render logs for secret fetch status
2. Verify AWS credentials in Render env vars
3. Test AWS access with CLI

**Full guide**: [AWS Secrets Manager - Troubleshooting](operations/AWS-SECRETS-MANAGER.md#troubleshooting)

---

## Contributing

When adding new documentation:

1. **Operations guides**: `docs/operations/[TOPIC].md`
2. **Architecture decisions**: `docs/architecture-decisions/[NNNN-DECISION].md`
3. **Update this README** with links to new documents

---

## Related Documentation

### In This Repository

- **[Setup Script](../setup-secrets-manager.ps1)** - Initial AWS infrastructure setup
- **[Get Credentials Script](../get-render-credentials.ps1)** - Generate new IAM access keys

### External Resources

- **[AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)**
- **[Render Environment Variables](https://render.com/docs/environment-variables)**
- **[Prisma Documentation](https://www.prisma.io/docs)**

---

**Last Updated**: 2026-02-03
**Maintained By**: Engineering Team
