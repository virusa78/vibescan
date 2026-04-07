/**
 * Migration 002: Create User table with encrypted fields
 *
 * Stores user accounts with:
 * - bcrypt-hashed passwords
 * - Encrypted Stripe IDs at rest
 * - API key hashes (bcrypt)
 * - Plan and region information
 */

export const up = `
-- Create User table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    plan VARCHAR(50) NOT NULL DEFAULT 'free_trial',
    stripe_customer_id_encrypted BYTEA,
    stripe_subscription_id_encrypted BYTEA,
    api_key_hash VARCHAR(255),
    api_key_created_at TIMESTAMPTZ,
    webhook_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    region VARCHAR(10) NOT NULL DEFAULT 'OTHER',
    encrypted_at_rest TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_plan ON users(plan);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id_encrypted);
CREATE INDEX idx_users_api_key_hash ON users(api_key_hash);
CREATE INDEX idx_users_last_active ON users(last_active_at);
CREATE INDEX idx_users_region ON users(region);

-- Row-level security can be enabled per table as needed
-- For now, we use application-level authorization
`;

export const down = `
DROP TABLE users;
`;

export default {
    up,
    down,
    name: '002_create_users_table',
    description: 'Create User table with encrypted Stripe IDs'
};
