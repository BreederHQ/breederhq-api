// scripts/seed-validation-tenants/seed-prod.ts
// Entry point for seeding PROD validation tenants.
//
// Usage:
//   npx tsx scripts/seed-validation-tenants/seed-prod.ts
//   # or
//   npm run db:seed:validation:prod

// Set environment BEFORE importing (using dynamic import to avoid ESM hoisting)
process.env.SEED_ENV = 'prod';

// Use dynamic import to ensure SEED_ENV is set before the module loads
import('./seed-validation-tenants.js');
