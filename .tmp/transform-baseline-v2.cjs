const fs = require('fs');

const inputFile = '.tmp/baseline-repair.sql';
const outputFile = '.tmp/baseline-repair-idempotent-v2.sql';

// List of enums already created by the incomplete baseline
// These should NOT be recreated
const BASELINE_ENUMS = new Set([
  'AnimalStatus',
  'MembershipRole',
  'OwnerPartyType',
  'Sex',
  'ShareScope',
  'ShareStatus',
  'Species',
  'TagModule',
  'TenantRole',
  'VerificationPurpose'
]);

const content = fs.readFileSync(inputFile, 'utf8');
const output = [];

output.push(`-- Baseline Repair Migration (Part 2 of 2)
-- This migration completes the incomplete baseline migration 20251014074658.
-- The baseline created only enums. This migration creates all tables, indexes, and remaining schema objects.
--
-- This migration is designed to work ONLY after the incomplete baseline has been applied.
-- It does NOT need to be idempotent against the full history - only against the baseline.

`);

const lines = content.split('\n');
let i = 0;

while (i < lines.length) {
    const line = lines[i];

    // Handle enum creation - skip enums that baseline already created
    if (line.trim() === '-- CreateEnum') {
        i++;
        if (i < lines.length) {
            const createLine = lines[i];
            const match = createLine.match(/CREATE TYPE "([^"]+)" AS ENUM \((.*)\);/);
            if (match) {
                const enumName = match[1];
                const enumValues = match[2];

                // Skip enums that the baseline already created
                if (BASELINE_ENUMS.has(enumName)) {
                    console.log(`Skipping enum ${enumName} (already in baseline)`);
                    i++;
                    continue;
                }

                // Create new enums (not in baseline) with idempotent check
                output.push(`-- CreateEnum ${enumName}`);
                output.push('DO $$');
                output.push('BEGIN');
                output.push(`  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${enumName}') THEN`);
                output.push(`    CREATE TYPE "${enumName}" AS ENUM (${enumValues});`);
                output.push('  END IF;');
                output.push('END $$;');
                output.push('');
                i++;
                continue;
            }
        }
    }

    // Handle table creation - just pass through without IF NOT EXISTS
    // The baseline didn't create ANY tables, so we can create them all
    else if (line.trim() === '-- CreateTable') {
        output.push(line);
        i++;
        continue;
    }

    // Handle index creation - pass through without IF NOT EXISTS
    else if (line.trim() === '-- CreateIndex') {
        output.push(line);
        i++;
        continue;
    }

    // Skip extension creation (baseline has citext already)
    else if (line.trim().startsWith('CREATE EXTENSION')) {
        console.log('Skipping extension creation (already handled)');
        i++;
        continue;
    }

    // Pass through everything else
    else {
        output.push(line);
        i++;
    }
}

fs.writeFileSync(outputFile, output.join('\n'));
console.log(`\nTransformation complete: ${outputFile}`);
console.log(`Lines: ${output.length}`);
