-- Phase 6: Placement order gating for scheduling fairness
-- Add JSON policy field to OffspringGroup and rank field to OffspringGroupBuyer

-- Add placementSchedulingPolicy JSON field to OffspringGroup
ALTER TABLE "OffspringGroup" ADD COLUMN "placementSchedulingPolicy" JSONB;

-- Add placementRank field to OffspringGroupBuyer
ALTER TABLE "OffspringGroupBuyer" ADD COLUMN "placementRank" INTEGER;
