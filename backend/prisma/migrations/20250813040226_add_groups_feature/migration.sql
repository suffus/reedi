-- CreateEnum
CREATE TYPE "GroupVisibility" AS ENUM ('PUBLIC', 'PRIVATE_VISIBLE', 'PRIVATE_HIDDEN');

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('GENERAL', 'SOCIAL_LEARNING', 'GAMING', 'JOBS', 'BUY_SELL', 'PARENTING', 'WORK');

-- CreateEnum
CREATE TYPE "GroupMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "GroupMemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'PENDING_APPROVAL');

-- CreateEnum
CREATE TYPE "GroupPostStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "GroupModerationPolicy" AS ENUM ('NO_MODERATION', 'ADMIN_APPROVAL_REQUIRED', 'AI_FILTER', 'SELECTIVE_MODERATION');

-- CreateEnum
CREATE TYPE "GroupActionType" AS ENUM ('GROUP_CREATED', 'GROUP_UPDATED', 'MEMBER_JOINED', 'MEMBER_LEFT', 'MEMBER_PROMOTED', 'MEMBER_DEMOTED', 'MEMBER_SUSPENDED', 'MEMBER_BANNED', 'POST_APPROVED', 'POST_REJECTED', 'POST_DELETED', 'COMMENT_APPROVED', 'COMMENT_REJECTED', 'COMMENT_DELETED', 'RULES_UPDATED', 'SETTINGS_CHANGED');

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "description" TEXT,
    "rules" TEXT,
    "coverPhoto" TEXT,
    "avatar" TEXT,
    "visibility" "GroupVisibility" NOT NULL DEFAULT 'PRIVATE_VISIBLE',
    "type" "GroupType" NOT NULL DEFAULT 'GENERAL',
    "moderationPolicy" "GroupModerationPolicy" NOT NULL DEFAULT 'NO_MODERATION',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "GroupMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "bannedAt" TIMESTAMP(3),

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_posts" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "status" "GroupPostStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "isPriority" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_invitations" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeEmail" TEXT,
    "inviteeUserId" TEXT,
    "inviteCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_applications" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "message" TEXT,
    "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_actions" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" "GroupActionType" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "groups_username_key" ON "groups"("username");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_groupId_userId_key" ON "group_members"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "group_posts_groupId_postId_key" ON "group_posts"("groupId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "group_invitations_inviteCode_key" ON "group_invitations"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "group_applications_groupId_applicantId_key" ON "group_applications"("groupId", "applicantId");
