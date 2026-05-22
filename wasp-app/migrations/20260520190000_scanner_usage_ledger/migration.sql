/*
  Warnings:

  - This migration adds scanner usage tracking for tier-based monthly limits.

*/
-- CreateTable
CREATE TABLE "scanner_usage_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "workspace_id" UUID,
    "scan_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "plan_tier" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "limit_applied" INTEGER,

    CONSTRAINT "scanner_usage_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scanner_usage_ledger_usage_idx" ON "scanner_usage_ledger"("user_id", "provider", "period_key");

-- CreateIndex
CREATE INDEX "scanner_usage_ledger_workspace_id_idx" ON "scanner_usage_ledger"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "scanner_usage_ledger_unique" ON "scanner_usage_ledger"("user_id", "provider", "period_key", "scan_id");

-- AddForeignKey
ALTER TABLE "scanner_usage_ledger" ADD CONSTRAINT "scanner_usage_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scanner_usage_ledger" ADD CONSTRAINT "scanner_usage_ledger_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scanner_usage_ledger" ADD CONSTRAINT "scanner_usage_ledger_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
