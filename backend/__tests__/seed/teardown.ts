#!/usr/bin/env node

/**
 * Test data teardown script
 * 
 * Usage:
 *   npm run test:teardown    # Clean up test data
 */

import { testPrisma, resetDatabase, closeDatabase } from './test-database.config'

async function main() {
  console.log('\n🗑️  Starting test data teardown...')
  
  try {
    await resetDatabase()
    console.log('✅ Test database cleaned')
  } catch (error) {
    console.error('\n❌ Error tearing down test data:', error)
    process.exit(1)
  } finally {
    await closeDatabase()
  }
  
  console.log('\n✅ Teardown complete\n')
}

// Run if called directly
if (require.main === module) {
  main()
}

export { main as teardownTestData }

