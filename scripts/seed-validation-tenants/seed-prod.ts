// scripts/seed-validation-tenants/seed-prod.ts
// Entry point for seeding PROD validation tenants.
//
// Usage:
//   npx tsx scripts/seed-validation-tenants/seed-prod.ts
//   # or
//   npm run db:seed:validation:prod

process.env.SEED_ENV = 'prod';
import './seed-validation-tenants';
