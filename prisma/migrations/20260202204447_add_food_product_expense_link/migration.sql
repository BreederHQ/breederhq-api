-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "foodProductId" INTEGER;

-- CreateIndex
CREATE INDEX "Expense_tenantId_foodProductId_idx" ON "Expense"("tenantId", "foodProductId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_foodProductId_fkey" FOREIGN KEY ("foodProductId") REFERENCES "FoodProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
