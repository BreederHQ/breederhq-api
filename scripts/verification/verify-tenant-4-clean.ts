/**
 * Verify tenant 4 is completely clean
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log("🔍 Verifying tenant 4 is clean...\n");

  try {
    const tenantId = 4;

    // Check breeding plans
    const breedingPlans = await prisma.breedingPlan.findMany({
      where: { tenantId },
      select: { id: true, name: true, code: true },
    });

    console.log(`📅 Breeding Plans: ${breedingPlans.length}`);
    if (breedingPlans.length > 0) {
      breedingPlans.forEach(p => console.log(`   - ID ${p.id}: ${p.name} (${p.code})`));
    }

    // Check offspring groups
    const offspringGroups = await prisma.offspringGroup.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });

    console.log(`📦 Offspring Groups: ${offspringGroups.length}`);
    if (offspringGroups.length > 0) {
      offspringGroups.forEach(g => console.log(`   - ID ${g.id}: ${g.name || 'unnamed'}`));
    }

    // Check individual offspring
    const offspring = await prisma.offspring.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });

    console.log(`🐕 Individual Offspring: ${offspring.length}`);
    if (offspring.length > 0) {
      offspring.forEach(o => console.log(`   - ID ${o.id}: ${o.name || 'unnamed'}`));
    }

    console.log();
    if (breedingPlans.length === 0 && offspringGroups.length === 0 && offspring.length === 0) {
      console.log("✅ Tenant 4 is completely clean!\n");
    } else {
      console.log("⚠️  Tenant 4 still has data remaining\n");
    }

  } catch (error) {
    console.error("❌ Verification failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

verify().catch(console.error);
