import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkUser(email: string) {
  const user = await prisma.user.findFirst({
    where: { email },
    include: {
      memberships: {
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              tenantId: true,
              tenant: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
  });

  console.log(JSON.stringify(user, null, 2));
  await prisma.$disconnect();
}

const email = process.argv[2] || "ted.prod@afcrichmond.local";
checkUser(email);
