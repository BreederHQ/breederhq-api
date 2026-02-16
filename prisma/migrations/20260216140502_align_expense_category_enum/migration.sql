-- AlterEnum: Rename ExpenseCategory values to match frontend
-- Old values: VETERINARY, FEED, SUPPLIES, BREEDING_FEE, BOARDING, TRAINING, TRANSPORT, MARKETING, ADMINISTRATIVE, FACILITIES, INSURANCE, OTHER
-- New values: VET, SUPPLIES, FOOD, GROOMING, BREEDING, FACILITY, MARKETING, LABOR, INSURANCE, REGISTRATION, TRAVEL, OTHER

-- Step 1: Create the new enum with desired values
CREATE TYPE "public"."ExpenseCategory_new" AS ENUM ('VET', 'SUPPLIES', 'FOOD', 'GROOMING', 'BREEDING', 'FACILITY', 'MARKETING', 'LABOR', 'INSURANCE', 'REGISTRATION', 'TRAVEL', 'OTHER');

-- Step 2: Convert column to text so we can remap values
ALTER TABLE "public"."Expense" ALTER COLUMN "category" TYPE text USING ("category"::text);

-- Step 3: Remap old values to new values
UPDATE "public"."Expense" SET "category" = 'VET' WHERE "category" = 'VETERINARY';
UPDATE "public"."Expense" SET "category" = 'FOOD' WHERE "category" = 'FEED';
UPDATE "public"."Expense" SET "category" = 'BREEDING' WHERE "category" = 'BREEDING_FEE';
UPDATE "public"."Expense" SET "category" = 'TRAVEL' WHERE "category" = 'TRANSPORT';
UPDATE "public"."Expense" SET "category" = 'LABOR' WHERE "category" = 'ADMINISTRATIVE';
UPDATE "public"."Expense" SET "category" = 'FACILITY' WHERE "category" = 'FACILITIES';
UPDATE "public"."Expense" SET "category" = 'GROOMING' WHERE "category" = 'BOARDING';
UPDATE "public"."Expense" SET "category" = 'GROOMING' WHERE "category" = 'TRAINING';

-- Step 4: Convert column from text to new enum
ALTER TABLE "public"."Expense" ALTER COLUMN "category" TYPE "public"."ExpenseCategory_new" USING ("category"::"public"."ExpenseCategory_new");

-- Step 5: Drop old enum and rename new one
DROP TYPE "public"."ExpenseCategory";
ALTER TYPE "public"."ExpenseCategory_new" RENAME TO "ExpenseCategory";
