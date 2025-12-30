#!/usr/bin/env bash
#
# import-v1-data.sh - Import data-only dump into v2 database
#
# Usage:
#   TARGET_URL="postgresql://..." ./import-v1-data.sh [input_file]
#
# Inputs:
#   TARGET_URL env var - Connection string to v2 database (required)
#   input_file arg     - Input file path (default: ./tmp/v1_data.sql)
#
# This script imports data using psql with ON_ERROR_STOP=1.
# The v2 schema must already be applied before running this.
#

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Fail fast if TARGET_URL is missing
# ─────────────────────────────────────────────────────────────────────────────
if [[ -z "${TARGET_URL:-}" ]]; then
  echo "ERROR: TARGET_URL environment variable is required" >&2
  echo "Set it to the v2 database direct connection URL" >&2
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Parse arguments
# ─────────────────────────────────────────────────────────────────────────────
IN_FILE="${1:-./tmp/v1_data.sql}"

# ─────────────────────────────────────────────────────────────────────────────
# Verify input file exists
# ─────────────────────────────────────────────────────────────────────────────
if [[ ! -f "$IN_FILE" ]]; then
  echo "ERROR: Input file not found: $IN_FILE" >&2
  echo "Run dump-v1-data.sh first to create the dump file" >&2
  exit 1
fi

FILE_SIZE=$(stat -c%s "$IN_FILE" 2>/dev/null || stat -f%z "$IN_FILE" 2>/dev/null || echo "unknown")

# ─────────────────────────────────────────────────────────────────────────────
# Log status (no secrets)
# ─────────────────────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "import-v1-data.sh - Import data into v2 database"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  TARGET_URL: [REDACTED]"
echo "  Input:      $IN_FILE"
echo "  File size:  $FILE_SIZE bytes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Run psql import
# ─────────────────────────────────────────────────────────────────────────────
echo "Starting psql import (ON_ERROR_STOP=1)..."
echo "This will fail immediately on any constraint violation."
echo ""

psql "$TARGET_URL" -v ON_ERROR_STOP=1 -f "$IN_FILE"

echo ""
echo "Import completed successfully"
echo ""
