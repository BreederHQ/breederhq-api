-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('vaccination_expiring_7d', 'vaccination_expiring_3d', 'vaccination_expiring_1d', 'vaccination_overdue', 'breeding_heat_cycle_expected', 'breeding_hormone_testing_due', 'breeding_window_approaching', 'pregnancy_check_14d', 'pregnancy_check_30d', 'pregnancy_check_overdue', 'foaling_30d', 'foaling_14d', 'foaling_7d', 'foaling_approaching', 'foaling_overdue', 'marketplace_inquiry', 'marketplace_waitlist_signup', 'system_announcement');

-- CreateEnum
CREATE TYPE "public"."NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('UNREAD', 'READ', 'DISMISSED');

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "userId" TEXT,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "linkUrl" TEXT,
    "priority" "public"."NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserNotificationPreferences" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "vaccinationExpiring" BOOLEAN NOT NULL DEFAULT true,
    "vaccinationOverdue" BOOLEAN NOT NULL DEFAULT true,
    "breedingTimeline" BOOLEAN NOT NULL DEFAULT true,
    "pregnancyCheck" BOOLEAN NOT NULL DEFAULT true,
    "foalingApproaching" BOOLEAN NOT NULL DEFAULT true,
    "heatCycleExpected" BOOLEAN NOT NULL DEFAULT true,
    "marketplaceInquiry" BOOLEAN NOT NULL DEFAULT true,
    "waitlistSignup" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "phoneNumber" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_idempotencyKey_key" ON "public"."Notification"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_status_idx" ON "public"."Notification"("tenantId", "userId", "status");

-- CreateIndex
CREATE INDEX "Notification_tenantId_status_createdAt_idx" ON "public"."Notification"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "public"."Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "public"."Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationPreferences_userId_key" ON "public"."UserNotificationPreferences"("userId");

-- CreateIndex
CREATE INDEX "UserNotificationPreferences_tenantId_idx" ON "public"."UserNotificationPreferences"("tenantId");

-- CreateIndex
CREATE INDEX "UserNotificationPreferences_userId_idx" ON "public"."UserNotificationPreferences"("userId");

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserNotificationPreferences" ADD CONSTRAINT "UserNotificationPreferences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserNotificationPreferences" ADD CONSTRAINT "UserNotificationPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
