import { prisma } from '@/db';
import {
  canViewCommentsOnPost,
  canViewCommentsOnMedia,
  canCommentOnPost,
  canCommentOnMedia,
  canUpdateComment,
  canDeleteComment
} from '@/auth/comments';
import { Authentication } from '@/types/permissions';

describe('Comment Permissions', () => {
  let owner: any, friend: any, stranger: any, admin: any, moderator: any, manager: any, employee: any;
  let publicPost: any, privatePost: any, friendsOnlyPost: any;
  let publicMedia: any, privateMedia: any, friendsOnlyMedia: any;
  let ownComment: any, othersComment: any;

  beforeAll(async () => {
    // Create users with unique emails for this test suite
    owner = await prisma.users.create({
      data: { email: 'comments-owner@test.com', name: 'Comments Owner', password: 'hash' }
    });
    friend = await prisma.users.create({
      data: { email: 'comments-friend@test.com', name: 'Comments Friend', password: 'hash' }
    });
    stranger = await prisma.users.create({
      data: { email: 'comments-stranger@test.com', name: 'Comments Stranger', password: 'hash' }
    });
    admin = await prisma.users.create({
      data: { email: 'comments-admin@test.com', name: 'Comments Admin', password: 'hash' }
    });
    moderator = await prisma.users.create({
      data: { email: 'comments-moderator@test.com', name: 'Comments Moderator', password: 'hash' }
    });
    manager = await prisma.users.create({
      data: { email: 'comments-manager@test.com', name: 'Comments Manager', password: 'hash' }
    });
    employee = await prisma.users.create({
      data: { 
        email: 'comments-employee@test.com', 
        name: 'Comments Employee', 
        password: 'hash',
        lineManagerId: manager.id
      }
    });

    // Create friend relationship
    await prisma.friend_requests.create({
      data: { senderId: owner.id, receiverId: friend.id, status: 'ACCEPTED' }
    });

    // Create posts
    publicPost = await prisma.posts.create({
      data: {$
        content: 'Public post',
        authorId: employee.id,
        visibility: 'PUBLIC',
        publicationStatus: 'PUBLIC'
      }
    });

    privatePost = await prisma.posts.create({
      data: {$
        content: 'Private post',
        authorId: employee.id,
        visibility: 'PRIVATE',
        publicationStatus: 'PUBLIC'
      }
    });

    friendsOnlyPost = await prisma.posts.create({
      data: {$
        content: 'Friends only post',
        authorId: owner.id,
        visibility: 'FRIENDS_ONLY',
        publicationStatus: 'PUBLIC'
      }
    });

    // Create media
    publicMedia = await prisma.media.create({$
      data: {$
        url: 'https://example.com/public.jpg',
        originalFilename: 'public.jpg',
        s3Key: 'public-key',
        mediaType: 'IMAGE',
        authorId: employee.id,
        visibility: 'PUBLIC'
      } as any
    });

    privateMedia = await prisma.media.create({
      data: {$
        url: 'https://example.com/private.jpg',
        originalFilename: 'private.jpg',
        s3Key: 'private-key',
        mediaType: 'IMAGE',
        authorId: employee.id,
        visibility: 'PRIVATE'
      } as any
    });

    friendsOnlyMedia = await prisma.media.create({
      data: {$
        url: 'https://example.com/friends.jpg',
        originalFilename: 'friends.jpg',
        s3Key: 'friends-key',
        mediaType: 'IMAGE',
        authorId: owner.id,
        visibility: 'FRIENDS_ONLY'
      } as any
    });

    // Create comments
    ownComment = await prisma.comments.create({
      data: {$
        content: 'My comment',
        postId: publicPost.id,
        authorId: owner.id
      }
    });

    othersComment = await prisma.comments.create({
      data: {$
        content: 'Someone elses comment',
        postId: publicPost.id,
        authorId: stranger.id
      }
    });

    // Assign facets
    const globalAdminFacet = await prisma.facets.create({
      data: { scope: 'reedi-admin', name: 'global', value: '' }
    });
    const moderatorFacet = await prisma.facets.create({
      data: { scope: 'user-role', name: 'moderator', value: '' }
    });

    await prisma.facet_assignments.create({
      data: { facetId: globalAdminFacet.id, entityType: 'user', entityId: admin.id }
    });
    await prisma.facet_assignments.create({
      data: { facetId: moderatorFacet.id, entityType: 'user', entityId: moderator.id }
    });
  });

  afterAll(async () => {
    // Clean up only data created in this test suite
    const userIds = [owner.id, friend.id, stranger.id, admin.id, moderator.id, manager.id, employee.id];
    
    await prisma.comments.deleteMany({ where: { authorId: { in: userIds } } });
    await prisma.posts.deleteMany({ where: { authorId: { in: userIds } } });
    await prisma.media.deleteMany({ where: { authorId: { in: userIds } } });
    await prisma.friend_requests.deleteMany({
      where: {
        OR: [
          { senderId: { in: userIds } },
          { receiverId: { in: userIds } }
        ]
      }
    });
    await prisma.facet_assignments.deleteMany({ where: { entityId: { in: userIds } } });
    await prisma.users.deleteMany({ where: { id: { in: userIds } } });
  });

  describe('canViewCommentsOnPost', () => {
    it('should allow viewing comments on public post', async () => {
      const auth: Authentication = { userId: stranger.id, user: null };
      const result = await canViewCommentsOnPost(auth, { ...publicPost, author: { id: employee.id } });
      expect(result.granted).toBe(true);
    });

    it('should deny viewing comments on private post to non-owner', async () => {
      const auth: Authentication = { userId: stranger.id, user: null };
      const result = await canViewCommentsOnPost(auth, { ...privatePost, author: { id: employee.id } });
      expect(result.granted).toBe(false);
    });

    it('should allow viewing comments on friends-only post to friend', async () => {
      const auth: Authentication = { userId: friend.id, user: null };
      const result = await canViewCommentsOnPost(auth, { ...friendsOnlyPost, author: { id: owner.id } });
      expect(result.granted).toBe(true);
    });
  });

  describe('canCommentOnPost', () => {
    it('should allow commenting on own post', async () => {
      const auth: Authentication = { userId: employee.id, user: null };
      const result = await canCommentOnPost(auth, { ...publicPost, author: { id: employee.id } });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('SELF');
    });

    it('should allow commenting on public post', async () => {
      const auth: Authentication = { userId: stranger.id, user: null };
      const result = await canCommentOnPost(auth, { ...publicPost, author: { id: employee.id } });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('PUBLIC_CONTENT');
    });

    it('should allow friend to comment on friends-only post', async () => {
      const auth: Authentication = { userId: friend.id, user: null };
      const result = await canCommentOnPost(auth, { ...friendsOnlyPost, author: { id: owner.id } });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('FRIEND');
    });

    it('should deny stranger from commenting on friends-only post', async () => {
      const auth: Authentication = { userId: stranger.id, user: null };
      const result = await canCommentOnPost(auth, { ...friendsOnlyPost, author: { id: owner.id } });
      expect(result.granted).toBe(false);
    });

    it('should allow line manager to comment on employee post', async () => {
      const auth: Authentication = { userId: manager.id, user: null };
      const result = await canCommentOnPost(auth, { ...publicPost, author: { id: employee.id } });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('LINE_MANAGER');
    });

    it('should deny unauthenticated user', async () => {
      const auth: Authentication = { userId: null, user: null };
      const result = await canCommentOnPost(auth, { ...publicPost, author: { id: employee.id } });
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canCommentOnMedia', () => {
    it('should allow commenting on public media', async () => {
      const auth: Authentication = { userId: stranger.id, user: null };
      const result = await canCommentOnMedia(auth, { ...publicMedia, author: { id: employee.id } });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('PUBLIC_CONTENT');
    });

    it('should allow friend to comment on friends-only media', async () => {
      const auth: Authentication = { userId: friend.id, user: null };
      const result = await canCommentOnMedia(auth, { ...friendsOnlyMedia, author: { id: owner.id } });
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('FRIEND');
    });

    it('should deny stranger from commenting on private media', async () => {
      const auth: Authentication = { userId: stranger.id, user: null };
      const result = await canCommentOnMedia(auth, { ...privateMedia, author: { id: employee.id } });
      expect(result.granted).toBe(false);
    });
  });

  describe('canUpdateComment', () => {
    it('should allow updating own comment', async () => {
      const auth: Authentication = { userId: owner.id, user: null };
      const result = await canUpdateComment(auth, ownComment);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('SELF');
    });

    it('should deny updating others comment', async () => {
      const auth: Authentication = { userId: owner.id, user: null };
      const result = await canUpdateComment(auth, othersComment);
      expect(result.granted).toBe(false);
    });

    it('should allow admin to update any comment', async () => {
      const auth: Authentication = { userId: admin.id, user: null };
      const result = await canUpdateComment(auth, othersComment);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should allow moderator to update any comment', async () => {
      const auth: Authentication = { userId: moderator.id, user: null };
      const result = await canUpdateComment(auth, othersComment);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('MODERATOR');
    });
  });

  describe('canDeleteComment', () => {
    it('should allow deleting own comment', async () => {
      const auth: Authentication = { userId: owner.id, user: null };
      const result = await canDeleteComment(auth, ownComment);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('SELF');
    });

    it('should allow post author to delete comments on their post', async () => {
      const auth: Authentication = { userId: employee.id, user: null };
      const result = await canDeleteComment(auth, othersComment, employee.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('CONTENT_OWNER');
    });

    it('should deny non-owner from deleting others comment', async () => {
      const auth: Authentication = { userId: stranger.id, user: null };
      const result = await canDeleteComment(auth, othersComment);
      expect(result.granted).toBe(false);
    });

    it('should allow admin to delete any comment', async () => {
      const auth: Authentication = { userId: admin.id, user: null };
      const result = await canDeleteComment(auth, othersComment);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should allow moderator to delete any comment', async () => {
      const auth: Authentication = { userId: moderator.id, user: null };
      const result = await canDeleteComment(auth, othersComment);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('MODERATOR');
    });

    it('should allow line manager to delete comments on reports content', async () => {
      const auth: Authentication = { userId: manager.id, user: null };
      const result = await canDeleteComment(auth, othersComment, employee.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('LINE_MANAGER');
    });
  });
});

