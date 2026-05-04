DO $$
BEGIN
  CREATE TYPE "OrganizationRole" AS ENUM ('owner', 'admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TeamRole" AS ENUM ('maintainer', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "WorkspaceRole" AS ENUM ('admin', 'member', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "organizations"
  ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "is_personal" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "organizations"
SET "slug" = LOWER(
  REGEXP_REPLACE(COALESCE(NULLIF("name", ''), 'organization'), '[^a-zA-Z0-9]+', '-', 'g')
) || '-' || SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 8)
WHERE "slug" IS NULL;

ALTER TABLE "organizations"
  ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX "organizations_owner_user_id_idx" ON "organizations"("owner_user_id");

CREATE TABLE "organization_memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "OrganizationRole" NOT NULL DEFAULT 'member',
  CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teams" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organization_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "team_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "TeamRole" NOT NULL DEFAULT 'member',
  CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workspaces" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organization_id" UUID NOT NULL,
  "team_id" UUID,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "is_personal" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_by_user_id" UUID NOT NULL,
  CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workspace_memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "workspace_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'member',
  CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "users"
  ADD COLUMN "active_workspace_id" UUID;

ALTER TABLE "api_keys"
  ADD COLUMN "workspace_id" UUID;

ALTER TABLE "project_notification_settings"
  ADD COLUMN "workspace_id" UUID;

ALTER TABLE "scans"
  ADD COLUMN "workspace_id" UUID;

ALTER TABLE "github_installations"
  ADD COLUMN "workspace_id" UUID;

ALTER TABLE "webhooks"
  ADD COLUMN "workspace_id" UUID;

ALTER TABLE "quota_ledger"
  ADD COLUMN "workspace_id" UUID;

CREATE UNIQUE INDEX "organization_memberships_unique" ON "organization_memberships"("organization_id", "user_id");
CREATE INDEX "organization_memberships_user_id_idx" ON "organization_memberships"("user_id");

CREATE UNIQUE INDEX "teams_organization_slug_unique" ON "teams"("organization_id", "slug");
CREATE INDEX "teams_organization_id_idx" ON "teams"("organization_id");

CREATE UNIQUE INDEX "team_memberships_unique" ON "team_memberships"("team_id", "user_id");
CREATE INDEX "team_memberships_user_id_idx" ON "team_memberships"("user_id");

CREATE UNIQUE INDEX "workspaces_organization_slug_unique" ON "workspaces"("organization_id", "slug");
CREATE INDEX "workspaces_organization_id_idx" ON "workspaces"("organization_id");
CREATE INDEX "workspaces_team_id_idx" ON "workspaces"("team_id");
CREATE INDEX "workspaces_created_by_user_id_idx" ON "workspaces"("created_by_user_id");

CREATE UNIQUE INDEX "workspace_memberships_unique" ON "workspace_memberships"("workspace_id", "user_id");
CREATE INDEX "workspace_memberships_user_id_idx" ON "workspace_memberships"("user_id");

CREATE INDEX "users_active_workspace_id_idx" ON "users"("active_workspace_id");
CREATE INDEX "api_keys_workspace_id_idx" ON "api_keys"("workspace_id");
CREATE INDEX "project_notification_settings_workspace_id_idx" ON "project_notification_settings"("workspace_id");
CREATE INDEX "scans_workspace_id_idx" ON "scans"("workspace_id");
CREATE INDEX "github_installations_workspace_id_idx" ON "github_installations"("workspace_id");
CREATE INDEX "webhooks_workspace_id_idx" ON "webhooks"("workspace_id");
CREATE INDEX "quota_ledger_workspace_id_idx" ON "quota_ledger"("workspace_id");

ALTER TABLE "organization_memberships"
  ADD CONSTRAINT "organization_memberships_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_memberships"
  ADD CONSTRAINT "organization_memberships_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teams"
  ADD CONSTRAINT "teams_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_memberships"
  ADD CONSTRAINT "team_memberships_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_memberships"
  ADD CONSTRAINT "team_memberships_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspaces"
  ADD CONSTRAINT "workspaces_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspaces"
  ADD CONSTRAINT "workspaces_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workspaces"
  ADD CONSTRAINT "workspaces_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_memberships"
  ADD CONSTRAINT "workspace_memberships_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_memberships"
  ADD CONSTRAINT "workspace_memberships_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users"
  ADD CONSTRAINT "users_active_workspace_id_fkey"
  FOREIGN KEY ("active_workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_notification_settings"
  ADD CONSTRAINT "project_notification_settings_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "scans"
  ADD CONSTRAINT "scans_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "github_installations"
  ADD CONSTRAINT "github_installations_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "webhooks"
  ADD CONSTRAINT "webhooks_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quota_ledger"
  ADD CONSTRAINT "quota_ledger_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
