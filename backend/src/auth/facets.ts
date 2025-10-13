import { Authentication, PermissionResult } from '../types/permissions';
import { grant, deny } from '../lib/permissions';
import { userHasFacet, parseFacet } from '../lib/facets';

/**
 * Check if user can assign a specific facet
 */
export async function canAssignFacet(
  auth: Authentication,
  targetUserId: string,
  facetIdentifier: string
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, null, 'facet-assign', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Global facet admins can assign any facet
  if (await userHasFacet(requestUserId, 'reedi-facet-admin:global')) {
    return grant(
      requestUserId,
      targetUserId,
      'facet-assign',
      'User is global facet admin',
      'GLOBAL_FACET_ADMIN'
    );
  }
  
  // Global admins can assign facets
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(
      requestUserId,
      targetUserId,
      'facet-assign',
      'User is global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  // Parse the facet to check for specific assignment permissions
  const facet = parseFacet(facetIdentifier);
  
  // Divisional admins can assign divisional facets
  if (facet.scope === 'org-division' && await userHasFacet(requestUserId, 'reedi-admin:divisional')) {
    return grant(
      requestUserId,
      targetUserId,
      'facet-assign',
      'Divisional admin assigning divisional facet',
      'DIVISIONAL_ADMIN'
    );
  }
  
  // HR role can assign department and division facets
  if ((facet.scope === 'org-department' || facet.scope === 'org-division') && 
      await userHasFacet(requestUserId, 'user-role:hr-admin')) {
    return grant(
      requestUserId,
      targetUserId,
      'facet-assign',
      'HR admin assigning org facet',
      'HR_ADMIN'
    );
  }
  
  // Managers can assign certain user-role facets (but not admin roles)
  if (facet.scope === 'user-role' && 
      !['admin', 'hr-admin'].includes(facet.name) &&
      await userHasFacet(requestUserId, 'user-role:manager')) {
    return grant(
      requestUserId,
      targetUserId,
      'facet-assign',
      'Manager assigning non-admin role',
      'MANAGER'
    );
  }
  
  return deny(
    requestUserId,
    targetUserId,
    'facet-assign',
    'No permission to assign this facet',
    'DEFAULT_DENY'
  );
}

/**
 * Check if user can revoke a facet
 */
export async function canRevokeFacet(
  auth: Authentication,
  targetUserId: string,
  facetIdentifier: string
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, targetUserId, 'facet-revoke', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Global facet admins can revoke any facet
  if (await userHasFacet(requestUserId, 'reedi-facet-admin:global')) {
    return grant(
      requestUserId,
      targetUserId,
      'facet-revoke',
      'User is global facet admin',
      'GLOBAL_FACET_ADMIN'
    );
  }
  
  // Global admins can revoke facets
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(
      requestUserId,
      targetUserId,
      'facet-revoke',
      'User is global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  // Parse the facet to check for specific revocation permissions
  const facet = parseFacet(facetIdentifier);
  
  // HR can revoke org facets
  if ((facet.scope === 'org-department' || facet.scope === 'org-division') && 
      await userHasFacet(requestUserId, 'user-role:hr-admin')) {
    return grant(
      requestUserId,
      targetUserId,
      'facet-revoke',
      'HR admin revoking org facet',
      'HR_ADMIN'
    );
  }
  
  return deny(
    requestUserId,
    targetUserId,
    'facet-revoke',
    'No permission to revoke this facet',
    'DEFAULT_DENY'
  );
}

/**
 * Check if user can view facet assignment history
 */
export async function canViewFacetHistory(
  auth: Authentication,
  targetUserId: string
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, targetUserId, 'facet-history-view', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Users can view their own history
  if (requestUserId === targetUserId) {
    return grant(requestUserId, targetUserId, 'facet-history-view', 'Viewing own history', 'SELF');
  }
  
  // Global admins can view any history
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, targetUserId, 'facet-history-view', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // Global facet admins can view history
  if (await userHasFacet(requestUserId, 'reedi-facet-admin:global')) {
    return grant(requestUserId, targetUserId, 'facet-history-view', 'Global facet admin', 'GLOBAL_FACET_ADMIN');
  }
  
  // HR can view history
  if (await userHasFacet(requestUserId, 'user-role:hr-admin')) {
    return grant(requestUserId, targetUserId, 'facet-history-view', 'HR admin', 'HR_ADMIN');
  }
  
  return deny(requestUserId, targetUserId, 'facet-history-view', 'Default deny', 'DEFAULT_DENY');
}

/**
 * Check if user can view facet definitions
 */
export async function canViewFacetDefinitions(
  auth: Authentication
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, null, 'facet-definitions-view', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // All authenticated users can view facet definitions
  return grant(requestUserId, null, 'facet-definitions-view', 'Authenticated user', 'AUTHENTICATED');
}

/**
 * Check if user can view another user's facets
 */
export async function canViewUserFacets(
  auth: Authentication,
  targetUserId: string
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, targetUserId, 'user-facets-view', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Users can view their own facets
  if (requestUserId === targetUserId) {
    return grant(requestUserId, targetUserId, 'user-facets-view', 'Viewing own facets', 'SELF');
  }
  
  // Global admins can view
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, targetUserId, 'user-facets-view', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // Global facet admins can view
  if (await userHasFacet(requestUserId, 'reedi-facet-admin:global')) {
    return grant(requestUserId, targetUserId, 'user-facets-view', 'Global facet admin', 'GLOBAL_FACET_ADMIN');
  }
  
  // HR can view
  if (await userHasFacet(requestUserId, 'user-role:hr-admin')) {
    return grant(requestUserId, targetUserId, 'user-facets-view', 'HR admin', 'HR_ADMIN');
  }
  
  return deny(requestUserId, targetUserId, 'user-facets-view', 'Default deny', 'DEFAULT_DENY');
}

