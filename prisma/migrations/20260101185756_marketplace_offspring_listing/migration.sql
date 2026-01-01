-- AlterTable
ALTER TABLE "Offspring" ADD COLUMN     "marketplaceListed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketplacePriceCents" INTEGER;

-- AlterTable
ALTER TABLE "OffspringGroup" ADD COLUMN     "marketplaceDefaultPriceCents" INTEGER;
