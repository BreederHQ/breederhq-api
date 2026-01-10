// scripts/seed-validation-tenants/seed-dev.ts
// Entry point for seeding DEV validation tenants.
//
// Usage:
//   npx tsx scripts/seed-validation-tenants/seed-dev.ts
//   # or
//   npm run db:seed:validation:dev

// Set environment BEFORE importing (using dynamic import to avoid ESM hoisting)
process.env.SEED_ENV = 'dev';

// Use dynamic import to ensure SEED_ENV is set before the module loads
import('./seed-validation-tenants.js');
