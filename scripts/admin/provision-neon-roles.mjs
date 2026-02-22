#!/usr/bin/env node
/**
 * provision-neon-roles.mjs
 *
 * Creates bhq_migrator and bhq_app roles on all new NeonDB project branches,
 * applies bootstrap SQL grants (extensions + public schema permissions),
 * and outputs the DATABASE_URL / DATABASE_DIRECT_URL connection strings for
 * each environment's AWS Secrets Manager secret.
 *
 * Usage:
 *   NEON_API_KEY=napi_xxx node scripts/admin/provision-neon-roles.mjs
 *   NEON_API_KEY=napi_xxx node scripts/admin/provision-neon-roles.mjs --dry-run
 *   NEON_API_KEY=napi_xxx node scripts/admin/provision-neon-roles.mjs --env=dev
 *
 * Options:
 *   --dry-run          Print what would be done, but make no changes
 *   --env=<name>       Only provision a specific environment (dev|alpha|bravo|production)
 *
 * After running this script:
 *   1. Add the outputted DATABASE_URL / DATABASE_DIRECT_URL to each AWS SM secret
 *   2. Apply the baseline migration: npm run db:dev:sync  (or db:prod:deploy for prod)
 *   3. Run: node scripts/admin/grant-marketplace-permissions.mjs --env=<name>
 */

const NEON_API = 'https://console.neon.tech/api/v2';
const API_KEY = process.env.NEON_API_KEY;
const DB_NAME = 'neondb';

// ── Target environments ────────────────────────────────────────────────────

const TARGETS = [
  {
    env: 'dev',
    label: '🟡 DEV (breederhq-development/dev)',
    projectId: 'polished-fire-14346254',
    branchId: 'br-curly-mouse-ajq9pzwc',
    endpointId: 'ep-odd-bonus-ajoxp70y',
    proxyHost: 'c-3.us-east-2.aws.neon.tech',
    awsSecret: 'breederhq-api/dev',
  },
  {
    env: 'alpha',
    label: '🟡 ALPHA (breederhq-development/alpha)',
    projectId: 'polished-fire-14346254',
    branchId: 'br-wild-star-aja5kimd',
    endpointId: 'ep-twilight-sea-ajba9zqt',
    proxyHost: 'c-3.us-east-2.aws.neon.tech',
    awsSecret: 'breederhq-api/alpha',
  },
  {
    env: 'bravo',
    label: '🟡 BRAVO (breederhq-development/bravo)',
    projectId: 'polished-fire-14346254',
    branchId: 'br-withered-hill-ajps3qs4',
    endpointId: 'ep-young-river-ajc7oseh',
    proxyHost: 'c-3.us-east-2.aws.neon.tech',
    awsSecret: 'breederhq-api/bravo',
  },
  {
    env: 'production',
    label: '🔴 PRODUCTION (breederhq-production/production)',
    projectId: 'flat-flower-54202261',
    branchId: 'br-small-cake-aj8ncvav',
    endpointId: 'ep-orange-smoke-aj3kv9vw',
    proxyHost: 'c-3.us-east-2.aws.neon.tech',
    awsSecret: 'breederhq-api/production',
  },
];

// ── Bootstrap SQL ──────────────────────────────────────────────────────────
//
// Split into two steps with different roles:
//   STEP_A — run as neondb_owner (superuser): extensions + grants
//   STEP_B — run as bhq_migrator itself: ALTER DEFAULT PRIVILEGES
//
// ALTER DEFAULT PRIVILEGES FOR ROLE X can only be executed by X itself in Neon
// (neondb_owner is not a full PG superuser for this operation).
//
// The marketplace schema grants are intentionally NOT here — they must run
// AFTER the baseline migration creates the marketplace schema.
// See: scripts/admin/grant-marketplace-permissions.mjs

const BOOTSTRAP_SQL_AS_OWNER = `
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
GRANT USAGE, CREATE ON SCHEMA public TO bhq_migrator;
GRANT USAGE ON SCHEMA public TO bhq_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bhq_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO bhq_app;
`.trim();

// Must run as bhq_migrator — sets what happens when it creates future objects
const BOOTSTRAP_SQL_AS_MIGRATOR = `
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bhq_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO bhq_app;
`.trim();

// ── Neon API helpers ───────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function neonRequest(method, path, body, retries = 6) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(`${NEON_API}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();

    if (res.status === 423) {
      // Conflicting operation in progress — wait and retry
      const delay = attempt * 2000;
      process.stdout.write(` [locked, retry ${attempt}/${retries} in ${delay/1000}s]`);
      await sleep(delay);
      continue;
    }

    if (!res.ok) {
      throw new Error(`Neon API ${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
    }
    return data;
  }
  throw new Error(`Neon API ${method} ${path} → still locked after ${retries} retries`);
}

async function listRoles(projectId, branchId) {
  const data = await neonRequest('GET', `/projects/${projectId}/branches/${branchId}/roles`);
  return data.roles.map(r => r.name);
}

async function createRole(projectId, branchId, roleName) {
  const data = await neonRequest('POST', `/projects/${projectId}/branches/${branchId}/roles`, {
    role: { name: roleName },
  });
  return data.role;
}

async function getRolePassword(projectId, branchId, roleName) {
  const data = await neonRequest('GET', `/projects/${projectId}/branches/${branchId}/roles/${roleName}/reveal_password`);
  return data.password;
}

async function runSQL(projectId, branchId, sql, roleName = 'neondb_owner') {
  return neonRequest('POST', `/projects/${projectId}/query`, {
    query: sql,
    db_name: DB_NAME,
    branch_id: branchId,
    role_name: roleName,
  });
}

// ── Connection string builders ─────────────────────────────────────────────

function buildPoolerUrl(roleName, password, endpointId, proxyHost) {
  const host = `${endpointId}-pooler.${proxyHost}`;
  return `postgresql://${roleName}:${encodeURIComponent(password)}@${host}/${DB_NAME}?sslmode=require`;
}

function buildDirectUrl(roleName, password, endpointId, proxyHost) {
  const host = `${endpointId}.${proxyHost}`;
  return `postgresql://${roleName}:${encodeURIComponent(password)}@${host}/${DB_NAME}?sslmode=require`;
}

// ── Per-target provisioning ────────────────────────────────────────────────

async function provisionTarget(target, { dryRun }) {
  const { env, label, projectId, branchId, endpointId, proxyHost, awsSecret } = target;

  console.log(`\n${'═'.repeat(68)}`);
  console.log(label);
  console.log(`${'═'.repeat(68)}`);

  // 1. Check / create roles
  console.log('\n[1/3] Checking roles...');
  const existing = await listRoles(projectId, branchId);
  console.log(`  Existing: ${existing.join(', ')}`);

  const toCreate = ['bhq_migrator', 'bhq_app'].filter(r => !existing.includes(r));
  if (toCreate.length === 0) {
    console.log('  ✓ Both roles already exist');
  } else {
    for (const roleName of toCreate) {
      if (dryRun) {
        console.log(`  [DRY RUN] Would create role: ${roleName}`);
      } else {
        process.stdout.write(`  Creating ${roleName}...`);
        await createRole(projectId, branchId, roleName);
        console.log(' ✓');
        // Brief pause so Neon completes the operation before the next request
        await sleep(1500);
      }
    }
  }

  // 2. Apply bootstrap SQL (two passes with different roles)
  console.log('\n[2/3] Applying bootstrap SQL...');
  if (dryRun) {
    console.log('  [DRY RUN] Would apply extensions + public schema grants (as neondb_owner)');
    console.log('  [DRY RUN] Would set default privileges (as bhq_migrator)');
  } else {
    // Pass A: extensions + grants — run as neondb_owner
    process.stdout.write('  Installing extensions + applying grants (as neondb_owner)...');
    const resultA = await runSQL(projectId, branchId, BOOTSTRAP_SQL_AS_OWNER, 'neondb_owner');
    if (!resultA.success) {
      throw new Error(`Bootstrap SQL (owner) failed for ${env}: ${JSON.stringify(resultA)}`);
    }
    console.log(' ✓');

    // Pass B: default privileges — must run as bhq_migrator
    process.stdout.write('  Setting default privileges (as bhq_migrator)...');
    const resultB = await runSQL(projectId, branchId, BOOTSTRAP_SQL_AS_MIGRATOR, 'bhq_migrator');
    if (!resultB.success) {
      throw new Error(`Bootstrap SQL (migrator) failed for ${env}: ${JSON.stringify(resultB)}`);
    }
    console.log(' ✓');
  }

  // 3. Retrieve passwords + build connection strings
  //
  // For SQL-created roles (CREATE ROLE ... PASSWORD '...'), Neon does not
  // manage the password — reveal_password only works for API/console-created
  // roles. In that case, supply passwords via env vars:
  //   MIGRATOR_PASS_DEV=xxx APP_PASS_DEV=yyy  (or ALPHA, BRAVO, PRODUCTION)
  console.log('\n[3/3] Retrieving passwords...');
  let migratorPass, appPass;
  if (dryRun) {
    migratorPass = '<bhq_migrator_password>';
    appPass = '<bhq_app_password>';
    console.log('  [DRY RUN] Would retrieve passwords for bhq_migrator and bhq_app');
  } else {
    const envKey = env.toUpperCase();
    const envMigratorPass = process.env[`MIGRATOR_PASS_${envKey}`];
    const envAppPass = process.env[`APP_PASS_${envKey}`];

    if (envMigratorPass && envAppPass) {
      migratorPass = envMigratorPass;
      appPass = envAppPass;
      console.log(`  ✓ Using passwords from MIGRATOR_PASS_${envKey} / APP_PASS_${envKey}`);
    } else {
      [migratorPass, appPass] = await Promise.all([
        getRolePassword(projectId, branchId, 'bhq_migrator'),
        getRolePassword(projectId, branchId, 'bhq_app'),
      ]);
      console.log('  ✓ Passwords retrieved via Neon API');
    }
  }

  const DATABASE_URL = buildPoolerUrl('bhq_app', appPass, endpointId, proxyHost);
  const DATABASE_DIRECT_URL = buildDirectUrl('bhq_migrator', migratorPass, endpointId, proxyHost);

  const box = '─'.repeat(68);
  console.log(`\n┌${box}┐`);
  console.log(`│  ADD TO AWS SM SECRET: ${awsSecret}`);
  console.log(`│${' '.repeat(68)}`);
  console.log(`│  DATABASE_URL`);
  console.log(`│  ${DATABASE_URL}`);
  console.log(`│${' '.repeat(68)}`);
  console.log(`│  DATABASE_DIRECT_URL`);
  console.log(`│  ${DATABASE_DIRECT_URL}`);
  console.log(`└${box}┘`);

  return { env, awsSecret, DATABASE_URL, DATABASE_DIRECT_URL };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const envFilter = args.find(a => a.startsWith('--env='))?.split('=')[1];

  if (!API_KEY) {
    console.error('❌  NEON_API_KEY environment variable is required');
    console.error('    Usage: NEON_API_KEY=napi_xxx node scripts/admin/provision-neon-roles.mjs');
    process.exit(1);
  }

  const targets = envFilter
    ? TARGETS.filter(t => t.env === envFilter)
    : TARGETS;

  if (targets.length === 0) {
    console.error(`❌  Unknown --env value: ${envFilter}`);
    console.error(`    Valid: ${TARGETS.map(t => t.env).join(', ')}`);
    process.exit(1);
  }

  const line = '═'.repeat(68);
  console.log(`╔${line}╗`);
  console.log('║  NeonDB Role Provisioning — BreederHQ                              ║');
  console.log(`╠${line}╣`);
  console.log(`║  Targets : ${targets.map(t => t.env).join(', ')}`);
  console.log(`║  Dry run : ${dryRun ? 'YES — no changes will be made' : 'NO  — changes WILL be applied'}`);
  console.log(`╚${line}╝`);

  if (!dryRun && targets.some(t => t.env === 'production')) {
    console.log('\n⚠️  WARNING: This will create roles on the PRODUCTION database.');
    console.log('   Press Ctrl+C within 5 seconds to abort...\n');
    await new Promise(r => setTimeout(r, 5000));
  }

  const results = [];
  for (const target of targets) {
    const result = await provisionTarget(target, { dryRun });
    results.push(result);
  }

  console.log(`\n${'═'.repeat(68)}`);
  console.log('DONE — Next Steps');
  console.log(`${'═'.repeat(68)}\n`);

  if (dryRun) {
    console.log('⚠️  DRY RUN complete — no changes were made.');
    console.log('   Re-run without --dry-run to apply.\n');
    return;
  }

  console.log('For each environment above:\n');
  console.log('  1. Copy DATABASE_URL + DATABASE_DIRECT_URL into the AWS SM secret');
  console.log('  2. Apply the baseline migration:');
  console.log('       dev/alpha/bravo : npm run db:dev:sync');
  console.log('       production      : npm run db:prod:deploy');
  console.log('  3. Apply marketplace schema grants (AFTER baseline migration):');
  results.forEach(r => {
    console.log(`       NEON_API_KEY=$NEON_API_KEY node scripts/admin/grant-marketplace-permissions.mjs --env=${r.env}`);
  });
  console.log('\n  ⚠️  The marketplace grant script must run AFTER the baseline');
  console.log('     migration, because it creates the marketplace schema.\n');
}

main().catch(err => {
  console.error('\n❌  Fatal:', err.message);
  process.exit(1);
});
