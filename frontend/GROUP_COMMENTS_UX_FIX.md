# Group Comments UX Fix

## Problem

When adding a comment to a group post, the entire page was being refreshed/redrawn, causing:
- Loss of scroll position
- Flickering/visual disruption
- Poor user experience

In contrast, comments on the user feed worked smoothly without full page refresh.

## Root Cause

The group-profile component was using a manual `loadGroupData()` function that:
1. Fetches group details
2. Fetches group members
3. Fetches group posts

When `handleAddComment()` called `loadGroupData()`, it triggered a complete refetch of all data, causing the entire component to re-render.

### Before (Bad UX)
```typescript
const handleAddComment = async (postId: string) => {
  await createCommentMutation.mutateAsync({ ... })
  
  // ❌ This reloads EVERYTHING
  loadGroupData()
}
```

### Why User Feed Works Better

The user feed uses React Query's automatic cache invalidation. The `useCreateComment` mutation invalidates only the specific queries that need updating, and React Query handles the refetch intelligently without full page refresh.

## Solution

### 1. Enhanced `useCreateComment` Hook (`lib/api-hooks.ts`)

Added group-specific query invalidation:

```typescript
onSuccess: (_, variables) => {
  if (variables.postId) {
    queryClient.invalidateQueries({ queryKey: ['comments', variables.postId] })
    queryClient.invalidateQueries({ queryKey: ['posts'] })
    queryClient.invalidateQueries({ queryKey: ['infinite-posts'] })
    
    // ✅ If this is a group comment, invalidate group queries
    if (variables.context === 'GROUP' && variables.groupId) {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId, 'posts'] })
      queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId, 'feed'] })
    }
  }
}
```

### 2. Optimistic UI Update (`components/group-profile.tsx`)

Instead of calling `loadGroupData()`, the new implementation:
1. Immediately adds the comment to local state
2. Updates the comment count
3. Maintains scroll position
4. No flickering

```typescript
const handleAddComment = async (postId: string) => {
  const result = await createCommentMutation.mutateAsync({
    postId,
    content,
    context: 'GROUP',
    groupId: groupData?.id
  })
  
  // ✅ Optimistically update local state
  setPosts(prevPosts => {
    return prevPosts.map(groupPost => {
      if (groupPost.post.id === postId) {
        return {
          ...groupPost,
          post: {
            ...groupPost.post,
            comments: [
              ...(groupPost.post.comments || []),
              result.data.comment
            ],
            _count: {
              comments: (groupPost.post._count?.comments || 0) + 1,
              reactions: groupPost.post._count?.reactions || 0
            }
          }
        } as typeof groupPost
      }
      return groupPost
    })
  })
  
  // ✅ No loadGroupData() call!
}
```

## Benefits

### ✅ Improved UX
- **No page refresh**: Only the comment list updates
- **No flickering**: Smooth, instant feedback
- **Maintains scroll position**: User doesn't lose their place
- **Instant feedback**: Comment appears immediately

### ✅ Better Performance
- **Fewer API calls**: Don't refetch group details and members
- **Smaller payload**: Only the comment data is transferred
- **Faster response**: Optimistic update feels instant

### ✅ Consistent Experience
- Group comments now work the same as feed comments
- Same smooth, modern UX across the application

## Technical Details

### Optimistic Update Pattern

The optimistic update works by:
1. Calling the mutation to save to backend
2. Immediately updating local state with the response
3. Comment appears instantly (no waiting for refetch)
4. If mutation fails, error handling shows toast notification

### Type Safety

Used `as typeof groupPost` to maintain TypeScript type safety while spreading and updating nested objects.

### Comment Context

The fix works seamlessly with the new comment context system:
- Comments are created with `context: 'GROUP'` and `groupId`
- Comments are properly isolated to the group
- No privacy leakage between contexts

## Testing

### Before Fix
1. Navigate to group
2. Scroll down to a post
3. Add comment
4. **Result**: Page jumps to top, entire page refreshes, flickering

### After Fix
1. Navigate to group
2. Scroll down to a post
3. Add comment
4. **Result**: Comment appears smoothly below post, scroll position maintained, no flickering ✅

## Files Modified

1. **`frontend/lib/api-hooks.ts`**
   - Added group query invalidation to `useCreateComment` mutation
   
2. **`frontend/components/group-profile.tsx`**
   - Removed `loadGroupData()` call from `handleAddComment`
   - Added optimistic state update for new comments
   - Maintains comment count accuracy

## Related Features

This fix complements the comment context isolation feature:
- Comments stay isolated to their context (GROUP/FEED/USER_PAGE)
- UI updates are smooth and context-aware
- No cross-contamination of comments between contexts

---

**Status**: ✅ **Complete and Tested**  
**Build**: ✅ **Passing**  
**UX Impact**: **High** - Significantly improved user experience for group interactions


