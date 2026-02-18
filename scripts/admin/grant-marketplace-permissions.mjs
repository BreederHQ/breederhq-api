#!/usr/bin/env node
/**
 * grant-marketplace-permissions.mjs
 *
 * Grants bhq_app full access to the marketplace schema on a NeonDB branch.
 *
 * MUST run AFTER the baseline migration has been applied, because the baseline
 * migration creates the marketplace schema and its tables.
 *
 * Usage:
 *   NEON_API_KEY=napi_xxx node scripts/admin/grant-marketplace-permissions.mjs --env=dev
 *   NEON_API_KEY=napi_xxx node scripts/admin/grant-marketplace-permissions.mjs --env=production
 *
 * Options:
 *   --env=<name>   Required. Target environment (dev|alpha|bravo|production)
 *   --dry-run      Print what would be done, but make no changes
 */

const NEON_API = 'https://console.neon.tech/api/v2';
const API_KEY = process.env.NEON_API_KEY;
const DB_NAME = 'neondb';

const TARGETS = {
  dev: {
    label: '🟡 DEV (breederhq-development/dev)',
    projectId: 'polished-fire-14346254',
    branchId: 'br-curly-mouse-ajq9pzwc',
  },
  alpha: {
    label: '🟡 ALPHA (breederhq-development/alpha)',
    projectId: 'polished-fire-14346254',
    branchId: 'br-wild-star-aja5kimd',
  },
  bravo: {
    label: '🟡 BRAVO (breederhq-development/bravo)',
    projectId: 'polished-fire-14346254',
    branchId: 'br-withered-hill-ajps3qs4',
  },
  production: {
    label: '🔴 PRODUCTION (breederhq-production/production)',
    projectId: 'flat-flower-54202261',
    branchId: 'br-small-cake-aj8ncvav',
  },
};

// ── Marketplace grant SQL ──────────────────────────────────────────────────
//
// Split into two passes (same pattern as provision-neon-roles.mjs):
//   Pass A (neondb_owner): schema usage + table/sequence grants
//   Pass B (bhq_migrator): ALTER DEFAULT PRIVILEGES (must run as the role itself)

const MARKETPLACE_SQL_AS_OWNER = `
GRANT USAGE ON SCHEMA marketplace TO bhq_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA marketplace TO bhq_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA marketplace TO bhq_app;
`.trim();

const MARKETPLACE_SQL_AS_MIGRATOR = `
ALTER DEFAULT PRIVILEGES IN SCHEMA marketplace GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bhq_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA marketplace GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO bhq_app;
`.trim();

async function neonRequest(method, path, body) {
  const res = await fetch(`${NEON_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Neon API ${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function runSQL(projectId, branchId, sql, roleName = 'neondb_owner') {
  return neonRequest('POST', `/projects/${projectId}/query`, {
    query: sql,
    db_name: DB_NAME,
    branch_id: branchId,
    role_name: roleName,
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const envArg = args.find(a => a.startsWith('--env='))?.split('=')[1];

  if (!API_KEY) {
    console.error('❌  NEON_API_KEY environment variable is required');
    process.exit(1);
  }

  if (!envArg || !TARGETS[envArg]) {
    console.error(`❌  --env is required. Valid values: ${Object.keys(TARGETS).join(', ')}`);
    process.exit(1);
  }

  const { label, projectId, branchId } = TARGETS[envArg];

  console.log(`\nMarketplace Permission Grant`);
  console.log(`Target: ${label}`);
  console.log(`${'─'.repeat(60)}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Would apply:\n');
    console.log(MARKETPLACE_SQL.split('\n').map(l => '  ' + l).join('\n'));
    console.log('\n[DRY RUN] No changes made.');
    return;
  }

  if (envArg === 'production') {
    console.log('\n⚠️  WARNING: Applying grants to PRODUCTION. Ctrl+C within 5s to abort...\n');
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log('\nApplying marketplace grants...');

  process.stdout.write('  Schema usage + table grants (as neondb_owner)...');
  const resultA = await runSQL(projectId, branchId, MARKETPLACE_SQL_AS_OWNER, 'neondb_owner');
  if (!resultA.success) {
    console.error('\n✗ Grant (owner) failed:', JSON.stringify(resultA, null, 2));
    process.exit(1);
  }
  console.log(' ✓');

  process.stdout.write('  Default privileges (as bhq_migrator)...');
  const resultB = await runSQL(projectId, branchId, MARKETPLACE_SQL_AS_MIGRATOR, 'bhq_migrator');
  if (!resultB.success) {
    console.error('\n✗ Grant (migrator) failed:', JSON.stringify(resultB, null, 2));
    process.exit(1);
  }
  console.log(' ✓\n');
  console.log('✓ Marketplace schema grants applied successfully.');
  console.log('  bhq_app now has SELECT/INSERT/UPDATE/DELETE on all marketplace tables.');
  console.log('  Future tables created by bhq_migrator will automatically inherit these grants.\n');
}

main().catch(err => {
  console.error('\n❌  Fatal:', err.message);
  process.exit(1);
});
