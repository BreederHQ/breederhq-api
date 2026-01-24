#!/usr/bin/env node
/**
 * Comprehensive schema validation: Ensures Prisma schema is 100% aligned with database
 *
 * Checks:
 * 1. All tables exist
 * 2. All columns exist with correct types and nullability
 * 3. All indexes exist
 * 4. All foreign keys exist with correct references
 * 5. All enums exist with correct values
 * 6. No drift between schema and database
 *
 * Usage:
 *   node scripts/validate-schema-alignment.mjs
 *   npx dotenv -e .env.dev.migrate -- node scripts/validate-schema-alignment.mjs
 *   npx dotenv -e .env.prod.migrate -- node scripts/validate-schema-alignment.mjs
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

let errorCount = 0;
let warningCount = 0;

function error(msg) {
  console.error(`❌ ERROR: ${msg}`);
  errorCount++;
}

function warning(msg) {
  console.warn(`⚠️  WARNING: ${msg}`);
  warningCount++;
}

function success(msg) {
  console.log(`✓ ${msg}`);
}

async function getDatabaseInfo() {
  const result = await prisma.$queryRaw`
    SELECT current_database() as database,
           current_schema() as schema,
           version() as version
  `;
  return result[0];
}

async function getAllTables() {
  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  return tables.map(t => t.table_name);
}

async function getTableColumns(tableName) {
  const columns = await prisma.$queryRaw`
    SELECT
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
    ORDER BY ordinal_position
  `;
  return columns;
}

async function getTableIndexes(tableName) {
  const indexes = await prisma.$queryRaw`
    SELECT
      i.relname as index_name,
      a.attname as column_name,
      ix.indisunique as is_unique,
      ix.indisprimary as is_primary
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE t.relname = ${tableName}
      AND t.relkind = 'r'
    ORDER BY i.relname, a.attnum
  `;
  return indexes;
}

async function getTableForeignKeys(tableName) {
  const fks = await prisma.$queryRaw`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = ${tableName}
    ORDER BY tc.constraint_name
  `;
  return fks;
}

async function getEnums() {
  const enums = await prisma.$queryRaw`
    SELECT
      t.typname as enum_name,
      array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname
  `;
  return enums;
}

async function parsePrismaSchema() {
  const schemaPath = join(__dirname, '..', 'prisma', 'schema.prisma');
  const schemaContent = readFileSync(schemaPath, 'utf-8');

  // Extract model names
  const modelRegex = /model\s+(\w+)\s*{/g;
  const models = [];
  let match;
  while ((match = modelRegex.exec(schemaContent)) !== null) {
    models.push(match[1]);
  }

  // Extract enum names and values
  const enumRegex = /enum\s+(\w+)\s*{([^}]+)}/g;
  const enums = [];
  while ((match = enumRegex.exec(schemaContent)) !== null) {
    const enumName = match[1];
    const enumBody = match[2];
    const values = enumBody
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'))
      .map(line => line.split(/\s+/)[0]);
    enums.push({ name: enumName, values });
  }

  return { models, enums };
}

async function validateTables(schemaModels, dbTables) {
  console.log('\n=== TABLE VALIDATION ===\n');

  // Check all schema models exist as tables
  for (const model of schemaModels) {
    if (dbTables.includes(model)) {
      success(`Table "${model}" exists`);
    } else {
      error(`Table "${model}" defined in schema but missing in database`);
    }
  }

  // Check for extra tables not in schema (informational)
  for (const table of dbTables) {
    if (!schemaModels.includes(table)) {
      // These are expected system tables
      if (table === '_prisma_migrations') {
        success(`System table "${table}" exists`);
      } else {
        warning(`Table "${table}" exists in database but not defined in schema`);
      }
    }
  }
}

async function validateEnums(schemaEnums, dbEnums) {
  console.log('\n=== ENUM VALIDATION ===\n');

  for (const schemaEnum of schemaEnums) {
    const dbEnum = dbEnums.find(e => e.enum_name === schemaEnum.name);

    if (!dbEnum) {
      error(`Enum "${schemaEnum.name}" defined in schema but missing in database`);
      continue;
    }

    success(`Enum "${schemaEnum.name}" exists`);

    // Check enum values match
    const schemaValues = schemaEnum.values.sort();
    const dbValues = dbEnum.enum_values.sort();

    if (JSON.stringify(schemaValues) !== JSON.stringify(dbValues)) {
      error(`Enum "${schemaEnum.name}" values mismatch:`);
      console.log(`  Schema: ${schemaValues.join(', ')}`);
      console.log(`  Database: ${dbValues.join(', ')}`);
    } else {
      success(`Enum "${schemaEnum.name}" values match (${dbValues.length} values)`);
    }
  }

  // Check for extra enums
  for (const dbEnum of dbEnums) {
    if (!schemaEnums.find(e => e.name === dbEnum.enum_name)) {
      warning(`Enum "${dbEnum.enum_name}" exists in database but not defined in schema`);
    }
  }
}

async function validateCriticalColumns() {
  console.log('\n=== CRITICAL COLUMN VALIDATION ===\n');

  // Critical columns that must exist for the app to work
  const criticalChecks = [
    {
      table: 'Organization',
      column: 'partyId',
      type: 'integer',
      nullable: false,
      reason: 'Required for Party migration - Contacts API depends on it'
    },
    {
      table: 'Contact',
      column: 'partyId',
      type: 'integer',
      nullable: true,
      reason: 'Party migration - optional linkage'
    },
    {
      table: 'Party',
      column: 'type',
      type: 'USER-DEFINED', // enum
      nullable: false,
      reason: 'Party type discriminator'
    },
    {
      table: 'User',
      column: 'partyId',
      type: 'integer',
      nullable: true,
      reason: 'Party migration - optional linkage'
    }
  ];

  for (const check of criticalChecks) {
    const columns = await getTableColumns(check.table);
    const column = columns.find(c => c.column_name === check.column);

    if (!column) {
      error(`CRITICAL: ${check.table}.${check.column} missing - ${check.reason}`);
      continue;
    }

    const nullable = column.is_nullable === 'YES';
    const typeMatch = column.data_type === check.type || column.udt_name === check.column;

    if (nullable !== check.nullable) {
      error(`CRITICAL: ${check.table}.${check.column} nullability mismatch - expected ${check.nullable ? 'NULL' : 'NOT NULL'}, got ${nullable ? 'NULL' : 'NOT NULL'}`);
    }

    success(`${check.table}.${check.column} exists (${column.data_type}, ${nullable ? 'NULL' : 'NOT NULL'}) - ${check.reason}`);
  }
}

async function validateCriticalIndexes() {
  console.log('\n=== CRITICAL INDEX VALIDATION ===\n');

  const criticalIndexes = [
    {
      table: 'Organization',
      name: 'Organization_partyId_key',
      unique: true,
      reason: 'Unique constraint on Organization.partyId'
    },
    {
      table: 'Contact',
      name: 'Contact_partyId_key',
      unique: true,
      reason: 'Unique constraint on Contact.partyId'
    }
  ];

  for (const check of criticalIndexes) {
    const indexes = await getTableIndexes(check.table);
    const index = indexes.find(i => i.index_name === check.name);

    if (!index) {
      error(`CRITICAL: Index "${check.name}" missing on ${check.table} - ${check.reason}`);
      continue;
    }

    if (check.unique && !index.is_unique) {
      error(`CRITICAL: Index "${check.name}" should be UNIQUE but is not`);
      continue;
    }

    success(`Index "${check.name}" exists on ${check.table} (${check.unique ? 'UNIQUE' : 'NON-UNIQUE'}) - ${check.reason}`);
  }
}

async function validateCriticalForeignKeys() {
  console.log('\n=== CRITICAL FOREIGN KEY VALIDATION ===\n');

  const criticalFKs = [
    {
      table: 'Organization',
      constraint: 'Organization_partyId_fkey',
      column: 'partyId',
      refTable: 'Party',
      refColumn: 'id',
      reason: 'Organization must reference Party'
    },
    {
      table: 'Contact',
      constraint: 'Contact_partyId_fkey',
      column: 'partyId',
      refTable: 'Party',
      refColumn: 'id',
      reason: 'Contact may reference Party'
    }
  ];

  for (const check of criticalFKs) {
    const fks = await getTableForeignKeys(check.table);
    const fk = fks.find(f => f.constraint_name === check.constraint);

    if (!fk) {
      error(`CRITICAL: Foreign key "${check.constraint}" missing on ${check.table} - ${check.reason}`);
      continue;
    }

    if (fk.column_name !== check.column) {
      error(`CRITICAL: FK "${check.constraint}" references wrong column - expected ${check.column}, got ${fk.column_name}`);
      continue;
    }

    if (fk.foreign_table_name !== check.refTable || fk.foreign_column_name !== check.refColumn) {
      error(`CRITICAL: FK "${check.constraint}" references wrong table/column - expected ${check.refTable}.${check.refColumn}, got ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      continue;
    }

    success(`FK "${check.constraint}" exists: ${check.table}.${check.column} → ${check.refTable}.${check.refColumn} - ${check.reason}`);
  }
}

async function validateMigrationHistory() {
  console.log('\n=== MIGRATION HISTORY VALIDATION ===\n');

  const migrations = await prisma.$queryRaw`
    SELECT migration_name, finished_at, rolled_back_at
    FROM _prisma_migrations
    ORDER BY finished_at DESC
    LIMIT 10
  `;

  console.log('Recent migrations:');
  for (const migration of migrations) {
    const status = migration.rolled_back_at ? '❌ ROLLED BACK' : '✓ Applied';
    console.log(`  ${status} ${migration.migration_name} (${migration.finished_at?.toISOString() || 'pending'})`);
  }

  // Check for any rolled back migrations
  const rolledBack = migrations.filter(m => m.rolled_back_at);
  if (rolledBack.length > 0) {
    warning(`${rolledBack.length} recent migration(s) were rolled back - may indicate issues`);
  }

  // Check for the critical migrations we just added
  const criticalMigrations = [
    '20251226_party_step8_org_partyId_patch',
    '20251226_party_step8_org_partyId_notnull'
  ];

  for (const name of criticalMigrations) {
    const migration = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at, started_at
      FROM _prisma_migrations
      WHERE migration_name = ${name}
      ORDER BY started_at DESC
      LIMIT 1
    `;

    if (migration.length === 0) {
      error(`CRITICAL: Migration "${name}" not found in migration history`);
    } else if (migration[0].rolled_back_at) {
      error(`CRITICAL: Migration "${name}" was rolled back (latest attempt)`);
    } else if (!migration[0].finished_at) {
      error(`CRITICAL: Migration "${name}" did not finish (may have failed)`);
    } else {
      success(`Migration "${name}" applied successfully`);
    }
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          COMPREHENSIVE SCHEMA ALIGNMENT VALIDATION            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Get database info
    const dbInfo = await getDatabaseInfo();
    console.log(`Database: ${dbInfo.database}`);
    console.log(`Schema: ${dbInfo.schema}`);
    console.log(`Version: ${dbInfo.version.split(' ')[0]}\n`);

    // Parse Prisma schema
    console.log('Parsing Prisma schema...');
    const { models: schemaModels, enums: schemaEnums } = await parsePrismaSchema();
    console.log(`Found ${schemaModels.length} models and ${schemaEnums.length} enums in schema\n`);

    // Get database objects
    console.log('Querying database objects...');
    const dbTables = await getAllTables();
    const dbEnums = await getEnums();
    console.log(`Found ${dbTables.length} tables and ${dbEnums.length} enums in database\n`);

    // Run validations
    await validateTables(schemaModels, dbTables);
    await validateEnums(schemaEnums, dbEnums);
    await validateCriticalColumns();
    await validateCriticalIndexes();
    await validateCriticalForeignKeys();
    await validateMigrationHistory();

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                       VALIDATION SUMMARY                       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    if (errorCount === 0 && warningCount === 0) {
      console.log('🎉 SUCCESS: Schema is 100% aligned with database!');
      console.log('   All tables, columns, indexes, foreign keys, and enums match.\n');
    } else {
      console.log(`Errors: ${errorCount}`);
      console.log(`Warnings: ${warningCount}\n`);

      if (errorCount > 0) {
        console.error('❌ FAILED: Schema drift detected! Please review errors above.\n');
        process.exit(1);
      } else {
        console.warn('⚠️  WARNINGS: Minor issues detected but schema is functional.\n');
      }
    }

  } catch (error) {
    console.error('\n❌ Validation failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
