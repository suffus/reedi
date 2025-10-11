# Test Environment Setup Guide

## Quick Start

```bash
# 1. Start test services
npm run test:services:up

# 2. Wait for services to be ready (health checks)
npm run test:services:wait

# 3. Run database migrations
npm run test:db:migrate

# 4. Generate media fixtures
npm run test:fixtures:generate

# 5. Seed test data
npm run test:seed

# 6. Run tests
npm run test:integration

# 7. Clean up
npm run test:services:down
```

## Detailed Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 18+
- PostgreSQL client tools (for manual DB access)
- ImageMagick (for generating test images)
- FFmpeg (for generating test videos)

### Install Tools (macOS)

```bash
brew install imagemagick ffmpeg postgresql
```

### Install Tools (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install imagemagick ffmpeg postgresql-client
```

## Test Services

The test environment uses Docker Compose to run:

1. **PostgreSQL** (port 5433) - Test database
2. **LocalStack** (port 4566) - AWS S3 emulation
3. **Redis** (port 6380) - Caching and sessions
4. **RabbitMQ** (port 5673) - Message queue (optional)

### Service Management

```bash
# Start all test services
docker-compose -f __tests__/docker-compose.test.yml up -d

# Check service status
docker-compose -f __tests__/docker-compose.test.yml ps

# View logs
docker-compose -f __tests__/docker-compose.test.yml logs -f

# Stop services
docker-compose -f __tests__/docker-compose.test.yml down

# Stop and remove volumes (clean slate)
docker-compose -f __tests__/docker-compose.test.yml down -v
```

## Database Setup

### Environment Variables

Create `.env.test` file:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/reedi_test"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/reedi_test"

# JWT
TEST_JWT_SECRET="test-jwt-secret-do-not-use-in-production"
JWT_SECRET="test-jwt-secret-do-not-use-in-production"

# S3 (LocalStack)
TEST_S3_ENDPOINT="http://localhost:4566"
AWS_ENDPOINT_URL="http://localhost:4566"
AWS_ACCESS_KEY_ID="test"
AWS_SECRET_ACCESS_KEY="test"
AWS_REGION="us-east-1"
IDRIVE_BUCKET_NAME="reedi-test"

# Redis
REDIS_URL="redis://localhost:6380"

# RabbitMQ
RABBITMQ_URL="amqp://test:test@localhost:5673"

# Test Configuration
NODE_ENV="test"
TEST_MEDIA_PROCESSOR_ENABLED="false"
TEST_MEDIA_PROCESSOR_MOCK="true"
```

### Run Migrations

```bash
# Set environment for test database
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/reedi_test"

# Run Prisma migrations
npx prisma migrate deploy

# Or use the npm script
npm run test:db:migrate
```

### Reset Database

```bash
npm run test:db:reset
```

## Test Data

### Generate Fixtures

Generate test images and videos:

```bash
npm run test:fixtures:generate
```

This creates:
- `__tests__/seed/fixtures/images/` - Test images (JPEG, PNG, GIF)
- `__tests__/seed/fixtures/videos/` - Test videos (MP4, WebM, MOV)

### Seed Data

```bash
# Minimal data for integration tests
npm run test:seed

# Full data for E2E tests
npm run test:seed:full

# Reset and reseed
npm run test:seed:reset
```

### Test Users

All test users have password: `Test123!`

| Email | Username | Role | Special |
|-------|----------|------|---------|
| alice@test.com | alice_test | User | - |
| bob@test.com | bob_test | User | Friends with Alice |
| charlie@test.com | charlie_test | User | Content Creator |
| david@test.com | david_test | User | Group Admin |
| eve@test.com | eve_test | User | Private Profile |

## Running Tests

### All Tests

```bash
npm test
```

### By Type

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e
```

### With Coverage

```bash
npm run test:coverage
```

### Watch Mode

```bash
npm run test:watch
```

### Specific Test File

```bash
npm test -- __tests__/integration/routes/posts.test.ts
```

### Debug Tests

```bash
# Enable debug output
DEBUG_TESTS=true npm test

# Run with Node debugger
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

## Test Isolation

### Transaction-based (Integration Tests)

Tests run within transactions that rollback after each test:

```typescript
beforeEach(async () => {
  await testPrisma.$executeRaw`BEGIN`;
});

afterEach(async () => {
  await testPrisma.$executeRaw`ROLLBACK`;
});
```

### Database Reset (E2E Tests)

E2E tests use a fresh database for each suite:

```typescript
beforeAll(async () => {
  await resetDatabase();
  await seedTestData();
});

afterAll(async () => {
  await teardownTestData();
});
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: reedi_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      localstack:
        image: localstack/localstack
        env:
          SERVICES: s3
        ports:
          - 4566:4566
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/reedi_test
      
      - name: Generate fixtures
        run: npm run test:fixtures:generate
      
      - name: Seed test data
        run: npm run test:seed
      
      - name: Run tests
        run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/reedi_test
          TEST_S3_ENDPOINT: http://localhost:4566
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Troubleshooting

### Services Not Starting

```bash
# Check Docker is running
docker ps

# Check logs
docker-compose -f __tests__/docker-compose.test.yml logs

# Restart services
docker-compose -f __tests__/docker-compose.test.yml restart
```

### Database Connection Issues

```bash
# Test connection
psql -h localhost -p 5433 -U postgres -d reedi_test

# Check if port is in use
lsof -i :5433
```

### LocalStack S3 Issues

```bash
# Check LocalStack is ready
curl http://localhost:4566/_localstack/health

# List buckets
aws --endpoint-url=http://localhost:4566 s3 ls

# Create bucket manually
aws --endpoint-url=http://localhost:4566 s3 mb s3://reedi-test
```

### Test Data Issues

```bash
# Reset everything and start fresh
npm run test:db:reset
npm run test:seed:reset
```

### Port Conflicts

If you get port conflicts, edit `docker-compose.test.yml` to use different ports.

## Performance Tips

1. **Use transaction-based tests** for speed (integration tests)
2. **Run tests in parallel** with Jest's `--maxWorkers` option
3. **Use smaller media files** for faster processing tests
4. **Mock external services** when possible
5. **Cache fixtures** in memory for repeated tests

## Best Practices

1. **Isolate tests** - Each test should be independent
2. **Use descriptive test names** - Follow "should do X when Y" pattern
3. **Test one thing** - Each test should verify one behavior
4. **Clean up** - Always clean up test data and resources
5. **Mock external dependencies** - Don't call real APIs in tests
6. **Use factories** - Create test data with factory functions
7. **Avoid flaky tests** - Use deterministic data and avoid timing issues

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- [LocalStack Documentation](https://docs.localstack.cloud/)

