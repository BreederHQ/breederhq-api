const fs = require('fs');

const inputFile = 'prisma/migrations/20251014075000_baseline_completion/migration.sql';
const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split('\n');

const output = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i];

  // Detect FK statement
  if (line.startsWith('ALTER TABLE') && line.includes('ADD CONSTRAINT') && line.includes('FOREIGN KEY')) {
    // Extract constraint name
    const match = line.match(/ADD CONSTRAINT "([^"]+)"/);
    if (match) {
      const constraintName = match[1];

      // Wrap in DO block
      output.push('DO $$');
      output.push('BEGIN');
      output.push(`  IF NOT EXISTS (`);
      output.push(`    SELECT 1 FROM pg_constraint WHERE conname = '${constraintName}'`);
      output.push(`  ) THEN`);
      output.push(`    ${line}`);
      output.push(`  END IF;`);
      output.push('END $$;');
      output.push('');
    } else {
      output.push(line);
    }
  } else {
    output.push(line);
  }

  i++;
}

fs.writeFileSync(inputFile, output.join('\n'));
console.log(`Wrapped ${output.filter(l => l.includes('pg_constraint')).length} foreign keys in DO blocks`);
