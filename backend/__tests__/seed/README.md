# Test Data Seeding

Comprehensive test data generation for the Reedi platform test database.

## Quick Start

```bash
# 1. Create test database
createdb reeditestdb

# 2. Sync schema to test database
cd backend
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/reeditestdb"
npx prisma db push

# 3. Seed test data
export TEST_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/reeditestdb"
npx tsx __tests__/seed/seed.ts

# Or with reset
npx tsx __tests__/seed/seed.ts --reset
```

## What Gets Seeded

### Minimal Mode (Default)
- **5 Users** with varied profiles and permissions
- **11 Media Items** (images and videos with different states)
- **5 Galleries** with organized collections
- **14 Posts** with various visibility and features
- **10 Groups** (4 public, 4 semi-private, 2 private)
- **6 Conversations** (4 direct, 2 group chats)
- **15 Messages** with reactions and delivery tracking
- **24 Hashtags** for content discovery
- **Friend relationships** and pending requests
- **Follow relationships**
- **Group memberships** with different roles
- **Group applications** and invitations

### Extended Mode
Additional users and content for comprehensive E2E testing.

```bash
npx tsx __tests__/seed/seed.ts --extended
```

## Seed Generators

Each generator creates a specific type of test data:

### `generators/users.ts`
- Creates test users with realistic profiles
- Configures special permissions (e.g., locked media publishing)
- Sets up private/public accounts

### `generators/relationships.ts`
- Creates friendships between users
- Seeds follow relationships
- Generates pending friend requests

### `generators/media.ts`
- Creates media records (images and videos)
- Various processing states (completed, pending, failed)
- Different visibility levels
- Includes metadata (dimensions, duration, codec, etc.)

### `generators/galleries.ts`
- Organizes media into galleries
- Sets cover photos
- Different visibility levels
- Tests media ordering

### `generators/posts.ts`
- Creates posts with varied content
- Attaches media to posts
- Tests locked posts with pricing
- Generates hashtags
- Various publication statuses

### `generators/groups.ts`
- Creates groups with different visibility levels
- Seeds group memberships with roles
- Generates group posts (approved/pending)
- Creates applications and invitations

### `generators/messages.ts`
- Creates direct and group conversations
- Seeds messages with timestamps
- Attaches media to messages
- Creates message reactions
- Tracks delivery status (sent/delivered/read)

## Test Users

All users have password: **`Test123!`**

| User | Email | Username | Role | Special Features |
|------|-------|----------|------|------------------|
| Alice | alice@test.com | alice_test | Regular user | Active social user |
| Bob | bob@test.com | bob_test | Tech creator | Tutorial creator |
| Charlie | charlie@test.com | charlie_test | Content creator | Can publish locked posts |
| David | david@test.com | david_test | New user | Text-only posts |
| Eve | eve@test.com | eve_test | Private user | No posts, private account |

## Data Statistics

After running the seed script:

```
📊 COMPLETE TEST DATA STATISTICS
==================================================
👥 Users:            5
🤝 Friendships:      4
⏳ Pending Requests: 1
👁️  Follows:          4
📸 Media Items:      11
🖼️  Galleries:        5
📝 Posts:            14
#️⃣  Hashtags:         24
👥 Groups:           10
👤 Group Members:    29
📄 Group Posts:      5
💬 Conversations:    6
💌 Messages:         15
❤️  Reactions:        2
==================================================
```

## File Structure

```
__tests__/seed/
├── README.md                    # This file
├── TEST_DATA_REFERENCE.md       # Detailed data reference
├── test-database.config.ts      # Test database configuration
├── seed.ts                      # Main seed script
├── teardown.ts                  # Database cleanup script
└── generators/
    ├── users.ts                 # User generation
    ├── relationships.ts         # Friendships, follows
    ├── media.ts                 # Media items
    ├── galleries.ts             # Gallery organization
    ├── posts.ts                 # Posts and hashtags
    ├── groups.ts                # Groups and memberships
    └── messages.ts              # Conversations and messages
```

## Usage in Tests

### Import Test Database Client

```typescript
import { testPrisma } from '@/__tests__/seed/test-database.config'

// Use testPrisma in your tests
const users = await testPrisma.user.findMany()
```

### Get Specific Test Users

```typescript
import { getUserByEmail } from '@/__tests__/seed/generators/users'

const alice = await getUserByEmail('alice@test.com')
const bob = await getUserByEmail('bob@test.com')
```

### Reset Between Tests

```typescript
import { resetDatabase } from '@/__tests__/seed/test-database.config'

beforeEach(async () => {
  await resetDatabase()
  // Reseed if needed
})
```

## Configuration

### Test Database URL

Set via environment variable:

```bash
export TEST_DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/reeditestdb"
```

Or configure in `test-database.config.ts`.

### Seed Options

```typescript
interface SeedOptions {
  extended: boolean  // Include extended users and data
  reset: boolean     // Reset database before seeding
}
```

## Testing Scenarios Covered

### ✅ Authentication & Authorization
- User login with valid credentials
- Private vs public account access
- Friend-only content visibility
- Locked content with pricing

### ✅ Media Management
- Media upload and processing states
- Gallery organization
- Media visibility controls
- Failed processing handling

### ✅ Social Features
- Friendships and pending requests
- Follow relationships
- User blocking (data structure ready)

### ✅ Content Management
- Posts with/without media
- Post visibility levels
- Publication status (public, paused, deleted)
- Hashtag filtering and search

### ✅ Groups
- Public, semi-private, and private groups
- Group membership roles
- Group applications and invitations
- Group post moderation

### ✅ Messaging
- Direct messages
- Group conversations
- Message delivery tracking
- Message reactions
- Media in messages

## Cleanup

```bash
# Clean all test data
npx tsx __tests__/seed/teardown.ts

# Drop test database (if needed)
dropdb reeditestdb
```

## Best Practices

1. **Reset between test suites** - Use `resetDatabase()` to ensure clean state
2. **Use consistent test data** - Reference users by email in tests
3. **Test edge cases** - Eve has no posts, pending statuses exist
4. **Verify permissions** - Test friend-only, private, and locked content
5. **Check all states** - Media has pending/failed states, posts have paused status

## Troubleshooting

### Schema out of sync

```bash
# Sync schema to test database
export DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/reeditestdb"
npx prisma db push
```

### Seed fails

```bash
# Check database connection
psql "postgresql://postgres:PASSWORD@localhost:5432/reeditestdb"

# Verify schema is synced
npx prisma db pull
```

### Need fresh start

```bash
# Drop and recreate
dropdb reeditestdb
createdb reeditestdb
npx prisma db push
npx tsx __tests__/seed/seed.ts
```

## Next Steps

1. Write integration tests using this seed data
2. Create E2E tests with Playwright
3. Add performance tests with seeded data
4. Implement CI/CD test pipeline

## See Also

- [TEST_DATA_REFERENCE.md](./TEST_DATA_REFERENCE.md) - Detailed reference of all seeded data
- [TEST_SETUP.md](../TEST_SETUP.md) - Complete test environment setup
- [/frontend/actions-to-test.md](/frontend/actions-to-test.md) - Test specifications
