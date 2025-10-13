# Groups Authorization Status

## ✅ Completed

### Permission Functions Created (`src/auth/groups.ts`)

1. **`canViewGroup`** - View group details based on visibility and membership
2. **`canCreateGroup`** - Create new groups (all authenticated users)
3. **`canUpdateGroup`** - Update group settings (Owner, Admin)
4. **`canDeleteGroup`** - Delete group (Owner only)
5. **`canJoinGroup`** - Apply for membership
6. **`canInviteToGroup`** - Invite others (Owner, Admin, Moderator)
7. **`canReviewApplications`** - Review membership applications (Owner, Admin, Moderator)
8. **`canManageMemberRoles`** - Change member roles (Owner, Admin with restrictions)
9. **`canPostToGroup`** - Post content in group (Active members)
10. **`canModerateGroupPosts`** - Approve/reject posts (Owner, Admin, Moderator)
11. **`canViewGroupActivity`** - View activity log (Owner, Admin)
12. **`canRemoveMember`** - Remove or ban members (hierarchical permissions)

### Permission Hierarchy

```
OWNER (highest)
  ↓ Can manage all aspects
ADMIN
  ↓ Can manage moderators and members
MODERATOR
  ↓ Can moderate content and remove members
MEMBER
  ↓ Can participate

Global Admins: Can perform all operations
Platform Moderators: Can moderate content
```

### Key Security Features

- **Hierarchical Role System**: Owners > Admins > Moderators > Members
- **Self-Role Protection**: Users cannot change their own roles
- **Owner Protection**: Owners must transfer ownership before leaving
- **Suspension Checks**: Suspended members cannot post
- **Global Admin Override**: Platform admins can manage all groups

## 🔄 Next Steps: Route Integration

### Routes That Need Permission Integration

#### 1. **Group Management**
- `POST /` - Use `canCreateGroup`
- `GET /:identifier` - Use `canViewGroup` 
- `PUT /:groupIdentifier` - Use `canUpdateGroup`
- DELETE (if exists) - Use `canDeleteGroup`

#### 2. **Membership Management**
- `POST /:groupIdentifier/apply` - Use `canJoinGroup`
- `GET /:groupIdentifier/applications` - Use `canReviewApplications`
- `PUT /:groupIdentifier/applications/:applicationId` - Use `canReviewApplications`
- `POST /:groupIdentifier/invite` - Use `canInviteToGroup`
- `POST /invitations/:inviteCode/accept` - (minimal check - user accepting invite)
- `GET /:groupIdentifier/members` - Use `canViewGroup` (members list part of group)
- `PUT /:groupIdentifier/members/:memberId/role` - Use `canManageMemberRoles`
- DELETE `/members/:memberId` (if exists) - Use `canRemoveMember`

#### 3. **Content Management**
- `POST /:groupIdentifier/posts` - Use `canPostToGroup`
- `PUT /:groupIdentifier/posts/:postId/approve` - Use `canModerateGroupPosts`
- `PUT /:groupIdentifier/posts/:postId/moderate` - Use `canModerateGroupPosts`
- `GET /:groupIdentifier/feed` - Use `canViewGroup` (viewing requires membership for private groups)

#### 4. **Administration**
- `GET /:groupIdentifier/activity` - Use `canViewGroupActivity`

#### 5. **Discovery (Public Routes - No Auth Required)**
- `GET /public` - No auth needed
- `GET /search` - Currently authenticated, but could allow public search of public groups
- `GET /user/:userId` - User's groups list (privacy based on relationship)

## Integration Pattern

```typescript
// Example: Update group route
router.put('/:groupIdentifier', authMiddleware, asyncHandler(async (req, res) => {
  const auth = getAuthContext(req);
  const group = await prisma.group.findUnique({
    where: { /* identifier lookup */ }
  });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  // Permission check
  const permission = await canUpdateGroup(auth, group);
  const checkResult = await safePermissionCheck(permission, res);
  if (!checkResult) return;

  // Audit the action
  await auditPermission(auth, 'group', group.id, 'update', permission, {
    auditSensitive: false
  });

  // Proceed with update...
}));
```

## Testing Needed

### Unit Tests (`__tests__/unit/auth-groups.test.ts`)
- Test all 12 permission functions
- Test role hierarchy
- Test edge cases (self-role change, owner leaving, etc.)

### Integration Tests
- Verify routes use permissions correctly
- Test group creation/update flows
- Test member management flows
- Test moderation workflows

## Related Files

- **Permission Functions**: `backend/src/auth/groups.ts`
- **Routes**: `backend/src/routes/groups.ts`
- **Schema**: `backend/prisma/schema.prisma` (Group, GroupMember models)
- **Middleware**: `backend/src/middleware/authContext.ts`
- **Core Libraries**: `backend/src/lib/permissions.ts`, `backend/src/lib/facets.ts`

## Notes

- Groups have 3 visibility levels: PUBLIC, PRIVATE_VISIBLE, PRIVATE_HIDDEN
- Groups can have moderation policies: NO_MODERATION, ADMIN_APPROVAL_REQUIRED, AI_FILTER, SELECTIVE_MODERATION
- Member roles: OWNER, ADMIN, MODERATOR, MEMBER
- Member statuses: ACTIVE, SUSPENDED, BANNED, PENDING_APPROVAL

