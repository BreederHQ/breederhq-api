import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkDuplicates(email: string) {
  const users = await prisma.user.findMany({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      defaultTenantId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${users.length} user(s) with email: ${email}\n`);

  if (users.length === 0) {
    console.log("No users found");
  } else if (users.length === 1) {
    console.log("Single user (expected):");
    console.log(JSON.stringify(users[0], null, 2));
  } else {
    console.log("⚠️  DUPLICATE USERS FOUND (database corruption!):");
    users.forEach((u, i) => {
      console.log(`\n[${i + 1}] ${u.id}`);
      console.log(`    Name: ${u.firstName} ${u.lastName}`);
      console.log(`    Created: ${u.createdAt}`);
      console.log(`    DefaultTenantId: ${u.defaultTenantId}`);
    });
  }

  await prisma.$disconnect();
}

const email = process.argv[2] || "ted.prod@afcrichmond.local";
checkDuplicates(email);
