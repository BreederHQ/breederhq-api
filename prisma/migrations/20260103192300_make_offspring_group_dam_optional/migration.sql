-- Make damId optional on OffspringGroup to support manually created groups without a known dam
ALTER TABLE "OffspringGroup" ALTER COLUMN "damId" DROP NOT NULL;
