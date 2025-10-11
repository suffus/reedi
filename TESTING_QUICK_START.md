# Testing Quick Start Guide

## TL;DR

You now have a complete testing strategy for your Reedi platform. Here's what was created:

## 📋 What You Have

### 1. Test Specification (`frontend/actions-to-test.md`)
- **567 specific test cases** across 15 feature areas
- Organized by priority (P0-P3)
- Complete coverage of all major features
- Integration and E2E workflow tests

### 2. Test Data Strategy (`TEST_DATA_STRATEGY.md`)
- Hybrid approach: Direct DB + API calls
- Real media fixtures generation
- Layered mocking strategy
- Performance targets and best practices

### 3. Seed Data Scripts (`backend/__tests__/seed/`)
- User generation
- Relationship seeding (friends, follows)
- Fixture generation scripts
- Database reset utilities

### 4. Test Environment (`backend/__tests__/`)
- Docker Compose for test services (PostgreSQL, LocalStack, Redis, RabbitMQ)
- Test database configuration
- Setup and teardown scripts
- Comprehensive documentation

## 🚀 Getting Started (5 Minutes)

```bash
cd backend

# 1. Start test services
docker-compose -f __tests__/docker-compose.test.yml up -d

# 2. Wait for services (watch for "healthy" status)
docker-compose -f __tests__/docker-compose.test.yml ps

# 3. Set up environment
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/reedi_test"
export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/reedi_test"

# 4. Run migrations
npx prisma migrate deploy

# 5. Generate test media fixtures
bash __tests__/seed/fixtures/generate-fixtures.sh

# 6. Seed test data
npx tsx __tests__/seed/seed.ts

# 7. You're ready to write tests!
```

## 📝 Next Steps

### Immediate (This Week)

1. **Install Testing Dependencies**
   ```bash
   cd backend
   npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
   npm install --save-dev @testing-library/react @testing-library/jest-dom
   ```

2. **Complete Seed Scripts**
   - Finish `generators/media.ts` (uploads media fixtures)
   - Finish `generators/galleries.ts` (creates galleries)
   - Finish `generators/posts.ts` (creates posts via API)
   - Finish `generators/groups.ts` (creates groups)
   - Finish `generators/messages.ts` (creates conversations)

3. **Write First Tests**
   - Start with auth tests (easiest)
   - Then media upload tests
   - Then post creation tests

### Short Term (Next 2 Weeks)

4. **Integration Tests**
   - Test all API routes
   - Test business logic
   - Test permissions and visibility

5. **Unit Tests**
   - Test utility functions
   - Test services
   - Test middleware

### Medium Term (Next Month)

6. **E2E Tests**
   - Set up Playwright
   - Write complete user journey tests
   - Test critical workflows

7. **CI/CD Integration**
   - Add tests to GitHub Actions
   - Set up coverage reporting
   - Add quality gates

## 📖 Key Documents

| Document | Purpose | Location |
|----------|---------|----------|
| **Test Specification** | What to test | `frontend/actions-to-test.md` |
| **Data Strategy** | How to generate data | `TEST_DATA_STRATEGY.md` |
| **Setup Guide** | How to set up environment | `backend/__tests__/TEST_SETUP.md` |
| **Seed README** | How seeding works | `backend/__tests__/seed/README.md` |
| **This Guide** | Quick reference | `TESTING_QUICK_START.md` |

## 🎯 Testing Strategy Summary

### Test Pyramid

```
     /\
    /E2\     5% - Real everything (LocalStack, simplified processor)
   /----\
  /INTEG\   25% - Real DB, mocked external services
 /--------\
/   UNIT   \ 70% - Mocked everything
------------
```

### Data Generation

- **Base Data** → Direct DB inserts (fast)
- **Complex Workflows** → API calls (realistic)
- **Media Fixtures** → Pre-generated (deterministic)

### Media Processing

- **Unit**: Fully mocked
- **Integration**: Mocked queue + fixture files
- **E2E**: Simplified real processor

## 🔑 Test Users

All have password: `Test123!`

| User | Special Role |
|------|--------------|
| alice@test.com | Regular user |
| bob@test.com | Alice's friend |
| charlie@test.com | Content creator (can publish locked posts) |
| david@test.com | Group admin |
| eve@test.com | Private profile |

## ⚡ Common Commands

```bash
# Start test environment
npm run test:services:up

# Run migrations
npm run test:db:migrate

# Generate fixtures (one time)
npm run test:fixtures:generate

# Seed minimal data
npm run test:seed

# Seed full E2E data
npm run test:seed:full

# Reset and reseed
npm run test:seed:reset

# Run tests
npm test                    # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # E2E tests only
npm run test:coverage     # With coverage report

# Stop services
npm run test:services:down
```

## 🐛 Troubleshooting

### Services won't start
```bash
docker-compose -f __tests__/docker-compose.test.yml logs
```

### Port conflicts
Edit `__tests__/docker-compose.test.yml` and change ports

### Database connection fails
```bash
psql -h localhost -p 5433 -U postgres -d reedi_test
```

### Need clean slate
```bash
docker-compose -f __tests__/docker-compose.test.yml down -v
npm run test:db:reset
npm run test:seed:reset
```

## 📊 Success Metrics

Track these to ensure quality:

- **Code Coverage**: Target 80%+ for critical paths
- **Test Speed**: Unit < 1min, Integration < 5min, E2E < 15min
- **Test Reliability**: < 1% flaky tests
- **Bug Detection**: Catch bugs before production

## 💡 Pro Tips

1. **Write tests as you code** - Don't leave it to the end
2. **Keep tests simple** - One test = one behavior
3. **Use descriptive names** - "should create post when user is authenticated"
4. **Isolate tests** - No dependencies between tests
5. **Mock external APIs** - Tests should be fast and reliable
6. **Use factories** - Don't repeat test data creation
7. **Run tests locally** - Before pushing to CI

## 🎓 Learning Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Guide](https://github.com/visionmedia/supertest)
- [Prisma Testing](https://www.prisma.io/docs/guides/testing)
- [Testing Best Practices](https://testingjavascript.com/)

## ✅ Checklist

Before starting to write tests:

- [ ] Docker and Docker Compose installed
- [ ] Test services running (`docker-compose ps`)
- [ ] Test database created and migrated
- [ ] Media fixtures generated
- [ ] Test data seeded
- [ ] Jest configured
- [ ] First test written and passing

## 🤝 Your Questions Answered

**Q: Should we use empty database + Prisma migrations?**
✅ Yes, exactly right!

**Q: Generate data directly or via API?**
✅ Hybrid: Direct for base data, API for complex workflows

**Q: How to handle media processor?**
✅ Mock for unit/integration, simplified real for E2E

**Q: E2E should use real data?**
✅ Yes, as real as possible without external paid APIs

## 📞 Support

If you have questions or run into issues:

1. Check the documentation in `__tests__/TEST_SETUP.md`
2. Review the test specification in `frontend/actions-to-test.md`
3. Read the strategy document in `TEST_DATA_STRATEGY.md`

## 🎉 Ready to Test!

You now have everything you need to build a comprehensive test suite for your Reedi platform. Start with the auth tests and work your way through the test specification. Good luck!

---

**Remember**: Tests are not overhead - they're an investment in quality, confidence, and speed of development. Happy testing! 🚀

