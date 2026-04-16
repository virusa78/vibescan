/**
 * Migration 018: Create settings_audit_logs table
 *
 * Stores audit trail for all settings changes:
 * - event_type: Type of event (profile_update, api_key_created, etc.)
 * - user_id: User who made the change
 * - metadata: JSONB with event details
 * - ip_address: IP address of the request (optional)
 * - user_agent: User agent string (optional)
 * - created_at: Timestamp of the event
 */

export const up = `
-- Create settings_audit_logs table
CREATE TABLE IF NOT EXISTS settings_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metadata JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_settings_audit_logs_user_id ON settings_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_audit_logs_event_type ON settings_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_settings_audit_logs_created_at ON settings_audit_logs(created_at DESC);

-- Create composite index for filtered queries
CREATE INDEX IF NOT EXISTS idx_settings_audit_logs_user_event ON settings_audit_logs(user_id, event_type, created_at DESC);
`;

export const down = `
-- Drop table
DROP TABLE IF EXISTS settings_audit_logs;
`;

export default {
    up,
    down,
    name: '018_create_settings_audit_logs_table',
    description: 'Create settings_audit_logs table for audit trail'
};
