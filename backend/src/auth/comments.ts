import { Authentication, PermissionResult } from '../types/permissions';
import { grant, deny } from '../lib/permissions';
import { userHasFacet } from '../lib/facets';
import { isAdministratorFor, isFriendsWith } from '../lib/userRelations';
import { Post, Media } from '@prisma/client';
import { prisma } from '../db';

/**
 * Comment model type (simplified for permission checks)
 */
interface Comment {
  id: string;
  authorId: string;
  postId?: string | null;
  mediaId?: string | null;
  content: string;
}

/**
 * Check if user can view comments on a post
 * (Tied to post read permission)
 */
export async function canViewCommentsOnPost(
  auth: Authentication,
  post: Post
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  // Import post permission check
  const { canDoPostRead } = await import('./posts');
  return canDoPostRead(auth, post);
}

/**
 * Check if user can view comments on media
 * (Tied to media read permission)
 */
export async function canViewCommentsOnMedia(
  auth: Authentication,
  media: Media
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  // Import media permission check
  const { canDoMediaRead } = await import('./media');
  return canDoMediaRead(auth, media);
}

/**
 * Check if user can comment on a post
 */
export async function canCommentOnPost(
  auth: Authentication,
  post: Post & { author?: { id: string } }
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(null, post.id, 'comment-create-post', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Author can always comment on own post
  if (userId === post.authorId) {
    return grant(userId, post.id, 'comment-create-post', 'Own post', 'SELF');
  }
  
  // Global admins can comment anywhere
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(userId, post.id, 'comment-create-post', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // Moderators can comment anywhere
  if (await userHasFacet(userId, 'user-role:moderator')) {
    return grant(userId, post.id, 'comment-create-post', 'Moderator', 'MODERATOR');
  }
  
  // Line managers can comment on reports' posts
  if (await isAdministratorFor(userId, post.authorId)) {
    return grant(userId, post.id, 'comment-create-post', 'Line manager', 'LINE_MANAGER');
  }
  
  // Check if post belongs to a group - if so, only group members can comment
  const groupPost = await prisma.groupPost.findFirst({
    where: { 
      postId: post.id,
      status: 'APPROVED' // Only check for approved group posts
    }
  });
  
  if (groupPost) {
    // This is a group post - check if user is a member
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: groupPost.groupId,
          userId: userId
        }
      }
    });
    
    if (!membership || membership.status !== 'ACTIVE') {
      return deny(userId, post.id, 'comment-create-post', 'Must be a group member to comment', 'NOT_GROUP_MEMBER');
    }
    
    // User is a group member
    return grant(userId, post.id, 'comment-create-post', 'Group member', 'GROUP_MEMBER');
  }
  
  // Not a group post - apply standard visibility rules
  // PUBLIC posts - anyone can comment
  if (post.visibility === 'PUBLIC' && post.publicationStatus === 'PUBLIC') {
    return grant(userId, post.id, 'comment-create-post', 'Public post', 'PUBLIC_CONTENT');
  }
  
  // FRIENDS_ONLY posts - friends can comment
  if (post.visibility === 'FRIENDS_ONLY') {
    if (await isFriendsWith(userId, post.authorId)) {
      return grant(userId, post.id, 'comment-create-post', 'Friend', 'FRIEND');
    }
  }
  
  return deny(userId, post.id, 'comment-create-post', 'Cannot comment on this post', 'DEFAULT_DENY');
}

/**
 * Check if user can comment on media
 */
export async function canCommentOnMedia(
  auth: Authentication,
  media: Media & { author?: { id: string } }
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(null, media.id, 'comment-create-media', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Author can always comment on own media
  if (userId === media.authorId) {
    return grant(userId, media.id, 'comment-create-media', 'Own media', 'SELF');
  }
  
  // Global admins can comment anywhere
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(userId, media.id, 'comment-create-media', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // Moderators can comment anywhere
  if (await userHasFacet(userId, 'user-role:moderator')) {
    return grant(userId, media.id, 'comment-create-media', 'Moderator', 'MODERATOR');
  }
  
  // Line managers can comment on reports' media
  if (await isAdministratorFor(userId, media.authorId)) {
    return grant(userId, media.id, 'comment-create-media', 'Line manager', 'LINE_MANAGER');
  }
  
  // PUBLIC media - anyone can comment
  if (media.visibility === 'PUBLIC') {
    return grant(userId, media.id, 'comment-create-media', 'Public media', 'PUBLIC_CONTENT');
  }
  
  // FRIENDS_ONLY media - friends can comment
  if (media.visibility === 'FRIENDS_ONLY') {
    if (await isFriendsWith(userId, media.authorId)) {
      return grant(userId, media.id, 'comment-create-media', 'Friend', 'FRIEND');
    }
  }
  
  return deny(userId, media.id, 'comment-create-media', 'Cannot comment on this media', 'DEFAULT_DENY');
}

/**
 * Check if user can update a comment
 */
export async function canUpdateComment(
  auth: Authentication,
  comment: Comment
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(null, comment.id, 'comment-update', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Users can edit their own comments
  if (userId === comment.authorId) {
    return grant(userId, comment.id, 'comment-update', 'Own comment', 'SELF');
  }
  
  // Global admins can edit any comment
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(userId, comment.id, 'comment-update', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // Moderators can edit comments
  if (await userHasFacet(userId, 'user-role:moderator')) {
    return grant(userId, comment.id, 'comment-update', 'Moderator', 'MODERATOR');
  }
  
  return deny(userId, comment.id, 'comment-update', 'Can only edit own comments', 'DEFAULT_DENY');
}

/**
 * Check if user can delete a comment
 */
export async function canDeleteComment(
  auth: Authentication,
  comment: Comment,
  parentAuthorId?: string // ID of post/media author
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(null, comment.id, 'comment-delete', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Users can delete their own comments
  if (userId === comment.authorId) {
    return grant(userId, comment.id, 'comment-delete', 'Own comment', 'SELF');
  }
  
  // Post/Media author can delete comments on their content
  if (parentAuthorId && userId === parentAuthorId) {
    return grant(userId, comment.id, 'comment-delete', 'Content owner', 'CONTENT_OWNER');
  }
  
  // Global admins can delete any comment
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(userId, comment.id, 'comment-delete', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // Moderators can delete comments
  if (await userHasFacet(userId, 'user-role:moderator')) {
    return grant(userId, comment.id, 'comment-delete', 'Moderator', 'MODERATOR');
  }
  
  // Line managers can delete comments on their reports' content
  if (parentAuthorId && await isAdministratorFor(userId, parentAuthorId)) {
    return grant(userId, comment.id, 'comment-delete', 'Line manager', 'LINE_MANAGER');
  }
  
  return deny(userId, comment.id, 'comment-delete', 'Cannot delete this comment', 'DEFAULT_DENY');
}

/**
 * Filter comments array to only those the user can view
 * (This is a simplified version - in practice, if user can view the post/media,
 * they can view all its comments)
 */
export async function filterViewableComments(
  auth: Authentication,
  comments: Comment[]
): Promise<Comment[]> {
  // For comments, if the user can see the parent post/media, they can see all comments
  // No individual comment-level filtering needed
  return comments;
}

