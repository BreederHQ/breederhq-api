// scripts/seed-validation-tenants/seed-dev.ts
// Entry point for seeding DEV validation tenants.
//
// Usage:
//   npx tsx scripts/seed-validation-tenants/seed-dev.ts
//   # or
//   npm run db:seed:validation:dev

process.env.SEED_ENV = 'dev';
import './seed-validation-tenants';
