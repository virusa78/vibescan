/**
 * Migration 017: Create notification_preferences table
 *
 * Stores user notification preferences:
 * - email_enabled: Enable/disable email notifications
 * - webhook_enabled: Enable/disable webhook notifications
 * - slack_enabled: Enable/disable Slack notifications
 * - preferred_delivery_time: Preferred time for daily digests (HH:MM format)
 * - updated_at: Track last modification
 */

export const up = `
-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    webhook_enabled BOOLEAN NOT NULL DEFAULT true,
    slack_enabled BOOLEAN NOT NULL DEFAULT false,
    preferred_delivery_time VARCHAR(5), -- HH:MM format
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_notification_preferences_email ON notification_preferences(email_enabled);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_webhook ON notification_preferences(webhook_enabled);

-- Add trigger to update updated_at on row modification
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_preferences_updated_at
BEFORE UPDATE ON notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_notification_preferences_updated_at();
`;

export const down = `
-- Drop trigger
DROP TRIGGER IF EXISTS trigger_update_notification_preferences_updated_at ON notification_preferences;
DROP FUNCTION IF EXISTS update_notification_preferences_updated_at;

-- Drop table
DROP TABLE IF EXISTS notification_preferences;
`;

export default {
    up,
    down,
    name: '017_create_notification_preferences_table',
    description: 'Create notification_preferences table'
};
