import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function applyTriggerUpdate() {
  console.log('Applying updated animal_loci trigger with performance category support...\n');

  try {
    // Read the trigger SQL file
    const triggerPath = path.join(__dirname, '..', 'prisma', 'migrations', 'add-animal-loci-trigger.sql');
    const triggerSQL = fs.readFileSync(triggerPath, 'utf8');

    console.log('Executing trigger SQL...\n');

    // Split into individual statements (separated by $$ blocks for functions)
    // We need to execute each CREATE FUNCTION and CREATE TRIGGER separately
    const statements = [];

    // Extract normalize_locus_code function
    const normalizeFuncMatch = triggerSQL.match(/CREATE OR REPLACE FUNCTION normalize_locus_code[\s\S]*?\$\$ LANGUAGE plpgsql IMMUTABLE;/);
    if (normalizeFuncMatch) {
      statements.push(normalizeFuncMatch[0]);
    }

    // Extract sync_animal_loci_from_genetics function
    const syncFuncMatch = triggerSQL.match(/CREATE OR REPLACE FUNCTION sync_animal_loci_from_genetics[\s\S]*?\$\$ LANGUAGE plpgsql;/);
    if (syncFuncMatch) {
      statements.push(syncFuncMatch[0]);
    }

    // Extract DROP TRIGGER
    const dropTriggerMatch = triggerSQL.match(/DROP TRIGGER IF EXISTS [\s\S]*?;/);
    if (dropTriggerMatch) {
      statements.push(dropTriggerMatch[0]);
    }

    // Extract CREATE TRIGGER
    const createTriggerMatch = triggerSQL.match(/CREATE TRIGGER animal_genetics_sync_loci[\s\S]*?EXECUTE FUNCTION sync_animal_loci_from_genetics\(\);/);
    if (createTriggerMatch) {
      statements.push(createTriggerMatch[0]);
    }

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const stmtType = stmt.match(/^(CREATE OR REPLACE FUNCTION|DROP TRIGGER|CREATE TRIGGER)/)?.[0] || 'SQL';
      console.log(`${i + 1}/${statements.length} Executing ${stmtType}...`);
      await prisma.$executeRawUnsafe(stmt);
    }

    console.log('\n✅ Trigger updated successfully!\n');
    console.log('The database trigger now includes performance category support.');
    console.log('When performanceData is updated in AnimalGenetics, it will automatically sync to animal_loci table.\n');

    // Verify the trigger exists
    const triggers = await prisma.$queryRaw`
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      WHERE event_object_table = 'AnimalGenetics'
    `;

    console.log('Active triggers on AnimalGenetics table:');
    console.log(triggers);

  } catch (error) {
    console.error('❌ Error applying trigger:', error);
    throw error;
  }
}

applyTriggerUpdate()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
