/*
  Warnings:

  - You are about to drop the `Auth` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AuthIdentity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ContactFormMessage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DailyStats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `File` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GptResponse` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PageViewSource` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Scan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Task` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserSettings` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('pending', 'scanning', 'done', 'error', 'cancelled');

-- CreateEnum
CREATE TYPE "ScanSource" AS ENUM ('free', 'enterprise');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('pending', 'delivered', 'failed', 'exhausted');

-- CreateEnum
CREATE TYPE "VulnAcceptanceStatus" AS ENUM ('accepted', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('free_trial', 'starter', 'pro', 'enterprise');

-- DropForeignKey
ALTER TABLE "Auth" DROP CONSTRAINT "Auth_userId_fkey";

-- DropForeignKey
ALTER TABLE "AuthIdentity" DROP CONSTRAINT "AuthIdentity_authId_fkey";

-- DropForeignKey
ALTER TABLE "ContactFormMessage" DROP CONSTRAINT "ContactFormMessage_userId_fkey";

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_userId_fkey";

-- DropForeignKey
ALTER TABLE "GptResponse" DROP CONSTRAINT "GptResponse_userId_fkey";

-- DropForeignKey
ALTER TABLE "PageViewSource" DROP CONSTRAINT "PageViewSource_dailyStatsId_fkey";

-- DropForeignKey
ALTER TABLE "Scan" DROP CONSTRAINT "Scan_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserSettings" DROP CONSTRAINT "UserSettings_userId_fkey";

-- DropTable
DROP TABLE "Auth";

-- DropTable
DROP TABLE "AuthIdentity";

-- DropTable
DROP TABLE "ContactFormMessage";

-- DropTable
DROP TABLE "DailyStats";

-- DropTable
DROP TABLE "File";

-- DropTable
DROP TABLE "GptResponse";

-- DropTable
DROP TABLE "Logs";

-- DropTable
DROP TABLE "PageViewSource";

-- DropTable
DROP TABLE "Scan";

-- DropTable
DROP TABLE "Session";

-- DropTable
DROP TABLE "Task";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "UserSettings";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "password_hash" TEXT,
    "display_name" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "plan" "PlanTier" NOT NULL DEFAULT 'free_trial',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "subscription_status" TEXT,
    "region" TEXT NOT NULL DEFAULT 'OTHER',
    "timezone" TEXT,
    "language" TEXT DEFAULT 'en',
    "monthly_quota_limit" INTEGER NOT NULL DEFAULT 10,
    "monthly_quota_used" INTEGER NOT NULL DEFAULT 0,
    "quota_reset_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "owner_user_id" UUID NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" UUID NOT NULL,
    "org_id" UUID,
    "input_type" TEXT NOT NULL,
    "input_ref" TEXT NOT NULL,
    "sbom_raw" JSONB,
    "components" JSONB NOT NULL DEFAULT '[]',
    "status" "ScanStatus" NOT NULL DEFAULT 'pending',
    "plan_at_submission" TEXT NOT NULL DEFAULT 'free_trial',
    "error_message" TEXT,

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scan_id" UUID NOT NULL,
    "source" "ScanSource" NOT NULL,
    "raw_output" JSONB NOT NULL,
    "vulnerabilities" JSONB NOT NULL,
    "scanner_version" TEXT NOT NULL,
    "cve_db_timestamp" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,

    CONSTRAINT "scan_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "scan_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "cve_id" TEXT NOT NULL,
    "package_name" TEXT NOT NULL,
    "installed_version" TEXT NOT NULL,
    "file_path" TEXT,
    "severity" TEXT NOT NULL,
    "cvss_score" DECIMAL(3,1),
    "fixed_version" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "mitigated_at" TIMESTAMP(3),
    "mitigated_in_scan_id" UUID,
    "source" "ScanSource" NOT NULL,
    "description" TEXT,
    "detected_data" JSONB,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finding_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "prev_value" TEXT,
    "new_value" TEXT,
    "metadata" JSONB,

    CONSTRAINT "finding_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_deltas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scan_id" UUID NOT NULL,
    "total_free_count" INTEGER NOT NULL DEFAULT 0,
    "total_enterprise_count" INTEGER NOT NULL DEFAULT 0,
    "delta_count" INTEGER NOT NULL DEFAULT 0,
    "delta_by_severity" JSONB NOT NULL,
    "delta_vulnerabilities" JSONB,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "reimport_summary" JSONB,

    CONSTRAINT "scan_deltas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_fix_prompts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "scan_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vulnerability_id" TEXT NOT NULL,
    "prompt_text" TEXT NOT NULL,
    "model_name" TEXT,
    "response_payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'generated',

    CONSTRAINT "ai_fix_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scan_id" UUID NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "grade" TEXT NOT NULL,
    "breakdown" JSONB NOT NULL,

    CONSTRAINT "security_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vuln_acceptances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "scan_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vulnerability_id" TEXT NOT NULL,
    "reason" TEXT,
    "status" "VulnAcceptanceStatus" NOT NULL DEFAULT 'accepted',
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "vuln_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_installations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "org_id" UUID NOT NULL,
    "github_installation_id" BIGINT NOT NULL,
    "github_app_id" TEXT NOT NULL,
    "repos_scope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "trigger_on_push" BOOLEAN NOT NULL DEFAULT true,
    "trigger_on_pr" BOOLEAN NOT NULL DEFAULT true,
    "target_branches" TEXT[] DEFAULT ARRAY['main', 'develop']::TEXT[],
    "fail_pr_on_severity" TEXT NOT NULL DEFAULT 'CRITICAL',

    CONSTRAINT "github_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "signing_secret_encrypted" BYTEA NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "webhook_id" UUID NOT NULL,
    "scan_id" UUID NOT NULL,
    "target_url" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "http_status" INTEGER,
    "response_body" TEXT,
    "delivered_at" TIMESTAMP(3),
    "next_retry_at" TIMESTAMP(3),
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_members" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_subscription_id_key" ON "users"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_user_id_key_hash_key" ON "api_keys"("user_id", "key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "idx_scan_results_unique" ON "scan_results"("scan_id", "source");

-- CreateIndex
CREATE INDEX "findings_fingerprint_idx" ON "findings"("fingerprint");

-- CreateIndex
CREATE INDEX "findings_user_id_status_idx" ON "findings"("user_id", "status");

-- CreateIndex
CREATE INDEX "findings_scan_id_idx" ON "findings"("scan_id");

-- CreateIndex
CREATE INDEX "findings_cve_id_idx" ON "findings"("cve_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_finding_unique_per_scan" ON "findings"("scan_id", "fingerprint");

-- CreateIndex
CREATE INDEX "finding_history_finding_id_idx" ON "finding_history"("finding_id");

-- CreateIndex
CREATE INDEX "finding_history_event_idx" ON "finding_history"("event");

-- CreateIndex
CREATE UNIQUE INDEX "scan_deltas_scan_id_key" ON "scan_deltas"("scan_id");

-- CreateIndex
CREATE UNIQUE INDEX "security_scores_scan_id_key" ON "security_scores"("scan_id");

-- CreateIndex
CREATE UNIQUE INDEX "vuln_acceptances_scan_id_user_id_vulnerability_id_key" ON "vuln_acceptances"("scan_id", "user_id", "vulnerability_id");

-- CreateIndex
CREATE UNIQUE INDEX "_members_AB_unique" ON "_members"("A", "B");

-- CreateIndex
CREATE INDEX "_members_B_index" ON "_members"("B");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_history" ADD CONSTRAINT "finding_history_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_deltas" ADD CONSTRAINT "scan_deltas_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_fix_prompts" ADD CONSTRAINT "ai_fix_prompts_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_fix_prompts" ADD CONSTRAINT "ai_fix_prompts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_scores" ADD CONSTRAINT "security_scores_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vuln_acceptances" ADD CONSTRAINT "vuln_acceptances_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vuln_acceptances" ADD CONSTRAINT "vuln_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_members" ADD CONSTRAINT "_members_A_fkey" FOREIGN KEY ("A") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_members" ADD CONSTRAINT "_members_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
