/**
 * Migration 012: Create additional indexes and future partitions
 *
 * - Additional composite indexes for common query patterns
 * - Future month partitions for scans table
 */

export const up = `
-- Additional composite indexes for common query patterns

-- Scans: user + status for filtering
CREATE INDEX IF NOT EXISTS idx_scans_user_status_created ON scans(user_id, status, created_at);

-- Scans: org + status for organization filtering
CREATE INDEX IF NOT EXISTS idx_scans_org_status_created ON scans(org_id, status, created_at);

-- Scan results: scan + source for quick retrieval
CREATE INDEX IF NOT EXISTS idx_scan_results_scan_source ON scan_results(scan_id, source);

-- Scan results: created_at for duration analysis
CREATE INDEX IF NOT EXISTS idx_scan_results_duration ON scan_results(created_at, duration_ms);

-- Scan deltas: created_at for delta analysis
CREATE INDEX IF NOT EXISTS idx_scan_deltas_created ON scan_deltas(created_at);

-- API keys: active + expires_at for valid key lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_valid ON api_keys(user_id, revoked_at, expires_at)
WHERE revoked_at IS NULL AND expires_at IS NULL;

-- Webhook deliveries: status + next_retry for retry processing
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(status, next_retry_at)
WHERE status = 'pending' AND next_retry_at IS NOT NULL;

-- Webhook deliveries: scan + status for scan-specific deliveries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_scan_status ON webhook_deliveries(scan_id, status);

-- Quota ledger: month + scans_used for quota analysis
CREATE INDEX IF NOT EXISTS idx_quota_ledger_month_used ON quota_ledger(month, scans_used);

-- Note: Scans table is not partitioned (removed for simplicity)
-- Indexes for scans table are created in the main scans table migration
`;

export const down = `
-- Drop indexes
DROP INDEX IF EXISTS idx_scans_user_status_created;
DROP INDEX IF EXISTS idx_scans_org_status_created;
DROP INDEX IF EXISTS idx_scan_results_scan_source;
DROP INDEX IF EXISTS idx_scan_results_duration;
DROP INDEX IF EXISTS idx_scan_deltas_created;
DROP INDEX IF EXISTS idx_api_keys_valid;
DROP INDEX IF EXISTS idx_webhook_deliveries_retry;
DROP INDEX IF EXISTS idx_webhook_deliveries_scan_status;
DROP INDEX IF EXISTS idx_quota_ledger_month_used;
`;

export default {
    up,
    down,
    name: '012_create_indexes_and_partitions',
    description: 'Create additional indexes and future partitions'
};
