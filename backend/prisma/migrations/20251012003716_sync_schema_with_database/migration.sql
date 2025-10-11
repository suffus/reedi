-- AlterTable
ALTER TABLE "groups" DROP COLUMN "avatar",
DROP COLUMN "coverPhoto",
ADD COLUMN     "avatarId" TEXT,
ADD COLUMN     "coverPhotoId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_verifications_email_code_key" ON "email_verifications"("email", "code");

-- CreateIndex
CREATE UNIQUE INDEX "groups_coverPhotoId_key" ON "groups"("coverPhotoId");

-- CreateIndex
CREATE UNIQUE INDEX "groups_avatarId_key" ON "groups"("avatarId");

