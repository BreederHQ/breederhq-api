#!/usr/bin/env node
/**
 * scripts/run-with-env.js
 *
 * Runs a command with environment variables loaded from a specific .env file.
 *
 * Usage:
 *   node scripts/run-with-env.js <env-file> <command> [args...]
 *
 * Example:
 *   node scripts/run-with-env.js .env.dev.migrate prisma migrate dev
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node scripts/run-with-env.js <env-file> <command> [args...]');
  process.exit(1);
}

const envFile = args[0];
const command = args[1];
const commandArgs = args.slice(2);

// Resolve env file path
const envPath = path.resolve(process.cwd(), envFile);

if (!fs.existsSync(envPath)) {
  console.error(`Error: Environment file not found: ${envPath}`);
  process.exit(1);
}

// Load environment variables
require('dotenv').config({ path: envPath });

// Spawn the command
const child = spawn(command, commandArgs, {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
