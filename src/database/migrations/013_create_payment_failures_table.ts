/**
 * Migration 013: Create payment_failures table
 *
 * Tracks failed payment attempts for subscription management.
 * After 3 failures within 30 days, user is downgraded to starter plan.
 */

export const up = `
-- Create payment_failures table
CREATE TABLE payment_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_payment_failures_user ON payment_failures(user_id);
CREATE INDEX idx_payment_failures_invoice ON payment_failures(invoice_id);
CREATE INDEX idx_payment_failures_created ON payment_failures(created_at);
`;

export const down = `
DROP TABLE payment_failures;
`;

export default {
    up,
    down,
    name: '013_create_payment_failures_table',
    description: 'Create payment_failures table for tracking failed payments',
};
