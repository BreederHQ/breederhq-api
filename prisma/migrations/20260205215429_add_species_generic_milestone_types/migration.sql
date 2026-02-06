-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MilestoneType" ADD VALUE 'PREGNANCY_CONFIRMATION';
ALTER TYPE "MilestoneType" ADD VALUE 'ULTRASOUND_HEARTBEAT';
ALTER TYPE "MilestoneType" ADD VALUE 'ULTRASOUND_COUNT';
ALTER TYPE "MilestoneType" ADD VALUE 'XRAY_COUNT';
ALTER TYPE "MilestoneType" ADD VALUE 'BEGIN_MONITORING';
ALTER TYPE "MilestoneType" ADD VALUE 'DAILY_CHECKS';
ALTER TYPE "MilestoneType" ADD VALUE 'PREPARE_BIRTH_AREA';
ALTER TYPE "MilestoneType" ADD VALUE 'DUE_DATE';
ALTER TYPE "MilestoneType" ADD VALUE 'OVERDUE_VET_CALL';
ALTER TYPE "MilestoneType" ADD VALUE 'TEMPERATURE_DROP';
ALTER TYPE "MilestoneType" ADD VALUE 'NESTING_BEHAVIOR';
ALTER TYPE "MilestoneType" ADD VALUE 'LOSS_OF_APPETITE';
ALTER TYPE "MilestoneType" ADD VALUE 'RESTLESSNESS';
ALTER TYPE "MilestoneType" ADD VALUE 'VULVAR_CHANGES';
ALTER TYPE "MilestoneType" ADD VALUE 'MILK_PRESENT';
ALTER TYPE "MilestoneType" ADD VALUE 'LIGAMENT_SOFTENING';
ALTER TYPE "MilestoneType" ADD VALUE 'UDDER_TIGHT';
ALTER TYPE "MilestoneType" ADD VALUE 'FUR_PULLING';
ALTER TYPE "MilestoneType" ADD VALUE 'NEST_BUILDING';
