# Test Data Seeding Guide

## Commands

### `npm run test:seed:reset` ✅ **RECOMMENDED**
**Use this when:**
- First time seeding
- Reseeding after schema changes
- You want a clean slate

**What it does:**
1. Deletes ALL data from test database
2. Creates fresh test users with line management
3. Seeds relationships, media, posts, groups, messages

```bash
npm run test:seed:reset
```

### `npm run test:seed` ⚠️ **Incremental**
**Use this when:**
- You want to add MORE test data
- Users already exist and you don't want to delete them

**Warning:** Will fail if users/groups already exist with same emails/usernames

```bash
npm run test:seed
```

### `npm run test:seed:extended`
Seeds additional test data for E2E tests (more users, posts, groups, etc.)

```bash
npm run test:seed:extended
```

### `npm run test:teardown`
Clean up all test data (same as reset but doesn't reseed)

```bash
npm run test:teardown
```

## Test User Structure

After seeding, you'll have these test users (password: `Test123!`):

```
alice@test.com (Manager)
  ├─→ bob@test.com (Direct report)
  │    └─→ david@test.com (Indirect report to Alice)
  └─→ charlie@test.com (Direct report)

eve@test.com (Independent user)
```

### Friendships
- Alice ↔ Bob
- Alice ↔ Charlie  
- Bob ↔ David
- Charlie ↔ David

### Pending Friend Requests
- Eve → Alice (pending)

### Follow Relationships
- Alice, Bob, David → Charlie (following Charlie)
- Charlie → Alice (following Alice)

## Running Tests

```bash
# ALWAYS seed before integration tests
npm run test:seed:reset

# Then run tests
npm test -- __tests__/integration

# Or run unit tests (don't need seeding)
npm test -- __tests__/unit --runInBand
```

## Troubleshooting

### Error: "Unique constraint failed on the fields: (`email`)"

**Problem:** Users already exist in database

**Solution:** Use reset command
```bash
npm run test:seed:reset
```

### Error: "Cannot read properties of null (reading 'id')"

**Problem:** Test users don't exist in database

**Solution:** Seed the database first
```bash
npm run test:seed:reset
npm test -- __tests__/integration
```

### Tests fail after schema changes

**Solution:** Reset database, run migration, then reseed
```bash
# 1. Run migration on test database
DATABASE_URL="postgresql://postgres:te1twe5tX1966@localhost:5432/reeditestdb" npx prisma migrate dev

# 2. Reseed
npm run test:seed:reset

# 3. Run tests
npm test
```

## Quick Reference

| Scenario | Command |
|----------|---------|
| First time setup | `npm run test:seed:reset` |
| Reseeding after changes | `npm run test:seed:reset` |
| Database is dirty | `npm run test:seed:reset` |
| Just need to add more data | `npm run test:seed` |
| After schema migration | Reset DB → `npm run test:seed:reset` |
| Before integration tests | `npm run test:seed:reset` |

**Rule of thumb:** When in doubt, use `npm run test:seed:reset` ✅

