import { prisma } from '@/db';
import {
  canDoPostRead,
  canDoPostCreate,
  canCreateLockedPost,
  canDoPostUpdate,
  canDoPostDelete,
  filterReadablePosts
} from '@/auth/posts';
import { Authentication } from '@/types/permissions';

describe('Post Permissions', () => {
  let owner: any, friend: any, stranger: any, admin: any, moderator: any;
  let publicPost: any, privatePost: any, friendsOnlyPost: any, lockedPost: any;

  beforeAll(async () => {
    // Create users with unique emails for this test suite
    owner = await prisma.user.create({
      data: { email: 'posts-owner@test.com', name: 'Posts Owner', password: 'hash' }
    });
    friend = await prisma.user.create({
      data: { email: 'posts-friend@test.com', name: 'Posts Friend', password: 'hash' }
    });
    stranger = await prisma.user.create({
      data: { email: 'posts-stranger@test.com', name: 'Posts Stranger', password: 'hash' }
    });
    admin = await prisma.user.create({
      data: { email: 'posts-admin@test.com', name: 'Posts Admin', password: 'hash' }
    });
    moderator = await prisma.user.create({
      data: { email: 'posts-moderator@test.com', name: 'Posts Moderator', password: 'hash' }
    });

    // Create friend relationship
    await prisma.friendRequest.create({
      data: { senderId: owner.id, receiverId: friend.id, status: 'ACCEPTED' }
    });

    // Create posts
    publicPost = await prisma.post.create({
      data: {
        content: 'Public post',
        authorId: owner.id,
        visibility: 'PUBLIC',
        publicationStatus: 'PUBLIC'
      }
    });

    privatePost = await prisma.post.create({
      data: {
        content: 'Private post',
        authorId: owner.id,
        visibility: 'PRIVATE',
        publicationStatus: 'PUBLIC'
      }
    });

    friendsOnlyPost = await prisma.post.create({
      data: {
        content: 'Friends only post',
        authorId: owner.id,
        visibility: 'FRIENDS_ONLY',
        publicationStatus: 'PUBLIC'
      }
    });

    lockedPost = await prisma.post.create({
      data: {
        content: 'Locked post',
        authorId: owner.id,
        visibility: 'PUBLIC',
        publicationStatus: 'PUBLIC',
        isLocked: true
      }
    });

    // Assign facets
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

    const modFacet = await prisma.facet.upsert({
      where: { scope_name_value: { scope: 'user-role', name: 'moderator', value: '' } },
      update: {},
      create: { scope: 'user-role', name: 'moderator', value: '', description: 'Moderator' }
    });
    await prisma.facetAssignment.create({
      data: {
        facetId: modFacet.id,
        entityType: 'USER',
        entityId: moderator.id,
        assignedById: null,
        isActive: true
      }
    });

    const lockedPostFacet = await prisma.facet.upsert({
      where: { scope_name_value: { scope: 'feature-access', name: 'locked-posts', value: '' } },
      update: {},
      create: { scope: 'feature-access', name: 'locked-posts', value: '', description: 'Can create locked posts' }
    });
    await prisma.facetAssignment.create({
      data: {
        facetId: lockedPostFacet.id,
        entityType: 'USER',
        entityId: owner.id,
        assignedById: null,
        isActive: true
      }
    });
  });

  afterAll(async () => {
    // Only delete test data created by this test suite
    const testUserIds = [owner.id, friend.id, stranger.id, admin.id, moderator.id];
    
    await prisma.post.deleteMany({
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

  describe('canDoPostRead', () => {
    it('should allow anyone to read PUBLIC posts', async () => {
      const auth = createAuth(stranger);
      const result = await canDoPostRead(auth, { ...publicPost, author: owner });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('PUBLIC_POST');
    });

    it('should allow anonymous users to read PUBLIC posts', async () => {
      const auth = createAuth(null);
      const result = await canDoPostRead(auth, { ...publicPost, author: owner });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('PUBLIC_POST');
    });

    it('should deny anonymous users access to PRIVATE posts', async () => {
      const auth = createAuth(null);
      const result = await canDoPostRead(auth, { ...privatePost, author: owner });
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });

    it('should allow owner to read their own posts', async () => {
      const auth = createAuth(owner);
      const result = await canDoPostRead(auth, { ...privatePost, author: owner });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('OWNER');
    });

    it('should allow friends to read FRIENDS_ONLY posts', async () => {
      const auth = createAuth(friend);
      const result = await canDoPostRead(auth, { ...friendsOnlyPost, author: owner });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('FRIENDS');
    });

    it('should deny strangers access to FRIENDS_ONLY posts', async () => {
      const auth = createAuth(stranger);
      const result = await canDoPostRead(auth, { ...friendsOnlyPost, author: owner });
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });

    it('should allow admin to read any post', async () => {
      const auth = createAuth(admin);
      const result = await canDoPostRead(auth, { ...privatePost, author: owner });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });
  });

  describe('canDoPostCreate', () => {
    it('should allow authenticated users to create posts', async () => {
      const auth = createAuth(owner);
      const result = await canDoPostCreate(auth);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('AUTHENTICATED');
    });

    it('should deny anonymous users', async () => {
      const auth = createAuth(null);
      const result = await canDoPostCreate(auth);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canCreateLockedPost', () => {
    it('should allow users with locked-posts facet', async () => {
      const auth = createAuth(owner);
      const result = await canCreateLockedPost(auth);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('LOCKED_POSTS_FACET');
    });

    it('should deny users without locked-posts facet', async () => {
      const auth = createAuth(stranger);
      const result = await canCreateLockedPost(auth);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });

    it('should deny anonymous users', async () => {
      const auth = createAuth(null);
      const result = await canCreateLockedPost(auth);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canDoPostUpdate', () => {
    it('should allow owner to update their post', async () => {
      const auth = createAuth(owner);
      const result = await canDoPostUpdate(auth, publicPost);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('OWNER');
    });

    it('should deny non-owner from updating post', async () => {
      const auth = createAuth(stranger);
      const result = await canDoPostUpdate(auth, publicPost);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });

    it('should allow admin to update any post', async () => {
      const auth = createAuth(admin);
      const result = await canDoPostUpdate(auth, publicPost);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });
  });

  describe('canDoPostDelete', () => {
    it('should allow owner to delete their post', async () => {
      const auth = createAuth(owner);
      const result = await canDoPostDelete(auth, publicPost);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('OWNER');
    });

    it('should deny non-owner from deleting post', async () => {
      const auth = createAuth(stranger);
      const result = await canDoPostDelete(auth, publicPost);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });

    it('should allow admin to delete any post', async () => {
      const auth = createAuth(admin);
      const result = await canDoPostDelete(auth, publicPost);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should allow moderator to delete posts', async () => {
      const auth = createAuth(moderator);
      const result = await canDoPostDelete(auth, publicPost);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('MODERATOR');
    });
  });

  describe('filterReadablePosts', () => {
    it('should filter posts to only viewable items', async () => {
      const auth = createAuth(stranger);
      const postList = [
        { ...publicPost, author: owner },
        { ...privatePost, author: owner },
        { ...friendsOnlyPost, author: owner }
      ];

      const filtered = await filterReadablePosts(auth, postList);
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe(publicPost.id);
    });

    it('should return all posts for admin', async () => {
      const auth = createAuth(admin);
      const postList = [
        { ...publicPost, author: owner },
        { ...privatePost, author: owner },
        { ...friendsOnlyPost, author: owner }
      ];

      const filtered = await filterReadablePosts(auth, postList);
      expect(filtered.length).toBe(3);
    });

    it('should include friends-only posts for friends', async () => {
      const auth = createAuth(friend);
      const postList = [
        { ...publicPost, author: owner },
        { ...privatePost, author: owner },
        { ...friendsOnlyPost, author: owner }
      ];

      const filtered = await filterReadablePosts(auth, postList);
      expect(filtered.length).toBe(2);
      expect(filtered.map(p => p.id)).toContain(publicPost.id);
      expect(filtered.map(p => p.id)).toContain(friendsOnlyPost.id);
    });
  });
});

