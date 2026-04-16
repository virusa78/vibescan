/**
 * Migration 020: Create settings_backups table
 *
 * Stores user settings backups for restoration:
 * - id: Unique identifier for the backup
 * - user_id: User who owns the backup
 * - backup_data: JSONB with all settings data
 * - backup_timestamp: When the backup was created
 * - created_at: When the backup record was created
 */

export const up = `
-- Create settings_backups table
CREATE TABLE IF NOT EXISTS settings_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    backup_data JSONB NOT NULL DEFAULT '{}',
    backup_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_settings_backups_user_id ON settings_backups(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_backups_backup_timestamp ON settings_backups(backup_timestamp DESC);

-- Create index for cleanup of old backups
CREATE INDEX IF NOT EXISTS idx_settings_backups_created_at ON settings_backups(created_at);
`;

export const down = `
-- Drop table
DROP TABLE IF EXISTS settings_backups;
`;

export default {
    up,
    down,
    name: '020_create_settings_backups_table',
    description: 'Create settings_backups table for settings backup/restore'
};
