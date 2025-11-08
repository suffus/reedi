# Invitation Link Feature Plan

## Overview
Allow users to invite their friends to join Reedi via email. The invitation system should handle both new user signups and existing user friend requests.

## User Flow

### Flow 1: Inviting a New User
1. User clicks "Invite a Friend!" button in dashboard title bar
2. Popup modal appears with form:
   - Email address (required)
   - Friend's first name (required)
   - Custom message (optional, defaults to "Join me on Reedi!")
3. User submits form
4. System checks if email exists in database
5. If email doesn't exist:
   - Create invitation record
   - Send invitation email with unique signup link
   - Pre-populate email address in signup form
   - Show success message to inviter

### Flow 2: Inviting an Existing User
1. User clicks "Invite a Friend!" button
2. Popup modal appears with form
3. User submits form
4. System detects email is already registered
5. System:
   - Creates invitation record (marked as existing user)
   - Sends email with link to inviter's public profile
   - Automatically sends friend request in Reedi
   - Shows success message to inviter

## Database Schema

### New Table: `Invitation`

```prisma
model Invitation {
  id          String   @id @default(cuid())
  inviterId   String   // User who sent the invitation
  inviteeEmail String  // Email address of invitee
  inviteeName  String? // First name of invitee (optional)
  message     String?  // Custom message from inviter
  status      InvitationStatus @default(PENDING)
  isExistingUser Boolean @default(false) // Whether invitee was already a user
  friendRequestId String? // If existing user, link to friend request
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  acceptedAt  DateTime? // When invitation was accepted/signup completed
  
  inviter     User     @relation("SentInvitations", fields: [inviterId], references: [id], onDelete: Cascade)
  
  @@index([inviterId])
  @@index([inviteeEmail])
  @@index([status])
  @@map("invitations")
}

enum InvitationStatus {
  PENDING      // Invitation sent, awaiting response
  ACCEPTED     // Invitation accepted (user signed up or friend request accepted)
  EXPIRED      // Invitation expired (after 30 days)
  DECLINED     // Friend request declined (if existing user)
}
```

### Update User Model
Add relation to invitations:
```prisma
model User {
  // ... existing fields ...
  sentInvitations Invitation[] @relation("SentInvitations")
}
```

## Backend Implementation

### API Endpoints

#### 1. POST `/api/invitations`
Create a new invitation

**Request:**
```json
{
  "email": "friend@example.com",
  "name": "John",
  "message": "Join me on Reedi!" // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invitation": {
      "id": "...",
      "inviteeEmail": "friend@example.com",
      "status": "PENDING",
      "isExistingUser": false
    },
    "message": "Invitation sent successfully"
  }
}
```

**Logic:**
- Validate email format
- Check if email exists in User table
- If new user:
  - Create Invitation record with `isExistingUser: false`
  - Generate unique invitation token
  - Send invitation email with signup link
- If existing user:
  - Create Invitation record with `isExistingUser: true`
  - Send "already a member" email with inviter's profile link
  - Create FriendRequest if not already friends/requested
  - Update invitation with `friendRequestId`

#### 2. GET `/api/invitations`
Get user's sent invitations (with pagination)

**Response:**
```json
{
  "success": true,
  "data": {
    "invitations": [...],
    "pagination": {...}
  }
}
```

#### 3. GET `/api/invitations/:token/verify`
Verify invitation token for signup page

**Response:**
```json
{
  "success": true,
  "data": {
    "email": "friend@example.com",
    "name": "John",
    "inviterName": "Alice",
    "valid": true
  }
}
```

#### 4. POST `/api/invitations/:token/accept`
Mark invitation as accepted after signup

**Request:**
```json
{
  "userId": "new_user_id"
}
```

### Email Templates

#### 1. New User Invitation Email
**Subject:** `[Inviter Name] invited you to join Reedi!`

**Content:**
- Greeting with friend's name
- Custom message from inviter (or default)
- "Join Now" button/link with invitation token
- Link format: `/signup?invite=[token]&email=[email]`
- Expiration notice (valid for 30 days)

#### 2. Existing User Invitation Email
**Subject:** `[Inviter Name] wants to connect with you on Reedi`

**Content:**
- Greeting with friend's name
- Message: "[Inviter Name] is on Reedi and wants to connect with you!"
- "View Profile" button/link to inviter's public page
- Note: Friend request sent automatically
- "Accept Request" link (goes to friend requests page)

### Security Considerations

1. **Invitation Token Generation**
   - Use cryptographically secure random token (cuid or UUID)
   - Store hashed version in database
   - Include expiration (30 days)

2. **Rate Limiting**
   - Limit invitations per user (e.g., 10 per day)
   - Prevent spam by email validation
   - Check for duplicate pending invitations

3. **Email Verification**
   - Verify email format before sending
   - Check for disposable email addresses (optional)
   - Prevent self-invitations

4. **Token Security**
   - Tokens should be single-use for signup flow
   - Validate token on signup page load
   - Invalidate token after successful signup

## Frontend Implementation

### Components

#### 1. InviteButton Component
- Location: Dashboard title bar
- Icon: Envelope/UserPlus icon
- Text: "Invite a Friend!"
- Action: Opens InviteModal

#### 2. InviteModal Component
**Fields:**
- Email input (required, with validation)
- First name input (required)
- Message textarea (optional, with default "Join me on Reedi!")
- Character counter for message (optional, max 500 chars)
- Submit button: "Send Invitation"
- Cancel button: "Cancel"

**Validation:**
- Email format validation
- Check for empty fields
- Show loading state during submission
- Display success/error messages

#### 3. Signup Page Enhancement
**Route:** `/signup?invite=[token]&email=[email]`

**Features:**
- Pre-populate email field (read-only)
- Show inviter name: "You've been invited by [Name]!"
- Pre-populate name field if available
- Auto-verify invitation token on page load
- Mark invitation as accepted after successful signup

### API Integration

#### Hook: `useSendInvitation`
```typescript
const { mutate: sendInvitation, isPending } = useSendInvitation()

sendInvitation({
  email: "friend@example.com",
  name: "John",
  message: "Join me on Reedi!" // optional
})
```

#### Hook: `useVerifyInvitation`
```typescript
const { data, isLoading } = useVerifyInvitation(token)
// Returns invitation details if valid
```

## Edge Cases & Considerations

### 1. Duplicate Invitations
- Check if pending invitation exists for same email from same inviter
- If exists, return message: "You've already invited this person"
- Allow re-inviting if previous invitation expired

### 2. User Already Invited by Others
- Multiple users can invite same email address
- Track all invitations separately
- First signup marks all related invitations as accepted

### 3. Friend Request Handling
- Check if friend request already exists before creating
- Check if already friends before sending request
- Handle edge case where user deletes friend request before accepting invitation

### 4. Invitation Expiration
- Set expiration to 30 days
- Auto-mark as EXPIRED if not accepted
- Allow sending new invitation after expiration

### 5. Email Delivery Failures
- Handle bounce/error responses from email service
- Log failures for debugging
- Show generic success message to user (don't expose email issues)

### 6. Existing User Edge Cases
- User signs up after invitation sent but before email delivered
- Handle race condition in friend request creation
- Check user existence right before sending email (not just on creation)

### 7. Inviter Account Deletion
- Cascade delete invitations (or anonymize)
- Handle friend requests if inviter deleted

### 8. Privacy Considerations
- Don't expose inviter's email to invitee in email
- Only show inviter's public name and profile link
- Respect privacy settings for public profile link

## Email Service Integration

### Required Email Service Features
- Template support for HTML emails
- Personalization variables (name, message, links)
- Click tracking (optional)
- Delivery status tracking (optional)

### Email Variables

**New User Template:**
- `{{inviteeName}}` - Friend's first name
- `{{inviterName}}` - Inviter's display name
- `{{customMessage}}` - Custom message or default
- `{{signupLink}}` - Unique signup URL with token
- `{{expirationDays}}` - Days until expiration (30)

**Existing User Template:**
- `{{inviteeName}}` - Friend's first name
- `{{inviterName}}` - Inviter's display name
- `{{profileLink}}` - Inviter's public profile URL
- `{{friendRequestsLink}}` - Link to friend requests page

## Analytics & Tracking

### Metrics to Track
- Number of invitations sent per user
- Invitation acceptance rate
- Time between invitation and acceptance
- Most common invitation sources
- Friend request acceptance rate (from invitations)

### Events to Log
- Invitation sent
- Invitation email opened
- Signup link clicked
- Signup completed via invitation
- Friend request accepted from invitation

## Testing Considerations

### Unit Tests
- Invitation creation logic
- Email validation
- Duplicate invitation detection
- Friend request creation for existing users
- Token generation and validation

### Integration Tests
- Send invitation API endpoint
- Email sending integration
- Signup flow with invitation token
- Friend request creation flow
- Invitation expiration handling

### E2E Tests
- Complete invitation flow (new user)
- Complete invitation flow (existing user)
- Signup with pre-populated email
- Friend request acceptance

## Implementation Phases

### Phase 1: Core Invitation System
1. Database schema (Invitation table)
2. Backend API endpoints
3. Email templates
4. Basic invite modal UI
5. Invitation creation flow

### Phase 2: Signup Integration
1. Signup page enhancement for invitations
2. Token verification endpoint
3. Pre-populated form fields
4. Invitation acceptance tracking

### Phase 3: Existing User Flow
1. Email detection logic
2. Friend request auto-creation
3. Existing user email template
4. Friend request notification integration

### Phase 4: Polish & Optimization
1. Rate limiting
2. Analytics tracking
3. Error handling improvements
4. UI/UX refinements
5. Email delivery monitoring

## Future Enhancements

1. **Bulk Invitations**
   - Allow uploading CSV of email addresses
   - Batch invitation sending

2. **Invitation Rewards**
   - Gamification: points for successful invitations
   - Badge system for active inviters

3. **Social Sharing**
   - Share invitation link on social media
   - Custom referral codes

4. **Invitation Dashboard**
   - View all sent invitations
   - Track acceptance status
   - Resend invitations

5. **Invitation Groups**
   - Group invitations for events/projects
   - Track group acceptance rates


