const fs = require('fs');

const inputFile = '.tmp/baseline-repair.sql';
const outputFile = '.tmp/baseline-repair-idempotent.sql';

const content = fs.readFileSync(inputFile, 'utf8');
const output = [];

output.push(`-- Baseline Repair Migration
-- This migration creates the full schema from scratch in an idempotent way.
-- It can run on empty databases or databases that already have the schema.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS citext;

`);

const lines = content.split('\n');
let i = 0;

while (i < lines.length) {
    const line = lines[i];

    // Handle enum creation
    if (line.trim() === '-- CreateEnum') {
        i++;
        if (i < lines.length) {
            const createLine = lines[i];
            const match = createLine.match(/CREATE TYPE "([^"]+)" AS ENUM \((.*)\);/);
            if (match) {
                const enumName = match[1];
                const enumValues = match[2];
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

    // Handle table creation
    else if (line.trim() === '-- CreateTable') {
        output.push(line);
        i++;
        if (i < lines.length) {
            let createLine = lines[i];
            if (createLine.startsWith('CREATE TABLE ')) {
                createLine = createLine.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ');
            }
            output.push(createLine);
            i++;
            continue;
        }
    }

    // Handle index creation
    else if (line.trim() === '-- CreateIndex') {
        output.push(line);
        i++;
        if (i < lines.length) {
            let createLine = lines[i];
            if (createLine.includes('CREATE INDEX ') || createLine.includes('CREATE UNIQUE INDEX ')) {
                createLine = createLine.replace(/CREATE (UNIQUE )?INDEX /, 'CREATE $1INDEX IF NOT EXISTS ');
            }
            output.push(createLine);
            i++;
            continue;
        }
    }

    // Handle extension creation
    else if (line.trim().startsWith('CREATE EXTENSION ')) {
        const newLine = line.replace('CREATE EXTENSION ', 'CREATE EXTENSION IF NOT EXISTS ');
        output.push(newLine);
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
console.log(`Transformation complete: ${outputFile}`);
console.log(`Lines: ${output.length}`);
