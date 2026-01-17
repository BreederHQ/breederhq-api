import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Check all templates
  const templates = await prisma.contractTemplate.findMany({
    select: { id: true, name: true, tenantId: true, type: true }
  });
  
  console.log(`All Templates (${templates.length}):`);
  
  const systemTemplates = templates.filter(t => t.tenantId === null);
  const tenantTemplates = templates.filter(t => t.tenantId !== null);
  
  console.log(`\nSystem/Global Templates (tenantId=null): ${systemTemplates.length}`);
  systemTemplates.forEach(t => console.log(`  - ${t.name} (id: ${t.id}, type: ${t.type})`));
  
  console.log(`\nTenant-specific Templates: ${tenantTemplates.length}`);
  tenantTemplates.forEach(t => console.log(`  - ${t.name} (tenantId: ${t.tenantId})`));
}

main().finally(() => prisma.$disconnect());
