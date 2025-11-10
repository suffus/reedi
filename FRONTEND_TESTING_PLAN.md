# Frontend Testing Implementation Plan

## Overview

Comprehensive testing strategy for the Reedi frontend using Jest + React Testing Library with MSW for API mocking. Focus on component tests, hook tests, and integration tests that verify user interactions and data flow.

## Current State

**Existing Infrastructure:**
- ✅ Jest configured with Next.js support
- ✅ React Testing Library set up
- ✅ jsdom test environment
- ✅ Some existing tests (Header, API hooks, etc.)
- ✅ Module path aliases configured (`@/`)

**What We Have:**
- 5 component tests
- 1 hook test suite
- 2 page tests
- 1 utility test

**What We Need:**
- ~150+ component tests
- ~30+ hook tests
- ~40+ integration tests
- MSW setup for API mocking

## Technology Stack

### Core Testing Tools
- **Jest** - Test runner (already configured)
- **React Testing Library** - Component testing (already installed)
- **@testing-library/user-event** - User interaction simulation (already used)
- **@testing-library/react-hooks** - Hook testing (for complex hooks)

### API Mocking
- **MSW (Mock Service Worker)** - Intercept API calls
  - Works in both tests and browser
  - More realistic than manual mocks
  - Easier to maintain and reuse

### Additional Tools
- **@testing-library/jest-dom** - Custom matchers (already configured)
- **jest-environment-jsdom** - Browser-like environment (already configured)

## Testing Strategy

### Testing Pyramid
- **60% Component Tests** - Individual component behavior
- **25% Integration Tests** - Multiple components working together
- **15% Hook Tests** - Complex React Query hooks and custom hooks

## Priority Levels

### P0 - Critical (Must Have)
Core user flows and critical components that handle data mutations

### P1 - High Priority
Important features with complex logic

### P2 - Medium Priority
Supporting components and utilities

### P3 - Low Priority
Simple presentational components

---

## P0 - Critical Tests (Week 1-2)

### 1. API Hooks Tests (Expand Existing)
**File:** `__tests__/hooks/api-hooks.test.tsx`

**Coverage Needed:**
- ✅ useAuth (done)
- ✅ usePostsFeed (done)
- ✅ useCreatePost (done)
- ⏳ useUpdatePost
- ⏳ useDeletePost
- ⏳ useUserMedia (media gallery)
- ⏳ useBulkUpdateMedia (tag merging, visibility)
- ⏳ useCreateGallery
- ⏳ useUpdateGallery
- ⏳ useAddMediaToGallery
- ⏳ useRemoveMediaFromGallery
- ⏳ useReorderGalleryMedia
- ⏳ useDeleteGallery
- ⏳ useSendFriendRequest
- ⏳ useAcceptFriendRequest
- ⏳ useFollowUser
- ⏳ useCreateGroup
- ⏳ useUpdateGroup

**Why Critical:** These hooks handle all data mutations and are used throughout the app.

**Estimated:** 40 test cases

---

### 2. Media Uploader Component
**File:** `__tests__/components/dashboard/media-uploader.test.tsx`

**Test Cases:**
- Render upload dropzone
- Handle file drag and drop
- Validate file types (images/videos only)
- Validate file size limits
- Show upload progress
- Handle multiple file uploads
- Display upload errors
- Cancel upload in progress
- Retry failed uploads
- Show success state after upload
- Integration with chunked upload service

**Why Critical:** Core feature for content creation.

**Estimated:** 15 test cases

---

### 3. Post Composer Component
**File:** `__tests__/components/common/post-composer.test.tsx`

**Test Cases:**
- Render empty composer
- Type post content
- Add media to post
- Remove media from post
- Select visibility (PUBLIC, FRIENDS_ONLY, PRIVATE)
- Add hashtags
- Create locked post (if permitted)
- Set unlock price for locked posts
- Submit post
- Handle submission errors
- Show character count
- Disable submit when empty
- Validate required fields
- Save draft on unmount

**Why Critical:** Primary content creation interface.

**Estimated:** 18 test cases

---

### 4. Bulk Edit Modal
**File:** `__tests__/components/dashboard/bulk-edit-modal.test.tsx`

**Test Cases:**
- Render with selected media
- Update tags (replace mode)
- Update tags (merge mode)
- Update visibility
- Update description
- Preview changes
- Apply changes to all selected
- Handle partial failures
- Show success/error messages
- Close modal after save
- Cancel without saving

**Why Critical:** Important workflow for media management.

**Estimated:** 12 test cases

---

### 5. Gallery Management Components
**Files:**
- `__tests__/components/dashboard/new-gallery-modal.test.tsx`
- `__tests__/components/dashboard/gallery-detail-modal.test.tsx`

**Test Cases (New Gallery):**
- Render modal
- Enter gallery name
- Enter description
- Select cover image
- Set visibility
- Create gallery
- Handle creation errors
- Validate required fields

**Test Cases (Gallery Detail):**
- Display gallery info
- Show media grid
- Add media to gallery
- Remove media from gallery
- Reorder media (drag and drop)
- Edit gallery details
- Delete gallery
- Handle empty gallery

**Why Critical:** Core organizational feature.

**Estimated:** 20 test cases

---

### 6. Authentication Flow
**Files:**
- `__tests__/components/auth-section.test.tsx` (expand existing)
- `__tests__/components/complete-registration.test.tsx`

**Test Cases (Auth Section):**
- Show login form
- Submit login credentials
- Show validation errors
- Handle login success
- Handle login failure
- Show registration form
- Submit registration
- Toggle between login/register

**Test Cases (Complete Registration):**
- Render form for new user
- Enter username
- Upload avatar
- Add bio
- Submit profile
- Handle submission errors
- Skip optional fields

**Why Critical:** User onboarding.

**Estimated:** 16 test cases

---

## P1 - High Priority Tests (Week 3-4)

### 7. User Gallery Component
**File:** `__tests__/components/dashboard/user-gallery.test.tsx`

**Test Cases:**
- Render media grid
- Filter by media type (images/videos)
- Filter by tags
- Filter by processing status
- Search by name/caption
- Select single media
- Select multiple media
- Bulk actions menu
- Open media detail modal
- Infinite scroll loading
- Handle empty state
- Handle loading state

**Estimated:** 15 test cases

---

### 8. Media Detail Modal
**Files:**
- `__tests__/components/dashboard/image-detail-modal.test.tsx` (expand)
- `__tests__/components/dashboard/video-detail-modal.test.tsx`

**Test Cases:**
- Display media
- Show metadata
- Edit title/caption
- Add/remove tags
- Change visibility
- Navigate prev/next
- Download media
- Delete media
- Add to gallery
- Show in post
- Close modal
- Keyboard navigation

**Estimated:** 18 test cases

---

### 9. Friend Requests Component
**File:** `__tests__/components/dashboard/friend-requests.test.tsx`

**Test Cases:**
- Display pending requests
- Accept friend request
- Reject friend request
- Send friend request
- Cancel sent request
- Show empty state
- Handle errors
- Update count badge

**Estimated:** 10 test cases

---

### 10. Groups Components
**Files:**
- `__tests__/components/create-group-modal.test.tsx`
- `__tests__/components/group-profile.test.tsx`
- `__tests__/components/group-settings-modal.test.tsx`

**Test Cases:**
- Create group form
- Set group visibility
- Choose moderation policy
- View group profile
- Join/leave group
- Post to group
- Moderate posts
- Invite members
- Edit group settings
- View member list

**Estimated:** 20 test cases

---

### 11. Messaging Components
**Files:**
- `__tests__/components/messaging/messaging-app.test.tsx`
- `__tests__/components/messaging/conversation-list.test.tsx`
- `__tests__/components/messaging/message-input.test.tsx`

**Test Cases:**
- Display conversation list
- Select conversation
- Load messages
- Send text message
- Show typing indicator
- Real-time message updates
- Create new conversation
- Search conversations
- Mark as read
- Delete conversation

**Estimated:** 18 test cases

---

### 12. Search Components
**File:** `__tests__/components/image-search.test.tsx`

**Test Cases:**
- Enter search query
- Search by content type
- Filter results
- Display results grid
- Pagination
- Handle empty results
- Clear search
- Search suggestions

**Estimated:** 10 test cases

---

### 13. User Profile Components
**Files:**
- `__tests__/components/user-profile.test.tsx`
- `__tests__/components/dashboard/profile-editor.test.tsx`

**Test Cases:**
- Display user info
- Show user stats
- View user posts
- View user galleries
- Follow/unfollow user
- Edit profile
- Update avatar
- Update bio
- Privacy settings

**Estimated:** 15 test cases

---

## P2 - Medium Priority Tests (Week 5)

### 14. Post Display Components
**Files:**
- `__tests__/components/dashboard/personal-feed.test.tsx` (expand)
- `__tests__/components/dashboard/post-menu.test.tsx` (expand)
- `__tests__/components/latest-posts.tsx`

**Test Cases:**
- Display post list
- Show post content
- Display media
- React to post (like, love, etc.)
- Comment on post
- Edit own post
- Delete own post
- Report post
- Share post
- Expand/collapse long posts

**Estimated:** 16 test cases

---

### 15. Media Grid Components
**Files:**
- `__tests__/components/media-grid.test.tsx`
- `__tests__/components/image-grid.test.tsx`

**Test Cases:**
- Render grid layout
- Responsive columns
- Lazy load images
- Handle aspect ratios
- Show video indicators
- Click to open detail
- Multi-select mode
- Empty state

**Estimated:** 10 test cases

---

### 16. Common UI Components
**Files:**
- `__tests__/components/common/modal-event-catcher.test.tsx`
- `__tests__/components/common/toast.test.tsx`
- `__tests__/components/tag-input.test.tsx`
- `__tests__/components/lazy-image.test.tsx`

**Test Cases:**
- Modal keyboard events
- Toast notifications
- Tag input (add/remove)
- Image lazy loading
- Progressive image loading

**Estimated:** 12 test cases

---

### 17. Custom Hooks
**Files:**
- `__tests__/hooks/use-image-selection.test.tsx`
- `__tests__/hooks/use-infinite-images.test.tsx`
- `__tests__/hooks/use-slideshow.test.tsx`

**Test Cases:**
- Select/deselect images
- Select all/none
- Infinite scroll logic
- Slideshow controls
- Keyboard navigation

**Estimated:** 12 test cases

---

## P3 - Low Priority Tests (Week 6)

### 18. Presentational Components
**Files:**
- `__tests__/components/header.test.tsx` (expand existing)
- `__tests__/components/footer.test.tsx`
- `__tests__/components/hero-section.test.tsx`

**Test Cases:**
- Navigation links
- Mobile menu
- Logo display
- Footer links
- Hero content

**Estimated:** 8 test cases

---

## Integration Tests

### 19. Complete User Workflows
**File:** `__tests__/integration/user-workflows.test.tsx`

**Test Scenarios:**
1. **Upload & Post Workflow**
   - Upload media
   - Create post with media
   - Verify post appears in feed

2. **Gallery Workflow**
   - Create gallery
   - Add media to gallery
   - Reorder media
   - Share gallery

3. **Social Interaction Workflow**
   - Send friend request
   - Accept request
   - View friend's posts
   - Comment on post

4. **Group Workflow**
   - Create group
   - Invite member
   - Post to group
   - View group feed

5. **Search & Discover Workflow**
   - Search for users
   - Follow user
   - Search for content
   - Filter results

**Estimated:** 25 test cases

---

## MSW Setup

### Configuration
**File:** `__tests__/mocks/handlers.ts`

**Mock Endpoints:**
- `/api/auth/*` - Authentication
- `/api/posts/*` - Posts CRUD
- `/api/media/*` - Media management
- `/api/galleries/*` - Gallery operations
- `/api/friends/*` - Friend requests
- `/api/groups/*` - Group management
- `/api/messages/*` - Messaging
- `/api/search/*` - Search
- `/api/users/*` - User profiles

**Setup Files:**
- `__tests__/mocks/server.ts` - MSW server setup
- `__tests__/mocks/handlers.ts` - Request handlers
- `jest.setup.js` - Add MSW initialization

---

## Test Utilities

### Shared Test Helpers
**File:** `__tests__/utils/test-helpers.tsx`

**Helpers:**
- `renderWithProviders()` - Wrap with QueryClient, Router, etc.
- `createMockUser()` - Mock user data
- `createMockPost()` - Mock post data
- `createMockMedia()` - Mock media data
- `mockIntersectionObserver()` - For lazy loading tests
- `mockFile()` - Create test File objects
- `waitForLoadingToFinish()` - Wait for async operations

---

## Coverage Goals

### Target Coverage
- **Component Tests:** 80% coverage
- **Hook Tests:** 90% coverage
- **Integration Tests:** Key workflows covered
- **Overall:** 75% code coverage minimum

### Coverage Reports
- Run `npm test -- --coverage` to generate reports
- View coverage in `coverage/lcov-report/index.html`
- Track coverage trends over time

---

## Implementation Timeline

### Week 1-2: P0 Critical Tests
- Day 1-2: MSW setup + API hooks expansion
- Day 3-4: Media Uploader + Post Composer
- Day 5-6: Bulk Edit Modal
- Day 7-8: Gallery components
- Day 9-10: Authentication flow

### Week 3-4: P1 High Priority Tests
- Day 11-12: User Gallery + Media Detail
- Day 13-14: Friend Requests + Groups
- Day 15-16: Messaging components
- Day 17-18: Search + User Profile

### Week 5: P2 Medium Priority Tests
- Day 19-20: Post Display components
- Day 21-22: Media Grid + Common UI
- Day 23-24: Custom Hooks

### Week 6: P3 & Integration
- Day 25-26: Presentational components
- Day 27-28: Integration tests
- Day 29-30: Documentation + coverage review

---

## Commands

### Run Tests
```bash
cd frontend

# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test -- media-uploader.test.tsx

# Run with coverage
npm test -- --coverage

# Update snapshots
npm test -- -u
```

### Debug Tests
```bash
# Run tests with debugging
node --inspect-brk node_modules/.bin/jest --runInBand

# Use VS Code Jest extension for inline debugging
```

---

## Best Practices

### Component Testing
1. **Test behavior, not implementation**
   - Focus on what users see and do
   - Don't test internal state directly
   - Use accessible queries (getByRole, getByLabelText)

2. **Arrange-Act-Assert pattern**
   - Set up test data
   - Simulate user action
   - Assert expected outcome

3. **Avoid testing library internals**
   - Don't test React Query cache directly
   - Don't test component lifecycle methods
   - Test the result of those behaviors

### Hook Testing
1. **Use renderHook from RTL**
   - Wrap hooks in QueryClientProvider
   - Use waitFor for async operations
   - Test both success and error cases

2. **Mock network requests with MSW**
   - More realistic than mocking fetch directly
   - Reusable across tests
   - Easier to maintain

### Integration Testing
1. **Test realistic user workflows**
   - Multiple steps in sequence
   - Verify data flow between components
   - Test error boundaries

2. **Use actual components**
   - Don't mock child components
   - Only mock external services (API)
   - Test accessibility along the way

---

## Key Differences from Backend Testing

### Asynchronous Rendering
- Components render asynchronously
- Use `waitFor` for async assertions
- Use `findBy*` queries for async elements

### User Interactions
- Use `userEvent` over `fireEvent`
- Simulate realistic typing, clicking
- Wait for loading states to resolve

### React Query
- Always wrap in QueryClientProvider
- Reset query cache between tests
- Mock API responses with MSW

### Next.js Specifics
- Mock `next/router` for navigation tests
- Mock `next/link` for Link components
- Mock `next/image` for Image components

---

## Success Criteria

### Test Quality
- ✅ All critical user flows covered
- ✅ Edge cases and error states tested
- ✅ Accessibility tested (keyboard nav, screen readers)
- ✅ No flaky tests (consistent passes)
- ✅ Fast test execution (<10 min for full suite)

### Coverage Metrics
- ✅ 80%+ component coverage
- ✅ 90%+ hook coverage
- ✅ All major features tested
- ✅ All data mutations tested

### Documentation
- ✅ Test helpers documented
- ✅ MSW handlers documented
- ✅ Testing patterns explained
- ✅ Contribution guide for new tests

---

## Next Steps After This Plan

1. **Set up MSW** - Install and configure for API mocking
2. **Create test utilities** - Shared helpers and providers
3. **Expand API hooks tests** - Complete all mutation hooks
4. **Implement P0 tests** - Focus on critical components
5. **Add integration tests** - Key user workflows
6. **Review and iterate** - Based on coverage reports

Then later:
- Add Playwright for E2E tests
- Add visual regression testing (Chromatic/Percy)
- Set up CI/CD integration
- Add performance testing

---

## Estimated Total
- **Component Tests:** ~140 test cases
- **Hook Tests:** ~52 test cases
- **Integration Tests:** ~25 test cases
- **Total:** ~217 test cases (frontend unit + integration)
- **Time:** 6 weeks for comprehensive coverage










