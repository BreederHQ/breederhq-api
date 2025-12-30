#!/usr/bin/env node
/**
 * db-ident.js - Database identity probe for debugging connection issues
 *
 * Prints non-secret database identity info to verify we're connecting
 * to the expected database.
 *
 * Usage:
 *   import { probeDbIdent } from './db-ident.js';
 *   await probeDbIdent(dbUrl, envVars);
 */

import { spawn } from "child_process";

/**
 * Probes database identity and prints non-secret info.
 * @param {string} dbUrl - Database connection URL
 * @param {object} envVars - Environment variables to pass to psql
 * @param {string} cwd - Working directory
 * @returns {Promise<{db: string, schema: string, host: string, port: string, tableCount: number}>}
 */
export function probeDbIdent(dbUrl, envVars, cwd) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        current_database() as db,
        current_schema() as schema,
        COALESCE(inet_server_addr()::text, 'local') as host,
        COALESCE(inet_server_port()::text, 'default') as port;
      SELECT count(*)::int as table_count
        FROM information_schema.tables
        WHERE table_schema = 'public';
    `;

    const child = spawn("psql", [dbUrl, "-t", "-A", "-F", ",", "-c", sql], {
      env: { ...process.env, ...envVars },
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`db-ident probe failed: ${stderr}`));
        return;
      }

      // Parse output: first line is db,schema,host,port; second line is table_count
      // Handle CRLF on Windows
      const lines = stdout
        .trim()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        reject(new Error(`Unexpected db-ident output: ${stdout}`));
        return;
      }

      const [db, schema, host, port] = lines[0].split(",");
      const tableCount = parseInt(lines[1], 10);

      resolve({ db, schema, host, port, tableCount });
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to run psql: ${err.message}`));
    });
  });
}

/**
 * Prints database identity info to console.
 * @param {string} label - Label for the output (e.g., "Import", "Postimport")
 * @param {object} ident - Identity object from probeDbIdent
 */
export function printDbIdent(label, ident) {
  console.log(`\n┌─ DB Identity (${label}) ─────────────────────────────`);
  console.log(`│  Database: ${ident.db}`);
  console.log(`│  Schema:   ${ident.schema}`);
  console.log(`│  Host:     ${ident.host}`);
  console.log(`│  Port:     ${ident.port}`);
  console.log(`│  Tables:   ${ident.tableCount} in public schema`);
  console.log(`└────────────────────────────────────────────────────────\n`);
}

/**
 * Checks if required v2 tables exist in the database.
 * Uses pg_class with exact name matching for Prisma PascalCase tables.
 * @param {string} dbUrl - Database connection URL
 * @param {object} envVars - Environment variables
 * @param {string} cwd - Working directory
 * @param {string[]} requiredTables - List of table names to check (PascalCase)
 * @returns {Promise<{present: string[], missing: string[]}>}
 */
/**
 * Compares two database identities and checks if they appear to be the same.
 * Returns { isSame: boolean, reason: string }
 */
export function compareDbIdents(source, dest) {
  // Check if host + database name match (strong indicator of same DB)
  if (source.host === dest.host && source.db === dest.db) {
    return {
      isSame: true,
      reason: `Same database: ${source.db} on ${source.host}`,
    };
  }

  // Check if host matches but different database
  if (source.host === dest.host && source.db !== dest.db) {
    return {
      isSame: false,
      reason: `Different databases (${source.db} vs ${dest.db}) on same host`,
    };
  }

  // Different hosts - safe
  return {
    isSame: false,
    reason: `Different hosts (${source.host} vs ${dest.host})`,
  };
}

/**
 * Prints source and destination database identities side by side.
 */
export function printSourceDestIdents(sourceIdent, destIdent) {
  console.log("\n┌─────────────────────────────────────────────────────────────────┐");
  console.log("│  DATABASE IDENTITY VERIFICATION                                 │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  console.log("│  SOURCE (v1)              │  DESTINATION (v2)                   │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  console.log(`│  Database: ${sourceIdent.db.padEnd(14)} │  Database: ${destIdent.db.padEnd(22)} │`);
  console.log(`│  Host:     ${sourceIdent.host.slice(0, 14).padEnd(14)} │  Host:     ${destIdent.host.slice(0, 22).padEnd(22)} │`);
  console.log(`│  Tables:   ${String(sourceIdent.tableCount).padEnd(14)} │  Tables:   ${String(destIdent.tableCount).padEnd(22)} │`);
  console.log("└─────────────────────────────────────────────────────────────────┘\n");
}

export function checkRequiredTables(dbUrl, envVars, cwd, requiredTables) {
  return new Promise((resolve, reject) => {
    // Use pg_class with exact name matching - this works reliably for PascalCase tables
    // information_schema.tables also works but pg_class is more direct
    const tableList = requiredTables.map((t) => `'${t}'`).join(",");
    const sql = `
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname IN (${tableList});
    `;

    const child = spawn("psql", [dbUrl, "-t", "-A", "-c", sql], {
      env: { ...process.env, ...envVars },
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Table check failed: ${stderr}`));
        return;
      }

      // Handle CRLF on Windows - split on \r\n or \n, then trim each line
      const present = stdout
        .trim()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const missing = requiredTables.filter((t) => !present.includes(t));

      resolve({ present, missing });
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to run psql: ${err.message}`));
    });
  });
}
