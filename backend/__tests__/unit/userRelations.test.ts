import { prisma } from '@/db';
import {
  isFriendsWith,
  isFollowing,
  isAdministratorFor,
  getDirectReports,
  getAllReports,
  checkForCircularReference,
  shareDivision
} from '@/lib/userRelations';
import { assignFacet } from '@/lib/facets';

describe('User Relations Library', () => {
  let user1: any, user2: any, user3: any, user4: any;

  beforeAll(async () => {
    // Create test users
    user1 = await prisma.user.create({
      data: { email: 'manager@test.com', name: 'Manager', password: 'hash' }
    });
    user2 = await prisma.user.create({
      data: { email: 'employee1@test.com', name: 'Employee 1', password: 'hash', lineManagerId: user1.id }
    });
    user3 = await prisma.user.create({
      data: { email: 'employee2@test.com', name: 'Employee 2', password: 'hash', lineManagerId: user2.id }
    });
    user4 = await prisma.user.create({
      data: { email: 'other@test.com', name: 'Other User', password: 'hash' }
    });
  });

  afterAll(async () => {
    // Only delete test data created by this test suite
    const testUserIds = [user1.id, user2.id, user3.id, user4.id];
    
    await prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: { in: testUserIds } },
          { receiverId: { in: testUserIds } }
        ]
      }
    });
    await prisma.follows.deleteMany({
      where: {
        OR: [
          { followerId: { in: testUserIds } },
          { followingId: { in: testUserIds } }
        ]
      }
    });
    await prisma.facetAssignment.deleteMany({
      where: { entityId: { in: testUserIds } }
    });
    await prisma.user.deleteMany({
      where: { id: { in: testUserIds } }
    });
    await prisma.$disconnect();
  });

  describe('isFriendsWith', () => {
    it('should return true if users are friends', async () => {
      await prisma.friendRequest.create({
        data: {
          senderId: user1.id,
          receiverId: user2.id,
          status: 'ACCEPTED'
        }
      });

      const areFriends = await isFriendsWith(user1.id, user2.id);
      expect(areFriends).toBe(true);

      // Should work in reverse
      const areFriendsReverse = await isFriendsWith(user2.id, user1.id);
      expect(areFriendsReverse).toBe(true);
    });

    it('should return false if friend request is pending', async () => {
      await prisma.friendRequest.create({
        data: {
          senderId: user3.id,
          receiverId: user4.id,
          status: 'PENDING'
        }
      });

      const areFriends = await isFriendsWith(user3.id, user4.id);
      expect(areFriends).toBe(false);
    });

    it('should return false if no friend relationship exists', async () => {
      const areFriends = await isFriendsWith(user1.id, user4.id);
      expect(areFriends).toBe(false);
    });
  });

  describe('isFollowing', () => {
    it('should return true if user1 follows user2', async () => {
      await prisma.follows.create({
        data: {
          followerId: user1.id,
          followingId: user2.id
        }
      });

      const follows = await isFollowing(user1.id, user2.id);
      expect(follows).toBe(true);
    });

    it('should return false if user1 does not follow user2', async () => {
      const follows = await isFollowing(user2.id, user1.id);
      expect(follows).toBe(false);
    });
  });

  describe('isAdministratorFor', () => {
    it('should return true for direct line manager', async () => {
      const isManager = await isAdministratorFor(user1.id, user2.id);
      expect(isManager).toBe(true);
    });

    it('should return true for indirect line manager', async () => {
      // user1 -> user2 -> user3
      const isManager = await isAdministratorFor(user1.id, user3.id);
      expect(isManager).toBe(true);
    });

    it('should return false if not in management chain', async () => {
      const isManager = await isAdministratorFor(user4.id, user2.id);
      expect(isManager).toBe(false);
    });

    it('should return false for self', async () => {
      const isManager = await isAdministratorFor(user1.id, user1.id);
      expect(isManager).toBe(false);
    });

    it('should return false when checking only direct relationship', async () => {
      const isDirectManager = await isAdministratorFor(user1.id, user3.id, false);
      expect(isDirectManager).toBe(false);
    });
  });

  describe('getDirectReports', () => {
    it('should return direct reports for a manager', async () => {
      const reports = await getDirectReports(user1.id);
      expect(reports).toContain(user2.id);
      expect(reports).not.toContain(user3.id); // Indirect report
      expect(reports.length).toBe(1);
    });

    it('should return empty array if no direct reports', async () => {
      const reports = await getDirectReports(user4.id);
      expect(reports).toEqual([]);
    });
  });

  describe('getAllReports', () => {
    it('should return all direct and indirect reports', async () => {
      const reports = await getAllReports(user1.id);
      expect(reports).toContain(user2.id);
      expect(reports).toContain(user3.id);
      expect(reports.length).toBe(2);
    });

    it('should return only direct reports if no indirect ones', async () => {
      const reports = await getAllReports(user2.id);
      expect(reports).toContain(user3.id);
      expect(reports).not.toContain(user1.id);
      expect(reports.length).toBe(1);
    });
  });

  describe('checkForCircularReference', () => {
    it('should detect self-reference', async () => {
      const wouldCreateCycle = await checkForCircularReference(user1.id, user1.id);
      expect(wouldCreateCycle).toBe(true);
    });

    it('should detect circular reference in hierarchy', async () => {
      // user1 -> user2 -> user3
      // Trying to set user1's manager to user3 would create a cycle
      const wouldCreateCycle = await checkForCircularReference(user1.id, user3.id);
      expect(wouldCreateCycle).toBe(true);
    });

    it('should allow valid manager assignment', async () => {
      const wouldCreateCycle = await checkForCircularReference(user4.id, user1.id);
      expect(wouldCreateCycle).toBe(false);
    });
  });

  describe('shareDivision', () => {
    it('should return true if users share same division', async () => {
      // Need to create a facet for this test
      const facet = await prisma.facet.upsert({
        where: { scope_name_value: { scope: 'org-division', name: 'division', value: 'engineering' } },
        update: {},
        create: { scope: 'org-division', name: 'division', value: 'engineering', description: 'Engineering Division' }
      });

      await prisma.facetAssignment.create({
        data: {
          facetId: facet.id,
          entityType: 'USER',
          entityId: user1.id,
          assignedById: null,
          isActive: true
        }
      });

      await prisma.facetAssignment.create({
        data: {
          facetId: facet.id,
          entityType: 'USER',
          entityId: user2.id,
          assignedById: null,
          isActive: true
        }
      });

      const share = await shareDivision(user1.id, user2.id);
      expect(share).toBe(true);

      // Cleanup
      await prisma.facetAssignment.deleteMany({ where: { facetId: facet.id } });
      await prisma.facet.delete({ where: { id: facet.id } });
    });

    it('should return false if users do not share division', async () => {
      const share = await shareDivision(user1.id, user4.id);
      expect(share).toBe(false);
    });
  });
});

