-- Add ZIP to MediaType enum
ALTER TYPE "MediaType" ADD VALUE 'ZIP';

-- Update Media table to replace batch upload references with zip media references
ALTER TABLE "media" DROP COLUMN "batchUploadId";
ALTER TABLE "media" ADD COLUMN "zipMediaId" TEXT;
CREATE INDEX "media_zipMediaId_idx" ON "media"("zipMediaId");

-- Drop the batch_uploads table
DROP TABLE "batch_uploads";

-- Drop the BatchUploadStatus enum
DROP TYPE "BatchUploadStatus";


