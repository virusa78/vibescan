/**
 * Migration 014: Create alerts table for alerting system
 *
 * Stores system alerts for monitoring queue backlog, error rates,
 * quota exhaustion, and worker failures.
 */

export const up = `
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_triggered_at ON alerts(triggered_at);
CREATE INDEX idx_alerts_acknowledged_at ON alerts(acknowledged_at);
CREATE INDEX idx_alerts_resolved_at ON alerts(resolved_at);
`;

export const down = `
DROP TABLE alerts;
`;

export default {
    up,
    down,
    name: '014_create_alerts_table',
    description: 'Create alerts table for monitoring system',
};
