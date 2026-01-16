-- CreateTable
CREATE TABLE "public"."MareReproductiveHistory" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "mareId" INTEGER NOT NULL,

    -- Lifetime Statistics
    "totalFoalings" INTEGER NOT NULL DEFAULT 0,
    "totalLiveFoals" INTEGER NOT NULL DEFAULT 0,
    "totalComplicatedFoalings" INTEGER NOT NULL DEFAULT 0,
    "totalVeterinaryInterventions" INTEGER NOT NULL DEFAULT 0,
    "totalRetainedPlacentas" INTEGER NOT NULL DEFAULT 0,

    -- Last Foaling Information
    "lastFoalingDate" TIMESTAMP(3),
    "lastFoalingComplications" BOOLEAN,
    "lastMareCondition" TEXT,
    "lastPlacentaPassed" BOOLEAN,
    "lastPlacentaMinutes" INTEGER,

    -- Post-Foaling Heat Patterns (averages)
    "avgPostFoalingHeatDays" DOUBLE PRECISION,
    "minPostFoalingHeatDays" INTEGER,
    "maxPostFoalingHeatDays" INTEGER,

    -- Breeding Readiness Tracking
    "lastPostFoalingHeatDate" TIMESTAMP(3),
    "lastReadyForRebreeding" BOOLEAN,
    "lastRebredDate" TIMESTAMP(3),

    -- Risk Indicators (derived from history)
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskFactors" TEXT[],

    -- Notes and metadata
    "notes" TEXT,
    "lastUpdatedFromPlanId" INTEGER,
    "lastUpdatedFromBreedYear" INTEGER,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MareReproductiveHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MareReproductiveHistory_mareId_key" ON "public"."MareReproductiveHistory"("mareId");

-- CreateIndex
CREATE INDEX "MareReproductiveHistory_tenantId_idx" ON "public"."MareReproductiveHistory"("tenantId");

-- CreateIndex
CREATE INDEX "MareReproductiveHistory_mareId_idx" ON "public"."MareReproductiveHistory"("mareId");

-- CreateIndex
CREATE INDEX "MareReproductiveHistory_riskScore_idx" ON "public"."MareReproductiveHistory"("riskScore");

-- AddForeignKey
ALTER TABLE "public"."MareReproductiveHistory" ADD CONSTRAINT "MareReproductiveHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MareReproductiveHistory" ADD CONSTRAINT "MareReproductiveHistory_mareId_fkey" FOREIGN KEY ("mareId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
