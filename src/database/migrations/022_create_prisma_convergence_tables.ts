/**
 * Migration 022: Create Prisma convergence domain tables
 *
 * Adds additive tables for Prisma-targeted domain models that are not yet
 * represented as first-class tables in the current migration set.
 */

export const up = `
CREATE TABLE IF NOT EXISTS ai_fix_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vulnerability_id VARCHAR(255) NOT NULL,
    prompt_text TEXT NOT NULL,
    model_name VARCHAR(100),
    response_payload JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'applied', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_fix_prompts_scan_id ON ai_fix_prompts(scan_id);
CREATE INDEX IF NOT EXISTS idx_ai_fix_prompts_user_id ON ai_fix_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_fix_prompts_vulnerability_id ON ai_fix_prompts(vulnerability_id);

CREATE TABLE IF NOT EXISTS security_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL UNIQUE REFERENCES scans(id) ON DELETE CASCADE,
    score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
    grade VARCHAR(2) NOT NULL,
    breakdown JSONB NOT NULL DEFAULT '{}',
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_scores_scan_id ON security_scores(scan_id);
CREATE INDEX IF NOT EXISTS idx_security_scores_score ON security_scores(score);

CREATE TABLE IF NOT EXISTS vuln_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vulnerability_id VARCHAR(255) NOT NULL,
    reason TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'revoked', 'expired')),
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (scan_id, user_id, vulnerability_id)
);

CREATE INDEX IF NOT EXISTS idx_vuln_acceptances_scan_id ON vuln_acceptances(scan_id);
CREATE INDEX IF NOT EXISTS idx_vuln_acceptances_user_id ON vuln_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_vuln_acceptances_status ON vuln_acceptances(status);
`;

export const down = `
DROP TABLE IF EXISTS vuln_acceptances;
DROP TABLE IF EXISTS security_scores;
DROP TABLE IF EXISTS ai_fix_prompts;
`;

export default {
    up,
    down,
    name: '022_create_prisma_convergence_tables',
    description: 'Create additive Prisma convergence tables for AI fix, scoring, and acceptance models',
};
