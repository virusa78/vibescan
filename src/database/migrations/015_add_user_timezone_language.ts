/**
 * Migration 015: Add timezone and language to users table
 *
 * Adds user preference columns for localization:
 * - timezone: User's timezone (default UTC)
 * - language: User's preferred language (default en)
 */

export const up = `
-- Add timezone and language columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'en';

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone);
CREATE INDEX IF NOT EXISTS idx_users_language ON users(language);
`;

export const down = `
-- Remove indexes
DROP INDEX IF EXISTS idx_users_timezone;
DROP INDEX IF EXISTS idx_users_language;

-- Remove columns
ALTER TABLE users
DROP COLUMN IF EXISTS timezone,
DROP COLUMN IF EXISTS language;
`;

export default {
    up,
    down,
    name: '015_add_user_timezone_language',
    description: 'Add timezone and language columns to users table'
};
