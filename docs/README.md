# BreederHQ API Documentation

**Repository**: breederhq-api
**Purpose**: Production-ready RESTful API for BreederHQ platform
**Stack**: Node.js, TypeScript, Prisma, PostgreSQL (NeonDB)
**Deployment**: Render.com / AWS Elastic Beanstalk

---

## Quick Links

### Operations
- **[AWS Secrets Manager](operations/AWS-SECRETS-MANAGER.md)** - Managing all application secrets via AWS Secrets Manager (16 keys, 4 environments)
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

ALL application secrets are stored in **AWS Secrets Manager** across two AWS accounts (prod + dev).

- **Trigger**: Set `USE_SECRETS_MANAGER=true` to enable (any environment)
- **What's in AWS**: 16 keys per environment (database, Stripe, Resend, JWT, S3, Firebase, Sentry)
- **Environments**: production (prod account), dev/alpha/bravo (dev account)
- **NeonDB Projects**: breederhq-production, breederhq-development (3 branches)
- **How it works**: `getAppSecrets()` fetches all secrets at startup, merges into `process.env`

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

### Update a Secret Value

```bash
# See full guide for updating individual keys within a secret
```

**Full guide**: [AWS Secrets Manager - Update a Single Key](operations/AWS-SECRETS-MANAGER.md#update-a-single-key-in-a-secret)

### Update Database Connection Strings

**Full guide**: [AWS Secrets Manager - Update Database Connection Strings](operations/AWS-SECRETS-MANAGER.md#update-database-connection-strings)

### Rotate IAM Access Keys

**Full guide**: [AWS Secrets Manager - Rotate IAM Access Keys](operations/AWS-SECRETS-MANAGER.md#rotate-iam-access-keys)

### Troubleshooting Production Issues

1. Check deployment logs for secret fetch status (`✓ 17 secrets loaded`)
2. Verify AWS credentials / instance role
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

**Last Updated**: 2026-02-16
**Maintained By**: Engineering Team
