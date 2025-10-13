import { Authentication, PermissionResult } from '../types/permissions';
import { grant, deny } from '../lib/permissions';
import { userHasFacet } from '../lib/facets';
import { isFriendsWith, isAdministratorFor } from '../lib/userRelations';
import { Post, User } from '@prisma/client';

/**
 * Check if user can read post
 */
export async function canDoPostRead(
  auth: Authentication,
  post: Post & { author?: User }
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  // Public posts are always readable
  if (post.visibility === 'PUBLIC' && post.publicationStatus === 'PUBLIC') {
    return grant(requestUserId, post.id, 'post-read', 'Post is public', 'PUBLIC_POST');
  }
  
  if (!requestUserId) {
    return deny(null, post.id, 'post-read', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Owner can always read
  if (post.authorId === requestUserId) {
    return grant(requestUserId, post.id, 'post-read', 'User is owner', 'OWNER');
  }
  
  // Friends can read FRIENDS_ONLY posts
  if (post.visibility === 'FRIENDS_ONLY' && post.publicationStatus === 'PUBLIC') {
    const areFriends = await isFriendsWith(requestUserId, post.authorId);
    if (areFriends) {
      return grant(requestUserId, post.id, 'post-read', 'User is friend and post is FRIENDS_ONLY', 'FRIENDS');
    }
  }
  
  // Global admins can read all
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, post.id, 'post-read', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // Line managers can read subordinates' posts
  if (await isAdministratorFor(requestUserId, post.authorId)) {
    return grant(requestUserId, post.id, 'post-read', 'Line manager of author', 'LINE_MANAGER');
  }
  
  return deny(requestUserId, post.id, 'post-read', 'Default deny', 'DEFAULT_DENY');
}

/**
 * Check if user can create posts
 */
export async function canDoPostCreate(
  auth: Authentication
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, null, 'post-create', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // All authenticated users can create posts
  return grant(requestUserId, null, 'post-create', 'Authenticated user', 'AUTHENTICATED');
}

/**
 * Check if user can create locked posts (premium content)
 */
export async function canCreateLockedPost(
  auth: Authentication
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, null, 'post-create-locked', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Check if user has permission to publish locked media (legacy field)
  const user = auth.user;
  if (user && (user as any).canPublishLockedMedia) {
    return grant(requestUserId, null, 'post-create-locked', 'User has locked media permission', 'LOCKED_MEDIA_PERMISSION');
  }
  
  // Or check via facet
  if (await userHasFacet(requestUserId, 'feature-access:locked-posts')) {
    return grant(requestUserId, null, 'post-create-locked', 'User has locked posts facet', 'LOCKED_POSTS_FACET');
  }
  
  return deny(requestUserId, null, 'post-create-locked', 'No permission for locked posts', 'DEFAULT_DENY');
}

/**
 * Check if user can update post
 */
export async function canDoPostUpdate(
  auth: Authentication,
  post: Post
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, post.id, 'post-update', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Owner can update
  if (post.authorId === requestUserId) {
    return grant(requestUserId, post.id, 'post-update', 'User is owner', 'OWNER');
  }
  
  // Global admins can update
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, post.id, 'post-update', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  return deny(requestUserId, post.id, 'post-update', 'Default deny', 'DEFAULT_DENY');
}

/**
 * Check if user can delete post
 */
export async function canDoPostDelete(
  auth: Authentication,
  post: Post
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, post.id, 'post-delete', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Owner can delete
  if (post.authorId === requestUserId) {
    return grant(requestUserId, post.id, 'post-delete', 'User is owner', 'OWNER');
  }
  
  // Global admins can delete
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, post.id, 'post-delete', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // Moderators can delete posts
  if (await userHasFacet(requestUserId, 'user-role:moderator')) {
    return grant(requestUserId, post.id, 'post-delete', 'Moderator', 'MODERATOR');
  }
  
  return deny(requestUserId, post.id, 'post-delete', 'Default deny', 'DEFAULT_DENY');
}

/**
 * Filter posts list to only those user can read
 */
export async function filterReadablePosts(
  auth: Authentication,
  posts: (Post & { author?: User })[]
): Promise<(Post & { author?: User })[]> {
  const results = await Promise.all(
    posts.map(async (post) => ({
      post,
      canRead: await canDoPostRead(auth, post)
    }))
  );
  
  return results
    .filter(({ canRead }) => canRead.granted)
    .map(({ post }) => post);
}

