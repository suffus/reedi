/*
  Warnings:

  - You are about to drop the column `imageId` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the column `coverImageId` on the `galleries` table. All the data in the column will be lost.
  - You are about to drop the `images` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `post_images` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[coverMediaId]` on the table `galleries` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED');

-- DropIndex
DROP INDEX "galleries_coverImageId_key";

-- AlterTable
ALTER TABLE "comments" DROP COLUMN "imageId",
ADD COLUMN     "mediaId" TEXT;

-- AlterTable
ALTER TABLE "galleries" DROP COLUMN "coverImageId",
ADD COLUMN     "coverMediaId" TEXT;

-- DropTable
DROP TABLE "images";

-- DropTable
DROP TABLE "post_images";

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "s3Key" TEXT,
    "thumbnailS3Key" TEXT,
    "originalFilename" TEXT,
    "altText" TEXT,
    "caption" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "size" INTEGER,
    "mimeType" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "postId" TEXT,
    "authorId" TEXT NOT NULL,
    "galleryId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'COMPLETED',
    "duration" DOUBLE PRECISION,
    "codec" TEXT,
    "bitrate" INTEGER,
    "framerate" DOUBLE PRECISION,
    "videoUrl" TEXT,
    "videoS3Key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_media" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "post_media_postId_mediaId_key" ON "post_media"("postId", "mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "galleries_coverMediaId_key" ON "galleries"("coverMediaId");
