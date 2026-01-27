import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkTenant(id: number) {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      inboundEmailSlug: true,
    },
  });

  console.log(JSON.stringify(tenant, null, 2));
  await prisma.$disconnect();
}

const tenantId = process.argv[2] ? Number(process.argv[2]) : 33;
checkTenant(tenantId);
