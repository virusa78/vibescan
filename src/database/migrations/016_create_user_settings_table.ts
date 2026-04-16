/**
 * Migration 016: Create user_settings table
 *
 * Stores user regional and format preferences:
 * - currency: User's preferred currency (USD, EUR, GBP, INR, PKR)
 * - date_format: Date display format (MM/DD/YYYY, DD/MM/YYYY, auto)
 * - number_format: Number display format (1,000.00, 1.000,00, 1 000,00)
 * - updated_at: Track last modification
 */

export const up = `
-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    date_format VARCHAR(20) NOT NULL DEFAULT 'MM/DD/YYYY',
    number_format VARCHAR(20) NOT NULL DEFAULT '1,000.00',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_user_settings_currency ON user_settings(currency);

-- Add trigger to update updated_at on row modification
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION update_user_settings_updated_at();
`;

export const down = `
-- Drop trigger
DROP TRIGGER IF EXISTS trigger_update_user_settings_updated_at ON user_settings;
DROP FUNCTION IF EXISTS update_user_settings_updated_at;

-- Drop table
DROP TABLE IF EXISTS user_settings;
`;

export default {
    up,
    down,
    name: '016_create_user_settings_table',
    description: 'Create user_settings table for regional preferences'
};
