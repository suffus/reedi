-- AlterTable
ALTER TABLE "media" ADD COLUMN     "videoMetadata" JSONB,
ADD COLUMN     "videoProcessingStatus" "ProcessingStatus",
ADD COLUMN     "videoThumbnails" JSONB,
ADD COLUMN     "videoVersions" JSONB;

-- CreateTable
CREATE TABLE "video_processing_jobs" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "errorMessage" TEXT,
    "thumbnails" JSONB,
    "videoVersions" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "video_processing_jobs_pkey" PRIMARY KEY ("id")
);
