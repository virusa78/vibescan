/*
  Warnings:

  - The values [free,enterprise] on the enum `ScanSource` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `_members` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ScanSource_new" AS ENUM ('grype', 'codescoring_johnny', 'snyk');
ALTER TABLE "scan_results" ALTER COLUMN "source" TYPE "ScanSource_new" USING ("source"::text::"ScanSource_new");
ALTER TABLE "findings" ALTER COLUMN "source" TYPE "ScanSource_new" USING ("source"::text::"ScanSource_new");
ALTER TYPE "ScanSource" RENAME TO "ScanSource_old";
ALTER TYPE "ScanSource_new" RENAME TO "ScanSource";
DROP TYPE "ScanSource_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "_members" DROP CONSTRAINT "_members_A_fkey";

-- DropForeignKey
ALTER TABLE "_members" DROP CONSTRAINT "_members_B_fkey";

-- AlterTable
ALTER TABLE "api_key_usage_events" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "cyclonedx_rollout_snapshots" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "cyclonedx_rollout_states" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "organization_memberships" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "scans" ADD COLUMN     "planned_sources" "ScanSource"[] DEFAULT ARRAY[]::"ScanSource"[];

-- AlterTable
ALTER TABLE "team_memberships" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "teams" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ui_preferences" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "webhook_deliveries" ADD COLUMN     "duration_ms" INTEGER,
ADD COLUMN     "event_type" TEXT NOT NULL DEFAULT 'scan_complete',
ADD COLUMN     "manual_retry_of_id" UUID,
ADD COLUMN     "payload" JSONB;

-- AlterTable
ALTER TABLE "workspace_memberships" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workspaces" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- DropTable
DROP TABLE "_members";

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
