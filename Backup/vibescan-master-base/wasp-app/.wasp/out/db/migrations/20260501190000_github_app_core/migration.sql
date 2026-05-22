ALTER TABLE "scans"
  ADD COLUMN "github_context" JSONB;

ALTER TABLE "github_installations"
  ALTER COLUMN "org_id" DROP NOT NULL,
  ADD COLUMN "account_login" TEXT,
  ADD COLUMN "account_type" TEXT,
  ADD COLUMN "repository_selection" TEXT NOT NULL DEFAULT 'all';

CREATE UNIQUE INDEX "github_installations_github_installation_id_key"
  ON "github_installations"("github_installation_id");
