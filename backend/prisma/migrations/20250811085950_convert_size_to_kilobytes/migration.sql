-- Convert size from bytes to kilobytes and change type back to INTEGER
-- First, update all existing size values to be in kilobytes
UPDATE "media" SET "size" = "size" / 1024 WHERE "size" IS NOT NULL;

-- Then change the column type back to INTEGER
ALTER TABLE "media" ALTER COLUMN "size" SET DATA TYPE INTEGER; 