/*
  Warnings:

  - The values [syft] on the enum `ScanSource` will be removed. If these variants are still used in the database, this will fail.

*/
-- Preserve existing data before removing syft from the enum.
ALTER TYPE "ScanSource" ADD VALUE IF NOT EXISTS 'trivy';
COMMIT;

UPDATE "scan_results"
SET "source" = 'trivy'
WHERE "source" = 'syft';

UPDATE "findings"
SET "source" = 'trivy'
WHERE "source" = 'syft';

UPDATE "scans"
SET "planned_sources" = array_replace("planned_sources", 'syft'::"ScanSource", 'trivy'::"ScanSource")
WHERE 'syft' = ANY("planned_sources");

UPDATE "findings"
SET "detected_data" = jsonb_set(
  COALESCE("detected_data", '{}'::jsonb),
  '{reportedBy}',
  (
    SELECT to_jsonb(array_agg(CASE WHEN value = 'syft' THEN 'trivy' ELSE value END))
    FROM jsonb_array_elements_text(COALESCE("detected_data"->'reportedBy', '[]'::jsonb)) AS value
  ),
  true
)
WHERE "detected_data" ? 'reportedBy'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text("detected_data"->'reportedBy') AS value
    WHERE value = 'syft'
  );

-- AlterEnum
BEGIN;
CREATE TYPE "ScanSource_new" AS ENUM ('dast', 'grype', 'codescoring_johnny', 'owasp', 'snyk', 'trivy');
ALTER TABLE "scans" ALTER COLUMN "planned_sources" DROP DEFAULT;
ALTER TABLE "scans" ALTER COLUMN "planned_sources" TYPE "ScanSource_new"[] USING ("planned_sources"::text::"ScanSource_new"[]);
ALTER TABLE "scan_results" ALTER COLUMN "source" TYPE "ScanSource_new" USING ("source"::text::"ScanSource_new");
ALTER TABLE "findings" ALTER COLUMN "source" TYPE "ScanSource_new" USING ("source"::text::"ScanSource_new");
ALTER TYPE "ScanSource" RENAME TO "ScanSource_old";
ALTER TYPE "ScanSource_new" RENAME TO "ScanSource";
DROP TYPE "ScanSource_old";
ALTER TABLE "scans" ALTER COLUMN "planned_sources" SET DEFAULT ARRAY[]::"ScanSource"[];
COMMIT;
