#!/usr/bin/env node

/**
 * Main test data seeding script
 * 
 * Usage:
 *   npm run test:seed              # Minimal seed data for integration tests
 *   npm run test:seed:full         # Full seed data for E2E tests
 *   npm run test:seed:reset        # Reset database and reseed
 */

import { testPrisma, resetDatabase, closeDatabase } from './test-database.config'
import { seedUsers, getUserByEmail } from './generators/users'
import { seedFriendships, seedPendingFriendRequests, seedFollows, seedExtendedRelationships } from './generators/relationships'
import { seedMedia, seedExtendedMedia } from './generators/media'
import { seedGalleries, seedExtendedGalleries } from './generators/galleries'
import { seedPosts, seedExtendedPosts } from './generators/posts'
import { seedGroups, seedExtendedGroups } from './generators/groups'
import { seedMessages, seedExtendedMessages } from './generators/messages'
import { seedComments } from './generators/comments'

interface SeedOptions {
  extended: boolean
  reset: boolean
}

async function main() {
  const args = process.argv.slice(2)
  const options: SeedOptions = {
    extended: args.includes('--extended') || args.includes('--full'),
    reset: args.includes('--reset')
  }
  
  console.log('\n🚀 Starting test data seeding...')
  console.log(`Mode: ${options.extended ? 'Extended (E2E)' : 'Minimal (Integration)'}`)
  
  try {
    // Reset database if requested
    if (options.reset) {
      console.log('\n🗑️  Resetting database...')
      await resetDatabase()
      console.log('✅ Database reset complete')
    }
    
    // Seed users
    console.log('\n👥 Seeding users...')
    const users = await seedUsers(options.extended)
    console.log(`✅ Seeded ${users.length} users`)
    
    // Seed relationships
    console.log('\n🤝 Seeding relationships...')
    await seedFriendships(users)
    await seedPendingFriendRequests(users)
    await seedFollows(users)
    
    if (options.extended) {
      await seedExtendedRelationships(users)
    }
    
    console.log('✅ Relationships seeded')
    
    // Seed media
    console.log('\n📸 Seeding media...')
    await seedMedia(users)
    
    if (options.extended) {
      await seedExtendedMedia(users)
    }
    
    console.log('✅ Media seeded')
    
    // Seed galleries
    console.log('\n🖼️  Seeding galleries...')
    await seedGalleries(users)
    
    if (options.extended) {
      await seedExtendedGalleries(users)
    }
    
    console.log('✅ Galleries seeded')
    
    // Seed posts
    console.log('\n📝 Seeding posts...')
    await seedPosts(users)
    
    if (options.extended) {
      await seedExtendedPosts(users)
    }
    
    console.log('✅ Posts seeded')
    
    // Seed groups
    console.log('\n👥 Seeding groups...')
    await seedGroups(users)
    
    if (options.extended) {
      await seedExtendedGroups(users)
    }
    
    console.log('✅ Groups seeded')
    
    // Seed messages
    console.log('\n💬 Seeding messages...')
    await seedMessages(users)
    
    if (options.extended) {
      await seedExtendedMessages(users)
    }
    
    console.log('✅ Messages seeded')
    
    // Seed comments
    console.log('\n💬 Seeding comments...')
    await seedComments()
    console.log('✅ Comments seeded')
    
    // Print summary
    console.log('\n' + '='.repeat(50))
    console.log('✅ Seed data generation complete!')
    console.log('='.repeat(50))
    console.log('\nTest Users (all use password: Test123!):')
    for (const user of users) {
      console.log(`  - ${user.email} (${user.username})${user.canPublishLockedMedia ? ' [Content Creator]' : ''}${user.isPrivate ? ' [Private]' : ''}`)
    }
    
    console.log('\nFriend Relationships:')
    console.log('  - Alice ↔ Bob')
    console.log('  - Alice ↔ Charlie')
    console.log('  - Bob ↔ David')
    console.log('  - Charlie ↔ David')
    
    console.log('\nPending Requests:')
    console.log('  - Eve → Alice (pending)')
    
    console.log('\nFollow Relationships:')
    console.log('  - Alice, Bob, David → Charlie')
    console.log('  - Charlie → Alice')
    
    if (options.extended) {
      console.log('\n  + Extended relationship network with 10 users')
    }
    
    console.log('\n' + '='.repeat(50))
    console.log('Next steps:')
    console.log('1. Generate media fixtures: npm run test:fixtures:generate')
    console.log('2. Complete media/posts/groups seeding')
    console.log('3. Run tests: npm run test:integration')
    console.log('='.repeat(50) + '\n')
    
  } catch (error) {
    console.error('\n❌ Error seeding data:', error)
    process.exit(1)
  } finally {
    await closeDatabase()
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { main as seedTestData }

