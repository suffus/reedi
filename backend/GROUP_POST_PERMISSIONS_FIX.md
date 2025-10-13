# Group Post Permissions Fix ✅

## Issue
Users reported that:
1. ❌ Non-members could comment on group posts (should be blocked)
2. ❌ Group members couldn't comment on group posts (should be allowed)
3. Issue with likes/reactions permissions

## Requirements
Based on user feedback:
- ✅ **Group members** should be able to **comment** AND **like** posts in their group
- ✅ **Non-members** should be able to **like** group posts
- ❌ **Non-members** should NOT be able to **comment** on group posts

## Solution

### 1. Updated Comment Permissions
Modified `backend/src/auth/comments.ts` → `canCommentOnPost()` function

#### New Logic Flow:
1. **Author** can always comment (unchanged)
2. **Global admins** can comment anywhere (unchanged)
3. **Moderators** can comment anywhere (unchanged)
4. **Line managers** can comment on reports' posts (unchanged)
5. **NEW: Group Post Check** ⭐
   - Check if post belongs to a group (via `GroupPost` table)
   - If yes: Check if user is an ACTIVE member of that group
   - If not a member: **DENY** with reason "Must be a group member to comment"
   - If member: **GRANT** with reason "Group member"
6. If not a group post, apply standard visibility rules (PUBLIC, FRIENDS_ONLY, PRIVATE)

#### Key Changes:
```typescript
// Check if post belongs to a group - if so, only group members can comment
const groupPost = await prisma.groupPost.findFirst({
  where: { 
    postId: post.id,
    status: 'APPROVED' // Only check for approved group posts
  }
});

if (groupPost) {
  // This is a group post - check if user is a member
  const membership = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: groupPost.groupId,
        userId: userId
      }
    }
  });
  
  if (!membership || membership.status !== 'ACTIVE') {
    return deny(userId, post.id, 'comment-create-post', 'Must be a group member to comment', 'NOT_GROUP_MEMBER');
  }
  
  // User is a group member
  return grant(userId, post.id, 'comment-create-post', 'Group member', 'GROUP_MEMBER');
}
```

### 2. Reaction/Like Permissions
**No changes needed!** ✅

Reactions are currently handled in `backend/src/routes/posts.ts` → `POST /:postId/reactions`

The current behavior:
- ✅ Any authenticated user can like any post
- ✅ No group membership checks
- ✅ This matches the requirement that non-members can like group posts

## Permission Matrix

| User Type | Comment on Group Post | Like Group Post |
|-----------|----------------------|-----------------|
| Group Member | ✅ ALLOWED | ✅ ALLOWED |
| Non-Member (authenticated) | ❌ DENIED | ✅ ALLOWED |
| Post Author | ✅ ALLOWED | ✅ ALLOWED |
| Global Admin | ✅ ALLOWED | ✅ ALLOWED |
| Moderator | ✅ ALLOWED | ✅ ALLOWED |
| Unauthenticated | ❌ DENIED | ❌ DENIED |

## Reason Codes

### New Reason Codes Added:
- `NOT_GROUP_MEMBER` - User is not a member of the group
- `GROUP_MEMBER` - User is a member of the group

## Files Changed

1. **`backend/src/auth/comments.ts`**
   - Added `import { prisma } from '../db'`
   - Updated `canCommentOnPost()` function to check group membership
   - Lines modified: ~82-107

## Testing

### Test Case 1: Group Member Commenting
```
Given: User is a member of Group A
When: User tries to comment on a post in Group A
Then: Comment should be created successfully
```

### Test Case 2: Non-Member Commenting
```
Given: User is NOT a member of Group A
When: User tries to comment on a post in Group A
Then: Comment should be rejected with 403 Forbidden
Error: "Must be a group member to comment"
```

### Test Case 3: Non-Member Liking
```
Given: User is NOT a member of Group A
When: User tries to like a post in Group A
Then: Like should be created successfully
```

### Test Case 4: Group Member Liking
```
Given: User is a member of Group A
When: User tries to like a post in Group A
Then: Like should be created successfully
```

### Test Case 5: Post Author
```
Given: User is the author of a post in Group A (but not a group member)
When: User tries to comment on their own post
Then: Comment should be created successfully (author exception)
```

## Edge Cases Handled

1. ✅ **Pending group posts**: Only checks `APPROVED` group posts
2. ✅ **Inactive members**: Checks `membership.status !== 'ACTIVE'`
3. ✅ **Post author**: Can always comment on own posts, even if not a group member
4. ✅ **Admins/Moderators**: Can comment on any group post
5. ✅ **Non-group posts**: Standard visibility rules still apply

## Backward Compatibility

✅ **No breaking changes**
- Non-group posts work exactly as before
- All existing permission checks remain intact
- New logic only applies when a post belongs to a group

## Summary

✅ **Comments**: Now properly restricted to group members only
✅ **Reactions**: Already allow anyone (no changes needed)
✅ **Build**: Code compiles successfully (only pre-existing RabbitMQ errors)
✅ **Documentation**: Complete test cases and edge cases documented

**The fix is ready for deployment!** 🎉

