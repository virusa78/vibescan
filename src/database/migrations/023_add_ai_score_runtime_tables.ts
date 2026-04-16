/**
 * Migration 023: Extend AI/scoring runtime tables
 *
 * - Adds ai_fix_prompts.cache_key for deterministic CVE/package/version caching
 * - Adds user-level SLA policy primitives
 */

export const up = `
ALTER TABLE ai_fix_prompts
    ADD COLUMN IF NOT EXISTS cache_key VARCHAR(255);

UPDATE ai_fix_prompts
SET cache_key = vulnerability_id
WHERE cache_key IS NULL OR cache_key = '';

CREATE INDEX IF NOT EXISTS idx_ai_fix_prompts_cache_key ON ai_fix_prompts(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_fix_prompts_user_cache_key_created
    ON ai_fix_prompts(user_id, cache_key, created_at DESC);

CREATE TABLE IF NOT EXISTS vulnerability_sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    severity VARCHAR(16) NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    target_days INTEGER NOT NULL CHECK (target_days > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, severity)
);

CREATE INDEX IF NOT EXISTS idx_vulnerability_sla_policies_user_id
    ON vulnerability_sla_policies(user_id);
`;

export const down = `
DROP TABLE IF EXISTS vulnerability_sla_policies;
DROP INDEX IF EXISTS idx_ai_fix_prompts_user_cache_key_created;
DROP INDEX IF EXISTS idx_ai_fix_prompts_cache_key;
ALTER TABLE ai_fix_prompts DROP COLUMN IF EXISTS cache_key;
`;

export default {
    up,
    down,
    name: '023_add_ai_score_runtime_tables',
    description: 'Add AI prompt cache key and SLA policy primitives',
};
