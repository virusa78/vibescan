/**
 * Migration 007: Create ApiKey table with bcrypt hashes
 *
 * API key management for CI/CD integration:
 * - Full keys never stored (only bcrypt hash)
 * - Key prefix stored for lookup
 * - Scopes for fine-grained permissions
 * - Expiration and revocation support
 */

export const up = `
-- Create ApiKey table
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_prefix VARCHAR(8) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    scopes VARCHAR(50)[] NOT NULL DEFAULT ARRAY['scan_read'],
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(revoked_at) WHERE revoked_at IS NULL;

-- Unique constraint on prefix (should be unique)
CREATE UNIQUE INDEX idx_api_keys_unique_prefix ON api_keys(key_prefix);
`;

export const down = `
DROP TABLE api_keys;
`;

export default {
    up,
    down,
    name: '007_create_api_keys_table',
    description: 'Create ApiKey table with bcrypt-hashed storage'
};
