-- CreateTable
CREATE TABLE "api_key_usage_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "api_key_id" UUID NOT NULL,

    CONSTRAINT "api_key_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_key_usage_events_api_key_id_created_at_idx" ON "api_key_usage_events"("api_key_id", "created_at");

-- AddForeignKey
ALTER TABLE "api_key_usage_events" ADD CONSTRAINT "api_key_usage_events_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
