/*
  Warnings:

  - The values [DRAFT,PUBLISHED,ARCHIVED] on the enum `PublicationStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PublicationStatus_new" AS ENUM ('PUBLIC', 'PAUSED', 'CONTROLLED', 'DELETED');
ALTER TABLE "posts" ALTER COLUMN "publicationStatus" DROP DEFAULT;
ALTER TABLE "posts" ALTER COLUMN "publicationStatus" TYPE "PublicationStatus_new" USING ("publicationStatus"::text::"PublicationStatus_new");
ALTER TYPE "PublicationStatus" RENAME TO "PublicationStatus_old";
ALTER TYPE "PublicationStatus_new" RENAME TO "PublicationStatus";
DROP TYPE "PublicationStatus_old";
ALTER TABLE "posts" ALTER COLUMN "publicationStatus" SET DEFAULT 'PUBLIC';
COMMIT;

-- AlterTable
ALTER TABLE "posts" ALTER COLUMN "publicationStatus" SET DEFAULT 'PUBLIC';
