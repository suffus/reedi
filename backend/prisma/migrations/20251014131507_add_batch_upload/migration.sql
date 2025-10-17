-- CreateEnum
CREATE TYPE "BatchUploadStatus" AS ENUM ('PENDING', 'EXTRACTING', 'PROCESSING', 'COMPLETED', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "batchUploadId" TEXT,
ADD COLUMN     "originalPath" TEXT;

-- CreateTable
CREATE TABLE "batch_uploads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "s3Key" TEXT,
    "status" "BatchUploadStatus" NOT NULL DEFAULT 'PENDING',
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "failedFiles" INTEGER NOT NULL DEFAULT 0,
    "skippedFiles" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "batch_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batch_uploads_userId_status_idx" ON "batch_uploads"("userId", "status");

-- CreateIndex
CREATE INDEX "batch_uploads_createdAt_idx" ON "batch_uploads"("createdAt");

-- CreateIndex
CREATE INDEX "media_batchUploadId_idx" ON "media"("batchUploadId");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_batchUploadId_fkey" FOREIGN KEY ("batchUploadId") REFERENCES "batch_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_uploads" ADD CONSTRAINT "batch_uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
