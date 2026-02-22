-- migrate:up
-- Creates marketplace.international_waitlist to capture interest from users
-- in countries not yet supported by BreederHQ. Tracks email, country, and
-- source (e.g. registration_gate) so we can notify users when we expand.

CREATE TABLE marketplace.international_waitlist (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  country VARCHAR(10) NOT NULL,
  country_name VARCHAR(100),
  source VARCHAR(50) NOT NULL DEFAULT 'registration_gate',
  notes TEXT,
  notified_at TIMESTAMP,
  created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Prevent duplicate entries for the same email+country combination
CREATE UNIQUE INDEX idx_intl_waitlist_email_country
  ON marketplace.international_waitlist (email, country);

-- For querying "how many entries from Brazil?" etc.
CREATE INDEX idx_intl_waitlist_country
  ON marketplace.international_waitlist (country);

-- For sending notification blasts to users not yet notified
CREATE INDEX idx_intl_waitlist_notified_at
  ON marketplace.international_waitlist (notified_at);

-- migrate:down
DROP TABLE IF EXISTS marketplace.international_waitlist;
