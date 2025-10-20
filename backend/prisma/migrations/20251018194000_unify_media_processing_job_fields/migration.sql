-- AlterTable
ALTER TABLE "media_processing_jobs" ADD COLUMN "versions" JSONB;

-- Migrate existing data
UPDATE "media_processing_jobs" SET "versions" = "imageVersions" WHERE "imageVersions" IS NOT NULL;
UPDATE "media_processing_jobs" SET "versions" = "videoVersions" WHERE "videoVersions" IS NOT NULL AND "versions" IS NULL;

-- Drop old columns
ALTER TABLE "media_processing_jobs" DROP COLUMN "imageVersions";
ALTER TABLE "media_processing_jobs" DROP COLUMN "videoVersions";
