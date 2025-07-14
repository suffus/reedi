/*
  Warnings:

  - You are about to drop the column `isPublished` on the `posts` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('PUBLIC', 'PAUSED', 'CONTROLLED', 'DELETED');

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "isPublished",
ADD COLUMN     "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'PUBLIC';
