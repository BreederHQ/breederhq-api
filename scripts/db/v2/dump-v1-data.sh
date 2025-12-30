#!/usr/bin/env bash
#
# dump-v1-data.sh - Export data-only dump from v1 database snapshot
#
# Usage:
#   SOURCE_URL="postgresql://..." ./dump-v1-data.sh [output_file]
#
# Inputs:
#   SOURCE_URL env var - Connection string to v1 snapshot database (required)
#   output_file arg    - Output file path (default: ./tmp/v1_data.sql)
#
# This script performs a data-only pg_dump with triggers disabled.
# It does NOT include schema, ownership, or ACLs.
#

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Fail fast if SOURCE_URL is missing
# ─────────────────────────────────────────────────────────────────────────────
if [[ -z "${SOURCE_URL:-}" ]]; then
  echo "ERROR: SOURCE_URL environment variable is required" >&2
  echo "Set it to the v1 snapshot direct connection URL" >&2
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Parse arguments
# ─────────────────────────────────────────────────────────────────────────────
OUT_FILE="${1:-./tmp/v1_data.sql}"
OUT_DIR=$(dirname "$OUT_FILE")

# ─────────────────────────────────────────────────────────────────────────────
# Ensure output directory exists
# ─────────────────────────────────────────────────────────────────────────────
mkdir -p "$OUT_DIR"

# ─────────────────────────────────────────────────────────────────────────────
# Log status (no secrets)
# ─────────────────────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "dump-v1-data.sh - Data-only export from v1 snapshot"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SOURCE_URL: [REDACTED]"
echo "  Output:     $OUT_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Run pg_dump
# ─────────────────────────────────────────────────────────────────────────────
echo "Starting pg_dump (data-only)..."

pg_dump \
  --data-only \
  --disable-triggers \
  --no-owner \
  --no-acl \
  --dbname "$SOURCE_URL" \
  --file "$OUT_FILE"

# ─────────────────────────────────────────────────────────────────────────────
# Verify output
# ─────────────────────────────────────────────────────────────────────────────
if [[ ! -f "$OUT_FILE" ]]; then
  echo "ERROR: pg_dump completed but output file not found: $OUT_FILE" >&2
  exit 1
fi

FILE_SIZE=$(stat -c%s "$OUT_FILE" 2>/dev/null || stat -f%z "$OUT_FILE" 2>/dev/null || echo "unknown")
echo ""
echo "pg_dump completed successfully"
echo "  Output file: $OUT_FILE"
echo "  File size:   $FILE_SIZE bytes"
echo ""
