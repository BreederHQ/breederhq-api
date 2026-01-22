-- Marketplace Production Enhancements
-- Adds fields needed for world-class marketplace platform
-- Run after Phase 2 migration

-- =============================================================================
-- MARKETPLACE USERS - Add address, verification, auth tokens
-- =============================================================================

ALTER TABLE marketplace.users ADD COLUMN address_line1 VARCHAR(255);
ALTER TABLE marketplace.users ADD COLUMN address_line2 VARCHAR(255);
ALTER TABLE marketplace.users ADD COLUMN city VARCHAR(100);
ALTER TABLE marketplace.users ADD COLUMN state VARCHAR(100);
ALTER TABLE marketplace.users ADD COLUMN zip VARCHAR(20);
ALTER TABLE marketplace.users ADD COLUMN country VARCHAR(2) DEFAULT 'US';

ALTER TABLE marketplace.users ADD COLUMN suspended_at TIMESTAMP;
ALTER TABLE marketplace.users ADD COLUMN suspended_reason TEXT;

ALTER TABLE marketplace.users ADD COLUMN email_verify_token VARCHAR(255) UNIQUE;
ALTER TABLE marketplace.users ADD COLUMN email_verify_expires TIMESTAMP;

ALTER TABLE marketplace.users ADD COLUMN password_reset_token VARCHAR(255) UNIQUE;
ALTER TABLE marketplace.users ADD COLUMN password_reset_expires TIMESTAMP;

ALTER TABLE marketplace.users ADD COLUMN last_login_at TIMESTAMP;
ALTER TABLE marketplace.users ADD COLUMN deleted_at TIMESTAMP;

CREATE INDEX idx_marketplace_users_deleted_at ON marketplace.users(deleted_at);
CREATE INDEX idx_marketplace_users_status ON marketplace.users(status);

-- =============================================================================
-- MARKETPLACE PROVIDERS - Add business details, stats, badges
-- =============================================================================

ALTER TABLE marketplace.providers ADD COLUMN logo_url VARCHAR(500);
ALTER TABLE marketplace.providers ADD COLUMN cover_image_url VARCHAR(500);

ALTER TABLE marketplace.providers ADD COLUMN public_email VARCHAR(255);
ALTER TABLE marketplace.providers ADD COLUMN public_phone VARCHAR(50);
ALTER TABLE marketplace.providers ADD COLUMN website VARCHAR(500);

ALTER TABLE marketplace.providers ADD COLUMN zip VARCHAR(20);
ALTER TABLE marketplace.providers ADD COLUMN country VARCHAR(2) DEFAULT 'US';

ALTER TABLE marketplace.providers ADD COLUMN stripe_connect_details_submitted BOOLEAN DEFAULT FALSE;

ALTER TABLE marketplace.providers ADD COLUMN business_hours JSONB;
ALTER TABLE marketplace.providers ADD COLUMN time_zone VARCHAR(100) DEFAULT 'America/New_York';

ALTER TABLE marketplace.providers ADD COLUMN active_listings INTEGER DEFAULT 0;
ALTER TABLE marketplace.providers ADD COLUMN completed_transactions INTEGER DEFAULT 0;
ALTER TABLE marketplace.providers ADD COLUMN lifetime_payout_cents BIGINT DEFAULT 0;
ALTER TABLE marketplace.providers ADD COLUMN total_reviews INTEGER DEFAULT 0;

ALTER TABLE marketplace.providers ADD COLUMN verified_provider BOOLEAN DEFAULT FALSE;
ALTER TABLE marketplace.providers ADD COLUMN premium_provider BOOLEAN DEFAULT FALSE;
ALTER TABLE marketplace.providers ADD COLUMN quick_responder BOOLEAN DEFAULT FALSE;

ALTER TABLE marketplace.providers ADD COLUMN activated_at TIMESTAMP;
ALTER TABLE marketplace.providers ADD COLUMN suspended_at TIMESTAMP;
ALTER TABLE marketplace.providers ADD COLUMN suspended_reason TEXT;
ALTER TABLE marketplace.providers ADD COLUMN deleted_at TIMESTAMP;

CREATE INDEX idx_marketplace_providers_status_activated ON marketplace.providers(status, activated_at);
CREATE INDEX idx_marketplace_providers_location ON marketplace.providers(city, state, status);
CREATE INDEX idx_marketplace_providers_deleted_at ON marketplace.providers(deleted_at);

-- =============================================================================
-- SERVICE LISTINGS - Add images, SEO, stats
-- =============================================================================

ALTER TABLE marketplace.service_listings ADD COLUMN subcategory VARCHAR(100);
ALTER TABLE marketplace.service_listings ADD COLUMN price_text VARCHAR(255);
ALTER TABLE marketplace.service_listings ADD COLUMN images JSONB;
ALTER TABLE marketplace.service_listings ADD COLUMN cover_image_url VARCHAR(500);

ALTER TABLE marketplace.service_listings ADD COLUMN zip VARCHAR(20);

ALTER TABLE marketplace.service_listings ADD COLUMN duration VARCHAR(100);
ALTER TABLE marketplace.service_listings ADD COLUMN availability VARCHAR(255);

ALTER TABLE marketplace.service_listings ADD COLUMN meta_description TEXT;
ALTER TABLE marketplace.service_listings ADD COLUMN keywords VARCHAR(500);

ALTER TABLE marketplace.service_listings ADD COLUMN view_count INTEGER DEFAULT 0;
ALTER TABLE marketplace.service_listings ADD COLUMN inquiry_count INTEGER DEFAULT 0;
ALTER TABLE marketplace.service_listings ADD COLUMN booking_count INTEGER DEFAULT 0;

ALTER TABLE marketplace.service_listings ADD COLUMN paused_at TIMESTAMP;
ALTER TABLE marketplace.service_listings ADD COLUMN deleted_at TIMESTAMP;

CREATE INDEX idx_marketplace_listings_slug ON marketplace.service_listings(slug);
CREATE INDEX idx_marketplace_listings_deleted_at ON marketplace.service_listings(deleted_at);

-- =============================================================================
-- TRANSACTIONS - Add pricing breakdown, tax, cancellation
-- =============================================================================

ALTER TABLE marketplace.transactions ADD COLUMN service_notes TEXT;

ALTER TABLE marketplace.transactions ADD COLUMN service_price_cents BIGINT NOT NULL DEFAULT 0;
ALTER TABLE marketplace.transactions ADD COLUMN stripe_fees_cents BIGINT DEFAULT 0;
ALTER TABLE marketplace.transactions ADD COLUMN tax_cents BIGINT DEFAULT 0;
ALTER TABLE marketplace.transactions ADD COLUMN tax_rate DECIMAL(5,4);

ALTER TABLE marketplace.transactions ADD COLUMN invoice_id INTEGER UNIQUE;

ALTER TABLE marketplace.transactions ADD COLUMN started_at TIMESTAMP;
ALTER TABLE marketplace.transactions ADD COLUMN cancelled_at TIMESTAMP;
ALTER TABLE marketplace.transactions ADD COLUMN refunded_at TIMESTAMP;

ALTER TABLE marketplace.transactions ADD COLUMN cancellation_reason TEXT;
ALTER TABLE marketplace.transactions ADD COLUMN cancelled_by VARCHAR(50);
ALTER TABLE marketplace.transactions ADD COLUMN refund_amount_cents BIGINT DEFAULT 0;
ALTER TABLE marketplace.transactions ADD COLUMN refund_reason TEXT;

-- Update existing total_cents calculation
COMMENT ON COLUMN marketplace.transactions.total_cents IS 'service_price + platform_fee + tax';

CREATE INDEX idx_marketplace_transactions_invoice ON marketplace.transactions(invoice_id);
CREATE INDEX idx_marketplace_transactions_status_paid ON marketplace.transactions(status, paid_at);

-- =============================================================================
-- INVOICES - Add payment details, manual confirmation
-- =============================================================================

ALTER TABLE marketplace.invoices ADD COLUMN subtotal_cents BIGINT NOT NULL DEFAULT 0;
ALTER TABLE marketplace.invoices ADD COLUMN tax_cents BIGINT DEFAULT 0;
ALTER TABLE marketplace.invoices ADD COLUMN paid_cents BIGINT DEFAULT 0;

ALTER TABLE marketplace.invoices ADD COLUMN payment_method VARCHAR(50) DEFAULT 'stripe';
ALTER TABLE marketplace.invoices ADD COLUMN stripe_charge_id VARCHAR(255);

ALTER TABLE marketplace.invoices ADD COLUMN manual_payment_marked_at TIMESTAMP;
ALTER TABLE marketplace.invoices ADD COLUMN manual_payment_method VARCHAR(50);
ALTER TABLE marketplace.invoices ADD COLUMN manual_payment_reference VARCHAR(255);
ALTER TABLE marketplace.invoices ADD COLUMN manual_payment_confirmed_by INTEGER;

ALTER TABLE marketplace.invoices ADD COLUMN sent_at TIMESTAMP;
ALTER TABLE marketplace.invoices ADD COLUMN viewed_at TIMESTAMP;
ALTER TABLE marketplace.invoices ADD COLUMN refunded_at TIMESTAMP;
ALTER TABLE marketplace.invoices ADD COLUMN voided_at TIMESTAMP;

ALTER TABLE marketplace.invoices ADD COLUMN notes TEXT;
ALTER TABLE marketplace.invoices ADD COLUMN internal_notes TEXT;

CREATE INDEX idx_marketplace_invoices_status_due ON marketplace.invoices(status, due_at);
CREATE INDEX idx_marketplace_invoices_stripe_charge ON marketplace.invoices(stripe_charge_id);

-- =============================================================================
-- NEW TABLE: REVIEWS
-- =============================================================================

CREATE TABLE marketplace.reviews (
  id SERIAL PRIMARY KEY,
  transaction_id BIGINT UNIQUE NOT NULL,
  provider_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  listing_id INTEGER,

  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  review_text TEXT,

  provider_response TEXT,
  responded_at TIMESTAMP,

  status VARCHAR(50) DEFAULT 'published' NOT NULL,
  flagged_reason TEXT,

  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_marketplace_reviews_provider ON marketplace.reviews(provider_id, status, created_at DESC);
CREATE INDEX idx_marketplace_reviews_client ON marketplace.reviews(client_id);
CREATE INDEX idx_marketplace_reviews_listing ON marketplace.reviews(listing_id, status);
CREATE INDEX idx_marketplace_reviews_rating ON marketplace.reviews(rating, status);

-- =============================================================================
-- NEW TABLE: SAVED LISTINGS (Favorites)
-- =============================================================================

CREATE TABLE marketplace.saved_listings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  listing_id INTEGER NOT NULL,
  saved_at TIMESTAMP DEFAULT NOW() NOT NULL,

  UNIQUE(user_id, listing_id)
);

CREATE INDEX idx_marketplace_saved_listings_user ON marketplace.saved_listings(user_id, saved_at DESC);
CREATE INDEX idx_marketplace_saved_listings_listing ON marketplace.saved_listings(listing_id);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE marketplace.users IS 'Marketplace buyer and provider user accounts';
COMMENT ON TABLE marketplace.providers IS 'Service providers (can also be breeders)';
COMMENT ON TABLE marketplace.service_listings IS 'Service listings (grooming, training, etc.)';
COMMENT ON TABLE marketplace.transactions IS 'All marketplace transactions';
COMMENT ON TABLE marketplace.invoices IS 'Payment invoices for transactions';
COMMENT ON TABLE marketplace.message_threads IS 'Message threads between clients and providers';
COMMENT ON TABLE marketplace.messages IS 'Individual messages in threads';
COMMENT ON TABLE marketplace.reviews IS 'Reviews and ratings for completed transactions';
COMMENT ON TABLE marketplace.saved_listings IS 'User saved/favorite listings';

-- =============================================================================
-- GRANT PERMISSIONS (if needed)
-- =============================================================================

-- GRANT ALL ON SCHEMA marketplace TO bhq_migrator;
-- GRANT ALL ON ALL TABLES IN SCHEMA marketplace TO bhq_migrator;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA marketplace TO bhq_migrator;
