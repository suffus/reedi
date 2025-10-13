import { prisma } from '../db';
import { FacetIdentifier, FacetWithAssignment, Authentication } from '../types/permissions';
import { Facet, FacetAssignment, FacetAction } from '@prisma/client';

/**
 * Parse facet string into components
 * Format: "scope:name" or "scope:name:value"
 */
export function parseFacet(facetString: string): FacetIdentifier {
  const parts = facetString.split(':');
  if (parts.length < 2) {
    throw new Error(`Invalid facet format: ${facetString}. Expected "scope:name" or "scope:name:value"`);
  }
  
  return {
    scope: parts[0],
    name: parts[1],
    value: parts.length > 2 ? parts.slice(2).join(':') : undefined
  };
}

/**
 * Convert facet identifier to string
 */
export function facetToString(facet: FacetIdentifier): string {
  return facet.value 
    ? `${facet.scope}:${facet.name}:${facet.value}`
    : `${facet.scope}:${facet.name}`;
}

/**
 * Check if entity has a specific facet (active and not expired)
 */
export async function hasFacet(
  entityType: string,
  entityId: string,
  facetIdentifier: string | FacetIdentifier
): Promise<boolean> {
  const facet = typeof facetIdentifier === 'string' 
    ? parseFacet(facetIdentifier)
    : facetIdentifier;
  
  const now = new Date();
  
  const assignment = await prisma.facetAssignment.findFirst({
    where: {
      entityType,
      entityId,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } }
      ],
      facet: {
        scope: facet.scope,
        name: facet.name,
        value: facet.value || ''
      }
    },
    include: { facet: true }
  });
  
  return assignment !== null;
}

/**
 * Get all active facets for an entity
 */
export async function getFacets(
  entityType: string,
  entityId: string,
  scope?: string
): Promise<FacetWithAssignment[]> {
  const now = new Date();
  
  const assignments = await prisma.facetAssignment.findMany({
    where: {
      entityType,
      entityId,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } }
      ],
      ...(scope && {
        facet: { scope }
      })
    },
    include: { facet: true }
  });
  
  return assignments.map(assignment => ({
    facet: assignment.facet,
    assignment,
    isExpired: assignment.expiresAt ? assignment.expiresAt <= now : false,
    needsReview: assignment.reviewAt ? assignment.reviewAt <= now : false
  }));
}

/**
 * Get specific facet value for entity
 * Returns the value field if it exists, otherwise returns the facet name
 */
export async function getFacetValue(
  entityType: string,
  entityId: string,
  scope: string,
  name: string
): Promise<string | null> {
  const now = new Date();
  
  const assignment = await prisma.facetAssignment.findFirst({
    where: {
      entityType,
      entityId,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } }
      ],
      facet: {
        scope,
        name
      }
    },
    include: { facet: true }
  });
  
  if (!assignment) return null;
  return assignment.facet.value || assignment.facet.name;
}

/**
 * Check if entity has facet at or above required hierarchy level
 */
export async function hasFacetAtLevel(
  entityType: string,
  entityId: string,
  facetIdentifier: string | FacetIdentifier,
  minimumLevel: number
): Promise<boolean> {
  const facet = typeof facetIdentifier === 'string' 
    ? parseFacet(facetIdentifier)
    : facetIdentifier;
  
  const now = new Date();
  
  const assignment = await prisma.facetAssignment.findFirst({
    where: {
      entityType,
      entityId,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } }
      ],
      facet: {
        scope: facet.scope,
        name: facet.name,
        hierarchyLevel: { gte: minimumLevel }
      }
    },
    include: { facet: true }
  });
  
  return assignment !== null;
}

/**
 * Assign facet to entity with full audit trail
 */
export async function assignFacet(
  facetIdentifier: string | FacetIdentifier,
  entityType: string,
  entityId: string,
  assignedBy: Authentication,
  reason: string,
  expiryDays?: number,
  metadata?: Record<string, any>
): Promise<FacetAssignment> {
  const facet = typeof facetIdentifier === 'string' 
    ? parseFacet(facetIdentifier)
    : facetIdentifier;
  
  // Find facet definition
  const facetDef = await prisma.facet.findUnique({
    where: {
      scope_name_value: {
        scope: facet.scope,
        name: facet.name,
        value: facet.value || ''
      }
    }
  });
  
  if (!facetDef) {
    throw new Error(`Facet not defined: ${facetToString(facet)}`);
  }
  
  // Calculate expiry date
  const expiresAt = expiryDays || facetDef.expiryDays
    ? new Date(Date.now() + (expiryDays || facetDef.expiryDays!) * 24 * 60 * 60 * 1000)
    : null;
  
  const reviewAt = facetDef.reviewDays
    ? new Date(Date.now() + facetDef.reviewDays * 24 * 60 * 60 * 1000)
    : null;
  
  // Create or update assignment
  const assignment = await prisma.facetAssignment.upsert({
    where: {
      facetId_entityType_entityId: {
        facetId: facetDef.id,
        entityType,
        entityId
      }
    },
    update: {
      isActive: true,
      assignedById: assignedBy.userId,
      assignedAt: new Date(),
      expiresAt,
      reviewAt,
      reason,
      metadata: metadata as any
    },
    create: {
      facetId: facetDef.id,
      entityType,
      entityId,
      assignedById: assignedBy.userId,
      assignedAt: new Date(),
      expiresAt,
      reviewAt,
      reason,
      metadata: metadata as any,
      isActive: true
    }
  });
  
  // Create history record
  await prisma.facetAssignmentHistory.create({
    data: {
      facetId: facetDef.id,
      entityType,
      entityId,
      action: FacetAction.ASSIGNED,
      performedById: assignedBy.userId,
      performedAt: new Date(),
      reason,
      expiresAt,
      metadata: metadata as any
    }
  });
  
  return assignment;
}

/**
 * Revoke facet from entity
 */
export async function revokeFacet(
  facetIdentifier: string | FacetIdentifier,
  entityType: string,
  entityId: string,
  revokedBy: Authentication,
  reason: string
): Promise<void> {
  const facet = typeof facetIdentifier === 'string' 
    ? parseFacet(facetIdentifier)
    : facetIdentifier;
  
  const facetDef = await prisma.facet.findUnique({
    where: {
      scope_name_value: {
        scope: facet.scope,
        name: facet.name,
        value: facet.value || ''
      }
    }
  });
  
  if (!facetDef) return; // Nothing to revoke
  
  // Deactivate assignment
  await prisma.facetAssignment.updateMany({
    where: {
      facetId: facetDef.id,
      entityType,
      entityId,
      isActive: true
    },
    data: {
      isActive: false
    }
  });
  
  // Create history record
  await prisma.facetAssignmentHistory.create({
    data: {
      facetId: facetDef.id,
      entityType,
      entityId,
      action: FacetAction.REVOKED,
      performedById: revokedBy.userId,
      performedAt: new Date(),
      reason
    }
  });
}

/**
 * Helper methods to attach to user objects
 */
export async function userHasFacet(
  userId: string,
  facetIdentifier: string | FacetIdentifier
): Promise<boolean> {
  return hasFacet('USER', userId, facetIdentifier);
}

export async function userGetFacets(
  userId: string,
  scope?: string
): Promise<FacetWithAssignment[]> {
  return getFacets('USER', userId, scope);
}

export async function userGetFacetValue(
  userId: string,
  scope: string,
  name: string
): Promise<string | null> {
  return getFacetValue('USER', userId, scope, name);
}

