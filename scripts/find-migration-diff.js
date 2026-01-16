import fs from 'fs';
import crypto from 'crypto';

// Current file content
const currentContent = fs.readFileSync('prisma/migrations/20260117000000_add_mare_reproductive_history/migration.sql', 'utf8');

// Try to find what the original was by removing possible changes
// Common changes: extra newlines, whitespace, etc.

const variations = [
  currentContent,
  currentContent.replace(/\r\n/g, '\n'), // Windows to Unix line endings
  currentContent.replace(/\n/g, '\r\n'), // Unix to Windows line endings
  currentContent.trim() + '\n', // Ensure single trailing newline
  currentContent.replace(/\n\n/g, '\n'), // Remove double newlines
];

console.log('Testing variations to find original:');
console.log('Expected checksum:', 'a03e301853ac8d9f976bcdb5c83c0254f6ef9b79282a1674af1229a87e4aa20b');
console.log('Current checksum: ', crypto.createHash('sha256').update(currentContent).digest('hex'));
console.log('');

for (let i = 0; i < variations.length; i++) {
  const hash = crypto.createHash('sha256').update(variations[i]).digest('hex');
  if (hash === 'a03e301853ac8d9f976bcdb5c83c0254f6ef9b79282a1674af1229a87e4aa20b') {
    console.log(`✓ MATCH FOUND - Variation ${i}:`);
    console.log('Description:', ['original', 'unix-line-endings', 'windows-line-endings', 'trim-newline', 'no-double-newlines'][i]);
    process.exit(0);
  }
}

console.log('No match found. Showing file info:');
console.log('Length:', currentContent.length);
console.log('Has CR:', currentContent.includes('\r'));
console.log('Trailing newlines:', currentContent.match(/\n+$/)?.[0].length || 0);
