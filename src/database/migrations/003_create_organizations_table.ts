/**
 * Migration 003: Create Organization table
 *
 * Supports enterprise and team plans with:
 * - Organization-level membership
 * - GitHub integration at org level
 * - Shared plan quota
 */

export const up = `
-- Create Organization table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    members UUID[] NOT NULL DEFAULT '{}',
    plan VARCHAR(50) NOT NULL DEFAULT 'enterprise',
    github_installation_id TEXT,
    gitlab_integration_token_encrypted BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_orgs_owner ON organizations(owner_user_id);
CREATE INDEX idx_orgs_plan ON organizations(plan);
CREATE INDEX idx_orgs_github ON organizations(github_installation_id);
`;

export const down = `
DROP TABLE organizations;
`;

export default {
    up,
    down,
    name: '003_create_organizations_table',
    description: 'Create Organization table for enterprise/team plans'
};
