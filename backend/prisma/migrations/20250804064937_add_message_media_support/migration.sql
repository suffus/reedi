-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'POST';

-- CreateTable
CREATE TABLE "message_media" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "message_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_media_messageId_mediaId_key" ON "message_media"("messageId", "mediaId");
