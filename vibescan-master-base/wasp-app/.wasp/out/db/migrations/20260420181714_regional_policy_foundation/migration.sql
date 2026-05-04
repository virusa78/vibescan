-- CreateEnum
CREATE TYPE "RemediationPromptStatus" AS ENUM ('accepted', 'rejected_quota', 'failed_provider', 'completed');

-- CreateTable
CREATE TABLE "region_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "region_code" TEXT NOT NULL,
    "monthly_scan_limit" INTEGER NOT NULL,
    "monthly_remediation_prompt_limit" INTEGER NOT NULL,
    "max_prompts_per_finding" INTEGER NOT NULL DEFAULT 3,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_user_id" UUID,

    CONSTRAINT "region_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_policy_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" UUID NOT NULL,
    "monthly_scan_limit" INTEGER,
    "monthly_remediation_prompt_limit" INTEGER,
    "max_prompts_per_finding" INTEGER,
    "reason" TEXT,
    "updated_by_user_id" UUID,

    CONSTRAINT "user_policy_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remediation_prompt_usages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" UUID NOT NULL,
    "scan_id" UUID NOT NULL,
    "finding_id" UUID NOT NULL,
    "region_at_call" TEXT NOT NULL,
    "policy_snapshot" JSONB NOT NULL,
    "request_key" TEXT NOT NULL,
    "prompt_type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "RemediationPromptStatus" NOT NULL DEFAULT 'accepted',
    "tokens_in" INTEGER NOT NULL DEFAULT 0,
    "tokens_out" INTEGER NOT NULL DEFAULT 0,
    "cost_estimate" DECIMAL(10,4),

    CONSTRAINT "remediation_prompt_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "region_policies_region_code_key" ON "region_policies"("region_code");

-- CreateIndex
CREATE UNIQUE INDEX "user_policy_overrides_user_id_key" ON "user_policy_overrides"("user_id");

-- CreateIndex
CREATE INDEX "remediation_prompt_usages_scan_id_idx" ON "remediation_prompt_usages"("scan_id");

-- CreateIndex
CREATE INDEX "remediation_prompt_usages_finding_id_idx" ON "remediation_prompt_usages"("finding_id");

-- CreateIndex
CREATE UNIQUE INDEX "remediation_prompt_usages_user_id_request_key_key" ON "remediation_prompt_usages"("user_id", "request_key");

-- AddForeignKey
ALTER TABLE "user_policy_overrides" ADD CONSTRAINT "user_policy_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediation_prompt_usages" ADD CONSTRAINT "remediation_prompt_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediation_prompt_usages" ADD CONSTRAINT "remediation_prompt_usages_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediation_prompt_usages" ADD CONSTRAINT "remediation_prompt_usages_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
