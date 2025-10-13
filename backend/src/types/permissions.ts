import { User } from '@prisma/client';

/**
 * Authentication context containing user and request information
 */
export interface Authentication {
  user: User | null;
  userId: string | null;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  jwt?: string;
}

/**
 * Result of a permission check
 */
export interface PermissionResult {
  granted: boolean;
  userId: string | null;
  resourceId: string | null;
  operation: string;
  reason: string;
  reasonCode?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Facet identifier combining scope, name, and optional value
 */
export interface FacetIdentifier {
  scope: string;
  name: string;
  value?: string;
}

/**
 * Facet with full details including assignment info
 */
export interface FacetWithAssignment {
  facet: any; // Will be Facet type from Prisma
  assignment: any; // Will be FacetAssignment type from Prisma
  isExpired: boolean;
  needsReview: boolean;
}

/**
 * Options for permission auditing
 */
export interface PermissionAuditOptions {
  shouldAudit?: boolean;
  auditSensitive?: boolean; // Only audit sensitive operations
  asyncAudit?: boolean; // Send to RabbitMQ vs direct DB write
}

/**
 * Configuration for a facet hierarchy check
 */
export interface FacetHierarchyCheck {
  requiredFacet: FacetIdentifier;
  allowHigherLevels: boolean; // If true, higher hierarchy levels also pass
}

