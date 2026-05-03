-- CreateTable
CREATE TABLE "project_notification_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" UUID NOT NULL,
    "project_key" TEXT NOT NULL,
    "email_on_scan_complete" BOOLEAN NOT NULL DEFAULT true,
    "email_on_vulnerability" BOOLEAN NOT NULL DEFAULT true,
    "weekly_digest" BOOLEAN NOT NULL DEFAULT false,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "project_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idx_project_notification_unique" ON "project_notification_settings"("user_id", "project_key");

-- CreateIndex
CREATE INDEX "project_notification_settings_user_id_idx" ON "project_notification_settings"("user_id");

-- AddForeignKey
ALTER TABLE "project_notification_settings" ADD CONSTRAINT "project_notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
