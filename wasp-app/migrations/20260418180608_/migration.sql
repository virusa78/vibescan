/*
  Warnings:

  - Added the required column `updated_at` to the `webhooks` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "expires_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "webhooks" ADD COLUMN     "events" TEXT[] DEFAULT ARRAY['scan_complete']::TEXT[],
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "quota_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "balance_before" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "related_scan_id" UUID,

    CONSTRAINT "quota_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quota_ledger_user_id_idx" ON "quota_ledger"("user_id");

-- CreateIndex
CREATE INDEX "quota_ledger_created_at_idx" ON "quota_ledger"("created_at");

-- AddForeignKey
ALTER TABLE "quota_ledger" ADD CONSTRAINT "quota_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
