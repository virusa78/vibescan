/**
 * Migration 025: Create github_scan_checks table
 *
 * Tracks GitHub check-run lifecycle for webhook-triggered scans.
 */

export const up = `
CREATE TABLE IF NOT EXISTS github_scan_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL UNIQUE REFERENCES scans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    github_installation_id BIGINT NOT NULL,
    repository_full_name TEXT NOT NULL,
    head_sha VARCHAR(255) NOT NULL,
    trigger_event VARCHAR(20) NOT NULL CHECK (trigger_event IN ('push', 'pull_request')),
    delivery_id VARCHAR(255),
    check_run_id BIGINT,
    fail_on_severity VARCHAR(20) NOT NULL DEFAULT 'CRITICAL' CHECK (fail_on_severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'completed', 'failed')),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_github_scan_checks_scan_id ON github_scan_checks(scan_id);
CREATE INDEX IF NOT EXISTS idx_github_scan_checks_installation_id ON github_scan_checks(github_installation_id);
CREATE INDEX IF NOT EXISTS idx_github_scan_checks_delivery_id ON github_scan_checks(delivery_id);
`;

export const down = `
DROP TABLE IF EXISTS github_scan_checks;
`;

export default {
    up,
    down,
    name: '025_create_github_scan_checks_table',
    description: 'Track GitHub check-run lifecycle for webhook-triggered scans'
};
