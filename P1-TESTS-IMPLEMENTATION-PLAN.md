# P1 (High Priority) Tests Implementation Plan

## Overview

Implement 5 P1 test suites covering comments/reactions, groups, messaging, search, and user profiles functionality.

**Status:** P0 tests complete (177 tests passing). Ready to implement P1 tests.

---

## P1.1 - Comments & Reactions Tests

**Priority:** High (core social engagement features)  
**File:** `backend/__tests__/integration/comments.test.ts`  
**Estimated:** ~30 test cases

### Test Cases

#### Comment on Posts
- ✅ Create comment on post
- ✅ Create reply to comment (nested)
- ✅ Comment with mentions
- ✅ Require authentication
- ✅ Validate comment content
- ✅ Handle empty/whitespace comments

#### Comment on Media
- ✅ Create comment on media item
- ✅ Thread media comments
- ✅ Access control for private media

#### View Comments
- ✅ Get post comments with pagination
- ✅ Get media comments with pagination
- ✅ Sort by oldest/newest
- ✅ Include nested replies
- ✅ Include author information

#### Edit Comments
- ✅ Edit own comment
- ✅ Deny editing others' comments
- ✅ Preserve comment history
- ✅ Validate edited content

#### Delete Comments
- ✅ Delete own comment
- ✅ Deny deleting others' comments
- ✅ Cascade delete replies
- ✅ Author/post owner can delete

#### Reactions
- ✅ React to post (❤️, 👍, 😂, 😮, 😢, 😡)
- ✅ React to comment
- ✅ React to message
- ✅ Remove reaction
- ✅ Change reaction
- ✅ Prevent duplicate reactions
- ✅ Get reaction counts
- ✅ Get users who reacted

**Implementation Notes:**
- Check if comments routes exist in `backend/src/routes/comments.ts`
- Check Prisma schema for Comment and Reaction models
- May need to implement routes first

---

## P1.2 - Groups Tests

**Priority:** High (community features)  
**File:** `backend/__tests__/integration/groups.test.ts`  
**Estimated:** ~40 test cases

### Test Cases

#### Create & Setup Groups
- ✅ Create new group
- ✅ Set group visibility (PUBLIC, PRIVATE, PRIVATE_HIDDEN)
- ✅ Set moderation level (NO_MODERATION, SELECTIVE_MODERATION, ADMIN_APPROVAL_REQUIRED)
- ✅ Require group name
- ✅ Optional group description/avatar
- ✅ Creator becomes owner/admin

#### View Groups
- ✅ List public groups
- ✅ View group detail
- ✅ View group members
- ✅ Access control for private groups
- ✅ Filter groups by category/tag
- ✅ Search groups

#### Group Membership
- ✅ Join public group (instant)
- ✅ Apply to join private group
- ✅ Invite user to group
- ✅ Accept/reject invitation
- ✅ Approve/reject application
- ✅ Leave group
- ✅ Remove member (admin only)
- ✅ Ban member (admin only)

#### Group Roles
- ✅ Assign member roles (OWNER, ADMIN, MODERATOR, MEMBER)
- ✅ Role permissions enforcement
- ✅ Change member role (admin only)
- ✅ Transfer ownership

#### Group Posts
- ✅ Create post in group
- ✅ Moderate post (SELECTIVE_MODERATION)
- ✅ Auto-approve post (NO_MODERATION)
- ✅ Require approval (ADMIN_APPROVAL_REQUIRED)
- ✅ Approve pending post
- ✅ Reject pending post
- ✅ Edit group post
- ✅ Delete group post

#### Edit & Delete Groups
- ✅ Edit group settings (owner/admin)
- ✅ Change group visibility
- ✅ Change moderation level
- ✅ Delete group (owner only)
- ✅ Handle members on deletion

**Implementation Notes:**
- Check `backend/src/routes/groups.ts` for existing implementation
- Test data has 6 groups with various settings
- Group roles: OWNER, ADMIN, MODERATOR, MEMBER

---

## P1.3 - Messaging Tests

**Priority:** High (direct communication)  
**File:** `backend/__tests__/integration/messaging.test.ts`  
**Estimated:** ~35 test cases

### Test Cases

#### Direct Conversations
- ✅ Start direct conversation
- ✅ Automatic conversation creation on first message
- ✅ Get existing conversation
- ✅ List user's conversations
- ✅ Sort by last message

#### Send Messages
- ✅ Send text message
- ✅ Send message with media
- ✅ Send message with multiple media
- ✅ Require authentication
- ✅ Validate message content
- ✅ Empty message rejection

#### Group Conversations
- ✅ Create group conversation
- ✅ Set conversation name/avatar
- ✅ Add participants
- ✅ Remove participants
- ✅ Leave conversation
- ✅ Only admin can add/remove (if configured)

#### Message Status
- ✅ Message sent status
- ✅ Message delivered status
- ✅ Message read status
- ✅ Track delivery per participant
- ✅ Mark conversation as read

#### Message Reactions
- ✅ React to message
- ✅ Remove message reaction
- ✅ Get message reactions
- ✅ Multiple users can react

#### View & Retrieve
- ✅ Get conversation messages (paginated)
- ✅ Get message detail
- ✅ Real-time message updates (socket.io)
- ✅ Unread message count

#### Edit & Delete
- ✅ Edit own message
- ✅ Delete own message
- ✅ Delete for self vs delete for everyone
- ✅ Message edit history

**Implementation Notes:**
- Check `backend/src/routes/messages.ts` for existing routes
- Test data has 6 conversations with messages
- Message statuses: SENT, DELIVERED, READ
- Socket.io integration may need separate testing

---

## P1.4 - Search Tests

**Priority:** Medium-High (discovery features)  
**File:** `backend/__tests__/integration/search.test.ts`  
**Estimated:** ~25 test cases

### Test Cases

#### Search Users
- ✅ Search by name
- ✅ Search by username
- ✅ Partial match support
- ✅ Case-insensitive search
- ✅ Pagination
- ✅ Private profile handling

#### Search Posts
- ✅ Search by content
- ✅ Search by hashtag
- ✅ Filter by visibility (respect permissions)
- ✅ Filter by date range
- ✅ Sort by relevance/date
- ✅ Pagination

#### Search Media
- ✅ Search by tags
- ✅ Filter by media type (IMAGE/VIDEO)
- ✅ Filter by visibility
- ✅ Search by caption/title
- ✅ Pagination

#### Search Groups
- ✅ Search by name
- ✅ Search by description
- ✅ Filter by visibility
- ✅ Filter by category
- ✅ Pagination

#### Global Search
- ✅ Combined search (users, posts, media, groups)
- ✅ Type filtering
- ✅ Sort by relevance
- ✅ Search suggestions
- ✅ Recent searches (authenticated user)

**Implementation Notes:**
- Check `backend/src/routes/search.ts` for existing routes
- May use PostgreSQL full-text search or similar
- Need to respect visibility and access control

---

## P1.5 - User Profiles Tests

**Priority:** Medium (profile management)  
**File:** `backend/__tests__/integration/profiles.test.ts`  
**Estimated:** ~25 test cases

### Test Cases

#### View Profiles
- ✅ View own profile (all fields)
- ✅ View other user profile (public fields)
- ✅ View friend profile (extended fields)
- ✅ Private profile handling
- ✅ Profile not found (404)

#### Edit Profile
- ✅ Update name
- ✅ Update bio
- ✅ Update avatar
- ✅ Update cover photo
- ✅ Update username (if allowed)
- ✅ Update email (with verification)
- ✅ Validate field constraints

#### Privacy Settings
- ✅ Toggle profile visibility (public/private)
- ✅ Toggle post visibility to non-friends
- ✅ Toggle media visibility to non-friends
- ✅ Block/unblock users
- ✅ Mute/unmute users

#### Profile Content
- ✅ View user's posts (filtered by permissions)
- ✅ View user's media gallery (filtered)
- ✅ View user's galleries (filtered)
- ✅ View user's friends list
- ✅ Pagination for all content types

#### Account Settings
- ✅ Change password
- ✅ Enable/disable notifications
- ✅ Delete account
- ✅ Export user data
- ✅ Privacy policy acceptance

**Implementation Notes:**
- Check `backend/src/routes/users.ts` for existing routes
- Test data has 5 users with various settings
- Some routes may already exist from P0 tests

---

## Implementation Order

### Phase 1: Comments & Reactions (1 day)
1. Review existing comment routes
2. Implement missing routes if needed
3. Write tests for commenting on posts/media
4. Write tests for reactions
5. Test nested comments and threading

### Phase 2: Groups (1.5 days)
1. Review existing group routes
2. Implement missing routes if needed
3. Write membership tests
4. Write role/permission tests
5. Write group post moderation tests

### Phase 3: Messaging (1 day)
1. Review existing message routes
2. Write conversation creation tests
3. Write message send/receive tests
4. Write message status tests
5. Test group conversations

### Phase 4: Search (0.5 days)
1. Review existing search routes
2. Write search tests for each content type
3. Write filter and pagination tests
4. Test access control in search results

### Phase 5: User Profiles (0.5 days)
1. Review existing user/profile routes
2. Write profile viewing tests
3. Write profile editing tests
4. Write privacy setting tests

**Total Estimated Time:** 4-5 days

---

## Success Criteria

- ✅ All P1 test suites pass
- ✅ Test coverage for P1 areas reaches 70%+
- ✅ No skipped tests (unless feature not implemented)
- ✅ All tests properly isolated (no side effects)
- ✅ Proper cleanup in afterEach/afterAll
- ✅ Tests follow naming convention: "should [action] when [condition]"
- ✅ Documentation updated with test counts

---

## Testing Strategy

### For Each Test Suite:

1. **Review Existing Routes**
   - Check if routes exist
   - Check route parameters and body structure
   - Note any missing routes

2. **Identify Gaps**
   - List routes that need implementation
   - Note features that should be skipped
   - Document API structure

3. **Write Tests**
   - Start with happy path tests
   - Add error cases
   - Add edge cases
   - Add permission/access control tests

4. **Run and Fix**
   - Run tests to identify failures
   - Fix tests to match actual implementation
   - Skip tests for non-existent features
   - Document any deviations

5. **Verify Coverage**
   - Ensure key functionality is covered
   - Check edge cases are tested
   - Verify error handling

---

## Files to Check

### Backend Routes
- `backend/src/routes/comments.ts` (comments & reactions)
- `backend/src/routes/groups.ts` (group management)
- `backend/src/routes/messages.ts` (messaging)
- `backend/src/routes/search.ts` (search functionality)
- `backend/src/routes/users.ts` (user profiles)

### Test Data
- `backend/__tests__/seed/generators/` (test data generators)
- `backend/__tests__/seed/TEST_DATA_REFERENCE.md` (reference)

### Helpers
- `backend/__tests__/utils/test-helpers.ts` (utilities)

---

## Dependencies

**Required:**
- ✅ Test database seeded with data
- ✅ Test utilities and helpers
- ✅ JWT token generation
- ✅ P0 tests passing (baseline functionality)

**May Need:**
- Routes implementation for missing endpoints
- Socket.io test setup for real-time features
- File upload test utilities for media in messages

---

## Notes

- Some features may already be partially implemented from P0 work
- Focus on matching actual implementation rather than implementing features
- Skip tests for features marked as future work
- Document any discovered issues or missing features
- Update TESTING_STATUS.md as tests are completed

---

## Next Steps

1. Start with Comments & Reactions (most commonly tested feature)
2. Review `backend/src/routes/comments.ts` to understand current implementation
3. Create `backend/__tests__/integration/comments.test.ts`
4. Follow the test structure from P0 tests
5. Run tests and iterate until all pass or are properly skipped


