-- CreateTable
CREATE TABLE "marketplace"."legal_acceptances" (
    "id" SERIAL NOT NULL,
    "marketplace_user_id" INTEGER,
    "email" VARCHAR(255),
    "documents_accepted" JSONB NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "surface" VARCHAR(32) NOT NULL,
    "flow" VARCHAR(64) NOT NULL,
    "entity_type" VARCHAR(32),
    "entity_id" INTEGER,

    CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_acceptances_marketplace_user_id_idx" ON "marketplace"."legal_acceptances"("marketplace_user_id");

-- CreateIndex
CREATE INDEX "legal_acceptances_email_idx" ON "marketplace"."legal_acceptances"("email");

-- CreateIndex
CREATE INDEX "legal_acceptances_flow_idx" ON "marketplace"."legal_acceptances"("flow");

-- CreateIndex
CREATE INDEX "legal_acceptances_entity_type_entity_id_idx" ON "marketplace"."legal_acceptances"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "legal_acceptances_accepted_at_idx" ON "marketplace"."legal_acceptances"("accepted_at");

-- AddForeignKey
ALTER TABLE "marketplace"."legal_acceptances" ADD CONSTRAINT "legal_acceptances_marketplace_user_id_fkey" FOREIGN KEY ("marketplace_user_id") REFERENCES "marketplace"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Grant permissions to application role
GRANT SELECT, INSERT ON "marketplace"."legal_acceptances" TO neondb_owner;
GRANT USAGE, SELECT ON SEQUENCE "marketplace"."legal_acceptances_id_seq" TO neondb_owner;
