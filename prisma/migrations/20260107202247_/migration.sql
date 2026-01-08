/*
  Warnings:

  - You are about to drop the column `customerId` on the `BillingAccount` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[stripeCustomerId]` on the table `BillingAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SUBSCRIPTION', 'ADD_ON', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'INCOMPLETE', 'PAUSED');

-- CreateEnum
CREATE TYPE "UsageMetricKey" AS ENUM ('ANIMAL_COUNT', 'CONTACT_COUNT', 'PORTAL_USER_COUNT', 'BREEDING_PLAN_COUNT', 'MARKETPLACE_LISTING_COUNT', 'STORAGE_BYTES', 'SMS_SENT', 'API_CALLS');

-- CreateEnum
CREATE TYPE "AnimalCategory" AS ENUM ('RABBIT', 'SMALL_RODENT', 'BIRD', 'CAT', 'SMALL_DOG', 'LARGE_DOG', 'HORSE', 'LIVESTOCK', 'EXOTIC', 'OTHER');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('BREEDING_PROGRAM', 'STUD_SERVICE', 'TRAINING', 'VETERINARY', 'PHOTOGRAPHY', 'GROOMING', 'TRANSPORT', 'BOARDING', 'PRODUCT', 'OTHER_SERVICE');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'EXPIRED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ListingTier" AS ENUM ('FREE', 'PREMIUM', 'BUSINESS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntitlementKey" ADD VALUE 'PLATFORM_ACCESS';
ALTER TYPE "EntitlementKey" ADD VALUE 'PORTAL_ACCESS';
ALTER TYPE "EntitlementKey" ADD VALUE 'BREEDING_PLANS';
ALTER TYPE "EntitlementKey" ADD VALUE 'FINANCIAL_SUITE';
ALTER TYPE "EntitlementKey" ADD VALUE 'DOCUMENT_MANAGEMENT';
ALTER TYPE "EntitlementKey" ADD VALUE 'HEALTH_RECORDS';
ALTER TYPE "EntitlementKey" ADD VALUE 'WAITLIST_MANAGEMENT';
ALTER TYPE "EntitlementKey" ADD VALUE 'ADVANCED_REPORTING';
ALTER TYPE "EntitlementKey" ADD VALUE 'API_ACCESS';
ALTER TYPE "EntitlementKey" ADD VALUE 'MULTI_LOCATION';
ALTER TYPE "EntitlementKey" ADD VALUE 'E_SIGNATURES';
ALTER TYPE "EntitlementKey" ADD VALUE 'ANIMAL_QUOTA';
ALTER TYPE "EntitlementKey" ADD VALUE 'CONTACT_QUOTA';
ALTER TYPE "EntitlementKey" ADD VALUE 'PORTAL_USER_QUOTA';
ALTER TYPE "EntitlementKey" ADD VALUE 'BREEDING_PLAN_QUOTA';
ALTER TYPE "EntitlementKey" ADD VALUE 'MARKETPLACE_LISTING_QUOTA';
ALTER TYPE "EntitlementKey" ADD VALUE 'STORAGE_QUOTA_GB';
ALTER TYPE "EntitlementKey" ADD VALUE 'SMS_QUOTA';

-- AlterTable
ALTER TABLE "BillingAccount" DROP COLUMN "customerId",
ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "country" VARCHAR(2),
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "taxId" TEXT;

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProductType" NOT NULL,
    "billingInterval" "BillingInterval",
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priceUSD" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductEntitlement" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "entitlementKey" "EntitlementKey" NOT NULL,
    "limitValue" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "billingInterval" "BillingInterval" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionAddOn" (
    "id" SERIAL NOT NULL,
    "subscriptionId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amountCents" INTEGER NOT NULL,
    "stripeItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "metricKey" "UsageMetricKey" NOT NULL,
    "value" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "resourceId" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageSnapshot" (
    "tenantId" INTEGER NOT NULL,
    "metricKey" "UsageMetricKey" NOT NULL,
    "currentValue" INTEGER NOT NULL,
    "limit" INTEGER,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageSnapshot_pkey" PRIMARY KEY ("tenantId","metricKey")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "stripePaymentMethodId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "cardExpMonth" INTEGER,
    "cardExpYear" INTEGER,
    "bankName" TEXT,
    "bankLast4" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "referrerTenantId" INTEGER NOT NULL,
    "refereeDiscountStripeCouponId" TEXT,
    "referrerCreditCents" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" SERIAL NOT NULL,
    "codeId" INTEGER NOT NULL,
    "referrerTenantId" INTEGER NOT NULL,
    "refereeTenantId" INTEGER NOT NULL,
    "refereeDiscountApplied" BOOLEAN NOT NULL DEFAULT false,
    "refereeStripeCouponId" TEXT,
    "referrerCreditApplied" BOOLEAN NOT NULL DEFAULT false,
    "referrerCreditCents" INTEGER,
    "referrerCreditedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER,
    "serviceProviderId" INTEGER,
    "listingType" "ListingType" NOT NULL,
    "category" "AnimalCategory",
    "title" TEXT NOT NULL,
    "description" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" VARCHAR(2) NOT NULL DEFAULT 'US',
    "images" JSONB,
    "videoUrl" TEXT,
    "priceCents" INTEGER,
    "priceType" TEXT,
    "tier" "ListingTier" NOT NULL DEFAULT 'FREE',
    "monthlyFeeCents" INTEGER,
    "commissionRate" DOUBLE PRECISION,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "slug" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "inquiryCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceProviderProfile" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" VARCHAR(2) NOT NULL DEFAULT 'US',
    "plan" "ListingTier" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProviderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_stripeProductId_key" ON "Product"("stripeProductId");

-- CreateIndex
CREATE INDEX "Product_type_active_idx" ON "Product"("type", "active");

-- CreateIndex
CREATE INDEX "Product_active_sortOrder_idx" ON "Product"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductEntitlement_productId_idx" ON "ProductEntitlement"("productId");

-- CreateIndex
CREATE INDEX "ProductEntitlement_entitlementKey_idx" ON "ProductEntitlement"("entitlementKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductEntitlement_productId_entitlementKey_key" ON "ProductEntitlement"("productId", "entitlementKey");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "SubscriptionAddOn_subscriptionId_idx" ON "SubscriptionAddOn"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionAddOn_productId_idx" ON "SubscriptionAddOn"("productId");

-- CreateIndex
CREATE INDEX "UsageRecord_tenantId_metricKey_recordedAt_idx" ON "UsageRecord"("tenantId", "metricKey", "recordedAt");

-- CreateIndex
CREATE INDEX "UsageRecord_recordedAt_idx" ON "UsageRecord"("recordedAt");

-- CreateIndex
CREATE INDEX "UsageSnapshot_tenantId_idx" ON "UsageSnapshot"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_stripePaymentMethodId_key" ON "PaymentMethod"("stripePaymentMethodId");

-- CreateIndex
CREATE INDEX "PaymentMethod_tenantId_idx" ON "PaymentMethod"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentMethod_tenantId_isDefault_idx" ON "PaymentMethod"("tenantId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralCode_referrerTenantId_idx" ON "ReferralCode"("referrerTenantId");

-- CreateIndex
CREATE INDEX "ReferralCode_code_idx" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralCode_active_expiresAt_idx" ON "ReferralCode"("active", "expiresAt");

-- CreateIndex
CREATE INDEX "Referral_referrerTenantId_idx" ON "Referral"("referrerTenantId");

-- CreateIndex
CREATE INDEX "Referral_refereeTenantId_idx" ON "Referral"("refereeTenantId");

-- CreateIndex
CREATE INDEX "Referral_codeId_idx" ON "Referral"("codeId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_codeId_refereeTenantId_key" ON "Referral"("codeId", "refereeTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceListing_slug_key" ON "MarketplaceListing"("slug");

-- CreateIndex
CREATE INDEX "MarketplaceListing_tenantId_idx" ON "MarketplaceListing"("tenantId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_serviceProviderId_idx" ON "MarketplaceListing"("serviceProviderId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_publishedAt_idx" ON "MarketplaceListing"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "MarketplaceListing_listingType_category_idx" ON "MarketplaceListing"("listingType", "category");

-- CreateIndex
CREATE INDEX "MarketplaceListing_tier_idx" ON "MarketplaceListing"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProviderProfile_userId_key" ON "ServiceProviderProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProviderProfile_stripeCustomerId_key" ON "ServiceProviderProfile"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProviderProfile_stripeSubscriptionId_key" ON "ServiceProviderProfile"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "ServiceProviderProfile_userId_idx" ON "ServiceProviderProfile"("userId");

-- CreateIndex
CREATE INDEX "ServiceProviderProfile_plan_idx" ON "ServiceProviderProfile"("plan");

-- CreateIndex
CREATE INDEX "SystemConfig_key_idx" ON "SystemConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_stripeCustomerId_key" ON "BillingAccount"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "BillingAccount_stripeCustomerId_idx" ON "BillingAccount"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "ProductEntitlement" ADD CONSTRAINT "ProductEntitlement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionAddOn" ADD CONSTRAINT "SubscriptionAddOn_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionAddOn" ADD CONSTRAINT "SubscriptionAddOn_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageSnapshot" ADD CONSTRAINT "UsageSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_referrerTenantId_fkey" FOREIGN KEY ("referrerTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerTenantId_fkey" FOREIGN KEY ("referrerTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeTenantId_fkey" FOREIGN KEY ("refereeTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_serviceProviderId_fkey" FOREIGN KEY ("serviceProviderId") REFERENCES "ServiceProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProviderProfile" ADD CONSTRAINT "ServiceProviderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
