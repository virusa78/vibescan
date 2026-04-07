/**
 * Migration 005: Create ScanResult table (dual-scanner support)
 *
 * Stores results from both free and enterprise scanners:
 * - Dual rows per scan (free + enterprise)
 * - Raw output from scanners
 * - Normalized vulnerabilities array
 * - Scanner version and CVE database timestamp
 */

export const up = `
-- Create ScanResult table
CREATE TABLE scan_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    source VARCHAR(20) NOT NULL CHECK (source IN ('free', 'enterprise')),
    raw_output JSONB NOT NULL,
    vulnerabilities JSONB NOT NULL,
    scanner_version VARCHAR(100) NOT NULL,
    cve_db_timestamp TIMESTAMPTZ NOT NULL,
    duration_ms INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_scan_results_scan_id ON scan_results(scan_id);
CREATE INDEX idx_scan_results_source ON scan_results(source);
CREATE INDEX idx_scan_results_created_at ON scan_results(created_at);

-- Unique constraint: one result per scan per source
CREATE UNIQUE INDEX idx_scan_results_unique ON scan_results(scan_id, source);
`;

export const down = `
DROP TABLE scan_results;
`;

export default {
    up,
    down,
    name: '005_create_scan_results_table',
    description: 'Create ScanResult table for dual-scanner support'
};
