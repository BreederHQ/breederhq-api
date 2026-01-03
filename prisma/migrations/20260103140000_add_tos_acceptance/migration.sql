-- CreateTable
CREATE TABLE "TosAcceptance" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "version" VARCHAR(16) NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "surface" VARCHAR(32),
    "flow" VARCHAR(32),

    CONSTRAINT "TosAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TosAcceptance_userId_idx" ON "TosAcceptance"("userId");

-- CreateIndex
CREATE INDEX "TosAcceptance_version_idx" ON "TosAcceptance"("version");

-- AddForeignKey
ALTER TABLE "TosAcceptance" ADD CONSTRAINT "TosAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
