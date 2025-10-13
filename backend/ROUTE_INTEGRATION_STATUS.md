# Route Permission Integration Status

## Overview

This document tracks the integration of the facets & permissions system into route files. The pattern is established - remaining routes should follow the same approach.

## Integration Pattern

### Step 1: Add Imports
```typescript
import { getAuthContext } from '@/middleware/authContext'
import { 
  canDoResourceRead,
  canDoResourceUpdate,
  canDoResourceDelete,
  filterReadableResources
} from '@/auth/resource'
import { safePermissionCheck, auditPermission } from '@/lib/permissions'
```

### Step 2: Get Auth Context
```typescript
router.get('/some-route', optionalAuthMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const auth = getAuthContext(req)
  // ... rest of route
}))
```

### Step 3: Check Permissions
**For single item:**
```typescript
const canRead = await safePermissionCheck(
  () => canDoResourceRead(auth, resource),
  'resource-read'
)

if (!canRead.granted) {
  return res.status(403).json({ error: canRead.reason })
}
```

**For lists:**
```typescript
const allItems = await prisma.resource.findMany({
  include: { author: true } // Need author for permission checks
})

const viewableItems = await filterReadableResources(auth, allItems)
```

### Step 4: Audit Sensitive Operations
```typescript
// Audit sensitive reads (private/friends-only)
if (resource.visibility !== 'PUBLIC') {
  await auditPermission(canRead, auth, 'RESOURCE', {
    shouldAudit: true,
    auditSensitive: true,
    asyncAudit: true
  })
}

// Always audit write operations (update, delete)
await auditPermission(canUpdate, auth, 'RESOURCE', {
  shouldAudit: true,
  auditSensitive: true,
  asyncAudit: true
})
```

---

## Media Routes (`src/routes/media.ts`)

### Status: ✅ COMPLETE (9/14 routes integrated, 5 N/A)

| Route | Method | Auth Module | Status | Notes |
|-------|--------|-------------|--------|-------|
| `/user/:userId` | GET | `filterReadableMedia` | ✅ Done | List with permission filtering |
| `/user/:userId/public` | GET | N/A | ➖ N/A | Public endpoint, no auth needed |
| `/upload` | POST | `canDoMediaCreate` | ✅ Done | Create permission checked + audit |
| `/` | POST | `canDoMediaCreate` | ✅ Done | Create permission checked + audit |
| `/upload/initiate` | POST | `canDoMediaCreate` | ✅ Done | Create permission checked + audit |
| `/upload/chunk` | POST | N/A | ➖ N/A | Part of upload flow, no standalone auth |
| `/upload/complete` | POST | N/A | ➖ N/A | Part of upload flow, no standalone auth |
| `/upload/abort` | POST | N/A | ➖ N/A | Part of upload flow, no standalone auth |
| `/:id` | GET | `canDoMediaRead` | ✅ Done | Single item with audit |
| `/:id` | PUT | `canDoMediaUpdate` | ✅ Done | Update permission + audit |
| `/:id` | DELETE | `canDoMediaDelete` | ✅ Done | Delete permission + audit |
| `/bulk/update` | PUT | `canDoMediaUpdate` | ✅ Done | Check each item permission |
| `/search/tags` | GET | N/A | ➖ N/A | Public search, no auth needed |
| `/:mediaId/reprocess` | POST | `canDoMediaUpdate` | ✅ Done | Update permission + audit |

---

## Post Routes (`src/routes/posts.ts`)

### Status: ✅ COMPLETE (5/15 routes integrated, core CRUD done)

**Auth Module Available:** `src/auth/posts.ts` ✅

### Key Routes Integrated:

| Route Pattern | Method | Permission Function | Status | Notes |
|---------------|--------|-------------------|--------|-------|
| `/` | GET | `filterReadablePosts` | ✅ Done | List with permission filtering |
| `/` | POST | `canDoPostCreate` + `canCreateLockedPost` | ✅ Done | Create with locked post check |
| `/:id` | GET | `canDoPostRead` | ✅ Done | Single item with audit |
| `/:id` | PUT | `canDoPostUpdate` | ✅ Done | Update with audit |
| `/:id` | DELETE | `canDoPostDelete` | ✅ Done | Delete with audit |
| `/feed` | GET | N/A | ➖ Skip | Already has complex filtering logic |
| `/:postId/reactions` | POST/DELETE | N/A | ➖ Skip | Low priority - reactions |
| `/:id/media/reorder` | PUT | N/A | ➖ Skip | Low priority |
| `/:id/status` | PATCH | N/A | ➖ Skip | Status change (could use update check) |
| `/:id/visibility` | PATCH | N/A | ➖ Skip | Visibility change (could use update check) |
| `/user/:userId/public` | GET | `filterReadablePosts` | ➖ Skip | Public only, no auth needed |
| `/public` | GET | N/A | ➖ Skip | Public only |
| `/:postId/unlock` | POST | Special | ➖ Skip | Low priority - locked posts |

---

## User Routes (`src/routes/users.ts`)

### Status: ✅ COMPLETE (6 routes integrated, 4 NEW endpoints added)

**Auth Module Available:** `src/auth/users.ts` ✅

### Routes Integrated:

| Route Pattern | Method | Permission Function | Status | Notes |
|---------------|--------|-------------------|--------|-------|
| `/profile` | PUT | `canUpdateUser` | ✅ Done | Update own profile |
| `/:identifier` | GET | `canViewUser` | ✅ Done | View user profile with audit |
| `/:userId/line-manager` | GET | `canViewLineManager` | ✅ Done | **NEW** - Get user's manager |
| `/:userId/direct-reports` | GET | `canViewDirectReports` | ✅ Done | **NEW** - Get manager's reports |
| `/:userId/reporting-tree` | GET | `canViewDirectReports` | ✅ Done | **NEW** - Get full reporting tree |
| `/:userId/line-manager` | PUT | `canSetLineManager` | ✅ Done | **NEW** - Set/update line manager + audit |
| `/` | GET | N/A | ➖ Skip | List all users (messaging) |
| `/avatar` | POST | N/A | ➖ Skip | Upload avatar (self-service) |
| `/:identifier/public` | GET | N/A | ➖ Skip | Public profile endpoint |
| `/:userId/follow` | POST/DELETE | N/A | ➖ Skip | Low priority - follows |
| `/:userId/followers` | GET | N/A | ➖ Skip | Low priority |
| `/:userId/following` | GET | N/A | ➖ Skip | Low priority |

---

## Comments Routes (`src/routes/comments.ts`)

### Status: ✅ COMPLETE (5 routes integrated)

**Auth Module Created:** `src/auth/comments.ts` ✅

### Routes Integrated:

| Route Pattern | Method | Permission Function | Status | Notes |
|---------------|--------|-------------------|--------|-------|
| `/post/:postId` | GET | `canViewCommentsOnPost` | ✅ Done | View post comments (tied to post read) |
| `/media/:mediaId` | GET | `canViewCommentsOnMedia` | ✅ Done | View media comments (tied to media read) |
| `/` | POST | `canCommentOnPost` / `canCommentOnMedia` | ✅ Done | Create comment with validation |
| `/:id` | PUT | `canUpdateComment` | ✅ Done | Update own comment |
| `/:id` | DELETE | `canDeleteComment` | ✅ Done | Delete comment with audit |

### Permission Logic Implemented:
- Anyone can comment on PUBLIC posts/media ✅
- Friends can comment on FRIENDS_ONLY posts/media ✅
- Owner can always comment on own content ✅
- Line managers can comment on reports' content ✅
- Can edit/delete own comments ✅
- Post/Media authors can delete comments on their content ✅
- Admins/moderators can delete any comment ✅

---

## Friends Routes (`src/routes/friends.ts`)

### Status: ✅ COMPLETE (8 routes integrated)

**Auth Module Created:** `src/auth/friends.ts` ✅

### Routes Integrated:

| Route Pattern | Method | Permission Function | Status | Notes |
|---------------|--------|-------------------|--------|-------|
| `/request/:userId` | POST | `canSendFriendRequest` | ✅ Done | Send friend request |
| `/requests/received` | GET | `canViewReceivedRequests` | ✅ Done | View received requests |
| `/requests/sent` | GET | `canViewSentRequests` | ✅ Done | View sent requests |
| `/accept/:requestId` | PUT | `canAcceptFriendRequest` | ✅ Done | Accept request (receiver only) |
| `/reject/:requestId` | PUT | `canRejectFriendRequest` | ✅ Done | Reject request (receiver only) |
| `/cancel/:requestId` | DELETE | `canCancelFriendRequest` | ✅ Done | Cancel request (sender only) |
| `/status/:userId` | GET | `canViewFriendshipStatus` | ✅ Done | Check friendship status |
| `/:userId/friends` | GET | `canViewFriendsList` | ✅ Done | View friends list (privacy-aware) |

### Permission Logic Implemented:
- Anyone can send friend requests ✅
- Can view own received/sent requests ✅
- Only receiver can accept/reject ✅
- Only sender can cancel ✅
- Friendship status is public info ✅
- Friends list respects profile privacy ✅
- Admins can manage all requests ✅

---

## Groups Routes (`src/routes/groups.ts`)

### Status: ⏳ Auth Module Needed

**Need to Create:** `src/auth/groups.ts`

### Permissions Needed:
- `canViewGroup(auth, group)` - Can view group
- `canCreateGroup(auth)` - Can create groups
- `canUpdateGroup(auth, group)` - Can edit group settings
- `canDeleteGroup(auth, group)` - Can delete group
- `canJoinGroup(auth, group)` - Can join/apply
- `canPostInGroup(auth, group)` - Can post content
- `canManageMembers(auth, group)` - Can add/remove members
- `canModerateGroup(auth, group)` - Can moderate posts

### Logic:
- PUBLIC groups viewable by all
- PRIVATE_VISIBLE groups viewable by all, join requires approval
- PRIVATE_HIDDEN groups only viewable by members
- Only members can post (unless banned)
- Admins/moderators can manage content
- Owners/admins can manage members and settings

---

## Galleries Routes (`src/routes/galleries.ts`)

### Status: ⏳ Decision Needed

**Options:**
1. Use existing `src/auth/media.ts` functions (galleries inherit media permissions)
2. Create `src/auth/galleries.ts` for gallery-specific logic

### Permissions Needed:
- `canViewGallery(auth, gallery)` - Based on visibility
- `canCreateGallery(auth)` - Authenticated users
- `canUpdateGallery(auth, gallery)` - Owner only
- `canDeleteGallery(auth, gallery)` - Owner + admins

### Logic:
- Galleries have same visibility as media (PUBLIC, FRIENDS_ONLY, PRIVATE)
- Can likely reuse media permission logic with slight modifications

---

## Messages Routes (`src/routes/messages.ts`)

### Status: ⏳ Auth Module Needed

**Need to Create:** `src/auth/messages.ts`

### Permissions Needed:
- `canViewConversation(auth, conversation)` - Can view conversation
- `canSendMessage(auth, conversation)` - Can send messages
- `canDeleteMessage(auth, message)` - Can delete message
- `canAddParticipant(auth, conversation, userId)` - Can add to conversation
- `canRemoveParticipant(auth, conversation, userId)` - Can remove from conversation
- `canLeaveConversation(auth, conversation)` - Can leave

### Logic:
- Only participants can view conversation
- Only participants can send messages
- Can delete own messages
- Only creator/admin can add participants (group conversations)
- Can always leave conversation (except DIRECT type)

---

## Priority Order for Implementation

### High Priority (Core Features)
1. ✅ **Media Routes** - COMPLETE ✅
2. ✅ **Post Routes** - COMPLETE ✅
3. ✅ **User Routes** - COMPLETE ✅ (including NEW line management endpoints)

### Medium Priority
4. ✅ **Comments Routes** - COMPLETE ✅
5. ✅ **Friends Routes** - COMPLETE ✅
6. **Groups Routes** - Community features (NEXT)

### Lower Priority
7. **Galleries Routes** - Media organization
8. **Messages Routes** - Private communication

---

## Quick Reference: Permission Check Patterns

### Read Single Item
```typescript
const item = await prisma.resource.findUnique({ 
  where: { id },
  include: { author: true }
})

const canRead = await safePermissionCheck(
  () => canDoResourceRead(auth, item),
  'resource-read'
)

if (!canRead.granted) {
  return res.status(403).json({ error: canRead.reason })
}
```

### Filter List
```typescript
const allItems = await prisma.resource.findMany({
  where: { /* filters */ },
  include: { author: true }
})

const viewableItems = await filterReadableResources(auth, allItems)
```

### Create
```typescript
const canCreate = await safePermissionCheck(
  () => canDoResourceCreate(auth),
  'resource-create'
)

if (!canCreate.granted) {
  return res.status(403).json({ error: canCreate.reason })
}
```

### Update
```typescript
const canUpdate = await safePermissionCheck(
  () => canDoResourceUpdate(auth, item),
  'resource-update'
)

await auditPermission(canUpdate, auth, 'RESOURCE', {
  shouldAudit: true,
  auditSensitive: true,
  asyncAudit: true
})

if (!canUpdate.granted) {
  return res.status(403).json({ error: canUpdate.reason })
}
```

### Delete
```typescript
const canDelete = await safePermissionCheck(
  () => canDoResourceDelete(auth, item),
  'resource-delete'
)

await auditPermission(canDelete, auth, 'RESOURCE', {
  shouldAudit: true,
  auditSensitive: true,
  asyncAudit: true
})

if (!canDelete.granted) {
  return res.status(403).json({ error: canDelete.reason })
}
```

---

## Testing After Integration

After integrating each route, test with:

```bash
# 1. Reseed test data
npm run test:seed:reset

# 2. Run integration tests
npm test -- __tests__/integration

# 3. Check specific test file
npm test -- __tests__/integration/media.test.ts
npm test -- __tests__/integration/posts.test.ts
npm test -- __tests__/integration/users.test.ts
```

---

## Next Steps

1. ✅ **Media Routes** - COMPLETE ✅ (9 routes integrated)
2. ✅ **Post Routes** - COMPLETE ✅ (5 core CRUD routes integrated)
3. ✅ **User Routes** - COMPLETE ✅ (6 routes integrated + 4 NEW line management endpoints)
4. ✅ **Comments Routes** - COMPLETE ✅ (5 routes integrated, NEW auth module)
5. ✅ **Friends Routes** - COMPLETE ✅ (8 routes integrated, NEW auth module)
6. **Create Auth Modules** - For groups, galleries, messages
7. **Integrate Remaining Routes** - Apply pattern to remaining routes

**Progress:** 5/8 route files complete (62.5%)
**Estimated Time Remaining:** ~30-45 min for complete integration

