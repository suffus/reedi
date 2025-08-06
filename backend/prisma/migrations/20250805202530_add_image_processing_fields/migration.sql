/*
  Warnings:

  - You are about to drop the `video_processing_jobs` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "media" ADD COLUMN     "imageMetadata" JSONB,
ADD COLUMN     "imageProcessingStatus" "ProcessingStatus",
ADD COLUMN     "imageVersions" JSONB;

-- DropTable
DROP TABLE "video_processing_jobs";

-- CreateTable
CREATE TABLE "media_processing_jobs" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "s3Key" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "errorMessage" TEXT,
    "thumbnails" JSONB,
    "videoVersions" JSONB,
    "imageVersions" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "media_processing_jobs_pkey" PRIMARY KEY ("id")
);
