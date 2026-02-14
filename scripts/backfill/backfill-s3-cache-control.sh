#!/bin/bash
# backfill-s3-cache-control.sh
# Adds Cache-Control: public, max-age=31536000, immutable to all existing S3 objects.
# S3 keys use UUIDs, so URLs are immutable — aggressive caching is safe.
#
# Usage:
#   ./scripts/backfill/backfill-s3-cache-control.sh <profile> <bucket>
#
# Examples:
#   ./scripts/backfill/backfill-s3-cache-control.sh dev breederhq-assets-dev
#   ./scripts/backfill/backfill-s3-cache-control.sh dev breederhq-assets-alpha
#   ./scripts/backfill/backfill-s3-cache-control.sh dev breederhq-assets-beta
#   ./scripts/backfill/backfill-s3-cache-control.sh prod breederhq-assets-prod

set -euo pipefail

PROFILE="${1:?Usage: $0 <aws-profile> <bucket-name>}"
BUCKET="${2:?Usage: $0 <aws-profile> <bucket-name>}"
CACHE_CONTROL="public, max-age=31536000, immutable"

echo "=== S3 Cache-Control Backfill ==="
echo "Profile: $PROFILE"
echo "Bucket:  $BUCKET"
echo "Header:  Cache-Control: $CACHE_CONTROL"
echo ""

# List all objects in the bucket
echo "Listing objects in s3://$BUCKET ..."
OBJECTS=$(aws s3api list-objects-v2 \
  --bucket "$BUCKET" \
  --query "Contents[].Key" \
  --output text \
  --profile "$PROFILE" 2>&1)

if [ -z "$OBJECTS" ] || [ "$OBJECTS" = "None" ]; then
  echo "No objects found in bucket. Exiting."
  exit 0
fi

TOTAL=$(echo "$OBJECTS" | wc -w)
echo "Found $TOTAL objects."
echo ""

COUNT=0
UPDATED=0
SKIPPED=0

for KEY in $OBJECTS; do
  COUNT=$((COUNT + 1))

  # Check current Cache-Control header
  CURRENT_CC=$(aws s3api head-object \
    --bucket "$BUCKET" \
    --key "$KEY" \
    --query "CacheControl" \
    --output text \
    --profile "$PROFILE" 2>/dev/null || echo "None")

  if [ "$CURRENT_CC" != "None" ] && [ "$CURRENT_CC" != "null" ] && [ -n "$CURRENT_CC" ]; then
    echo "[$COUNT/$TOTAL] SKIP (already has Cache-Control): $KEY"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Detect content type from the object metadata
  CONTENT_TYPE=$(aws s3api head-object \
    --bucket "$BUCKET" \
    --key "$KEY" \
    --query "ContentType" \
    --output text \
    --profile "$PROFILE" 2>/dev/null || echo "application/octet-stream")

  # Copy object in-place with new Cache-Control metadata
  aws s3api copy-object \
    --bucket "$BUCKET" \
    --key "$KEY" \
    --copy-source "$BUCKET/$KEY" \
    --metadata-directive REPLACE \
    --content-type "$CONTENT_TYPE" \
    --cache-control "$CACHE_CONTROL" \
    --profile "$PROFILE" \
    > /dev/null 2>&1

  echo "[$COUNT/$TOTAL] UPDATED: $KEY"
  UPDATED=$((UPDATED + 1))
done

echo ""
echo "=== Done ==="
echo "Total:   $TOTAL"
echo "Updated: $UPDATED"
echo "Skipped: $SKIPPED"
