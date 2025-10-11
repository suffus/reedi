# Test Data Reference

This document describes all the test data seeded in the test database.

## Quick Stats

- **5 Users** (alice, bob, charlie, david, eve)
- **11 Media Items** (images and videos with various states)
- **5 Galleries** (organized collections)
- **14 Posts** (with various visibility and status)
- **10 Groups** (4 public, 4 semi-private, 2 private)
- **6 Conversations** (4 direct, 2 group)
- **15 Messages** (with reactions and delivery statuses)
- **24 Hashtags** (for post discovery)

## Test Users

All users have password: `Test123!`

### 1. Alice (@alice_test)
- **Email:** alice@test.com
- **Profile:** Regular user, active content sharer
- **Friends:** Bob, Charlie
- **Follows:** Charlie
- **Media:** 4 items (vacation photos, family photo, birthday video, private note)
- **Galleries:** 2 (Summer Vacation, Family Moments)
- **Posts:** 3 (with media, mixed visibility)
- **Groups:** Member of Tech Enthusiasts, Photography Club, Gaming Community, Local Buy & Sell, React Developers, Professional Photographers, Freelance Collective, Content Creators Inner Circle, Family & Close Friends
- **Messages:** Active in 4 conversations

### 2. Bob (@bob_test)
- **Email:** bob@test.com
- **Profile:** Tech enthusiast, tutorial creator
- **Friends:** Alice, David
- **Followed by:** Alice, David
- **Media:** 3 items (office photo, tutorial video, pending image)
- **Galleries:** 1 (Work & Tech)
- **Posts:** 4 (including 1 paused draft)
- **Groups:** Owner of Tech Enthusiasts, React Developers; Member of Photography Club, Gaming Community, Job Opportunities, Freelance Collective, Family & Close Friends
- **Messages:** Active in 5 conversations

### 3. Charlie (@charlie_test)
- **Email:** charlie@test.com
- **Profile:** Content creator with locked posts feature
- **Can Publish Locked Media:** ✅ Yes
- **Friends:** Alice, David
- **Follows:** Alice
- **Followed by:** Alice, Bob, David
- **Media:** 4 items (vlog, landscape, portrait, failed video)
- **Galleries:** 2 (Photography Portfolio, Daily Vlogs)
- **Posts:** 5 (including 1 locked premium post at $9.99)
- **Groups:** Owner of Photography Club, Professional Photographers, Content Creators Inner Circle; Member of Tech Enthusiasts, Local Buy & Sell, Job Opportunities, Freelance Collective
- **Messages:** Active in 4 conversations
- **Pending Application:** React Developers group

### 4. David (@david_test)
- **Email:** david@test.com
- **Profile:** New user, text-only posts
- **Friends:** Bob, Charlie
- **Follows:** Charlie
- **Media:** None
- **Posts:** 2 (text only, no media)
- **Groups:** Owner of Gaming Community, Job Opportunities; Admin of Tech Enthusiasts; Moderator of Local Buy & Sell
- **Messages:** Active in 3 conversations

### 5. Eve (@eve_test)
- **Email:** eve@test.com
- **Profile:** Private account, no public activity
- **Is Private:** ✅ Yes
- **Friends:** None
- **Posts:** 0 (intentionally has no posts)
- **Groups:** Member of Family & Close Friends
- **Pending Request:** Sent friend request to Alice
- **Messages:** None

## Media Items (11 total)

### Alice's Media (4)
1. **vacation-photo.jpg** - IMAGE, PUBLIC, COMPLETED
   - Tags: vacation, beach, sunset
   - In gallery: Summer Vacation 2024
   - Attached to: Post "Summer Vacation Highlights"

2. **family-dinner.jpg** - IMAGE, FRIENDS_ONLY, COMPLETED
   - Tags: family, dinner
   - In gallery: Family Moments
   - Attached to: Family dinner post

3. **birthday-party.mp4** - VIDEO, PUBLIC, COMPLETED
   - Tags: birthday, celebration, party
   - In gallery: Summer Vacation 2024
   - Attached to: Post "Summer Vacation Highlights"
   - Video metadata: 1920x1080, 45s, h264, 30fps

4. **private-note.jpg** - IMAGE, PRIVATE, COMPLETED
   - Tags: private, personal
   - Not in any gallery

### Bob's Media (3)
1. **office-view.jpg** - IMAGE, PUBLIC, COMPLETED
   - Tags: work, office
   - In gallery: Work & Tech
   - Attached to: Post "New Office Setup Complete!"

2. **coding-tutorial.mp4** - VIDEO, PUBLIC, COMPLETED
   - Tags: coding, tutorial, react
   - In gallery: Work & Tech
   - Attached to: Post "Learn React in 2024"
   - Video metadata: 1920x1080, 120s, h264, 30fps

3. **processing.jpg** - IMAGE, PUBLIC, PENDING
   - Tags: pending
   - Not in any gallery (for testing pending status)

### Charlie's Media (4)
1. **daily-vlog.mp4** - VIDEO, PUBLIC, COMPLETED
   - Tags: vlog, daily, lifestyle
   - In gallery: Daily Vlogs
   - Attached to: Post "Day in My Life"
   - Video metadata: 3840x2160 (4K), 180s, h264, 60fps

2. **landscape.jpg** - IMAGE, PUBLIC, COMPLETED
   - Tags: photography, landscape, mountains, nature
   - In gallery: Photography Portfolio
   - Attached to: Posts "My Latest Photography Work" and "Premium Photography Tutorial" (locked)

3. **portrait-session.jpg** - IMAGE, PUBLIC, COMPLETED
   - Tags: photography, portrait, professional
   - In gallery: Photography Portfolio
   - Attached to: Posts "My Latest Photography Work" and "Premium Photography Tutorial" (locked)

4. **corrupted-video.mp4** - VIDEO, PUBLIC, FAILED
   - Tags: failed
   - Not in any gallery (for testing failed processing)

## Galleries (5 total)

### Alice's Galleries (2)
1. **Summer Vacation 2024** - PUBLIC
   - Description: "Our amazing summer vacation at the beach"
   - Cover: vacation-photo.jpg
   - Items: 2 (vacation photo, birthday video)

2. **Family Moments** - FRIENDS_ONLY
   - Description: "Special moments with my family"
   - Cover: family-dinner.jpg
   - Items: 1 (family photo)

### Bob's Gallery (1)
1. **Work & Tech** - PUBLIC
   - Description: "My workspace and coding tutorials"
   - Cover: office-view.jpg
   - Items: 2 (office photo, tutorial video)

### Charlie's Galleries (2)
1. **Photography Portfolio** - PUBLIC
   - Description: "My best photography work"
   - Cover: landscape.jpg
   - Items: 2 (landscape, portrait)

2. **Daily Vlogs** - PUBLIC
   - Description: "Daily life vlogs and behind the scenes"
   - Cover: daily-vlog.mp4
   - Items: 1 (daily vlog)

## Posts (14 total)

### Alice's Posts (3)
1. **"Summer Vacation Highlights"** - PUBLIC, 2 media
   - Hashtags: #travel, #vacation
   - Media: vacation photo, birthday video

2. **Family dinner post** - FRIENDS_ONLY, 1 media
   - Content: "Family dinner was so special tonight..."
   - Media: family photo

3. **Beach day text post** - PUBLIC, no media
   - Content: "Just had an amazing day at the beach..."
   - Hashtags: #beach, #sunset, #vacation

### Bob's Posts (4)
1. **"Learn React in 2024 - Complete Tutorial"** - PUBLIC, 1 media
   - Hashtags: #coding, #react, #tutorial, #webdev
   - Media: tutorial video

2. **"New Office Setup Complete!"** - PUBLIC, 1 media
   - Hashtags: #workspace, #productivity
   - Media: office photo

3. **JavaScript features text post** - PUBLIC, no media
   - Hashtags: #javascript, #programming

4. **Draft post** - PUBLIC, PAUSED (not visible)
   - Content: "This is a draft post..."

### Charlie's Posts (5)
1. **"Day in My Life - Behind the Scenes"** - PUBLIC, 1 media
   - Hashtags: #vlog, #lifestyle, #daily
   - Media: daily vlog

2. **"My Latest Photography Work"** - PUBLIC, 2 media
   - Hashtags: #photography, #landscape, #nature
   - Media: landscape, portrait

3. **"🔒 Premium Photography Tutorial"** - PUBLIC, LOCKED 🔒
   - **Unlock Price: $9.99**
   - Hashtags: #premium, #tutorial, #photography
   - Media: 2 locked items (landscape, portrait)

4. **"Big Announcement Coming Soon! 🎊"** - PUBLIC, no media
   - Hashtag: #announcement

5. **Personal note** - PRIVATE, no media
   - Content: "Personal note to self..."

### David's Posts (2)
1. **"Hello Everyone!"** - PUBLIC, no media
   - Hashtags: #introduction, #newhere

2. **Productivity app discussion** - PUBLIC, no media
   - Hashtags: #productivity, #apps

### Eve's Posts (0)
- Intentionally has no posts for testing

## Groups (10 total)

### PUBLIC Groups (4)

#### 1. Tech Enthusiasts (@tech_enthusiasts)
- **Owner:** Bob
- **Type:** SOCIAL_LEARNING
- **Moderation:** NO_MODERATION
- **Description:** "A community for technology lovers, developers, and innovators"
- **Members:** 4 (Bob as OWNER, David as ADMIN, Alice, Charlie as MEMBER)
- **Posts:** 1 (Bob's React tutorial)

#### 2. Photography Club (@photo_club)
- **Owner:** Charlie
- **Type:** GENERAL
- **Moderation:** NO_MODERATION
- **Description:** "Share your photography, get feedback, and learn"
- **Members:** 3 (Charlie as OWNER, Alice as MODERATOR, Bob as MEMBER)
- **Posts:** 1 (Charlie's portfolio)

#### 3. Gaming Community (@gaming_community)
- **Owner:** David
- **Type:** GAMING
- **Moderation:** NO_MODERATION
- **Description:** "For gamers of all platforms!"
- **Members:** 3 (David as OWNER, Bob as ADMIN, Alice as MEMBER)
- **Posts:** 1 (pending approval)

#### 4. Local Buy & Sell (@local_marketplace)
- **Owner:** Alice
- **Type:** BUY_SELL
- **Moderation:** ADMIN_APPROVAL_REQUIRED
- **Description:** "Buy, sell, and trade locally"
- **Members:** 3 (Alice as OWNER, David as MODERATOR, Charlie as MEMBER)
- **Posts:** 1 (pending approval)

### PRIVATE_VISIBLE Groups (4)

#### 5. React Developers (@react_devs)
- **Owner:** Bob
- **Type:** SOCIAL_LEARNING
- **Moderation:** ADMIN_APPROVAL_REQUIRED
- **Description:** "Private community for React developers"
- **Members:** 3 (Bob as OWNER, Alice as ADMIN, David as MEMBER)
- **Pending Application:** Charlie
- **Posts:** 1 (Bob's post)

#### 6. Professional Photographers (@pro_photographers)
- **Owner:** Charlie
- **Type:** WORK
- **Moderation:** ADMIN_APPROVAL_REQUIRED
- **Description:** "Exclusive group for professional photographers"
- **Members:** 2 (Charlie as OWNER, Alice as MEMBER)

#### 7. Job Opportunities (@job_opportunities)
- **Owner:** David
- **Type:** JOBS
- **Moderation:** ADMIN_APPROVAL_REQUIRED
- **Description:** "Curated job postings for tech professionals"
- **Members:** 3 (David as OWNER, Bob as ADMIN, Charlie as MEMBER)

#### 8. Freelance Collective (@freelance_collective)
- **Owner:** Alice
- **Type:** WORK
- **Moderation:** SELECTIVE_MODERATION
- **Description:** "Support group for freelancers"
- **Members:** 3 (Alice as OWNER, Charlie as ADMIN, Bob as MEMBER)

### PRIVATE_HIDDEN Groups (2)

#### 9. Content Creators Inner Circle (@creators_circle)
- **Owner:** Charlie
- **Type:** WORK
- **Moderation:** NO_MODERATION
- **Description:** "Private mastermind group for content creators"
- **Members:** 2 (Charlie as OWNER, Alice as ADMIN)
- **Pending Invitation:** Bob (invite code: CREATOR_BOB_2024)

#### 10. Family & Close Friends (@alice_inner_circle)
- **Owner:** Alice
- **Type:** PARENTING
- **Moderation:** NO_MODERATION
- **Description:** "Private group for family updates"
- **Members:** 3 (Alice as OWNER, Bob, Eve as MEMBER)

## Conversations & Messages

### Direct Conversations (4)

#### 1. Alice ↔ Bob (4 messages)
- Most recent conversation
- Includes text and image messages
- Message with media attachment (vacation photo)
- Message reactions (❤️)
- Various delivery statuses

**Messages:**
1. Alice: "Hey Bob! How are you doing?" (2h ago, READ)
2. Bob: "Hi Alice! I'm great..." (1.5h ago, READ)
3. Alice: "Check out this photo..." with media (30m ago, READ, ❤️ reaction)
4. Bob: "Beautiful! Looks like you had..." (15m ago, DELIVERED)

#### 2. Alice ↔ Charlie (3 messages)
- About photography collaboration
- All READ status

**Messages:**
1. Alice: "Hey Charlie! I saw your photography..." (1 day ago, READ)
2. Charlie: "Thanks Alice! Would you be interested..." (22h ago, READ)
3. Alice: "Absolutely! Let's plan something..." (20h ago, DELIVERED)

#### 3. Bob ↔ David (2 messages)
- Welcome conversation
- All READ status

**Messages:**
1. David: "Hey Bob, welcome to the platform!" (2 days ago, READ)
2. Bob: "Thanks David! Happy to be here." (47h ago, READ)

#### 4. Charlie ↔ David (1 message)
- Recent message about vlog

**Messages:**
1. Charlie: "David, check out my new vlog!" (12h ago, SENT)

### Group Conversations (2)

#### 5. Tech Talk (3 participants: Alice, Bob, Charlie)
- Created by Bob (ADMIN)
- 3 messages
- Active discussion about technology

**Messages:**
1. Bob: "Hey everyone! Created this group..." (6h ago, READ by Alice & Charlie)
2. Alice: "Great idea! I've been learning about web3..." (5h ago, READ by Bob, DELIVERED to Charlie)
3. Charlie: "Nice! I'm more into content creation..." (3h ago, READ by Alice, DELIVERED to Bob)

#### 6. Weekend Plans 🎉 (4 participants: Alice, Bob, Charlie, David)
- Created by Alice (ADMIN)
- 2 messages
- Recent activity about meetup

**Messages:**
1. Alice: "Anyone up for a meetup this weekend?" (10m ago, READ by Bob, DELIVERED to Charlie, SENT to David, 👍 reaction from Bob)
2. Bob: "I'm in! Let's do it 🙌" (5m ago, READ by Alice, DELIVERED to Charlie, SENT to David)

## Hashtags (24 total)

Most popular:
- #vacation (2 posts)
- #tutorial (2 posts)
- #productivity (2 posts)
- #photography (2 posts)

All hashtags: beach, sunset, vacation, travel, family, coding, react, tutorial, webdev, workspace, productivity, javascript, programming, vlog, daily, lifestyle, photography, landscape, nature, portrait, premium, announcement, introduction, newhere, apps

## Testing Scenarios Covered

### User Scenarios
- ✅ Regular active users
- ✅ Private accounts
- ✅ Users with no posts
- ✅ Content creators with locked content
- ✅ Various relationship states (friends, followers, pending requests)

### Media Scenarios
- ✅ Images and videos
- ✅ Various processing states (completed, pending, failed)
- ✅ Different visibility levels
- ✅ Organized vs unorganized media
- ✅ Media with different dimensions and metadata
- ✅ Media in messages

### Post Scenarios
- ✅ Posts with/without titles
- ✅ Posts with/without media
- ✅ Multiple visibility levels
- ✅ Publication statuses (public, paused)
- ✅ Locked premium posts with pricing
- ✅ Hashtag filtering

### Group Scenarios
- ✅ Different visibility levels (public, semi-private, private)
- ✅ Various group types
- ✅ Different moderation policies
- ✅ Member roles (owner, admin, moderator, member)
- ✅ Pending applications
- ✅ Group invitations
- ✅ Group posts (approved, pending)

### Message Scenarios
- ✅ Direct conversations
- ✅ Group conversations
- ✅ Text messages
- ✅ Messages with media attachments
- ✅ Message reactions
- ✅ Delivery statuses (sent, delivered, read)
- ✅ Read/unread messages

## Database Connection

```
postgres://postgres:te1twe5tX1966@localhost:5432/reeditestdb
```

## Seeding Commands

```bash
# Minimal seed (5 users, basic data)
npm run test:seed

# Full seed (10+ users, extended data)
npm run test:seed:full

# Reset and reseed
npm run test:seed:reset

# Teardown (clean database)
npm run test:teardown
```

## Notes

- All users have the same password: `Test123!`
- Media files are database records only (no actual files uploaded to S3)
- Timestamps are relative to seed time for realistic testing
- Eve intentionally has minimal activity for testing edge cases
- Charlie has the `canPublishLockedMedia` flag for testing premium content

