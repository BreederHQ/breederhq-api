// scripts/seed-validation-tenants/print-credentials.ts
// Prints credentials summary for all validation tenants.
// Use this to copy credentials to your password vault.
//
// Usage:
//   npx tsx scripts/seed-validation-tenants/print-credentials.ts
//   npx tsx scripts/seed-validation-tenants/print-credentials.ts dev
//   npx tsx scripts/seed-validation-tenants/print-credentials.ts prod

import { generateCredentialsSummary, Environment } from './seed-data-config';

const env: Environment = (process.argv[2]?.toLowerCase() as Environment) || 'dev';

if (env !== 'dev' && env !== 'prod') {
  console.error('Usage: npx tsx print-credentials.ts [dev|prod]');
  process.exit(1);
}

console.log(generateCredentialsSummary(env));
