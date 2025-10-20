-- Migrate thumbnail data from simple fields to JSON thumbnails column
-- This migration consolidates thumbnail and thumbnailS3Key into the thumbnails JSON array

-- First, update records that have thumbnailS3Key but no thumbnails JSON data
UPDATE media 
SET thumbnails = jsonb_build_array(
  jsonb_build_object(
    's3Key', "thumbnailS3Key",
    'width', COALESCE(width, 0),
    'height', COALESCE(height, 0),
    'fileSize', COALESCE(size, 0)
  )
)
WHERE "thumbnailS3Key" IS NOT NULL 
  AND "thumbnailS3Key" != '' 
  AND (thumbnails IS NULL OR thumbnails = '[]'::jsonb);

-- Then, update records that have thumbnail but no thumbnails JSON data
-- (and no thumbnailS3Key to avoid duplicates)
UPDATE media 
SET thumbnails = jsonb_build_array(
  jsonb_build_object(
    's3Key', thumbnail,
    'width', COALESCE(width, 0),
    'height', COALESCE(height, 0),
    'fileSize', COALESCE(size, 0)
  )
)
WHERE thumbnail IS NOT NULL 
  AND thumbnail != '' 
  AND "thumbnailS3Key" IS NULL 
  AND (thumbnails IS NULL OR thumbnails = '[]'::jsonb);

-- For records that have both thumbnail and thumbnailS3Key but no thumbnails JSON,
-- prefer thumbnailS3Key as it's more specific
UPDATE media 
SET thumbnails = jsonb_build_array(
  jsonb_build_object(
    's3Key', "thumbnailS3Key",
    'width', COALESCE(width, 0),
    'height', COALESCE(height, 0),
    'fileSize', COALESCE(size, 0)
  )
)
WHERE "thumbnailS3Key" IS NOT NULL 
  AND "thumbnailS3Key" != '' 
  AND thumbnail IS NOT NULL 
  AND thumbnail != '' 
  AND (thumbnails IS NULL OR thumbnails = '[]'::jsonb);

-- For records that have both thumbnail and thumbnailS3Key but no thumbnails JSON,
-- and thumbnailS3Key is empty, use thumbnail
UPDATE media 
SET thumbnails = jsonb_build_array(
  jsonb_build_object(
    's3Key', thumbnail,
    'width', COALESCE(width, 0),
    'height', COALESCE(height, 0),
    'fileSize', COALESCE(size, 0)
  )
)
WHERE thumbnail IS NOT NULL 
  AND thumbnail != '' 
  AND ("thumbnailS3Key" IS NULL OR "thumbnailS3Key" = '') 
  AND (thumbnails IS NULL OR thumbnails = '[]'::jsonb);
