-- AlterTable
ALTER TABLE "message_media" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unlockPrice" INTEGER;

-- AlterTable
ALTER TABLE "post_media" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unlockPrice" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "canPublishLockedMedia" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "unlocked_posts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "paidAmount" INTEGER NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unlocked_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unlocked_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "paidAmount" INTEGER NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unlocked_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unlocked_posts_userId_postId_key" ON "unlocked_posts"("userId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "unlocked_messages_userId_messageId_key" ON "unlocked_messages"("userId", "messageId");
