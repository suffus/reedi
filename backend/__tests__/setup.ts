/**
 * Jest global setup
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:te1twe5tX1966@localhost:5432/reeditestdb'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL

// Increase timeout for slower operations
jest.setTimeout(30000)

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless VERBOSE=true
  log: process.env.VERBOSE ? console.log : jest.fn(),
  debug: process.env.VERBOSE ? console.debug : jest.fn(),
  info: process.env.VERBOSE ? console.info : jest.fn(),
  // Keep error and warn
  error: console.error,
  warn: console.warn,
}

