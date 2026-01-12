-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "marketplace";

-- CreateTable
CREATE TABLE "marketplace"."users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "user_type" TEXT NOT NULL DEFAULT 'buyer',
    "tenant_id" INTEGER,
    "tenant_verified" BOOLEAN NOT NULL DEFAULT false,
    "stripe_customer_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."providers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider_type" TEXT NOT NULL,
    "tenant_id" INTEGER,
    "business_name" TEXT NOT NULL,
    "business_description" TEXT,
    "city" TEXT,
    "state" TEXT,
    "stripe_connect_account_id" TEXT,
    "stripe_connect_onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "stripe_connect_payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "payment_mode" TEXT NOT NULL DEFAULT 'manual',
    "payment_instructions" TEXT,
    "total_listings" INTEGER NOT NULL DEFAULT 0,
    "total_transactions" INTEGER NOT NULL DEFAULT 0,
    "total_revenue_cents" BIGINT NOT NULL DEFAULT 0,
    "average_rating" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."service_listings" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "price_cents" BIGINT,
    "price_type" TEXT,
    "city" TEXT,
    "state" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."transactions" (
    "id" BIGSERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "listing_id" INTEGER,
    "service_description" TEXT NOT NULL,
    "invoice_type" TEXT NOT NULL,
    "tenant_id" INTEGER,
    "invoice_id" INTEGER NOT NULL,
    "total_cents" BIGINT NOT NULL,
    "platform_fee_cents" BIGINT NOT NULL DEFAULT 0,
    "provider_payout_cents" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'pending_invoice',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiced_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."invoices" (
    "id" SERIAL NOT NULL,
    "transaction_id" BIGINT NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "total_cents" BIGINT NOT NULL,
    "balance_cents" BIGINT NOT NULL,
    "refunded_cents" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payment_mode" TEXT NOT NULL,
    "payment_mode_locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripe_invoice_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "buyer_marked_paid_at" TIMESTAMP(3),
    "buyer_payment_method" TEXT,
    "buyer_payment_reference" TEXT,
    "provider_confirmed_at" TIMESTAMP(3),
    "provider_confirmed_by" INTEGER,
    "issued_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."message_threads" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "listing_id" INTEGER,
    "transaction_id" BIGINT,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."messages" (
    "id" BIGSERIAL NOT NULL,
    "thread_id" INTEGER NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "message_text" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "marketplace"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "marketplace"."users"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "marketplace"."users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "marketplace"."users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_stripe_customer_id_idx" ON "marketplace"."users"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "providers_user_id_key" ON "marketplace"."providers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "providers_stripe_connect_account_id_key" ON "marketplace"."providers"("stripe_connect_account_id");

-- CreateIndex
CREATE INDEX "providers_user_id_idx" ON "marketplace"."providers"("user_id");

-- CreateIndex
CREATE INDEX "providers_tenant_id_idx" ON "marketplace"."providers"("tenant_id");

-- CreateIndex
CREATE INDEX "providers_stripe_connect_account_id_idx" ON "marketplace"."providers"("stripe_connect_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_listings_slug_key" ON "marketplace"."service_listings"("slug");

-- CreateIndex
CREATE INDEX "service_listings_provider_id_idx" ON "marketplace"."service_listings"("provider_id");

-- CreateIndex
CREATE INDEX "service_listings_category_status_idx" ON "marketplace"."service_listings"("category", "status");

-- CreateIndex
CREATE INDEX "service_listings_state_city_status_idx" ON "marketplace"."service_listings"("state", "city", "status");

-- CreateIndex
CREATE INDEX "transactions_client_id_status_created_at_idx" ON "marketplace"."transactions"("client_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "transactions_provider_id_status_created_at_idx" ON "marketplace"."transactions"("provider_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "transactions_listing_id_idx" ON "marketplace"."transactions"("listing_id");

-- CreateIndex
CREATE INDEX "transactions_invoice_type_tenant_id_invoice_id_idx" ON "marketplace"."transactions"("invoice_type", "tenant_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_transaction_id_key" ON "marketplace"."invoices"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "marketplace"."invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripe_invoice_id_key" ON "marketplace"."invoices"("stripe_invoice_id");

-- CreateIndex
CREATE INDEX "invoices_transaction_id_idx" ON "marketplace"."invoices"("transaction_id");

-- CreateIndex
CREATE INDEX "invoices_provider_id_status_created_at_idx" ON "marketplace"."invoices"("provider_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "invoices_client_id_status_created_at_idx" ON "marketplace"."invoices"("client_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "invoices_stripe_invoice_id_idx" ON "marketplace"."invoices"("stripe_invoice_id");

-- CreateIndex
CREATE INDEX "message_threads_client_id_last_message_at_idx" ON "marketplace"."message_threads"("client_id", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "message_threads_provider_id_last_message_at_idx" ON "marketplace"."message_threads"("provider_id", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "messages_thread_id_created_at_idx" ON "marketplace"."messages"("thread_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "marketplace"."providers" ADD CONSTRAINT "providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "marketplace"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."service_listings" ADD CONSTRAINT "service_listings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "marketplace"."providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."transactions" ADD CONSTRAINT "transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "marketplace"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."transactions" ADD CONSTRAINT "transactions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "marketplace"."providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."transactions" ADD CONSTRAINT "transactions_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace"."service_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."invoices" ADD CONSTRAINT "invoices_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace"."transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."invoices" ADD CONSTRAINT "invoices_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "marketplace"."providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "marketplace"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."message_threads" ADD CONSTRAINT "message_threads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "marketplace"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."message_threads" ADD CONSTRAINT "message_threads_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "marketplace"."providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."message_threads" ADD CONSTRAINT "message_threads_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace"."service_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."message_threads" ADD CONSTRAINT "message_threads_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace"."transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."messages" ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "marketplace"."message_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "marketplace"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
