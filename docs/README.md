# BreederHQ API Documentation

**Repository**: breederhq-api
**Purpose**: Production-ready RESTful API for BreederHQ platform
**Stack**: Node.js, TypeScript, Prisma, PostgreSQL (NeonDB)
**Deployment**: Render.com / AWS Elastic Beanstalk

---

## Quick Links

### Operations
- **[AWS Secrets Manager](operations/AWS-SECRETS-MANAGER.md)** - Managing database credentials via AWS Secrets Manager
- **[Elastic Beanstalk Deployment](operations/ELASTIC-BEANSTALK-DEPLOYMENT.md)** - Deploying to AWS Elastic Beanstalk
- **[Sentry Setup](operations/SENTRY-SETUP.md)** - Error tracking and performance monitoring

### Architecture Decisions
- **[ADR-0001: AWS Secrets Manager](architecture-decisions/0001-AWS-SECRETS-MANAGER.md)** - Why we use AWS for secret management
- **[ADR-0002: Lazy Stripe Initialization](architecture-decisions/0002-LAZY-STRIPE-INITIALIZATION.md)** - Why Stripe uses lazy singleton pattern (`getStripe()`)

---

## Directory Structure

```
docs/
├── README.md (this file)
├── operations/
│   ├── AWS-SECRETS-MANAGER.md          # Day-to-day secret management
│   ├── ELASTIC-BEANSTALK-DEPLOYMENT.md # EB deployment guide
│   └── SENTRY-SETUP.md                 # Error tracking and APM
└── architecture-decisions/
    ├── 0001-AWS-SECRETS-MANAGER.md     # Decision rationale
    └── 0002-LAZY-STRIPE-INITIALIZATION.md  # Stripe lazy singleton pattern
```

---

## Key Concepts

### Secret Management

Production database credentials are stored in **AWS Secrets Manager**, not environment variables.

- **Trigger**: Set `USE_SECRETS_MANAGER=true` to enable (any environment)
- **What's in AWS**: Database connection strings (DATABASE_URL, DATABASE_DIRECT_URL), COOKIE_SECRET
- **What's in hosting env vars**: AWS S3 keys, Stripe keys, etc.
- **How it works**: Application fetches secrets from AWS at startup when `USE_SECRETS_MANAGER=true`

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

**Last Updated**: 2026-02-15
**Maintained By**: Engineering Team
