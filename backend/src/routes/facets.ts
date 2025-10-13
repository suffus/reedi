import express from 'express';
import { prisma } from '../db';
import { getAuthContext } from '../middleware/authContext';
import { assignFacet, revokeFacet, userGetFacets } from '../lib/facets';
import { 
  canAssignFacet, 
  canRevokeFacet, 
  canViewFacetHistory,
  canViewFacetDefinitions,
  canViewUserFacets
} from '../auth/facets';
import { auditPermission, safePermissionCheck } from '../lib/permissions';
import { FacetAction } from '@prisma/client';

const router = express.Router();

/**
 * GET /api/facets/definitions
 * List all available facet definitions
 */
router.get('/definitions', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    
    const canView = await safePermissionCheck(
      () => canViewFacetDefinitions(auth),
      'facet-definitions-view'
    );
    
    if (!canView.granted) {
      await auditPermission(canView, auth, 'FACET', { shouldAudit: true, auditSensitive: false, asyncAudit: true });
      return res.status(403).json({ error: canView.reason });
    }
    
    const facets = await prisma.facet.findMany({
      where: { isActive: true },
      orderBy: [
        { scope: 'asc' },
        { name: 'asc' },
        { value: 'asc' }
      ],
      select: {
        id: true,
        scope: true,
        name: true,
        value: true,
        description: true,
        hierarchyLevel: true,
        requiresAudit: true,
        expiryDays: true,
        requiresReview: true,
        reviewDays: true
      }
    });
    
    res.json({ facets });
  } catch (error) {
    console.error('Error fetching facets:', error);
    res.status(500).json({ error: 'Failed to fetch facets' });
  }
});

/**
 * GET /api/facets/user/:userId
 * Get all facets assigned to a user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { userId } = req.params;
    
    const canView = await safePermissionCheck(
      () => canViewUserFacets(auth, userId),
      'user-facets-view'
    );
    
    if (!canView.granted) {
      await auditPermission(canView, auth, 'USER', { shouldAudit: true, auditSensitive: true, asyncAudit: true });
      return res.status(403).json({ error: canView.reason });
    }
    
    const facets = await userGetFacets(userId);
    
    res.json({ facets });
  } catch (error) {
    console.error('Error fetching user facets:', error);
    res.status(500).json({ error: 'Failed to fetch user facets' });
  }
});

/**
 * POST /api/facets/assign
 * Assign a facet to a user
 */
router.post('/assign', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { userId, facet, reason, expiryDays, metadata } = req.body;
    
    if (!userId || !facet || !reason) {
      return res.status(400).json({ error: 'Missing required fields: userId, facet, reason' });
    }
    
    const canAssign = await safePermissionCheck(
      () => canAssignFacet(auth, userId, facet),
      'facet-assign'
    );
    
    await auditPermission(canAssign, auth, 'USER', { shouldAudit: true, auditSensitive: true, asyncAudit: true });
    
    if (!canAssign.granted) {
      return res.status(403).json({ error: canAssign.reason });
    }
    
    const assignment = await assignFacet(
      facet, // facetIdentifier
      'USER', // entityType
      userId, // entityId
      auth, // assignedBy (Authentication)
      reason,
      expiryDays,
      metadata
    );
    
    res.json({ assignment, message: 'Facet assigned successfully' });
  } catch (error) {
    console.error('Error assigning facet:', error);
    
    if (error instanceof Error && error.message.includes('Facet not defined')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to assign facet' });
  }
});

/**
 * POST /api/facets/revoke
 * Revoke a facet from a user
 */
router.post('/revoke', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { userId, facet, reason } = req.body;
    
    if (!userId || !facet || !reason) {
      return res.status(400).json({ error: 'Missing required fields: userId, facet, reason' });
    }
    
    const canRevoke = await safePermissionCheck(
      () => canRevokeFacet(auth, userId, facet),
      'facet-revoke'
    );
    
    await auditPermission(canRevoke, auth, 'USER', { shouldAudit: true, auditSensitive: true, asyncAudit: true });
    
    if (!canRevoke.granted) {
      return res.status(403).json({ error: canRevoke.reason });
    }
    
    await revokeFacet(
      facet, // facetIdentifier
      'USER', // entityType
      userId, // entityId
      auth, // revokedBy (Authentication)
      reason
    );
    
    res.json({ message: 'Facet revoked successfully' });
  } catch (error) {
    console.error('Error revoking facet:', error);
    res.status(500).json({ error: 'Failed to revoke facet' });
  }
});

/**
 * GET /api/facets/history/:userId
 * Get facet assignment history for a user
 */
router.get('/history/:userId', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { userId } = req.params;
    
    const canView = await safePermissionCheck(
      () => canViewFacetHistory(auth, userId),
      'facet-history-view'
    );
    
    if (!canView.granted) {
      await auditPermission(canView, auth, 'USER', { shouldAudit: true, auditSensitive: true, asyncAudit: true });
      return res.status(403).json({ error: canView.reason });
    }
    
    const history = await prisma.facetAssignmentHistory.findMany({
      where: {
        entityType: 'USER',
        entityId: userId
      },
      include: {
        facet: {
          select: {
            scope: true,
            name: true,
            value: true,
            description: true
          }
        },
        performedBy: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      },
      orderBy: { performedAt: 'desc' },
      take: 100 // Limit to last 100 actions
    });
    
    res.json({ history });
  } catch (error) {
    console.error('Error fetching facet history:', error);
    res.status(500).json({ error: 'Failed to fetch facet history' });
  }
});

export default router;

