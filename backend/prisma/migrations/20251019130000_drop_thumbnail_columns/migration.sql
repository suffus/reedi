-- Drop the redundant thumbnail and thumbnailS3Key columns
-- All thumbnail data is now stored in the thumbnails JSONB column

ALTER TABLE "media" DROP COLUMN IF EXISTS "thumbnail";
ALTER TABLE "media" DROP COLUMN IF EXISTS "thumbnailS3Key";
