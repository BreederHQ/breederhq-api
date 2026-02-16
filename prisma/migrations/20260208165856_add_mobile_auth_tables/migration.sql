-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "deviceId" VARCHAR(255),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."devices" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "fcmToken" VARCHAR(255) NOT NULL,
    "platform" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "public"."refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "public"."refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tokenHash_idx" ON "public"."refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "devices_userId_idx" ON "public"."devices"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "devices_userId_fcmToken_key" ON "public"."devices"("userId", "fcmToken");

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
