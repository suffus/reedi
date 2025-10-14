-- CreateEnum
CREATE TYPE "CommentContext" AS ENUM ('FEED', 'GROUP', 'USER_PAGE');

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "context" "CommentContext" NOT NULL DEFAULT 'FEED',
ADD COLUMN     "groupId" TEXT;

-- CreateIndex
CREATE INDEX "comments_groupId_idx" ON "comments"("groupId");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
