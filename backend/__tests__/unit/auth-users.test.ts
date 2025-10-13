import { prisma } from '@/db';
import {
  canViewUser,
  canUpdateUser,
  canSetLineManager,
  canViewOrgHierarchy,
  canViewLineManager,
  canViewDirectReports
} from '@/auth/users';
import { Authentication } from '@/types/permissions';

describe('User Permissions', () => {
  let user1: any, user2: any, friend: any, admin: any, hr: any, manager: any, employee: any;

  beforeAll(async () => {
    // Create users with unique emails for this test suite
    user1 = await prisma.user.create({
      data: { email: 'users-user1@test.com', name: 'Users User 1', password: 'hash', isPrivate: false }
    });
    user2 = await prisma.user.create({
      data: { email: 'users-user2@test.com', name: 'Users User 2', password: 'hash', isPrivate: true }
    });
    friend = await prisma.user.create({
      data: { email: 'users-friend@test.com', name: 'Users Friend', password: 'hash', isPrivate: true }
    });
    admin = await prisma.user.create({
      data: { email: 'users-admin@test.com', name: 'Users Admin', password: 'hash' }
    });
    hr = await prisma.user.create({
      data: { email: 'users-hr@test.com', name: 'Users HR Admin', password: 'hash' }
    });
    manager = await prisma.user.create({
      data: { email: 'users-manager@test.com', name: 'Users Manager', password: 'hash' }
    });
    employee = await prisma.user.create({
      data: { email: 'users-employee@test.com', name: 'Users Employee', password: 'hash', isPrivate: true, lineManagerId: manager.id }
    });

    // Create friend relationship
    await prisma.friendRequest.create({
      data: { senderId: user2.id, receiverId: friend.id, status: 'ACCEPTED' }
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

    const hrFacet = await prisma.facet.upsert({
      where: { scope_name_value: { scope: 'user-role', name: 'hr-admin', value: '' } },
      update: {},
      create: { scope: 'user-role', name: 'hr-admin', value: '', description: 'HR Admin' }
    });
    await prisma.facetAssignment.create({
      data: {
        facetId: hrFacet.id,
        entityType: 'USER',
        entityId: hr.id,
        assignedById: null,
        isActive: true
      }
    });
  });

  afterAll(async () => {
    // Only delete test data created by this test suite
    const testUserIds = [user1.id, user2.id, friend.id, admin.id, hr.id, manager.id, employee.id];
    
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

  describe('canViewUser', () => {
    it('should allow anyone to view public profiles', async () => {
      const auth = createAuth(user2);
      const result = await canViewUser(auth, user1);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('PUBLIC_PROFILE');
    });

    it('should allow anonymous users to view public profiles', async () => {
      const auth = createAuth(null);
      const result = await canViewUser(auth, user1);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('PUBLIC_PROFILE');
    });

    it('should deny anonymous users from viewing private profiles', async () => {
      const auth = createAuth(null);
      const result = await canViewUser(auth, user2);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });

    it('should allow users to view their own profile', async () => {
      const auth = createAuth(user2);
      const result = await canViewUser(auth, user2);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('SELF');
    });

    it('should allow friends to view private profiles', async () => {
      const auth = createAuth(friend);
      const result = await canViewUser(auth, user2);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('FRIEND');
    });

    it('should allow line managers to view employee profiles', async () => {
      const auth = createAuth(manager);
      const result = await canViewUser(auth, employee);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('LINE_MANAGER');
    });

    it('should allow admin to view any profile', async () => {
      const auth = createAuth(admin);
      const result = await canViewUser(auth, user2);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should allow HR to view any profile', async () => {
      const auth = createAuth(hr);
      const result = await canViewUser(auth, user2);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('HR_ADMIN');
    });

    it('should deny strangers from viewing private profiles', async () => {
      const auth = createAuth(user1);
      const result = await canViewUser(auth, user2);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });
  });

  describe('canUpdateUser', () => {
    it('should allow users to update their own profile', async () => {
      const auth = createAuth(user1);
      const result = await canUpdateUser(auth, user1);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('SELF');
    });

    it('should deny users from updating other profiles', async () => {
      const auth = createAuth(user1);
      const result = await canUpdateUser(auth, user2);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });

    it('should allow admin to update any profile', async () => {
      const auth = createAuth(admin);
      const result = await canUpdateUser(auth, user1);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should allow HR to update profiles', async () => {
      const auth = createAuth(hr);
      const result = await canUpdateUser(auth, user1);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('HR_ADMIN');
    });

    it('should deny anonymous users', async () => {
      const auth = createAuth(null);
      const result = await canUpdateUser(auth, user1);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canSetLineManager', () => {
    it('should allow admin to set line managers', async () => {
      const auth = createAuth(admin);
      const result = await canSetLineManager(auth, user1.id, manager.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should allow HR to set line managers', async () => {
      const auth = createAuth(hr);
      const result = await canSetLineManager(auth, user1.id, manager.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('HR_ADMIN');
    });

    it('should deny regular users from setting line managers', async () => {
      const auth = createAuth(user1);
      const result = await canSetLineManager(auth, user2.id, manager.id);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });

    it('should deny anonymous users', async () => {
      const auth = createAuth(null);
      const result = await canSetLineManager(auth, user1.id, manager.id);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canViewOrgHierarchy', () => {
    it('should allow authenticated users to view hierarchy', async () => {
      const auth = createAuth(user1);
      const result = await canViewOrgHierarchy(auth);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('AUTHENTICATED');
    });

    it('should allow admin to view hierarchy', async () => {
      const auth = createAuth(admin);
      const result = await canViewOrgHierarchy(auth);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should allow HR to view hierarchy', async () => {
      const auth = createAuth(hr);
      const result = await canViewOrgHierarchy(auth);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('HR_ADMIN');
    });

    it('should deny anonymous users', async () => {
      const auth = createAuth(null);
      const result = await canViewOrgHierarchy(auth);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canViewLineManager', () => {
    it('should allow users to view their own line manager', async () => {
      const auth = createAuth(employee);
      const result = await canViewLineManager(auth, employee.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('SELF');
    });

    it('should allow admin to view line managers', async () => {
      const auth = createAuth(admin);
      const result = await canViewLineManager(auth, employee.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should allow HR to view line managers', async () => {
      const auth = createAuth(hr);
      const result = await canViewLineManager(auth, employee.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('HR_ADMIN');
    });

    it('should allow line managers to view their reports\' managers', async () => {
      const auth = createAuth(manager);
      const result = await canViewLineManager(auth, employee.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('LINE_MANAGER');
    });

    it('should deny strangers from viewing line managers', async () => {
      const auth = createAuth(user1);
      const result = await canViewLineManager(auth, employee.id);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });
  });

  describe('canViewDirectReports', () => {
    it('should allow users to view their own reports', async () => {
      const auth = createAuth(manager);
      const result = await canViewDirectReports(auth, manager.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('SELF');
    });

    it('should allow admin to view direct reports', async () => {
      const auth = createAuth(admin);
      const result = await canViewDirectReports(auth, manager.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should allow HR to view direct reports', async () => {
      const auth = createAuth(hr);
      const result = await canViewDirectReports(auth, manager.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('HR_ADMIN');
    });

    it('should deny strangers from viewing direct reports', async () => {
      const auth = createAuth(user1);
      const result = await canViewDirectReports(auth, manager.id);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });
  });
});

