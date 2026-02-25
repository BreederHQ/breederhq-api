import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const t = await prisma.tenant.findFirst({ where: { slug: 'kvs-demo' }, select: { id: true, name: true, slug: true } });
console.log(`Tenant ID : ${t?.id}`);
console.log(`Name      : ${t?.name}`);
console.log(`Slug      : ${t?.slug}`);
await prisma.$disconnect();
