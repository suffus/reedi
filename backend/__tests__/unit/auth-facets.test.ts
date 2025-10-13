import { prisma } from '@/db';
import {
  canAssignFacet,
  canRevokeFacet,
  canViewFacetHistory,
  canViewFacetDefinitions,
  canViewUserFacets
} from '@/auth/facets';
import { Authentication } from '@/types/permissions';

describe('Facet Permissions', () => {
  let user: any, admin: any, hr: any, divAdmin: any, manager: any;

  beforeAll(async () => {
    // Create users with unique emails for this test suite
    user = await prisma.user.create({
      data: { email: 'facets-user@test.com', name: 'Facets User', password: 'hash' }
    });
    admin = await prisma.user.create({
      data: { email: 'facets-admin@test.com', name: 'Facets Admin', password: 'hash' }
    });
    hr = await prisma.user.create({
      data: { email: 'facets-hr@test.com', name: 'Facets HR', password: 'hash' }
    });
    divAdmin = await prisma.user.create({
      data: { email: 'facets-divadmin@test.com', name: 'Facets Div Admin', password: 'hash' }
    });
    manager = await prisma.user.create({
      data: { email: 'facets-manager@test.com', name: 'Facets Manager', password: 'hash' }
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

    const divAdminFacet = await prisma.facet.upsert({
      where: { scope_name_value: { scope: 'reedi-admin', name: 'divisional', value: '' } },
      update: {},
      create: { scope: 'reedi-admin', name: 'divisional', value: '', description: 'Divisional Admin' }
    });
    await prisma.facetAssignment.create({
      data: {
        facetId: divAdminFacet.id,
        entityType: 'USER',
        entityId: divAdmin.id,
        assignedById: null,
        isActive: true
      }
    });

    const managerFacet = await prisma.facet.upsert({
      where: { scope_name_value: { scope: 'user-role', name: 'manager', value: '' } },
      update: {},
      create: { scope: 'user-role', name: 'manager', value: '', description: 'Manager' }
    });
    await prisma.facetAssignment.create({
      data: {
        facetId: managerFacet.id,
        entityType: 'USER',
        entityId: manager.id,
        assignedById: null,
        isActive: true
      }
    });
  });

  afterAll(async () => {
    // Only delete test data created by this test suite
    const testUserIds = [user.id, admin.id, hr.id, divAdmin.id, manager.id];
    
    await prisma.facetAssignment.deleteMany({
      where: { entityId: { in: testUserIds } }
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

  describe('canAssignFacet', () => {
    it('should allow admin to assign any facet', async () => {
      const auth = createAuth(admin);
      const result = await canAssignFacet(auth, user.id, 'user-role:premium');
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should allow HR to assign org facets', async () => {
      const auth = createAuth(hr);
      const result = await canAssignFacet(auth, user.id, 'org-division:engineering');
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('HR_ADMIN');
    });

    it('should allow divisional admin to assign divisional facets', async () => {
      const auth = createAuth(divAdmin);
      const result = await canAssignFacet(auth, user.id, 'org-division:engineering');
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('DIVISIONAL_ADMIN');
    });

    it('should allow managers to assign non-admin roles', async () => {
      const auth = createAuth(manager);
      const result = await canAssignFacet(auth, user.id, 'user-role:premium');
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('MANAGER');
    });

    it('should deny managers from assigning admin roles', async () => {
      const auth = createAuth(manager);
      const result = await canAssignFacet(auth, user.id, 'user-role:hr-admin');
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });

    it('should deny regular users from assigning facets', async () => {
      const auth = createAuth(user);
      const result = await canAssignFacet(auth, user.id, 'user-role:premium');
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });

    it('should deny anonymous users', async () => {
      const auth = createAuth(null);
      const result = await canAssignFacet(auth, user.id, 'user-role:premium');
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canRevokeFacet', () => {
    it('should allow admin to revoke any facet', async () => {
      const auth = createAuth(admin);
      const result = await canRevokeFacet(auth, user.id, 'user-role:premium');
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should allow HR to revoke org facets', async () => {
      const auth = createAuth(hr);
      const result = await canRevokeFacet(auth, user.id, 'org-division:engineering');
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('HR_ADMIN');
    });

    it('should deny regular users from revoking facets', async () => {
      const auth = createAuth(user);
      const result = await canRevokeFacet(auth, user.id, 'user-role:premium');
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });

    it('should deny anonymous users', async () => {
      const auth = createAuth(null);
      const result = await canRevokeFacet(auth, user.id, 'user-role:premium');
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canViewFacetHistory', () => {
    it('should allow users to view their own history', async () => {
      const auth = createAuth(user);
      const result = await canViewFacetHistory(auth, user.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('SELF');
    });

    it('should allow admin to view any history', async () => {
      const auth = createAuth(admin);
      const result = await canViewFacetHistory(auth, user.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should allow HR to view history', async () => {
      const auth = createAuth(hr);
      const result = await canViewFacetHistory(auth, user.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('HR_ADMIN');
    });

    it('should deny users from viewing others\' history', async () => {
      const auth = createAuth(manager);
      const result = await canViewFacetHistory(auth, user.id);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });

    it('should deny anonymous users', async () => {
      const auth = createAuth(null);
      const result = await canViewFacetHistory(auth, user.id);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canViewFacetDefinitions', () => {
    it('should allow authenticated users to view definitions', async () => {
      const auth = createAuth(user);
      const result = await canViewFacetDefinitions(auth);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('AUTHENTICATED');
    });

    it('should deny anonymous users', async () => {
      const auth = createAuth(null);
      const result = await canViewFacetDefinitions(auth);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('canViewUserFacets', () => {
    it('should allow users to view their own facets', async () => {
      const auth = createAuth(user);
      const result = await canViewUserFacets(auth, user.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('SELF');
    });

    it('should allow admin to view any user\'s facets', async () => {
      const auth = createAuth(admin);
      const result = await canViewUserFacets(auth, user.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    });

    it('should allow HR to view facets', async () => {
      const auth = createAuth(hr);
      const result = await canViewUserFacets(auth, user.id);
      expect(result.granted).toBe(true);
      expect(result.reasonCode).toBe('HR_ADMIN');
    });

    it('should deny users from viewing others\' facets', async () => {
      const auth = createAuth(manager);
      const result = await canViewUserFacets(auth, user.id);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('DEFAULT_DENY');
    });

    it('should deny anonymous users', async () => {
      const auth = createAuth(null);
      const result = await canViewUserFacets(auth, user.id);
      expect(result.granted).toBe(false);
      expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
    });
  });
});

