const fs = require('fs');

const inputFile = 'prisma/migrations/20251014075000_baseline_completion/migration.sql';
const outputFile = 'prisma/migrations/20251014075000_baseline_completion/migration.sql';

const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split('\n');

const header = [];
const enumDrops = [];
const enums = [];
const tables = [];
const indexes = [];
const foreignKeys = [];
const other = [];

let currentSection = header;
let inDOBlock = false;
let doBlockLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Header (everything before first DO block or CREATE)
  if (currentSection === header) {
    if (line.startsWith('DO $$') || line.startsWith('-- CreateEnum') || line.startsWith('-- CreateTable')) {
      currentSection = null;
    } else {
      header.push(line);
      continue;
    }
  }

  // Track DO blocks
  if (line.startsWith('DO $$')) {
    inDOBlock = true;
    doBlockLines = [line];
    continue;
  }

  if (inDOBlock) {
    doBlockLines.push(line);
    if (line.startsWith('END $$;')) {
      inDOBlock = false;
      // Check what this DO block contains
      const blockContent = doBlockLines.join('\n');
      if (blockContent.includes('DROP TYPE') && blockContent.includes('Registry')) {
        enumDrops.push(...doBlockLines);
        enumDrops.push('');
      } else if (blockContent.includes('CREATE TYPE')) {
        enums.push(...doBlockLines);
        enums.push('');
      } else if (blockContent.includes('CREATE TABLE')) {
        tables.push(...doBlockLines);
        tables.push('');
      } else {
        other.push(...doBlockLines);
        other.push('');
      }
      doBlockLines = [];
    }
    continue;
  }

  // Categorize other statements
  if (line.startsWith('-- CreateEnum')) {
    currentSection = enums;
  } else if (line.match(/CREATE.*INDEX/)) {
    indexes.push(line);
    continue;
  } else if (line.startsWith('ALTER TABLE') && line.includes('ADD CONSTRAINT') && line.includes('FOREIGN KEY')) {
    foreignKeys.push(line);
    continue;
  } else if (line.startsWith('-- CreateIndex') || line.startsWith('-- AddForeignKey')) {
    // Skip comment lines for now
    continue;
  } else if (line.trim() === '') {
    // Skip empty lines (we'll add them back)
    continue;
  } else if (currentSection) {
    currentSection.push(line);
  } else {
    other.push(line);
  }
}

// Build output in correct order
const output = [
  ...header,
  ...enumDrops,
  '-- Enums',
  ...enums,
  '',
  '-- Tables',
  ...tables,
  '',
  '-- Indexes',
  ...indexes,
  '',
  '-- Foreign Keys',
  ...foreignKeys,
  '',
  ...other
];

fs.writeFileSync(outputFile, output.join('\n'));
console.log(`Reorganized migration:`);
console.log(`  Header: ${header.length} lines`);
console.log(`  Enum drops: ${enumDrops.length} lines`);
console.log(`  Enums: ${enums.length} lines`);
console.log(`  Tables: ${tables.length} lines`);
console.log(`  Indexes: ${indexes.length} lines`);
console.log(`  Foreign Keys: ${foreignKeys.length} lines`);
console.log(`  Other: ${other.length} lines`);
console.log(`  Total: ${output.length} lines`);
