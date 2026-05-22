-- CreateEnum
CREATE TYPE "ProjectTargetType" AS ENUM ('github', 'sbom', 'source_zip', 'dast', 'other');

-- CreateEnum
CREATE TYPE "ProjectFindingStatus" AS ENUM ('active', 'mitigated', 'accepted', 'snoozed', 'rejected');

-- CreateEnum
CREATE TYPE "ProjectFindingAnnotationState" AS ENUM ('accepted', 'snoozed', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "SlaState" AS ENUM ('none', 'on_track', 'due_soon', 'overdue');

-- AlterTable
ALTER TABLE "scans" ADD COLUMN     "project_id" UUID;

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "target_type" "ProjectTargetType" NOT NULL DEFAULT 'other',
    "target_ref" TEXT NOT NULL,
    "normalized_target_ref" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_findings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "cve_id" TEXT NOT NULL,
    "package_name" TEXT NOT NULL,
    "installed_version" TEXT NOT NULL,
    "file_path" TEXT,
    "severity" TEXT NOT NULL,
    "cvss_score" DECIMAL(3,1),
    "fixed_version" TEXT,
    "description" TEXT,
    "status" "ProjectFindingStatus" NOT NULL DEFAULT 'active',
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "last_detected_at" TIMESTAMP(3) NOT NULL,
    "last_scan_id" UUID,
    "last_mitigated_at" TIMESTAMP(3),
    "reopened_at" TIMESTAMP(3),
    "scan_count" INTEGER NOT NULL DEFAULT 1,
    "reported_by" "ScanSource"[] DEFAULT ARRAY[]::"ScanSource"[],
    "first_detected_by" "ScanSource" NOT NULL,
    "last_detected_by" "ScanSource" NOT NULL,
    "sla_due_at" TIMESTAMP(3),
    "sla_state" "SlaState" NOT NULL DEFAULT 'none',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "project_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_finding_annotations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_finding_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "state" "ProjectFindingAnnotationState" NOT NULL,
    "reason" TEXT,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "project_finding_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_workspace_id_idx" ON "projects"("workspace_id");

-- CreateIndex
CREATE INDEX "projects_slug_idx" ON "projects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "projects_workspace_normalized_target_ref_unique" ON "projects"("workspace_id", "normalized_target_ref");

-- CreateIndex
CREATE INDEX "project_findings_workspace_status_idx" ON "project_findings"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "project_findings_project_status_idx" ON "project_findings"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_findings_cve_id_idx" ON "project_findings"("cve_id");

-- CreateIndex
CREATE INDEX "project_findings_severity_idx" ON "project_findings"("severity");

-- CreateIndex
CREATE INDEX "project_findings_last_seen_at_idx" ON "project_findings"("last_seen_at");

-- CreateIndex
CREATE INDEX "project_findings_sla_due_at_idx" ON "project_findings"("sla_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_findings_project_fingerprint_unique" ON "project_findings"("project_id", "fingerprint");

-- CreateIndex
CREATE INDEX "project_finding_annotations_project_finding_id_idx" ON "project_finding_annotations"("project_finding_id");

-- CreateIndex
CREATE INDEX "project_finding_annotations_workspace_state_idx" ON "project_finding_annotations"("workspace_id", "state");

-- CreateIndex
CREATE INDEX "project_finding_annotations_user_id_idx" ON "project_finding_annotations"("user_id");

-- CreateIndex
CREATE INDEX "scans_project_id_idx" ON "scans"("project_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_findings" ADD CONSTRAINT "project_findings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_findings" ADD CONSTRAINT "project_findings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_findings" ADD CONSTRAINT "project_findings_last_scan_id_fkey" FOREIGN KEY ("last_scan_id") REFERENCES "scans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_finding_annotations" ADD CONSTRAINT "project_finding_annotations_project_finding_id_fkey" FOREIGN KEY ("project_finding_id") REFERENCES "project_findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_finding_annotations" ADD CONSTRAINT "project_finding_annotations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_finding_annotations" ADD CONSTRAINT "project_finding_annotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
