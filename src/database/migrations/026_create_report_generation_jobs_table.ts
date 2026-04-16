/**
 * Migration 026: Create report_generation_jobs table
 *
 * Tracks async PDF report generation lifecycle and artifact location.
 */

export const up = `
CREATE TABLE IF NOT EXISTS report_generation_jobs (
    job_id UUID PRIMARY KEY,
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    format VARCHAR(20) NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf')),
    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    s3_key VARCHAR(500),
    artifact_url TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_generation_jobs_scan_id ON report_generation_jobs(scan_id);
CREATE INDEX IF NOT EXISTS idx_report_generation_jobs_user_id ON report_generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_report_generation_jobs_status ON report_generation_jobs(status);
`;

export const down = `
DROP TABLE IF EXISTS report_generation_jobs;
`;

export default {
    up,
    down,
    name: '026_create_report_generation_jobs_table',
    description: 'Track async report generation jobs and artifacts'
};
