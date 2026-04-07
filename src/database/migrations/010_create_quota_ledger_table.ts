/**
 * Migration 010: Create QuotaLedger table
 *
 * Monthly quota tracking:
 * - Scans used vs limit per billing period
 * - Reset tracking with timestamp
 * - Plan snapshot at ledger creation
 */

export const up = `
-- Create QuotaLedger table
CREATE TABLE quota_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL,  -- Format: "2026-04"
    scans_used INTEGER NOT NULL DEFAULT 0,
    scans_limit INTEGER NOT NULL,
    reset_at TIMESTAMPTZ NOT NULL,
    plan_at_creation VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_quota_ledger_user_id ON quota_ledger(user_id);
CREATE INDEX idx_quota_ledger_month ON quota_ledger(month);
CREATE INDEX idx_quota_ledger_user_month ON quota_ledger(user_id, month);

-- Unique constraint: one ledger per user per month
CREATE UNIQUE INDEX idx_quota_ledger_unique ON quota_ledger(user_id, month);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_quota_ledger_updated_at
    BEFORE UPDATE ON quota_ledger
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- Create policy: service role has full access
CREATE POLICY quota_ledger_service ON quota_ledger
`;

export const down = `
DROP TRIGGER IF EXISTS update_quota_ledger_updated_at ON quota_ledger;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE quota_ledger;
`;

export default {
    up,
    down,
    name: '010_create_quota_ledger_table',
    description: 'Create QuotaLedger table for monthly quota tracking'
};
