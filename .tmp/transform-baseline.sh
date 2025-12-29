#!/bin/bash
# Transform Prisma-generated SQL to idempotent PostgreSQL

input="/tmp/baseline-repair.sql"
output="/tmp/baseline-repair-idempotent.sql"

# Start with header
cat > "$output" <<'HEADER'
-- Baseline Repair Migration
-- This migration creates the full schema from scratch in an idempotent way.
-- It can run on empty databases or databases that already have the schema.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS citext;

HEADER

# Process the file
awk '
BEGIN {
    in_enum = 0
    enum_name = ""
    enum_values = ""
}

# Handle CreateEnum comments
/^-- CreateEnum$/ {
    in_enum = 1
    next
}

# Handle enum creation
in_enum == 1 && /^CREATE TYPE/ {
    match($0, /"([^"]+)"/, arr)
    enum_name = arr[1]
    match($0, /AS ENUM \((.*)\);/, arr)
    enum_values = arr[1]

    print "-- CreateEnum " enum_name
    print "DO $$"
    print "BEGIN"
    print "  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '\''" enum_name "'\'') THEN"
    print "    CREATE TYPE \"" enum_name "\" AS ENUM (" enum_values ");"
    print "  END IF;"
    print "END $$;"
    print ""

    in_enum = 0
    next
}

# Handle table creation - make idempotent
/^-- CreateTable$/ {
    print $0
    getline
    gsub(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS ")
    print
    next
}

# Handle index creation - make idempotent
/^-- CreateIndex$/ {
    print $0
    getline
    gsub(/^CREATE (UNIQUE )?INDEX /, "CREATE \\1INDEX IF NOT EXISTS ")
    print
    next
}

# Handle extension creation
/^-- CreateExtension$/ {
    print $0
    getline
    gsub(/^CREATE EXTENSION /, "CREATE EXTENSION IF NOT EXISTS ")
    print
    next
}

# Skip empty CreateEnum headers that were already processed
/^-- CreateEnum$/ && in_enum == 1 {
    next
}

# Pass through everything else
{
    if (in_enum == 0) {
        print
    }
}
' "$input" >> "$output"

echo "Transformation complete: $output"
wc -l "$output"
