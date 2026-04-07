/**
 * Migration 006: Create ScanDelta table
 *
 * Stores delta comparison results:
 * - Enterprise-only vulnerabilities (the "paywall" feature)
 * - Severity breakdown for quick summary
 * - Lock status for starter plan enforcement
 */

export const up = `
-- Create ScanDelta table
CREATE TABLE scan_deltas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    total_free_count INTEGER NOT NULL DEFAULT 0,
    total_enterprise_count INTEGER NOT NULL DEFAULT 0,
    delta_count INTEGER NOT NULL DEFAULT 0,
    delta_by_severity JSONB NOT NULL DEFAULT '{"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}',
    delta_vulnerabilities JSONB,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_scan_deltas_scan_id ON scan_deltas(scan_id);
CREATE INDEX idx_scan_deltas_delta_count ON scan_deltas(delta_count);
`;

export const down = `
DROP TABLE scan_deltas;
`;

export default {
    up,
    down,
    name: '006_create_scan_deltas_table',
    description: 'Create ScanDelta table for delta comparison results'
};
