const fs = require('fs');

const inputFile = '.tmp/baseline-repair-idempotent-v2.sql';
const outputFile = 'prisma/migrations/20251014075000_baseline_completion/migration.sql';

const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split('\n');
const output = [];

output.push(`-- Baseline Completion Migration
-- This migration completes the incomplete baseline 20251014074658
-- It creates all missing schema objects that subsequent migrations expect
--
-- Fully idempotent: safe to run on shadow DB (fresh replay) or live databases
-- Uses DO blocks for all CREATE TABLE to avoid conflicts with earlier migrations

`);

let i = 0;
let inTable = false;
let tableBuffer = [];
let tableName = '';

while (i < lines.length) {
  const line = lines[i];

  // Detect CREATE TABLE
  if (line.match(/^CREATE TABLE/)) {
    const match = line.match(/CREATE TABLE\s+"?([^"\s(]+)"?\s*\(/);
    if (match) {
      tableName = match[1];
      inTable = true;
      tableBuffer = [line];
      i++;
      continue;
    }
  }

  // If we're collecting a table definition
  if (inTable) {
    tableBuffer.push(line);

    // End of table definition (closing paren + semicolon)
    if (line.trim() === ');') {
      // Wrap table creation in DO block
      output.push(`DO $$`);
      output.push(`BEGIN`);
      output.push(`  IF NOT EXISTS (`);
      output.push(`    SELECT 1 FROM pg_tables`);
      output.push(`    WHERE schemaname = 'public' AND tablename = '${tableName}'`);
      output.push(`  ) THEN`);

      // Indent table DDL
      for (const tline of tableBuffer) {
        output.push(`    ${tline}`);
      }

      output.push(`  END IF;`);
      output.push(`END $$;`);
      output.push('');

      inTable = false;
      tableBuffer = [];
      tableName = '';
      i++;
      continue;
    }

    i++;
    continue;
  }

  // Pass through everything else
  output.push(line);
  i++;
}

fs.writeFileSync(outputFile, output.join('\n'));
console.log(`Created fully idempotent migration: ${outputFile}`);
console.log(`Lines: ${output.length}`);
