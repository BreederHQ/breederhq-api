#!/usr/bin/env python3
import re

input_file = "/tmp/baseline-repair.sql"
output_file = "/tmp/baseline-repair-idempotent.sql"

with open(input_file, 'r') as f:
    content = f.read()

output = []
output.append("""-- Baseline Repair Migration
-- This migration creates the full schema from scratch in an idempotent way.
-- It can run on empty databases or databases that already have the schema.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS citext;

""")

lines = content.split('\n')
i = 0
while i < len(lines):
    line = lines[i]

    # Handle enum creation
    if line.strip() == '-- CreateEnum':
        i += 1
        if i < len(lines):
            create_line = lines[i]
            # Extract enum name and values
            match = re.match(r'CREATE TYPE "([^"]+)" AS ENUM \((.*)\);', create_line)
            if match:
                enum_name = match.group(1)
                enum_values = match.group(2)
                output.append(f"-- CreateEnum {enum_name}")
                output.append("DO $$")
                output.append("BEGIN")
                output.append(f"  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{enum_name}') THEN")
                output.append(f'    CREATE TYPE "{enum_name}" AS ENUM ({enum_values});')
                output.append("  END IF;")
                output.append("END $$;")
                output.append("")
                i += 1
                continue

    # Handle table creation
    elif line.strip() == '-- CreateTable':
        output.append(line)
        i += 1
        if i < len(lines):
            create_line = lines[i]
            if create_line.startswith('CREATE TABLE '):
                create_line = create_line.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ')
            output.append(create_line)
            i += 1
            continue

    # Handle index creation
    elif line.strip() == '-- CreateIndex':
        output.append(line)
        i += 1
        if i < len(lines):
            create_line = lines[i]
            if 'CREATE INDEX ' in create_line or 'CREATE UNIQUE INDEX ' in create_line:
                create_line = re.sub(r'CREATE (UNIQUE )?INDEX ', r'CREATE \1INDEX IF NOT EXISTS ', create_line)
            output.append(create_line)
            i += 1
            continue

    # Handle extension creation
    elif line.strip().startswith('CREATE EXTENSION '):
        line = line.replace('CREATE EXTENSION ', 'CREATE EXTENSION IF NOT EXISTS ')
        output.append(line)
        i += 1
        continue

    # Pass through everything else
    else:
        output.append(line)
        i += 1

# Write output
with open(output_file, 'w') as f:
    f.write('\n'.join(output))

print(f"Transformation complete: {output_file}")
print(f"Lines: {len(output)}")
