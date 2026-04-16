/**
 * Migration 021: Create cve_remediation_items table
 *
 * Stores user remediation progress for CVEs discovered in scans.
 */

export const up = `
CREATE TABLE IF NOT EXISTS cve_remediation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cve_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (scan_id, cve_id)
);

CREATE INDEX IF NOT EXISTS idx_cve_remediation_scan_id ON cve_remediation_items(scan_id);
CREATE INDEX IF NOT EXISTS idx_cve_remediation_user_id ON cve_remediation_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cve_remediation_status ON cve_remediation_items(status);
`;

export const down = `
DROP TABLE IF EXISTS cve_remediation_items;
`;

export default {
    up,
    down,
    name: '021_create_cve_remediation_items_table',
    description: 'Create cve_remediation_items table for CVE remediation tracking',
};
