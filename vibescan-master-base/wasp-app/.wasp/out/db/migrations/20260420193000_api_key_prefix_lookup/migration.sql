-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "key_prefix" TEXT;

-- CreateIndex
CREATE INDEX "api_keys_key_prefix_idx" ON "api_keys"("key_prefix");
