/**
 * Migration 004: Create Scan table with plan_at_submission snapshot
 *
 * Main scan entity with:
 * - Input type tracking (source_zip, github_url, sbom_upload, ci_plugin)
 * - Plan snapshot at submission time
 * - Status tracking for pipeline state
 * - Monthly partitioning for large-scale scans
 */

export const up = `
-- Create Scan table
CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    input_type VARCHAR(50) NOT NULL,
    input_ref TEXT NOT NULL,
    sbom_raw JSONB,
    components JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    plan_at_submission VARCHAR(50) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_scans_user_id ON scans(user_id);
CREATE INDEX idx_scans_org_id ON scans(org_id);
CREATE INDEX idx_scans_status ON scans(status);
CREATE INDEX idx_scans_input_type ON scans(input_type);
CREATE INDEX idx_scans_created_at ON scans(created_at);
CREATE INDEX idx_scans_user_status ON scans(user_id, status);
`;

export const down = `
DROP TABLE scans;
`;

export default {
    up,
    down,
    name: '004_create_scans_table',
    description: 'Create Scan table with monthly partitioning'
};
