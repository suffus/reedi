import { Authentication, PermissionResult } from '../types/permissions';
import { grant, deny } from '../lib/permissions';
import { userHasFacet } from '../lib/facets';
import { Group, GroupMember } from '@prisma/client';
import { prisma } from '../db';

/**
 * Check if user can view a group's details
 */
export async function canViewGroup(
  auth: Authentication,
  group: Group
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  // Public and PRIVATE_VISIBLE groups can be viewed by anyone
  if (group.visibility === 'PUBLIC' || group.visibility === 'PRIVATE_VISIBLE') {
    return grant(
      userId,
      group.id,
      'group-view',
      'Group is publicly visible',
      'PUBLIC_GROUP'
    );
  }
  
  // PRIVATE_HIDDEN groups require authentication
  if (!userId) {
    return deny(
      null,
      group.id,
      'group-view',
      'Private group requires authentication',
      'NOT_AUTHENTICATED'
    );
  }
  
  // Check if user is a member
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: group.id,
      userId: userId,
      status: 'ACTIVE'
    }
  });
  
  if (membership) {
    return grant(
      userId,
      group.id,
      'group-view',
      'User is a member',
      'MEMBER'
    );
  }
  
  // Global admins can view all groups
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(
      userId,
      group.id,
      'group-view',
      'Global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  return deny(
    userId,
    group.id,
    'group-view',
    'Private group and not a member',
    'NOT_MEMBER'
  );
}

/**
 * Check if user can create a group
 */
export async function canCreateGroup(
  auth: Authentication
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(
      null,
      'new-group',
      'group-create',
      'Not authenticated',
      'NOT_AUTHENTICATED'
    );
  }
  
  // Check if user has group creation permission
  if (await userHasFacet(userId, 'group-permissions:can-create-groups')) {
    return grant(
      userId,
      'new-group',
      'group-create',
      'Has group creation permission',
      'HAS_PERMISSION'
    );
  }
  
  // Global admins can create groups
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(
      userId,
      'new-group',
      'group-create',
      'Global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  // By default, authenticated users can create groups
  return grant(
    userId,
    'new-group',
    'group-create',
    'Authenticated user',
    'AUTHENTICATED'
  );
}

/**
 * Check if user can update a group
 */
export async function canUpdateGroup(
  auth: Authentication,
  group: Group
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(
      null,
      group.id,
      'group-update',
      'Not authenticated',
      'NOT_AUTHENTICATED'
    );
  }
  
  // Check if user is owner or admin
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: group.id,
      userId: userId,
      status: 'ACTIVE',
      role: {
        in: ['OWNER', 'ADMIN']
      }
    }
  });
  
  if (membership) {
    return grant(
      userId,
      group.id,
      'group-update',
      `Group ${membership.role.toLowerCase()}`,
      membership.role === 'OWNER' ? 'OWNER' : 'ADMIN'
    );
  }
  
  // Global admins can update groups
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(
      userId,
      group.id,
      'group-update',
      'Global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  return deny(
    userId,
    group.id,
    'group-update',
    'Must be group owner or admin',
    'NOT_AUTHORIZED'
  );
}

/**
 * Check if user can delete a group
 */
export async function canDeleteGroup(
  auth: Authentication,
  group: Group
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(
      null,
      group.id,
      'group-delete',
      'Not authenticated',
      'NOT_AUTHENTICATED'
    );
  }
  
  // Only group owner can delete
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: group.id,
      userId: userId,
      status: 'ACTIVE',
      role: 'OWNER'
    }
  });
  
  if (membership) {
    return grant(
      userId,
      group.id,
      'group-delete',
      'Group owner',
      'OWNER'
    );
  }
  
  // Global admins can delete groups
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(
      userId,
      group.id,
      'group-delete',
      'Global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  return deny(
    userId,
    group.id,
    'group-delete',
    'Must be group owner',
    'NOT_OWNER'
  );
}

/**
 * Check if user can join a group (apply for membership)
 */
export async function canJoinGroup(
  auth: Authentication,
  group: Group
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(
      null,
      group.id,
      'group-join',
      'Not authenticated',
      'NOT_AUTHENTICATED'
    );
  }
  
  // Check if already a member
  const existingMembership = await prisma.groupMember.findFirst({
    where: {
      groupId: group.id,
      userId: userId
    }
  });
  
  if (existingMembership && existingMembership.status === 'ACTIVE') {
    return deny(
      userId,
      group.id,
      'group-join',
      'Already a member',
      'ALREADY_MEMBER'
    );
  }
  
  // Check if there's a pending application
  const pendingApplication = await prisma.groupApplication.findFirst({
    where: {
      groupId: group.id,
      applicantId: userId,
      status: 'PENDING'
    }
  });
  
  if (pendingApplication) {
    return deny(
      userId,
      group.id,
      'group-join',
      'Application already pending',
      'PENDING_APPLICATION'
    );
  }
  
  // Anyone can apply to join (actual approval is separate)
  return grant(
    userId,
    group.id,
    'group-join',
    'Can apply for membership',
    'CAN_APPLY'
  );
}

/**
 * Check if user can invite others to group
 */
export async function canInviteToGroup(
  auth: Authentication,
  group: Group
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(
      null,
      group.id,
      'group-invite',
      'Not authenticated',
      'NOT_AUTHENTICATED'
    );
  }
  
  // Check if user is owner, admin, or moderator
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: group.id,
      userId: userId,
      status: 'ACTIVE',
      role: {
        in: ['OWNER', 'ADMIN', 'MODERATOR']
      }
    }
  });
  
  if (membership) {
    return grant(
      userId,
      group.id,
      'group-invite',
      `Group ${membership.role.toLowerCase()}`,
      membership.role
    );
  }
  
  // Global admins can invite
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(
      userId,
      group.id,
      'group-invite',
      'Global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  return deny(
    userId,
    group.id,
    'group-invite',
    'Must be group staff',
    'NOT_AUTHORIZED'
  );
}

/**
 * Check if user can review membership applications
 */
export async function canReviewApplications(
  auth: Authentication,
  group: Group
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(
      null,
      group.id,
      'group-review-applications',
      'Not authenticated',
      'NOT_AUTHENTICATED'
    );
  }
  
  // Check if user is owner, admin, or moderator
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: group.id,
      userId: userId,
      status: 'ACTIVE',
      role: {
        in: ['OWNER', 'ADMIN', 'MODERATOR']
      }
    }
  });
  
  if (membership) {
    return grant(
      userId,
      group.id,
      'group-review-applications',
      `Group ${membership.role.toLowerCase()}`,
      membership.role
    );
  }
  
  // Global admins can review
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(
      userId,
      group.id,
      'group-review-applications',
      'Global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  return deny(
    userId,
    group.id,
    'group-review-applications',
    'Must be group staff',
    'NOT_AUTHORIZED'
  );
}

/**
 * Check if user can manage member roles
 */
export async function canManageMemberRoles(
  auth: Authentication,
  group: Group,
  targetMember: GroupMember
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(
      null,
      group.id,
      'group-manage-roles',
      'Not authenticated',
      'NOT_AUTHENTICATED'
    );
  }
  
  // Can't change your own role
  if (userId === targetMember.userId) {
    return deny(
      userId,
      group.id,
      'group-manage-roles',
      'Cannot change own role',
      'SELF_ROLE_CHANGE'
    );
  }
  
  // Get requester's membership
  const requesterMembership = await prisma.groupMember.findFirst({
    where: {
      groupId: group.id,
      userId: userId,
      status: 'ACTIVE'
    }
  });
  
  if (!requesterMembership) {
    return deny(
      userId,
      group.id,
      'group-manage-roles',
      'Not a member',
      'NOT_MEMBER'
    );
  }
  
  // Owner can change anyone's role
  if (requesterMembership.role === 'OWNER') {
    return grant(
      userId,
      group.id,
      'group-manage-roles',
      'Group owner',
      'OWNER'
    );
  }
  
  // Admins can change roles of moderators and members (but not other admins or owner)
  if (requesterMembership.role === 'ADMIN') {
    if (targetMember.role === 'MODERATOR' || targetMember.role === 'MEMBER') {
      return grant(
        userId,
        group.id,
        'group-manage-roles',
        'Group admin',
        'ADMIN'
      );
    }
    return deny(
      userId,
      group.id,
      'group-manage-roles',
      'Admins cannot change admin or owner roles',
      'INSUFFICIENT_ROLE'
    );
  }
  
  // Global admins can manage roles
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(
      userId,
      group.id,
      'group-manage-roles',
      'Global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  return deny(
    userId,
    group.id,
    'group-manage-roles',
    'Insufficient permissions',
    'NOT_AUTHORIZED'
  );
}

/**
 * Check if user can post to a group
 */
export async function canPostToGroup(
  auth: Authentication,
  group: Group
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(
      null,
      group.id,
      'group-post',
      'Not authenticated',
      'NOT_AUTHENTICATED'
    );
  }
  
  // Check if user is an active member
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: group.id,
      userId: userId,
      status: 'ACTIVE'
    }
  });
  
  if (!membership) {
    return deny(
      userId,
      group.id,
      'group-post',
      'Must be a member',
      'NOT_MEMBER'
    );
  }
  
  // Check if suspended
  if (membership.suspendedAt) {
    return deny(
      userId,
      group.id,
      'group-post',
      'Membership suspended',
      'SUSPENDED'
    );
  }
  
  // Global admins can post
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(
      userId,
      group.id,
      'group-post',
      'Global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  return grant(
    userId,
    group.id,
    'group-post',
    'Active member',
    'MEMBER'
  );
}

/**
 * Check if user can moderate posts in a group
 */
export async function canModerateGroupPosts(
  auth: Authentication,
  group: Group
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(
      null,
      group.id,
      'group-moderate',
      'Not authenticated',
      'NOT_AUTHENTICATED'
    );
  }
  
  // Check if user is owner, admin, or moderator
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: group.id,
      userId: userId,
      status: 'ACTIVE',
      role: {
        in: ['OWNER', 'ADMIN', 'MODERATOR']
      }
    }
  });
  
  if (membership) {
    return grant(
      userId,
      group.id,
      'group-moderate',
      `Group ${membership.role.toLowerCase()}`,
      membership.role
    );
  }
  
  // Global admins and platform moderators can moderate
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(
      userId,
      group.id,
      'group-moderate',
      'Global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  if (await userHasFacet(userId, 'user-role:moderator')) {
    return grant(
      userId,
      group.id,
      'group-moderate',
      'Platform moderator',
      'PLATFORM_MODERATOR'
    );
  }
  
  return deny(
    userId,
    group.id,
    'group-moderate',
    'Must be group staff or platform moderator',
    'NOT_AUTHORIZED'
  );
}

/**
 * Check if user can view group activity log
 */
export async function canViewGroupActivity(
  auth: Authentication,
  group: Group
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(
      null,
      group.id,
      'group-activity-view',
      'Not authenticated',
      'NOT_AUTHENTICATED'
    );
  }
  
  // Check if user is owner or admin
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: group.id,
      userId: userId,
      status: 'ACTIVE',
      role: {
        in: ['OWNER', 'ADMIN']
      }
    }
  });
  
  if (membership) {
    return grant(
      userId,
      group.id,
      'group-activity-view',
      `Group ${membership.role.toLowerCase()}`,
      membership.role
    );
  }
  
  // Global admins can view
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(
      userId,
      group.id,
      'group-activity-view',
      'Global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  return deny(
    userId,
    group.id,
    'group-activity-view',
    'Must be group owner or admin',
    'NOT_AUTHORIZED'
  );
}

/**
 * Check if user can remove members from group
 */
export async function canRemoveMember(
  auth: Authentication,
  group: Group,
  targetMember: GroupMember
): Promise<PermissionResult> {
  const userId = auth.userId;
  
  if (!userId) {
    return deny(
      null,
      group.id,
      'group-remove-member',
      'Not authenticated',
      'NOT_AUTHENTICATED'
    );
  }
  
  // Members can remove themselves (leave)
  if (userId === targetMember.userId) {
    // Owners must transfer ownership first
    if (targetMember.role === 'OWNER') {
      return deny(
        userId,
        group.id,
        'group-remove-member',
        'Owner must transfer ownership before leaving',
        'OWNER_CANNOT_LEAVE'
      );
    }
    return grant(
      userId,
      group.id,
      'group-remove-member',
      'Leaving group',
      'SELF'
    );
  }
  
  // Get requester's membership
  const requesterMembership = await prisma.groupMember.findFirst({
    where: {
      groupId: group.id,
      userId: userId,
      status: 'ACTIVE'
    }
  });
  
  if (!requesterMembership) {
    return deny(
      userId,
      group.id,
      'group-remove-member',
      'Not a member',
      'NOT_MEMBER'
    );
  }
  
  // Owner can remove anyone except themselves
  if (requesterMembership.role === 'OWNER') {
    return grant(
      userId,
      group.id,
      'group-remove-member',
      'Group owner',
      'OWNER'
    );
  }
  
  // Admins can remove moderators and members
  if (requesterMembership.role === 'ADMIN') {
    if (targetMember.role === 'MODERATOR' || targetMember.role === 'MEMBER') {
      return grant(
        userId,
        group.id,
        'group-remove-member',
        'Group admin',
        'ADMIN'
      );
    }
    return deny(
      userId,
      group.id,
      'group-remove-member',
      'Admins cannot remove admins or owner',
      'INSUFFICIENT_ROLE'
    );
  }
  
  // Moderators can remove regular members
  if (requesterMembership.role === 'MODERATOR' && targetMember.role === 'MEMBER') {
    return grant(
      userId,
      group.id,
      'group-remove-member',
      'Group moderator',
      'MODERATOR'
    );
  }
  
  // Global admins can remove members
  if (await userHasFacet(userId, 'reedi-admin:global')) {
    return grant(
      userId,
      group.id,
      'group-remove-member',
      'Global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  return deny(
    userId,
    group.id,
    'group-remove-member',
    'Insufficient permissions',
    'NOT_AUTHORIZED'
  );
}

