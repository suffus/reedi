import { prisma } from '../db';
import { getFacetValue } from './facets';

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
  const [user1Division, user2Division] = await Promise.all([
    getFacetValue('USER', userId1, 'org-division', 'division'),
    getFacetValue('USER', userId2, 'org-division', 'division')
  ]);
  
  if (!user1Division || !user2Division) return false;
  return user1Division === user2Division;
}

/**
 * Check if setting lineManagerId for userId would create a circular reference
 * Returns true if it would create a cycle (and should be prevented)
 */
export async function checkForCircularReference(
  userId: string,
  newLineManagerId: string
): Promise<boolean> {
  if (userId === newLineManagerId) return true; // Self-reference
  
  // Check if newLineManager is already a subordinate of userId
  // If so, setting userId's manager to newLineManager would create a cycle
  const allReports = await getAllReports(userId);
  
  return allReports.includes(newLineManagerId);
}

