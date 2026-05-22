-- CreateEnum
CREATE TYPE "CycloneDxRolloutStage" AS ENUM ('shadow_smoke', 'canary_cutover_cohort', 'expand_cohort', 'ready_for_prod');

-- CreateEnum
CREATE TYPE "CycloneDxRolloutStatus" AS ENUM ('in_progress', 'blocked', 'ready_for_prod', 'rollback_active');

-- CreateTable
CREATE TABLE "cyclonedx_rollout_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanner_id" TEXT NOT NULL,
    "scan_result_id" UUID NOT NULL,
    "rollout_stage" "CycloneDxRolloutStage" NOT NULL,
    "progress_status" "CycloneDxRolloutStatus" NOT NULL,
    "decision_status" TEXT NOT NULL,
    "gate_status" TEXT NOT NULL,
    "gate_snapshot" JSONB NOT NULL,
    "ingestion_meta" JSONB NOT NULL,
    "summary" JSONB NOT NULL,

    CONSTRAINT "cyclonedx_rollout_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cyclonedx_rollout_states" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "scanner_id" TEXT NOT NULL,
    "current_stage" "CycloneDxRolloutStage" NOT NULL DEFAULT 'shadow_smoke',
    "progress_status" "CycloneDxRolloutStatus" NOT NULL DEFAULT 'in_progress',
    "latest_snapshot_id" UUID,
    "latest_decision" JSONB,

    CONSTRAINT "cyclonedx_rollout_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cyclonedx_rollout_snapshots_scan_result_id_key" ON "cyclonedx_rollout_snapshots"("scan_result_id");

-- CreateIndex
CREATE INDEX "cyclonedx_rollout_snapshots_scanner_id_created_at_idx" ON "cyclonedx_rollout_snapshots"("scanner_id", "created_at");

-- CreateIndex
CREATE INDEX "cyclonedx_rollout_snapshots_rollout_stage_progress_status_idx" ON "cyclonedx_rollout_snapshots"("rollout_stage", "progress_status");

-- CreateIndex
CREATE UNIQUE INDEX "cyclonedx_rollout_states_scanner_id_key" ON "cyclonedx_rollout_states"("scanner_id");

-- CreateIndex
CREATE UNIQUE INDEX "cyclonedx_rollout_states_latest_snapshot_id_key" ON "cyclonedx_rollout_states"("latest_snapshot_id");

-- AddForeignKey
ALTER TABLE "cyclonedx_rollout_snapshots" ADD CONSTRAINT "cyclonedx_rollout_snapshots_scan_result_id_fkey" FOREIGN KEY ("scan_result_id") REFERENCES "scan_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cyclonedx_rollout_states" ADD CONSTRAINT "cyclonedx_rollout_states_latest_snapshot_id_fkey" FOREIGN KEY ("latest_snapshot_id") REFERENCES "cyclonedx_rollout_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
