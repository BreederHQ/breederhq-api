// Test script for notification system
import prisma from "./src/prisma.js";
import { runNotificationScan } from "./src/services/notification-scanner.js";
import { deliverPendingNotifications } from "./src/services/notification-delivery.js";

async function main() {
  console.log("=== Notification System Test Script ===\n");

  // 1. Check existing data
  console.log("1. Checking existing data...");

  const tenantCount = await prisma.tenant.count();
  const animalCount = await prisma.animal.count();
  const vaccinationCount = await prisma.vaccinationRecord.count();
  const breedingPlanCount = await prisma.breedingPlan.count();
  const notificationCount = await prisma.notification.count();

  console.log(`   Tenants: ${tenantCount}`);
  console.log(`   Animals: ${animalCount}`);
  console.log(`   Vaccination Records: ${vaccinationCount}`);
  console.log(`   Breeding Plans: ${breedingPlanCount}`);
  console.log(`   Existing Notifications: ${notificationCount}\n`);

  // Get first tenant and animal for test data
  const firstTenant = await prisma.tenant.findFirst();
  const firstAnimal = await prisma.animal.findFirst({
    where: { status: { not: "DECEASED" } },
  });

  if (!firstTenant || !firstAnimal) {
    console.log("❌ No tenant or animal found. Cannot proceed with tests.");
    return;
  }

  console.log(`   Using Tenant ID: ${firstTenant.id} (${firstTenant.businessName})`);
  console.log(`   Using Animal ID: ${firstAnimal.id} (${firstAnimal.name})\n`);

  // 2. Create test vaccination expiring in 7 days
  console.log("2. Creating test vaccination expiring in 7 days...");

  // Helper function to get start of day
  function startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  const today = startOfDay(new Date());
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(today.getDate() + 7);

  const testVaccination = await prisma.vaccinationRecord.create({
    data: {
      animalId: firstAnimal.id,
      tenantId: firstTenant.id,
      protocolKey: "horse.rabies",
      administeredAt: today,
      expiresAt: sevenDaysFromNow,
      veterinarian: "Test Veterinarian",
      notes: "Test vaccination for notification system testing",
    },
  });

  console.log(`   ✅ Created vaccination record ID: ${testVaccination.id}`);
  console.log(`   Expires: ${sevenDaysFromNow.toLocaleDateString()}\n`);

  // 3. Run notification scan
  console.log("3. Running notification scan...");
  const scanResult = await runNotificationScan();
  console.log(`   ✅ Scan complete:`);
  console.log(`      - Vaccination notifications: ${scanResult.vaccinations}`);
  console.log(`      - Breeding notifications: ${scanResult.breeding}`);
  console.log(`      - Total: ${scanResult.total}\n`);

  // 4. Check created notifications
  console.log("4. Checking created notifications...");
  const notifications = await prisma.notification.findMany({
    where: { tenantId: firstTenant.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  console.log(`   Found ${notifications.length} notifications:`);
  notifications.forEach((n, idx) => {
    console.log(`   ${idx + 1}. ${n.type} - ${n.title}`);
    console.log(`      Priority: ${n.priority}, Status: ${n.status}`);
    console.log(`      Message: ${n.message.substring(0, 80)}...`);
  });
  console.log();

  // 5. Test idempotency (run scan again)
  console.log("5. Testing idempotency (running scan again)...");
  const secondScanResult = await runNotificationScan();
  console.log(`   ✅ Second scan complete:`);
  console.log(`      - Vaccination notifications: ${secondScanResult.vaccinations}`);
  console.log(`      - Breeding notifications: ${secondScanResult.breeding}`);
  console.log(`      - Total: ${secondScanResult.total}`);
  console.log(`   ${secondScanResult.total === 0 ? "✅ Idempotency working!" : "❌ Duplicate notifications created!"}\n`);

  // 6. Summary
  console.log("=== Test Summary ===");
  console.log(`✅ Test vaccination created and expires in 7 days`);
  console.log(`✅ Notification scan ran successfully`);
  console.log(`${scanResult.total > 0 ? "✅" : "❌"} Notifications were created`);
  console.log(`${secondScanResult.total === 0 ? "✅" : "❌"} Idempotency prevents duplicates`);
  console.log();

  // Cleanup instructions
  console.log("To clean up test data, run:");
  console.log(`DELETE FROM "Notification" WHERE "tenantId" = ${firstTenant.id};`);
  console.log(`DELETE FROM "VaccinationRecord" WHERE id = ${testVaccination.id};`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
