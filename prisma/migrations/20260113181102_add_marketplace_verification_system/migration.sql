-- CreateEnum
CREATE TYPE "marketplace"."BreederVerificationTier" AS ENUM ('SUBSCRIBER', 'MARKETPLACE_ENABLED', 'IDENTITY_VERIFIED', 'VERIFIED', 'ACCREDITED');

-- CreateEnum
CREATE TYPE "marketplace"."ServiceProviderVerificationTier" AS ENUM ('LISTED', 'IDENTITY_VERIFIED', 'VERIFIED_PROFESSIONAL', 'ACCREDITED_PROVIDER');

-- CreateEnum
CREATE TYPE "marketplace"."VerificationRequestStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'NEEDS_INFO', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "marketplace"."TwoFactorMethod" AS ENUM ('PASSKEY', 'TOTP', 'SMS');

-- AlterTable
ALTER TABLE "marketplace"."providers" ADD COLUMN     "accredited_package_approved_at" TIMESTAMP(3),
ADD COLUMN     "accredited_package_approved_by" INTEGER,
ADD COLUMN     "accredited_package_expires_at" TIMESTAMP(3),
ADD COLUMN     "accredited_package_purchased_at" TIMESTAMP(3),
ADD COLUMN     "established_badge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "established_badge_earned_at" TIMESTAMP(3),
ADD COLUMN     "identity_verified_at" TIMESTAMP(3),
ADD COLUMN     "phone_verification_token" TEXT,
ADD COLUMN     "phone_verification_token_expires" TIMESTAMP(3),
ADD COLUMN     "phone_verified_at" TIMESTAMP(3),
ADD COLUMN     "stripe_identity_session_id" TEXT,
ADD COLUMN     "stripe_identity_status" TEXT,
ADD COLUMN     "top_rated_badge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "top_rated_badge_earned_at" TIMESTAMP(3),
ADD COLUMN     "trusted_badge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trusted_badge_earned_at" TIMESTAMP(3),
ADD COLUMN     "verification_tier" "marketplace"."BreederVerificationTier" NOT NULL DEFAULT 'SUBSCRIBER',
ADD COLUMN     "verification_tier_achieved_at" TIMESTAMP(3),
ADD COLUMN     "verified_package_approved_at" TIMESTAMP(3),
ADD COLUMN     "verified_package_approved_by" INTEGER,
ADD COLUMN     "verified_package_expires_at" TIMESTAMP(3),
ADD COLUMN     "verified_package_purchased_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "marketplace"."users" ADD COLUMN     "accepts_payments_badge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "accredited_provider_approved_at" TIMESTAMP(3),
ADD COLUMN     "accredited_provider_approved_by" INTEGER,
ADD COLUMN     "accredited_provider_expires_at" TIMESTAMP(3),
ADD COLUMN     "accredited_provider_purchased_at" TIMESTAMP(3),
ADD COLUMN     "established_provider_badge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "identity_verified_at" TIMESTAMP(3),
ADD COLUMN     "passkey_counter" INTEGER,
ADD COLUMN     "passkey_created_at" TIMESTAMP(3),
ADD COLUMN     "passkey_credential_id" TEXT,
ADD COLUMN     "passkey_public_key" BYTEA,
ADD COLUMN     "quick_responder_badge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "service_provider_tier" "marketplace"."ServiceProviderVerificationTier",
ADD COLUMN     "service_provider_tier_achieved_at" TIMESTAMP(3),
ADD COLUMN     "sms_phone_number" TEXT,
ADD COLUMN     "sms_verification_token" TEXT,
ADD COLUMN     "sms_verification_token_expires" TIMESTAMP(3),
ADD COLUMN     "sms_verified_at" TIMESTAMP(3),
ADD COLUMN     "stripe_identity_session_id" TEXT,
ADD COLUMN     "stripe_identity_status" TEXT,
ADD COLUMN     "top_rated_badge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totp_secret" TEXT,
ADD COLUMN     "totp_verified_at" TIMESTAMP(3),
ADD COLUMN     "trusted_provider_badge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "two_factor_enabled_at" TIMESTAMP(3),
ADD COLUMN     "two_factor_method" "marketplace"."TwoFactorMethod",
ADD COLUMN     "verified_professional_approved_at" TIMESTAMP(3),
ADD COLUMN     "verified_professional_approved_by" INTEGER,
ADD COLUMN     "verified_professional_expires_at" TIMESTAMP(3),
ADD COLUMN     "verified_professional_purchased_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "marketplace"."verification_requests" (
    "id" SERIAL NOT NULL,
    "user_type" TEXT NOT NULL,
    "provider_id" INTEGER,
    "marketplace_user_id" INTEGER,
    "package_type" TEXT NOT NULL,
    "requested_tier" TEXT NOT NULL,
    "status" "marketplace"."VerificationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_info" JSONB,
    "review_checklist" JSONB,
    "review_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" INTEGER,
    "info_requested_at" TIMESTAMP(3),
    "info_request_note" TEXT,
    "info_provided_at" TIMESTAMP(3),
    "payment_intent_id" TEXT,
    "amount_paid_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_requests_status_created_at_idx" ON "marketplace"."verification_requests"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "verification_requests_user_type_status_idx" ON "marketplace"."verification_requests"("user_type", "status");

-- CreateIndex
CREATE INDEX "verification_requests_provider_id_idx" ON "marketplace"."verification_requests"("provider_id");

-- CreateIndex
CREATE INDEX "verification_requests_marketplace_user_id_idx" ON "marketplace"."verification_requests"("marketplace_user_id");

-- CreateIndex
CREATE INDEX "verification_requests_reviewed_by_idx" ON "marketplace"."verification_requests"("reviewed_by");

-- CreateIndex
CREATE INDEX "providers_verification_tier_idx" ON "marketplace"."providers"("verification_tier");

-- CreateIndex
CREATE INDEX "users_two_factor_enabled_idx" ON "marketplace"."users"("two_factor_enabled");

-- CreateIndex
CREATE INDEX "users_service_provider_tier_idx" ON "marketplace"."users"("service_provider_tier");

-- AddForeignKey
ALTER TABLE "marketplace"."verification_requests" ADD CONSTRAINT "verification_requests_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "marketplace"."providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."verification_requests" ADD CONSTRAINT "verification_requests_marketplace_user_id_fkey" FOREIGN KEY ("marketplace_user_id") REFERENCES "marketplace"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
