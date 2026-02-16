-- CreateTable
CREATE TABLE "marketplace"."mobile_refresh_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "device_id" VARCHAR(255),
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "mobile_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mobile_refresh_tokens_token_hash_key" ON "marketplace"."mobile_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "mobile_refresh_tokens_user_id_idx" ON "marketplace"."mobile_refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "mobile_refresh_tokens_token_hash_idx" ON "marketplace"."mobile_refresh_tokens"("token_hash");

-- AddForeignKey
ALTER TABLE "marketplace"."mobile_refresh_tokens" ADD CONSTRAINT "mobile_refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "marketplace"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
