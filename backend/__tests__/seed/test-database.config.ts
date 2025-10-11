import { PrismaClient } from '@prisma/client'

// Test database configuration
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 
  'postgresql://postgres:te1twe5tX1966@localhost:5432/reeditestdb'

// Create a new Prisma client for tests
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: TEST_DATABASE_URL
    }
  },
  log: process.env.DEBUG_TESTS ? ['query', 'error', 'warn'] : ['error']
})

// Helper to reset database between tests
export async function resetDatabase() {
  const tables = await testPrisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `
  
  // Disable foreign key checks temporarily
  await testPrisma.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED')
  
  // Truncate all tables except migrations
  for (const { tablename } of tables) {
    if (tablename !== '_prisma_migrations') {
      await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`)
    }
  }
  
  await testPrisma.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE')
}

// Helper to close database connection
export async function closeDatabase() {
  await testPrisma.$disconnect()
}

// Test configuration
export const testConfig = {
  // Test users all use this password
  defaultPassword: 'Test123!',
  
  // JWT secret for tests
  jwtSecret: process.env.TEST_JWT_SECRET || 'test-jwt-secret-do-not-use-in-production',
  
  // S3 configuration for tests (Localstack/MinIO)
  s3: {
    endpoint: process.env.TEST_S3_ENDPOINT || 'http://localhost:4566',
    region: process.env.TEST_S3_REGION || 'us-east-1',
    bucket: process.env.TEST_S3_BUCKET || 'reedi-test',
    accessKeyId: process.env.TEST_AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.TEST_AWS_SECRET_ACCESS_KEY || 'test'
  },
  
  // Media processor configuration
  mediaProcessor: {
    // Use simplified processing for tests
    enabled: process.env.TEST_MEDIA_PROCESSOR_ENABLED === 'true',
    mock: process.env.TEST_MEDIA_PROCESSOR_MOCK !== 'false'
  },
  
  // RabbitMQ configuration for tests
  rabbitmq: {
    enabled: process.env.TEST_RABBITMQ_ENABLED === 'true',
    url: process.env.TEST_RABBITMQ_URL || 'amqp://localhost'
  }
}

