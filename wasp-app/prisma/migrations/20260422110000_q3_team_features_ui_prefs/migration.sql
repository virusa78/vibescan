-- AlterTable
ALTER TABLE "users"
ADD COLUMN "ui_preferences" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- AlterTable
ALTER TABLE "webhook_deliveries"
ADD COLUMN "event_type" TEXT NOT NULL DEFAULT 'scan_complete',
ADD COLUMN "payload" JSONB,
ADD COLUMN "duration_ms" INTEGER,
ADD COLUMN "manual_retry_of_id" UUID;
