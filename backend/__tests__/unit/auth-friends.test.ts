import { prisma } from '@/db';
import {
  canSendFriendRequest,
  canViewReceivedRequests,
  canViewSentRequests,
  canAcceptFriendRequest,
  canRejectFriendRequest,
  canCancelFriendRequest,
  canViewFriendshipStatus,
  canViewFriendsList
} from '@/auth/friends';
import { Authentication } from '@/types/permissions';

describe('Friend Permissions', () => {
  let user1: any, user2: any, user3: any, admin: any;
  let user1PrivateProfile: any;
  let pendingRequest: any, acceptedRequest: any;

  beforeAll(async () => {
    // Create users with unique emails for this test suite
    user1 = await prisma.users.create({
      data: { 
        email: 'friends-user1@test.com', 
        name: 'Friends User1', 
        password: 'hash',
        isPrivate: false
      }
    });
    user2 = await prisma.users.create({
      data: { 
        email: 'friends-user2@test.com', 
        name: 'Friends User2', 
        password: 'hash',
        isPrivate: false
      }
    });
    user3 = await prisma.users.create({
      data: { 
        email: 'friends-user3@test.com', 
        name: 'Friends User3', 
        password: 'hash',
        isPrivate: false
      }
    });
    user1PrivateProfile = await prisma.users.create({
      data: { 
        email: 'friends-private@test.com', 
        name: 'Friends Private', 
        password: 'hash',
        isPrivate: true
      }
    });
    admin = await prisma.users.create({
      data: { 
        email: 'friends-admin@test.com', 
        name: 'Friends Admin', 
        password: 'hash'
      }
    });

    // Create friend requests
    pendingRequest = await prisma.friend_requests.create({
      data: { 
        senderId: user1.id, 
        receiverId: user2.id, 
        status: 'PENDING' 
      }
    });

    acceptedRequest = await prisma.friend_requests.create({
      data: { 
        senderId: user2.id, 
        receiverId: user3.id, 
        status: 'ACCEPTED' 
      }
    });

    // Assign admin facet
    const globalAdminFacet = await prisma.facets.create({
      data: { scope: 'reedi-admin', name: 'global', value: '' }
    });

    await prisma.facet_assignments.create({
      data: { facetId: globalAdminFacet.id, entityType: 'user', entityId: admin.id }
    });
  });

  afterAll(async () => {
    // Clean up only data created in this test suite
    const userIds = [user1.id, user2.id, user3.id, user1PrivateProfile.id, admin.id];
    
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

  describe('canSendFriendRequest', () => {
    it('should allow sending friend request to another user', async () => {
      const auth: Authentication = { userId: user1.id, user: null };
      const result = await canSendFriendRequest(auth, user3.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('STANDARD');
    });

    it('should deny sending friend request to yourself', async () => {
      const auth: Authentication = { userId: user1.id, user: null };
      const result = await canSendFriendRequest(auth, user1.id);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('SELF_REQUEST');
    });

    it('should deny unauthenticated user', async () => {
      const auth: Authentication = { userId: null, user: null };
      const result = await canSendFriendRequest(auth, user2.id);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });

    it('should allow admin to send friend request', async () => {
      const auth: Authentication = { userId: admin.id, user: null };
      const result = await canSendFriendRequest(auth, user1.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });
  });

  describe('canViewReceivedRequests', () => {
    it('should allow viewing own received requests', async () => {
      const auth: Authentication = { userId: user2.id, user: null };
      const result = await canViewReceivedRequests(auth);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('SELF');
    });

    it('should deny unauthenticated user', async () => {
      const auth: Authentication = { userId: null, user: null };
      const result = await canViewReceivedRequests(auth);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canViewSentRequests', () => {
    it('should allow viewing own sent requests', async () => {
      const auth: Authentication = { userId: user1.id, user: null };
      const result = await canViewSentRequests(auth);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('SELF');
    });

    it('should deny unauthenticated user', async () => {
      const auth: Authentication = { userId: null, user: null };
      const result = await canViewSentRequests(auth);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canAcceptFriendRequest', () => {
    it('should allow receiver to accept request', async () => {
      const auth: Authentication = { userId: user2.id, user: null };
      const result = await canAcceptFriendRequest(auth, pendingRequest);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('RECEIVER');
    });

    it('should deny sender from accepting own request', async () => {
      const auth: Authentication = { userId: user1.id, user: null };
      const result = await canAcceptFriendRequest(auth, pendingRequest);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_RECEIVER');
    });

    it('should deny unrelated user from accepting', async () => {
      const auth: Authentication = { userId: user3.id, user: null };
      const result = await canAcceptFriendRequest(auth, pendingRequest);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_RECEIVER');
    });

    it('should allow admin to accept any request', async () => {
      const auth: Authentication = { userId: admin.id, user: null };
      const result = await canAcceptFriendRequest(auth, pendingRequest);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should deny unauthenticated user', async () => {
      const auth: Authentication = { userId: null, user: null };
      const result = await canAcceptFriendRequest(auth, pendingRequest);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canRejectFriendRequest', () => {
    it('should allow receiver to reject request', async () => {
      const auth: Authentication = { userId: user2.id, user: null };
      const result = await canRejectFriendRequest(auth, pendingRequest);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('RECEIVER');
    });

    it('should deny sender from rejecting', async () => {
      const auth: Authentication = { userId: user1.id, user: null };
      const result = await canRejectFriendRequest(auth, pendingRequest);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_RECEIVER');
    });

    it('should allow admin to reject any request', async () => {
      const auth: Authentication = { userId: admin.id, user: null };
      const result = await canRejectFriendRequest(auth, pendingRequest);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });
  });

  describe('canCancelFriendRequest', () => {
    it('should allow sender to cancel request', async () => {
      const auth: Authentication = { userId: user1.id, user: null };
      const result = await canCancelFriendRequest(auth, pendingRequest);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('SENDER');
    });

    it('should deny receiver from canceling', async () => {
      const auth: Authentication = { userId: user2.id, user: null };
      const result = await canCancelFriendRequest(auth, pendingRequest);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_SENDER');
    });

    it('should deny unrelated user from canceling', async () => {
      const auth: Authentication = { userId: user3.id, user: null };
      const result = await canCancelFriendRequest(auth, pendingRequest);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_SENDER');
    });

    it('should allow admin to cancel any request', async () => {
      const auth: Authentication = { userId: admin.id, user: null };
      const result = await canCancelFriendRequest(auth, pendingRequest);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should deny unauthenticated user', async () => {
      const auth: Authentication = { userId: null, user: null };
      const result = await canCancelFriendRequest(auth, pendingRequest);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canViewFriendshipStatus', () => {
    it('should allow viewing friendship status with another user', async () => {
      const auth: Authentication = { userId: user1.id, user: null };
      const result = await canViewFriendshipStatus(auth, user2.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('PUBLIC');
    });

    it('should allow viewing own status', async () => {
      const auth: Authentication = { userId: user1.id, user: null };
      const result = await canViewFriendshipStatus(auth, user1.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('SELF');
    });

    it('should allow admin to view any status', async () => {
      const auth: Authentication = { userId: admin.id, user: null };
      const result = await canViewFriendshipStatus(auth, user1.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should deny unauthenticated user', async () => {
      const auth: Authentication = { userId: null, user: null };
      const result = await canViewFriendshipStatus(auth, user1.id);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canViewFriendsList', () => {
    it('should allow viewing public profile friends list', async () => {
      const auth: Authentication = { userId: user1.id, user: null };
      const result = await canViewFriendsList(auth, user2.id, false);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('PUBLIC_PROFILE');
    });

    it('should allow viewing own friends list', async () => {
      const auth: Authentication = { userId: user1PrivateProfile.id, user: null };
      const result = await canViewFriendsList(auth, user1PrivateProfile.id, true);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('SELF');
    });

    it('should deny viewing private profile friends list for strangers', async () => {
      const auth: Authentication = { userId: user1.id, user: null };
      const result = await canViewFriendsList(auth, user1PrivateProfile.id, true);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('PRIVATE_PROFILE');
    });

    it('should allow admin to view any friends list', async () => {
      const auth: Authentication = { userId: admin.id, user: null };
      const result = await canViewFriendsList(auth, user1PrivateProfile.id, true);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should allow unauthenticated users to view public profile friends', async () => {
      const auth: Authentication = { userId: null, user: null };
      const result = await canViewFriendsList(auth, user1.id, false);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('PUBLIC_PROFILE');
    });

    it('should deny unauthenticated users from viewing private profile friends', async () => {
      const auth: Authentication = { userId: null, user: null };
      const result = await canViewFriendsList(auth, user1PrivateProfile.id, true);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canRemoveFriend', () => {
    it('should allow removing own friendship', async () => {
      const auth: Authentication = { userId: user2.id, user: null };
      const result = await canRemoveFriend(auth, user3.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('SELF');
    });

    it('should deny unauthenticated user', async () => {
      const auth: Authentication = { userId: null, user: null };
      const result = await canRemoveFriend(auth, user1.id);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });
});

