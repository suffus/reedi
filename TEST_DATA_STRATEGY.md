# Test Data Generation Strategy for Reedi Platform

## Executive Summary

Based on your requirements, here's the recommended approach for test data generation:

### Key Decisions

1. **✅ Use Empty Database + Prisma Migrations** - Correct approach
2. **✅ Generate Real Test Media** - Images and videos for realistic testing
3. **✅ Hybrid Approach**: Direct DB for base data + API for complex workflows
4. **✅ Mock Media Processor** for unit/integration tests, simplified real for E2E

## Testing Pyramid

```
     /\
    /  \  E2E Tests (5%)
   /----\  - Real DB, real/simplified services
  /------\ Integration Tests (25%)
 /--------\ - Real DB, mocked services
/----------\ Unit Tests (70%)
              - Mocked everything
```

## Data Generation Approach

### Base Data → Direct Database Insertion

**Why:** Fast, deterministic, can create exact database states

**What:**
- User accounts
- Basic relationships (friends, follows)
- Static configuration data

**Implementation:** Direct Prisma queries in seed scripts

```typescript
// Fast and deterministic
await prisma.user.create({ data: {...} })
await prisma.friendRequest.create({ data: {...} })
```

### Complex Workflows → API Calls

**Why:** Tests business logic, validates workflows, ensures API works

**What:**
- Posts with media (tests media attachment logic)
- Group creation (tests permission setup)
- Message sending (tests real-time features)
- Media uploads (tests processing pipeline)

**Implementation:** Use Supertest to call actual API endpoints

```typescript
// Tests full stack including validation
await request(app)
  .post('/api/posts')
  .set('Authorization', `Bearer ${token}`)
  .send({ title: 'Test', content: 'Test', mediaIds: [...] })
```

### Hybrid Approach Benefits

| Aspect | Direct DB | API Calls |
|--------|-----------|-----------|
| Speed | ⚡ Very Fast | 🐢 Slower |
| Business Logic | ❌ Skipped | ✅ Tested |
| Validation | ❌ Skipped | ✅ Tested |
| Realistic | ⚠️ Somewhat | ✅ Very |
| Use For | Base data | Complex workflows |

## Media Processor Strategy

### Unit Tests
- **Fully Mocked**
- Return immediate success/failure
- No actual file operations
- Test logic, not processing

```typescript
jest.mock('../services/mediaProcessor')
mediaProcessor.processVideo.mockResolvedValue({ success: true })
```

### Integration Tests
- **Mocked Queue + Real File Operations**
- Mock RabbitMQ (no queue)
- Use pre-generated fixture files
- Mock processing service responses
- Use LocalStack for S3

```typescript
// Use fixture files, mock processing results
const testImage = fs.readFileSync('__tests__/fixtures/test-image.jpg')
mockS3.upload.mockResolvedValue({ Location: 'http://...' })
```

### E2E Tests
**Two Options:**

#### Option 1: Simplified Real Processor (Recommended)
- Run actual media processor in test mode
- Use smaller test files (10s videos instead of hours)
- Generate only essential quality versions (1-2 instead of 5)
- Skip advanced features (AI analysis, etc.)
- Still validates end-to-end flow

#### Option 2: Mock with Actual File Operations
- Mock the queue but perform real thumbnail generation
- Use sharp for images, ffmpeg for videos
- Generate basic versions only
- Faster than full processing

**Recommendation:** Start with Option 2, move to Option 1 for production

## Implementation Structure

```
backend/
  __tests__/
    seed/                        # Test data generation
      README.md                  # Documentation
      test-database.config.ts    # DB configuration
      seed.ts                    # Main seed script
      teardown.ts                # Cleanup script
      
      fixtures/                  # Static test files
        generate-fixtures.sh     # Script to create media
        images/                  # Test images
          test-image-small.jpg
          test-image-medium.jpg
          test-image.png
          test-image.gif
        videos/                  # Test videos
          test-video-short.mp4
          test-video.webm
          test-video.mov
      
      generators/                # Data generators
        users.ts                 # Generate users
        relationships.ts         # Generate friend/follow
        media.ts                 # Generate media records
        galleries.ts             # Generate galleries
        posts.ts                 # Generate posts
        groups.ts                # Generate groups
        messages.ts              # Generate messages
    
    unit/                        # Unit tests
      services/
      utils/
    
    integration/                 # Integration tests
      routes/
        auth.test.ts
        posts.test.ts
        media.test.ts
        groups.test.ts
      middleware/
    
    e2e/                         # End-to-end tests
      workflows/
        user-journey.test.ts
        content-creation.test.ts
    
    docker-compose.test.yml      # Test services
    TEST_SETUP.md                # Setup guide
```

## Test Environment Services

### Required Services

```yaml
# docker-compose.test.yml
services:
  postgres-test:     # Test database (port 5433)
  localstack:        # S3 emulation (port 4566)
  redis-test:        # Caching (port 6380)
  rabbitmq-test:     # Queue (port 5673) - Optional
```

### Setup Commands

```bash
# 1. Start services
docker-compose -f __tests__/docker-compose.test.yml up -d

# 2. Run migrations
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/reedi_test" \
  npx prisma migrate deploy

# 3. Generate fixtures
npm run test:fixtures:generate

# 4. Seed data
npm run test:seed              # Minimal
npm run test:seed:full         # Full E2E data

# 5. Run tests
npm run test:integration
npm run test:e2e
```

## Test Data Sets

### Minimal Set (Integration Tests)
**Goal:** Fast tests, essential scenarios

- **5 users** (alice, bob, charlie, david, eve)
- **10 media items** (5 images, 5 videos)
- **2 galleries** (one public, one private)
- **10 posts** (various visibilities)
- **1 group** (with members)
- **Basic relationships** (friends, follows)

**Seed Time:** ~5 seconds

### Full Set (E2E Tests)
**Goal:** Comprehensive testing, all scenarios

- **15 users** (extended network)
- **50 media items** (various formats, processing states)
- **10 galleries** (all visibility types)
- **30 posts** (locked, unlocked, various states)
- **5 groups** (different configurations)
- **Complex relationships** (nested friend networks)
- **20 conversations** with messages

**Seed Time:** ~30 seconds

## Media Fixture Generation

### Test Images (using ImageMagick)

```bash
# Small JPEG (800x600, ~100KB)
convert -size 800x600 xc:white -fill blue \
  -draw "rectangle 100,100 700,500" \
  test-image-small.jpg

# Progressive JPEG
convert -size 1280x720 xc:white \
  -interlace Plane test-progressive.jpg

# PNG, GIF, etc.
```

### Test Videos (using FFmpeg)

```bash
# Short MP4 (10s, 720p)
ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
  -f lavfi -i sine=frequency=1000:duration=10 \
  -c:v libx264 -preset fast -crf 23 \
  test-video-short.mp4

# WebM, MOV formats
```

### Fixture Benefits
- ✅ Deterministic (same files every time)
- ✅ Fast (pre-generated, not created per test)
- ✅ Small (optimized for test speed)
- ✅ Realistic (actual media formats)

## NPM Scripts (Add to package.json)

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=__tests__/unit",
    "test:integration": "jest --testPathPattern=__tests__/integration",
    "test:e2e": "jest --testPathPattern=__tests__/e2e",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    
    "test:services:up": "docker-compose -f __tests__/docker-compose.test.yml up -d",
    "test:services:down": "docker-compose -f __tests__/docker-compose.test.yml down",
    "test:services:logs": "docker-compose -f __tests__/docker-compose.test.yml logs -f",
    
    "test:db:migrate": "DATABASE_URL=$TEST_DATABASE_URL prisma migrate deploy",
    "test:db:reset": "tsx __tests__/seed/teardown.ts",
    
    "test:fixtures:generate": "bash __tests__/seed/fixtures/generate-fixtures.sh",
    
    "test:seed": "tsx __tests__/seed/seed.ts",
    "test:seed:full": "tsx __tests__/seed/seed.ts --extended",
    "test:seed:reset": "tsx __tests__/seed/seed.ts --reset",
    
    "test:teardown": "tsx __tests__/seed/teardown.ts",
    
    "test:setup": "npm run test:services:up && npm run test:db:migrate && npm run test:fixtures:generate && npm run test:seed",
    "test:all": "npm run test:setup && npm test && npm run test:teardown"
  }
}
```

## Answers to Your Questions

### Q: Generate data directly or through API?

**A: Hybrid Approach**
- ✅ **Direct DB** for base data (users, relationships) - Fast
- ✅ **API calls** for complex workflows (posts, groups) - Realistic
- ✅ **Best of both worlds** - Speed + validation

### Q: How to deal with media processor?

**A: Layered Approach**

1. **Unit Tests**: Fully mocked
2. **Integration Tests**: Mock queue + use fixture files
3. **E2E Tests**: Simplified real processor OR mock with real file ops

**Recommendation**: 
- Start with fully mocked for unit/integration
- Use simplified real processor for critical E2E tests
- Can add full processor tests in staging environment

### Q: E2E should use real data?

**A: Yes, you're correct! ✅**

- E2E tests should be as realistic as possible
- Use real database with real data
- Use real or simplified media processing
- Use LocalStack/MinIO for S3 (real enough)
- Mock only external paid APIs (payment processors, etc.)

### Q: Unit/Integration can be mocked?

**A: Yes, absolutely! ✅**

- Unit tests: Mock everything external
- Integration tests: Real DB + mocked external services
- E2E tests: Everything real (except expensive external APIs)

## Migration Path

### Phase 1: Foundation (Week 1)
- ✅ Set up test database
- ✅ Create docker-compose for test services
- ✅ Generate media fixtures
- ✅ Create basic seed scripts (users, relationships)

### Phase 2: Integration Tests (Week 2)
- ✅ Set up Jest + Supertest
- ✅ Write auth tests
- ✅ Write media upload tests (mocked processor)
- ✅ Write posts tests
- ✅ Mock external services properly

### Phase 3: Extended Seeding (Week 3)
- ✅ Complete seed scripts (galleries, posts, groups, messages)
- ✅ Create extended seed data for E2E
- ✅ Set up S3 mock (LocalStack)

### Phase 4: E2E Tests (Week 4)
- ✅ Set up Playwright or Cypress
- ✅ Write complete user journey tests
- ✅ Implement simplified media processor for tests
- ✅ Add to CI/CD pipeline

## CI/CD Integration

```yaml
# .github/workflows/test.yml
- name: Start test services
  run: docker-compose -f __tests__/docker-compose.test.yml up -d

- name: Run migrations
  run: npm run test:db:migrate

- name: Generate fixtures
  run: npm run test:fixtures:generate

- name: Seed test data
  run: npm run test:seed

- name: Run all tests
  run: npm run test:coverage

- name: Cleanup
  run: npm run test:services:down
```

## Performance Targets

| Test Type | Target Time | Parallelization |
|-----------|-------------|-----------------|
| Unit | < 1 min | Yes (20 workers) |
| Integration | < 5 min | Limited (5 workers) |
| E2E | < 15 min | No (sequential) |
| **Total** | **< 20 min** | Mixed |

## Next Steps

1. **Review this strategy** - Make sure it fits your needs
2. **Install dependencies** - Jest, Supertest, testing libraries
3. **Set up test environment** - Run docker-compose
4. **Generate fixtures** - Create test images/videos
5. **Complete seed scripts** - Finish media/posts/groups generators
6. **Write first tests** - Start with auth and posts
7. **Iterate and improve** - Refine based on what works

## Recommendations Summary

✅ **DO:**
- Use hybrid approach (direct DB + API)
- Generate real media fixtures once
- Mock media processor for unit/integration
- Use real services for E2E (with LocalStack)
- Isolate tests with transactions or DB reset
- Parallelize unit and integration tests
- Keep E2E tests focused and minimal

❌ **DON'T:**
- Generate media on every test run (too slow)
- Use real external APIs in tests (unreliable)
- Skip test isolation (causes flaky tests)
- Make E2E tests too comprehensive (too slow)
- Use production database for tests (dangerous)

## Questions?

If you have any questions about this strategy or need clarification on any part, let me know!

