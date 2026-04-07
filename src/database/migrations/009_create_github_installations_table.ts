/**
 * Migration 009: Create GithubInstallation table
 *
 * GitHub App installation management:
 * - Installation ID from GitHub OAuth
 * - Repo scope configuration
 * - Trigger configuration for push/PR events
 */

export const up = `
-- Create GithubInstallation table
CREATE TABLE github_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    github_installation_id BIGINT NOT NULL,
    github_app_id VARCHAR(100) NOT NULL,
    repos_scope TEXT[] NOT NULL DEFAULT '{}',
    trigger_on_push BOOLEAN NOT NULL DEFAULT TRUE,
    trigger_on_pr BOOLEAN NOT NULL DEFAULT TRUE,
    target_branches TEXT[] NOT NULL DEFAULT ARRAY['main', 'develop'],
    fail_pr_on_severity VARCHAR(20) NOT NULL DEFAULT 'CRITICAL' CHECK (fail_pr_on_severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_github_installations_org_id ON github_installations(org_id);
CREATE INDEX idx_github_installations_installation_id ON github_installations(github_installation_id);
`;

export const down = `
DROP TABLE github_installations;
`;

export default {
    up,
    down,
    name: '009_create_github_installations_table',
    description: 'Create GithubInstallation table for GitHub App integration'
};
