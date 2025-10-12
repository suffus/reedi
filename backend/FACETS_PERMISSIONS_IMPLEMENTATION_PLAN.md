# Facets and Permissions System - Implementation Plan

## Executive Summary

This document outlines the implementation plan for a comprehensive facets and permissions system for the Reedi platform. The system provides fine-grained access control suitable for both social media and corporate HR contexts, with full audit trails and support for organizational hierarchies.

### Key Features

1. **Facet-Based Identity System**: Flexible attribute system for assigning roles, divisions, and capabilities to users and entities
2. **Line Management Hierarchy**: Built-in support for organizational reporting structures with manager-employee relationships
3. **Permission Evaluation**: Explicit permission checks that consider user facets, relationships, and line management
4. **Full Audit Trail**: Complete logging of facet assignments and sensitive permission decisions
5. **Performance Optimized**: Redis caching, batch operations, and efficient database queries
6. **Fail-Closed Security**: Errors result in denial, not accidental permission grants

### Line Management Integration

The system includes native support for organizational hierarchies through a `lineManagerId` field on the User model. This enables:

- **Direct and Indirect Management**: Check if a user manages another user (directly or through the hierarchy)
- **Reporting Tree Queries**: Get all direct reports or the entire reporting tree for a manager
- **Permission Inheritance**: Managers can access their reports' content based on visibility settings
- **Circular Reference Protection**: Prevents invalid organizational structures
- **Org Chart Visualization**: API support for building organizational charts

Line management is integrated into permission checks throughout the system, allowing managers to view and manage their reports' content while respecting privacy and business rules.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Model](#data-model)
3. [Core Library Implementation](#core-library-implementation)
4. [Authentication Layer](#authentication-layer)
5. [Route-Specific Permission Files](#route-specific-permission-files)
6. [Facet Management](#facet-management)
7. [Audit System](#audit-system)
8. [Migration Strategy](#migration-strategy)
9. [Testing Strategy](#testing-strategy)
10. [Performance Considerations](#performance-considerations)
11. [Implementation Phases](#implementation-phases)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     API Routes Layer                         │
│  (users.ts, media.ts, posts.ts, groups.ts, etc.)           │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│              Route-Specific Auth Modules                     │
│    (src/auth/users.ts, src/auth/media.ts, etc.)           │
│    - canDoMediaRead()                                        │
│    - canDoPostCreate()                                       │
│    - canDoUserUpdate()                                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                Core Permission Library                       │
│              (src/lib/permissions.ts)                        │
│    - grant() / deny()                                        │
│    - PermissionResult type                                   │
│    - Permission logging/audit                                │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   Facet System                               │
│              (src/lib/facets.ts)                            │
│    - getFacet() / hasFacet()                                │
│    - assignFacet() / revokeFacet()                          │
│    - checkFacetHierarchy()                                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                 Database Layer (Prisma)                      │
│    - Facet                                                   │
│    - FacetAssignment                                         │
│    - FacetAssignmentHistory                                  │
│    - PermissionAuditLog                                      │
└──────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Deny by Default**: All permissions are denied unless explicitly granted
2. **Fail Closed**: Errors in permission checks result in denial (500 error)
3. **Explicit Over Implicit**: All permission decisions must be explicitly coded
4. **Audit Everything**: All facet assignments and permission decisions for sensitive operations are logged
5. **Performance First**: Caching and optimization built in from the start
6. **Separation of Concerns**: Permission logic isolated from business logic

---

## Data Model

### New Prisma Models

#### 1. Facet Definition Model

```prisma
model Facet {
  id              String   @id @default(cuid())
  scope           String   // e.g., "user-role", "org-division", "feature-access"
  name            String   // e.g., "admin", "engineering", "locked-posts"
  value           String?  // Optional value for facets that need it
  description     String?
  requiresAudit   Boolean  @default(true) // Whether to track assignment history
  expiryDays      Int?     // Default expiry in days (null = no expiry)
  requiresReview  Boolean  @default(false) // Needs periodic review
  reviewDays      Int?     // Days between reviews
  parentFacetId   String?  // For facet hierarchy
  hierarchyLevel  Int      @default(0) // Level in hierarchy (higher = more senior)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  parentFacet     Facet?   @relation("FacetHierarchy", fields: [parentFacetId], references: [id])
  childFacets     Facet[]  @relation("FacetHierarchy")
  assignments     FacetAssignment[]
  assignmentHistory FacetAssignmentHistory[]
  
  @@unique([scope, name, value])
  @@index([scope, name])
  @@map("facets")
}
```

#### 2. Facet Assignment Model

```prisma
model FacetAssignment {
  id              String    @id @default(cuid())
  facetId         String
  entityType      String    // "USER", "MEDIA", "POST", "GROUP", etc.
  entityId        String    // ID of the entity
  assignedById    String?   // Who assigned it (null for system assignments)
  assignedAt      DateTime  @default(now())
  expiresAt       DateTime? // When this assignment expires
  reviewAt        DateTime? // When this needs review
  reason          String?   // Why was this assigned
  metadata        Json?     // Additional context
  isActive        Boolean   @default(true)
  
  // Relations
  facet           Facet     @relation(fields: [facetId], references: [id], onDelete: Cascade)
  assignedBy      User?     @relation("FacetAssignedBy", fields: [assignedById], references: [id])
  
  @@unique([facetId, entityType, entityId])
  @@index([entityType, entityId])
  @@index([expiresAt])
  @@index([reviewAt])
  @@map("facet_assignments")
}
```

#### 3. Facet Assignment History Model

```prisma
model FacetAssignmentHistory {
  id              String   @id @default(cuid())
  facetId         String
  entityType      String
  entityId        String
  action          FacetAction // ASSIGNED, REVOKED, EXPIRED, REVIEWED, EXTENDED
  performedById   String?
  performedAt     DateTime @default(now())
  reason          String?
  expiresAt       DateTime?
  previousExpiresAt DateTime?
  metadata        Json?
  
  // Relations
  facet           Facet    @relation(fields: [facetId], references: [id], onDelete: Cascade)
  performedBy     User?    @relation("FacetHistoryPerformedBy", fields: [performedById], references: [id])
  
  @@index([entityType, entityId])
  @@index([facetId])
  @@index([performedAt])
  @@map("facet_assignment_history")
}

enum FacetAction {
  ASSIGNED
  REVOKED
  EXPIRED
  REVIEWED
  EXTENDED
  MODIFIED
}
```

#### 4. Permission Audit Log Model

```prisma
model PermissionAuditLog {
  id              String   @id @default(cuid())
  userId          String?
  resourceType    String   // "MEDIA", "POST", "USER", etc.
  resourceId      String
  operation       String   // "read", "write", "delete", etc.
  granted         Boolean
  reason          String
  reasonCode      String?
  ipAddress       String?
  userAgent       String?
  requestId       String?  // For correlating with application logs
  executionTimeMs Int?     // Performance tracking
  facetsChecked   Json?    // Which facets were evaluated
  createdAt       DateTime @default(now())
  
  // Relations
  user            User?    @relation("PermissionAuditLogs", fields: [userId], references: [id])
  
  @@index([userId, createdAt])
  @@index([resourceType, resourceId])
  @@index([operation, granted])
  @@index([createdAt])
  @@map("permission_audit_logs")
}
```

#### 5. User Model Updates

```prisma
// Add these relations to existing User model
model User {
  // ... existing fields ...
  
  // Line management hierarchy
  lineManagerId         String?
  lineManager           User?    @relation("LineManagement", fields: [lineManagerId], references: [id])
  directReports         User[]   @relation("LineManagement")
  
  // New relations for facets
  facetsAssigned        FacetAssignment[]        @relation("FacetAssignedBy")
  facetActionsPerformed FacetAssignmentHistory[] @relation("FacetHistoryPerformedBy")
  permissionAuditLogs   PermissionAuditLog[]     @relation("PermissionAuditLogs")
  
  @@index([lineManagerId])
}
```

---

## Core Library Implementation

### 1. Type Definitions (`src/types/permissions.ts`)

```typescript
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
  facet: Facet;
  assignment: FacetAssignment;
  isExpired: boolean;
  needsReview: boolean;
}

/**
 * Options for permission auditing
 */
export interface PermissionAuditOptions {
  shouldAudit: boolean;
  auditSensitive: boolean; // Only audit sensitive operations
  asyncAudit: boolean; // Send to RabbitMQ vs direct DB write
}

/**
 * Configuration for a facet hierarchy check
 */
export interface FacetHierarchyCheck {
  requiredFacet: FacetIdentifier;
  allowHigherLevels: boolean; // If true, higher hierarchy levels also pass
}
```

### 2. Core Permissions Library (`src/lib/permissions.ts`)

```typescript
import { prisma } from '@/db';
import { Authentication, PermissionResult, PermissionAuditOptions } from '@/types/permissions';
import { publishToQueue } from '@/services/rabbitmq';

/**
 * Grant permission with reason
 */
export function grant(
  userId: string | null,
  resourceId: string | null,
  operation: string,
  reason: string,
  reasonCode?: string,
  metadata?: Record<string, any>
): PermissionResult {
  return {
    granted: true,
    userId,
    resourceId,
    operation,
    reason,
    reasonCode,
    metadata,
    timestamp: new Date()
  };
}

/**
 * Deny permission with reason
 */
export function deny(
  userId: string | null,
  resourceId: string | null,
  operation: string,
  reason: string,
  reasonCode?: string,
  metadata?: Record<string, any>
): PermissionResult {
  return {
    granted: false,
    userId,
    resourceId,
    operation,
    reason,
    reasonCode,
    metadata,
    timestamp: new Date()
  };
}

/**
 * Log permission decision to audit system
 */
export async function auditPermission(
  result: PermissionResult,
  auth: Authentication,
  resourceType: string,
  options: PermissionAuditOptions = { shouldAudit: true, auditSensitive: true, asyncAudit: true }
): Promise<void> {
  if (!options.shouldAudit) return;

  const auditData = {
    userId: result.userId,
    resourceType,
    resourceId: result.resourceId || '',
    operation: result.operation,
    granted: result.granted,
    reason: result.reason,
    reasonCode: result.reasonCode,
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
    requestId: auth.requestId,
    facetsChecked: result.metadata?.facetsChecked,
    createdAt: result.timestamp
  };

  if (options.asyncAudit) {
    // Send to RabbitMQ for async processing
    await publishToQueue('permission-audit', auditData).catch(err => {
      console.error('Failed to publish audit log to queue:', err);
      // Fallback to direct DB write if queue fails
      return prisma.permissionAuditLog.create({ data: auditData });
    });
  } else {
    // Direct DB write
    await prisma.permissionAuditLog.create({ data: auditData });
  }
}

/**
 * Wrapper to handle permission check errors
 * Ensures errors result in denial (fail-closed)
 */
export async function safePermissionCheck<T>(
  checkFn: () => Promise<PermissionResult> | PermissionResult,
  fallbackOperation: string = 'unknown-operation'
): Promise<PermissionResult> {
  try {
    return await checkFn();
  } catch (error) {
    console.error('Permission check error:', error);
    return deny(
      null,
      null,
      fallbackOperation,
      'Permission check failed due to internal error',
      'PERMISSION_CHECK_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Check multiple permissions and return if ALL are granted
 */
export function requireAll(
  ...results: PermissionResult[]
): PermissionResult {
  const denied = results.find(r => !r.granted);
  if (denied) return denied;
  
  return results[0]; // Return first if all granted
}

/**
 * Check multiple permissions and return if ANY are granted
 */
export function requireAny(
  ...results: PermissionResult[]
): PermissionResult {
  const granted = results.find(r => r.granted);
  if (granted) return granted;
  
  return results[0]; // Return first denial if none granted
}

/**
 * Filter array based on permission checks
 * Returns only items for which permission is granted
 */
export async function filterByPermission<T>(
  items: T[],
  auth: Authentication,
  checkFn: (item: T, auth: Authentication) => Promise<PermissionResult> | PermissionResult
): Promise<T[]> {
  const results = await Promise.all(
    items.map(async item => ({
      item,
      result: await safePermissionCheck(() => checkFn(item, auth))
    }))
  );
  
  return results
    .filter(({ result }) => result.granted)
    .map(({ item }) => item);
}
```

### 3. Facet Management Library (`src/lib/facets.ts`)

```typescript
import { prisma } from '@/db';
import { FacetIdentifier, FacetWithAssignment, Authentication } from '@/types/permissions';
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
    value: parts[2] || undefined
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
        value: facet.value || undefined
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
  
  // Find or create facet definition
  let facetDef = await prisma.facet.findUnique({
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
```

### 4. User Relations Library (`src/lib/userRelations.ts`)

```typescript
import { prisma } from '@/db';

/**
 * Check if user1 is friends with user2
 * Requires accepted friend request in both directions
 */
export async function isFriendsWith(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const friendRequest = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: userId1, receiverId: userId2, status: 'ACCEPTED' },
        { senderId: userId2, receiverId: userId1, status: 'ACCEPTED' }
      ]
    }
  });
  
  return friendRequest !== null;
}

/**
 * Check if user1 is following user2
 */
export async function isFollowing(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const follow = await prisma.follows.findUnique({
    where: {
      followerId_followingId: {
        followerId: userId1,
        followingId: userId2
      }
    }
  });
  
  return follow !== null;
}

/**
 * Check if user1 is an administrator/manager for user2
 * Uses the line management hierarchy to determine direct management relationship
 * and can traverse up the hierarchy to find if user1 manages user2 transitively
 */
export async function isAdministratorFor(
  user1Id: string,
  user2Id: string,
  includeIndirect: boolean = true
): Promise<boolean> {
  if (user1Id === user2Id) return false; // Can't be your own manager
  
  // Check direct line manager
  const user2 = await prisma.user.findUnique({
    where: { id: user2Id },
    select: { lineManagerId: true }
  });
  
  if (!user2) return false;
  if (user2.lineManagerId === user1Id) return true; // Direct manager
  
  // If we're only checking direct relationships, stop here
  if (!includeIndirect) return false;
  
  // Check indirect management (manager's manager, etc.)
  // Traverse up the hierarchy from user2 to see if we reach user1
  let currentManagerId = user2.lineManagerId;
  const visited = new Set<string>([user2Id]); // Prevent infinite loops
  let depth = 0;
  const maxDepth = 10; // Prevent excessive recursion
  
  while (currentManagerId && depth < maxDepth) {
    if (currentManagerId === user1Id) return true;
    if (visited.has(currentManagerId)) break; // Circular reference detected
    
    visited.add(currentManagerId);
    
    const manager = await prisma.user.findUnique({
      where: { id: currentManagerId },
      select: { lineManagerId: true }
    });
    
    if (!manager) break;
    currentManagerId = manager.lineManagerId;
    depth++;
  }
  
  return false;
}

/**
 * Get all direct reports for a manager
 */
export async function getDirectReports(managerId: string): Promise<string[]> {
  const reports = await prisma.user.findMany({
    where: { lineManagerId: managerId },
    select: { id: true }
  });
  
  return reports.map(r => r.id);
}

/**
 * Get all reports (direct and indirect) for a manager
 */
export async function getAllReports(managerId: string): Promise<string[]> {
  const allReports = new Set<string>();
  const toProcess = [managerId];
  const maxDepth = 10;
  let depth = 0;
  
  while (toProcess.length > 0 && depth < maxDepth) {
    const currentManager = toProcess.shift()!;
    
    const directReports = await prisma.user.findMany({
      where: { lineManagerId: currentManager },
      select: { id: true }
    });
    
    for (const report of directReports) {
      if (!allReports.has(report.id)) {
        allReports.add(report.id);
        toProcess.push(report.id);
      }
    }
    
    depth++;
  }
  
  return Array.from(allReports);
}

/**
 * Check if users share the same division
 */
export async function shareDivision(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const [user1Divisions, user2Divisions] = await Promise.all([
    getFacetValue('USER', userId1, 'org-division', 'division'),
    getFacetValue('USER', userId2, 'org-division', 'division')
  ]);
  
  if (!user1Divisions || !user2Divisions) return false;
  return user1Divisions === user2Divisions;
}
```

---

## Authentication Layer

### Authentication Context Builder (`src/middleware/authContext.ts`)

```typescript
import { Request } from 'express';
import { Authentication } from '@/types/permissions';
import { prisma } from '@/db';

/**
 * Extract authentication context from Express request
 */
export async function buildAuthContext(req: Request): Promise<Authentication> {
  const user = (req as any).user || null;
  const userId = user?.id || null;
  
  return {
    user,
    userId,
    sessionId: req.headers['x-session-id'] as string,
    ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id'] as string || `req-${Date.now()}`,
    jwt: req.headers.authorization?.replace('Bearer ', '')
  };
}

/**
 * Middleware to attach auth context to request
 */
export function attachAuthContext() {
  return async (req: Request, res: any, next: any) => {
    (req as any).authContext = await buildAuthContext(req);
    next();
  };
}
```

---

## Route-Specific Permission Files

### Example: Media Permissions (`src/auth/media.ts`)

```typescript
import { Authentication, PermissionResult } from '@/types/permissions';
import { grant, deny } from '@/lib/permissions';
import { userHasFacet, userGetFacetValue } from '@/lib/facets';
import { isFriendsWith, isAdministratorFor } from '@/lib/userRelations';
import { Media, User } from '@prisma/client';

/**
 * Check if user can read media item
 */
export async function canDoMediaRead(
  auth: Authentication,
  media: Media & { author: User },
): Promise<PermissionResult> {
  const requestUser = auth.user;
  const requestUserId = auth.userId;
  
  // Public media is always readable
  if (media.visibility === 'PUBLIC') {
    return grant(
      requestUserId,
      media.id,
      'media-read',
      'Media is public',
      'PUBLIC_MEDIA'
    );
  }
  
  // Anonymous users can only see public media
  if (!requestUser || !requestUserId) {
    return deny(
      requestUserId,
      media.id,
      'media-read',
      'No authenticated user and media is not public',
      'NOT_AUTHENTICATED'
    );
  }
  
  // Owner can always read their own media
  if (media.authorId === requestUserId) {
    return grant(
      requestUserId,
      media.id,
      'media-read',
      'Request user is the owner',
      'OWNER'
    );
  }
  
  // Friends can read FRIENDS_ONLY media
  if (media.visibility === 'FRIENDS_ONLY') {
    const areFriends = await isFriendsWith(requestUserId, media.authorId);
    if (areFriends) {
      return grant(
        requestUserId,
        media.id,
        'media-read',
        'Request user is friends with owner and media is FRIENDS_ONLY',
        'FRIENDS'
      );
    }
  }
  
  // Global admins can read all media
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(
      requestUserId,
      media.id,
      'media-read',
      'Request user is a global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  // Local/divisional admins can read media from same division
  if (await userHasFacet(requestUserId, 'reedi-admin:divisional')) {
    const requestUserDivision = await userGetFacetValue(requestUserId, 'org-division', 'division');
    const ownerDivision = await userGetFacetValue(media.authorId, 'org-division', 'division');
    
    if (requestUserDivision && requestUserDivision === ownerDivision) {
      return grant(
        requestUserId,
        media.id,
        'media-read',
        'Request user is divisional admin for same division as owner',
        'DIVISIONAL_ADMIN'
      );
    }
  }
  
  // Managers can read their subordinates' media
  if (await isAdministratorFor(requestUserId, media.authorId)) {
    return grant(
      requestUserId,
      media.id,
      'media-read',
      'Request user is manager/administrator for owner',
      'MANAGER'
    );
  }
  
  // Default deny
  return deny(
    requestUserId,
    media.id,
    'media-read',
    'No permission rules matched',
    'DEFAULT_DENY'
  );
}

/**
 * Check if user can update media item
 */
export async function canDoMediaUpdate(
  auth: Authentication,
  media: Media
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, media.id, 'media-update', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Owner can update
  if (media.authorId === requestUserId) {
    return grant(requestUserId, media.id, 'media-update', 'User is owner', 'OWNER');
  }
  
  // Global admins can update
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, media.id, 'media-update', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  return deny(requestUserId, media.id, 'media-update', 'Default deny', 'DEFAULT_DENY');
}

/**
 * Check if user can delete media item
 */
export async function canDoMediaDelete(
  auth: Authentication,
  media: Media
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, media.id, 'media-delete', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Owner can delete
  if (media.authorId === requestUserId) {
    return grant(requestUserId, media.id, 'media-delete', 'User is owner', 'OWNER');
  }
  
  // Global admins can delete
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, media.id, 'media-delete', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  return deny(requestUserId, media.id, 'media-delete', 'Default deny', 'DEFAULT_DENY');
}

/**
 * Filter media list to only those user can read
 */
export async function filterReadableMedia(
  auth: Authentication,
  mediaList: (Media & { author: User })[]
): Promise<(Media & { author: User })[]> {
  const results = await Promise.all(
    mediaList.map(async (media) => ({
      media,
      canRead: await canDoMediaRead(auth, media)
    }))
  );
  
  return results
    .filter(({ canRead }) => canRead.granted)
    .map(({ media }) => media);
}
```

### Example: Posts Permissions (`src/auth/posts.ts`)

```typescript
import { Authentication, PermissionResult } from '@/types/permissions';
import { grant, deny } from '@/lib/permissions';
import { userHasFacet } from '@/lib/facets';
import { isFriendsWith, isAdministratorFor } from '@/lib/userRelations';
import { Post, User } from '@prisma/client';

/**
 * Check if user can read post
 */
export async function canDoPostRead(
  auth: Authentication,
  post: Post & { author: User }
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  // Public posts are always readable
  if (post.visibility === 'PUBLIC' && post.publicationStatus === 'PUBLIC') {
    return grant(requestUserId, post.id, 'post-read', 'Post is public', 'PUBLIC_POST');
  }
  
  if (!requestUserId) {
    return deny(null, post.id, 'post-read', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Owner can always read
  if (post.authorId === requestUserId) {
    return grant(requestUserId, post.id, 'post-read', 'User is owner', 'OWNER');
  }
  
  // Friends can read FRIENDS_ONLY posts
  if (post.visibility === 'FRIENDS_ONLY' && post.publicationStatus === 'PUBLIC') {
    const areFriends = await isFriendsWith(requestUserId, post.authorId);
    if (areFriends) {
      return grant(requestUserId, post.id, 'post-read', 'User is friend and post is FRIENDS_ONLY', 'FRIENDS');
    }
  }
  
  // Global admins can read all
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, post.id, 'post-read', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // Managers can read subordinates' posts
  if (await isAdministratorFor(requestUserId, post.authorId)) {
    return grant(requestUserId, post.id, 'post-read', 'Manager of author', 'MANAGER');
  }
  
  return deny(requestUserId, post.id, 'post-read', 'Default deny', 'DEFAULT_DENY');
}

/**
 * Check if user can create locked posts (premium content)
 */
export async function canCreateLockedPost(
  auth: Authentication
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, null, 'post-create-locked', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Check if user has permission to publish locked media
  const user = auth.user;
  if (user && (user as any).canPublishLockedMedia) {
    return grant(requestUserId, null, 'post-create-locked', 'User has locked media permission', 'LOCKED_MEDIA_PERMISSION');
  }
  
  // Or check via facet
  if (await userHasFacet(requestUserId, 'feature-access:locked-posts')) {
    return grant(requestUserId, null, 'post-create-locked', 'User has locked posts facet', 'LOCKED_POSTS_FACET');
  }
  
  return deny(requestUserId, null, 'post-create-locked', 'No permission for locked posts', 'DEFAULT_DENY');
}
```

### Example: User Management Permissions (`src/auth/users.ts`)

```typescript
import { Authentication, PermissionResult } from '@/types/permissions';
import { grant, deny } from '@/lib/permissions';
import { userHasFacet } from '@/lib/facets';
import { isAdministratorFor } from '@/lib/userRelations';
import { User } from '@prisma/client';

/**
 * Check if user can view another user's profile
 */
export async function canViewUser(
  auth: Authentication,
  targetUser: User
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  // Public profiles are viewable by anyone
  if (!targetUser.isPrivate) {
    return grant(requestUserId, targetUser.id, 'user-view', 'Profile is public', 'PUBLIC_PROFILE');
  }
  
  if (!requestUserId) {
    return deny(null, targetUser.id, 'user-view', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Users can view their own profile
  if (requestUserId === targetUser.id) {
    return grant(requestUserId, targetUser.id, 'user-view', 'Own profile', 'SELF');
  }
  
  // Line managers can view their reports' profiles
  if (await isAdministratorFor(requestUserId, targetUser.id)) {
    return grant(requestUserId, targetUser.id, 'user-view', 'Line manager', 'LINE_MANAGER');
  }
  
  // Global admins can view all
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, targetUser.id, 'user-view', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // Friends/followers can view private profiles
  // (implement based on your business logic)
  
  return deny(requestUserId, targetUser.id, 'user-view', 'Default deny', 'DEFAULT_DENY');
}

/**
 * Check if user can update another user's profile
 */
export async function canUpdateUser(
  auth: Authentication,
  targetUser: User
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, targetUser.id, 'user-update', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Users can update their own profile
  if (requestUserId === targetUser.id) {
    return grant(requestUserId, targetUser.id, 'user-update', 'Own profile', 'SELF');
  }
  
  // Global admins can update any profile
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, targetUser.id, 'user-update', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  return deny(requestUserId, targetUser.id, 'user-update', 'Default deny', 'DEFAULT_DENY');
}

/**
 * Check if user can set/change another user's line manager
 */
export async function canSetLineManager(
  auth: Authentication,
  targetUserId: string,
  newManagerId: string
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, targetUserId, 'user-set-line-manager', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Global admins can set any line manager
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(
      requestUserId,
      targetUserId,
      'user-set-line-manager',
      'Global admin',
      'GLOBAL_ADMIN'
    );
  }
  
  // HR admins can set line managers
  if (await userHasFacet(requestUserId, 'user-role:hr-admin')) {
    return grant(
      requestUserId,
      targetUserId,
      'user-set-line-manager',
      'HR admin',
      'HR_ADMIN'
    );
  }
  
  // Divisional admins can set line managers within their division
  if (await userHasFacet(requestUserId, 'reedi-admin:divisional')) {
    // Check if both target and new manager are in same division
    // (implement based on your division logic)
    return grant(
      requestUserId,
      targetUserId,
      'user-set-line-manager',
      'Divisional admin',
      'DIVISIONAL_ADMIN'
    );
  }
  
  return deny(
    requestUserId,
    targetUserId,
    'user-set-line-manager',
    'Insufficient permissions',
    'DEFAULT_DENY'
  );
}

/**
 * Check if user can view organizational hierarchy
 */
export async function canViewOrgHierarchy(
  auth: Authentication
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, null, 'org-hierarchy-view', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Admins can view hierarchy
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, null, 'org-hierarchy-view', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // HR can view hierarchy
  if (await userHasFacet(requestUserId, 'user-role:hr-admin')) {
    return grant(requestUserId, null, 'org-hierarchy-view', 'HR admin', 'HR_ADMIN');
  }
  
  // Managers can view their own reporting tree
  const directReports = await prisma.user.findMany({
    where: { lineManagerId: requestUserId },
    select: { id: true }
  });
  
  if (directReports.length > 0) {
    return grant(
      requestUserId,
      null,
      'org-hierarchy-view',
      'Has direct reports',
      'MANAGER'
    );
  }
  
  return deny(requestUserId, null, 'org-hierarchy-view', 'Default deny', 'DEFAULT_DENY');
}
```

### Example: Facet Management Permissions (`src/auth/facets.ts`)

```typescript
import { Authentication, PermissionResult } from '@/types/permissions';
import { grant, deny } from '@/lib/permissions';
import { userHasFacet, parseFacet } from '@/lib/facets';

/**
 * Check if user can assign a specific facet
 */
export async function canAssignFacet(
  auth: Authentication,
  targetUserId: string,
  facetIdentifier: string
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, null, 'facet-assign', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Global facet admins can assign any facet
  if (await userHasFacet(requestUserId, 'reedi-facet-admin:global')) {
    return grant(
      requestUserId,
      targetUserId,
      'facet-assign',
      'User is global facet admin',
      'GLOBAL_FACET_ADMIN'
    );
  }
  
  // Parse the facet to check for specific assignment permissions
  const facet = parseFacet(facetIdentifier);
  
  // Divisional admins can assign divisional facets
  if (facet.scope === 'org-division' && await userHasFacet(requestUserId, 'reedi-admin:divisional')) {
    return grant(
      requestUserId,
      targetUserId,
      'facet-assign',
      'Divisional admin assigning divisional facet',
      'DIVISIONAL_ADMIN'
    );
  }
  
  // HR role can assign department facets
  if (facet.scope === 'org-department' && await userHasFacet(requestUserId, 'user-role:hr-admin')) {
    return grant(
      requestUserId,
      targetUserId,
      'facet-assign',
      'HR admin assigning department facet',
      'HR_ADMIN'
    );
  }
  
  return deny(
    requestUserId,
    targetUserId,
    'facet-assign',
    'No permission to assign this facet',
    'DEFAULT_DENY'
  );
}

/**
 * Check if user can revoke a facet
 */
export async function canRevokeFacet(
  auth: Authentication,
  targetUserId: string,
  facetIdentifier: string
): Promise<PermissionResult> {
  // Same rules as assignment for now
  return canAssignFacet(auth, targetUserId, facetIdentifier);
}

/**
 * Check if user can view facet assignment history
 */
export async function canViewFacetHistory(
  auth: Authentication,
  targetUserId: string
): Promise<PermissionResult> {
  const requestUserId = auth.userId;
  
  if (!requestUserId) {
    return deny(null, targetUserId, 'facet-history-view', 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  
  // Users can view their own history
  if (requestUserId === targetUserId) {
    return grant(requestUserId, targetUserId, 'facet-history-view', 'Viewing own history', 'SELF');
  }
  
  // Global admins can view any history
  if (await userHasFacet(requestUserId, 'reedi-admin:global')) {
    return grant(requestUserId, targetUserId, 'facet-history-view', 'Global admin', 'GLOBAL_ADMIN');
  }
  
  // HR can view history
  if (await userHasFacet(requestUserId, 'user-role:hr-admin')) {
    return grant(requestUserId, targetUserId, 'facet-history-view', 'HR admin', 'HR_ADMIN');
  }
  
  return deny(requestUserId, targetUserId, 'facet-history-view', 'Default deny', 'DEFAULT_DENY');
}
```

---

## Facet Management

### Facet Administration Routes (`src/routes/facets.ts`)

```typescript
import express from 'express';
import { prisma } from '@/db';
import { buildAuthContext } from '@/middleware/authContext';
import { assignFacet, revokeFacet, userGetFacets } from '@/lib/facets';
import { canAssignFacet, canRevokeFacet, canViewFacetHistory } from '@/auth/facets';
import { auditPermission } from '@/lib/permissions';

const router = express.Router();

/**
 * GET /api/facets/definitions
 * List all available facet definitions
 */
router.get('/definitions', async (req, res) => {
  try {
    const auth = await buildAuthContext(req);
    
    // TODO: Add permission check for viewing facet definitions
    
    const facets = await prisma.facet.findMany({
      where: { isActive: true },
      orderBy: [
        { scope: 'asc' },
        { name: 'asc' }
      ]
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
    const auth = await buildAuthContext(req);
    const { userId } = req.params;
    
    const canView = await canViewFacetHistory(auth, userId);
    
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
    const auth = await buildAuthContext(req);
    const { userId, facet, reason, expiryDays, metadata } = req.body;
    
    if (!userId || !facet || !reason) {
      return res.status(400).json({ error: 'Missing required fields: userId, facet, reason' });
    }
    
    const canAssign = await canAssignFacet(auth, userId, facet);
    await auditPermission(canAssign, auth, 'USER', { shouldAudit: true, auditSensitive: true, asyncAudit: true });
    
    if (!canAssign.granted) {
      return res.status(403).json({ error: canAssign.reason });
    }
    
    const assignment = await assignFacet(
      facet,
      'USER',
      userId,
      auth,
      reason,
      expiryDays,
      metadata
    );
    
    res.json({ assignment, message: 'Facet assigned successfully' });
  } catch (error) {
    console.error('Error assigning facet:', error);
    res.status(500).json({ error: 'Failed to assign facet' });
  }
});

/**
 * POST /api/facets/revoke
 * Revoke a facet from a user
 */
router.post('/revoke', async (req, res) => {
  try {
    const auth = await buildAuthContext(req);
    const { userId, facet, reason } = req.body;
    
    if (!userId || !facet || !reason) {
      return res.status(400).json({ error: 'Missing required fields: userId, facet, reason' });
    }
    
    const canRevoke = await canRevokeFacet(auth, userId, facet);
    await auditPermission(canRevoke, auth, 'USER', { shouldAudit: true, auditSensitive: true, asyncAudit: true });
    
    if (!canRevoke.granted) {
      return res.status(403).json({ error: canRevoke.reason });
    }
    
    await revokeFacet(facet, 'USER', userId, auth, reason);
    
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
    const auth = await buildAuthContext(req);
    const { userId } = req.params;
    
    const canView = await canViewFacetHistory(auth, userId);
    
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
        facet: true,
        performedBy: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      },
      orderBy: { performedAt: 'desc' }
    });
    
    res.json({ history });
  } catch (error) {
    console.error('Error fetching facet history:', error);
    res.status(500).json({ error: 'Failed to fetch facet history' });
  }
});

export default router;
```

### Line Manager Management Routes (`src/routes/users.ts` additions)

```typescript
// Add these endpoints to the existing users router

/**
 * GET /api/users/:userId/line-manager
 * Get a user's line manager
 */
router.get('/:userId/line-manager', async (req, res) => {
  try {
    const auth = await buildAuthContext(req);
    const { userId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        lineManagerId: true,
        lineManager: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatar: true
          }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Permission check: user can view their own manager, or admins can view any
    const canView = await canViewUser(auth, { id: userId } as any);
    if (!canView.granted) {
      return res.status(403).json({ error: canView.reason });
    }
    
    res.json({ lineManager: user.lineManager });
  } catch (error) {
    console.error('Error fetching line manager:', error);
    res.status(500).json({ error: 'Failed to fetch line manager' });
  }
});

/**
 * GET /api/users/:userId/direct-reports
 * Get a user's direct reports
 */
router.get('/:userId/direct-reports', async (req, res) => {
  try {
    const auth = await buildAuthContext(req);
    const { userId } = req.params;
    
    // Permission check: user can view their own reports, or admins
    const canView = await canViewOrgHierarchy(auth);
    if (!canView.granted) {
      return res.status(403).json({ error: canView.reason });
    }
    
    const directReports = await prisma.user.findMany({
      where: { lineManagerId: userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        avatar: true,
        location: true,
        bio: true
      }
    });
    
    res.json({ directReports });
  } catch (error) {
    console.error('Error fetching direct reports:', error);
    res.status(500).json({ error: 'Failed to fetch direct reports' });
  }
});

/**
 * GET /api/users/:userId/reporting-tree
 * Get a user's full reporting tree (direct and indirect reports)
 */
router.get('/:userId/reporting-tree', async (req, res) => {
  try {
    const auth = await buildAuthContext(req);
    const { userId } = req.params;
    
    // Permission check
    const canView = await canViewOrgHierarchy(auth);
    if (!canView.granted) {
      return res.status(403).json({ error: canView.reason });
    }
    
    const allReportIds = await getAllReports(userId);
    
    const reports = await prisma.user.findMany({
      where: { id: { in: allReportIds } },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        avatar: true,
        lineManagerId: true
      }
    });
    
    // Build tree structure
    const tree = buildOrgTree(reports);
    
    res.json({ reportingTree: tree });
  } catch (error) {
    console.error('Error fetching reporting tree:', error);
    res.status(500).json({ error: 'Failed to fetch reporting tree' });
  }
});

/**
 * PUT /api/users/:userId/line-manager
 * Set or update a user's line manager
 */
router.put('/:userId/line-manager', async (req, res) => {
  try {
    const auth = await buildAuthContext(req);
    const { userId } = req.params;
    const { lineManagerId } = req.body;
    
    // Validate input
    if (lineManagerId && typeof lineManagerId !== 'string') {
      return res.status(400).json({ error: 'Invalid lineManagerId' });
    }
    
    // Check for circular reference
    if (lineManagerId) {
      const wouldCreateCycle = await checkForCircularReference(userId, lineManagerId);
      if (wouldCreateCycle) {
        return res.status(400).json({ 
          error: 'Cannot set line manager: would create circular reference in hierarchy' 
        });
      }
    }
    
    // Permission check
    const canSet = await canSetLineManager(auth, userId, lineManagerId);
    await auditPermission(canSet, auth, 'USER', { 
      shouldAudit: true, 
      auditSensitive: true, 
      asyncAudit: true 
    });
    
    if (!canSet.granted) {
      return res.status(403).json({ error: canSet.reason });
    }
    
    // Update line manager
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { lineManagerId: lineManagerId || null },
      select: {
        id: true,
        name: true,
        lineManagerId: true,
        lineManager: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true
          }
        }
      }
    });
    
    res.json({ 
      user: updatedUser,
      message: lineManagerId 
        ? 'Line manager updated successfully' 
        : 'Line manager removed successfully'
    });
  } catch (error) {
    console.error('Error setting line manager:', error);
    res.status(500).json({ error: 'Failed to set line manager' });
  }
});

/**
 * Helper: Check if setting a line manager would create a circular reference
 */
async function checkForCircularReference(
  userId: string, 
  newManagerId: string
): Promise<boolean> {
  if (userId === newManagerId) return true;
  
  // Check if newManager is already in userId's reporting tree
  // (i.e., userId is currently a manager of newManager)
  return await isAdministratorFor(userId, newManagerId, true);
}

/**
 * Helper: Build hierarchical tree structure from flat list
 */
function buildOrgTree(users: any[]): any {
  const userMap = new Map(users.map(u => [u.id, { ...u, reports: [] }]));
  const roots: any[] = [];
  
  for (const user of users) {
    const node = userMap.get(user.id);
    if (user.lineManagerId && userMap.has(user.lineManagerId)) {
      const manager = userMap.get(user.lineManagerId);
      manager.reports.push(node);
    } else {
      roots.push(node);
    }
  }
  
  return roots.length === 1 ? roots[0] : roots;
}
```

---

## Audit System

### RabbitMQ Integration (`src/services/rabbitmq.ts`)

```typescript
import amqp from 'amqplib';

let channel: amqp.Channel | null = null;

/**
 * Initialize RabbitMQ connection
 */
export async function initRabbitMQ(): Promise<void> {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel = await connection.createChannel();
    
    // Declare queues
    await channel.assertQueue('permission-audit', { durable: true });
    await channel.assertQueue('facet-changes', { durable: true });
    
    console.log('RabbitMQ connected successfully');
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    throw error;
  }
}

/**
 * Publish message to queue
 */
export async function publishToQueue(
  queueName: string,
  data: any
): Promise<void> {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  
  await channel.sendToQueue(
    queueName,
    Buffer.from(JSON.stringify(data)),
    { persistent: true }
  );
}

/**
 * Consume messages from queue
 */
export async function consumeQueue(
  queueName: string,
  handler: (data: any) => Promise<void>
): Promise<void> {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  
  await channel.consume(queueName, async (msg) => {
    if (!msg) return;
    
    try {
      const data = JSON.parse(msg.content.toString());
      await handler(data);
      channel!.ack(msg);
    } catch (error) {
      console.error('Error processing message:', error);
      // Reject and requeue
      channel!.nack(msg, false, true);
    }
  });
}
```

### Audit Worker (`src/workers/auditWorker.ts`)

```typescript
import { prisma } from '@/db';
import { consumeQueue, initRabbitMQ } from '@/services/rabbitmq';

/**
 * Worker to process permission audit logs from RabbitMQ
 */
async function processPermissionAudit(data: any): Promise<void> {
  try {
    await prisma.permissionAuditLog.create({ data });
    console.log('Permission audit logged:', data.operation, data.granted);
  } catch (error) {
    console.error('Failed to log permission audit:', error);
    throw error; // Will requeue the message
  }
}

/**
 * Start audit worker
 */
export async function startAuditWorker(): Promise<void> {
  await initRabbitMQ();
  
  console.log('Starting audit worker...');
  await consumeQueue('permission-audit', processPermissionAudit);
  
  console.log('Audit worker started successfully');
}

// Run if executed directly
if (require.main === module) {
  startAuditWorker().catch(error => {
    console.error('Failed to start audit worker:', error);
    process.exit(1);
  });
}
```

---

## Migration Strategy

### Phase 1: Database Schema Migration

```bash
# Create migration
npx prisma migrate dev --name add_facets_permissions_and_line_management

# This will:
# 1. Add lineManagerId field to User model
# 2. Add Facet, FacetAssignment, FacetAssignmentHistory tables
# 3. Add PermissionAuditLog table
# 4. Add relations to User model
# 5. Add appropriate indexes
```

**Key Schema Changes:**

1. **User Model**: Add `lineManagerId` field with self-referencing relation
2. **Facet Tables**: Three new tables for facet definitions, assignments, and history
3. **Audit Table**: PermissionAuditLog for tracking permission decisions
4. **Indexes**: Optimize for common query patterns (entity lookups, expiry checks, hierarchy traversal)

### Phase 2: Seed Initial Facets

```typescript
// prisma/seeds/facets.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedFacets() {
  // Global admin facet
  await prisma.facet.upsert({
    where: {
      scope_name_value: {
        scope: 'reedi-admin',
        name: 'global',
        value: ''
      }
    },
    update: {},
    create: {
      scope: 'reedi-admin',
      name: 'global',
      description: 'Global administrator with full system access',
      requiresAudit: true,
      requiresReview: true,
      reviewDays: 90,
      hierarchyLevel: 100
    }
  });
  
  // Divisional admin facet
  await prisma.facet.upsert({
    where: {
      scope_name_value: {
        scope: 'reedi-admin',
        name: 'divisional',
        value: ''
      }
    },
    update: {},
    create: {
      scope: 'reedi-admin',
      name: 'divisional',
      description: 'Divisional administrator with access to division resources',
      requiresAudit: true,
      requiresReview: true,
      reviewDays: 90,
      hierarchyLevel: 50
    }
  });
  
  // Facet admin facet (meta-facet)
  await prisma.facet.upsert({
    where: {
      scope_name_value: {
        scope: 'reedi-facet-admin',
        name: 'global',
        value: ''
      }
    },
    update: {},
    create: {
      scope: 'reedi-facet-admin',
      name: 'global',
      description: 'Can assign and revoke any facet',
      requiresAudit: true,
      requiresReview: true,
      reviewDays: 30,
      hierarchyLevel: 100
    }
  });
  
  // Feature access: locked posts
  await prisma.facet.upsert({
    where: {
      scope_name_value: {
        scope: 'feature-access',
        name: 'locked-posts',
        value: ''
      }
    },
    update: {},
    create: {
      scope: 'feature-access',
      name: 'locked-posts',
      description: 'Can create and manage locked/premium posts',
      requiresAudit: true,
      expiryDays: 365,
      hierarchyLevel: 10
    }
  });
  
  // User roles
  const roles = ['admin', 'manager', 'director', 'hr-admin', 'moderator'];
  for (const [index, role] of roles.entries()) {
    await prisma.facet.upsert({
      where: {
        scope_name_value: {
          scope: 'user-role',
          name: role,
          value: ''
        }
      },
      update: {},
      create: {
        scope: 'user-role',
        name: role,
        description: `User has ${role} role`,
        requiresAudit: true,
        requiresReview: true,
        reviewDays: 180,
        hierarchyLevel: (roles.length - index) * 10
      }
    });
  }
  
  console.log('Facets seeded successfully');
}
```

### Phase 3: Migrate Existing Permissions to Facets

```typescript
// scripts/migrate-existing-permissions.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateExistingPermissions() {
  // Migrate canPublishLockedMedia to facet
  const usersWithLockedMedia = await prisma.user.findMany({
    where: { canPublishLockedMedia: true }
  });
  
  const lockedPostsFacet = await prisma.facet.findUnique({
    where: {
      scope_name_value: {
        scope: 'feature-access',
        name: 'locked-posts',
        value: ''
      }
    }
  });
  
  if (!lockedPostsFacet) {
    throw new Error('Locked posts facet not found. Run seed first.');
  }
  
  for (const user of usersWithLockedMedia) {
    await prisma.facetAssignment.upsert({
      where: {
        facetId_entityType_entityId: {
          facetId: lockedPostsFacet.id,
          entityType: 'USER',
          entityId: user.id
        }
      },
      update: {},
      create: {
        facetId: lockedPostsFacet.id,
        entityType: 'USER',
        entityId: user.id,
        assignedById: null, // System migration
        reason: 'Migrated from canPublishLockedMedia boolean flag',
        isActive: true
      }
    });
    
    // Record in history
    await prisma.facetAssignmentHistory.create({
      data: {
        facetId: lockedPostsFacet.id,
        entityType: 'USER',
        entityId: user.id,
        action: 'ASSIGNED',
        performedById: null,
        reason: 'System migration from canPublishLockedMedia'
      }
    });
  }
  
  console.log(`Migrated ${usersWithLockedMedia.length} users to facet system`);
}

// Run migration
migrateExistingPermissions()
  .then(() => console.log('Migration complete'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Testing Strategy

### Unit Tests for Core Libraries

```typescript
// __tests__/lib/permissions.test.ts
import { grant, deny, requireAll, requireAny } from '@/lib/permissions';

describe('Permission Library', () => {
  describe('grant()', () => {
    it('should create a grant result', () => {
      const result = grant('user1', 'media1', 'media-read', 'Test reason');
      expect(result.granted).toBe(true);
      expect(result.operation).toBe('media-read');
      expect(result.reason).toBe('Test reason');
    });
  });
  
  describe('deny()', () => {
    it('should create a deny result', () => {
      const result = deny('user1', 'media1', 'media-read', 'Test deny');
      expect(result.granted).toBe(false);
      expect(result.operation).toBe('media-read');
    });
  });
  
  describe('requireAll()', () => {
    it('should return granted if all permissions granted', () => {
      const r1 = grant('u1', 'r1', 'op1', 'reason1');
      const r2 = grant('u1', 'r2', 'op2', 'reason2');
      const result = requireAll(r1, r2);
      expect(result.granted).toBe(true);
    });
    
    it('should return denied if any permission denied', () => {
      const r1 = grant('u1', 'r1', 'op1', 'reason1');
      const r2 = deny('u1', 'r2', 'op2', 'reason2');
      const result = requireAll(r1, r2);
      expect(result.granted).toBe(false);
    });
  });
  
  describe('requireAny()', () => {
    it('should return granted if any permission granted', () => {
      const r1 = deny('u1', 'r1', 'op1', 'reason1');
      const r2 = grant('u1', 'r2', 'op2', 'reason2');
      const result = requireAny(r1, r2);
      expect(result.granted).toBe(true);
    });
    
    it('should return denied if all permissions denied', () => {
      const r1 = deny('u1', 'r1', 'op1', 'reason1');
      const r2 = deny('u1', 'r2', 'op2', 'reason2');
      const result = requireAny(r1, r2);
      expect(result.granted).toBe(false);
    });
  });
});
```

```typescript
// __tests__/lib/facets.test.ts
import { parseFacet, facetToString } from '@/lib/facets';

describe('Facet Library', () => {
  describe('parseFacet()', () => {
    it('should parse two-part facet', () => {
      const result = parseFacet('user-role:admin');
      expect(result).toEqual({
        scope: 'user-role',
        name: 'admin',
        value: undefined
      });
    });
    
    it('should parse three-part facet', () => {
      const result = parseFacet('org-division:sales:west');
      expect(result).toEqual({
        scope: 'org-division',
        name: 'sales',
        value: 'west'
      });
    });
    
    it('should throw on invalid format', () => {
      expect(() => parseFacet('invalid')).toThrow();
    });
  });
  
  describe('facetToString()', () => {
    it('should convert facet to string', () => {
      const result = facetToString({
        scope: 'user-role',
        name: 'admin'
      });
      expect(result).toBe('user-role:admin');
    });
    
    it('should include value if present', () => {
      const result = facetToString({
        scope: 'org-division',
        name: 'sales',
        value: 'west'
      });
      expect(result).toBe('org-division:sales:west');
    });
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/permissions.test.ts
import { prisma } from '@/db';
import { assignFacet, userHasFacet } from '@/lib/facets';
import { canDoMediaRead } from '@/auth/media';

describe('Permission Integration Tests', () => {
  let testUser: any;
  let managerUser: any;
  let testMedia: any;
  let globalAdminFacet: any;
  
  beforeAll(async () => {
    // Create manager user
    managerUser = await prisma.user.create({
      data: {
        email: 'manager@example.com',
        name: 'Manager User',
        password: 'hashedpassword'
      }
    });
    
    // Create test user with manager
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedpassword',
        lineManagerId: managerUser.id
      }
    });
    
    // Create test media
    testMedia = await prisma.media.create({
      data: {
        url: 'test.jpg',
        authorId: testUser.id,
        visibility: 'PRIVATE'
      }
    });
    
    // Get global admin facet
    globalAdminFacet = await prisma.facet.findUnique({
      where: {
        scope_name_value: {
          scope: 'reedi-admin',
          name: 'global',
          value: ''
        }
      }
    });
  });
  
  afterAll(async () => {
    await prisma.media.deleteMany({ where: { id: testMedia.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
    await prisma.user.deleteMany({ where: { id: managerUser.id } });
  });
  
  test('user cannot read private media without permission', async () => {
    const otherUser = await prisma.user.create({
      data: {
        email: 'other@example.com',
        name: 'Other User',
        password: 'hashedpassword'
      }
    });
    
    const auth = {
      user: otherUser,
      userId: otherUser.id,
      requestId: 'test-req-1'
    };
    
    const result = await canDoMediaRead(auth, {
      ...testMedia,
      author: testUser
    });
    
    expect(result.granted).toBe(false);
    
    await prisma.user.delete({ where: { id: otherUser.id } });
  });
  
  test('user can read their own media', async () => {
    const auth = {
      user: testUser,
      userId: testUser.id,
      requestId: 'test-req-2'
    };
    
    const result = await canDoMediaRead(auth, {
      ...testMedia,
      author: testUser
    });
    
    expect(result.granted).toBe(true);
    expect(result.reasonCode).toBe('OWNER');
  });
  
  test('global admin can read any media', async () => {
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        name: 'Admin User',
        password: 'hashedpassword'
      }
    });
    
    // Assign global admin facet
    await assignFacet(
      'reedi-admin:global',
      'USER',
      adminUser.id,
      { userId: null, user: null, requestId: 'test' },
      'Test setup'
    );
    
    // Verify facet was assigned
    const hasFacet = await userHasFacet(adminUser.id, 'reedi-admin:global');
    expect(hasFacet).toBe(true);
    
    const auth = {
      user: adminUser,
      userId: adminUser.id,
      requestId: 'test-req-3'
    };
    
    const result = await canDoMediaRead(auth, {
      ...testMedia,
      author: testUser
    });
    
    expect(result.granted).toBe(true);
    expect(result.reasonCode).toBe('GLOBAL_ADMIN');
    
    await prisma.facetAssignment.deleteMany({ where: { entityId: adminUser.id } });
    await prisma.user.delete({ where: { id: adminUser.id } });
  });
  
  test('line manager can read direct report private media', async () => {
    const auth = {
      user: managerUser,
      userId: managerUser.id,
      requestId: 'test-req-4'
    };
    
    const result = await canDoMediaRead(auth, {
      ...testMedia,
      author: testUser
    });
    
    expect(result.granted).toBe(true);
    expect(result.reasonCode).toBe('MANAGER');
  });
  
  test('isAdministratorFor detects direct management', async () => {
    const result = await isAdministratorFor(managerUser.id, testUser.id);
    expect(result).toBe(true);
  });
  
  test('isAdministratorFor returns false for non-manager', async () => {
    const otherUser = await prisma.user.create({
      data: {
        email: 'other2@example.com',
        name: 'Other User 2',
        password: 'hashedpassword'
      }
    });
    
    const result = await isAdministratorFor(otherUser.id, testUser.id);
    expect(result).toBe(false);
    
    await prisma.user.delete({ where: { id: otherUser.id } });
  });
  
  test('isAdministratorFor detects indirect management', async () => {
    // Create a chain: director -> manager -> employee
    const director = await prisma.user.create({
      data: {
        email: 'director@example.com',
        name: 'Director User',
        password: 'hashedpassword'
      }
    });
    
    await prisma.user.update({
      where: { id: managerUser.id },
      data: { lineManagerId: director.id }
    });
    
    const result = await isAdministratorFor(director.id, testUser.id, true);
    expect(result).toBe(true);
    
    // Clean up
    await prisma.user.update({
      where: { id: managerUser.id },
      data: { lineManagerId: null }
    });
    await prisma.user.delete({ where: { id: director.id } });
  });
});
```

### Line Management Tests

```typescript
// __tests__/lib/userRelations.test.ts
import { prisma } from '@/db';
import { 
  isAdministratorFor, 
  getDirectReports, 
  getAllReports 
} from '@/lib/userRelations';

describe('Line Management', () => {
  let ceo: any;
  let vp: any;
  let director: any;
  let manager: any;
  let employee: any;
  
  beforeAll(async () => {
    // Create organizational hierarchy: CEO -> VP -> Director -> Manager -> Employee
    ceo = await prisma.user.create({
      data: { email: 'ceo@test.com', name: 'CEO', password: 'hash' }
    });
    
    vp = await prisma.user.create({
      data: { 
        email: 'vp@test.com', 
        name: 'VP', 
        password: 'hash',
        lineManagerId: ceo.id
      }
    });
    
    director = await prisma.user.create({
      data: { 
        email: 'director@test.com', 
        name: 'Director', 
        password: 'hash',
        lineManagerId: vp.id
      }
    });
    
    manager = await prisma.user.create({
      data: { 
        email: 'manager@test.com', 
        name: 'Manager', 
        password: 'hash',
        lineManagerId: director.id
      }
    });
    
    employee = await prisma.user.create({
      data: { 
        email: 'employee@test.com', 
        name: 'Employee', 
        password: 'hash',
        lineManagerId: manager.id
      }
    });
  });
  
  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        id: { in: [ceo.id, vp.id, director.id, manager.id, employee.id] }
      }
    });
  });
  
  test('getDirectReports returns only direct reports', async () => {
    const reports = await getDirectReports(manager.id);
    expect(reports).toHaveLength(1);
    expect(reports).toContain(employee.id);
  });
  
  test('getAllReports returns entire hierarchy', async () => {
    const reports = await getAllReports(ceo.id);
    expect(reports).toHaveLength(4);
    expect(reports).toContain(vp.id);
    expect(reports).toContain(director.id);
    expect(reports).toContain(manager.id);
    expect(reports).toContain(employee.id);
  });
  
  test('isAdministratorFor works for direct manager', async () => {
    const result = await isAdministratorFor(manager.id, employee.id);
    expect(result).toBe(true);
  });
  
  test('isAdministratorFor works for indirect manager', async () => {
    const result = await isAdministratorFor(ceo.id, employee.id, true);
    expect(result).toBe(true);
  });
  
  test('isAdministratorFor returns false for non-manager', async () => {
    const result = await isAdministratorFor(employee.id, ceo.id);
    expect(result).toBe(false);
  });
  
  test('isAdministratorFor with indirect=false checks only direct', async () => {
    const result = await isAdministratorFor(ceo.id, employee.id, false);
    expect(result).toBe(false); // CEO is not direct manager of employee
  });
  
  test('prevents circular reference', async () => {
    // This should be validated in the API layer, but test the check function
    const result = await isAdministratorFor(employee.id, ceo.id);
    expect(result).toBe(false);
  });
});
```

---

## Performance Considerations

### 1. Caching Strategy

```typescript
// src/lib/cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

/**
 * Cache facet assignments for fast lookup
 */
export async function cacheFacetAssignment(
  entityType: string,
  entityId: string,
  facets: any[]
): Promise<void> {
  const key = `facets:${entityType}:${entityId}`;
  await redis.setex(key, 300, JSON.stringify(facets)); // 5 minute TTL
}

/**
 * Get cached facet assignments
 */
export async function getCachedFacets(
  entityType: string,
  entityId: string
): Promise<any[] | null> {
  const key = `facets:${entityType}:${entityId}`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

/**
 * Invalidate facet cache for entity
 */
export async function invalidateFacetCache(
  entityType: string,
  entityId: string
): Promise<void> {
  const key = `facets:${entityType}:${entityId}`;
  await redis.del(key);
}

/**
 * Cache permission check result (for expensive checks)
 */
export async function cachePermissionResult(
  userId: string,
  resourceType: string,
  resourceId: string,
  operation: string,
  result: boolean
): Promise<void> {
  const key = `perm:${userId}:${resourceType}:${resourceId}:${operation}`;
  await redis.setex(key, 60, result ? '1' : '0'); // 1 minute TTL
}

/**
 * Get cached permission result
 */
export async function getCachedPermission(
  userId: string,
  resourceType: string,
  resourceId: string,
  operation: string
): Promise<boolean | null> {
  const key = `perm:${userId}:${resourceType}:${resourceId}:${operation}`;
  const cached = await redis.get(key);
  return cached === null ? null : cached === '1';
}
```

### 2. Database Query Optimization

```sql
-- Indexes for facet lookups
CREATE INDEX idx_facet_assignments_entity ON facet_assignments(entity_type, entity_id, is_active);
CREATE INDEX idx_facet_assignments_expires ON facet_assignments(expires_at) WHERE is_active = true;
CREATE INDEX idx_facet_assignments_review ON facet_assignments(review_at) WHERE is_active = true;

-- Index for facet hierarchy queries
CREATE INDEX idx_facets_hierarchy ON facets(parent_facet_id, hierarchy_level);

-- Indexes for audit queries
CREATE INDEX idx_permission_audit_user_time ON permission_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_permission_audit_resource ON permission_audit_logs(resource_type, resource_id);
CREATE INDEX idx_facet_history_entity_time ON facet_assignment_history(entity_type, entity_id, performed_at DESC);

-- Index for line management queries (CRITICAL for performance)
CREATE INDEX idx_users_line_manager ON users(line_manager_id) WHERE line_manager_id IS NOT NULL;

-- Composite index for common queries
CREATE INDEX idx_users_manager_active ON users(line_manager_id, is_active) WHERE line_manager_id IS NOT NULL;
```

**Line Management Query Optimization Notes:**

1. **Hierarchy Traversal Limits**: The `isAdministratorFor()` function limits traversal to 10 levels to prevent performance issues and infinite loops
2. **Caching Manager Relationships**: Cache the result of `isAdministratorFor()` checks since they're expensive
3. **Batch Direct Reports Queries**: When checking multiple users, batch load all their managers in one query
4. **Denormalization Option**: For very large hierarchies, consider storing a `managerPath` JSON field with all ancestor manager IDs for O(1) lookups

### 3. Batch Permission Checks

```typescript
// src/lib/batchPermissions.ts
import { Authentication, PermissionResult } from '@/types/permissions';
import DataLoader from 'dataloader';
import { userHasFacet } from '@/lib/facets';

/**
 * Create a DataLoader for batching facet checks
 */
export function createFacetLoader(userId: string) {
  return new DataLoader(async (facetIds: readonly string[]) => {
    // Fetch all facets in one query
    const results = await Promise.all(
      facetIds.map(facetId => userHasFacet(userId, facetId))
    );
    return results;
  });
}

/**
 * Batch load user facets for multiple users
 */
export function createUserFacetsLoader() {
  return new DataLoader(async (userIds: readonly string[]) => {
    const facets = await prisma.facetAssignment.findMany({
      where: {
        entityType: 'USER',
        entityId: { in: userIds as string[] },
        isActive: true
      },
      include: { facet: true }
    });
    
    // Group by user
    const facetsByUser = userIds.map(userId =>
      facets.filter(f => f.entityId === userId)
    );
    
    return facetsByUser;
  });
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal**: Set up core infrastructure

- [ ] Create database migrations 
  - [ ] Add `lineManagerId` to User model
  - [ ] Add Facet, FacetAssignment, FacetAssignmentHistory tables
  - [ ] Add PermissionAuditLog table
  - [ ] Add appropriate indexes
- [ ] Implement core type definitions (`src/types/permissions.ts`)
- [ ] Implement core permissions library (`src/lib/permissions.ts`)
- [ ] Implement facet library (`src/lib/facets.ts`)
- [ ] Implement user relations library (`src/lib/userRelations.ts`)
  - [ ] Implement `isAdministratorFor()` with line manager hierarchy
  - [ ] Implement `getDirectReports()`
  - [ ] Implement `getAllReports()`
  - [ ] Add circular reference detection
- [ ] Set up RabbitMQ integration for audit logs
- [ ] Create seed script for initial facets
- [ ] Write unit tests for core libraries
- [ ] Write tests for line management functions

### Phase 2: Authentication & Middleware (Week 2-3)

**Goal**: Integrate with existing auth system

- [ ] Implement auth context builder (`src/middleware/authContext.ts`)
- [ ] Add middleware to attach auth context to requests
- [ ] Update existing auth middleware to work with facets
- [ ] Create facet management routes (`src/routes/facets.ts`)
- [ ] Implement facet admin permissions (`src/auth/facets.ts`)
- [ ] Write integration tests for auth system

### Phase 3: Route-Specific Permissions (Week 3-5)

**Goal**: Implement permissions for each route module

- [ ] Implement media permissions (`src/auth/media.ts`)
  - [ ] Include line manager checks for viewing reports' media
- [ ] Implement post permissions (`src/auth/posts.ts`)
  - [ ] Include line manager checks for viewing reports' posts
- [ ] Implement user permissions (`src/auth/users.ts`)
  - [ ] `canViewUser()` with line manager support
  - [ ] `canUpdateUser()` with appropriate restrictions
  - [ ] `canSetLineManager()` for HR/admin functions
  - [ ] `canViewOrgHierarchy()` for managers
- [ ] Implement group permissions (`src/auth/groups.ts`)
- [ ] Implement comment permissions (`src/auth/comments.ts`)
- [ ] Implement friend permissions (`src/auth/friends.ts`)
- [ ] Implement facet management permissions (`src/auth/facets.ts`)
- [ ] Write comprehensive integration tests for each module
- [ ] Write specific tests for line manager permission scenarios

### Phase 4: Integration with Routes (Week 5-6)

**Goal**: Update existing routes to use new permission system

- [ ] Update `src/routes/media.ts` to use permission checks
- [ ] Update `src/routes/posts.ts` to use permission checks
- [ ] Update `src/routes/users.ts` to use permission checks
  - [ ] Add GET `/api/users/:userId/line-manager` endpoint
  - [ ] Add GET `/api/users/:userId/direct-reports` endpoint
  - [ ] Add GET `/api/users/:userId/reporting-tree` endpoint
  - [ ] Add PUT `/api/users/:userId/line-manager` endpoint
  - [ ] Add circular reference validation
- [ ] Update `src/routes/groups.ts` to use permission checks
- [ ] Update `src/routes/comments.ts` to use permission checks
- [ ] Update `src/routes/friends.ts` to use permission checks
- [ ] Ensure all routes properly handle permission denials
- [ ] Add integration tests for line manager routes

### Phase 5: Migration & Cleanup (Week 7)

**Goal**: Migrate existing permissions and clean up old code

- [ ] Run migration script to convert existing permissions to facets
- [ ] Update existing tests to work with new permission system
- [ ] Add audit logging to all sensitive operations
- [ ] Create admin UI for facet management (frontend)
- [ ] Document API changes for frontend team
- [ ] Deploy to staging environment for testing

### Phase 6: Performance & Optimization (Week 8)

**Goal**: Optimize for production use

- [ ] Implement Redis caching for facet lookups
- [ ] Implement DataLoader for batch queries
- [ ] Add database indexes for optimal query performance
- [ ] Implement audit worker for async log processing
- [ ] Performance testing and benchmarking
- [ ] Set up monitoring and alerting for permission system

### Phase 7: Advanced Features (Week 9-10)

**Goal**: Add advanced functionality

- [ ] Implement facet hierarchy checks
- [ ] Add facet expiry and review reminders (cron job)
- [ ] Create admin reports for facet usage
- [ ] Implement permission introspection endpoints ("Why was I denied?")
- [ ] Add bulk facet assignment tools
- [ ] Create audit log viewer UI
- [ ] Line management features:
  - [ ] Organizational chart visualization (frontend)
  - [ ] Manager delegation capabilities
  - [ ] Bulk line manager updates (org restructuring)
  - [ ] Line manager change notifications
  - [ ] Reporting structure analytics

### Phase 8: Production Deployment (Week 10-11)

**Goal**: Deploy to production safely

- [ ] Code review and security audit
- [ ] Load testing with production-like data
- [ ] Create runbook for common issues
- [ ] Train support team on new permission system
- [ ] Gradual rollout with feature flags
- [ ] Monitor for issues and gather feedback

---

## Success Metrics

1. **Security**: All sensitive operations have permission checks with audit logs
2. **Performance**: Permission checks add < 50ms to request latency (95th percentile)
   - Line manager hierarchy traversal < 20ms for 10-level deep hierarchies
3. **Correctness**: Zero unauthorized access incidents after deployment
4. **Completeness**: 100% of routes have appropriate permission checks
5. **Auditability**: All facet assignments and sensitive operations are logged
6. **Maintainability**: New route modules can add permissions without touching core code
7. **Line Management**: 
   - Circular reference detection prevents invalid organizational structures
   - Org chart queries complete in < 100ms for organizations up to 1000 users
   - Manager permissions correctly cascade through reporting hierarchies

---

## Risk Mitigation

### Risk 1: Performance Degradation
**Mitigation**: Extensive caching, query optimization, batch operations

### Risk 2: Permission Bypass
**Mitigation**: Comprehensive test coverage, security audit, fail-closed design

### Risk 3: Complex Implementation
**Mitigation**: Phased rollout, clear documentation, extensive examples

### Risk 4: Breaking Existing Functionality
**Mitigation**: Maintain backward compatibility, feature flags, gradual migration

### Risk 5: Audit Log Volume
**Mitigation**: Async processing via RabbitMQ, selective auditing, log rotation

---

## Conclusion

This implementation plan provides a comprehensive, production-ready facets and permissions system that:

1. **Separates concerns** between identity (facets) and capabilities (permissions)
2. **Provides full auditability** for compliance and security
3. **Scales efficiently** with caching and optimization
4. **Integrates cleanly** with existing codebase
5. **Supports complex use cases** like organizational hierarchies and corporate structures
6. **Maintains security** with fail-closed design and comprehensive testing
7. **Enables line management** through native organizational hierarchy support
   - Direct manager-employee relationships via `lineManagerId`
   - Transitive management checks up the hierarchy
   - Circular reference protection
   - Efficient queries for org charts and reporting trees
   - Manager-based permissions for viewing reports' content

The phased approach ensures steady progress with minimal risk to existing functionality. Line management integration is built into the core of the system from day one, ensuring that organizational hierarchies are a first-class concept rather than an afterthought.

### Key Design Decisions

**Line Management Implementation**: Uses a simple self-referencing foreign key (`lineManagerId`) on the User table rather than a complex many-to-many relationship or separate organizational unit tables. This provides:
- Simple, clear semantics (each user has at most one line manager)
- Easy to query and traverse
- Straightforward to validate (circular reference checks)
- Can be extended later with additional organizational models (divisions, departments) if needed

**Facets vs. Line Management**: Facets describe *what* a user is (their role, capabilities, memberships), while line management describes *who* they report to. Both work together in permission checks, but they serve different purposes and are stored differently for optimal performance and clarity.

