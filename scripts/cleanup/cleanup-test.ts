import prisma from "./src/prisma.js";

async function main() {
  // Delete test vaccination record
  await prisma.vaccinationRecord.deleteMany({
    where: {
      notes: { contains: "Test vaccination for notification system testing" },
    },
  });

  // Delete test notifications
  await prisma.notification.deleteMany({
    where: {
      message: { contains: "test" },
    },
  });

  console.log("✅ Test data cleaned up");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
