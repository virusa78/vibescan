/*
  Warnings:

  - A unique constraint covering the columns `[user_id,request_key]` on the table `ai_fix_prompts` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ai_fix_prompts" ADD COLUMN     "prompt_type" TEXT NOT NULL DEFAULT 'patch',
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN     "request_key" TEXT NOT NULL DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "remediation_prompt_usages" ALTER COLUMN "request_key" SET DEFAULT gen_random_uuid();

-- CreateIndex
CREATE UNIQUE INDEX "ai_fix_prompts_user_id_request_key_key" ON "ai_fix_prompts"("user_id", "request_key");
