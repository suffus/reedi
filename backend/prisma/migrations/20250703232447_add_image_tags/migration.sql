-- AlterTable
ALTER TABLE "images" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
