import crypto from 'crypto';
import fs from 'fs';

const migrationPath = 'prisma/migrations/20260117000000_add_mare_reproductive_history/migration.sql';
const content = fs.readFileSync(migrationPath, 'utf8');
const hash = crypto.createHash('sha256').update(content).digest('hex');

console.log('Current file checksum:', hash);
console.log('Expected checksum:   ', 'a03e301853ac8d9f976bcdb5c83c0254f6ef9b79282a1674af1229a87e4aa20b');
console.log('Match:', hash === 'a03e301853ac8d9f976bcdb5c83c0254f6ef9b79282a1674af1229a87e4aa20b');
