-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'FRIENDS_ONLY', 'PRIVATE');

-- AlterTable
ALTER TABLE "images" ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC';

-- Migrate isPrivate to visibility
UPDATE posts SET visibility = 'PRIVATE' WHERE "isPrivate" = true;
UPDATE posts SET visibility = 'PUBLIC' WHERE "isPrivate" = false;
