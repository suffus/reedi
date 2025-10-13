# Route Integration Examples

This document provides concrete examples of how to integrate the new permission system into your existing routes.

## Table of Contents
1. [Media Routes Integration](#media-routes-integration)
2. [Post Routes Integration](#post-routes-integration)
3. [User Routes Integration](#user-routes-integration)
4. [Integration Pattern Summary](#integration-pattern-summary)

---

## Media Routes Integration

### Example 1: Get Single Media Item

**Location:** `src/routes/media.ts`

**Before:**
```typescript
router.get('/:mediaId', async (req, res) => {
  const media = await prisma.media.findUnique({
    where: { id: req.params.mediaId },
    include: { author: true }
  });
  
  if (!media) {
    return res.status(404).json({ error: 'Media not found' });
  }
  
  res.json({ media });
});
```

**After:**
```typescript
import { getAuthContext } from '../middleware/authContext';
import { canDoMediaRead } from '../auth/media';
import { safePermissionCheck, auditPermission } from '../lib/permissions';

router.get('/:mediaId', async (req, res) => {
  const auth = getAuthContext(req);
  
  const media = await prisma.media.findUnique({
    where: { id: req.params.mediaId },
    include: { author: true }
  });
  
  if (!media) {
    return res.status(404).json({ error: 'Media not found' });
  }
  
  // Check permission
  const canRead = await safePermissionCheck(
    () => canDoMediaRead(auth, media),
    'media-read'
  );
  
  // Audit sensitive media access (e.g., private media)
  if (media.visibility !== 'PUBLIC') {
    await auditPermission(canRead, auth, 'MEDIA', {
      shouldAudit: true,
      auditSensitive: true,
      asyncAudit: true
    });
  }
  
  if (!canRead.granted) {
    return res.status(403).json({ 
      error: 'Access denied', 
      reason: canRead.reason 
    });
  }
  
  res.json({ media });
});
```

### Example 2: List User's Media

**Before:**
```typescript
router.get('/user/:userId', async (req, res) => {
  const media = await prisma.media.findMany({
    where: { authorId: req.params.userId },
    include: { author: true }
  });
  
  res.json({ media });
});
```

**After:**
```typescript
import { getAuthContext } from '../middleware/authContext';
import { filterReadableMedia } from '../auth/media';

router.get('/user/:userId', async (req, res) => {
  const auth = getAuthContext(req);
  
  const media = await prisma.media.findMany({
    where: { authorId: req.params.userId },
    include: { author: true }
  });
  
  // Filter to only media the requesting user can see
  const viewableMedia = await filterReadableMedia(auth, media);
  
  res.json({ media: viewableMedia });
});
```

### Example 3: Delete Media

**Before:**
```typescript
router.delete('/:mediaId', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  
  const media = await prisma.media.findUnique({
    where: { id: req.params.mediaId }
  });
  
  if (!media) {
    return res.status(404).json({ error: 'Media not found' });
  }
  
  if (media.authorId !== userId) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  await prisma.media.delete({ where: { id: media.id } });
  res.json({ message: 'Media deleted' });
});
```

**After:**
```typescript
import { getAuthContext } from '../middleware/authContext';
import { canDoMediaDelete } from '../auth/media';
import { safePermissionCheck, auditPermission } from '../lib/permissions';

router.delete('/:mediaId', authMiddleware, async (req, res) => {
  const auth = getAuthContext(req);
  
  const media = await prisma.media.findUnique({
    where: { id: req.params.mediaId }
  });
  
  if (!media) {
    return res.status(404).json({ error: 'Media not found' });
  }
  
  // Check permission
  const canDelete = await safePermissionCheck(
    () => canDoMediaDelete(auth, media),
    'media-delete'
  );
  
  // Always audit delete operations
  await auditPermission(canDelete, auth, 'MEDIA', {
    shouldAudit: true,
    auditSensitive: true,
    asyncAudit: true
  });
  
  if (!canDelete.granted) {
    return res.status(403).json({ 
      error: 'Access denied', 
      reason: canDelete.reason 
    });
  }
  
  await prisma.media.delete({ where: { id: media.id } });
  res.json({ message: 'Media deleted' });
});
```

---

## Post Routes Integration

### Example 4: Get Post Feed

**Before:**
```typescript
router.get('/feed', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  
  const posts = await prisma.post.findMany({
    where: {
      OR: [
        { visibility: 'PUBLIC' },
        { authorId: userId }
      ]
    },
    include: { author: true },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  
  res.json({ posts });
});
```

**After:**
```typescript
import { getAuthContext } from '../middleware/authContext';
import { filterReadablePosts } from '../auth/posts';

router.get('/feed', authMiddleware, async (req, res) => {
  const auth = getAuthContext(req);
  
  // Fetch all potentially visible posts
  const posts = await prisma.post.findMany({
    where: {
      publicationStatus: 'PUBLIC'
    },
    include: { author: true },
    orderBy: { createdAt: 'desc' },
    take: 100 // Fetch more since we'll filter
  });
  
  // Filter based on permissions (PUBLIC, FRIENDS_ONLY, etc.)
  const viewablePosts = await filterReadablePosts(auth, posts);
  
  // Take first 50 after filtering
  res.json({ posts: viewablePosts.slice(0, 50) });
});
```

### Example 5: Create Locked Post

**Before:**
```typescript
router.post('/', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { content, isLocked } = req.body;
  
  if (isLocked) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.canPublishLockedMedia) {
      return res.status(403).json({ error: 'Cannot create locked posts' });
    }
  }
  
  const post = await prisma.post.create({
    data: {
      content,
      isLocked,
      authorId: userId,
      // ... other fields
    }
  });
  
  res.json({ post });
});
```

**After:**
```typescript
import { getAuthContext } from '../middleware/authContext';
import { canDoPostCreate, canCreateLockedPost } from '../auth/posts';
import { safePermissionCheck, auditPermission } from '../lib/permissions';

router.post('/', authMiddleware, async (req, res) => {
  const auth = getAuthContext(req);
  const { content, isLocked } = req.body;
  
  // Check basic create permission
  const canCreate = await safePermissionCheck(
    () => canDoPostCreate(auth),
    'post-create'
  );
  
  if (!canCreate.granted) {
    return res.status(403).json({ error: canCreate.reason });
  }
  
  // Check locked post permission if needed
  if (isLocked) {
    const canCreateLocked = await safePermissionCheck(
      () => canCreateLockedPost(auth),
      'post-create-locked'
    );
    
    // Audit locked post attempts
    await auditPermission(canCreateLocked, auth, 'POST', {
      shouldAudit: true,
      auditSensitive: true,
      asyncAudit: true
    });
    
    if (!canCreateLocked.granted) {
      return res.status(403).json({ 
        error: 'Cannot create locked posts', 
        reason: canCreateLocked.reason 
      });
    }
  }
  
  const post = await prisma.post.create({
    data: {
      content,
      isLocked,
      authorId: auth.userId!,
      // ... other fields
    }
  });
  
  res.json({ post });
});
```

---

## User Routes Integration

### Example 6: View User Profile

**Before:**
```typescript
router.get('/:userId', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: {
      id: true,
      name: true,
      username: true,
      bio: true,
      isPrivate: true,
      // ... other fields
    }
  });
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({ user });
});
```

**After:**
```typescript
import { getAuthContext } from '../middleware/authContext';
import { canViewUser } from '../auth/users';
import { safePermissionCheck } from '../lib/permissions';

router.get('/:userId', async (req, res) => {
  const auth = getAuthContext(req);
  
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: {
      id: true,
      name: true,
      username: true,
      bio: true,
      isPrivate: true,
      email: true,
      // ... other fields
    }
  });
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Check permission
  const canView = await safePermissionCheck(
    () => canViewUser(auth, user as any),
    'user-view'
  );
  
  if (!canView.granted) {
    return res.status(403).json({ 
      error: 'Access denied', 
      reason: canView.reason 
    });
  }
  
  // Optionally filter sensitive fields based on permission
  const sanitizedUser = {
    ...user,
    // Hide email unless it's own profile or admin
    email: (auth.userId === user.id || canView.reasonCode === 'GLOBAL_ADMIN') 
      ? user.email 
      : undefined
  };
  
  res.json({ user: sanitizedUser });
});
```

### Example 7: Add Line Manager Endpoints

**New Routes to Add:**

```typescript
import { getAuthContext } from '../middleware/authContext';
import { 
  canViewLineManager, 
  canViewDirectReports, 
  canSetLineManager 
} from '../auth/users';
import { 
  getDirectReports, 
  getAllReports,
  checkForCircularReference 
} from '../lib/userRelations';
import { safePermissionCheck, auditPermission } from '../lib/permissions';

/**
 * GET /api/users/:userId/line-manager
 * Get a user's line manager
 */
router.get('/:userId/line-manager', authMiddleware, async (req, res) => {
  const auth = getAuthContext(req);
  const { userId } = req.params;
  
  const canView = await safePermissionCheck(
    () => canViewLineManager(auth, userId),
    'user-view-line-manager'
  );
  
  if (!canView.granted) {
    return res.status(403).json({ error: canView.reason });
  }
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
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
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({ lineManager: user.lineManager });
});

/**
 * GET /api/users/:userId/direct-reports
 * Get a manager's direct reports
 */
router.get('/:userId/direct-reports', authMiddleware, async (req, res) => {
  const auth = getAuthContext(req);
  const { userId } = req.params;
  
  const canView = await safePermissionCheck(
    () => canViewDirectReports(auth, userId),
    'user-view-direct-reports'
  );
  
  if (!canView.granted) {
    return res.status(403).json({ error: canView.reason });
  }
  
  const reportIds = await getDirectReports(userId);
  
  const reports = await prisma.user.findMany({
    where: { id: { in: reportIds } },
    select: {
      id: true,
      name: true,
      username: true,
      email: true
    }
  });
  
  res.json({ reports });
});

/**
 * PUT /api/users/:userId/line-manager
 * Set or update a user's line manager
 */
router.put('/:userId/line-manager', authMiddleware, async (req, res) => {
  const auth = getAuthContext(req);
  const { userId } = req.params;
  const { lineManagerId } = req.body;
  
  const canSet = await safePermissionCheck(
    () => canSetLineManager(auth, userId, lineManagerId),
    'user-set-line-manager'
  );
  
  // Always audit line manager changes
  await auditPermission(canSet, auth, 'USER', {
    shouldAudit: true,
    auditSensitive: true,
    asyncAudit: true
  });
  
  if (!canSet.granted) {
    return res.status(403).json({ error: canSet.reason });
  }
  
  // Check for circular references if setting a manager
  if (lineManagerId) {
    const wouldCreateCycle = await checkForCircularReference(userId, lineManagerId);
    if (wouldCreateCycle) {
      return res.status(400).json({ 
        error: 'Cannot set line manager: would create circular reference' 
      });
    }
  }
  
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { lineManagerId: lineManagerId || null },
    include: {
      lineManager: {
        select: {
          id: true,
          name: true,
          username: true
        }
      }
    }
  });
  
  res.json({ 
    message: 'Line manager updated', 
    user: updatedUser 
  });
});

/**
 * GET /api/users/:userId/reporting-tree
 * Get the full reporting tree for a manager
 */
router.get('/:userId/reporting-tree', authMiddleware, async (req, res) => {
  const auth = getAuthContext(req);
  const { userId } = req.params;
  
  const canView = await safePermissionCheck(
    () => canViewDirectReports(auth, userId),
    'user-view-reporting-tree'
  );
  
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
      lineManagerId: true
    }
  });
  
  res.json({ reports });
});
```

---

## Integration Pattern Summary

### Step-by-Step Integration Process

1. **Import required functions at the top of the route file:**
```typescript
import { getAuthContext } from '../middleware/authContext';
import { canDoX, canDoY } from '../auth/resourceType';
import { safePermissionCheck, auditPermission } from '../lib/permissions';
```

2. **Extract auth context at the start of your route handler:**
```typescript
const auth = getAuthContext(req);
```

3. **Fetch the resource (if checking against a specific item):**
```typescript
const resource = await prisma.resource.findUnique({
  where: { id: req.params.id },
  include: { author: true } // Include author for permission checks
});
```

4. **Perform permission check:**
```typescript
const canPerformAction = await safePermissionCheck(
  () => canDoAction(auth, resource),
  'resource-action'
);
```

5. **Audit sensitive operations:**
```typescript
if (/* sensitive operation */) {
  await auditPermission(canPerformAction, auth, 'RESOURCE_TYPE', {
    shouldAudit: true,
    auditSensitive: true,
    asyncAudit: true
  });
}
```

6. **Check result and respond:**
```typescript
if (!canPerformAction.granted) {
  return res.status(403).json({ 
    error: 'Access denied', 
    reason: canPerformAction.reason 
  });
}

// Proceed with operation
```

### Quick Reference Table

| Operation | Permission Function | Audit? | Filter Helper |
|-----------|-------------------|--------|---------------|
| Read Media | `canDoMediaRead` | For private media | `filterReadableMedia` |
| Update Media | `canDoMediaUpdate` | Yes | - |
| Delete Media | `canDoMediaDelete` | Yes | - |
| Read Post | `canDoPostRead` | For private posts | `filterReadablePosts` |
| Create Post | `canDoPostCreate` | No | - |
| Create Locked Post | `canCreateLockedPost` | Yes | - |
| View User | `canViewUser` | For private profiles | - |
| Update User | `canUpdateUser` | Yes | - |
| Set Line Manager | `canSetLineManager` | Yes | - |
| View Line Manager | `canViewLineManager` | No | - |
| Assign Facet | `canAssignFacet` | Yes | - |
| Revoke Facet | `canRevokeFacet` | Yes | - |

### When to Audit

Always audit these operations:
- ✅ Deletes (media, posts, users)
- ✅ Updates to user profiles
- ✅ Line manager changes
- ✅ Facet assignments/revocations
- ✅ Access to private/sensitive content
- ✅ Failed permission checks for sensitive operations

Don't need to audit:
- ❌ Public content reads
- ❌ Own profile views
- ❌ List endpoints with filtering

---

## Ready to Integrate!

Start with one route file at a time:
1. ✅ Add imports
2. ✅ Update route handlers
3. ✅ Test with different user roles
4. ✅ Verify audit logs are created
5. ✅ Move to next route file

For questions or issues, refer to `/backend/PHASE_2_COMPLETE.md`.

