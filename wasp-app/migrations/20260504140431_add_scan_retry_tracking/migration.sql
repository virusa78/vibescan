-- AlterTable
ALTER TABLE "scans" ADD COLUMN     "last_retry_at" TIMESTAMP(3),
ADD COLUMN     "last_retry_error" TEXT,
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0;
