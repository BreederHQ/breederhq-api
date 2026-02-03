#!/usr/bin/env node
/**
 * scripts/preflight-env.js
 *
 * Validates required environment variables before server boot.
 * Run automatically via npm scripts or manually with: node scripts/preflight-env.js
 *
 * Exit codes:
 *   0 = All checks passed
 *   1 = Missing or invalid required vars
 */

const REQUIRED_VARS = [
  {
    name: 'COOKIE_SECRET',
    minLength: 32,
    description: 'Session cookie signing secret',
    hint: 'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
  },
  {
    name: 'DATABASE_URL',
    minLength: 1,
    description: 'PostgreSQL connection string',
    hint: 'Set to your Neon pooler connection URL',
    // Skip check if using AWS Secrets Manager
    skipIf: () => process.env.AWS_SECRET_NAME && process.env.AWS_ACCESS_KEY_ID
  }
];

function checkEnv() {
  const errors = [];
  const warnings = [];

  for (const spec of REQUIRED_VARS) {
    // Skip check if skipIf condition is met
    if (spec.skipIf && spec.skipIf()) {
      console.log(`ℹ️  Skipping ${spec.name} check (will be fetched from AWS Secrets Manager)`);
      continue;
    }

    const value = process.env[spec.name];

    if (!value) {
      errors.push({
        var: spec.name,
        issue: 'missing',
        description: spec.description,
        hint: spec.hint
      });
      continue;
    }

    if (spec.minLength && value.length < spec.minLength) {
      errors.push({
        var: spec.name,
        issue: `too short (need ≥${spec.minLength} chars, got ${value.length})`,
        description: spec.description,
        hint: spec.hint
      });
    }
  }

  // Warn if NODE_ENV is not set
  if (!process.env.NODE_ENV) {
    warnings.push('NODE_ENV is not set (defaulting to development behavior)');
  }

  return { errors, warnings };
}

function main() {
  const { errors, warnings } = checkEnv();

  // Print warnings
  for (const warn of warnings) {
    console.warn(`⚠️  Warning: ${warn}`);
  }

  // Print errors
  if (errors.length > 0) {
    console.error('\n❌ Preflight check FAILED\n');
    console.error('Missing or invalid required environment variables:\n');

    for (const err of errors) {
      console.error(`  ${err.var}: ${err.issue}`);
      console.error(`    → ${err.description}`);
      if (err.hint) {
        console.error(`    💡 ${err.hint}`);
      }
      console.error('');
    }

    console.error('---');
    console.error('For local dev, ensure .env.dev has all required vars.');
    console.error('For production, set vars in your hosting environment (Render, etc).\n');

    process.exit(1);
  }

  // All good
  if (warnings.length === 0) {
    console.log('✅ Preflight check passed');
  }
  process.exit(0);
}

main();
