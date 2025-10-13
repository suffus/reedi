# User Gallery Media Display Fix

## Issue
Users were unable to see their own media in the user gallery endpoint `/api/media/user/:userId`. The request would fail with:
```json
{"success":false,"error":"Database operation failed"}
```

## Root Cause
The route at `GET /api/media/user/:userId` in `src/routes/media.ts` was attempting to include the full `author` (User) object when fetching media:

```typescript
const allMedia = await prisma.media.findMany({
  where: whereClause,
  orderBy: { createdAt: 'desc' },
  include: {
    author: true // This was causing database issues
  }
})
```

This caused problems because:
1. The User model has many relations (posts, comments, reactions, media, galleries, etc.)
2. Prisma was trying to load all these relations, causing database performance issues or circular reference problems
3. The `author` object was not actually needed - the permission checks only use `media.authorId` and `media.visibility`

## Solution
Removed the unnecessary `include: { author: true }` from the query:

```typescript
const allMedia = await prisma.media.findMany({
  where: whereClause,
  orderBy: { createdAt: 'desc' }
  // Note: author object not needed - permission checks only use authorId
})
```

Also simplified the response mapping since the `authorId` is already present in the Media model:

```typescript
// Before:
const mediaResponse = paginatedMedia.map(({ author, ...media }) => ({
  ...media,
  authorId: author?.id || media.authorId
}))

// After:
const mediaResponse = paginatedMedia
```

## Impact
- Users can now successfully view their own media gallery
- Improved database query performance by not loading unnecessary relations
- The permission system (`canDoMediaRead`, `filterReadableMedia`) works correctly without the author object
- All permission checks (owner, friends, public, admin) function as expected using only `authorId`

## Testing
To test the fix:
1. Authenticate as a user
2. Request: `GET /api/media/user/{userId}?page=1&limit=20`
3. Should return the user's media with proper filtering based on permissions
4. Should see own media (all visibilities) when requesting own gallery
5. Should see filtered media when viewing another user's gallery

