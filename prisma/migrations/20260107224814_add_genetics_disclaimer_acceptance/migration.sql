-- CreateTable
CREATE TABLE "GeneticsDisclaimerAcceptance" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,

    CONSTRAINT "GeneticsDisclaimerAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneticsDisclaimerAcceptance_userId_idx" ON "GeneticsDisclaimerAcceptance"("userId");

-- AddForeignKey
ALTER TABLE "GeneticsDisclaimerAcceptance" ADD CONSTRAINT "GeneticsDisclaimerAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
