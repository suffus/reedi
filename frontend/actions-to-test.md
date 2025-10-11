# Test Specification for Reedi Platform

## Testing Framework Recommendations

### Backend Testing
**Framework:** Jest + Supertest
- **Jest** for unit and integration testing
- **Supertest** for API endpoint testing
- **@prisma/client** mock for database testing
- **Coverage target:** 80%+ for critical paths

**Test Structure:**
```
backend/
  __tests__/
    unit/
      services/
      utils/
    integration/
      routes/
      middleware/
    e2e/
      workflows/
```

### Frontend Testing
**Framework:** Jest + React Testing Library + Playwright
- **Jest + React Testing Library** for component and integration tests
- **Playwright** for end-to-end tests
- **MSW (Mock Service Worker)** for API mocking
- **Coverage target:** 70%+ for components

**Test Structure:**
```
frontend/
  __tests__/
    unit/
      components/
      hooks/
      utils/
    integration/
      pages/
      flows/
    e2e/
      playwright/
```

---

## 1. Authentication & Authorization

### Login & JWT Authentication
- ✅ Test that a valid username and password generates a valid JWT token
- ✅ Test that an invalid username is rejected with appropriate error
- ✅ Test that an invalid password is rejected with appropriate error
- ✅ Test that JWT token can be used to access protected routes
- ✅ Test that expired JWT tokens are rejected
- ✅ Test that malformed JWT tokens are rejected
- ✅ Test that accessing protected routes without authentication returns 401
- Note: Registration testing deferred per user requirements

### Authorization & Permissions
- ✅ Test that users can only access their own private content
- ✅ Test that friends can access FRIENDS_ONLY content
- ✅ Test that public content is accessible to all authenticated users
- ✅ Test that locked post permissions work correctly (canPublishLockedMedia)

---

## 2. Media Upload & Management

### Media Upload
- ✅ Test image upload (JPEG, PNG, GIF formats) with metadata (title, tags, description)
- ✅ Test video upload (MP4, WebM, MOV, AVI formats) with metadata
- ✅ Test chunked upload for large files (initiate, upload chunks, complete)
- ✅ Test that unsupported file types are rejected
- ✅ Test that files exceeding size limits are rejected (500MB for videos)
- ✅ Test upload progress tracking
- ✅ Test that media processing status changes from PENDING → PROCESSING → COMPLETED
- ✅ Test failed media upload cleanup

### Media Gallery Management
- ✅ Test viewing user's media gallery with pagination
- ✅ Test filtering media by type (IMAGE/VIDEO)
- ✅ Test filtering media by tags (single and multiple tags)
- ✅ Test filtering media by date range
- ✅ Test filtering unorganized media (not in any gallery)
- ✅ Test media detail viewing in modal
- ✅ Test navigation between media items (prev/next)
- ✅ Test editing media metadata (title, description, tags, visibility)
- ✅ Test tag merging when bulk editing
- ✅ Test deleting media from gallery
- ✅ Test that deleted media is removed from S3 storage

### Bulk Media Operations
- ✅ Test bulk editing 4+ media items triggers bulk edit UI
- ✅ Test bulk updating titles, descriptions, and tags
- ✅ Test bulk tag merging vs replacement
- ✅ Test bulk visibility changes
- ✅ Test that only owned media can be bulk edited

### Media Processing
- ✅ Test that images are processed to create thumbnails
- ✅ Test that videos are processed to create multiple quality versions
- ✅ Test that video thumbnails are generated
- ✅ Test reprocessing failed media
- ✅ Test media processing status updates via Socket.IO

---

## 3. Gallery Formation & Editing

### Gallery Creation & Management
- ✅ Test creating a new gallery with name and description
- ✅ Test that empty gallery names are rejected
- ✅ Test setting gallery visibility (PUBLIC, FRIENDS_ONLY, PRIVATE)
- ✅ Test viewing gallery list with image/video counts
- ✅ Test viewing gallery details with media
- ✅ Test editing gallery name, description, and visibility
- ✅ Test setting gallery cover photo
- ✅ Test deleting a gallery

### Gallery Media Management
- ✅ Test adding media to a gallery
- ✅ Test adding multiple media items at once
- ✅ Test removing media from a gallery
- ✅ Test that removed media stays in user's library
- ✅ Test reordering media within a gallery
- ✅ Test that only owned media can be added to gallery
- ✅ Test viewing gallery media with visibility filters

### Gallery Visibility
- ✅ Test that PUBLIC galleries are visible to all
- ✅ Test that FRIENDS_ONLY galleries are visible only to friends
- ✅ Test that PRIVATE galleries are visible only to owner
- ✅ Test that media visibility within galleries is respected

---

## 4. Posts Creation & Management

### Post Creation
- ✅ Test creating a post with content only
- ✅ Test creating a post with title and content
- ✅ Test creating a post with media attachments
- ✅ Test creating a post with hashtags
- ✅ Test creating a post with mentions
- ✅ Test setting post visibility (PUBLIC, FRIENDS_ONLY, PRIVATE)
- ✅ Test creating locked posts with unlock price
- ✅ Test that locked posts require canPublishLockedMedia permission
- ✅ Test that locked posts must have locked media items
- ✅ Test media ordering in posts

### Post Editing
- ✅ Test editing post content
- ✅ Test editing post title
- ✅ Test adding/removing media from post
- ✅ Test reordering media in post
- ✅ Test editing hashtags
- ✅ Test changing post visibility
- ✅ Test that only post author can edit

### Post Status Management
- ✅ Test changing publication status (PUBLIC, PAUSED, CONTROLLED, DELETED)
- ✅ Test that PAUSED posts are only visible to author
- ✅ Test that DELETED posts are not visible to anyone
- ✅ Test that PUBLIC posts appear in feeds

### Post Viewing & Feeds
- ✅ Test viewing public posts feed
- ✅ Test viewing personalized feed (friends + followed users)
- ✅ Test viewing user's public posts (with visibility filters)
- ✅ Test viewing single post with all details
- ✅ Test post pagination
- ✅ Test that locked media is hidden from non-owners
- ✅ Test unlocking posts

### Post Deletion
- ✅ Test deleting own posts
- ✅ Test that deleted posts are removed from feeds
- ✅ Test that only author can delete posts

---

## 5. Reactions & Comments

### Post Reactions
- ✅ Test adding reaction to post (LIKE, LOVE, HAHA, WOW, SAD, ANGRY)
- ✅ Test updating existing reaction
- ✅ Test removing reaction
- ✅ Test viewing all reactions on a post
- ✅ Test that reaction counts update correctly
- ✅ Test that users can only have one reaction per post

### Comments on Posts
- ✅ Test adding comment to post
- ✅ Test adding reply to comment (nested comments)
- ✅ Test editing own comments
- ✅ Test deleting own comments
- ✅ Test viewing comments with pagination
- ✅ Test comment visibility based on post visibility
- ✅ Test that friends can comment on FRIENDS_ONLY posts
- ✅ Test that anyone can comment on PUBLIC posts

### Comments on Media
- ✅ Test adding comment to media
- ✅ Test adding reply to media comment
- ✅ Test editing own media comments
- ✅ Test deleting own media comments
- ✅ Test comment visibility based on media visibility

### Comment Reactions
- ✅ Test adding reactions to comments
- ✅ Test viewing comment reaction counts

---

## 6. Friends & Following

### Friend Requests
- ✅ Test sending friend request to another user
- ✅ Test that duplicate friend requests are rejected
- ✅ Test viewing received friend requests
- ✅ Test viewing sent friend requests
- ✅ Test accepting friend request
- ✅ Test rejecting friend request
- ✅ Test cancelling sent friend request
- ✅ Test that friend request notifications are created
- ✅ Test checking friendship status between users

### Friends Management
- ✅ Test viewing friends list with pagination
- ✅ Test that accepted friends appear in both users' friend lists
- ✅ Test that friends can view FRIENDS_ONLY content
- ✅ Test removing friend (unfriending)

### Following System
- ✅ Test following a user
- ✅ Test that duplicate follows are rejected
- ✅ Test unfollowing a user
- ✅ Test viewing followers list
- ✅ Test viewing following list
- ✅ Test that followed users' posts appear in feed
- ✅ Test that cannot follow yourself

---

## 7. Groups

### Group Creation & Settings
- ✅ Test creating a group with name and username
- ✅ Test creating group with avatar and cover photo
- ✅ Test that group usernames must be unique
- ✅ Test setting group type (GENERAL, SOCIAL_LEARNING, GAMING, JOBS, BUY_SELL, PARENTING, WORK)
- ✅ Test setting group visibility (PUBLIC, PRIVATE_VISIBLE, PRIVATE_HIDDEN)
- ✅ Test setting moderation policy (NO_MODERATION, ADMIN_APPROVAL_REQUIRED, AI_FILTER, SELECTIVE_MODERATION)
- ✅ Test updating group settings (admin/owner only)
- ✅ Test uploading group avatar and cover photo

### Group Discovery
- ✅ Test viewing public groups
- ✅ Test searching for groups by name/description
- ✅ Test filtering groups by type
- ✅ Test viewing group details (with proper visibility checks)
- ✅ Test that PRIVATE_HIDDEN groups are only visible to members

### Group Membership
- ✅ Test applying to join private group
- ✅ Test that duplicate applications are rejected
- ✅ Test viewing pending applications (admin/owner)
- ✅ Test approving group application
- ✅ Test rejecting group application
- ✅ Test viewing group members
- ✅ Test viewing detailed member stats (admin/owner)
- ✅ Test inviting member to group (admin/owner)
- ✅ Test accepting group invitation
- ✅ Test that invitation codes expire after 7 days

### Group Roles & Permissions
- ✅ Test role hierarchy (OWNER > ADMIN > MODERATOR > MEMBER)
- ✅ Test changing member role (admin/owner only)
- ✅ Test that admins cannot change owner's role
- ✅ Test that members cannot perform admin actions
- ✅ Test removing member from group (admin/owner)
- ✅ Test leaving group voluntarily

### Group Posts
- ✅ Test posting to group
- ✅ Test that posts require approval based on moderation policy
- ✅ Test viewing group feed with proper visibility
- ✅ Test that admins see all posts including pending
- ✅ Test that members see only approved posts + own pending
- ✅ Test approving pending post (admin/moderator)
- ✅ Test rejecting post with reason
- ✅ Test priority posts appear first
- ✅ Test that non-members cannot see posts in private groups

### Group Activity & Moderation
- ✅ Test viewing group activity log (admin/owner)
- ✅ Test that all actions are logged
- ✅ Test moderating posts (approve/reject/delete)
- ✅ Test viewing applicant history when reviewing applications

---

## 8. Messaging

### Direct Messages
- ✅ Test creating direct conversation
- ✅ Test that duplicate direct conversations are prevented
- ✅ Test sending text message
- ✅ Test sending message with media
- ✅ Test sending message with multiple media items
- ✅ Test message delivery status (SENT, DELIVERED, READ)
- ✅ Test viewing message history with pagination
- ✅ Test loading older messages

### Group Conversations
- ✅ Test creating group conversation
- ✅ Test sending messages to group
- ✅ Test adding participants to group conversation (admin)
- ✅ Test removing participant from group conversation (admin)
- ✅ Test leaving group conversation

### Message Management
- ✅ Test deleting own messages
- ✅ Test that deleted messages show as deleted
- ✅ Test message reactions
- ✅ Test replying to messages
- ✅ Test real-time message updates via Socket.IO

### Conversations
- ✅ Test viewing conversation list sorted by last message
- ✅ Test viewing conversation details
- ✅ Test marking messages as read
- ✅ Test conversation participant management

---

## 9. Search

### User Search
- ✅ Test searching users by name
- ✅ Test searching users by username
- ✅ Test searching users by bio
- ✅ Test search suggestions
- ✅ Test pagination of search results

### Content Search
- ✅ Test searching posts by title
- ✅ Test searching posts by content
- ✅ Test searching by hashtags
- ✅ Test that only PUBLIC content appears in search
- ✅ Test combined search (all types)

### Media Search
- ✅ Test searching media by tags (single tag)
- ✅ Test searching media by multiple tags (AND logic)
- ✅ Test that media visibility is respected in search
- ✅ Test that friends' FRIENDS_ONLY media appears for authenticated users

### Search History
- ✅ Test that search queries are saved for authenticated users
- ✅ Test viewing search history

---

## 10. User Profiles

### Profile Viewing
- ✅ Test viewing own profile
- ✅ Test viewing other user's profile by username
- ✅ Test viewing other user's profile by ID
- ✅ Test that profile shows post counts
- ✅ Test that profile shows follower/following counts

### Profile Editing
- ✅ Test updating profile name
- ✅ Test updating username (with uniqueness check)
- ✅ Test updating bio, location, website
- ✅ Test toggling isPrivate flag
- ✅ Test uploading avatar (with image processing to 180x180)
- ✅ Test that invalid usernames are rejected

### Profile Privacy
- ✅ Test that private profiles hide content from non-friends
- ✅ Test that public profiles show content to all

---

## 11. Media Serving & Storage

### Media Access
- ✅ Test serving image media by ID
- ✅ Test serving video media by ID
- ✅ Test serving thumbnails
- ✅ Test serving different video qualities
- ✅ Test that private media requires authentication
- ✅ Test that FRIENDS_ONLY media requires friendship
- ✅ Test presigned URL generation for S3

### Media Metadata
- ✅ Test that media includes proper metadata (dimensions, size, mime type)
- ✅ Test that video metadata includes duration, codec, bitrate, framerate
- ✅ Test that processed media includes versions (thumbnails, qualities)

---

## 12. Notifications

### Notification Creation
- ✅ Test notification created on friend request
- ✅ Test notification created on friend request acceptance
- ✅ Test notification created on comment
- ✅ Test notification created on reaction
- ✅ Test notification created on mention

### Notification Management
- ✅ Test viewing notifications
- ✅ Test marking notifications as read
- ✅ Test notification pagination

---

## 13. Edge Cases & Error Handling

### Validation
- ✅ Test empty required fields are rejected
- ✅ Test invalid data types are rejected
- ✅ Test SQL injection attempts are prevented
- ✅ Test XSS attempts are sanitized
- ✅ Test that malformed JSON is rejected

### Authorization Edge Cases
- ✅ Test accessing deleted content returns 404
- ✅ Test accessing paused posts (should fail for non-owners)
- ✅ Test race conditions in friend requests
- ✅ Test simultaneous group application and invitation
- ✅ Test expired tokens are rejected

### Data Integrity
- ✅ Test that deleting user cascades properly
- ✅ Test that deleting post removes comments and reactions
- ✅ Test that deleting media removes S3 files
- ✅ Test that leaving gallery doesn't delete media
- ✅ Test transaction rollbacks on errors

### Rate Limiting & Performance
- ✅ Test pagination works correctly for large datasets
- ✅ Test that queries are optimized (no N+1 problems)
- ✅ Test file upload size limits
- ✅ Test concurrent upload handling

---

## 14. Real-time Features (Socket.IO)

### Real-time Updates
- ✅ Test real-time message delivery
- ✅ Test real-time message read status
- ✅ Test media processing status updates
- ✅ Test connection/disconnection handling
- ✅ Test room-based message broadcasting

---

## 15. Integration & E2E Workflows

### Complete User Journeys
- ✅ **New User Journey:** Login → Upload media → Create gallery → Create post → Share to group
- ✅ **Social Journey:** Find users → Send friend request → View friend's content → Comment and react
- ✅ **Group Journey:** Search groups → Apply to join → Post to group → View activity
- ✅ **Messaging Journey:** Create conversation → Send messages → Send media → Mark as read
- ✅ **Content Creator Journey:** Upload media → Create galleries → Create posts → Monitor engagement

### Cross-feature Integration
- ✅ Test posting gallery to group
- ✅ Test sharing post in message
- ✅ Test commenting on group post
- ✅ Test friend request affecting content visibility
- ✅ Test locked post purchase and unlock flow

---

## Test Data Requirements

### Seed Data Needed
- **Users:** 10+ test users with varying profiles
  - User with canPublishLockedMedia permission
  - Users with friend relationships
  - Users following each other
- **Media:** Mix of images and videos with different:
  - Visibility levels (PUBLIC, FRIENDS_ONLY, PRIVATE)
  - Processing statuses (COMPLETED, PENDING, FAILED)
  - Tags and metadata
- **Posts:** Various posts with:
  - Different visibilities
  - With and without media
  - Locked and unlocked
- **Groups:** Groups with different:
  - Visibility settings
  - Moderation policies
  - Member counts and roles
- **Galleries:** Pre-populated galleries with media
- **Messages:** Existing conversations for testing

### Test Environment Setup
- **Database:** Separate test database with migrations applied
- **Storage:** Mock or test S3 bucket (use localstack or minio)
- **Media Processor:** Mock media processing service or use test videos/images
- **Socket.IO:** Test socket server for real-time features

---

## CI/CD Integration

### Automated Testing
- Run unit tests on every commit
- Run integration tests on PR creation
- Run E2E tests on staging deployment
- Generate coverage reports
- Block merges if tests fail or coverage drops below threshold

### Test Performance
- Unit tests should complete in < 1 minute
- Integration tests should complete in < 5 minutes
- E2E tests should complete in < 15 minutes
- Parallelize test execution where possible

---

## Priority Levels

### P0 (Critical - Must Pass Before Release)
- Authentication and authorization
- Media upload and retrieval
- Post creation and viewing
- Basic gallery operations
- Friend requests and content visibility

### P1 (High Priority - Should Pass)
- Comments and reactions
- Group creation and management
- Messaging core features
- Search functionality
- Profile management

### P2 (Medium Priority - Nice to Have)
- Advanced group features (applications, moderation)
- Bulk operations
- Media reprocessing
- Search history
- Detailed statistics

### P3 (Low Priority - Can Defer)
- Edge case handling
- Performance optimizations
- Notification edge cases
- Activity logging details

---

## Notes
- Slideshow functionality testing can be skipped to speed up test execution
- Media processing tests may use smaller test files to speed up execution
- Real-time features require Socket.IO test utilities
- Some tests may require mocking external services (S3, RabbitMQ, etc.)

