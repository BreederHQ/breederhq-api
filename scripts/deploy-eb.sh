#!/usr/bin/env bash
set -euo pipefail

# Deploy breederhq-api to Elastic Beanstalk
# Usage: scripts/deploy-eb.sh [env]
#   env — environment name (default: dev). Also used as AWS profile: bhq-<env>

ENV="${1:-dev}"
PROFILE="bhq-${ENV}"
REGION="us-east-2"
APP_NAME="breederhq-api"
EB_APP="${APP_NAME}-${ENV}"
EB_ENV="${APP_NAME}-${ENV}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
VERSION_LABEL="${ENV}-${TIMESTAMP}"
ZIP_FILE="deploy-${VERSION_LABEL}.zip"

# Resolve the account ID for the S3 bucket name
ACCOUNT_ID=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)
BUCKET="${APP_NAME}-${ENV}-versions-${ACCOUNT_ID}"

echo "==> Deploying ${APP_NAME} to ${EB_ENV}"
echo "    Profile:  ${PROFILE}"
echo "    Bucket:   ${BUCKET}"
echo "    Version:  ${VERSION_LABEL}"
echo ""

# 1. Build
echo "==> Building TypeScript..."
npm run build

# 2. Bundle
echo "==> Creating deployment bundle..."
zip -r "$ZIP_FILE" \
  dist/ \
  package.json \
  package-lock.json \
  prisma/schema.prisma \
  prisma/migrations/ \
  scripts/development/preflight-env.js \
  .npmrc \
  -x "node_modules/*"

# 3. Upload to S3
echo "==> Uploading to S3..."
aws s3 cp "$ZIP_FILE" "s3://${BUCKET}/${ZIP_FILE}" --profile "$PROFILE" --region "$REGION"

# 4. Create application version
echo "==> Creating application version..."
aws elasticbeanstalk create-application-version \
  --application-name "$EB_APP" \
  --version-label "$VERSION_LABEL" \
  --source-bundle "S3Bucket=${BUCKET},S3Key=${ZIP_FILE}" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --no-cli-pager

# 5. Deploy
echo "==> Updating environment..."
aws elasticbeanstalk update-environment \
  --environment-name "$EB_ENV" \
  --version-label "$VERSION_LABEL" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --no-cli-pager

# 6. Clean up
echo "==> Cleaning up local zip..."
rm -f "$ZIP_FILE"

echo ""
echo "==> Deployment initiated! Version: ${VERSION_LABEL}"
echo "    Monitor: aws elasticbeanstalk describe-environments --environment-names ${EB_ENV} --profile ${PROFILE} --region ${REGION} --query 'Environments[0].{Status:Status,Health:Health}'"
