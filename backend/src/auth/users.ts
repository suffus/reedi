import { Authentication, PermissionResult } from '../types/permissions';
import { grant, deny } from '../lib/permissions';
import { userHasFacet } from '../lib/facets';
import { isAdministratorFor, isFriendsWith } from '../lib/userRelations';
import { User } from '@prisma/client';

/**
 * Check if user can view another user's profile
 */
export async function canViewUser(
  auth: Authentication,
  targetUser: User
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  // Public profiles are viewable by anyone
  if (!targetUser.isPrivate) {
    return grant(requestUserId, targetUser.id, 'user-view', 'Profile is public', 'PUBLIC_PROFILE');
  }
  
  if (!requestUserId) {
    return deny(null, targetUser.id, 'user-view', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Users can view their own profile
  if (requestUserId === targetUser.id) {
    return grant(requestUserId, targetUser.id, 'user-view', 'Own profile', 'SELF');
  }
  
  // Line managers can view their reports' profiles
  if (await isAdministratorFor(requestUserId, targetUser.id)) {
    return grant(requestUserId, targetUser.id, 'user-view', 'Line manager', 'LINE_MANAGER');
  }
  
  // Global admins can view all
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, targetUser.id, 'user-view', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // HR admins can view profiles
  if (await userHasFacet(requestUserId, 'user-role:hr-admin')) {
    return grant(requestUserId, targetUser.id, 'user-view', 'HR admin', 'HR_ADMIN');
  }
  
  // Friends can view private profiles
  if (await isFriendsWith(requestUserId, targetUser.id)) {
    return grant(requestUserId, targetUser.id, 'user-view', 'Friend', 'FRIEND');
  }
  
  return deny(requestUserId, targetUser.id, 'user-view', 'Default deny', 'DEFAULT_DENY');
}

/**
 * Check if user can update another user's profile
 */
export async function canUpdateUser(
  auth: Authentication,
  targetUser: User
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, targetUser.id, 'user-update', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Users can update their own profile
  if (requestUserId === targetUser.id) {
    return grant(requestUserId, targetUser.id, 'user-update', 'Own profile', 'SELF');
  }
  
  // Global admins can update any profile
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, targetUser.id, 'user-update', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // HR admins can update profiles
  if (await userHasFacet(requestUserId, 'user-role:hr-admin')) {
    return grant(requestUserId, targetUser.id, 'user-update', 'HR admin', 'HR_ADMIN');
  }
  
  return deny(requestUserId, targetUser.id, 'user-update', 'Default deny', 'DEFAULT_DENY');
}

/**
 * Check if user can set/change another user's line manager
 */
export async function canSetLineManager(
  auth: Authentication,
  targetUserId: string,
  newManagerId?: string
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, targetUserId, 'user-set-line-manager', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Global admins can set any line manager
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(
      requestUserId,
      targetUserId,
      'user-set-line-manager',
      'Global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  // HR admins can set line managers
  if (await userHasFacet(requestUserId, 'user-role:hr-admin')) {
    return grant(
      requestUserId,
      targetUserId,
      'user-set-line-manager',
      'HR admin',
      'HR_ADMIN'
    );
  }
  
  // Divisional admins can set line managers within their division
  if (await userHasFacet(requestUserId, 'reedi-admin:divisional')) {
    // TODO: Check if both target and new manager are in same division
    return grant(
      requestUserId,
      targetUserId,
      'user-set-line-manager',
      'Divisional admin',
      'DIVISIONAL_ADMIN'
    );
  }
  
  return deny(
    requestUserId,
    targetUserId,
    'user-set-line-manager',
    'Insufficient permissions',
    'DEFAULT_DENY'
  );
}

/**
 * Check if user can view organizational hierarchy
 */
export async function canViewOrgHierarchy(
  auth: Authentication
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, null, 'org-hierarchy-view', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Admins can view hierarchy
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, null, 'org-hierarchy-view', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // HR can view hierarchy
  if (await userHasFacet(requestUserId, 'user-role:hr-admin')) {
    return grant(requestUserId, null, 'org-hierarchy-view', 'HR admin', 'HR_ADMIN');
  }
  
  // Managers with direct reports can view their reporting tree
  // Note: This will be checked by counting direct reports in the route handler
  return grant(
    requestUserId,
    null,
    'org-hierarchy-view',
    'Authenticated user can view their own tree',
    'AUTHENTICATED'
  );
}

/**
 * Check if user can view another user's line manager
 */
export async function canViewLineManager(
  auth: Authentication,
  targetUserId: string
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, targetUserId, 'user-view-line-manager', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Users can view their own line manager
  if (requestUserId === targetUserId) {
    return grant(requestUserId, targetUserId, 'user-view-line-manager', 'Own line manager', 'SELF');
  }
  
  // Admins can view
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, targetUserId, 'user-view-line-manager', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // HR can view
  if (await userHasFacet(requestUserId, 'user-role:hr-admin')) {
    return grant(requestUserId, targetUserId, 'user-view-line-manager', 'HR admin', 'HR_ADMIN');
  }
  
  // Line managers can view their reports' managers
  if (await isAdministratorFor(requestUserId, targetUserId)) {
    return grant(requestUserId, targetUserId, 'user-view-line-manager', 'Line manager', 'LINE_MANAGER');
  }
  
  return deny(requestUserId, targetUserId, 'user-view-line-manager', 'Default deny', 'DEFAULT_DENY');
}

/**
 * Check if user can view another user's direct reports
 */
export async function canViewDirectReports(
  auth: Authentication,
  managerId: string
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, managerId, 'user-view-direct-reports', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Users can view their own reports
  if (requestUserId === managerId) {
    return grant(requestUserId, managerId, 'user-view-direct-reports', 'Own reports', 'SELF');
  }
  
  // Admins can view
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, managerId, 'user-view-direct-reports', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // HR can view
  if (await userHasFacet(requestUserId, 'user-role:hr-admin')) {
    return grant(requestUserId, managerId, 'user-view-direct-reports', 'HR admin', 'HR_ADMIN');
  }
  
  // Manager's manager can view reports
  if (await isAdministratorFor(requestUserId, managerId)) {
    return grant(requestUserId, managerId, 'user-view-direct-reports', 'Senior manager', 'SENIOR_MANAGER');
  }
  
  return deny(requestUserId, managerId, 'user-view-direct-reports', 'Default deny', 'DEFAULT_DENY');
}

