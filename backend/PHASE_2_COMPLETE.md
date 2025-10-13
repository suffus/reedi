# Phase 2: Authentication & Permission Framework - COMPLETE ✅

## Summary

Phase 2 is complete! We now have a comprehensive permission system with route-specific auth modules that can be integrated into your existing routes.

## What Was Built

### 1. ✅ Authentication Context Middleware (`src/middleware/authContext.ts`)

Extracts authentication context from requests:
```typescript
import { getAuthContext } from '../middleware/authContext';

// In your route
const auth = getAuthContext(req);
// Now you have: auth.user, auth.userId, auth.ipAddress, auth.userAgent, auth.requestId
```

**Key Features:**
- Extracts user from `req.user` (set by your existing auth middleware)
- Captures IP address, user agent, session ID for audit trails
- Generates unique request ID if not present
- Can be used as middleware: `router.use(attachAuthContext())`

### 2. ✅ Media Permissions (`src/auth/media.ts`)

**Functions:**
- `canDoMediaRead(auth, media)` - Check read access (PUBLIC, FRIENDS_ONLY, PRIVATE)
- `canDoMediaUpdate(auth, media)` - Check update access (owner, admin)
- `canDoMediaDelete(auth, media)` - Check delete access (owner, admin)
- `canDoMediaCreate(auth)` - Check if user can upload media
- `filterReadableMedia(auth, mediaList)` - Filter array to viewable items

**Permission Rules:**
- ✅ Public media visible to all
- ✅ Private media only to owner
- ✅ Friends-only media to friends
- ✅ Line managers can see reports' media
- ✅ Divisional admins can see same-division media
- ✅ Global admins can see all

### 3. ✅ Post Permissions (`src/auth/posts.ts`)

**Functions:**
- `canDoPostRead(auth, post)` - Check read access
- `canDoPostCreate(auth)` - Check if can create posts
- `canCreateLockedPost(auth)` - Check if can create premium content
- `canDoPostUpdate(auth, post)` - Check update access
- `canDoPostDelete(auth, post)` - Check delete access (includes moderator)
- `filterReadablePosts(auth, posts)` - Filter array

**Permission Rules:**
- ✅ Public posts visible to all
- ✅ Friends-only posts to friends
- ✅ Locked posts require `feature-access:locked-posts` facet
- ✅ Line managers can read reports' posts
- ✅ Moderators can delete posts

### 4. ✅ User Permissions (`src/auth/users.ts`)

**Functions:**
- `canViewUser(auth, user)` - Check profile view access
- `canUpdateUser(auth, user)` - Check profile update access
- `canSetLineManager(auth, targetUserId, newManagerId)` - HR function
- `canViewOrgHierarchy(auth)` - Check org chart access
- `canViewLineManager(auth, userId)` - Check line manager view
- `canViewDirectReports(auth, managerId)` - Check reports view

**Permission Rules:**
- ✅ Public profiles visible to all
- ✅ Private profiles to friends, line managers, HR, admins
- ✅ Line managers can view reports' profiles
- ✅ HR can manage org structure
- ✅ Users can view their own line manager and reports

### 5. ✅ Facet Management Permissions (`src/auth/facets.ts`)

**Functions:**
- `canAssignFacet(auth, userId, facet)` - Check facet assignment
- `canRevokeFacet(auth, userId, facet)` - Check facet revocation
- `canViewFacetHistory(auth, userId)` - Check history access
- `canViewFacetDefinitions(auth)` - Check definitions view
- `canViewUserFacets(auth, userId)` - Check user facets view

**Permission Rules:**
- ✅ Global facet admins can assign/revoke any facet
- ✅ HR can assign org-division and org-department facets
- ✅ Divisional admins can assign org-division facets
- ✅ Managers can assign non-admin role facets
- ✅ Users can view their own facets and history

### 6. ✅ Facet Management Routes (`src/routes/facets.ts`)

**New API Endpoints:**

```
GET  /api/facets/definitions          - List all facet definitions
GET  /api/facets/user/:userId         - Get user's facets
POST /api/facets/assign               - Assign facet to user
POST /api/facets/revoke               - Revoke facet from user
GET  /api/facets/history/:userId      - Get facet assignment history
```

**Features:**
- ✅ Full permission checks on all endpoints
- ✅ Automatic audit logging for sensitive operations
- ✅ Error handling with proper status codes
- ✅ Input validation
- ✅ Uses `safePermissionCheck` for fail-closed security

## How to Integrate Into Existing Routes

### Example: Adding Permission Check to Media Route

**Before:**
```typescript
// src/routes/media.ts
router.get('/user/:userId', async (req, res) => {
  const media = await prisma.media.findMany({
    where: { authorId: req.params.userId }
  });
  res.json({ media });
});
```

**After:**
```typescript
// src/routes/media.ts
import { getAuthContext } from '../middleware/authContext';
import { filterReadableMedia } from '../auth/media';

router.get('/user/:userId', async (req, res) => {
  const auth = getAuthContext(req);
  
  const media = await prisma.media.findMany({
    where: { authorId: req.params.userId },
    include: { author: true } // Include for permission checks
  });
  
  // Filter to only media the user can see
  const viewableMedia = await filterReadableMedia(auth, media);
  
  res.json({ media: viewableMedia });
});
```

### Example: Checking Single Item Permission

```typescript
// src/routes/media.ts
import { getAuthContext } from '../middleware/authContext';
import { canDoMediaDelete } from '../auth/media';
import { safePermissionCheck, auditPermission } from '../lib/permissions';

router.delete('/:mediaId', async (req, res) => {
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
  
  // Audit the decision
  await auditPermission(canDelete, auth, 'MEDIA', {
    shouldAudit: true,
    auditSensitive: true,
    asyncAudit: true
  });
  
  if (!canDelete.granted) {
    return res.status(403).json({ error: canDelete.reason });
  }
  
  // Permission granted, proceed with delete
  await prisma.media.delete({ where: { id: media.id } });
  res.json({ message: 'Media deleted' });
});
```

## Next Steps: Integration Checklist

### Phase 2.7: Integrate Into Existing Routes

**Media Routes** (`src/routes/media.ts`):
- [ ] Add `canDoMediaRead` checks to GET endpoints
- [ ] Add `canDoMediaUpdate` checks to PUT/PATCH endpoints
- [ ] Add `canDoMediaDelete` checks to DELETE endpoints
- [ ] Use `filterReadableMedia` for list endpoints

**Post Routes** (`src/routes/posts.ts`):
- [ ] Add `canDoPostRead` checks to GET endpoints
- [ ] Add `canDoPostUpdate` checks to PUT/PATCH endpoints
- [ ] Add `canDoPostDelete` checks to DELETE endpoints
- [ ] Add `canCreateLockedPost` check for locked posts
- [ ] Use `filterReadablePosts` for feed endpoints

**User Routes** (`src/routes/users.ts`):
- [ ] Add `canViewUser` checks to profile endpoints
- [ ] Add `canUpdateUser` checks to update endpoints
- [ ] Add line manager endpoints (see below)

### New Line Manager Endpoints to Add

Add these to `src/routes/users.ts`:

```typescript
GET  /api/users/:userId/line-manager        - Get user's manager
GET  /api/users/:userId/direct-reports      - Get manager's direct reports
GET  /api/users/:userId/reporting-tree      - Get full reporting tree
PUT  /api/users/:userId/line-manager        - Set/update line manager
```

See implementation examples in `/backend/FACETS_PERMISSIONS_IMPLEMENTATION_PLAN.md` lines 1722-1943.

## Register Facets Route

Add to `src/index.ts`:

```typescript
import facetsRouter from './routes/facets';

// After other routes
app.use('/api/facets', facetsRouter);
```

## Testing the System

### 1. Test Facet Assignment

```bash
# Assign global admin facet to a user
curl -X POST http://localhost:3000/api/facets/assign \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "facet": "reedi-admin:global",
    "reason": "Promoted to admin"
  }'
```

### 2. Test Permission Checks

```typescript
// In your test file
import { canDoMediaRead } from '../src/auth/media';

const result = await canDoMediaRead(auth, media);
expect(result.granted).toBe(true);
expect(result.reasonCode).toBe('OWNER');
```

### 3. Test Line Management

```bash
# Set line manager
curl -X PUT http://localhost:3000/api/users/USER_ID/line-manager \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lineManagerId": "MANAGER_ID"}'
```

## Architecture

```
Request
  ↓
Existing Auth Middleware (sets req.user)
  ↓
getAuthContext(req) → Authentication object
  ↓
Route Handler
  ↓
Permission Check (canDoMediaRead, etc.)
  ├→ Uses userHasFacet() to check facets
  ├→ Uses isAdministratorFor() for line management
  ├→ Uses isFriendsWith() for social features
  └→ Returns PermissionResult
  ↓
auditPermission() → Logs to RabbitMQ/DB
  ↓
If granted: Process request
If denied: Return 403
```

## Key Benefits

1. **Centralized Logic**: All permission rules in one place per resource type
2. **Auditable**: Every permission decision can be logged
3. **Testable**: Pure functions easy to unit test
4. **Composable**: Build complex permissions from simple checks
5. **Fail-Closed**: Errors always result in denial, never accidental access
6. **Line Management**: Built-in support for organizational hierarchies
7. **Facet-Based**: Flexible role/attribute system

## Files Created

```
src/
├── middleware/
│   └── authContext.ts          ✅ Auth context extraction
├── auth/
│   ├── media.ts                ✅ Media permissions
│   ├── posts.ts                ✅ Post permissions
│   ├── users.ts                ✅ User & line manager permissions
│   └── facets.ts               ✅ Facet management permissions
└── routes/
    └── facets.ts               ✅ Facet management API
```

## What's Next

Choose one:
1. **Start Integration**: Add permission checks to existing media/posts/users routes
2. **Add More Auth Modules**: Create `src/auth/groups.ts`, `src/auth/comments.ts`, etc.
3. **Write Integration Tests**: Test the full permission flow
4. **Build Admin UI**: Frontend for facet management

Ready to integrate! 🚀

