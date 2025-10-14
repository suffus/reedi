# Comment Context Analysis and Implementation Plan

## Current State Analysis

### Where Comments Currently Appear

Based on the existing codebase, here's how comments work today:

#### 1. **Comment Data Model** (`prisma/schema.prisma`)
```prisma
model Comment {
  id            String         @id @default(cuid())
  content       String
  postId        String?        // Links to a post
  authorId      String
  parentId      String?        // For replies
  createdAt     DateTime
  updatedAt     DateTime
  mediaId       String?        // Links to media
  // NO CONTEXT FIELD - This is the problem
}
```

**Problem**: Comments have NO context field to indicate WHERE they were created (group vs feed vs user page).

#### 2. **Comment Retrieval** (`src/routes/comments.ts`)
```typescript
// GET /api/comments/post/:postId
router.get('/post/:postId', ...)
```

**Current Behavior**: Returns ALL comments for a given `postId`, regardless of where they were created.

**Problem**: If a post appears in multiple places:
- User's feed
- User's public page
- Group A
- Group B

All comments from ALL contexts are returned everywhere.

#### 3. **Comment Creation** (`src/routes/comments.ts`)
```typescript
// POST /api/comments
router.post('/', authMiddleware, ...)
```

**Current Behavior**: 
- Takes `postId` and `content`
- Creates comment with NO context tracking
- Permission check uses `canCommentOnPost()` which checks group membership
- But doesn't record WHICH group the comment was made in

#### 4. **Where Comments Are Displayed**

**A. Posts Feed** (`src/routes/posts.ts` line ~91)
```typescript
comments: {
  include: {
    author: { ... }
  },
  orderBy: { createdAt: 'asc' }
}
```
Returns: ALL comments for the post

**B. User Public Page** (`src/routes/posts.ts` line ~285, ~605, ~1373, ~1482)
Same as above - returns ALL comments

**C. Group Feed** (`src/routes/groups.ts` line ~907)
```typescript
_count: {
  select: {
    comments: true,  // Just the count
    reactions: true
  }
}
```
Returns: Only comment COUNT, not the actual comments

**D. Comment Endpoint** (`src/routes/comments.ts` line ~54)
Returns: ALL comments for a postId

### Current Problems

1. **No Context Tracking**: Comments don't know where they were created
2. **Global Comment Pool**: All comments for a post appear everywhere the post appears
3. **Privacy Leakage**: Group comments leak to user pages and feeds
4. **No Scoping**: Can't filter comments by context

## Required Behavior

### User's Requirements

1. **Group Comments**:
   - Comments made on a group post should ONLY be visible within that specific group
   - If the same post appears in Group A and Group B, comments from Group A should not appear in Group B

2. **Feed Comments**:
   - Comments made in feeds should NOT be visible in groups
   - Feed comments SHOULD be visible on user's public page (subject to visibility constraints)

3. **User Page Comments**:
   - Comments made on user's public page should be visible there
   - Should be subject to visibility constraints
   - Should NOT leak to groups

### Comment Context Matrix

| Post Appears In | Comment Made In | Visible In Group? | Visible In Feed? | Visible On User Page? |
|-----------------|-----------------|-------------------|------------------|-----------------------|
| Group A         | Group A         | ✅ Group A only   | ❌               | ❌                    |
| Group A         | Feed            | ❌                | ✅               | ✅ (with visibility)  |
| Group A         | User Page       | ❌                | ❌               | ✅ (with visibility)  |
| Feed            | Feed            | ❌                | ✅               | ✅ (with visibility)  |
| User Page       | User Page       | ❌                | ❌               | ✅ (with visibility)  |
| User Page       | Feed            | ❌                | ✅               | ✅ (with visibility)  |

### Key Principle
**Comment Context Isolation**: A comment should only appear in the context where it was created.

## Implementation Plan

### Phase 1: Database Schema Changes

#### 1.1 Add Context to Comment Model
```prisma
model Comment {
  id            String         @id @default(cuid())
  content       String
  postId        String?
  authorId      String
  parentId      String?
  createdAt     DateTime
  updatedAt     DateTime
  mediaId       String?
  
  // NEW FIELDS FOR CONTEXT
  context       CommentContext @default(FEED)  // Where was it created?
  groupId       String?                         // If context=GROUP, which group?
  
  // Relations
  post          Post?          @relation(...)
  media         Media?         @relation(...)
  author        User           @relation(...)
  parent        Comment?       @relation(...)
  replies       Comment[]      @relation(...)
  group         Group?         @relation(fields: [groupId], references: [id])
  // ... existing relations
  
  @@index([groupId])  // Index for filtering
  @@map("comments")
}

enum CommentContext {
  FEED         // Comment made in user's feed
  GROUP        // Comment made in a group
  USER_PAGE    // Comment made on user's public page
}
```

**Migration Required**: Add `context` (default 'FEED') and `groupId` (nullable) columns.

#### 1.2 Update Group Model
```prisma
model Group {
  // ... existing fields
  comments      Comment[]  // NEW: Group can have comments
}
```

### Phase 2: API Changes

#### 2.1 Comment Creation (`POST /api/comments`)

**Current**:
```typescript
{ postId, content, parentId }
```

**New**:
```typescript
{ 
  postId, 
  content, 
  parentId,
  context: 'FEED' | 'GROUP' | 'USER_PAGE',  // NEW: Required
  groupId?: string  // NEW: Required if context=GROUP
}
```

**Logic Changes**:
1. Validate `context` parameter
2. If `context === 'GROUP'`:
   - Require `groupId`
   - Verify post exists in that group (check `GroupPost` table)
   - Verify user is member of group (existing permission check)
   - Store `groupId` in comment
3. If `context === 'FEED'` or `context === 'USER_PAGE'`:
   - Set `groupId` to `null`
   - Apply appropriate permission checks

**Permission Updates**:
- `canCommentOnPost()`: Already checks group membership ✅
- Add parameter to track context: `canCommentOnPost(auth, post, context, groupId?)`

#### 2.2 Comment Retrieval (`GET /api/comments/post/:postId`)

**Current**:
```typescript
GET /api/comments/post/:postId?page=1&limit=20
```

**New**:
```typescript
GET /api/comments/post/:postId?page=1&limit=20&context=FEED&groupId=xxx
```

**Query Parameters**:
- `context`: Required - 'FEED' | 'GROUP' | 'USER_PAGE'
- `groupId`: Required if context='GROUP'

**Logic Changes**:
```typescript
const where = {
  postId,
  parentId: null
}

// Add context filtering
if (context === 'GROUP') {
  where.context = 'GROUP'
  where.groupId = groupId
} else if (context === 'FEED') {
  where.context = 'FEED'
} else if (context === 'USER_PAGE') {
  where.context = 'USER_PAGE'
}
```

#### 2.3 Post Retrieval Updates

**A. Feed Endpoint** (`GET /api/posts/feed`)
- When including comments, add filter: `comments: { where: { context: 'FEED' } }`
- Only show comments made in feed context

**B. User Public Page** (`GET /api/posts/user/:userId/public`)
- Filter options:
  - Comments from FEED context: `{ context: 'FEED' }`
  - Comments from USER_PAGE context: `{ context: 'USER_PAGE' }`
  - Combined: `{ context: { in: ['FEED', 'USER_PAGE'] } }`

**C. Group Feed** (`GET /api/groups/:groupId/feed`)
- When including comments, add filter: 
  ```typescript
  comments: { 
    where: { 
      context: 'GROUP',
      groupId: group.id
    }
  }
  ```

### Phase 3: Frontend Changes

#### 3.1 Comment Creation UI

**Update `useCreateComment` hook or API calls**:

**Current**:
```typescript
createComment({ postId, content })
```

**New**:
```typescript
createComment({ 
  postId, 
  content, 
  context: 'FEED' | 'GROUP' | 'USER_PAGE',
  groupId?: string 
})
```

**Implementation**:
- In `group-profile.tsx`: Pass `context: 'GROUP'` and `groupId`
- In `personal-feed.tsx`: Pass `context: 'FEED'`
- In user public pages: Pass `context: 'USER_PAGE'`

#### 3.2 Comment Fetching UI

**Update comment fetch calls**:

**Current**:
```typescript
fetch(`/api/comments/post/${postId}`)
```

**New**:
```typescript
// In group context
fetch(`/api/comments/post/${postId}?context=GROUP&groupId=${groupId}`)

// In feed context
fetch(`/api/comments/post/${postId}?context=FEED`)

// In user page context
fetch(`/api/comments/post/${postId}?context=USER_PAGE`)
```

**Components to Update**:
- `frontend/components/group-profile.tsx`
- `frontend/components/dashboard/personal-feed.tsx`
- `frontend/components/user-profile.tsx`
- Any other components displaying comments

### Phase 4: Migration Strategy

#### 4.1 Data Migration

**Existing Comments**: Need to assign context to existing comments

**Strategy**:
```sql
-- Option 1: Mark all existing as FEED (safest)
UPDATE comments SET context = 'FEED', groupId = NULL;

-- Option 2: Intelligently assign based on post context
-- For comments on posts that only exist in groups:
UPDATE comments c
SET context = 'GROUP', groupId = gp.groupId
FROM group_posts gp
WHERE c.postId = gp.postId
  AND (SELECT COUNT(*) FROM group_posts WHERE postId = c.postId) = 1;

-- All others marked as FEED
UPDATE comments SET context = 'FEED' 
WHERE context IS NULL;
```

#### 4.2 Backward Compatibility

**Approach**: Make context optional initially, default to 'FEED'

**API Changes**:
1. Make `context` query param optional (default 'FEED')
2. Make `context` body param optional in creation (default 'FEED')
3. Gradually update frontend to pass explicit context
4. After migration complete, make `context` required

### Phase 5: Testing

#### 5.1 Backend Tests

**Test Cases**:
1. Create comment in GROUP context → Only visible in that group
2. Create comment in FEED context → Visible in feed and user page
3. Create comment in USER_PAGE context → Only visible on user page
4. Post in Group A + Group B → Comments isolated per group
5. Permission checks work with context
6. Migration script works correctly

#### 5.2 Frontend Tests

**Test Cases**:
1. Comment in group only appears in that group
2. Comment in feed appears in feed and user page
3. Same post in multiple contexts shows different comments
4. UI correctly passes context parameter
5. Comment counts are accurate per context

### Phase 6: Rollout

1. **Database Migration** (run during low-traffic)
   - Add columns with defaults
   - Run data migration script
   - Verify data integrity

2. **Backend Deploy**
   - Deploy with backward-compatible changes
   - Monitor for errors
   - Gradual rollout with feature flag

3. **Frontend Deploy**
   - Update to pass explicit context
   - Test in production
   - Monitor user feedback

4. **Cleanup**
   - Remove backward compatibility code
   - Make context required
   - Update documentation

## Edge Cases & Considerations

### 1. Cross-Posting
**Issue**: Same post in Group A, Group B, and user feed
**Solution**: Each context has its own comment thread - this is desired behavior

### 2. Comment Replies
**Issue**: Reply to a comment - which context?
**Solution**: Reply inherits parent comment's context and groupId

### 3. Deleted Groups
**Issue**: Comments from deleted groups
**Solution**: CASCADE delete on groupId foreign key, or set groupId to NULL

### 4. Comment Notifications
**Issue**: Who gets notified about group comments?
**Solution**: Only notify within the group context (group members)

### 5. Comment Search/Discovery
**Issue**: Global comment search
**Solution**: Include context in search results, filter by user's group memberships

### 6. Analytics
**Issue**: Comment counts per post
**Solution**: Need to be context-aware:
- Total comments: All contexts
- Group comments: Filter by groupId
- Feed comments: Filter by context='FEED'

## Summary

**Core Changes**:
1. ✅ Add `context` and `groupId` to Comment model
2. ✅ Update comment creation to require context
3. ✅ Update comment retrieval to filter by context
4. ✅ Update all post endpoints to filter comments by context
5. ✅ Update frontend to pass context in all comment operations
6. ✅ Migrate existing comments to appropriate context
7. ✅ Add comprehensive tests

**Benefits**:
- 🔒 Privacy: Group comments stay in groups
- 🎯 Context awareness: Comments scoped to where they were made
- 🔧 Flexibility: Easy to add new contexts in future
- ✅ Compliance: Meets user's requirements

**Estimated Effort**:
- Database migration: 2 hours
- Backend API changes: 8 hours
- Frontend changes: 6 hours
- Testing: 6 hours
- Deployment & monitoring: 4 hours
- **Total: ~26 hours** (3-4 days)

