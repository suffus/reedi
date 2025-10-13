import { Authentication, PermissionResult } from '../types/permissions';
import { grant, deny } from '../lib/permissions';
import { userHasFacet } from '../lib/facets';
import { isAdministratorFor } from '../lib/userRelations';

/**
 * Friend request type (simplified for permission checks)
 */
interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: string;
}

/**
 * Check if user can send a friend request to another user
 */
export async function canSendFriendRequest(
  auth: Authentication,
  targetUserId: string
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(null, targetUserId, 'friend-request-send', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Can't send to yourself
  if (userId === targetUserId) {
    return deny(userId, targetUserId, 'friend-request-send', 'Cannot send to yourself', 'SELF_REQUEST');
  }
  
  // Global admins bypass (though typically wouldn't use friend system)
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(userId, targetUserId, 'friend-request-send', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // Anyone can send friend requests (blocked users handled in route)
  return grant(userId, targetUserId, 'friend-request-send', 'Standard friend request', 'STANDARD');
}

/**
 * Check if user can view their received friend requests
 */
export async function canViewReceivedRequests(
  auth: Authentication
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(null, null, 'friend-requests-view-received', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Users can always view their own received requests
  return grant(userId, userId, 'friend-requests-view-received', 'Own requests', 'SELF');
}

/**
 * Check if user can view their sent friend requests
 */
export async function canViewSentRequests(
  auth: Authentication
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(null, null, 'friend-requests-view-sent', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Users can always view their own sent requests
  return grant(userId, userId, 'friend-requests-view-sent', 'Own requests', 'SELF');
}

/**
 * Check if user can accept a friend request
 */
export async function canAcceptFriendRequest(
  auth: Authentication,
  friendRequest: FriendRequest
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(null, friendRequest.id, 'friend-request-accept', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Only receiver can accept
  if (userId === friendRequest.receiverId) {
    return grant(userId, friendRequest.id, 'friend-request-accept', 'Request receiver', 'RECEIVER');
  }
  
  // Global admins can accept (for moderation purposes)
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(userId, friendRequest.id, 'friend-request-accept', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  return deny(userId, friendRequest.id, 'friend-request-accept', 'Only receiver can accept', 'NOT_RECEIVER');
}

/**
 * Check if user can reject a friend request
 */
export async function canRejectFriendRequest(
  auth: Authentication,
  friendRequest: FriendRequest
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(null, friendRequest.id, 'friend-request-reject', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Only receiver can reject
  if (userId === friendRequest.receiverId) {
    return grant(userId, friendRequest.id, 'friend-request-reject', 'Request receiver', 'RECEIVER');
  }
  
  // Global admins can reject (for moderation purposes)
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(userId, friendRequest.id, 'friend-request-reject', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  return deny(userId, friendRequest.id, 'friend-request-reject', 'Only receiver can reject', 'NOT_RECEIVER');
}

/**
 * Check if user can cancel a friend request they sent
 */
export async function canCancelFriendRequest(
  auth: Authentication,
  friendRequest: FriendRequest
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(null, friendRequest.id, 'friend-request-cancel', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Only sender can cancel
  if (userId === friendRequest.senderId) {
    return grant(userId, friendRequest.id, 'friend-request-cancel', 'Request sender', 'SENDER');
  }
  
  // Global admins can cancel (for moderation purposes)
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(userId, friendRequest.id, 'friend-request-cancel', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  return deny(userId, friendRequest.id, 'friend-request-cancel', 'Only sender can cancel', 'NOT_SENDER');
}

/**
 * Check if user can view friendship status with another user
 */
export async function canViewFriendshipStatus(
  auth: Authentication,
  targetUserId: string
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(null, targetUserId, 'friendship-status-view', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Can view status with yourself (though not typical)
  if (userId === targetUserId) {
    return grant(userId, targetUserId, 'friendship-status-view', 'Own status', 'SELF');
  }
  
  // Global admins can view all statuses
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(userId, targetUserId, 'friendship-status-view', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // Anyone can check friendship status (PUBLIC info about relationship)
  return grant(userId, targetUserId, 'friendship-status-view', 'Public friendship status', 'PUBLIC');
}

/**
 * Check if user can view another user's friends list
 */
export async function canViewFriendsList(
  auth: Authentication,
  targetUserId: string,
  isPrivateProfile: boolean
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  // Public profiles - anyone can view friends list
  if (!isPrivateProfile) {
    return grant(userId, targetUserId, 'friends-list-view', 'Public profile', 'PUBLIC_PROFILE');
  }
  
  if (!userId) {
    return deny(null, targetUserId, 'friends-list-view', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Can view own friends list
  if (userId === targetUserId) {
    return grant(userId, targetUserId, 'friends-list-view', 'Own friends', 'SELF');
  }
  
  // Global admins can view all lists
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(userId, targetUserId, 'friends-list-view', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // Line managers can view reports' friends
  if (await isAdministratorFor(userId, targetUserId)) {
    return grant(userId, targetUserId, 'friends-list-view', 'Line manager', 'LINE_MANAGER');
  }
  
  // For private profiles, only authenticated and related users
  // In practice, we'd check if they're friends here
  return deny(userId, targetUserId, 'friends-list-view', 'Private profile', 'PRIVATE_PROFILE');
}

/**
 * Check if user can remove a friendship
 */
export async function canRemoveFriend(
  auth: Authentication,
  friendshipUserId: string
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(null, friendshipUserId, 'friendship-remove', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Users can remove their own friendships
  return grant(userId, friendshipUserId, 'friendship-remove', 'Remove own friendship', 'SELF');
}

