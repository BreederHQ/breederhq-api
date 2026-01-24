// Debug script to check portal user membership and party linkage
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debug() {
  const userId = 'cmk8iegs40003gtukx9zxp1xa';
  const tenantId = 87;

  console.log('=== Checking TenantMembership ===');
  const membership = await (prisma as any).tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });

  console.log('Membership:', JSON.stringify(membership, null, 2));

  console.log('\n=== Checking PortalAccess ===');
  const portalAccess = await (prisma as any).portalAccess.findMany({
    where: { userId },
    include: { party: true }
  });
  console.log('PortalAccess:', JSON.stringify(portalAccess, null, 2));

  console.log('\n=== Checking ContractParty Records for partyId=121 ===');
  const contractParties = await (prisma as any).contractParty.findMany({
    where: { tenantId, partyId: 121 },
    include: { contract: { select: { id: true, title: true, status: true } } },
    take: 3
  });
  console.log('ContractParties:', JSON.stringify(contractParties, null, 2));

  await prisma.$disconnect();
}

debug().catch(console.error);
