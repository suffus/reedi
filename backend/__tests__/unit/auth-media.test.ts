import { prisma } from '@/db';
import {
  canDoMediaRead,
  canDoMediaUpdate,
  canDoMediaDelete,
  canDoMediaCreate,
  filterReadableMedia
} from '@/auth/media';
import { Authentication } from '@/types/permissions';
import { assignFacet } from '@/lib/facets';

describe('Media Permissions', () => {
  let owner: any, friend: any, stranger: any, admin: any, manager: any, employee: any;
  let publicMedia: any, privateMedia: any, friendsOnlyMedia: any;

  beforeAll(async () => {
    // Create users with unique emails for this test suite
    owner = await prisma.user.create({
      data: { email: 'media-owner@test.com', name: 'Media Owner', password: 'hash' }
    });
    friend = await prisma.user.create({
      data: { email: 'media-friend@test.com', name: 'Media Friend', password: 'hash' }
    });
    stranger = await prisma.user.create({
      data: { email: 'media-stranger@test.com', name: 'Media Stranger', password: 'hash' }
    });
    admin = await prisma.user.create({
      data: { email: 'media-admin@test.com', name: 'Media Admin', password: 'hash' }
    });
    manager = await prisma.user.create({
      data: { email: 'media-manager@test.com', name: 'Media Manager', password: 'hash' }
    });
    employee = await prisma.user.create({
      data: { email: 'media-employee@test.com', name: 'Media Employee', password: 'hash', lineManagerId: manager.id }
    });

    // Create friend relationship
    await prisma.friendRequest.create({
      data: { senderId: owner.id, receiverId: friend.id, status: 'ACCEPTED' }
    });

    // Create media items
    publicMedia = await prisma.media.create({
      data: {
        url: '/uploads/public.jpg',
        originalFilename: 'public.jpg',
        s3Key: 'public.jpg',
        mimeType: 'image/jpeg',
        size: 1000,
        mediaType: 'IMAGE',
        authorId: owner.id,
        visibility: 'PUBLIC'
      }
    });

    privateMedia = await prisma.media.create({
      data: {
        url: '/uploads/private.jpg',
        originalFilename: 'private.jpg',
        s3Key: 'private.jpg',
        mimeType: 'image/jpeg',
        size: 1000,
        mediaType: 'IMAGE',
        authorId: owner.id,
        visibility: 'PRIVATE'
      }
    });

    friendsOnlyMedia = await prisma.media.create({
      data: {
        url: '/uploads/friends.jpg',
        originalFilename: 'friends.jpg',
        s3Key: 'friends.jpg',
        mimeType: 'image/jpeg',
        size: 1000,
        mediaType: 'IMAGE',
        authorId: owner.id,
        visibility: 'FRIENDS_ONLY'
      }
    });

    // Assign admin facet
    const adminFacet = await prisma.facet.upsert({
      where: { scope_name_value: { scope: 'reedi-admin', name: 'global', value: '' } },
      update: {},
      create: { scope: 'reedi-admin', name: 'global', value: '', description: 'Global Admin' }
    });
    await prisma.facetAssignment.create({
      data: {
        facetId: adminFacet.id,
        entityType: 'USER',
        entityId: admin.id,
        assignedById: null,
        isActive: true
      }
    });
  });

  afterAll(async () => {
    // Only delete test data created by this test suite
    const testUserIds = [owner.id, friend.id, stranger.id, admin.id, manager.id, employee.id];
    
    await prisma.media.deleteMany({
      where: { authorId: { in: testUserIds } }
    });
    await prisma.facetAssignment.deleteMany({
      where: { entityId: { in: testUserIds } }
    });
    await prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: { in: testUserIds } },
          { receiverId: { in: testUserIds } }
        ]
      }
    });
    await prisma.user.deleteMany({
      where: { id: { in: testUserIds } }
    });
    await prisma.$disconnect();
  });

  const createAuth = (user: any): Authentication => ({
    user,
    userId: user?.id || null,
    requestId: 'test-request',
    ipAddress: '127.0.0.1',
    userAgent: 'jest'
  });

  describe('canDoMediaRead', () => {
    it('should allow anyone to read PUBLIC media', async () => {
      const auth = createAuth(stranger);
      const result = await canDoMediaRead(auth, { ...publicMedia, author: owner });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('PUBLIC_MEDIA');
    });

    it('should allow anonymous users to read PUBLIC media', async () => {
      const auth = createAuth(null);
      const result = await canDoMediaRead(auth, { ...publicMedia, author: owner });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('PUBLIC_MEDIA');
    });

    it('should deny anonymous users access to PRIVATE media', async () => {
      const auth = createAuth(null);
      const result = await canDoMediaRead(auth, { ...privateMedia, author: owner });
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });

    it('should allow owner to read their own PRIVATE media', async () => {
      const auth = createAuth(owner);
      const result = await canDoMediaRead(auth, { ...privateMedia, author: owner });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('OWNER');
    });

    it('should allow friends to read FRIENDS_ONLY media', async () => {
      const auth = createAuth(friend);
      const result = await canDoMediaRead(auth, { ...friendsOnlyMedia, author: owner });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('FRIENDS');
    });

    it('should deny strangers access to FRIENDS_ONLY media', async () => {
      const auth = createAuth(stranger);
      const result = await canDoMediaRead(auth, { ...friendsOnlyMedia, author: owner });
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });

    it('should allow global admin to read any media', async () => {
      const auth = createAuth(admin);
      const result = await canDoMediaRead(auth, { ...privateMedia, author: owner });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should allow line manager to read employee media', async () => {
      const employeeMedia = await prisma.media.create({
        data: {
          url: '/uploads/employee.jpg',
          originalFilename: 'employee.jpg',
          s3Key: 'employee.jpg',
          mimeType: 'image/jpeg',
          size: 1000,
          mediaType: 'IMAGE',
          authorId: employee.id,
          visibility: 'PRIVATE'
        }
      });

      const auth = createAuth(manager);
      const result = await canDoMediaRead(auth, { ...employeeMedia, author: employee });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('LINE_MANAGER');

      await prisma.media.delete({ where: { id: employeeMedia.id } });
    });
  });

  describe('canDoMediaUpdate', () => {
    it('should allow owner to update their media', async () => {
      const auth = createAuth(owner);
      const result = await canDoMediaUpdate(auth, publicMedia);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('OWNER');
    });

    it('should deny non-owner from updating media', async () => {
      const auth = createAuth(stranger);
      const result = await canDoMediaUpdate(auth, publicMedia);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });

    it('should allow admin to update any media', async () => {
      const auth = createAuth(admin);
      const result = await canDoMediaUpdate(auth, publicMedia);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should deny anonymous users', async () => {
      const auth = createAuth(null);
      const result = await canDoMediaUpdate(auth, publicMedia);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canDoMediaDelete', () => {
    it('should allow owner to delete their media', async () => {
      const auth = createAuth(owner);
      const result = await canDoMediaDelete(auth, publicMedia);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('OWNER');
    });

    it('should deny non-owner from deleting media', async () => {
      const auth = createAuth(stranger);
      const result = await canDoMediaDelete(auth, publicMedia);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });

    it('should allow admin to delete any media', async () => {
      const auth = createAuth(admin);
      const result = await canDoMediaDelete(auth, publicMedia);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });
  });

  describe('canDoMediaCreate', () => {
    it('should allow authenticated users to create media', async () => {
      const auth = createAuth(owner);
      const result = await canDoMediaCreate(auth);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('AUTHENTICATED');
    });

    it('should deny anonymous users', async () => {
      const auth = createAuth(null);
      const result = await canDoMediaCreate(auth);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('filterReadableMedia', () => {
    it('should filter media to only viewable items', async () => {
      const auth = createAuth(stranger);
      const mediaList = [
        { ...publicMedia, author: owner },
        { ...privateMedia, author: owner },
        { ...friendsOnlyMedia, author: owner }
      ];

      const filtered = await filterReadableMedia(auth, mediaList);
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe(publicMedia.id);
    });

    it('should return all media for admin', async () => {
      const auth = createAuth(admin);
      const mediaList = [
        { ...publicMedia, author: owner },
        { ...privateMedia, author: owner },
        { ...friendsOnlyMedia, author: owner }
      ];

      const filtered = await filterReadableMedia(auth, mediaList);
      expect(filtered.length).toBe(3);
    });
  });
});

