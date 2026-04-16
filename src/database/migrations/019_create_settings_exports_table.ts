/**
 * Migration 019: Create settings_exports table
 *
 * Stores user data export requests and results:
 * - export_id: Unique identifier for the export
 * - user_id: User who requested the export
 * - s3_key: S3 key where export file is stored
 * - export_timestamp: When the export was created
 * - expires_at: When the export link expires (7 days)
 * - status: Export status (pending, completed, failed)
 * - created_at: When the export request was created
 */

export const up = `
-- Create settings_exports table
CREATE TABLE IF NOT EXISTS settings_exports (
    export_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    s3_key VARCHAR(500) NOT NULL,
    export_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_settings_exports_user_id ON settings_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_exports_status ON settings_exports(status);
CREATE INDEX IF NOT EXISTS idx_settings_exports_expires_at ON settings_exports(expires_at);

-- Create index for cleanup of expired exports
CREATE INDEX IF NOT EXISTS idx_settings_exports_created_at ON settings_exports(created_at);
`;

export const down = `
-- Drop table
DROP TABLE IF EXISTS settings_exports;
`;

export default {
    up,
    down,
    name: '019_create_settings_exports_table',
    description: 'Create settings_exports table for data export tracking'
};
