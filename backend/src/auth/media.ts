import { Authentication, PermissionResult } from '../types/permissions';
import { grant, deny } from '../lib/permissions';
import { userHasFacet, userGetFacetValue } from '../lib/facets';
import { isFriendsWith, isAdministratorFor } from '../lib/userRelations';
import { Media, User } from '@prisma/client';

/**
 * Check if user can read media item
 */
export async function canDoMediaRead(
  auth: Authentication,
  media: Media & { author?: User }
): Promise<PermissionResult> {
  const requestUser = auth.user;
  const requestUserId = auth.userId;
  
  // Public media is always readable
  if (media.visibility === 'PUBLIC') {
    return grant(
      requestUserId,
      media.id,
      'media-read',
      'Media is public',
      'PUBLIC_MEDIA'
    );
  }
  
  // Anonymous users can only see public media
  if (!requestUser || !requestUserId) {
    return deny(
      requestUserId,
      media.id,
      'media-read',
      'No authenticated user and media is not public',
      'NOT_AUTHENTICATED'
    );
  }
  
  // Owner can always read their own media
  if (media.authorId === requestUserId) {
    return grant(
      requestUserId,
      media.id,
      'media-read',
      'Request user is the owner',
      'OWNER'
    );
  }
  
  // Friends can read FRIENDS_ONLY media
  if (media.visibility === 'FRIENDS_ONLY') {
    const areFriends = await isFriendsWith(requestUserId, media.authorId);
    if (areFriends) {
      return grant(
        requestUserId,
        media.id,
        'media-read',
        'Request user is friends with owner and media is FRIENDS_ONLY',
        'FRIENDS'
      );
    }
  }
  
  // Global admins can read all media
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(
      requestUserId,
      media.id,
      'media-read',
      'Request user is a global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  // Local/divisional admins can read media from same division
  if (await userHasFacet(requestUserId, 'reedi-admin:divisional')) {
    const requestUserDivision = await userGetFacetValue(requestUserId, 'org-division', 'division');
    const ownerDivision = await userGetFacetValue(media.authorId, 'org-division', 'division');
    
    if (requestUserDivision && requestUserDivision === ownerDivision) {
      return grant(
        requestUserId,
        media.id,
        'media-read',
        'Request user is divisional admin for same division as owner',
        'DIVISIONAL_ADMIN'
      );
    }
  }
  
  // Line managers can read their reports' media
  if (await isAdministratorFor(requestUserId, media.authorId)) {
    return grant(
      requestUserId,
      media.id,
      'media-read',
      'Request user is line manager for owner',
      'LINE_MANAGER'
    );
  }
  
  // Default deny
  return deny(
    requestUserId,
    media.id,
    'media-read',
    'No permission rules matched',
    'DEFAULT_DENY'
  );
}

/**
 * Check if user can update media item
 */
export async function canDoMediaUpdate(
  auth: Authentication,
  media: Media
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, media.id, 'media-update', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Owner can update
  if (media.authorId === requestUserId) {
    return grant(requestUserId, media.id, 'media-update', 'User is owner', 'OWNER');
  }
  
  // Global admins can update
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, media.id, 'media-update', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  return deny(requestUserId, media.id, 'media-update', 'Default deny', 'DEFAULT_DENY');
}

/**
 * Check if user can delete media item
 */
export async function canDoMediaDelete(
  auth: Authentication,
  media: Media
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, media.id, 'media-delete', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Owner can delete
  if (media.authorId === requestUserId) {
    return grant(requestUserId, media.id, 'media-delete', 'User is owner', 'OWNER');
  }
  
  // Global admins can delete
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, media.id, 'media-delete', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  return deny(requestUserId, media.id, 'media-delete', 'Default deny', 'DEFAULT_DENY');
}

/**
 * Check if user can create media
 */
export async function canDoMediaCreate(
  auth: Authentication
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, null, 'media-create', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // All authenticated users can create media
  return grant(requestUserId, null, 'media-create', 'Authenticated user', 'AUTHENTICATED');
}

/**
 * Filter media list to only those user can read
 */
export async function filterReadableMedia<T extends Media & { author?: User | { id: string } }>(
  auth: Authentication,
  mediaList: T[]
): Promise<T[]> {
  const results = await Promise.all(
    mediaList.map(async (media) => ({
      media,
      canRead: await canDoMediaRead(auth, media as any)
    }))
  );
  
  return results
    .filter(({ canRead }) => canRead.granted)
    .map(({ media }) => media);
}

