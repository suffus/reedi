-- AlterTable
ALTER TABLE "media" ADD COLUMN "metadata" JSONB;
ALTER TABLE "media" ADD COLUMN "versions" JSONB;
ALTER TABLE "media" ADD COLUMN "thumbnails" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "media_metadata_idx" ON "media"("metadata");

-- Migrate existing data
UPDATE "media" SET "metadata" = "imageMetadata" WHERE "imageMetadata" IS NOT NULL;
UPDATE "media" SET "metadata" = "videoMetadata" WHERE "videoMetadata" IS NOT NULL AND "metadata" IS NULL;
UPDATE "media" SET "versions" = "imageVersions" WHERE "imageVersions" IS NOT NULL;
UPDATE "media" SET "versions" = "videoVersions" WHERE "videoVersions" IS NOT NULL AND "versions" IS NULL;
UPDATE "media" SET "thumbnails" = "videoThumbnails" WHERE "videoThumbnails" IS NOT NULL;

-- Drop old columns
ALTER TABLE "media" DROP COLUMN "imageMetadata";
ALTER TABLE "media" DROP COLUMN "imageProcessingStatus";
ALTER TABLE "media" DROP COLUMN "imageVersions";
ALTER TABLE "media" DROP COLUMN "videoMetadata";
ALTER TABLE "media" DROP COLUMN "videoProcessingStatus";
ALTER TABLE "media" DROP COLUMN "videoThumbnails";
ALTER TABLE "media" DROP COLUMN "videoVersions";
