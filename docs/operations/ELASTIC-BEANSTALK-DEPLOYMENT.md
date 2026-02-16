# Elastic Beanstalk Deployment

**Date**: 2026-02-15
**Status**: Available (dev environment)
**Region**: us-east-2
**Script**: [scripts/deploy-eb.sh](../../scripts/deploy-eb.sh)

---

## Overview

BreederHQ API can be deployed to AWS Elastic Beanstalk as an alternative to Render.com. The deploy script handles building, bundling, uploading, and deploying in a single command.

---

## Prerequisites

### AWS CLI & Profiles

The deploy script uses named AWS profiles in the format `bhq-{env}`:

```bash
# Configure AWS profile for dev
aws configure --profile bhq-dev
# Set: Access Key ID, Secret Access Key, Region (us-east-2)

# Configure AWS profile for production
aws configure --profile bhq-prod
```

### AWS Resources (per environment)

Each environment requires these AWS resources to be provisioned:

| Resource | Naming Convention | Purpose |
|----------|-------------------|---------|
| EB Application | `breederhq-api-{env}` | Elastic Beanstalk application |
| EB Environment | `breederhq-api-{env}` | Running environment |
| S3 Bucket | `breederhq-api-{env}-versions-{account-id}` | Stores deployment bundles |

### Local Tools

- AWS CLI v2 installed and configured
- `zip` command available (Git Bash on Windows includes this)
- Node.js and npm (for the build step)

---

## Usage

```bash
# Deploy to dev (default)
bash scripts/deploy-eb.sh

# Deploy to staging
bash scripts/deploy-eb.sh staging

# Deploy to production
bash scripts/deploy-eb.sh prod
```

### What the script does

1. **Build** — Runs `npm run build` to compile TypeScript to `dist/`
2. **Bundle** — Creates a zip with `dist/`, `package.json`, `package-lock.json`, Prisma files, preflight script, and `.npmrc` (excludes `node_modules/`)
3. **Upload** — Pushes the zip to the environment's S3 version bucket
4. **Create version** — Registers the zip as an EB application version
5. **Deploy** — Updates the EB environment to the new version
6. **Cleanup** — Removes the local zip file

### Version labeling

Versions are labeled as `{env}-{YYYYMMDD-HHMMSS}`, e.g., `dev-20260215-143022`.

---

## Monitoring a Deployment

After running the script, monitor the deployment:

```bash
# Check environment status and health
aws elasticbeanstalk describe-environments \
  --environment-names breederhq-api-dev \
  --profile bhq-dev \
  --region us-east-2 \
  --query 'Environments[0].{Status:Status,Health:Health,VersionLabel:VersionLabel}'

# View recent events (deploy progress)
aws elasticbeanstalk describe-events \
  --environment-name breederhq-api-dev \
  --profile bhq-dev \
  --region us-east-2 \
  --max-items 10
```

**Healthy deployment**: Status = `Ready`, Health = `Green`

---

## Environment Variables

EB environments need these environment variables configured (via EB console or `.ebextensions`):

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production`, `staging`, or `development` |
| `USE_SECRETS_MANAGER` | Yes | Set to `true` to load secrets from AWS Secrets Manager |
| `AWS_REGION` | Yes | `us-east-2` |
| `AWS_SECRET_NAME` | No | Override default secret name (defaults to `breederhq-api/${NODE_ENV}`) |
| `STRIPE_SECRET_KEY` | Yes | Stripe API key (or include in Secrets Manager bundle) |
| `RESEND_API_KEY` | Yes | Email service API key |

**Note**: On EB with instance roles, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are not needed — the EC2 instance role provides credentials for Secrets Manager access automatically.

---

## Relationship to Render.com

The platform currently deploys to **Render.com** for production. Elastic Beanstalk is being evaluated as a deployment target. Both deployment methods are supported concurrently:

| Aspect | Render.com | Elastic Beanstalk |
|--------|-----------|-------------------|
| Deployment | Auto-deploy on git push | Manual via `deploy-eb.sh` |
| Secrets | Render env vars + Secrets Manager | EB env vars + Secrets Manager |
| Scaling | Render manages | EB auto-scaling configurable |
| Cost model | Per-service pricing | EC2 instance pricing |

---

## Troubleshooting

### "Access Denied" on S3 upload

The AWS profile doesn't have permission to write to the S3 bucket.

```bash
# Verify your identity
aws sts get-caller-identity --profile bhq-dev

# Check bucket exists
aws s3 ls s3://breederhq-api-dev-versions-{account-id} --profile bhq-dev --region us-east-2
```

### Deployment stuck in "Updating"

```bash
# Check events for errors
aws elasticbeanstalk describe-events \
  --environment-name breederhq-api-dev \
  --profile bhq-dev \
  --region us-east-2 \
  --max-items 20

# If stuck, abort the update
aws elasticbeanstalk abort-environment-update \
  --environment-name breederhq-api-dev \
  --profile bhq-dev \
  --region us-east-2
```

### Application crashes after deploy

Check EB logs:

```bash
aws elasticbeanstalk request-environment-info \
  --environment-name breederhq-api-dev \
  --info-type tail \
  --profile bhq-dev \
  --region us-east-2

# Wait a moment, then retrieve
aws elasticbeanstalk retrieve-environment-info \
  --environment-name breederhq-api-dev \
  --info-type tail \
  --profile bhq-dev \
  --region us-east-2
```

Common causes:
- Missing environment variables (check EB configuration)
- Secrets Manager access denied (check instance role or IAM credentials)
- Node.js version mismatch (check EB platform version)

### Rollback to previous version

```bash
# List recent versions
aws elasticbeanstalk describe-application-versions \
  --application-name breederhq-api-dev \
  --profile bhq-dev \
  --region us-east-2 \
  --max-items 5 \
  --query 'ApplicationVersions[].VersionLabel'

# Deploy a previous version
aws elasticbeanstalk update-environment \
  --environment-name breederhq-api-dev \
  --version-label "dev-20260214-120000" \
  --profile bhq-dev \
  --region us-east-2
```

---

## Related Documentation

- **[AWS Secrets Manager](AWS-SECRETS-MANAGER.md)** — Secret management (used by EB environments)
- **[ADR-0001: AWS Secrets Manager](../architecture-decisions/0001-AWS-SECRETS-MANAGER.md)** — Why we use Secrets Manager
- **[Deploy Script](../../scripts/deploy-eb.sh)** — The deployment script source

---

**Document Version**: 1.0
**Maintained By**: Engineering Team
**Last Updated**: 2026-02-15
