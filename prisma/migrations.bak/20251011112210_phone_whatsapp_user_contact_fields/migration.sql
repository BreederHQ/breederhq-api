/*
  Warnings:

  - You are about to drop the column `phone` on the `Contact` table. All the data in the column will be lost.
  - You are about to alter the column `country` on the `Contact` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Char(2)`.

*/
-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "phone",
ADD COLUMN     "phoneE164" VARCHAR(32),
ADD COLUMN     "whatsappE164" VARCHAR(32),
ALTER COLUMN "country" SET DATA TYPE CHAR(2);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" CHAR(2),
ADD COLUMN     "phoneE164" VARCHAR(32),
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "street2" TEXT,
ADD COLUMN     "whatsappE164" VARCHAR(32);

-- CreateIndex
CREATE INDEX "User_phoneE164_idx" ON "User"("phoneE164");

-- CreateIndex
CREATE INDEX "User_whatsappE164_idx" ON "User"("whatsappE164");

-- CreateIndex
CREATE INDEX "User_country_idx" ON "User"("country");
