-- CreateTable
CREATE TABLE "marketplace"."provider_terms_acceptance" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "version" VARCHAR(16) NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,

    CONSTRAINT "provider_terms_acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_terms_acceptance_user_id_idx" ON "marketplace"."provider_terms_acceptance"("user_id");

-- CreateIndex
CREATE INDEX "provider_terms_acceptance_version_idx" ON "marketplace"."provider_terms_acceptance"("version");

-- CreateIndex
CREATE INDEX "provider_terms_acceptance_accepted_at_idx" ON "marketplace"."provider_terms_acceptance"("accepted_at");

-- CreateIndex
CREATE UNIQUE INDEX "provider_terms_acceptance_user_id_version_key" ON "marketplace"."provider_terms_acceptance"("user_id", "version");

-- AddForeignKey
ALTER TABLE "marketplace"."provider_terms_acceptance" ADD CONSTRAINT "provider_terms_acceptance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "marketplace"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
